import {canonical,digest} from './studio-v3-g8-corpus.mjs';
const same=(a,b)=>canonical(a)===canonical(b);
function completed(body) {
  const result=[];
  const accept=value=> {
    const response=value?.type==='response.completed'?value.response:value;
    if (response?.status==='completed' && Array.isArray(response.output)) result.push(response);
  };
  try { accept(JSON.parse(body)); }
  catch {
    for (const line of body.split(/\r?\n/)) if (line.startsWith('data:')) {
      try { accept(JSON.parse(line.slice(5).trim())); } catch { /* SSE comments and [DONE] are not receipts. */ }
    }
  }
  return result;
}
function identities(actual,expected) {
  return ['release','contractHash','knowledgeHash','packageHash'].every(key=>actual?.[key]===expected[key]);
}
// Actual completed response calls + subsequent outgoing paired host results, never model prose.
export function checkAnswerReceipts(c,e,profile,errors) {
  if (!Array.isArray(e.providerResponses) || !e.providerResponses.length) { errors.push('missing actual provider response bytes for grounded answer'); return; }
  if (!Array.isArray(e.providerBodies)) { errors.push('missing actual provider request bodies for read receipts'); return; }
  const requests=[];
  for (const [index,p] of e.providerBodies.entries()) {
    try { requests.push({digest:p.digest,index,body:JSON.parse(p.body)}); }
    catch { errors.push('malformed actual provider request for read receipt'); }
  }
  const calls=[];
  for (const response of e.providerResponses) {
    const request=requests.find(item=>item.digest===response.requestDigest);
    if (!request || typeof response.body!=='string' || response.digest!==digest(response.body)) { errors.push('provider response bytes/request lineage mismatch'); continue; }
    for (const payload of completed(response.body)) for (const item of payload.output) if (item.type==='function_call') {
      let args;try {args=JSON.parse(item.arguments);}catch {errors.push('actual tool call arguments malformed');continue;}
      if (!item.call_id || !item.name || !args || typeof args!=='object' || Array.isArray(args)) { errors.push('actual tool call identity malformed'); continue; }
      const old=calls.find(call=>call.id===item.call_id);
      const call={id:item.call_id,name:item.name,args,requestIndex:request.index,order:calls.length};
      if (old && !same({...old,order:0},{...call,order:0})) errors.push('contradictory actual tool call replay');
      if (!old) calls.push(call);
    }
  }
  const reads=[];
  for (const name of c.oracle.requiredReads || []) {
    let found;
    for (const request of requests) {
      const input=request.body.input;
      if (!Array.isArray(input)) continue;
      for (const item of input.filter(item=>item.type==='function_call' && item.name===name)) {
        const origin=calls.find(call=>call.id===item.call_id && call.name===name && call.requestIndex<request.index && same(call.args,{}));
        const output=input.find(candidate=>candidate.type==='function_call_output' && candidate.call_id===item.call_id);
        if (!origin || !output || item.arguments!=='{}' || typeof output.output!=='string') continue;
        let value;try {value=JSON.parse(output.output);}catch {continue;}
        if (value?.error || value?.isError || value?.status==='error') continue;
        if (name==='get_capabilities' && (value?.version!==1 || !Array.isArray(value.tools) || !['get_context','finish_answer'].every(tool=>value.tools.some(t=>t.name===tool)) || !identities(value.identity,profile.releaseIdentity))) continue;
        if (name==='get_context') {
          const design=c.input.state.design,layout=value?.layout;
          if (value?.request!==c.input.prompt || !layout?.style || !same(layout.columns,design.columns.map(field=>({id:`items-${field.id}`,width:field.width})))) continue;
          if (!['font','padding','repeatTable','pageNumbers'].every(key=>layout.style[key]===design[key])) continue;
          if (!identities(value?.run?.identity,profile.releaseIdentity)) continue;
        }
        found={...origin,receiptRequestIndex:request.index};break;
      }
      if (found) break;
    }
    if (!found) errors.push(`missing successful actual paired ${name} current-state receipt`);
    else reads.push(found);
  }
  for (let i=1;i<reads.length;i++) if (reads[i].order<reads[i-1].order) errors.push('grounded read calls violate frozen read order');
  const finish=calls.find(call=>call.name===c.oracle.completion && typeof call.args.message==='string' && reads.every(read=>call.requestIndex>=read.receiptRequestIndex));
  if (!finish || !reads.length) errors.push('missing actual finish_answer completion after grounded reads');
  if (finish && finish.args.message!==e.answer) errors.push('host-delivered answer differs from actual finish_answer message');
  if (!e.events.some(event=>event.type==='ui-complete' && event.runId===e.runId)) errors.push('missing delivered grounded answer completion');
  if (finish) return {callId:finish.id,modelMessageDigest:digest(finish.args.message),deliveredMessageDigest:typeof e.answer==='string'?digest(e.answer):null};
}
