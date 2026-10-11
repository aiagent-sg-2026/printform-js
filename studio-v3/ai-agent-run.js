import { chatRequest, measuredFontQuestion, typographyAnswer } from './ai-chat-protocol.js';
import { createGatewayModel } from './agent-provider.js';
import { runAgentLoop } from './agent-loop.js';
import { createAgentMemory } from './agent-memory.js';

// One authoring run for the panel: the tool loop over the Demo gateway, on a copy of the form. The result has the
// shape of a single-step proposal, so Preview / Apply / Undo take it unchanged.
// `profile` is the host's effect grant for this run ('read-only' for a question, 'design' otherwise).
export async function runPanelAgent({transport,alias,payload,media,project,signal,assertContext,inspectCandidate,onPhase,onStep,profile = 'design'}) {
  // The status line carries the run's tokens so far, so a long run is never a silent spender.
  let spent = 0;
  const memory = createAgentMemory();
  const provider = createGatewayModel({transport,alias,signal,assertContext,memory,onTurn:({totals})=>{ spent = totals.total; },onPhase:(text,options)=>onPhase(spent ? `${text} · ${spent.toLocaleString('en-US')} tokens` : text,options)});
  const result = await runAgentLoop({...provider,memory,media,project,request:payload.request,scope:payload.scope,references:payload.references,
    context:(current,info)=>chatRequest(current,payload,{mode:'steps',...info}),inspect:inspectCandidate,signal,onStep,profile,
    // Measured print sizes come from the committed preview, never from the model's words.
    finalizeAnswer:message=>measuredFontQuestion(payload.request,payload.conversation) ? typographyAnswer(payload.typography,payload.scope) : message});
  return {...result,mode:'steps',usage:provider.usage()};
}
