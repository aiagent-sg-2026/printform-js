import { describe, expect, it } from 'vitest';
import { createModels, fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { runAgentLoop } from '../studio-v3/agent-loop.js';
import { newProject } from '../studio-v3/model.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { createAgentTools } from '../studio-v3/agent-tools.js';
import { blockedError, publicBlockedReason } from '../studio-v3/agent-blocked.js';
import { AI_MESSAGES, errorMessage } from '../studio-v3/ai-messages.js';

const reason = 'PUBLIC_BLOCKER_FIXTURE: the assistant reports it could not produce a current proposal.';
const call = (name,args) => fauxAssistantMessage([fauxToolCall(name,args,{id:crypto.randomUUID()})],{stopReason:'toolUse'});
async function run(mode) {
  const provider = fauxProvider({provider:`blocked-consumer-${mode}`,models:[{id:'blocked-consumer'}]});
  provider.setResponses([call('report_blocked',{reason}),async()=> {
    await new Promise(resolve=>setTimeout(resolve,2000)); return fauxAssistantMessage('No proposal delivered.');
  }]);
  const models = createModels(); models.setProvider(provider.provider);
  const controller = new AbortController(), project = newProject(), before = structuredClone(project), steps = [];
  let error;
  try {
    await runAgentLoop({models,model:provider.getModel(),project,request:'Create a private draft; wait for human Apply.',context:()=> '{}',
      signal:controller.signal,verifyRelease:async()=>({release:'blocked-consumer'}),limits:{maxTurns:20,maxRepeatedFailures:5,maxRunMs:1000},
      onStep:step=> {
        steps.push(step);
        if (step.name==='report_blocked' && step.ok && mode==='terminal-delivery-error-then-deadline') throw Object.assign(new Error('Fixture terminal delivery interrupted'),{code:'TOOL_FAILED'});
        if (step.name==='report_blocked' && step.ok && mode==='user-cancel') controller.abort();
      }});
  } catch (value) { error=value; }
  return {error,steps,calls:provider.state.callCount,project,before};
}

describe('actual Pi blocked completion preserves the public reason across both exit paths',()=> {
  it.each(['normal','terminal-delivery-error-then-deadline'])('keeps the validated report through %s without inventing capability evidence',async mode=> {
    const result = await run(mode);
    expect(result.error).toMatchObject({code:'AGENT_BLOCKED',reason});
    expect(result.steps).toEqual(expect.arrayContaining([expect.objectContaining({name:'report_blocked',ok:true})]));
    if (mode==='terminal-delivery-error-then-deadline') {
      expect(result.calls).toBe(2); expect(result.steps).toEqual(expect.arrayContaining([expect.objectContaining({name:'report_blocked',ok:false})]));
    } else expect(result.calls).toBe(1);
    const shown = errorMessage(result.error);
    expect(shown).toContain(`Assistant-reported blocker: ${reason}`);
    expect(shown).toContain('not a host-verified capability limit'); expect(result.project).toEqual(result.before);
  });
  it('does not replace a real user cancellation with a model-reported blocker',async()=> {
    const result = await run('user-cancel');
    expect(result.error.name).toBe('AbortError'); expect(errorMessage(result.error)).not.toContain(reason);
    expect(result.project).toEqual(result.before);
  });
});

describe('bounded blocker presentation is not a generic exception/log disclosure channel',()=> {
  it.each([' ', '  Public report\nNo current proposal.  ', 'x'.repeat(500)])('retains a permitted reason exactly, without trimming or truncation',value=> {
    const error = blockedError({code:'AGENT_BLOCKED',reason:value});
    expect(error.reason).toBe(value); expect(publicBlockedReason(error)).toBe(value);
    expect(errorMessage(error)).toContain(`Assistant-reported blocker: ${value}`);
  });
  it.each([undefined,null,'',501,false,{},[],new String('PRIVATE_WRAPPER'), 'PRIVATE_OVERSIZED_REASON_'+ 'x'.repeat(501)].map(value=>[value]))('drops an invalid reason instead of leaking or truncating it: %j',value=> {
    const error = blockedError({code:'AGENT_BLOCKED',reason:value});
    expect(error).not.toHaveProperty('reason'); expect(publicBlockedReason({code:'AGENT_BLOCKED',reason:value})).toBeNull();
    expect(errorMessage({name:'Error',code:'AGENT_BLOCKED',reason:value})).toBe(AI_MESSAGES.AGENT_BLOCKED);
  });
  it.each(['AGENT_TIMEOUT','AGENT_BUDGET','WORKSPACE_UNAVAILABLE','UNKNOWN_ERROR'])('never presents reason for another code: %s',code=> {
    const secret = 'PRIVATE_RUNTIME_REASON_439', error = Object.assign(new Error(secret),{code,reason:secret,stdout:secret,stderr:secret,cause:{reason:secret}});
    expect(blockedError(error)).not.toHaveProperty('reason'); expect(publicBlockedReason(error)).toBeNull(); expect(errorMessage(error)).not.toContain(secret);
  });
  it('ignores cause, runtime output and exception messages even beside a legitimate public blocker',()=> {
    const secret = 'PRIVATE_SOURCE_LOG_932', source = {code:'AGENT_BLOCKED',reason,message:secret,stdout:secret,stderr:secret,cause:{reason:secret}};
    const error = blockedError(source), shown = errorMessage({...source,name:'Error'});
    expect(error).toMatchObject({code:'AGENT_BLOCKED',reason}); expect(error).not.toHaveProperty('stdout'); expect(error).not.toHaveProperty('cause');
    expect(shown).toContain(reason); expect(shown).not.toContain(secret);
    expect(errorMessage({name:'AbortError',code:'AGENT_BLOCKED',reason})).not.toContain(reason);
  });
  it.each(['', 'PRIVATE_OVERSIZED_INPUT_'+ 'x'.repeat(501), 7, null, {}, []].map(value=>[value]))('rejects invalid public report arguments at the real tool schema boundary: %j',value=> {
    const outcome = {}, tools = createAgentTools({draft:createDraft(newProject()),outcome,context:()=> '{}',signal:new AbortController().signal,
      limits:{maxTurns:20,maxRepeatedFailures:5}}), tool = tools.find(entry=>entry.name==='report_blocked');
    expect(()=>tool.prepareArguments({reason:value})).toThrow(expect.objectContaining({code:'AGENT_ARGUMENTS_INVALID'}));
    expect(outcome.blocked).toBeUndefined(); expect(outcome.proposal).toBeUndefined();
  });
});
