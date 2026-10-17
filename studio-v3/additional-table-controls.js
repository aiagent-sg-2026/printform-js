import { designOf } from './model.js';
import { tableOf, MAX_ADDITIONAL_TABLES } from './additional-tables.js';
import { projectDescriptor, declaredCollectionFields } from './dataset-schema.js';
import { validateDesign } from './design-validation.js';
import { validPointer } from './design-authoring.js';
import { resolvePointer } from '../studio-v2/core/json.js';

function usableFields(project,collection) {
  if (!validPointer(collection.pointer)) return [];
  const rows = resolvePointer(project.sampleData,collection.pointer);
  if (!Array.isArray(rows) || rows.some(row=>row === null || typeof row !== 'object' || Array.isArray(row))) return [];
  const declared = rows.length ? null : declaredCollectionFields(project.schema,collection.pointer);
  return collection.fields.filter(field=>validPointer(field.pointer,true) &&
    field.type.split('|').every(type=>['string','number','integer','boolean','null'].includes(type)) &&
    (rows.length ? rows.every(row=> {
      const value = resolvePointer(project.sampleData,field.pointer,row);
      return value !== undefined && (value === null || typeof value !== 'object');
    }) : declared.some(entry=>entry.pointer === field.pointer))).slice(0,6);
}

export function alterTables(project,selected,action) {
  const design = designOf(project), tables = design.additionalTables || [];
  if (action === 'remove-table') {
    const table = tables.find(table=>selected === table.id || selected === `${table.id}-header` || table.columns.some(field=>selected === `${table.id}-${field.id}`));
    if (!table) throw new Error('Select an additional table to remove. The primary items table is retained.');
    design.additionalTables = tables.filter(entry=>entry.id !== table.id);
    validateDesign(design); return {design,selected:'items'};
  }
  if (action !== 'add-table') throw new Error('Unsupported table action.');
  if (tables.length >= MAX_ADDITIONAL_TABLES) throw new Error('Use at most four additional tables.');
  const used = new Set([design.collection,...tables.map(table=>table.collection)]);
  const source = projectDescriptor(project).collections
    .filter(collection=>!used.has(collection.pointer))
    .map(collection=>({...collection,fields:usableFields(project,collection)}))
    .find(collection=>collection.fields.length);
  if (!source) throw new Error('Supply an unused object-row array with safe scalar fields on every row, or declared schema fields for an empty array, before adding an independent table.');
  const fields = source.fields;
  const id = `table-${crypto.randomUUID().slice(0,8)}`;
  const table = {id,label:'Additional source table',collection:source.pointer,enabled:true,repeatHeader:true,breakBefore:false,columns:fields.map((field,index)=>({id:`column-${index+1}`,label:field.pointer.slice(2),pointer:field.pointer,format:'',width:Math.floor(100/fields.length)}))};
  design.additionalTables = [...tables,table];
  validateDesign(design); return {design,selected:id};
}
export function editAdditionalTable(design,id,values) {
  const table = tableOf(design,id);
  if (!table || id === 'items') throw new Error('Select an additional source table.');
  table.label = String(values.get('label') || '');
  table.collection = String(values.get('collection') || '');
  for (const key of ['enabled','repeatHeader','breakBefore']) table[key] = values.has(key);
  return design;
}
