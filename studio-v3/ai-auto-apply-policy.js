import { GLOBAL_STYLE_KEYS } from './ai-authoring-contract.js';

// Host-owned decision: may a checked proposal go straight to the form without a human Apply click?
// It reads only the parsed operations/diff and the host workspace flag, never model text.
// Auto-apply is an ordinary revision (card Undo and history Undo still work); it never saves or exports.
// Anything outside this allowlist keeps the Preview / Apply card.
const SAFE_GLOBAL_STYLE = Object.freeze(['color','font','padding','striped','borders']);
const SAFE_FIELD_PATCH = Object.freeze(['labelStyle','valueStyle','showLabel','width']);
const SAFE_LAYOUT_PATCH = Object.freeze(['layout']);
const keysWithin = (patch,allowed) => Boolean(patch) && typeof patch === 'object' && !Array.isArray(patch) && Object.keys(patch).length > 0 && Object.keys(patch).every(key=>allowed.includes(key));
const SAFE_OPERATION = Object.freeze({
  set_element_style:op=>keysWithin(op.patch,['fontSize','bold','color','align']),
  set_style:op=>keysWithin(op.patch,SAFE_GLOBAL_STYLE),
  set_table_style:op=>keysWithin(op.patch,['rowBackground']),
  set_field:op=>keysWithin(op.patch,SAFE_FIELD_PATCH),
  set_section:op=>keysWithin(op.patch,SAFE_LAYOUT_PATCH)
});
export function operationAutoApplicable(op) {
  return Boolean(op) && Object.hasOwn(SAFE_OPERATION,op.type) && SAFE_OPERATION[op.type](op);
}
// Legacy single-step proposals carry `edits` instead of `operations`; the parser reduces them to the diff, which
// can only touch global style keys and column widths there.
const legacyDiffApplicable = diff => diff.length > 0 && diff.every(({target,property})=>
  (target === 'style' && SAFE_GLOBAL_STYLE.includes(property) && GLOBAL_STYLE_KEYS.includes(property)) || (property === 'width' && /^items-/.test(target)));
export function autoApplicable(proposal,{workspace} = {}) {
  if (workspace || !proposal || proposal.kind !== 'proposal' || !Array.isArray(proposal.diff)) return false;
  if (Array.isArray(proposal.operations) && proposal.operations.length) return proposal.operations.every(operationAutoApplicable);
  return legacyDiffApplicable(proposal.diff);
}
