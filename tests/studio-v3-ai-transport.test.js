import { describe,it,expect,vi } from 'vitest';
import { createDemoTransport } from '../studio-v3/ai-demo-transport.js';
import { errorMessage } from '../studio-v3/ai-messages.js';
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const models = {data:[{id:'demo-auto'},{id:'demo-fast'},{id:'private-model'}]};
const reply = {choices:[{finish_reason:'stop',message:{content:'{}'}}]};
describe('v3 Demo wire contract',()=> {
  it('uses existing registration, discovers aliases and sends no native tools/private credentials',async()=> {
    const calls = []; const transport = createDemoTransport({fetchImpl:async(url,init)=> {
      calls.push({url,init}); return url.endsWith('/session') ? json({token:'dmo_synthetic1234',expires_in:900},201) : url.endsWith('/models') ? json(models) : json(reply);
    }});
    expect(await transport.discover()).toEqual(['demo-auto','demo-fast']); await transport.plan('demo-fast','fictional layout');
    expect(JSON.parse(calls[0].init.body)).toEqual({project_id:'github-pages'}); expect(calls[0].init.headers.authorization).toBeUndefined();
    expect(calls[2].url).toBe('https://gpt.yapweijun1996.com/demo/v1/chat/completions');
    const payload = JSON.parse(calls[2].init.body); expect(Object.keys(payload).sort()).toEqual(['messages','model','stream']);
    expect(payload.model).toBe('demo-fast'); expect(JSON.stringify(payload)).not.toContain('dmo_');
    expect(new Headers(calls[2].init.headers).get('authorization')).toBe('Bearer dmo_synthetic1234');
    expect(new Headers(calls[0].init.headers).has('origin')).toBe(false);
  });
  it('refreshes once after 401 and proactively after expiry; clear releases memory state',async()=> {
    let now = 0,sessions = 0, requests = 0;
    const transport = createDemoTransport({now:()=>now,fetchImpl:async(url)=> {
      if (url.endsWith('/session')) return json({token:`dmo_synthetic${++sessions}`,expires_in:60});
      return ++requests === 1 ? json({},401) : json(models);
    }});
    await transport.discover(); expect(sessions).toBe(2);
    now = 31000; await transport.discover(); expect(sessions).toBe(3);
    transport.clear(); await transport.discover(); expect(sessions).toBe(4);
  });
  it('fails closed for unregistered origin and repeated unauthorized token',async()=> {
    const denied = createDemoTransport({fetchImpl:async()=>json({},403)});
    await expect(denied.discover()).rejects.toThrow('DEMO_SESSION_FORBIDDEN');
    let sessions = 0;
    const expired = createDemoTransport({fetchImpl:async url=>url.endsWith('/session') ? (sessions++,json({token:'dmo_synthetic123',expires_in:60})) : json({},401)});
    await expect(expired.discover()).rejects.toThrow('DEMO_SESSION_EXPIRED'); expect(sessions).toBe(2);
  });
  it('reports a rejected session during a 401 refresh without claiming the inference request was never sent',async()=> {
    let issued = 0,dispatched = 0;
    const transport = createDemoTransport({fetchImpl:async url=> {
      if (url.endsWith('/session')) return ++issued === 1 ? json({token:'dmo_synthetic123'}) : json({},403);
      dispatched++; return json({},401);
    }});
    await expect(transport.plan('demo-fast','fictional')).rejects.toThrow('DEMO_SESSION_FORBIDDEN');
    expect(dispatched).toBe(1);
  });
  it.each([429,500])('sanitizes HTTP %i error bodies',async status=> {
    const transport = createDemoTransport({fetchImpl:async url=>url.endsWith('/session') ? json({token:'dmo_synthetic123'}) : json({secret:'must never display'},status)});
    await expect(transport.discover()).rejects.toThrow(status===429?'DEMO_RATE_LIMIT':'DEMO_REQUEST_FAILED');
  });
  it('rejects absent aliases, native tool responses, truncation and oversized responses',async()=> {
    for (const bad of [{choices:[{finish_reason:'length',message:{content:'{}'}}]},{choices:[{finish_reason:'stop',message:{content:'{}',tool_calls:[]}}]},{padding:'x'.repeat(65000)}]) {
      const transport = createDemoTransport({fetchImpl:async url=>url.endsWith('/session') ? json({token:'dmo_synthetic123'}) : json(bad)});
      await expect(transport.plan('demo-fast','fake')).rejects.toThrow();
    }
    const missing = createDemoTransport({fetchImpl:async url=>url.endsWith('/session') ? json({token:'dmo_synthetic123'}) : json({data:[{id:'private'}]})});
    await expect(missing.discover()).rejects.toThrow('DEMO_MODEL_UNAVAILABLE');
  });
});

