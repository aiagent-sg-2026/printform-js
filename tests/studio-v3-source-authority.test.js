import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { newProject } from '../studio-v3/demo-templates.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { createAgentTools } from '../studio-v3/agent-tools.js';
import { createGrant, EFFECT_PROFILES } from '../studio-v3/agent-effects.js';
import { verifySourceArtifact } from '../studio-v3/source-workspace-artifact.js';
import { authorizeSourceWorkspace } from '../studio-v3/source-workspace-run.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { DEMO_CONFIG } from '../studio-v3/ai-gateway-config.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const expected = { workspaceId:'source-workspace',sourceRevision:2,buildCallId:'source-build',treeDigest:'a'.repeat(64),imageDigest:`sha256:${'b'.repeat(64)}`,
  releaseIdentity:{release:'c'.repeat(40),contractHash:'d'.repeat(64),knowledgeHash:'e'.repeat(64),packageHash:'f'.repeat(64)},documentId:'active-document',baseRevision:3,runId:'active-run' };
const heading = [{type:'set_section',target:'header',patch:{enabled:true}},{type:'set_heading',value:'FICTIONAL SOURCE REPORT'}];
function artifact(operations = heading,{bom = false} = {}) {
  const content = `${bom ? '\uFEFF' : ''}${JSON.stringify({format:'printform-operation-artifact',version:1,summary:'Fictional source form',operations})}`;
  return {...structuredClone(expected),id:'artifact-source',mediaType:'application/json',bytes:Buffer.byteLength(content),contentDigest:digest(content),content};
}
const fixture = (project = newProject()) => {
  const draft = createDraft(project), outcome = {};
  const grant = Object.freeze({profile:'coding',scope:Object.freeze({mode:'whole'}),effects:EFFECT_PROFILES.coding.effects});
  const tools = Object.fromEntries(createAgentTools({draft,outcome,grant,context:()=> '{}',inspect:async()=>({report:{status:'ready'}}),identity:{release:'development'},
    limits:DEMO_CONFIG.agent,signal:new AbortController().signal}).map(tool=>[tool.name,tool]));
  return {project,draft,outcome,tools};
};
beforeEach(()=>vi.stubGlobal('crypto',webcrypto));
afterEach(()=>vi.unstubAllGlobals());

