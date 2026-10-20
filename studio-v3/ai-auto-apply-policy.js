import { GLOBAL_STYLE_KEYS } from './ai-authoring-contract.js';

// Host-owned decision: may a checked proposal go straight to the form without a human Apply click?
// It reads only the parsed operations/diff and the host workspace flag, never model text.
// Auto-apply is an ordinary revision (card Undo and history Undo still work); it never saves or exports.
// Anything outside this allowlist keeps the Preview / Apply card.
const BINDING_KEYS = Object.freeze(['pointer','format','kind','barcode']);
const has = (value,key) => Object.hasOwn(value || {},key);
const always = () => true;
const SAFE_OPERATION = Object.freeze({
  set_style:always,set_element_style:always,set_table_style:always,set_heading:always,set_logo:always,
  set_section:always,reorder_sections:always,reorder_fields:always,
  set_field:op=>!BINDING_KEYS.some(key=>has(op.patch,key)),
  add_field:op=>!['pointer','format','barcode'].some(key=>has(op.field,key)) && (!has(op.field,'kind') || ['static','image'].includes(op.field.kind)),
  remove_field:(op,diff)=>!diff.some(entry=>entry.target === op.target && entry.property === 'pointer' && Boolean(entry.before))
});
export function operationAutoApplicable(op,diff=[]) {
  return Boolean(op) && Object.hasOwn(SAFE_OPERATION,op.type) && SAFE_OPERATION[op.type](op,diff);
}
// Legacy single-step proposals carry `edits` instead of `operations`; the parser reduces them to the diff, which
// can only touch global style keys and column widths there.
const legacyDiffApplicable = diff => diff.length > 0 && diff.every(({target,property})=>
  (target === 'style' && GLOBAL_STYLE_KEYS.includes(property)) || (property === 'width' && /^items-/.test(target)));
export function autoApplicable(proposal,{workspace} = {}) {
  if (workspace || !proposal || proposal.kind !== 'proposal' || !Array.isArray(proposal.diff)) return false;
  if (Array.isArray(proposal.operations) && proposal.operations.length) return proposal.operations.every(op=>operationAutoApplicable(op,proposal.diff));
  return legacyDiffApplicable(proposal.diff);
}
