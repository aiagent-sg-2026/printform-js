import { DEMO_CONFIG } from './ai-gateway-config.js';
import { fail } from './ai-edits.js';
import { createAgentMemory } from './agent-memory.js';
import { assertImageParts } from './ai-responses-wire.js';
import { canonicalObservation } from './observation-policy.js';

// Pi messages <-> Responses items for a tool-using run. The gateway is stateless (no stored responses), so every
// turn resends the conversation; encrypted reasoning travels inside Pi's thinking block and comes back from there.
const input = text => [{type:'input_text',text}];
const joined = parts => (Array.isArray(parts) ? parts : []).filter(part=>part?.type === 'text').map(part=>part.text).join('');
const FOLDED = '[older result omitted to keep the request small]';

// Only the fields the gateway documents for a replayed reasoning item; anything else that was stored stays home.
function replayReasoning(signature) {
  const stored = JSON.parse(signature);
  if (typeof stored?.encrypted_content !== 'string') throw fail('MALFORMED_PROPOSAL');

  return {type:'reasoning',id:stored.id,summary:[],encrypted_content:stored.encrypted_content};
}
export const toolSpecs = tools => tools.map(({name,description,parameters}) => ({type:'function',name,description,parameters}));

// Reference images travel with the request on the first turns only: the gateway keeps no state, so every turn would
// otherwise resend them. After that a line says they are gone, and the model works from its own notes.
const showImages = (messages,limits) => messages.filter(message=>message.role === 'assistant').length < limits.imageTurns;
function userParts(content,visible) {
  if (typeof content === 'string') return input(content);
  const parts = [];
  let hidden = 0;
  for (const block of content) {
    if (block.type === 'text') parts.push({type:'input_text',text:block.text});
    else if (block.type === 'image') { if (visible) parts.push({type:'input_image',image_url:`data:${block.mimeType};base64,${block.data}`}); else hidden += 1; }
  }
  if (hidden) parts.push({type:'input_text',text:`[${hidden} reference image${hidden === 1 ? '' : 's'} no longer attached; rely on your notes]`});
  return parts;
}
// Whether the next request would carry images, so the caller can require confirmed image support first.
export function usesImages({messages},limits = DEMO_CONFIG.agent,memory) {
  return Boolean(memory?.latestVisual?.()) || showImages(messages,limits) && messages.some(message=>message.role === 'user' && Array.isArray(message.content) && message.content.some(block=>block.type === 'image'));
}

// Messages grouped as: the request, then turns of one assistant message and the tool results that answer it.
function turnsOf(messages) {
  const turns = [];
  for (const message of messages.slice(1)) {
    if (message.role === 'toolResult' && turns.length) turns.at(-1).push(message); else turns.push([message]);
  }
  return turns;
}
const sizeOf = messages => JSON.stringify(messages).length;
// Past its budget, the request keeps the original ask and the newest turns, and says in one message what was dropped.
// Whole turns go, so a function call is never left without its result.
function compact(messages,memory,limits,visual) {
  if (sizeOf(messages) <= limits.maxContextChars) return messages;
  const turns = turnsOf(messages), kept = turns.filter((turn,index)=>index>=turns.length-limits.keepTurns || turn.some(message=>message.role==='toolResult' && message.toolCallId===visual?.toolCallId));
  if (kept.length === turns.length) return messages;
  const earlier = {role:'user',content:`Earlier work (older steps were dropped to keep the request small):\n${memory.describe() || 'Nothing was noted.'}`,timestamp:0};
  return [messages[0],earlier,...kept.flat()];
}

