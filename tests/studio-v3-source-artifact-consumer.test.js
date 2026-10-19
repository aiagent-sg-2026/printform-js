import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { verifySourceArtifact } from '../studio-v3/source-workspace-artifact.js';
import { authorizeSourceWorkspace } from '../studio-v3/source-workspace-run.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { createAgentTools } from '../studio-v3/agent-tools.js';
import { createGrant } from '../studio-v3/agent-effects.js';
import { designOf,newProject } from '../studio-v3/model.js';
import { designOperations,editProject } from '../studio-v3/controller.js';
import { inspectProject } from '../studio-v3/validation.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { artifact as exportArtifact } from '../coding-runner/operations.mjs';
import { LIMITS,sha,treeDigest,changesBetween } from '../coding-runner/policy.mjs';
import { html,setup } from './support/chat-panel.js';

const identity = {release:'synthetic-consumer',contractHash:'c'.repeat(64),knowledgeHash:'d'.repeat(64),packageHash:'e'.repeat(64)};
const sourceRunnerHash = 'f'.repeat(64), imageDigest = `sha256:${'b'.repeat(64)}`;
const expected = {workspaceId:'consumer-workspace',sourceRevision:2,buildCallId:'consumer-build',treeDigest:'a'.repeat(64),imageDigest,
  releaseIdentity:identity,documentId:'consumer-document',baseRevision:0,runId:'consumer-run'};
const resize = {type:'set_page',patch:{paper:'CUSTOM',customSizeMm:{width:188.5,height:244.2},orientation:'portrait'}};
const heading = [{type:'set_section',target:'header',patch:{enabled:true}},{type:'set_heading',value:'STRICT SOURCE CANDIDATE'}];
const contentOf = operations => JSON.stringify({format:'printform-operation-artifact',version:1,summary:'Review source candidate',operations});
const envelope = content => ({...structuredClone(expected),id:'consumer-artifact',mediaType:'application/json',content,bytes:Buffer.byteLength(content),contentDigest:sha(content)});
const entry = (path,content) => ({path,content,type:'file',mode:420,bytes:Buffer.byteLength(content),digest:sha(content)});
const tree = entries => ({entries,treeDigest:treeDigest(entries)});
// Receipt fixtures isolate the host consumer, not Docker execution. Artifact export, hashing,
// typed authoring, scope/binding validation, inspection gates and human commit are real consumers.
async function consumer(project,operations,{scope={mode:'whole'},content=contentOf(operations)}={}) {
  const signal = new AbortController().signal, draft = createDraft(project,{scope}), outcome = {};
  const initial = entry('src/form.mjs','public fictional starter\n');
  const server = {id:expected.workspaceId,revision:0,tree:tree([initial]),calls:new Map(),context:null};
  let sequence = 0, artifactReads = 0, closed = false;
  const connection = {available:true,runnerSourceHash:sourceRunnerHash,
    create:async binding => { server.context=binding; return {id:server.id,revision:0,treeDigest:server.tree.treeDigest,imageDigest}; },
    call:async(_id,operation,args,revision)=> {
      if (revision !== server.revision) throw new Error('Fixture revision mismatch');
      const before = server.tree, callId = `consumer-call-${++sequence}`;
      let result;
      if (operation === 'write') server.tree=tree([entry('src/form.mjs',args.content)]);
      else if (operation === 'run') server.tree=tree([...before.entries,entry('artifacts/form.json',content)]);
      else if (operation === 'artifacts') { artifactReads++; result=exportArtifact(server,args,LIMITS,imageDigest); }
      else throw new Error(`Unexpected fixture operation: ${operation}`);
      if (before.treeDigest !== server.tree.treeDigest) server.revision++;
      const receipt = {callId,status:'completed',beforeRevision:revision,afterRevision:server.revision,beforeDigest:before.treeDigest,
        afterDigest:server.tree.treeDigest,imageDigest,changes:changesBetween(before.entries,server.tree.entries),...(result ? {result} : {}),
        ...(operation === 'run' ? {operation,exitCode:0,signal:null} : {})};
      server.calls.set(callId,receipt); return receipt;
    },close:async()=> { closed=true; }};
  const workspace = authorizeSourceWorkspace(connection,{fictionalSource:true});
  await workspace.open({identity:{...identity,sourceRunnerHash},project,baseRevision:0,runId:expected.runId},signal);
  // The producer receipt below is synthetic, never evidence that a process actually ran.
  await workspace.action('write',{path:'src/form.mjs',expectedDigest:initial.digest,content:'public fictional source edit\n'},signal);
  const build = await workspace.action('run',{command:'node build.mjs',cwd:''},signal);
  const descriptor = await workspace.artifact({callId:build.callId,path:'artifacts/form.json'},signal);
  let report = {status:'ready',validation:{errors:[],warnings:[]}};
  const tools = createAgentTools({draft,outcome,workspace,grant:createGrant('coding',{workspace,scope}),identity,signal,
    limits:{maxTurns:64,maxRepeatedFailures:5},context:()=>'',inspect:async({candidate})=>({report,quality:inspectProject(candidate,report)})});
  const execute = (name,args={})=>tools.find(tool=>tool.name===name).execute(name,args);
  return {draft,outcome,workspace,descriptor,execute,import:()=>execute('import_artifact',{artifactId:descriptor.id}),
    block:()=> { report={status:'blocked',validation:{errors:[{code:'HORIZONTAL_OVERFLOW'}],warnings:[]}}; },
    ready:()=> { report={status:'ready',validation:{errors:[],warnings:[]}}; },reads:()=>artifactReads,closed:()=>closed};
}

