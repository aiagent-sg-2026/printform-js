import { describe,it,expect,vi } from 'vitest';
import { createDemoTransport } from '../studio-v3/ai-demo-transport.js';
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const media=[{type:'input_image',image_url:'data:image/jpeg;base64,/9j/AA=='}];
const visualModel=(id='demo-fast')=>({id,capabilities:{responses:true,multimodal:true}});
const visualReply={status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"kind":"answer","message":"Synthetic reference read"}'}]}],usage:{input_tokens:12,output_tokens:8,total_tokens:20}};
const deferred=()=>{let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});return {resolve,reject,promise};};
describe('v3 image request cancellation',()=>{
 const inflight=honorAbort=>{
  const held=deferred();let started=false;
  const transport=createDemoTransport({fetchImpl:async(url,init)=>{
   if(url.endsWith('/session'))return json({token:'dmo_synthetic123'});
   if(url.endsWith('/models'))return json({data:[visualModel()]});
   started=true;
   if(honorAbort)init.signal.addEventListener('abort',()=>held.reject(new DOMException('aborted','AbortError')));
   return held.promise;
  }});
  return {transport,held,started:()=>started};
 };
 it('rejects an image Responses request that is stopped while in flight',async()=>{
  const {transport,started}=inflight(true),controller=new AbortController();await transport.discover();
  const pending=transport.plan('demo-fast','reference',controller.signal,media),assertion=expect(pending).rejects.toMatchObject({name:'AbortError'});
  await vi.waitFor(()=>expect(started()).toBe(true));controller.abort();await assertion;
 });
 it('does not return a reply that arrives after Stop even when fetch ignores the signal',async()=>{
  const {transport,held,started}=inflight(false),controller=new AbortController();await transport.discover();
  const pending=transport.plan('demo-fast','reference',controller.signal,media),assertion=expect(pending).rejects.toThrow();
  await vi.waitFor(()=>expect(started()).toBe(true));controller.abort();held.resolve(json(visualReply));await assertion;
 });
});
