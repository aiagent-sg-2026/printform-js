import {it,expect,vi} from 'vitest';
import {observePdfWorkerErrors} from '../studio-v3/reference-pdf-errors.js';
const send=(port,data)=>port.dispatchEvent(new MessageEvent('message',{data}));
it('ignores normal completion/cancellation and malformed envelopes',()=>{
 const port=new EventTarget(),guard=observePdfWorkerErrors(port);
 for(const data of [{stream:2,reason:{message:'cancelled'}},{stream:3},{stream:5,reason:null},{stream:5,reason:'unknown'}])send(port,data);
 expect(()=>guard.check()).not.toThrow();guard.dispose();
});
it('latches the first fixed error without exposing worker message content',async()=>{
 const port=new EventTarget(),guard=observePdfWorkerErrors(port);send(port,{stream:5,reason:{message:'malformed private reference bytes'}});send(port,{stream:5,reason:{message:'Image exceeded maximum allowed size'}});
 await expect(guard.promise).rejects.toMatchObject({code:'FILE_CORRUPT'});expect(()=>guard.check()).toThrow('The reference is damaged');expect(()=>guard.check()).not.toThrow('private');guard.dispose();
});
it('catches native worker failures and removes both listeners on disposal',async()=>{
 const port=new EventTarget(),removed=vi.spyOn(port,'removeEventListener'),guard=observePdfWorkerErrors(port);port.dispatchEvent(new Event('error'));await expect(guard.promise).rejects.toMatchObject({code:'PDF_WORKER'});guard.dispose();expect(removed).toHaveBeenCalledTimes(2);
});
it('does not accept late error events after successful disposal',()=>{
 const port=new EventTarget(),guard=observePdfWorkerErrors(port);guard.dispose();send(port,{stream:5,reason:{message:'failure'}});expect(()=>guard.check()).not.toThrow();
});
