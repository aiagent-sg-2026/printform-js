import { validateToolArguments } from '@earendil-works/pi-ai';
import { argumentRepairHint } from './agent-arguments.js';
import { createAgentMemory } from './agent-memory.js';
import { fail } from './ai-edits.js';
import { AGENT_TOOL_DEFINITIONS } from './agent-registry.js';
import { TOOL_HANDLERS } from './agent-handlers.js';
import { createGrant, assertEffect, grantedDefinitions } from './agent-effects.js';
import { isSourceAuthorization } from './source-workspace-run.js';
import { createObservationRecords, DIAGNOSTIC_POLICY } from './observation-records.js';
import { observationDisclosure, pixelDisclosure, canonicalObservation, assertObservationAuthorization } from './observation-policy.js';
import { createPixelEvidence } from './observation-pixels.js';
export { AGENT_TOOL_NAMES } from './agent-registry.js';

// Registry metadata owns the model-visible contract; TOOL_HANDLERS own runtime effects and validation.
// `grant` is host-built and frozen. Every registered tool is wrapped so its handler re-checks the grant, even though
// the model is only shown the granted ones (`visible`); a hidden tool never reaches a handler.
export function createAgentTools({draft,context,inspect,signal,outcome,limits,identity,stopRun=()=>{},memory = createAgentMemory(),onStep = () => {},
  definitions = AGENT_TOOL_DEFINITIONS,handlers = TOOL_HANDLERS,intent,grant = createGrant('design',{intent}),finalizeAnswer,
  runId = crypto.randomUUID(),baseRevision = 0,assertCurrent = () => {},observationAuthorization,readObservationHost = () => ({dataPolicy:null,selectedTargets:[]}),capturePixels,workspace}) {
  const visible = grantedDefinitions(grant,definitions);
  const run = {calls:0,failure:'',repeats:0,inspected:null,evidence:false,draft,context,inspect,signal,outcome,limits,identity,memory,definitions,visible,grant,intent,finalizeAnswer,runId,baseRevision,workspace,assertCurrent};
  const releaseIdentity = Object.freeze(structuredClone(identity || {release:'development',verified:false}));
  run.observationKind = 'print-diagnostics'; run.authorization = observationAuthorization; run.readObservationHost = readObservationHost;
  run.observations = createObservationRecords({assertCurrent,readState:()=> {
    const state = {...readObservationHost(),project:draft.project,baseRevision,runId};
    const policy = run.observationKind === 'page-pixels' ? pixelDisclosure(run.authorization,state,draft.version) : run.observationKind === 'semantic-context' ? observationDisclosure(run.authorization,state,draft.version) : {...DIAGNOSTIC_POLICY,host:JSON.parse(canonicalObservation(state.dataPolicy))};
    return {runId,releaseIdentity,documentId:draft.project.manifest.documentId,baseRevision,candidateVersion:draft.version,
      project:draft.project,scenario:{id:'active',data:draft.project.sampleData},policy,kind:run.observationKind};
  }});
  run.pixels = createPixelEvidence(run,capturePixels); memory.latestVisual = ()=>run.pixels.current();
  const begin = name => {
    signal.throwIfAborted(); outcome.turns = ++run.calls;
    if (workspace && !isSourceAuthorization(workspace)) { const code = workspace.denialCode || 'WORKSPACE_AUTH_EXPIRED'; outcome.blocked = {code}; stopRun(); throw fail(code); }
    if (run.calls > limits.maxTurns) {
      outcome.blocked = {code:'AGENT_BUDGET'}; onStep({name,ok:false,code:'AGENT_BUDGET'}); stopRun(); throw fail('AGENT_BUDGET');
    }
  };
  const rejected = (name,args,error,repairHint = '') => {
    if (signal.aborted) throw error;
    const code = error.code || 'TOOL_FAILED', signature = `${name}:${code}:${JSON.stringify(args)}`;
    run.repeats = signature === run.failure ? run.repeats + 1 : 1; run.failure = signature;
    onStep({name,ok:false,code});
    if (run.repeats >= limits.maxRepeatedFailures) { outcome.blocked = {code:'AGENT_STALLED'}; stopRun(); throw fail('AGENT_STALLED'); }
    throw Object.assign(new Error(`${code}. Correct the step and try again, or call undo_step.${repairHint}`),{code});
  };
  if (definitions.length !== Object.keys(handlers).length || definitions.some(({name})=>!handlers[name])) throw fail('AGENT_REGISTRY_INVALID');
  return definitions.map(definition=> {
    const {name,description,parameters} = definition;
    let prepared = false;
    return {name,label:name,description,parameters,replay:'never',
      prepareArguments:args=> {
        prepared = false; begin(name);
        try { assertEffect(grant,definition); } catch (error) { return rejected(name,args,error); }
        try {
          const validated = validateToolArguments(definition,{name,id:'schema-check',arguments:args});
          // Pi may coerce primitives or optional nulls; the product accepts only the raw declared types.
          if (JSON.stringify(validated) !== JSON.stringify(args)) throw new Error();
          prepared = true; return args;
        } catch { return rejected(name,args,fail('AGENT_ARGUMENTS_INVALID'),argumentRepairHint(definition,args)); }
      },
      execute:async (_id,args) => {
        if (!prepared) begin(name); prepared = false;
        try {
          assertCurrent();
          if (workspace && !isSourceAuthorization(workspace)) throw fail(workspace.denialCode || 'WORKSPACE_AUTH_EXPIRED');
          if (run.authorization) assertObservationAuthorization(run.authorization,{...readObservationHost(),runId});
          assertEffect(grant,definition);
          run.toolCallId = _id;
          const result = await handlers[name](args || {},run);
          assertCurrent(); signal.throwIfAborted();
          const taskOutcome = result.details?.taskOutcome;
          run.failure = ''; run.repeats = 0; onStep({name,ok:taskOutcome !== 'draft-not-produced',detail:result.details?.detail,...(taskOutcome ? {taskOutcome} : {})}); return result;
        } catch (error) { return rejected(name,args,error); }
      }
    };
  });
}
