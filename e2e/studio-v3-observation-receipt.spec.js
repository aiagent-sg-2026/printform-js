import {expectApplied} from './ai-applied.js';
import {test,expect} from './studio-v3-test.js';
import fs from 'node:fs/promises';
test.use({workInSteps:true});
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const accent = color => ({summary:'Accent',operations:[{type:'set_style',patch:{color}}]});
const STEPS = [
  ['inspect_draft'],['finish_answer',{message:'The current print diagnostics were observed.'}],
  ['apply_operations',accent('#163a65')],['inspect_draft'],['apply_operations',accent('#a82938')],['undo_step'],
  ['finish',{summary:'Must reject stale inspection'}],['inspect_draft'],['finish',{summary:'Fresh navy accents'}],
  ['inspect_draft'],['finish_answer',{message:'The new committed revision was observed.'}]
];

// Real page, renderer, Pi handlers and Demo transport; only the external provider is stubbed and every body is kept.
async function gateway(page) {
  await page.addInitScript(steps=> {
    const original = window.fetch.bind(window), json = (body,status = 200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    let turn = 0; window.__observationWire = [];
    window.fetch = async(input,init)=> {
      const url = new URL(typeof input === 'string' ? input : input.url,location.href);
      if (url.origin !== 'https://gpt.yapweijun1996.com') return original(input,init);
      if (url.pathname === '/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]});
      const body = JSON.parse(init.body); window.__observationWire.push(body);
      const [name,args = {}] = steps[turn++], output = [{type:'function_call',call_id:`call_${turn}`,name,arguments:JSON.stringify(args)}];
      const response = {status:'completed',output,usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
      return body.stream ? new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response})}\n\n`,{headers:{'content-type':'text/event-stream'}}) : json(response);
    };
  },STEPS);
}
const send = async(page,text)=> { await page.locator('#ai-prompt').fill(text); await page.locator('[data-ai-send]').click(); };
const observed = (body,callId)=> {
  expect(body.input.find(item=>item.type === 'function_call' && item.call_id === callId).name).toBe('inspect_draft');
  return JSON.parse(body.input.find(item=>item.type === 'function_call_output' && item.call_id === callId).output);
};

test('Validate and AI panel carry fresh revision-bound receipts, reject undo-revived evidence and recover',async({page},testInfo)=> {
  test.setTimeout(180000);
  const errors = []; page.on('pageerror',error=>errors.push(error.message));
  await gateway(page); await page.goto('/studio-v3/'); await ready(page);
  await page.locator('[data-mode=validate]').click();
  const runAll = page.getByRole('button',{name:'Run all synthetic samples',exact:true});
  await runAll.click(); await expect(runAll).toBeVisible({timeout:120000}); await ready(page);
  await expect(page.locator('#revision')).toHaveText('r0');
  await page.locator('[data-ai-toggle]').click(); await send(page,'Does the current form fit on the paper?');
  await expect(page.locator('.ai-message').filter({hasText:'The current print diagnostics were observed.'})).toBeVisible({timeout:60000});
  let wire = await page.evaluate(()=>window.__observationWire), first = observed(wire[1],'call_1');
  expect(first.observation).toMatchObject({baseRevision:0,candidateVersion:0,kind:'print-diagnostics',releaseIdentity:{verified:true}});
  expect(first.pages.length).toBeGreaterThan(0); expect(first.observation.evidenceRefs).toEqual([]);
  for (const key of ['candidateDigest','scenarioDigest','policyDigest','contentDigest']) expect(first.observation[key]).toMatch(/^[a-f0-9]{64}$/);
  await send(page,'Use navy accents #163a65.'); await expectApplied(page,1,{timeout:60000});
  wire = await page.evaluate(()=>window.__observationWire);
  const old = observed(wire[4],'call_4'), fresh = observed(wire[8],'call_8');
  const rejected = wire[7].input.find(item=>item.type === 'function_call_output' && item.call_id === 'call_7');
  expect(rejected.output).toContain('AGENT_INSPECTION_REQUIRED');
  expect(fresh.observation.candidateDigest).toBe(old.observation.candidateDigest);
  expect(fresh.observation.id).not.toBe(old.observation.id); expect(fresh.observation.candidateVersion).toBeGreaterThan(old.observation.candidateVersion);
  expect(fresh.observation.runId).not.toBe(first.observation.runId); await expect(page.locator('#revision')).toHaveText(/^r1\b/);
  await expect(page.frameLocator('#preview-frame').locator('.brand-mark').first()).toHaveCSS('color','rgb(22, 58, 101)');
  await send(page,'Does the new committed form fit on the paper?');
  await expect(page.locator('.ai-message').filter({hasText:'The new committed revision was observed.'})).toBeVisible({timeout:60000});
  wire = await page.evaluate(()=>window.__observationWire); const committed = observed(wire.at(-1),'call_10');
  expect(committed.observation.baseRevision).toBe(1); expect(committed.observation.runId).not.toBe(fresh.observation.runId);
  expect(committed.observation.documentId).toBe(first.observation.documentId);
  await expect(page.locator('#revision')).toHaveText(/^r1\b/); expect(errors).toEqual([]);
  const evidence = testInfo.outputPath('observation-provider-wire.json');
  await fs.writeFile(evidence,JSON.stringify({browser:testInfo.project.name,wire}));
  await testInfo.attach('observation-provider-wire',{path:evidence,contentType:'application/json'});
});
