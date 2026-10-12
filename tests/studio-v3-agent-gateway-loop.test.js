import {describe,it,expect} from 'vitest';
import {newProject,designOf} from '../studio-v3/model.js';
import {createDemoTransport} from '../studio-v3/ai-demo-transport.js';
import {createGatewayModel} from '../studio-v3/agent-provider.js';
import {runAgentLoop} from '../studio-v3/agent-loop.js';
import {createAgentMemory} from '../studio-v3/agent-memory.js';

// The whole run goes through the real tool loop, wire format and transport; only the gateway is faked.
const json = (body,status = 200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const stream = events => new Response(events.map(event=>`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''),{status:200,headers:{'content-type':'text/event-stream'}});
const reasoning = n => ({id:`rs_${n}`,type:'reasoning',content:[],encrypted_content:`enc-${n}`,summary:[]});
const fn = (n,name,args) => ({id:`fc_${n}`,type:'function_call',status:'completed',call_id:`call_${n}`,name,arguments:JSON.stringify(args)});
const msg = text => ({id:'msg_1',type:'message',status:'completed',content:[{type:'output_text',text}],phase:'commentary',role:'assistant'});
const turn = (output,tokens) => stream([{type:'response.created',response:{status:'in_progress',output:[]}},{type:'response.completed',response:{status:'completed',output,usage:{input_tokens:tokens,output_tokens:2,total_tokens:tokens + 2}}}]);
const note = {type:'add_field',section:'footer',field:{id:'note-two',label:'Extra note',kind:'static',text:'Authored note'}};

function setup(answers,{signal = new AbortController().signal,assertContext,maxTokens,onTurn} = {}) {
  const memory = createAgentMemory();
  const bodies = [], transport = createDemoTransport({fetchImpl:async(url,init)=> {
    if (url.endsWith('/session')) return json({token:'dmo_synthetic1',expires_in:900},201);
    bodies.push(JSON.parse(init.body)); const answer = answers.shift();
    if (init.signal?.aborted) throw Object.assign(new Error('aborted'),{name:'AbortError'});
    return typeof answer === 'function' ? answer(init) : answer;
  }});
  const provider = createGatewayModel({transport,alias:'demo-fast',signal,assertContext,maxTokens,onTurn,memory}), project = newProject();
  const promise = runAgentLoop({...provider,memory,failure:provider.failure,project,request:'Add an extra note to the footer.',scope:{mode:'whole'},context:()=>'CONTEXT-TEXT',inspect:async()=>({report:{status:'ready'}}),signal});
  return {promise,bodies,provider,project};
}
const failure = async promise => { try { await promise; } catch (error) { return error; } return null; };

describe('a tool run over the Demo gateway',()=> {
  it('replays each turn into the next, and ends with one proposal and the summed usage',async()=> {
    const {promise,bodies,provider,project} = setup([
      turn([reasoning(1),msg('Reading the form.'),fn(1,'get_context',{})],100),
      turn([reasoning(2),fn(2,'apply_operations',{summary:'Add a note',operations:[note]})],200),
      turn([reasoning(3),fn(3,'inspect_draft',{})],300),
      turn([reasoning(4),fn(4,'finish',{summary:'Added a footer note'})],400)
    ]);
    const result = await promise;
    expect(result.kind).toBe('proposal'); expect(result.turns).toBe(4); expect(designOf(result.candidate).footer.some(field=>field.id === 'note-two')).toBe(true);
    expect(designOf(project).footer.some(field=>field.id === 'note-two')).toBe(false);
    expect(provider.usage()).toEqual({input:1000,output:8,total:1008});
    expect(bodies).toHaveLength(4);
    const second = bodies[1].input;
    expect(second.map(item=>item.type || item.role)).toEqual(['system','user','reasoning','message','function_call','function_call_output']);
    expect(second[2]).toEqual({type:'reasoning',id:'rs_1',summary:[],encrypted_content:'enc-1'});
    expect(second[4]).toMatchObject({call_id:'call_1',name:'get_context'}); expect(second[5]).toEqual({type:'function_call_output',call_id:'call_1',output:'CONTEXT-TEXT'});
    const third = bodies[2].input;
    expect(third.filter(item=>item.type === 'function_call').map(item=>item.call_id)).toEqual(['call_1','call_2']);
    expect(third.at(-1).output).toContain('Applied.');
    for (const body of bodies) { expect(body.tools.map(tool=>tool.name)).toContain('finish'); expect(body.store).toBeUndefined(); expect(body.previous_response_id).toBeUndefined(); }
  });

  it('says so when the gateway has not enabled tools, before anything is drafted',async()=> {
    const {promise,provider} = setup([json({error:{code:'DEMO_AGENT_TOOLS_DISABLED',message:'agent tools are disabled'}},400)]);
    expect((await failure(promise)).code).toBe('DEMO_TOOLS_UNAVAILABLE'); expect(provider.usage().total).toBe(0);
  });

  it('stops at once when the person stops it while a request is open',async()=> {
    const controller = new AbortController(); let sent;
    const {promise} = setup([init=>new Promise((_resolve,reject)=>{ sent = init.signal; init.signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'}))); setTimeout(()=>controller.abort(),20); })],{signal:controller.signal});
    expect((await failure(promise)).name).toBe('AbortError');
    expect(sent.aborted).toBe(true); // the request in flight is cancelled, not left running behind the run
  });

  it('shows the model its own notes on the following turns, even once older results are folded',async()=> {
    const {promise,bodies} = setup([turn([reasoning(1),fn(1,'take_notes',{notes:'Totals sit bottom right.'})],10),turn([reasoning(2),fn(2,'get_context',{})],10),turn([reasoning(3),fn(3,'report_blocked',{reason:'stop'})],10)]);
    await failure(promise);
    expect(JSON.stringify(bodies[0].input)).not.toContain('Your notes');
    for (const body of bodies.slice(1)) expect(JSON.stringify(body.input)).toContain('Your notes:\\nTotals sit bottom right.');
  });

  it('stops before a request that would start past the token budget, and reports each turn as it ends',async()=> {
    const seen = [];
    const {promise,bodies} = setup([
      turn([reasoning(1),fn(1,'get_context',{})],10),turn([reasoning(2),fn(2,'get_context',{})],10),turn([reasoning(3),fn(3,'get_context',{})],10),turn([reasoning(4),fn(4,'finish',{summary:'x'})],10)
    ],{maxTokens:30,onTurn:info=>seen.push(info)});
    expect((await failure(promise)).code).toBe('AGENT_TOKEN_BUDGET');
    expect(bodies).toHaveLength(3); expect(seen.map(info=>info.totals.total)).toEqual([12,24,36]); expect(seen.map(info=>info.turn)).toEqual([1,2,3]);
  });

  it('stops before the next request when the live form changed under the run',async()=> {
    let changed = false; const accounted = [];
    const first = ()=> { changed = true; return turn([reasoning(1),fn(1,'get_context',{})],10); };
    const {promise,bodies} = setup([first,turn([reasoning(2),fn(2,'finish',{summary:'x'})],10)],{onTurn:info=>accounted.push(info.totals.total),assertContext:()=> { if (changed) throw Object.assign(new Error('STALE_PROPOSAL'),{code:'STALE_PROPOSAL'}); }});
    expect((await failure(promise)).code).toBe('STALE_PROPOSAL'); expect(bodies).toHaveLength(1);
    expect(accounted).toEqual([12]);
  });

  it('fails clearly when the model answers in words and calls no tool',async()=> {
    const {promise} = setup([turn([msg('All done.')],50)]);
    expect((await failure(promise)).code).toBe('AI_RUN_FAILED');
  });
});
