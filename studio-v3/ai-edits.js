import { designOf, compileProject, selectionField, BLOCKS } from './model.js';
import { validateDesign } from './file-io.js';
import { applyAuthoring } from './ai-authoring.js';

export const STYLE_KEYS = ['color','font','padding','striped','borders','repeatHeader','repeatTable','pageNumbers','breakBefore'];
export const MAX_AUTHORING_DIFFS = 360;
export const fail = code => Object.assign(new Error(code), {code});
function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw fail('UNSAFE_PROPOSAL');
}
// Excludes text, labels, bindings, collection, data, amounts and scripts.
export function shareLayout(project) {
  const d = designOf(project);
  return {style:Object.fromEntries(STYLE_KEYS.map(key => [key,d[key]])),table:{target:'items',rowBackground:d.tableStyle?.rowBackground ?? null},columns:d.columns.map(c => ({id:`items-${c.id}`,width:c.width}))};
}
export function parseProposal(text, project,explicitPointers=[]) {
  if (typeof text !== 'string' || text.length > 20000) throw fail('MALFORMED_PROPOSAL');
  let proposal;
  try { proposal = JSON.parse(text); } catch { throw fail('MALFORMED_PROPOSAL'); }
  exactKeys(proposal,['summary','edits','operations']);
  if (typeof proposal.summary !== 'string' || proposal.summary.length > 500 || Boolean(proposal.edits) === Boolean(proposal.operations)) throw fail('MALFORMED_PROPOSAL');
  const d = designOf(project), diff = [], seen = new Set();
  let targets;
  if (proposal.operations) {
    const authored = applyAuthoring(d,proposal.operations,project,explicitPointers); diff.push(...authored.diff); targets = authored.targets;
  } else {
  if (!Array.isArray(proposal.edits) || !proposal.edits.length || proposal.edits.length > 12) throw fail('MALFORMED_PROPOSAL');
  for (const edit of proposal.edits) {
    exactKeys(edit,['target','property','value']);
    const {target,property,value} = edit;
    const key = `${target}:${property}`;
    if (seen.has(key)) throw fail('UNSAFE_PROPOSAL');
    seen.add(key);
    let holder;
    if (target === 'style' && STYLE_KEYS.includes(property)) holder = d;
    else if (typeof target === 'string' && property === 'width') holder = d.columns.find(c => `items-${c.id}` === target);
    if (!holder || typeof value !== typeof holder[property]) throw fail('UNSAFE_PROPOSAL');
    const before = holder[property]; holder[property] = value;
    if (before !== value) diff.push({target,property,before,after:value});
  }
  }
  if (d.columns.reduce((total,c) => total+c.width,0) > 100.01) throw fail('COLUMN_WIDTH_LIMIT');
  try { validateDesign(d); } catch { throw fail('UNSAFE_PROPOSAL'); }
  if (!diff.length) throw fail('NO_CHANGES');
  if (diff.length > MAX_AUTHORING_DIFFS) throw fail('UNSAFE_PROPOSAL');
  targets ||= diff.map(d=>d.target);
  const ownership = Object.fromEntries(targets.map(target=>[target,BLOCKS.includes(target) ? target : ['header-title','header-logo'].includes(target) ? 'header' : (selectionField(d,target) || selectionField(project.manifest.studioV3,target))?.block || null]));
  return {summary:proposal.summary,diff,targets,ownership,operations:proposal.operations,design:d,candidate:compileProject(project,d)};
}
export function assertProposalCurrent(bus, proposal) {
  if (!bus?.active || bus !== proposal.bus || bus.revision !== proposal.revision || JSON.stringify(bus.project.manifest.studioV3) !== proposal.baseDesign) throw fail('STALE_PROPOSAL');
}
export function assertPendingProposal(bus,proposal,panel,generation) {
  if (panel.proposal !== proposal || panel.generation !== generation) throw fail('STALE_PROPOSAL');
  assertProposalCurrent(bus,proposal);
}
