import {referenceError} from './reference-limits.js';

// Compatibility guard for pinned PDF.js 6.3.289: its display layer may resolve
// render before surfacing a failed operator-list stream. This is an owned-worker
// wire contract, not a general public PDF.js API; upgrades must rerun real PDF CI.
export function observePdfWorkerErrors(port) {
  let failure,reject;
  const promise=new Promise((_,fail)=>{reject=fail;});promise.catch(()=>{});
  const fail=code=>{if(!failure){failure=referenceError(code);reject(failure);}};
  const onError=()=>fail('PDF_WORKER');
  const onMessage=({data})=>{
    if(data?.stream!==5 || !data.reason || typeof data.reason!=='object')return;
    fail(typeof data.reason.message==='string' && /Image exceeded maximum allowed size/i.test(data.reason.message)?'PDF_IMAGE_LIMIT':'FILE_CORRUPT');
  };
  port.addEventListener('message',onMessage);port.addEventListener('error',onError);
  return {promise,check(){if(failure)throw failure;},dispose(){port.removeEventListener('message',onMessage);port.removeEventListener('error',onError);}};
}