beforeEach(()=> { vi.stubGlobal('crypto',webcrypto); document.documentElement.innerHTML=html.replace(/<!doctype html>/i,''); localStorage.clear(); });
afterEach(()=> { vi.unstubAllGlobals(); localStorage.clear(); });

describe('strict operation artifact bytes and native typed consumers',()=> {
  it.each([
    ['top-level last-key-wins','{"format":"printform-operation-artifact","version":1,"summary":"first","summary":"last","operations":[{"type":"set_heading","value":"title"}]}'],
    ['identical duplicate','{"format":"printform-operation-artifact","version":1,"summary":"same","summary":"same","operations":[{"type":"set_heading","value":"title"}]}'],
    ['decoded duplicate',String.raw`{"format":"printform-operation-artifact","version":1,"summary":"first","summ\u0061ry":"last","operations":[{"type":"set_heading","value":"title"}]}`],
    ['duplicate operation',contentOf(heading).replace('"value":"STRICT SOURCE CANDIDATE"','"value":"hidden","value":"STRICT SOURCE CANDIDATE"')],
    ['duplicate nested number',contentOf([resize]).replace('"width":188.5','"width":1,"width":188.5')],
    ['hidden forbidden key',contentOf(heading).replace('"value":"STRICT SOURCE CANDIDATE"','"constructor":{},"value":"STRICT SOURCE CANDIDATE"')],
    ['decoded forbidden key',contentOf(heading).replace('"value":"STRICT SOURCE CANDIDATE"',String.raw`"\u005f_proto__":{},"value":"STRICT SOURCE CANDIDATE"`)],
    ['deep structure',contentOf(heading).replace('"value":"STRICT SOURCE CANDIDATE"',`"value":${'['.repeat(18)}0${']'.repeat(18)}`)],
    ['trailing source',contentOf(heading)+' false'],
    ['malformed number',contentOf([resize]).replace('188.5','0188.5')]
  ])('rejects authenticated %s before any draft change',async(_name,content)=> {
    const project=newProject(), before=structuredClone(project), draft=createDraft(project), value=envelope(content);
    // A correct byte count/hash/custody does not make ambiguous JSON acceptable.
    await expect(verifySourceArtifact(value,expected).then(parsed=>draft.apply(parsed.summary,parsed.operations))).rejects.toMatchObject({code:'ARTIFACT_REJECTED'});
    expect(draft.version).toBe(0); expect(draft.project).toEqual(before); expect(project).toEqual(before);
  });
  it.each([false,true])('retains native numeric types and exact source digest, BOM=%s',async bom=> {
    const content=`${bom ? '\uFEFF' : ''}${contentOf([resize])}`, value=envelope(content), project=newProject(), before=structuredClone(project);
    const parsed=await verifySourceArtifact(value,expected), draft=createDraft(project);
    expect(parsed.version).toBe(1); expect(typeof parsed.version).toBe('number');
    expect(parsed.operations[0].patch.customSizeMm).toEqual({width:188.5,height:244.2});
    draft.apply(parsed.summary,parsed.operations);
    expect(designOf(draft.project).page.customSizeMm).toEqual({width:188.5,height:244.2});
    expect(value.content).toBe(content); expect(value.contentDigest).toBe(sha(content)); expect(project).toEqual(before);
    await expect(verifySourceArtifact({...value,content:content+' '},expected)).rejects.toMatchObject({code:'ARTIFACT_REJECTED'});
  });
  it.each([
    ['numeric string',[{...resize,patch:{...resize.patch,customSizeMm:{width:'188.5',height:244.2}}}],{},'UNSAFE_PROPOSAL'],
    ['invalid numeric range',[{...resize,patch:{...resize.patch,customSizeMm:{width:0,height:244.2}}}],{},'UNSAFE_PROPOSAL'],
    ['selected scope',[resize],{scope:{mode:'selected',ids:['footer-notes']}},'UNSAFE_SCOPE'],
    ['financial rebinding',[{type:'set_field',target:'items-rate',patch:{pointer:'./quantity'}}],{},'UNSAFE_PROPOSAL']
  ])('keeps %s blocked through the actual import handler',async(_name,operations,options,code)=> {
    const project=newProject('invoice',true), before=structuredClone(project), run=await consumer(project,operations,options);
    try {
      await expect(run.import()).rejects.toMatchObject({code});
      expect(run.draft.version).toBe(0); expect(run.draft.project).toEqual(before); expect(run.outcome.proposal).toBeUndefined();
      expect(project).toEqual(before); expect(run.reads()).toBe(2);
    } finally { await run.workspace.close(); }
  });
  it('re-fetches a source import, checks its exact candidate, and commits only at explicit human Apply',async()=> {
    const {panel}=setup({commit:async(proposal,generation)=> {
      panel.assertCurrent(proposal,generation);
      await editProject(proposal.bus,designOperations(proposal.bus.project,proposal.design),'AI layout suggestion');
      return {bus:proposal.bus,revision:proposal.bus.revision};
    }});
    const bus=panel.getBus(), before=structuredClone(bus.project), run=await consumer(bus.project,[...heading,resize]);
    try {
      await run.import(); expect(run.reads()).toBe(2); expect(bus.revision).toBe(0); expect(bus.project).toEqual(before);
      await expect(run.execute('finish',{summary:'Review candidate'})).rejects.toMatchObject({code:'AGENT_INSPECTION_REQUIRED'});
      run.block(); await run.execute('inspect_draft');
      await expect(run.execute('finish',{summary:'Review candidate'})).rejects.toMatchObject({code:'AGENT_INSPECTION_BLOCKED'});
      expect(run.outcome.proposal).toBeUndefined(); expect(bus.project).toEqual(before);
      run.ready(); await run.execute('inspect_draft'); await run.execute('finish',{summary:'Review candidate'});
      const proposal=run.outcome.proposal;
      expect(proposal.inspection.ready).toBe(true); expect(proposal.sourceEvidence.contentDigest).toBe(run.descriptor.contentDigest);
      expect(proposal.sourceEvidence.buildCallId).toBe(run.descriptor.buildCallId); expect(run.reads()).toBe(5);
      const template=document.createElement('template'); template.innerHTML=proposal.candidate.templateHtml;
      const bound=bindTemplate(template,proposal.candidate.sampleData,proposal.candidate.manifest);
      expect(bound.fragment.querySelector('h1')?.textContent).toBe('STRICT SOURCE CANDIDATE');
      expect(inspectProject(proposal.candidate,{status:'ready',validation:{errors:[],warnings:[]}}).ready).toBe(true);
      // Only stamp the same host metadata as sendPanelMessage; no model response is echoed.
      const card=panel.conversation.add('assistant',proposal.summary,'ready',{documentKey:panel.documentKey(),diff:proposal.diff});
      panel.proposal={...proposal,bus,revision:bus.revision,baseDesign:JSON.stringify(before.manifest.studioV3),epoch:panel.epoch,
        selection:panel.getSelection(),scope:JSON.stringify(panel.scope()),cardId:card.id,intentKey:`source-human-${crypto.randomUUID()}`};
      await expect(panel.apply()).rejects.toMatchObject({code:'AI_RUN_FAILED'}); expect(bus.revision).toBe(0);
      // The layout report is a unit fixture, not a real browser pagination/physical-print claim.
      await panel.preview(true); expect(panel.checked).toBe(true); expect(bus.revision).toBe(0); expect(bus.project).toEqual(before);
      await run.workspace.close(); expect(run.closed()).toBe(true); expect(bus.revision).toBe(0);
      const intentKey=panel.proposal.intentKey;
      await panel.apply(); expect(bus.revision).toBe(1); expect(card.status).toBe('applied');
      expect(designOf(bus.project).title).toBe('STRICT SOURCE CANDIDATE');
      expect(designOf(bus.project).page.customSizeMm).toEqual({width:188.5,height:244.2});
      expect(bus.project.sampleData).toEqual(before.sampleData); expect(bus.project.schema).toEqual(before.schema);
      await panel.apply(intentKey); expect(bus.revision).toBe(1);
    } finally { await run.workspace.close(); }
  });
});
