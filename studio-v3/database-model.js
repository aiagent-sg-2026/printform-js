import { compactA5Record } from './compact-a5-demo.js';
import { demoStarterRecords } from './demo-catalog.js';
import { sampleData } from './model.js';
import { assertBoundedJson, parseBoundedJson, unsafeJsonKey } from './json-safety.js';
import { declaredCollectionFields, validateSourceSchema } from './dataset-schema.js';
import { validateImportReceipt } from './structured-import-receipt.js';

export const DATASET_FORMAT = 'printform-studio-v3-dataset';
export const DATA_TYPES = ['invoice', 'purchase', 'delivery'];
export const DATA_GROUPS = [['document','Document'],['company','Company'],['customer','Customer'],['shipTo','Ship to'],['items','Items'],['summary','Totals'],['other','Notes & other'],['json','Advanced JSON']];
export const encodeKey = key => String(key).replaceAll('~','~0').replaceAll('/','~1');
export function pathParts(pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) throw new Error('Use an absolute data path.');
  const parts = pointer.slice(1).split('/').map(k => k.replaceAll('~1','/').replaceAll('~0','~'));
  if (parts.some(unsafeJsonKey)) throw new Error('Unsafe data path.');
  return parts;
}
export function dataValue(data, pointer) {
  return pathParts(pointer).reduce((value,key) => value && Object.hasOwn(value,key) ? value[key] : undefined,data);
}
export function setDataValue(data, pointer, value) {
  const parts = pathParts(pointer), key = parts.pop();
  const parent = parts.reduce((v,k) => {
    if (!v || !Object.hasOwn(v,k) || typeof v[k] !== 'object') throw new Error('The data path is no longer available.');
    return v[k];
  },data);
  parent[key] = value;
}
export function scalarFields(data, prefix = '') {
  const result = [];
  const walk = (value,path,depth) => {
    if (depth > 12 || result.length >= 250) return;
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) return;
      for (const [key,next] of Object.entries(value)) if (!unsafeJsonKey(key)) walk(next,`${path}/${encodeKey(key)}`,depth+1);
    } else result.push({pointer:path,value,type:typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'text'});
  };
  walk(data,prefix,0); return result;
}
export function groupFields(data, group) {
  if (group !== 'other') return scalarFields(data[group],`/${group}`);
  return Object.entries(data).filter(([key]) => !DATA_GROUPS.some(([id]) => id === key)).flatMap(([key,value]) => scalarFields(value,`/${encodeKey(key)}`));
}
export function itemColumns(data, design, schema=null) {
  const result = new Map(), value = dataValue(data,design.collection || '/items'), rows = Array.isArray(value) ? value : [];
  const declared = schema ? declaredCollectionFields(schema,design.collection || '/items') : [];
  for (const field of design.columns) {
    const pointer = field.pointer?.startsWith('./') ? field.pointer.slice(1) : null;
    if (pointer) {
      const types = new Set(rows.map(row=>dataValue(row,pointer)).filter(value=>value !== undefined).map(value=>typeof value));
      const declaredType = declared.find(entry=>entry.pointer === `.${pointer}`)?.type, sourceType = declaredType === 'integer' ? 'number' : declaredType;
      const type = sourceType || (types.size > 1 ? 'mixed' : [...types][0]) || (['number','currency','percent'].includes(field.format) ? 'number' : 'text');
      result.set(pointer,{pointer,label:field.label,type});
    }
  }
  const templatePointers = new Set(result.keys());
  for (const row of rows) for (const field of scalarFields(row)) {
    const previous = result.get(field.pointer);
    if (previous && !templatePointers.has(field.pointer) && previous.type !== field.type) previous.type = 'mixed';
    if (!previous && result.size < 30) result.set(field.pointer,{...field,label:field.pointer.slice(1)});
  }
  return [...result.values()];
}
export function newItem(data, design, types = new Map()) {
  const row = {};
  for (const column of itemColumns(data,design)) {
    column.type = types.get(column.pointer) || column.type;
    const parts = pathParts(column.pointer), key = parts.pop(); let parent = row;
    for (const part of parts) parent = parent[part] ||= {};
    parent[key] = column.pointer === '/no' ? (dataValue(data,design.collection || '/items')?.length || 0)+1 : column.type === 'number' ? 0 : column.type === 'boolean' ? false : '';
  }
  return row;
}
export function validateDataset(data) {
  assertBoundedJson(data);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Dataset must be a JSON object.');
  if (data.document?.currency !== undefined && !['MYR','USD','SGD','EUR','CNY','JPY'].includes(data.document.currency)) throw new Error('Dataset currency is unsupported.');
  if (data.document?.currency && data.summary?.currency && data.summary.currency !== data.document.currency) throw new Error('Document and totals currencies must match.');
  if (!Array.isArray(data.items) || data.items.length > 500) throw new Error('Dataset /items must be an array with at most 500 records.');
  if (data.items.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Each item record must be an object.');
  for (const row of data.items) for (const key of ['no','quantity','rate','amount']) {
    if (Object.hasOwn(row,key) && (typeof row[key] !== 'number' || !Number.isFinite(row[key]))) throw new Error(`/items/${key} requires a finite number.`);
  }
  for (const key of ['subtotal','tax','total']) if (data.summary && Object.hasOwn(data.summary,key) && (typeof data.summary[key] !== 'number' || !Number.isFinite(data.summary[key]))) throw new Error(`/summary/${key} requires a finite number.`);
  return structuredClone(data);
}
export function datasetName(value) {
  if (typeof value !== 'string') throw new Error('Dataset name must be text.');
  const name = value.trim();
  if (!name || name.length > 100) throw new Error('Dataset name must contain 1–100 characters.');
  return name;
}
export const datasetTitleFor = project => datasetName(project.manifest.sampleDataTitle ?? `${project.manifest.title || 'Print form'} · dataset`.slice(0,100));
export function numericPaths(data) {
  const paths = [];
  const walk = (value,path='') => {
    if (value && typeof value === 'object') for (const [key,child] of Object.entries(value)) walk(child,`${path}/${encodeKey(key)}`);
    else if (typeof value === 'number') paths.push(path);
  };
  walk(data);
  return new Set(paths);
}
export function removeRowPaths(paths,index,collection='/items') {
  return new Set([...paths].flatMap(pointer=> {
    if (!pointer.startsWith(`${collection}/`)) return [pointer];
    const [token,...rest] = pointer.slice(collection.length+1).split('/');
    if (!/^\d+$/.test(token)) return [pointer];
    const row = Number(token); return row === index ? [] : [row > index ? `${collection}/${row-1}/${rest.join('/')}` : pointer];
  }));
}
export function datasetRecord(type, data, title, id = crypto.randomUUID()) {
  if (!DATA_TYPES.includes(type)) throw new Error('Unsupported dataset document type.');
  const name = datasetName(title);
  return {id,type,title:name,data:validateDataset(data),origin:'local-demo'};
}
export function starterRecords() {
  return [...DATA_TYPES.map(type => ({...datasetRecord(type,sampleData(type),`${{invoice:'Invoice',purchase:'Purchase order',delivery:'Delivery note'}[type]} · starter`, `starter:${type}`),origin:'builtin-demo'})),...demoStarterRecords(),compactA5Record()];
}
export function exportDataset(record) {
  const sourceSchema = validateSourceSchema(record.sourceSchema,record.data,record.id);
  const localImport = validateImportReceipt(record.localImport,record.data);
  const source = JSON.stringify({format:DATASET_FORMAT,version:1,dataset:{type:record.type,title:record.title,data:record.data,...(sourceSchema ? {id:record.id,sourceSchema} : {}),...(localImport ? {localImport} : {})}},null,2);
  if (localImport) parseBoundedJson(source,{maxDepth:18,label:'Legacy dataset export with original source; use Save form for larger general projects'});
  return source;
}
export function importDataset(source, type) {
  const parsed = parseBoundedJson(source,{maxDepth:18});
  if (parsed && typeof parsed === 'object' && parsed.format === DATASET_FORMAT) {
    if (parsed.version !== 1 || !parsed.dataset) throw new Error('Unsupported dataset file version.');
    if (parsed.dataset.type !== type) throw new Error('Start a matching document template before importing this dataset.');
    if (parsed.dataset.sourceSchema && (typeof parsed.dataset.id !== 'string' || !parsed.dataset.id)) throw new Error('Source schema requires the exported dataset identity.');
    const sourceSchema = validateSourceSchema(parsed.dataset.sourceSchema,parsed.dataset.data,parsed.dataset.id);
    const record = datasetRecord(type,parsed.dataset.data,parsed.dataset.title);
    const localImport = validateImportReceipt(parsed.dataset.localImport,record.data);
    return {...record,origin:'imported-data',...(sourceSchema ? {sourceSchema:{...sourceSchema,datasetId:record.id}} : {}),...(localImport ? {localImport} : {})};
  }
  return {...datasetRecord(type,parsed,'Imported sample'),origin:'imported-data'};
}
export const sameData = (a,b) => JSON.stringify(a) === JSON.stringify(b);

export function datasetMatchesProject(record,project) {
  const type=project.manifest.studioV3.type,kind=project.sampleData.document?.kind,recordKind=record.data.document?.kind;
  if(record.type!==type)return false;
  if(!Array.isArray(dataValue(project.sampleData,project.manifest.studioV3.collection)))return false;
  const profile=project.sampleData.claim?.basisProfile;
  if(profile && record.data.claim?.basisProfile!==profile)return false;
  if(!Array.isArray(dataValue(record.data,project.manifest.studioV3.collection)))return false;
  if(kind)return recordKind===kind;
  return !recordKind || recordKind==={invoice:'SalesInvoice',purchase:'PurchaseOrder',delivery:'DeliveryOrder'}[type];
}