describe('source authority and structured artifact trust boundary',()=> {
  it('does not turn a profile name, forged host-shaped grant or source arguments into a workspace',async()=> {
    for (const profile of ['coding','coding-read-only']) expect(()=>createGrant(profile)).toThrow('WORKSPACE_DISCLOSURE_REQUIRED');
    expect(()=>createGrant('coding',{workspace:{active:true,profile:'coding'}})).toThrow('WORKSPACE_DISCLOSURE_REQUIRED');
    const {project,draft,outcome,tools} = fixture(), before = structuredClone(project);
    for (const [name,args] of [['workspace_read',{path:'src/form.mjs'}],['workspace_run',{command:'touch unauthorized'}],['import_artifact',{artifactId:'forged'}]]) {
      tools[name].prepareArguments(args);
      await expect(tools[name].execute('forged',args)).rejects.toMatchObject({code:'WORKSPACE_UNAVAILABLE'});
    }
    expect(draft.project).toEqual(before); expect(project).toEqual(before); expect(outcome.proposal).toBeUndefined();
  });
  it('does not grant source permission from a pairing-shaped object without explicit fictional disclosure',()=> {
    expect(()=>authorizeSourceWorkspace({available:true})).toThrow('WORKSPACE_DISCLOSURE_REQUIRED');
    expect(()=>authorizeSourceWorkspace({available:true},{fictionalSource:false})).toThrow('WORKSPACE_DISCLOSURE_REQUIRED');
  });
  it('denies source writes and commands under a genuine narrower source-read host grant',async()=> {
    const workspace = authorizeSourceWorkspace({available:true},{fictionalSource:true,readOnly:true});
    const grant = createGrant('coding-read-only',{workspace}), project = newProject(), before = structuredClone(project), draft = createDraft(project);
    const tools = Object.fromEntries(createAgentTools({draft,workspace,grant,outcome:{},identity:{release:'development'},context:()=> '{}',limits:DEMO_CONFIG.agent,signal:new AbortController().signal}).map(tool=>[tool.name,tool]));
    for (const [name,args] of [['workspace_run',{command:'touch unauthorized'}],['workspace_write',{path:'x',expectedDigest:null,content:'unsafe'}],['apply_operations',{summary:'Changed',operations:heading}]]) {
      await expect(tools[name].execute('denied',args)).rejects.toMatchObject({code:'GRANT_DENIED'});
    }
    expect(draft.project).toEqual(before); expect(project).toEqual(before); await workspace.close();
  });
  it('rejects a mismatched companion release before source admission',async()=> {
    const create = vi.fn(), workspace = authorizeSourceWorkspace({available:true,runnerSourceHash:'a'.repeat(64),create},{fictionalSource:true});
    await expect(workspace.open({identity:{sourceRunnerHash:'b'.repeat(64)},project:newProject(),baseRevision:0,runId:'wrong-runtime'},new AbortController().signal)).rejects.toMatchObject({code:'WORKSPACE_RUNTIME_MISMATCH'});
    expect(create).not.toHaveBeenCalled(); await workspace.close();
  });
  it.each(['workspaceId','sourceRevision','buildCallId','treeDigest','imageDigest','documentId','baseRevision','runId'])('rejects an artifact from another %s without modifying the candidate',async key=> {
    const original = newProject(), draft = createDraft(original), before = structuredClone(original), value = artifact();
    value[key] = typeof value[key] === 'number' ? value[key] + 1 : `foreign-${value[key]}`;
    await expect(verifySourceArtifact(value,expected).then(parsed=>draft.apply(parsed.summary,parsed.operations))).rejects.toMatchObject({code:'ARTIFACT_REJECTED'});
    expect(draft.project).toEqual(before); expect(original).toEqual(before);
  });
  it('rejects byte tampering and a foreign release tuple before any operation',async()=> {
    const original = newProject(), draft = createDraft(original), before = structuredClone(original);
    for (const value of [{...artifact(),content:artifact().content.replace('FICTIONAL','FORGED')},
      {...artifact(),releaseIdentity:{...expected.releaseIdentity,packageHash:'0'.repeat(64)}}]) {
      await expect(verifySourceArtifact(value,expected).then(parsed=>draft.apply(parsed.summary,parsed.operations))).rejects.toMatchObject({code:'ARTIFACT_REJECTED'});
    }
    expect(draft.project).toEqual(before);
  });
  it('keeps financial bindings and selected scope protected after a valid source envelope',async()=> {
    const project = newProject(), before = structuredClone(project), finance = createDraft(project);
    const financial = await verifySourceArtifact(artifact([{type:'set_field',target:'items-rate',patch:{pointer:'./quantity'}}]),expected);
    expect(()=>finance.apply(financial.summary,financial.operations)).toThrow('UNSAFE_PROPOSAL');
    const selected = createDraft(project,{scope:{mode:'selected',ids:['footer-notes']}}), global = await verifySourceArtifact(artifact([{type:'set_style',patch:{color:'#163a65'}}]),expected);
    expect(()=>selected.apply(global.summary,global.operations)).toThrow('UNSAFE_SCOPE');
    expect(finance.project).toEqual(before); expect(selected.project).toEqual(before); expect(project).toEqual(before);
  });
  it.each([false,true])('prints the artifact heading in a private candidate with source bytes preserved, BOM=%s',async bom=> {
    const project = newProject('invoice',true), before = structuredClone(project), draft = createDraft(project), value = artifact(heading,{bom});
    const parsed = await verifySourceArtifact(value,expected), step = draft.apply(parsed.summary,parsed.operations);
    const template = document.createElement('template'); template.innerHTML = step.candidate.templateHtml;
    const bound = bindTemplate(template,step.candidate.sampleData,step.candidate.manifest);
    expect(bound.fragment.querySelector('h1')?.textContent).toBe('FICTIONAL SOURCE REPORT');
    expect(step.candidate.sampleData).toEqual(before.sampleData); expect(step.candidate.schema).toEqual(before.schema); expect(project).toEqual(before);
  });
});
