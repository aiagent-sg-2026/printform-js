import {describe,it,expect} from 'vitest';
import {evaluateEvidence} from '../scripts/studio-v3-g8-evaluator.mjs';
import {digest} from '../scripts/studio-v3-g8-corpus.mjs';
import {fixture,seal,profile,corpus} from './support/g8-evidence-fixture.js';

// Synthetic raw-wire specimens for the offline consumer, not recorded model attempts.
const evaluate=f=>evaluateEvidence(f.c,seal(f.evidence),profile,{corpus});
function request(f,index,mutate) {
  const p=f.evidence.providerBodies[index],old=p.digest,value=JSON.parse(p.body);mutate(value);
  p.body=JSON.stringify(value);p.digest=digest(p.body);
  for(const response of f.evidence.providerResponses || [])if(response.requestDigest===old)response.requestDigest=p.digest;
}
function response(f,index,mutate) {
  const r=f.evidence.providerResponses[index],value=JSON.parse(r.body);mutate(value);r.body=JSON.stringify(value);r.digest=digest(r.body);
}
describe('current-state question requires actual tool origins, paired successful reads and real completion',()=> {
  it('accepts completed calls, exact paired current facts and delivered finish_answer',()=> {
    expect(evaluate(fixture()).outcome).toBe('Pass');
  });
  it('cannot pass a correct guessed JSON answer with ui-complete but no actual response receipts',()=> {
    const f=fixture();delete f.evidence.providerResponses;
    expect(evaluate(f).errors).toContain('missing actual provider response bytes for grounded answer');
  });
  it.each(['get_capabilities','get_context'])('requires a genuine completed %s call as well as its outgoing host result',name=> {
    const f=fixture();response(f,0,r=>r.output=r.output.filter(call=>call.name!==name));
    expect(evaluate(f).errors).toContain(`missing successful actual paired ${name} current-state receipt`);
  });
  it('does not treat model speech about reading as a context receipt',()=> {
    const f=fixture();request(f,1,r=>r.input=r.input.filter(item=>item.type!=='function_call_output'));f.evidence.answer='{"fontPt":9}';
    f.evidence.events.push({type:'tool-result',tool:'get_context',output:'I read the current form; it is nine.'});
    expect(evaluate(f).outcome).toBe('Fail');
  });
  it.each([
    ['wrong current font',v=>v.layout.style.font=12],
    ['wrong column width',v=>v.layout.columns[0].width=99],
    ['foreign prompt',v=>v.request='A different read-only task'],
    ['foreign release',v=>v.run.identity={release:'other'}],
    ['tool error',v=>{v.error={code:'TOOL_FAILED'};}]
  ])('rejects %s despite a right answer and rehashed raw bytes',(_name,mutate)=> {
    const f=fixture();request(f,1,r=>{const item=r.input.find(item=>item.type==='function_call_output' && item.call_id==='unit-context');const value=JSON.parse(item.output);mutate(value);item.output=JSON.stringify(value);});
    expect(evaluate(f).errors).toContain('missing successful actual paired get_context current-state receipt');
  });
  it('rejects folded or unpaired context output instead of assuming earlier success',()=> {
    const f=fixture();request(f,1,r=>r.input.find(item=>item.type==='function_call_output' && item.call_id==='unit-context').output='[older result omitted to keep the request small]');
    expect(evaluate(f).outcome).toBe('Fail');
    const g=fixture();request(g,1,r=>r.input.find(item=>item.type==='function_call_output' && item.call_id==='unit-context').call_id='other-call');
    expect(evaluate(g).outcome).toBe('Fail');
  });
  it('requires actual finish_answer method and exact message, not merely correct UI JSON',()=> {
    const f=fixture();response(f,1,r=>r.output[0].name='finish');expect(evaluate(f).outcome).toBe('Fail');
    const g=fixture();response(g,1,r=>r.output[0].arguments='{"message":"I think it is nine"}');expect(evaluate(g).outcome).toBe('Fail');
  });
  it('does not accept an incomplete finish or response bytes relabelled to another request',()=> {
    const f=fixture();response(f,1,r=>r.status='incomplete');expect(evaluate(f).outcome).toBe('Fail');
    const g=fixture();g.evidence.providerResponses[1].requestDigest=digest('not-an-actual-request');expect(evaluate(g).outcome).toBe('Fail');
  });
  it('parses actual completed SSE envelopes without accepting model event prose',()=> {
    const f=fixture();for(const r of f.evidence.providerResponses){const payload=JSON.parse(r.body);r.body=`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response:payload})}\n\n`;r.digest=digest(r.body);}
    expect(evaluate(f).outcome).toBe('Pass');
  });
  it('attributes host answer replacement without rewriting the actual model completion payload',()=> {
    const f=fixture(),modelMessage=f.evidence.answer;f.evidence.answer='Current rendered font sizes: host-generated text rather than requested JSON.';
    const result=evaluate(f);
    expect(result.outcome).toBe('Fail');
    expect(result.errors).toContain('host-delivered answer differs from actual finish_answer message');
    expect(result.errors).toContain('delivered answer is not requested JSON');
    expect(result.answerAttribution).toEqual({callId:'unit-finish',modelMessageDigest:digest(modelMessage),deliveredMessageDigest:digest(f.evidence.answer)});
  });
  it('rejects modified response bytes unless their real digest matches',()=> {
    const f=fixture();f.evidence.providerResponses[0].body+=' changed';expect(evaluate(f).outcome).toBe('Fail');
  });
});
