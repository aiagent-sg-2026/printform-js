import { Type, validateToolArguments } from '@earendil-works/pi-ai';
import { OPERATION_SCHEMAS } from './agent-operation-schemas.js';
import { MAX_AUTHORING_OPERATIONS } from './ai-authoring-contract.js';
import { DEMO_CONFIG } from './ai-gateway-config.js';
import { skillIndex, PLANNED_CAPABILITIES } from './agent-knowledge.js';
import { LEDGER_WORKFLOWS } from './agent-workflows.js';
import { CONTRACT_VERSION, TOOL_CONTRACTS, OPERATION_CONTRACTS, ANSWER_MAX, PIXEL_CROP_SCHEMA } from './agent-contracts.js';
import { SCENARIOS, SCENARIO_IDS, MAX_SCENARIOS } from './scenario-matrix.js';
import { ERROR_CONTRACTS } from './agent-errors.js';
import { SOURCE_TOOL_FEATURES } from './agent-source-definitions.js';
import { SOURCE_WORKSPACE_SKILL } from './agent-source-guide.js';

const object = properties => Type.Object(properties,{additionalProperties:false});
const summary = Type.String({minLength:1,maxLength:500});
const definition = (name,description,parameters,effect,result,evaluations = []) => Object.freeze({id:`printform.agent.${name}`,name,description,parameters,effect,result,contractVersion:CONTRACT_VERSION,...TOOL_CONTRACTS[name],skills:['form-authoring'],
  sources:['studio-v3/agent-tools.js','studio-v3/agent-handlers.js','studio-v3/agent-effects.js','studio-v3/agent-registry.js','studio-v3/agent-contracts.js','studio-v3/agent-errors.js',...(name==='retrieve_page' ? ['studio-v3/preview.js','studio-v3/preview-pixels.js','studio-v3/ai-observation-authorization.js','studio-v3/agent-wire.js','studio-v3/ai-demo-transport.js','studio-v3/ai-panel.js','studio-v3/index.html','studio-v3/ai-panel.css'] : [])],evaluations:['tests/studio-v3-agent-registry.test.js','tests/studio-v3-agent-loop.test.js','tests/studio-v3-agent-contracts.test.js','tests/studio-v3-run-grants.test.js','tests/studio-v3-agent-arguments.test.js',...evaluations]});
