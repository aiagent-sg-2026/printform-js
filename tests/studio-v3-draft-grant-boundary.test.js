import { describe, expect, it } from 'vitest';
import { createModels, fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { createGrant, grantedDefinitions } from '../studio-v3/agent-effects.js';
import { AGENT_TOOL_DEFINITIONS } from '../studio-v3/agent-registry.js';
import { createAgentTools } from '../studio-v3/agent-tools.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { runAgentLoop } from '../studio-v3/agent-loop.js';
import { newProject } from '../studio-v3/model.js';
import { authorizeSourceWorkspace, isSourceAuthorization } from '../studio-v3/source-workspace-run.js';

const request = 'Create a private draft with custom paper; preview now and wait for human Apply.';
const names = grant => grantedDefinitions(grant,AGENT_TOOL_DEFINITIONS).map(tool=>tool.name);
const call = (name,args={}) => fauxAssistantMessage([fauxToolCall(name,args,{id:crypto.randomUUID()})],{stopReason:'toolUse'});
const decoded = message => JSON.parse(message.content[0].text);
function toolBoundary(grant) {
  const project = newProject(), before = structuredClone(project), draft = createDraft(project,{request}), outcome = {};
  const tools = Object.fromEntries(createAgentTools({grant,draft,outcome,context:()=> '{}',signal:new AbortController().signal,
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

describe('AI-first design grant with explicit read-only ceilings',()=> {
  it('keeps both answer and proposal available with a frozen selected scope',()=> {
    const scope = {mode:'selected',ids:['footer-notes']}, grant = createGrant('design',{scope});
    expect(grant.profile).toBe('design'); expect(grant.scope).toEqual(scope);
    expect(names(grant)).toEqual(expect.arrayContaining(['finish_answer','finish','report_blocked','apply_operations','inspect_draft']));
    expect(Object.isFrozen(grant)).toBe(true); expect(Object.isFrozen(grant.effects)).toBe(true);
  });
  it('requires evidence even though finish_answer is available under design',async()=> {
    const state = toolBoundary(createGrant('design')), args = {message:'The footer contains notes.',observationId:null};
    expect(decoded(await state.tools.get_capabilities.execute('catalog',{})).tools.map(tool=>tool.name)).toContain('finish_answer');
    await expect(state.tools.finish_answer.execute('answer',args)).rejects.toMatchObject({code:'AGENT_EVIDENCE_REQUIRED'});
    await state.tools.get_context.execute('context',{});
    await state.tools.finish_answer.execute('answer',args);
    expect(state.outcome.answer).toMatchObject({message:args.message,taskOutcome:'answered'});
    expect(state.outcome.proposal).toBeUndefined(); expect(state.project).toEqual(state.before);
  });
  it('preserves an explicitly read-only host grant',()=> {
    const grant = createGrant('read-only');
    expect(names(grant)).toContain('finish_answer'); expect(names(grant)).not.toContain('finish'); expect(names(grant)).not.toContain('apply_operations');
  });
});

describe('source authority remains the existing coding profile and real host lease',()=> {
  it('does not admit a profile-shaped object or an absent source authorization',()=> {
    for (const workspace of [undefined,{profile:'coding',active:true}]) {
      expect(()=>createGrant('coding',{workspace})).toThrow(expect.objectContaining({code:'WORKSPACE_DISCLOSURE_REQUIRED'}));
    }
  });
  it('retains coding authority and still requires a genuine source artifact for finish',async()=> {
    let catalog, sourceDenied;
    const run = sourceRun([call('get_capabilities'),context=> {
      catalog=decoded(context.messages.at(-1)); return call('finish',{summary:'Missing source artifact'});
    },context=> {
      sourceDenied=context.messages.at(-1); return call('report_blocked',{reason:'No current imported source artifact exists.'});
    }]);
    expect(isSourceAuthorization(run.workspace)).toBe(true);
    await expect(run.promise).rejects.toMatchObject({code:'AGENT_BLOCKED',reason:'No current imported source artifact exists.'});
    expect(catalog.run.profile).toBe('coding');
    expect(catalog.tools.map(tool=>tool.name)).toEqual(expect.arrayContaining(['finish_answer','workspace_write','workspace_run','import_artifact','finish','report_blocked']));
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
    expect(await run.promise).toMatchObject({kind:'answer',taskOutcome:'answered',message});
    expect(run.workspace.profile).toBe('coding-read-only'); expect(run.closed).toBe(true); expect(run.project).toEqual(run.before);
  });
});
