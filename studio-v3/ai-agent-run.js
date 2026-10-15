import { chatRequest, measuredFontQuestion, typographyAnswer } from './ai-chat-protocol.js';
import { createGatewayModel } from './agent-provider.js';
import { runAgentLoop } from './agent-loop.js';
import { createAgentMemory } from './agent-memory.js';
import { assertObservationAuthorization, revokeObservationAuthorization } from './observation-policy.js';
import { isSourceAuthorization } from './source-workspace-run.js';
import { sourceFailure } from './source-workspace-errors.js';

// One authoring run for the panel: the tool loop over the Demo gateway, on a copy of the form. The result has the
// shape of a single-step proposal, so Preview / Apply / Undo take it unchanged.
// `profile` is the host's effect grant for this run ('read-only' for a question, 'design' otherwise).
export async function runPanelAgent({transport,alias,payload,media,project,signal,assertContext,inspectCandidate,capturePixels,onPhase,onStep,profile = 'design',baseRevision,runId,observationAuthorization,readObservationHost,workspace}) {
  // The status line carries the run's tokens so far, so a long run is never a silent spender.
  let spent = 0;
  const memory = createAgentMemory();
  const assertRun = ()=> {
    assertContext?.();
    if (workspace && !isSourceAuthorization(workspace)) throw sourceFailure(workspace.denialCode || 'WORKSPACE_AUTH_EXPIRED');
    if (observationAuthorization) assertObservationAuthorization(observationAuthorization,{...readObservationHost(),runId});
  };
  const provider = createGatewayModel({transport,alias,signal,assertContext:assertRun,memory,onTurn:({totals})=>{ spent = totals.total; },onPhase:(text,options)=>onPhase(spent ? `${text} · ${spent.toLocaleString('en-US')} tokens` : text,options)});
  try {
    const result = await runAgentLoop({...provider,memory,media,project,request:payload.request,scope:payload.scope,references:payload.references,
      context:(current,info)=>chatRequest(current,payload,{mode:'steps',...info}),inspect:inspectCandidate,capturePixels,signal,onStep,profile,baseRevision,assertCurrent:assertRun,runId,observationAuthorization,readObservationHost,workspace,
      // Measured print sizes come from the committed preview, never from the model's words.
      finalizeAnswer:message=>measuredFontQuestion(payload.request,payload.conversation) ? typographyAnswer(payload.typography,payload.scope) : message});
    return {...result,alias,mode:'steps',usage:provider.usage()};
  } finally { revokeObservationAuthorization(observationAuthorization); }
}
