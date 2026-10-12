import { BLOCKS } from './model.js';
import { fieldKind, pageSettings } from './design-authoring.js';
import { elementMetadata } from './ai-element-tags.js';
import { resolvePointer } from '../studio-v2/core/json.js';
import { fail, shareLayout } from './ai-edits.js';

export const OBSERVATION_CONTEXT_BYTES = 32000;
const fieldList = (design,section) => section === 'items' ? design.columns : design[section];
const scalar = value => {
  if (typeof value === 'string' && (/data:image\/|blob:/i.test(value) || /^[a-zA-Z0-9+/=]{256,}$/.test(value))) throw fail('OBSERVATION_CONTENT_UNSUPPORTED');
  return ['string','number','boolean'].includes(typeof value) ? value : null;
};
// Read assigned bindings directly; never enumerate arbitrary dataset keys or serialize asset bytes.
export function semanticObservation(project,diagnostics,authorization,selectedTargets = []) {
  const d = project.manifest.studioV3, rows = resolvePointer(project.sampleData,d.collection);
  const fields = BLOCKS.flatMap(section=>fieldList(d,section).map(field=> {
    const kind = fieldKind(field), id = `${section}-${field.id}`;
    return {id,section,kind,showLabel:field.showLabel !== false,
      ...(field.width === undefined ? {} : {width:field.width}),format:field.format || '',labelStyle:field.labelStyle || {},valueStyle:field.valueStyle || {},
      ...(authorization.text ? {label:scalar(field.label || ''),...(kind === 'bound' ? {pointer:field.pointer} : kind === 'static' ? {text:scalar(field.text || '')} : {})} : {}),
      ...(authorization.values && kind === 'bound' ? {values:field.pointer.startsWith('./') ? (Array.isArray(rows) ? rows : []).map(row=>scalar(resolvePointer(project.sampleData,field.pointer,row))) : [scalar(resolvePointer(project.sampleData,field.pointer))]} : {})};
  }));
  const result = {version:1,disclosure:{text:authorization.text,values:authorization.values,pixels:false},
    selectedTargets:[...new Set(selectedTargets)].filter(id=>elementMetadata(project,id)).map(id=>({id,kind:elementMetadata(project,id).kind})),
    scenario:{id:'active',rowCount:Array.isArray(rows) ? rows.length : 0},
    layout:{page:pageSettings(d),style:shareLayout(project),sectionOrder:d.sectionOrder || BLOCKS,sections:BLOCKS.map(id=>({id,enabled:d.blocks[id].enabled,
      layout:d.blocks[id].layout || {},breakBefore:Boolean(d.blocks[id].breakBefore),keepTogether:Boolean(d.blocks[id].keepTogether),
      ...(authorization.text ? {label:scalar(d.blocks[id].label || '')} : {})}))},fields,diagnostics,
    ...(authorization.text ? {heading:scalar(d.title),collection:d.collection} : {})};
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > OBSERVATION_CONTEXT_BYTES) throw fail('OBSERVATION_CONTEXT_LIMIT');
  return result;
}
