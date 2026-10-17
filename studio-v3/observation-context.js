import { BLOCKS } from './model.js';
import { fieldKind } from './design-authoring.js';
import { agentPageSettings } from './agent-page-settings.js';
import { elementMetadata } from './ai-element-tags.js';
import { resolvePointer } from '../studio-v2/core/json.js';
import { fail, shareLayout } from './ai-edits.js';
import { fieldRows, tableOf } from './additional-tables.js';

export const OBSERVATION_CONTEXT_BYTES = 32000;
const fieldList = fieldRows;
const scalar = value => {
  if (typeof value === 'string' && (/data:image\/|blob:/i.test(value) || /^[a-zA-Z0-9+/=]{256,}$/.test(value))) throw fail('OBSERVATION_CONTENT_UNSUPPORTED');
  return ['string','number','boolean'].includes(typeof value) ? value : null;
};
// Read assigned bindings directly; never enumerate arbitrary dataset keys or serialize asset bytes.
export function semanticObservation(project,diagnostics,authorization,selectedTargets = []) {
  const d = project.manifest.studioV3, rows = resolvePointer(project.sampleData,d.collection);
  const sections = [...BLOCKS,...(d.additionalTables || []).map(table=>table.id)];
  const fields = sections.flatMap(section=>fieldList(d,section).map(field=> {
    const kind = fieldKind(field), id = `${section}-${field.id}`, table=tableOf(d,section), scopedRows=table ? resolvePointer(project.sampleData,table.collection) : rows;
    return {id,section,kind,showLabel:field.showLabel !== false,
      ...(field.width === undefined ? {} : {width:field.width}),format:field.format || '',labelStyle:field.labelStyle || {},valueStyle:field.valueStyle || {},...(field.barcode ? {barcode:field.barcode} : {}),
      ...(authorization.text ? {label:scalar(field.label || ''),...(['bound','barcode'].includes(kind) ? {pointer:field.pointer,...(table ? {collection:table.collection} : {})} : kind === 'static' ? {text:scalar(field.text || '')} : {})} : {}),
      ...(authorization.values && ['bound','barcode'].includes(kind) ? {values:field.pointer.startsWith('./') ? (Array.isArray(scopedRows) ? scopedRows : []).map(row=>scalar(resolvePointer(project.sampleData,field.pointer,row))) : [scalar(resolvePointer(project.sampleData,field.pointer))]} : {})};
  }));
  const result = {version:1,disclosure:{text:authorization.text,values:authorization.values,pixels:false},
    selectedTargets:[...new Set(selectedTargets)].filter(id=>elementMetadata(project,id)).map(id=>({id,kind:elementMetadata(project,id).kind})),
    scenario:{id:'active',rowCount:Array.isArray(rows) ? rows.length : 0},
    layout:{page:agentPageSettings(d),style:shareLayout(project),sectionOrder:d.sectionOrder || BLOCKS,sections:sections.map(id=>{const block=d.blocks[id] || tableOf(d,id);return {id,enabled:block.enabled,
      layout:block.layout || {},breakBefore:Boolean(block.breakBefore),keepTogether:Boolean(block.keepTogether),
      ...(authorization.text ? {label:scalar(block.label || '')} : {})};})},fields,diagnostics,
    ...(authorization.text ? {heading:scalar(d.title),collection:d.collection} : {})};
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > OBSERVATION_CONTEXT_BYTES) throw fail('OBSERVATION_CONTEXT_LIMIT');
  return result;
}