export const AGENT_TOOL_DEFINITIONS = Object.freeze([
  definition('get_capabilities','Discover this release\'s tools, operation schemas, knowledge index and current run limits. Call this first.',object({}),'read','capability-catalog'),
  definition('read_skill','Read a bundled product guide by ID from the knowledge index before using its capabilities.',object({id:Type.String({minLength:1,maxLength:80})}),'read','skill-resource'),
  definition('get_context','Read the current form structure, binding catalog, authoring targets and request.',object({}),'read','semantic-context'),
  definition('apply_operations','Apply typed operations to the private draft. Combine all properties of one target in one patch.',object({summary,operations:Type.Array(Type.Union(Object.values(OPERATION_SCHEMAS)),{minItems:1,maxItems:MAX_AUTHORING_OPERATIONS})}),'draft','step-summary',['tests/studio-v3-row-fill-parity.test.js','e2e/studio-v3-row-fill-parity.spec.js','tests/studio-v3-element-style-parity.test.js','e2e/studio-v3-element-style-parity.spec.js']),
  definition('inspect_draft','Render the draft in an isolated print preview; return numeric diagnostics and a run-owned receipt bound to the current candidate and active data scenario.',object({}),'read','numeric-print-diagnostics',['tests/studio-v3-observation-records.test.js','tests/studio-v3-observation-tools.test.js','tests/studio-v3-observation-wire.test.js','e2e/studio-v3-observation-receipt.spec.js']),
  definition('observe_context','Read authorized labels/static text, assigned bindings, selected targets and measured active-scenario layout with a fresh receipt. Requires host authorization; never returns pixels.',object({}),'read','authorized-semantic-context',['tests/studio-v3-semantic-observation.test.js','tests/studio-v3-semantic-wire.test.js','tests/studio-v3-observation-authorization-ui.test.js','e2e/studio-v3-semantic-observation.spec.js']),
  definition('retrieve_page','Capture an authorized fictional page or crop using the latest observation ID. Returns run-owned PNG metadata and a new latest receipt; the host pairs pixels with this tool call on subsequent provider turns. No asset approval or value permission is granted.',object({observationId:Type.String({minLength:1,maxLength:100}),pageIndex:Type.Integer({minimum:0,maximum:4095}),crop:Type.Optional(PIXEL_CROP_SCHEMA)}),'read','receipt-bound-page-pixels',['tests/studio-v3-pixel-observation.test.js','tests/studio-v3-pixel-wire.test.js','tests/studio-v3-pixel-authorization-ui.test.js','e2e/studio-v3-pixel-observation.spec.js','e2e/studio-v3-observation-composer.spec.js']),
  definition('validate_scenarios',`Check the draft against built-in synthetic row-count scenarios (${SCENARIOS.map(([id])=>id).join(', ')}) and report pagination and quality for each. Scenarios replace the data with built-in synthetic data, so this says nothing about the person's own data.`,
    object({scenarios:Type.Optional(Type.Array(Type.Union(SCENARIO_IDS.map(id=>Type.Literal(id))),{minItems:1,maxItems:MAX_SCENARIOS,uniqueItems:true}))}),'read','scenario-diagnostics',['tests/studio-v3-scenario-matrix.test.js']),
  definition('undo_step','Remove the last applied step from the private draft.',object({}),'draft','step-summary'),
  definition('take_notes','Replace your bounded run-local notes; they remain visible after older steps are folded.',object({notes:Type.String({minLength:1,maxLength:DEMO_CONFIG.agent.maxNoteChars})}),'memory','acknowledgment'),
  definition('finish','Hand an edited, currently inspected ready draft to the person for Preview and Apply.',object({summary}),'proposal','proposal-handoff',['tests/studio-v3-observation-tools.test.js']),
  definition('finish_answer','Complete a grounded answer only when this run grants answer. Explicit design/coding draft requests remove that effect: this tool is unavailable; use finish for an inspected proposal or report_blocked. Preserve the exact finalized message; the host shows the latest observation separately. Omit observationId or use null for that receipt; an explicit ID must be latest. Stale observations reject. Compatibility answer-only output for a requested draft remains draft-not-produced, never an inspected proposal.',object({message:Type.String({minLength:1,maxLength:ANSWER_MAX}),observationId:Type.Optional(Type.Union([Type.String({minLength:1,maxLength:100}),Type.Null()]))}),'answer','answer-handoff',['tests/studio-v3-observation-completion.test.js','tests/studio-v3-observation-comparison.test.js','tests/support/observation-comparison.js','tests/support/static-observation-fixture.js','e2e/studio-v3-observation-comparison.spec.js','tests/studio-v3-draft-outcome.test.js','tests/studio-v3-draft-outcome-panel.test.js','tests/studio-v3-draft-diff-recovery.test.js','tests/studio-v3-request-intent-grammar.test.js','tests/studio-v3-draft-grant-boundary.test.js']),
  definition('report_blocked','Stop with the specific missing capability or reason the request cannot be met.',object({reason:summary}),'stop','blocked-handoff'),
  ...SOURCE_TOOL_FEATURES.map(({name,description,parameters,effect,result})=> {
    const tool = definition(name,description,parameters,effect,result,SOURCE_WORKSPACE_SKILL.evaluations);
    return Object.freeze({...tool,skills:['form-authoring','source-workspace'],sources:[...new Set([...tool.sources,...SOURCE_WORKSPACE_SKILL.sources])]});
  }),
]);
export const AGENT_TOOL_NAMES = Object.freeze(AGENT_TOOL_DEFINITIONS.map(tool=>tool.name));
// Bounded tombstones for removed capabilities: {id, name, replacementId (an active id or null), removedIn, advice}.
// A deprecated entry stays callable and carries status:'deprecated' plus an active replacementId.
export const AGENT_TOMBSTONES = Object.freeze([]);
export const OPERATION_CAPABILITIES = Object.freeze(Object.entries(OPERATION_SCHEMAS).map(([name,parameters])=>Object.freeze({id:`printform.authoring.${name}`,name,parameters,effect:'draft',result:'validated-design-diff',
  contractVersion:CONTRACT_VERSION,errors:TOOL_CONTRACTS.apply_operations.errors,...OPERATION_CONTRACTS[name],skills:['form-authoring'],
  sources:['studio-v3/ai-authoring.js','studio-v3/agent-operation-schemas.js','studio-v3/design-validation.js','studio-v3/agent-contracts.js','studio-v3/agent-errors.js',...(name === 'set_page' ? ['studio-v3/paper-settings.js','studio-v3/agent-page-settings.js','src/printform/paper-sizes.js'] : [])],evaluations:['tests/studio-v3-ai-authoring.test.js','tests/studio-v3-agent-registry.test.js','tests/studio-v3-agent-contracts.test.js',...(name === 'set_page' ? ['tests/studio-v3-special-media.test.js','tests/studio-v3-agent-special-media.test.js','e2e/studio-v3-special-media.spec.js'] : []),...(name === 'set_table_style' ? ['tests/studio-v3-row-fill-parity.test.js','e2e/studio-v3-row-fill-parity.spec.js'] : []),...(name === 'set_element_style' ? ['tests/studio-v3-element-style-parity.test.js','e2e/studio-v3-element-style-parity.spec.js'] : [])]})));
