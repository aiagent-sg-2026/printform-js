import { describe,it,expect,vi,beforeEach,afterEach } from 'vitest';
import { createDemoTransport } from '../studio-v3/ai-demo-transport.js';
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const models = {data:[{id:'demo-auto'},{id:'demo-fast'},{id:'private-model'}]};
const textReply = text => ({status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}],usage:{input_tokens:3,output_tokens:4,total_tokens:7}});
const reply = textReply('{}');
const media=[{type:'input_image',image_url:'data:image/jpeg;base64,/9j/AA=='}];
describe('v3 dynamic model aliases',()=> {
  const gateway=(modelList,calls=[])=>createDemoTransport({fetchImpl:async(url,init)=> { calls.push({url,init});
    return url.endsWith('/session') ? json({token:'dmo_synthetic1234',expires_in:900},201) : url.endsWith('/models') ? json({data:modelList}) : json(reply); }});
  it('returns the gateway aliases in order, without relying on demo-fast',async()=> {
    const transport=gateway(['demo-auto','demo-openai-mini','demo-groq','demo-gemini'].map(id=>({id})));
    expect(await transport.discover()).toEqual(['demo-auto','demo-openai-mini','demo-groq','demo-gemini']);
    expect(await gateway([{id:'demo-auto'}]).discover()).toEqual(['demo-auto']);
  });
  it('drops ids that are not safe demo aliases and duplicates',async()=> {
    const bad=['private-model','Demo-auto','demo-auto"}','demo-','gpt-5.4-mini',null,42,{},'demo-'+'a'.repeat(41)].map(id=>({id}));
    expect(await gateway([...bad,{id:'demo-groq'},{id:'demo-groq'},{id:'demo-auto'}]).discover()).toEqual(['demo-groq','demo-auto']);
    await expect(gateway(bad).discover()).rejects.toMatchObject({code:'DEMO_MODEL_UNAVAILABLE'});
  });
  it('caps the list and only keeps capability facts for kept aliases',async()=> {
    const many=Array.from({length:12},(_,i)=>({id:`demo-m${i}`,capabilities:{responses:true,multimodal:true}}));
    const transport=gateway(many);const aliases=await transport.discover();
    expect(aliases).toHaveLength(8);expect(aliases.at(-1)).toBe('demo-m7');
    expect(transport.capabilityDiagnostics().map(d=>d.alias)).toEqual(aliases);
    expect(transport.supportsImages('demo-m7')).toBe(true);expect(transport.supportsImages('demo-m8')).toBe(false);
  });
  it('judges image support per alias',async()=> {
    const transport=gateway([{id:'demo-gemini',capabilities:{responses:true,multimodal:true}},{id:'demo-groq',capabilities:{responses:true,multimodal:false}},{id:'demo-auto'}]);
    await transport.discover();
    expect(transport.supportsImages('demo-gemini')).toBe(true);expect(transport.supportsImages('demo-groq')).toBe(false);expect(transport.supportsImages('demo-auto')).toBe(false);
  });
  it('plans with any safe alias and puts exactly that alias in the model field',async()=> {
    const calls=[];const transport=gateway([{id:'demo-groq'}],calls);await transport.discover();await transport.plan('demo-groq','hello');
    expect(JSON.parse(calls.find(c=>c.url.endsWith('/responses')).init.body).model).toBe('demo-groq');
  });
  it('refuses an unsafe alias before any request',async()=> {
    const calls=[];const transport=gateway([{id:'demo-groq'}],calls);
    for(const alias of ['private-model','demo-groq"}','Demo-groq','','demo-',undefined])await expect(transport.plan(alias,'x')).rejects.toMatchObject({code:'DEMO_MODEL_UNAVAILABLE'});
    expect(calls).toHaveLength(0);
  });
});
describe('v3 per-request timeouts',()=> {
  beforeEach(()=> vi.useFakeTimers());
  afterEach(()=> vi.useRealTimers());
  const hang=(url,init)=> new Promise((_,reject)=> init.signal.addEventListener('abort',()=>reject(init.signal.reason ?? new DOMException('aborted','AbortError'))));
  const session=()=>json({token:'dmo_synthetic1234',expires_in:900},201);
  const gateway=(onApi,calls=[])=>createDemoTransport({fetchImpl:async(url,init)=> { calls.push(url);
    if(url.endsWith('/session'))return onApi.session ? onApi.session(url,init) : session();
    return url.endsWith('/models') ? (onApi.models ? onApi.models(url,init) : json(models)) : onApi.api(url,init); }});
  const settle=async promise=> { let state='pending',value;promise.then(v=> { state='resolved';value=v; },e=> { state='rejected';value=e; });await vi.advanceTimersByTimeAsync(0);return ()=>({state,value}); };
  it('fails a stalled model request exactly at its cap and does not retry',async()=> {
    const calls=[];const transport=gateway({api:hang},calls);
    const outcome=await settle(transport.plan('demo-auto','x'));
    await vi.advanceTimersByTimeAsync(59_999);expect(outcome().state).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome().state).toBe('rejected');expect(outcome().value.code).toBe('AI_TIMEOUT');
    await vi.advanceTimersByTimeAsync(300_000);
    expect(calls.filter(u=>u.endsWith('/responses'))).toHaveLength(1);expect(calls.filter(u=>u.endsWith('/session'))).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('caps model discovery separately and sooner',async()=> {
    const transport=gateway({models:hang});
    const outcome=await settle(transport.discover());
    await vi.advanceTimersByTimeAsync(14_999);expect(outcome().state).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);expect(outcome().value.code).toBe('AI_TIMEOUT');
  });
  it('lets a slow answer succeed right up to the cap and leaves no timer behind',async()=> {
    const transport=gateway({api:()=>new Promise(resolve=>setTimeout(()=>resolve(json(reply)),59_000))});
    const outcome=await settle(transport.plan('demo-auto','x'));
    await vi.advanceTimersByTimeAsync(59_000);
    expect(outcome().state).toBe('resolved');expect(outcome().value.text).toBe('{}');expect(vi.getTimerCount()).toBe(0);
  });
  it('counts session acquisition inside the same cap',async()=> {
    const calls=[];const transport=gateway({session:hang,api:()=>json(reply)},calls);
    const outcome=await settle(transport.plan('demo-auto','x'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(outcome().value.code).toBe('AI_TIMEOUT');expect(calls.some(u=>u.endsWith('/responses'))).toBe(false);
  });
  it('times out a response whose body never finishes',async()=> {
    const stalled=()=>new Response(new ReadableStream({start(controller) { controller.enqueue(new TextEncoder().encode('{"output":')); }}),{status:200});
    const transport=gateway({api:stalled});
    const outcome=await settle(transport.plan('demo-auto','x'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(outcome().state).toBe('rejected');expect(outcome().value.code).toBe('AI_TIMEOUT');
  });
  it('keeps the user\'s Stop a cancellation, not a timeout, and frees the timer',async()=> {
    const calls=[];const transport=gateway({api:hang},calls),stop=new AbortController();
    const outcome=await settle(transport.plan('demo-auto','x',stop.signal));
    await vi.advanceTimersByTimeAsync(10_000);stop.abort();await vi.advanceTimersByTimeAsync(0);
    expect(outcome().state).toBe('rejected');expect(outcome().value.name).toBe('AbortError');expect(outcome().value.code).not.toBe('AI_TIMEOUT');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(calls.filter(u=>u.endsWith('/responses'))).toHaveLength(1);expect(vi.getTimerCount()).toBe(0);
  });
  it('still names a network failure as unreachable, not as a timeout',async()=> {
    const transport=gateway({api:async()=> { throw new TypeError('Failed to fetch'); }});
    const outcome=await settle(transport.plan('demo-auto','x'));expect(outcome().value.code).toBe('DEMO_NETWORK_UNREACHABLE');
  });
});
describe('v3 streamed text requests',()=> {
  beforeEach(()=> vi.useFakeTimers());
  afterEach(()=> vi.useRealTimers());
  const encoder=new TextEncoder();
  const frame=(name,data)=>`event: ${name}\ndata: ${JSON.stringify({type:name,...data})}\n\n`;
  const completedFrame=(text,extra=[])=>frame('response.completed',{response:{status:'completed',output:[...extra,{type:'message',content:[{type:'output_text',text}]}],usage:{input_tokens:5,output_tokens:6,total_tokens:11}}});
  const eventStream=()=> { let controller;const stream=new ReadableStream({start(c) { controller=c; }});
    return {response:()=>new Response(stream,{status:200,headers:{'content-type':'text/event-stream'}}),send:text=>controller.enqueue(encoder.encode(text)),end:()=>controller.close()}; };
  const gateway=(onApi,calls=[])=>createDemoTransport({fetchImpl:async(url,init)=> { calls.push({url,init});
    if(url.endsWith('/session'))return json({token:'dmo_synthetic1234',expires_in:900},201);
    return url.endsWith('/models') ? json({data:[{id:'demo-auto',capabilities:{responses:true,multimodal:true}}]}) : onApi(url,init); }});
  const settle=async promise=> { let state='pending',value;promise.then(v=> { state='resolved';value=v; },e=> { state='rejected';value=e; });await vi.advanceTimersByTimeAsync(0);return ()=>({state,value}); };
  it('asks for a stream for text and not for images',async()=> {
    const calls=[];const transport=gateway(()=>json(reply),calls);await transport.discover();
    await transport.plan('demo-auto','text only');await transport.plan('demo-auto','with image',undefined,media);
    const bodies=calls.filter(c=>c.url.endsWith('/responses')).map(c=>JSON.parse(c.init.body));
    expect(bodies.map(b=>b.stream)).toEqual([true,false]);expect(bodies[1].input[1].content.some(part=>part.type==='input_image')).toBe(true);
  });
  it('returns the same text and usage from a stream as from a plain body',async()=> {
    const live=eventStream();const transport=gateway(()=>live.response());
    const outcome=await settle(transport.plan('demo-auto','x'));
    live.send(frame('response.created',{response:{status:'in_progress'}})+frame('response.output_text.delta',{delta:'{"kind"'})+frame('response.output_text.delta',{delta:':"answer"}'})+completedFrame('{"kind":"answer"}',[{type:'reasoning',content:[],encrypted_content:'ENCRYPTED',summary:[]}]));live.end();
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome().state).toBe('resolved');expect(outcome().value).toEqual({text:'{"kind":"answer"}',usage:{prompt_tokens:5,completion_tokens:6,total_tokens:11}});expect(vi.getTimerCount()).toBe(0);
  });
  it('falls back to a plain body when the gateway answers a stream request with JSON',async()=> {
    const transport=gateway(()=>json(textReply('{"kind":"answer"}')));await transport.discover();
    expect((await transport.plan('demo-auto','x')).text).toBe('{"kind":"answer"}');
  });
  it('reports waiting, then received characters, and never goes back',async()=> {
    const live=eventStream(),seen=[];const transport=gateway(()=>live.response());
    const outcome=await settle(transport.plan('demo-auto','x',undefined,[],{onProgress:p=>seen.push(p)}));
    await vi.advanceTimersByTimeAsync(3_000);
    live.send(frame('response.output_text.delta',{delta:'a'.repeat(120)}));await vi.advanceTimersByTimeAsync(600);
    live.send(frame('response.output_text.delta',{delta:'b'.repeat(80)})+completedFrame('x'));live.end();await vi.advanceTimersByTimeAsync(600);
    expect(outcome().state).toBe('resolved');
    expect(seen[0]).toEqual({chars:0,elapsedMs:0});expect(seen.some(p=>p.chars===0&&p.elapsedMs>=2_500)).toBe(true);expect(seen.some(p=>p.chars===120)).toBe(true);expect(seen.at(-1).chars).toBeGreaterThanOrEqual(120);expect(seen.at(-1).chars).toBeLessThanOrEqual(200);
    for(let i=1;i<seen.length;i++)expect(seen[i].chars).toBeGreaterThanOrEqual(seen[i-1].chars);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('times out a stream that stalls midway and does not retry',async()=> {
    const calls=[],live=eventStream();const transport=gateway(()=>live.response(),calls);
    const outcome=await settle(transport.plan('demo-auto','x'));
    live.send(frame('response.output_text.delta',{delta:'partial'}));await vi.advanceTimersByTimeAsync(59_999);expect(outcome().state).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome().value.code).toBe('AI_TIMEOUT');await vi.advanceTimersByTimeAsync(300_000);
    expect(calls.filter(c=>c.url.endsWith('/responses'))).toHaveLength(1);expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps Stop during a stream a cancellation',async()=> {
    const live=eventStream(),stop=new AbortController();const transport=gateway(()=>live.response());
    const outcome=await settle(transport.plan('demo-auto','x',stop.signal));
    live.send(frame('response.output_text.delta',{delta:'partial'}));await vi.advanceTimersByTimeAsync(5_000);stop.abort();await vi.advanceTimersByTimeAsync(0);
    expect(outcome().state).toBe('rejected');expect(outcome().value.name).toBe('AbortError');expect(outcome().value.code).not.toBe('AI_TIMEOUT');expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects a streamed tool call and a stream cut off before completion',async()=> {
    const toolCall=eventStream(),transport=gateway(()=>toolCall.response());
    const first=await settle(transport.plan('demo-auto','x'));
    toolCall.send(completedFrame('{}',[{type:'function_call',name:'run'}]));toolCall.end();await vi.advanceTimersByTimeAsync(0);
    expect(first().value.code).toBe('MALFORMED_PROPOSAL');
    const cut=eventStream(),second=await settle(gateway(()=>cut.response()).plan('demo-auto','x'));
    cut.send(frame('response.output_text.delta',{delta:'{'}));cut.end();await vi.advanceTimersByTimeAsync(0);
    expect(second().value.code).toBe('MALFORMED_PROPOSAL');
  });
});
