import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import fs from 'node:fs';
import {html,setup} from './support/chat-panel.js';
import {createIntentLedger,newIntentKey} from '../studio-v3/intent-ledger.js';
import {createDemoTransport} from '../studio-v3/ai-demo-transport.js';
import {createGatewayModel} from '../studio-v3/agent-provider.js';
import {runAgentLoop} from '../studio-v3/agent-loop.js';
import {newProject} from '../studio-v3/demo-templates.js';

beforeEach(()=> {document.documentElement.innerHTML = html.replace(/<!doctype html>/i,'');document.body.inert = false;localStorage.clear();});
afterEach(()=> localStorage.clear());
const gate = () => { let open; const promise = new Promise(resolve => { open = resolve; }); return {promise,open}; };

describe('Studio v3 intent ledger (RUN-07)', () => {
  it('runs one effect for a key even when callers race, and returns the same outcome', async () => {
    const ledger = createIntentLedger(), key = newIntentKey(), start = gate(); let effects = 0;
    const effect = async () => { effects++; await start.promise; return {revision:1}; };
    const calls = [ledger.run(key,'input-a',effect),ledger.run(key,'input-a',effect),ledger.run(key,'input-a',effect)];
    start.open();
    const results = await Promise.all(calls);
    expect(effects).toBe(1); expect(results[1]).toBe(results[0]); expect(results[2]).toBe(results[0]);
    await expect(ledger.run(key,'input-a',effect)).resolves.toBe(results[0]); expect(effects).toBe(1); // replay after completion
    expect(await ledger.replay(key)).toBe(results[0]);
  });
  it('rejects the same key with a different input, and lets a new key express a deliberate repeat', async () => {
    const ledger = createIntentLedger(); let effects = 0; const effect = async () => ++effects;
    const first = newIntentKey(); await ledger.run(first,'input-a',effect);
    expect(() => ledger.run(first,'input-b',effect)).toThrow('INTENT_CONFLICT'); expect(effects).toBe(1);
    await ledger.run(newIntentKey(),'input-a',effect); expect(effects).toBe(2);
  });
  it('replays a failed outcome under the same key instead of retrying blindly, and validates the key', async () => {
    const ledger = createIntentLedger(), key = newIntentKey(); let effects = 0;
    const effect = async () => { effects++; throw Object.assign(new Error('EFFECT_UNKNOWN'),{code:'EFFECT_UNKNOWN'}); };
    await expect(ledger.run(key,'x',effect)).rejects.toMatchObject({code:'EFFECT_UNKNOWN'});
    await expect(ledger.run(key,'x',effect)).rejects.toMatchObject({code:'EFFECT_UNKNOWN'}); expect(effects).toBe(1);
    for (const bad of [undefined,'','short','has space in it 12345','x'.repeat(81),'../../etc/passwd1']) expect(() => ledger.run(bad,'x',effect), String(bad)).toThrow('INTENT_KEY_INVALID');
    expect(ledger.replay('unknown-key-1234')).toBeNull();
  });
  it('keeps a bounded memory and mints distinct keys', async () => {
    const ledger = createIntentLedger({limit:2}), keys = [newIntentKey(),newIntentKey(),newIntentKey()];
    expect(new Set(keys).size).toBe(3);
    for (const key of keys) await ledger.run(key,'x',async () => 1);
    expect(ledger.replay(keys[0])).toBeNull(); expect(ledger.replay(keys[2])).not.toBeNull();
  });
});

describe('Studio v3 Apply commits at most once (RUN-04, RUN-07)', () => {
  it('turns a double Apply, a queued repeat and a late repeat into one commit with no error', async () => {
    const start = gate(); let commits = 0, panel;
    const result = setup({commit:async proposal => { commits++; await start.promise; return {bus:panel.getBus(),revision:proposal.revision + 1}; }}); panel = result.panel;
    await panel.send(); await panel.preview();
    const key = panel.proposal.intentKey, first = panel.apply(key), second = panel.apply(key), third = panel.apply(key);
    start.open(); await Promise.all([first,second,third]);
    expect(commits).toBe(1); expect(panel.conversation.messages.at(-1)).toMatchObject({status:'applied'});
    await panel.apply(key); expect(commits).toBe(1); // after completion the proposal is gone, the key still answers
    expect(panel.node('[data-ai-status]').textContent).not.toMatch(/failed|stale|Send a new request/i);
  });
  it('binds the Apply button to the proposal key, and mints a new key for a new proposal', async () => {
    const {panel} = setup({commit:async proposal => ({bus:panel.getBus(),revision:proposal.revision + 1})});
    await panel.send(); const key = panel.proposal.intentKey;
    expect(panel.node('[data-ai=apply]').dataset.intent).toBe(key);
    await panel.preview(); await panel.apply(key);
    panel.node('#ai-prompt').value = 'Use navy accents again.'; panel.share(); await panel.send();
    expect(panel.proposal.intentKey).not.toBe(key); expect(panel.node('[data-ai=apply]').dataset.intent).toBe(panel.proposal.intentKey);
  });
  it('never commits the current proposal under a key that belongs to another one', async () => {
    let commits = 0; const {panel} = setup({commit:async () => { commits++; return {}; }});
    await panel.send(); await panel.preview();
    for (const wrong of [newIntentKey(),'','00000000-0000-4000-8000-000000000000']) await expect(panel.apply(wrong), wrong).rejects.toMatchObject({code:'STALE_PROPOSAL'});
    expect(commits).toBe(0); expect(panel.getBus().revision).toBe(0); expect(panel.proposal).not.toBeNull();
  });
  it('still rejects a stale proposal the first time, with the committed form untouched', async () => {
    let commits = 0; const {panel,changeBus} = setup({commit:async () => { commits++; return {}; }});
    await panel.send(); await panel.preview(); const key = panel.proposal.intentKey; changeBus();
    await expect(panel.apply(key)).rejects.toMatchObject({code:'STALE_PROPOSAL'}); expect(commits).toBe(0); expect(panel.getBus().revision).toBe(0);
  });
});