// The model sees example inputs and error advice; output schemas and rejection fixtures stay host-side for conformance.
// Operation errors are those of apply_operations, so they are listed once on that tool.
const modelView = ({outputSchema,invalid,examples,...entry}) => ({...entry,examples:examples.map(example=>example.args ?? example.operation)});
const count = status => LEDGER_WORKFLOWS.filter(row=>row[2] === status).length;
// `tools` is the set given to this run, so a newly registered feature appears without editing any list here.
export function capabilityCatalog({identity={release:'development',verified:false},limits=DEMO_CONFIG.agent,tools=AGENT_TOOL_DEFINITIONS,tombstones=AGENT_TOMBSTONES,grant=null}={}) {
  return {version:1,identity,tools:tools.map(modelView),operations:OPERATION_CAPABILITIES.map(({errors,...entry})=>modelView(entry)),knowledge:skillIndex(),
    run:{mode:'steps',...(grant ? {profile:grant.profile} : {}),maxToolCalls:limits.maxTurns,maxRunMs:limits.maxRunMs,maxRunTokens:limits.maxRunTokens,maxRepeatedFailures:limits.maxRepeatedFailures,imageTurns:limits.imageTurns,maxNoteChars:limits.maxNoteChars},
    errors:ERROR_CONTRACTS,commit:'User Preview and Apply required',unsupported:PLANNED_CAPABILITIES.map(([name])=>name),removed:tombstones,
    workflows:{guide:'product-workflows',humanMediated:count('human-mediated'),notYetCallable:count('not-yet-callable'),intentionallyUnavailable:count('intentionally-unavailable')}};
}
export function validateRegistry({tools=AGENT_TOOL_DEFINITIONS,operations=OPERATION_CAPABILITIES,skills=skillIndex(),tombstones=AGENT_TOMBSTONES}={}) {
  const entries=[...tools,...operations], ids=new Set(), names=new Set(), skillIds=new Set(skills.map(s=>s.id));
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id) || !entry.name || names.has(entry.name) || !entry.description && tools.includes(entry) || !entry.parameters || !entry.effect || !entry.result || !entry.sources?.length || !entry.evaluations?.length || !entry.skills?.length || entry.skills.some(id=>!skillIds.has(id))) throw new Error('Invalid agent capability registry.');
    ids.add(entry.id); names.add(entry.name);
    validateContract(entry,tools.includes(entry));
  }
  if (skillIds.size!==skills.length) throw new Error('Duplicate agent skill.');
  validateLifecycle(entries,tombstones);
  return entries;
}
// Static contract checks; scripts/studio-v3-agent-conformance.mjs also executes every example through the real handler.
const conforms = (parameters,value) => {
  try { return JSON.stringify(validateToolArguments({name:'contract',parameters},{name:'contract',id:'contract',arguments:value})) === JSON.stringify(value); } catch { return false; }
};
function validateContract(entry,isTool) {
  const bad = () => { throw new Error(`Invalid agent capability contract: ${entry.id}.`); };
  const input = example => isTool ? example.args : example.operation;
  if (!/^\d+\.\d+\.\d+$/.test(entry.contractVersion || '') || (isTool && !entry.outputSchema)) bad();
  if (!entry.errors?.length || entry.errors.some(code=>!ERROR_CONTRACTS[code])) bad();
  if (!entry.examples?.length || !entry.invalid?.length) bad();
  for (const example of entry.examples) if (!conforms(entry.parameters,input(example))) bad();
  for (const example of entry.invalid) {
    if (!entry.errors.includes(example.error)) bad();
    // A schema rejection must be declared as such; a handler rejection must pass the schema first.
    if ((example.error === 'AGENT_ARGUMENTS_INVALID') === conforms(entry.parameters,input(example))) bad();
  }
}
// Deprecation and removal must give truthful replacement advice that points at something still callable.
function validateLifecycle(entries,tombstones) {
  const active = new Set(entries.filter(entry=>(entry.status || 'active') === 'active').map(entry=>entry.id));
  const names = new Set(entries.map(entry=>entry.name)), removed = new Set();
  for (const entry of entries) {
    if (!['active','deprecated'].includes(entry.status || 'active')) throw new Error(`Invalid capability status: ${entry.id}.`);
    if (entry.status === 'deprecated' && !active.has(entry.replacementId)) throw new Error(`Deprecated capability needs an active replacement: ${entry.id}.`);
  }
  for (const stone of tombstones) {
    if (!stone.id || removed.has(stone.id) || entries.some(entry=>entry.id === stone.id) || names.has(stone.name) || !/^\d+\.\d+\.\d+$/.test(stone.removedIn || '') || !stone.advice
      || (stone.replacementId !== null && !active.has(stone.replacementId))) throw new Error(`Invalid capability tombstone: ${stone.id}.`);
    removed.add(stone.id);
  }
}
