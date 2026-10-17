import { validateData, validateSchemaProfile } from '../studio-v2/core/schema.js';
import { resolvePointer, encodePointerToken } from '../studio-v2/core/json.js';
import { assertBoundedJson } from './json-safety.js';
import { validateBarcode } from '../studio-v2/core/barcode.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 120;
const scalarType = value => value === null ? 'null' : typeof value;
const childPath = (path,key) => `${path}/${encodePointerToken(key)}`;
const allowsType = (schema,type) => (Array.isArray(schema?.type) ? schema.type : [schema?.type]).includes(type);
const fail = message => { throw new Error(message); };

export function assertSchemaData(schema,data) {
  assertBoundedJson(schema); assertBoundedJson(data);
  const profile = validateSchemaProfile(schema);
  if (!profile.valid) fail(`Invalid source schema: ${profile.errors[0].message}`);
  const result = validateData(schema,data);
  if (!result.valid) fail(`Source schema ${result.errors[0].path}: ${result.errors[0].message}`);
  return schema;
}
export function validateSourceSchema(source,data,datasetId) {
  if (source === undefined || source === null) return null;
  assertBoundedJson(source);
  if (!object(source) || !identity(source.sourceId) || !identity(source.datasetId) || !identity(source.version)) fail('Source schema requires sourceId, datasetId and version identities.');
  if (datasetId !== undefined && source.datasetId !== datasetId) fail('Source schema dataset identity does not match.');
  assertBoundedJson({data,sourceSchema:source},{maxDepth:18});
  assertSchemaData(source.schema,data);
  return structuredClone(source);
}
export function projectSourceSchema(project) {
  const metadata = project.manifest.datasetSchema;
  return metadata ? validateSourceSchema({...metadata,schema:project.schema},project.sampleData) : null;
}
export function assertProjectSchema(project) {
  assertSchemaData(project.schema,project.sampleData);
  projectSourceSchema(project);
}
function declaredFields(schema,path='',required=true,result=[]) {
  if (!schema) return result;
  if (allowsType(schema,'object') || schema.properties) {
    for (const [key,node] of Object.entries(schema.properties || {})) declaredFields(node,childPath(path,key),required && (schema.required || []).includes(key),result);
  } else if (path && !allowsType(schema,'array') && schema.type) result.push({pointer:path,type:Array.isArray(schema.type) ? schema.type.join('|') : schema.type,required,origin:'authoritative'});
  return result;
}
export function declaredCollectionFields(schema,pointer) {
  const node = pointer.slice(1).split('/').reduce((current,token)=> {
    const key = token.replaceAll('~1','/').replaceAll('~0','~');
    if (current?.items && /^(0|[1-9]\d*)$/.test(key)) return current.items;
    return current?.properties && Object.hasOwn(current.properties,key) ? current.properties[key] : undefined;
  },schema);
  return declaredFields(node?.items).map(field=>({...field,pointer:`.${field.pointer}`}));
}
function observedFields(rows,prefix='') {
  const fields = new Map();
  const visit = (value,path,index) => {
    if (Array.isArray(value)) return;
    if (object(value)) for (const [key,next] of Object.entries(value)) visit(next,childPath(path,key),index);
    else if (path) {
      const previous = fields.get(path), type = scalarType(value);
      const entry = previous || {pointer:path,type,origin:'observed',seen:new Set()};
      if (entry.type !== type) entry.type = 'mixed';
      entry.seen.add(index); fields.set(path,entry);
    }
  };
  rows.forEach((row,index)=>visit(row,prefix,index));
  return [...fields.values()].map(({seen,...field})=>({...field,required:seen.size === rows.length}));
}
function mergeFields(declared,observed) {
  const result = new Map(declared.map(field=>[field.pointer,field]));
  for (const field of observed) if (!result.has(field.pointer)) result.set(field.pointer,field);
  return [...result.values()];
}

// Descriptors are a view of the existing schema profile, never an inferred schema.
// Array parents use concrete JSON Pointer indices, so child rows never lose scope.
export function datasetDescriptor(data,schema=null,metadata=null) {
  assertBoundedJson(data);
  if (schema) assertSchemaData(schema,data);
  const collections = [];
  const visit = (value,node,path='',parentScope=null) => {
    if (Array.isArray(value)) {
      const fields = mergeFields(declaredFields(node?.items),observedFields(value)).map(field=>({...field,pointer:`.${field.pointer}`}));
      collections.push({pointer:path,parentScope,origin:allowsType(node,'array') ? 'authoritative' : 'observed',fields,rows:value.length});
      value.forEach((row,index)=>visit(row,node?.items,childPath(path,index),childPath(path,index)));
    } else if (object(value)) {
      const keys = new Set([...Object.keys(value),...Object.keys(node?.properties || {})]);
      for (const key of keys) {
        if (Object.hasOwn(value,key)) visit(value[key],node?.properties?.[key],childPath(path,key),parentScope);
      }
    }
  };
  visit(data,schema);
  return {origin:schema ? 'authoritative' : 'observed',version:metadata?.version ?? null,sourceId:metadata?.sourceId ?? null,
    fields:mergeFields(declaredFields(schema),observedFields([data])),collections};
}
export function projectDescriptor(project) {
  const source = projectSourceSchema(project);
  const schema = source || Object.keys(project.schema?.properties || {}).length ? project.schema : null;
  return datasetDescriptor(project.sampleData,schema,source);
}
export function collectionFields(project,pointer=project.manifest.studioV3.collection) {
  return projectDescriptor(project).collections.find(collection=>collection.pointer === pointer)?.fields || [];
}
export function assertCollectionBinding(project,pointer,columns=project.manifest.studioV3.columns,requireEmptySchema=true) {
  const rows = resolvePointer(project.sampleData,pointer);
  if (!Array.isArray(rows)) fail('Collection must be an array in the selected parent scope.');
  if (rows.some(row=>!object(row))) fail('Every collection row must be an object.');
  const fields = collectionFields(project,pointer);
  for (const column of columns.filter(field=>field.pointer && (!field.kind || ['bound','barcode'].includes(field.kind)))) {
    const declared = fields.find(field=>field.pointer === column.pointer);
    if (requireEmptySchema && !rows.length && !declared) fail(`Empty collection has no explicit schema field ${column.pointer}.`);
    if (declared?.type === 'mixed') fail(`Collection field ${column.pointer} has inconsistent row types.`);
    for (const row of rows) {
      const value = resolvePointer(project.sampleData,column.pointer,row);
      if (value === undefined) fail(`Missing collection field ${column.pointer}.`);
      if (value === null) { if (column.kind === 'barcode') validateBarcode(value,column.barcode); continue; }
      if (typeof value === 'object') fail(`Collection field ${column.pointer} must be scalar.`);
      if (['currency','number','percent'].includes(column.format) && typeof value !== 'number') fail(`Collection field ${column.pointer} requires a number.`);
      if (column.kind === 'barcode') validateBarcode(value,column.barcode);
    }
  }
}