describe('Studio v3 token budget boundaries (RUN-05)', () => {
  const json = (body,status = 200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  const stream = events => new Response(events.map(event=>`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''),{status:200,headers:{'content-type':'text/event-stream'}});
  const call = (n,name,args) => ({id:`fc_${n}`,type:'function_call',status:'completed',call_id:`call_${n}`,name,arguments:JSON.stringify(args)});
  // Every turn is a get_context call that costs `cost` tokens in total; the run ends when a request is refused.
  async function spend(maxTokens,cost) {
    const bodies = [], transport = createDemoTransport({fetchImpl:async (url,init) => {
      if (url.endsWith('/session')) return json({token:'dmo_synthetic1',expires_in:900},201);
      bodies.push(JSON.parse(init.body));
      return stream([{type:'response.created',response:{status:'in_progress',output:[]}},{type:'response.completed',response:{status:'completed',output:[call(bodies.length,'get_context',{})],usage:{input_tokens:cost - 2,output_tokens:2,total_tokens:cost}}}]);
    }});
    const provider = createGatewayModel({transport,alias:'demo-fast',signal:new AbortController().signal,maxTokens});
    const error = await runAgentLoop({...provider,failure:provider.failure,project:newProject(),request:'Look.',context:() => 'CONTEXT',inspect:async () => ({report:{status:'ready'}}),
      signal:new AbortController().signal,limits:{maxTurns:100,maxRunMs:60000,maxRepeatedFailures:100,maxRunTokens:maxTokens,maxNoteChars:1000,imageTurns:3}}).then(() => null,e => e);
    return {requests:bodies.length,total:provider.usage().total,error};
  }
  it('starts no request once accounted usage reaches the limit exactly', async () => {
    const result = await spend(20,10);
    expect(result.error).toMatchObject({code:'AGENT_TOKEN_BUDGET'}); expect(result.requests).toBe(2); expect(result.total).toBe(20);
  });
  it('allows a request that starts one token under the limit, and lets that response cross it (a bounded overshoot)', async () => {
    const result = await spend(21,10);
    expect(result.error).toMatchObject({code:'AGENT_TOKEN_BUDGET'}); expect(result.requests).toBe(3); expect(result.total).toBe(30);
    expect(result.total - 21).toBeLessThan(10); // at most one response crosses the limit
  });
});

// Each G3 case names where it is proven. The cited tests must exist, so a rename cannot silently drop a case.
describe('Studio v3 G3 case register', () => {
  const REGISTER = JSON.parse(fs.readFileSync('docs/studio-v3-run-evidence.json','utf8'));
  const titles = file => [...fs.readFileSync(file,'utf8').matchAll(/\b(?:it|test)(?:\.each\([^)]*\))?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)].map(m => m[2]);
  const variants = title => [title,title.replace(/\\(['"`])/g,'$1')];

  it('cites only tests that exist, for every case that is claimed covered', () => {
    for (const entry of REGISTER.cases) {
      if (entry.status === 'open') { expect(entry.evidence, entry.id).toEqual([]); expect(entry.reason, entry.id).toBeTruthy(); continue; }
      expect(entry.evidence.length, entry.id).toBeGreaterThan(0);
      for (const {file,test} of entry.evidence) {
        expect(fs.existsSync(file), `${entry.id}: ${file}`).toBe(true);
        expect(titles(file).some(title => variants(test).some(name => title.includes(name))), `${entry.id}: "${test}" in ${file}`).toBe(true);
      }
    }
  });
  it('accounts for every G3 case, with the open and partial ones named', () => {
    expect(REGISTER.cases.map(entry => entry.id)).toEqual(['RUN-01','RUN-02','RUN-03','RUN-04','RUN-05','RUN-06','RUN-07','RUN-08']);
    const open = REGISTER.cases.filter(entry => entry.status !== 'covered').map(entry => `${entry.id}:${entry.status}`);
    expect(open).toEqual(['RUN-06:partial','RUN-08:open']);
  });
});