const media=[{type:'input_image',image_url:'data:image/jpeg;base64,/9j/AA=='}];
const visualModel=(id='demo-fast')=>({id,capabilities:{responses:true,multimodal:true}});
const visualReply={status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"kind":"answer","message":"Synthetic reference read"}'}]}],usage:{input_tokens:12,output_tokens:8,total_tokens:20}};
function visualTransport() {
 const calls=[],state={models:{data:[visualModel()]},status:200,reply:visualReply};
 const transport=createDemoTransport({fetchImpl:async(url,init)=>{
  calls.push({url,init});return url.endsWith('/session')?json({token:'dmo_synthetic123'}):url.endsWith('/models')?json(state.models,state.status):json(state.reply);
 }});
 return {transport,state,calls};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
describe('v3 reference media capability boundary',()=>{
 it('rejects unknown capability and other aliases before sending a reference',async()=>{
  const {transport,state,calls}=visualTransport();
  await expect(transport.plan('demo-fast','reference',undefined,media)).rejects.toThrow('DEMO_IMAGE_CAPABILITY_UNVERIFIED');expect(calls).toEqual([]);
  state.models={data:[...models.data,visualModel('private-model')]};await transport.discover();
  expect(transport.supportsImages('private-model')).toBe(false);
  await expect(transport.plan('private-model','reference',undefined,media)).rejects.toThrow('DEMO_MODEL_UNAVAILABLE');
  await expect(transport.plan('demo-fast','reference',undefined,media)).rejects.toThrow('DEMO_IMAGE_CAPABILITY_UNVERIFIED');expect(calls.some(c=>c.url.endsWith('/responses'))).toBe(false);
 });
 it.each(['demo-fast','demo-auto'])('uses verified inline images in bounded Responses requests for %s',async alias=>{
  const {transport,state,calls}=visualTransport();state.models={data:[visualModel(alias)]};
  expect(await transport.discover()).toEqual([alias]);expect(transport.supportsImages(alias)).toBe(true);
  const result=await transport.plan(alias,'reviewed fictional reference',undefined,media);expect(result.usage.total_tokens).toBe(20);
  const {url,init}=calls.at(-1),wire=JSON.parse(init.body);expect(url).toBe('https://gpt.yapweijun1996.com/demo/v1/responses');
  expect(Object.keys(wire).sort()).toEqual(['input','model','stream']);expect(wire.model).toBe(alias);expect(wire.stream).toBe(false);
  expect(wire.input[1].content).toEqual([{type:'input_text',text:'reviewed fictional reference'},...media]);expect(JSON.stringify(wire)).not.toContain('dmo_');
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer dmo_synthetic123');expect(Object.getOwnPropertySymbols(init)).toEqual([]);
  expect(transport.capabilityDiagnostics()).toEqual([{alias,facts:[{field:'capabilities.responses',value:true},{field:'capabilities.multimodal',value:true}]}]);
 });
 it('rejects external URLs, unsupported media and every existing request limit without dispatch',async()=>{
  const {transport,calls}=visualTransport();await transport.discover();const before=calls.length;
  const image=image_url=>({type:'input_image',image_url});
  for(const invalid of [
   [image('https://external.example/private.png')],[image('file:///private.png')],[image('data:image/svg+xml;base64,AAAA')],
   [{...media[0],detail:'high'}],[{type:'input_file',file_id:'private'}],Array(5).fill(media[0]),
   [image('data:image/png;base64,'+'A'.repeat(5592508))],Array(3).fill(image('data:image/png;base64,'+'A'.repeat(3*1024*1024)))
  ])await expect(transport.plan('demo-fast','bad',undefined,invalid)).rejects.toThrow('UNSAFE_PROPOSAL');
  await expect(transport.plan('demo-fast','界'.repeat(4*1024*1024),undefined,media)).rejects.toThrow('UNSAFE_PROPOSAL');
  expect(calls).toHaveLength(before);
 });
 it.each([
  {status:'incomplete',output:visualReply.output},
  {status:'completed',output:[{type:'function_call',name:'run_tool'}]},
  {status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{}'},{type:'refusal',refusal:'blocked'}]}]},
  {status:'completed',output:[]},
  {padding:'x'.repeat(65000)}
 ])('rejects incomplete, native-tool or oversized Responses output %#',async reply=>{
  const {transport,state}=visualTransport();state.reply=reply;await transport.discover();await expect(transport.plan('demo-fast','reference',undefined,media)).rejects.toThrow();
 });
});
describe('v3 capability revocation and session lifecycle',()=>{
 it.each([
  {data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]},
  {data:[{id:'demo-fast',capabilities:{responses:false,multimodal:true}}]},
  {data:[{id:'demo-fast'}]},
  {data:[{id:'demo-fast',input_modalities:['image']}]},
  {data:[visualModel(),{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]},
  {data:[visualModel('demo-auto')]}
 ])('closes a prior grant on removed, changed or contradictory metadata %#',async models=>{
  const {transport,state,calls}=visualTransport();await transport.discover();expect(transport.supportsImages('demo-fast')).toBe(true);
  state.models=models;await transport.discover();expect(transport.supportsImages('demo-fast')).toBe(false);
  await expect(transport.plan('demo-fast','reference',undefined,media)).rejects.toThrow('DEMO_IMAGE_CAPABILITY_UNVERIFIED');expect(calls.some(c=>c.url.endsWith('/responses'))).toBe(false);
 });
 it.each([[null,200],[{},200],[{data:[null,{id:'private-model'}]},200],[{},500],[{},429]])('closes a prior grant when discovery fails %#',async(models,status)=>{
  const {transport,state}=visualTransport();await transport.discover();state.models=models;state.status=status;
  const pending=transport.discover();expect(transport.supportsImages('demo-fast')).toBe(false);expect(transport.capabilityDiagnostics()).toEqual([]);
  await expect(pending).rejects.toThrow();expect(transport.supportsImages('demo-fast')).toBe(false);
 });
 it('clears permissions and public facts together, while session-only cleanup preserves discovery',async()=>{
  const {transport,calls}=visualTransport();await transport.discover();const facts=transport.capabilityDiagnostics();facts[0].facts[0].value=false;
  expect(transport.capabilityDiagnostics()[0].facts[0].value).toBe(true);transport.clearSession();expect(transport.supportsImages('demo-fast')).toBe(true);
  await transport.plan('demo-fast','reference',undefined,media);expect(calls.filter(c=>c.url.endsWith('/session'))).toHaveLength(2);
  transport.clear();expect(transport.supportsImages('demo-fast')).toBe(false);expect(transport.capabilityDiagnostics()).toEqual([]);
  await expect(transport.plan('demo-fast','reference',undefined,media)).rejects.toThrow('DEMO_IMAGE_CAPABILITY_UNVERIFIED');
 });
 it.each(['clear','abort'])('cannot restore permission from a late discovery after %s',async action=>{
  const held=deferred(),controller=new AbortController();let discovered=false;
  const transport=createDemoTransport({fetchImpl:async url=>url.endsWith('/session')?json({token:'dmo_synthetic123'}):(discovered=true,held.promise)});
  const pending=transport.discover(controller.signal),assertion=expect(pending).rejects.toThrow();await vi.waitFor(()=>expect(discovered).toBe(true));
  if(action==='clear')transport.clear();else controller.abort();held.resolve(json({data:[visualModel()]}));await assertion;
  expect(transport.supportsImages('demo-fast')).toBe(false);expect(transport.capabilityDiagnostics()).toEqual([]);
 });
 it('an older positive discovery cannot replace a newer revocation',async()=>{
  const held=deferred();let requests=0;
  const transport=createDemoTransport({fetchImpl:async url=>url.endsWith('/session')?json({token:'dmo_synthetic123'}):++requests===1?held.promise:json({data:[{id:'demo-fast'}]})});
  const old=transport.discover(),assertion=expect(old).rejects.toThrow('DEMO_MODEL_UNAVAILABLE');await vi.waitFor(()=>expect(requests).toBe(1));
  await transport.discover();held.resolve(json({data:[visualModel()]}));await assertion;expect(transport.supportsImages('demo-fast')).toBe(false);
  expect(transport.capabilityDiagnostics()).toEqual([{alias:'demo-fast',facts:[]}]);
 });
 it('rechecks image permission after awaiting a new session, before any Responses dispatch',async()=>{
  const held=deferred();let sessions=0,requests=0,inference=0;
  const transport=createDemoTransport({fetchImpl:async url=>{
   if(url.endsWith('/session'))return ++sessions===1?json({token:'dmo_synthetic123'}):held.promise;
   if(url.endsWith('/models'))return json({data:[++requests===1?visualModel():{id:'demo-fast'}]});
   inference++;return json(visualReply);
  }});
  await transport.discover();transport.clearSession();const pending=transport.plan('demo-fast','reference',undefined,media),assertion=expect(pending).rejects.toThrow('DEMO_IMAGE_CAPABILITY_UNVERIFIED');
  await vi.waitFor(()=>expect(sessions).toBe(2));const rediscovery=transport.discover();held.resolve(json({token:'dmo_synthetic456'}));await assertion;await rediscovery;
  expect(inference).toBe(0);expect(transport.supportsImages('demo-fast')).toBe(false);
 });
 it('blocks a revoked image retry after 401 without claiming the first dispatch never happened',async()=>{
  const held=deferred();let sessions=0,requests=0,inference=0;
  const transport=createDemoTransport({fetchImpl:async url=>{
   if(url.endsWith('/session'))return ++sessions===1?json({token:'dmo_synthetic123'}):held.promise;
   if(url.endsWith('/models'))return json({data:[++requests===1?visualModel():{id:'demo-fast'}]});
   inference++;return inference===1?json({},401):json(visualReply);
  }});
  await transport.discover();const pending=transport.plan('demo-fast','reference',undefined,media).catch(error=>error);
  await vi.waitFor(()=>expect(sessions).toBe(2));expect(inference).toBe(1);
  const rediscovery=transport.discover();held.resolve(json({token:'dmo_synthetic456'}));
  const error=await pending;await rediscovery;
  expect(error.code).toBe('DEMO_IMAGE_CAPABILITY_UNVERIFIED');expect(inference).toBe(1);expect(transport.supportsImages('demo-fast')).toBe(false);
  expect(errorMessage(error)).toContain('Image analysis is unavailable');expect(errorMessage(error).toLowerCase()).not.toContain('nothing was sent');
 });
});
