import {describe,it,expect} from 'vitest';
import {Type} from '@earendil-works/pi-ai';
import {createDemoTransport} from '../studio-v3/ai-demo-transport.js';
import {readEventStream} from '../studio-v3/ai-response-reader.js';
import {DEMO_CONFIG} from '../studio-v3/ai-gateway-config.js';

const json = (body,status = 200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const frames = events => events.map(event=>`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
const stream = events => new Response(frames(events),{status:200,headers:{'content-type':'text/event-stream'}});
const call = {id:'fc_1',type:'function_call',status:'completed',call_id:'call_1',name:'get_context',arguments:'{}'};
const completed = (output = [call]) => stream([{type:'response.created',response:{status:'in_progress',output:[]}},{type:'response.completed',response:{status:'completed',output,usage:{input_tokens:5,output_tokens:6,total_tokens:11}}}]);
const tools = [{name:'get_context',description:'Read it.',parameters:Type.Object({}),execute(){}}];
const context = () => ({systemPrompt:'S',messages:[{role:'user',content:'go',timestamp:1}],tools});
function gateway(answer = () => completed()) {
  const calls = [];
  const transport = createDemoTransport({fetchImpl:async(url,init)=> {
    calls.push({url,init});
    return url.endsWith('/session') ? json({token:`dmo_synthetic${calls.filter(item=>item.url.endsWith('/session')).length}`,expires_in:900},201) : answer(url,init);
  }});
  return {transport,calls,sessions:()=>calls.filter(item=>item.url.endsWith('/session')).length};
}
const code = async work => { try { await work(); } catch (error) { return error.code; } return null; };

describe('agent turns over the Demo gateway',()=> {
  it('posts function tools to the Responses endpoint and returns the output with usage',async()=> {
    const {transport,calls} = gateway();
    const turn = await transport.agentTurn('demo-fast',context(),new AbortController().signal);
    expect(turn.output).toEqual([call]); expect(turn.usage).toEqual({prompt_tokens:5,completion_tokens:6,total_tokens:11});
    const sent = calls.find(item=>item.url.endsWith('/demo/v1/responses')), body = JSON.parse(sent.init.body);
    expect(body.tools.map(tool=>tool.name)).toEqual(['get_context']); expect(body.include).toEqual(['reasoning.encrypted_content']); expect(JSON.stringify(body)).not.toContain('dmo_');
    expect(new Headers(sent.init.headers).get('authorization')).toBe('Bearer dmo_synthetic1');
  });

  it('starts a fresh session after the per-session request allowance, and not before',async()=> {
    const cap = DEMO_CONFIG.agent.sessionRequests, {transport,sessions} = gateway(), signal = new AbortController().signal;
    for (let i = 0; i < cap; i++) await transport.agentTurn('demo-fast',context(),signal);
    expect(sessions()).toBe(1);
    await transport.agentTurn('demo-fast',context(),signal); expect(sessions()).toBe(2);
  });

  it('names a gateway that has not enabled tools, by code or by wording, and keeps other 400s generic',async()=> {
    const signal = new AbortController().signal, turn = reply => gateway(()=>reply()).transport.agentTurn('demo-fast',context(),signal);
    expect(await code(()=>turn(()=>json({error:{code:'DEMO_AGENT_TOOLS_DISABLED',message:'disabled'}},400)))).toBe('DEMO_TOOLS_UNAVAILABLE');
    expect(await code(()=>turn(()=>json({error:'tools are not enabled for this project'},400)))).toBe('DEMO_TOOLS_UNAVAILABLE');
    expect(await code(()=>turn(()=>json({error:'bad request'},400)))).toBe('DEMO_REQUEST_FAILED');
  });

  it('rejects an unknown alias, an unfinished answer and a server-side tool call',async()=> {
    const signal = new AbortController().signal;
    expect(await code(()=>gateway().transport.agentTurn('private-model',context(),signal))).toBe('DEMO_MODEL_UNAVAILABLE');
    expect(await code(()=>gateway(()=>json({status:'incomplete',output:[]})).transport.agentTurn('demo-fast',context(),signal))).toBe('MALFORMED_PROPOSAL');
    expect(await code(()=>gateway(()=>completed([{type:'web_search_call',id:'w'}])).transport.agentTurn('demo-fast',context(),signal))).toBe('MALFORMED_PROPOSAL');
  });
});

describe('agent turns that carry reference images',()=> {
  const imageContext = () => ({systemPrompt:'S',messages:[{role:'user',content:[{type:'text',text:'Copy this'},{type:'image',data:'AAAA',mimeType:'image/png'}],timestamp:1}],tools});
  function imageGateway(multimodal) {
    const calls = [], transport = createDemoTransport({fetchImpl:async(url,init)=> {
      calls.push({url,init});
      if (url.endsWith('/session')) return json({token:'dmo_synthetic1',expires_in:900},201);
      if (url.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal}}]});
      return completed();
    }});
    return {transport,calls,sent:()=>calls.filter(item=>item.url.endsWith('/demo/v1/responses'))};
  }
  it('does not send images before the gateway has confirmed image support',async()=> {
    const {transport,sent} = imageGateway(false); await transport.discover();
    expect(await code(()=>transport.agentTurn('demo-fast',imageContext(),new AbortController().signal))).toBe('DEMO_IMAGE_CAPABILITY_UNVERIFIED'); expect(sent()).toHaveLength(0);
  });
  it('sends them once support is confirmed',async()=> {
    const {transport,sent} = imageGateway(true); await transport.discover();
    await transport.agentTurn('demo-fast',imageContext(),new AbortController().signal);
    expect(JSON.parse(sent()[0].init.body).input[1].content[1]).toEqual({type:'input_image',image_url:'data:image/png;base64,AAAA'});
    expect(JSON.parse(sent()[0].init.body).stream).toBe(false);
    await transport.agentTurn('demo-fast',context(),new AbortController().signal);
    expect(JSON.parse(sent()[1].init.body).stream).toBe(true);
  });
});

describe('progress while the model writes a tool call',()=> {
  it('counts the characters of the call arguments as they stream in',async()=> {
    const seen = [], progress = {addChars:count=>seen.push(count)};
    await readEventStream(new Response(frames([{type:'response.function_call_arguments.delta',delta:'{"summ'},{type:'response.function_call_arguments.delta',delta:'ary"'},{type:'response.completed',response:{status:'completed',output:[]}}])).body.getReader(),new AbortController().signal,progress);
    expect(seen).toEqual([6,4]);
  });
});

