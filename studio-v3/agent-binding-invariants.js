import { BLOCKS } from './design-authoring.js';
const fields = (design,block) => block === 'items' ? design.columns : design[block];
export function financialField(field) {
  return Boolean(field.pointer && (field.format === 'currency' || /(?:^|[-/_])(amount|total|subtotal|tax|rate|price|balance|discount)(?:[-/_]|$)/i.test(`${field.id}/${field.pointer}`)));
}
// Composite supplied facts may contain money, hours or provenance, not a single
// numeric token. Protect their source binding without feeding prose to that oracle.
const suppliedFacts = ['section','description','direction','trace'];
const fixedSource = (design,block,field) => design.collection === '/printRows' &&
  (block === 'items' ? suppliedFacts.includes(field.id) : /^\/(?:service|packing)\//.test(field.pointer));
// Capture initial identities, not the last step: removal must not erase the protection of a later re-addition.
export function protectedBindings(design) {
  return BLOCKS.flatMap(block=>fields(design,block).filter(field=>field.pointer && (financialField(field) || fixedSource(design,block,field) || ['currency','number','percent'].includes(field.format)))
    .map(field=>Object.freeze({block,id:field.id,pointer:field.pointer,format:field.format,text:field.text,financial:financialField(field),collection:design.collection,
      ...(fixedSource(design,block,field) ? {fixedSource:true} : {})})));
}
export function assertProtectedBindings(baseline,design) {
  for (const original of baseline) {
    const field = fields(design,original.block).find(field=>field.id === original.id);
    if (!field) continue; // Structural removal is supported; reinstated identities retain their original contract.
    if ((field.kind && field.kind !== 'bound') || !field.pointer || field.text !== original.text || field.format !== original.format ||
        (original.financial || original.fixedSource) && (field.pointer !== original.pointer || original.block === 'items' && design.collection !== original.collection)) {
      throw Object.assign(new Error('UNSAFE_PROPOSAL'),{code:'UNSAFE_PROPOSAL'});
    }
  }
}
