import { it,expect } from 'vitest';
import { createModels,fauxProvider,fauxAssistantMessage,fauxToolCall } from '@earendil-works/pi-ai';
import { runAgentLoop } from '../studio-v3/agent-loop.js';
import { newProject } from '../studio-v3/model.js';
import { authorizeSourceWorkspace,isSourceAuthorization } from '../studio-v3/source-workspace-run.js';
import { DEMO_CONFIG } from '../studio-v3/ai-gateway-config.js';

// This is an actual Pi/source-authority lifecycle test, not a fake shell/process proof.
const call = (name,args)=>fauxAssistantMessage([fauxToolCall(name,args,{id:'terminal-'+name})],{stopReason:'toolUse'});
async function terminal(maxTurns = DEMO_CONFIG.agent.maxTurns) {
  let closed = false;
  const sourceHash = 'a'.repeat(64), project = newProject('invoice',true), before = structuredClone(project);
  const connection = {runnerSourceHash:sourceHash,get available(){return !closed;},
    create:async()=>({id:'source-lifecycle',revision:0,treeDigest:'b'.repeat(64),imageDigest:'sha256:'+'c'.repeat(64)}),
    close:async()=>{closed=true;}};
  const workspace = authorizeSourceWorkspace(connection,{fictionalSource:true,readOnly:true});
  const model = fauxProvider({provider:'source-terminal-fixture',models:[{id:'source-terminal-fixture'}]});
  model.setResponses([call('read_skill',{id:'source-workspace'}),call('finish_answer',{message:'The source guide was inspected; no source or form was changed.'})]);
  const models = createModels();models.setProvider(model.provider);
  const settled = await runAgentLoop({models,model:model.getModel(),project,profile:'coding-read-only',workspace,context:()=> '{}',inspect:async()=>({report:{status:'ready'}}),
    request:'Explain the supported source profile without changing anything.',signal:new AbortController().signal,limits:{...DEMO_CONFIG.agent,maxTurns},
    verifyRelease:async()=>({release:'local',contractHash:'d'.repeat(64),knowledgeHash:'e'.repeat(64),packageHash:'f'.repeat(64),sourceRunnerHash:sourceHash}),
    assertCurrent:()=>{if(!isSourceAuthorization(workspace))throw Object.assign(new Error('WORKSPACE_AUTH_EXPIRED'),{code:'WORKSPACE_AUTH_EXPIRED'});}
  }).then(value=>({value}),error=>({error}));
  return {...settled,closed,unchanged:JSON.stringify(project)===JSON.stringify(before)};
}
it('returns a validated source-read answer before closing its lease on normal terminal halt',async()=> {
  const result = await terminal();
  expect(result.error).toBeUndefined();
  expect(result.value).toMatchObject({kind:'answer',message:'The source guide was inspected; no source or form was changed.'});
  expect(result.closed).toBe(true);expect(result.unchanged).toBe(true);
});
it('retains a tool-budget rejection rather than replacing it with pairing expiry during cleanup',async()=> {
  const result = await terminal(1);
  expect(result.error).toMatchObject({code:'AGENT_BUDGET'});expect(result.closed).toBe(true);expect(result.unchanged).toBe(true);
});
