import { describe, expect, it } from 'vitest';
import { createModels, fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { createGrant, grantedDefinitions } from '../studio-v3/agent-effects.js';
import { AGENT_TOOL_DEFINITIONS } from '../studio-v3/agent-registry.js';
import { createAgentTools } from '../studio-v3/agent-tools.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { requestIntent } from '../studio-v3/ai-request-intent.js';
import { runAgentLoop } from '../studio-v3/agent-loop.js';
import { newProject } from '../studio-v3/model.js';
import { authorizeSourceWorkspace, isSourceAuthorization } from '../studio-v3/source-workspace-run.js';

const request = 'Create a private draft with custom paper; preview now and wait for human Apply.';
const intent = requestIntent(request);
const names = grant => grantedDefinitions(grant,AGENT_TOOL_DEFINITIONS).map(tool=>tool.name);
const call = (name,args={}) => fauxAssistantMessage([fauxToolCall(name,args,{id:crypto.randomUUID()})],{stopReason:'toolUse'});
const decoded = message => JSON.parse(message.content[0].text);
function toolBoundary(grant) {
  const project = newProject(), before = structuredClone(project), draft = createDraft(project,{request}), outcome = {};
  const tools = Object.fromEntries(createAgentTools({grant,intent,draft,outcome,context:()=> '{}',signal:new AbortController().signal,
    limits:{maxTurns:100,maxRepeatedFailures:5}}).map(tool=>[tool.name,tool]));
  return {project,before,draft,outcome,tools};
}
function sourceRun(responses,{readOnly=false,request:sourceRequest=request}={}) {
  const sourceHash = 'a'.repeat(64), project = newProject(), before = structuredClone(project);
  let closed = false, opens = 0;
  // The real authorization factory and receipt checks are used; there is no forged workspace/profile or mocked authority predicate.
  const connection = {runnerSourceHash:sourceHash,get available(){return !closed;},
    create:async()=> { opens++; return {id:'draft-grant-source',revision:0,treeDigest:'b'.repeat(64),imageDigest:'sha256:'+'c'.repeat(64)}; },
    close:async()=> {closed=true;}};
  const workspace = authorizeSourceWorkspace(connection,{fictionalSource:true,readOnly});
  const provider = fauxProvider({provider:'draft-grant-source',models:[{id:'draft-grant-source'}]}); provider.setResponses(responses);
  const models = createModels(); models.setProvider(provider.provider);
  const promise = runAgentLoop({models,model:provider.getModel(),project,request:sourceRequest,profile:workspace.profile,workspace,
    context:()=> '{}',signal:new AbortController().signal,verifyRelease:async()=>({release:'source-consumer',sourceRunnerHash:sourceHash}),
    limits:{maxTurns:100,maxRepeatedFailures:5,maxRunMs:60000}});
  return {promise,project,before,workspace,get closed(){return closed;},get opens(){return opens;}};
}

describe('confirmed private draft subtracts answer without adding authority',()=> {
  it('keeps the design profile/scope, removes only answer and freezes the resulting grant',()=> {
    const scope = {mode:'selected',ids:['footer-notes']}, original = createGrant('design',{scope});
    const grant = createGrant('design',{scope,intent});
    expect(grant.profile).toBe('design'); expect(grant.scope).toEqual(scope);
    expect(grant.effects).toEqual(original.effects.filter(effect=>effect!=='answer'));
    expect(names(grant)).not.toContain('finish_answer'); expect(names(grant)).toEqual(expect.arrayContaining(['finish','report_blocked','apply_operations','inspect_draft']));
    expect(Object.isFrozen(grant)).toBe(true); expect(Object.isFrozen(grant.effects)).toBe(true);
    expect(original.effects).toContain('answer');
  });
  it('rejects a hidden finish_answer at both prepareArguments and direct execute boundaries',async()=> {
    const state = toolBoundary(createGrant('design',{intent})), args = {message:'I claim the draft is ready.',observationId:null};
    const catalog = decoded(await state.tools.get_capabilities.execute('catalog',{}));
    expect(catalog.tools.map(tool=>tool.name)).not.toContain('finish_answer');
    expect(()=>state.tools.finish_answer.prepareArguments(args)).toThrow(expect.objectContaining({code:'GRANT_DENIED'}));
    await expect(state.tools.finish_answer.execute('forged',args)).rejects.toMatchObject({code:'GRANT_DENIED'});
    expect(state.outcome.answer).toBeUndefined(); expect(state.outcome.proposal).toBeUndefined(); expect(state.draft.count).toBe(0);
    expect(state.project).toEqual(state.before);
  });
  it.each(['How can I change the paper size?','Read-only: create a private draft.','"Create a private draft."','The title might look better.'])('does not remove answer or widen the read-only ceiling: %s',text=> {
    const result = requestIntent(text), grant = createGrant('read-only',{intent:result});
    expect(names(grant)).toContain('finish_answer'); expect(names(grant)).not.toContain('finish'); expect(names(grant)).not.toContain('apply_operations');
  });
  it('cannot use a draft intent to widen an explicitly read-only host grant',()=> {
    const grant = createGrant('read-only',{intent});
    expect(grant.effects).toEqual(createGrant('read-only').effects); expect(names(grant)).toContain('finish_answer');
  });
  it('also narrows the default host-created tool grant when an explicit draft intent is supplied',async()=> {
    const draft = createDraft(newProject()), outcome = {}, tools = createAgentTools({draft,outcome,intent,context:()=> '{}',signal:new AbortController().signal,
      limits:{maxTurns:100,maxRepeatedFailures:5}});
    await expect(tools.find(tool=>tool.name==='finish_answer').execute('forged',{message:'Done.'})).rejects.toMatchObject({code:'GRANT_DENIED'});
    expect(outcome.answer).toBeUndefined();
  });
});

describe('source authority remains the existing coding profile and real host lease',()=> {
  it('does not admit a profile-shaped object or an absent source authorization',()=> {
    for (const workspace of [undefined,{profile:'coding',active:true}]) {
      expect(()=>createGrant('coding',{workspace,intent})).toThrow(expect.objectContaining({code:'WORKSPACE_DISCLOSURE_REQUIRED'}));
    }
  });
  it('retains coding authority identity, denies the hallucinated answer, and still requires a genuine source artifact for finish',async()=> {
    let catalog, answerDenied, sourceDenied;
    const run = sourceRun([call('get_capabilities'),context=> {
      catalog=decoded(context.messages.at(-1)); return call('finish_answer',{message:'The source draft is done.'});
    },context=> {
      answerDenied=context.messages.at(-1); return call('finish',{summary:'Missing source artifact'});
    },context=> {
      sourceDenied=context.messages.at(-1); return call('report_blocked',{reason:'No current imported source artifact exists.'});
    }]);
    expect(isSourceAuthorization(run.workspace)).toBe(true);
    await expect(run.promise).rejects.toMatchObject({code:'AGENT_BLOCKED',reason:'No current imported source artifact exists.'});
    expect(catalog.run.profile).toBe('coding'); expect(catalog.tools.map(tool=>tool.name)).not.toContain('finish_answer');
    expect(catalog.tools.map(tool=>tool.name)).toEqual(expect.arrayContaining(['workspace_write','workspace_run','import_artifact','finish','report_blocked']));
    expect(answerDenied).toMatchObject({isError:true,toolName:'finish_answer'}); expect(answerDenied.content[0].text).toMatch(/unavailable/);
    expect(sourceDenied).toMatchObject({isError:true,toolName:'finish'}); expect(sourceDenied.content[0].text).toMatch(/^SOURCE_ARTIFACT_REQUIRED/);
    expect(run.opens).toBe(1); expect(run.closed).toBe(true); expect(isSourceAuthorization(run.workspace)).toBe(false); expect(run.project).toEqual(run.before);
  });
  it('preserves a coding-read-only question and exact answer without creating a writable source profile',async()=> {
    let catalog;
    const message = '{"sourceReadOnly":true}', run = sourceRun([call('get_capabilities'),context=> {
      catalog=decoded(context.messages.at(-1)); return call('get_context');
    },call('finish_answer',{message})],{readOnly:true,request:'Explain the supported source profile without changing anything.'});
    expect(await run.promise).toMatchObject({kind:'answer',taskOutcome:'answered',message});
    expect(catalog.run.profile).toBe('coding-read-only'); expect(catalog.tools.map(tool=>tool.name)).toContain('finish_answer');
    for (const name of ['finish','apply_operations','workspace_write','workspace_run','import_artifact']) expect(catalog.tools.map(tool=>tool.name)).not.toContain(name);
    expect(run.closed).toBe(true); expect(run.project).toEqual(run.before);
  });
  it('does not widen a coding-read-only lease even when the user explicitly requests a draft',async()=> {
    const message = '{"draftUnavailable":"read-only ceiling"}', run = sourceRun([call('get_context'),call('finish_answer',{message})],{readOnly:true});
    expect(await run.promise).toMatchObject({kind:'answer',taskOutcome:'draft-not-produced',message});
    expect(run.workspace.profile).toBe('coding-read-only'); expect(run.closed).toBe(true); expect(run.project).toEqual(run.before);
  });
});
