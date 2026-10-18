import { BLOCKS } from './design-authoring.js';
import { fieldRows, tableOf } from './additional-tables.js';
export function financialField(field) {
  return Boolean(field.pointer && (field.format === 'currency' || /(?:^|[-/_])(amount|total|subtotal|tax|rate|price|balance|discount)(?:[-/_]|$)/i.test(`${field.id}/${field.pointer}`)));
}
// Composite supplied facts keep their exact source pointer and collection.
const suppliedFacts = ['section','description','direction','trace'];
const fixedSource = (design,block,field) => {
  if (design.collection !== '/printRows') return false;
  if (block === 'items') return suppliedFacts.includes(field.id);
  if (tableOf(design,block)) return true;
  return /^\/(?:service|packing|inspection|handover|manufacturing|timesheet|requisition|maintenance)\//.test(field.pointer);
};
export function protectedBindings(design) {
  const bindings = [...BLOCKS,...(design.additionalTables || []).map(table=>table.id)].flatMap(block=>fieldRows(design,block)
    .filter(field=>field.pointer && (financialField(field) || fixedSource(design,block,field) || ['currency','number','percent'].includes(field.format) || field.kind === 'barcode'))
    .map(field=>Object.freeze({block,id:field.id,pointer:field.pointer,format:field.format,text:field.text,kind:field.kind || 'bound',financial:financialField(field),collection:tableOf(design,block)?.collection || design.collection,
      ...(fixedSource(design,block,field) ? {fixedSource:true} : {})})));
  // Additional collection selection is human-only, independently of whether
  // any of its fields needs the stronger financial/canonical protection.
  return [...bindings,...(design.additionalTables || []).map(table=>Object.freeze({block:table.id,collection:table.collection,collectionOnly:true}))];
}
export function assertProtectedBindings(baseline,design) {
  for (const original of baseline) {
    const table = tableOf(design,original.block);
    if (original.collectionOnly) {
      if (table && table.collection !== original.collection) throw Object.assign(new Error('UNSAFE_PROPOSAL'),{code:'UNSAFE_PROPOSAL'});
      continue;
    }
    const field = fieldRows(design,original.block).find(field=>field.id === original.id);
    if (!field) continue; // Reinstated identities still compare against the initial baseline.
    const kind = field.kind || 'bound';
    if (kind !== (original.kind || 'bound') || !field.pointer || field.text !== original.text || field.format !== original.format ||
        (original.financial || original.fixedSource || original.kind === 'barcode') && (field.pointer !== original.pointer || table && table.collection !== original.collection)) {
      throw Object.assign(new Error('UNSAFE_PROPOSAL'),{code:'UNSAFE_PROPOSAL'});
    }
  }
}
