import { COMMIT_POLICY_SHORT } from './agent-commit-policy.js';
import { safeRunDiagnostics } from './ai-inspection.js';
import { fail } from './ai-edits.js';
import { capabilityCatalog } from './agent-registry.js';
import { readSkill } from './agent-knowledge.js';
import { runScenarioMatrix, canonicalScenario } from './scenario-matrix.js';
import { semanticObservation } from './observation-context.js';
import { ANSWER_MAX } from './agent-contracts.js';
import { sourceToolHandlers } from './agent-source-handlers.js';
import { answerTaskOutcome } from './ai-task-outcome.js';

export const reply = (value,extra = {}) => ({content:[{type:'text',text:typeof value === 'string' ? value : JSON.stringify(value)}],details:{},...extra});
// Trusted, compiled handlers keyed by tool name. A feature adds its handler here next to its registry descriptor;
// a descriptor alone never grants an effect. `run` is the per-run state built by createAgentTools.
export const TOOL_HANDLERS = Object.freeze({
  ...sourceToolHandlers(reply),
  get_capabilities:async (_args,run) => reply(capabilityCatalog({identity:run.identity,limits:run.limits,tools:run.visible,grant:run.grant})),
  read_skill:async ({id},run) => { const skill = readSkill(id); run.evidence = true; return reply({...skill,identity:run.identity}); },
  get_context:async (_args,run) => { const text = run.context(run.draft.project,{identity:run.identity,limits:run.limits}); run.evidence = true; return reply(text); },
  apply_operations:async ({summary,operations},run) => {
    const step = run.draft.apply(summary,operations), n = step.diff.length;
    run.pixels.clear();
    run.sourceArtifact = null;
    run.observations.invalidate(); run.inspected = null;
    run.memory.addStep(summary,n);
    return reply(`Applied. ${n} changes in this step, ${run.draft.count} steps in the draft.`,{details:{detail:`${n} change${n === 1 ? '' : 's'}`}});
  },
  inspect_draft:async (_args,run) => {
    run.pixels.clear();
    if (!run.inspect) return reply('Inspection is not available in this run.');
    run.inspected = null; run.observationKind = 'print-diagnostics';
    const {receipt,content:result} = await run.observations.capture(async candidate => {
      const result = safeRunDiagnostics(await run.inspect({candidate}),candidate);
      run.signal.throwIfAborted(); return result;
    });
    run.signal.throwIfAborted();
    run.inspected = {receipt}; run.evidence = true;
    return reply({...result,observation:receipt},{details:{detail:result.ready ? 'ready' : `${result.errors.length + result.issues.length} issues`}});
  },
  observe_context:async (_args,run) => {
    run.pixels.clear();
    if (!run.authorization) throw fail('OBSERVATION_DISCLOSURE_REQUIRED');
    if (!run.inspect) throw fail('TOOL_FAILED');
    run.observationKind = 'semantic-context'; run.inspected = null;
    const {receipt,content} = await run.observations.capture(async candidate=> {
      const diagnostics = safeRunDiagnostics(await run.inspect({candidate}),candidate);
      run.signal.throwIfAborted();
      return semanticObservation(candidate,diagnostics,run.authorization,run.readObservationHost().selectedTargets);
    });
    run.signal.throwIfAborted();
    run.evidence = true;
    return reply({...content,observation:receipt},{details:{detail:'authorized semantic context'}});
  },
  retrieve_page:async (args,run) => reply(await run.pixels.retrieve(args,run.toolCallId)),
  // Same service as the Validate panel. It does not set run.inspected: finish stays bound to inspect_draft on the exact draft.
  validate_scenarios:async ({scenarios},run) => {
    if (!run.inspect) return reply('Inspection is not available in this run.');
    const result = await runScenarioMatrix({project:run.draft.project,ids:scenarios,signal:run.signal,render:async candidate => (await run.inspect({candidate})).report});
    run.signal.throwIfAborted(); run.evidence = true;
    const passed = result.scenarios.filter(scenario=>scenario.diagnostics.ready).length;
    return reply({ready:result.ready,scenarios:result.scenarios.map(canonicalScenario)},{details:{detail:`${passed}/${result.scenarios.length} passed`}});
  },
  undo_step:async (_args,run) => {
    run.pixels.clear();
    run.sourceArtifact = null;
    if (!run.draft.undo()) return reply('There is nothing to undo.');
    run.observations.invalidate(); run.inspected = null;
    run.memory.dropStep(); return reply(`Removed. ${run.draft.count} steps remain.`);
  },
  take_notes:async ({notes},run) => { run.memory.note(notes); return reply('Noted.',{details:{detail:'saved'}}); },
  finish:async ({summary},run) => {
    if (run.grant.profile === 'coding') {
      if (!run.sourceArtifact || run.sourceArtifact.draftVersion !== run.draft.version) throw fail('SOURCE_ARTIFACT_REQUIRED');
      await run.workspace.confirmImported(run.sourceArtifact.evidence,run.signal);
      run.signal.throwIfAborted(); run.assertCurrent();
    }
    const proposal = run.draft.proposal(summary);
    if (!run.inspected) throw fail('AGENT_INSPECTION_REQUIRED');
    let observed;
    try { observed = run.observations.requireLatest(run.inspected.receipt.id); }
    catch (error) { if (error.code === 'EVIDENCE_STALE') throw fail('AGENT_INSPECTION_REQUIRED'); throw error; }
    const inspection = {...observed.content,observation:observed.receipt};
    if (!inspection.ready) throw fail('AGENT_INSPECTION_BLOCKED');
    run.outcome.proposal = {...proposal,inspection,identity:run.identity,...(run.sourceArtifact ? {sourceEvidence:run.sourceArtifact.evidence} : {})};
    return reply(`Done. ${COMMIT_POLICY_SHORT}`,{terminate:true});
  },
  finish_answer:async ({message,observationId},run) => {
    // An answer must rest on a read of the guide, the form or an inspection; get_capabilities alone is not evidence.
    if (!run.evidence) throw fail('AGENT_EVIDENCE_REQUIRED');
    const observed = run.observations.current();
    if (observationId && observationId !== observed?.receipt.id) throw fail('EVIDENCE_STALE');
    const text = run.finalizeAnswer ? run.finalizeAnswer(message) : message;
    // Presentation metadata must never alter the finalized answer (including exact JSON).
    if (typeof text !== 'string' || text.length > ANSWER_MAX) throw fail('AGENT_ANSWER_LIMIT');
    if (observed) run.observations.requireLatest(observed.receipt.id);
    const taskOutcome = answerTaskOutcome(run.intent);
    run.outcome.answer = {message:text,taskOutcome,identity:run.identity,...(observed ? {observation:observed.receipt} : {})};
    return reply(taskOutcome === 'draft-not-produced' ? 'Draft request not completed. No inspected proposal was delivered; the answer is retained separately. The form is unchanged.' : 'Done. The answer is shown to the person.',{terminate:true,details:{taskOutcome}});
  },
  report_blocked:async ({reason},run) => { run.outcome.blocked = {code:'AGENT_BLOCKED',reason}; return reply('Reported.',{terminate:true}); }
});