// Older tool results are folded (the call stays, so the pairing is intact); only the newest few are sent in full.
export function inputItems({systemPrompt,messages:all},memory = createAgentMemory(),limits = DEMO_CONFIG.agent) {
  const visual = memory.latestVisual?.();
  if (visual) {
    const call = all.flatMap(message=>message.role === 'assistant' ? message.content || [] : []).find(block=>block.type==='toolCall' && block.id===visual.toolCallId);
    const result = all.find(message=>message.role==='toolResult' && message.toolCallId===visual.toolCallId);
    if (call?.name!=='retrieve_page' || canonicalObservation(call.arguments)!==canonicalObservation(visual.args) || result?.isError || joined(result?.content)!==visual.output) throw fail('OBSERVATION_PIXELS_PAIR_REQUIRED');
  }
  if (all.some(message=>message.role==='toolResult' && message.content?.some(part=>part.type==='image'))) throw fail('OBSERVATION_PIXELS_PAIR_REQUIRED');
  const compacted = compact(all,memory,limits,visual), summarised = compacted !== all;
  // The notes are shown every turn; a summary already carries them.
  const messages = !summarised && memory.notes ? [compacted[0],{role:'user',content:memory.describe(),timestamp:0},...compacted.slice(1)] : compacted;
  const visible = showImages(all,limits), total = messages.filter(message=>message.role === 'toolResult').length, fullFrom = total - limits.keepToolResults;
  const items = systemPrompt ? [{role:'system',content:input(systemPrompt)}] : [];
  let seen = 0;
  for (const message of messages) {
    if (message.role === 'user') items.push({role:'user',content:userParts(message.content,visible)});
    else if (message.role === 'toolResult') { const folded = seen++ < fullFrom && message.toolCallId!==visual?.toolCallId; items.push({type:'function_call_output',call_id:message.toolCallId,output:folded ? FOLDED : joined(message.content)}); }
    else if (message.role === 'assistant') {
      for (const block of message.content) {
        if (block.type === 'thinking' && block.thinkingSignature) items.push(replayReasoning(block.thinkingSignature));
        else if (block.type === 'text' && block.text) items.push({type:'message',role:'assistant',content:[{type:'output_text',text:block.text}]});
        else if (block.type === 'toolCall') items.push({type:'function_call',call_id:block.id,name:block.name,arguments:JSON.stringify(block.arguments ?? {})});
      }
    }
  }
  if (visual) {
    const image = {type:'input_image',image_url:`data:image/png;base64,${visual.data}`}; assertImageParts([image]);
    items.push({role:'user',content:[{type:'input_text',text:JSON.stringify({hostObservation:{toolCallId:visual.toolCallId,observationId:visual.observation.id,evidenceId:visual.evidence.id,contentDigest:visual.evidence.contentDigest,candidateDigest:visual.observation.candidateDigest}})},image]});
  }
  return items;
}

// A closed body: function tools and encrypted reasoning, and none of the fields the Demo gateway refuses.
export function agentBody({alias,context,memory,stream}) {
  const requestInput = inputItems(context,memory);
  assertImageParts(requestInput.flatMap(item=>item.content?.filter(part=>part.type==='input_image') || []));
  const body = JSON.stringify({model:alias,stream,input:requestInput,tools:toolSpecs(context.tools || []),tool_choice:context.tools?.length ? 'required' : 'auto',include:['reasoning.encrypted_content']});
  if (new TextEncoder().encode(body).length > DEMO_CONFIG.maxBodyBytes) throw fail('AGENT_CONTEXT_LIMIT');
  return body;
}

// Keeps what a tool run may contain. Server-side tools, refusals and unfinished answers are unexpected authority.
export function agentOutput(payload) {
  const output = payload?.output;
  if (!Array.isArray(output) || payload.status !== 'completed') throw fail('MALFORMED_PROPOSAL');
  if (output.some(item=>/(^|_)call$/.test(String(item?.type)) && item.type !== 'function_call')) throw fail('MALFORMED_PROPOSAL');
  if (output.some(item=>item?.type === 'message' && Array.isArray(item.content) && item.content.some(part=>part?.type === 'refusal'))) throw fail('MALFORMED_PROPOSAL');
  return output;
}

export function assistantContent(output) {
  const content = [];
  for (const item of output) {
    if (item.type === 'reasoning' && item.encrypted_content) {
      content.push({type:'thinking',thinking:'',thinkingSignature:JSON.stringify({type:'reasoning',id:item.id,summary:[],encrypted_content:item.encrypted_content}),redacted:true});
    } else if (item.type === 'message') {
      const text = (item.content || []).filter(part=>part?.type === 'output_text' && typeof part.text === 'string').map(part=>part.text).join('');
      if (text) content.push({type:'text',text});
    } else if (item.type === 'function_call') {
      let args; try { args = JSON.parse(item.arguments || '{}'); } catch { throw fail('MALFORMED_PROPOSAL'); }
      if (!args || typeof args !== 'object' || Array.isArray(args) || typeof item.call_id !== 'string' || typeof item.name !== 'string') throw fail('MALFORMED_PROPOSAL');
      content.push({type:'toolCall',id:item.call_id,name:item.name,arguments:args});
    }
  }
  return content;
}
