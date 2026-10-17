import { assertBoundedJson } from './json-safety.js';
import { dataValue, setDataValue } from './database-model.js';
import { projectDescriptor } from './dataset-schema.js';
import { designOf } from './model.js';
import { parseStructuredImport } from './structured-import-parser.js';
import { importParts, convertImportValue, protectedImportPath as protectedPath, declaresSourceProfile } from './structured-import-values.js';
import { bindingValidation } from './validation.js';
import { suppliedPrimaryCurrency } from './currency-catalog.js';

import { tableDefinitions } from './additional-tables.js';
const fail = message => { throw new Error(message); };
export function assertGeneralImportProject(project) {
  if (declaresSourceProfile(project.sampleData)) fail('This form declares a protected source-profile tag. Generic mapping cannot replace tagged source facts or derived print rows. Use the profile-specific source adapter; schema-defined general forms without source-profile tags can use local mapping.');
}
function labelsFor(design) {
  const globals = new Map();
  for (const section of ['header','customer','totals','footer']) for (const field of design[section]) {
    if ((!field.kind || ['bound','barcode'].includes(field.kind)) && field.pointer?.startsWith('/')) globals.set(field.pointer,field.label);
  }
  return globals;
}
export function importTargets(project,targetPointer) {
  assertGeneralImportProject(project);
  const descriptor = projectDescriptor(project), design = designOf(project), labels = labelsFor(design);
  if (targetPointer === '') return descriptor.fields.filter(field=>!protectedPath(field.pointer) && !['/document/kind'].includes(field.pointer)).map(field=>({...field,label:labels.get(field.pointer) || field.pointer,required:false}));
  importParts(targetPointer);
  const collection = descriptor.collections.find(entry=>entry.pointer === targetPointer);
  if (!collection || protectedPath(targetPointer)) fail('Choose an existing unprotected target collection.');
  if (collection.fields.some(field=>protectedPath(field.pointer.slice(1)))) fail('This collection includes protected status or provenance facts and cannot be replaced by generic mapping.');
  const bound = tableDefinitions(design).filter(table=>table.enabled && table.collection === targetPointer).flatMap(table=>table.columns.filter(field=>(!field.kind || ['bound','barcode'].includes(field.kind)) && field.pointer));
  const result = new Map(collection.fields.map(field=>[field.pointer.slice(1),{...field,pointer:field.pointer.slice(1),label:field.pointer,required:field.required}]));
  for (const field of bound) {
    if (!field.pointer.startsWith('./')) fail('The current table has an unsupported row binding.');
    const pointer = field.pointer.slice(1), previous = result.get(pointer);
    importParts(pointer);
    if (protectedPath(pointer)) fail('The table includes a protected business field.');
    result.set(pointer,{...previous,pointer,label:field.label,required:true,type:field.kind === 'barcode' ? 'string' : ['number','currency','percent'].includes(field.format) ? 'number' : previous?.type || 'string'});
  }
  if (result.size > 250) fail('At most 250 target fields are supported.');
  return [...result.values()];
}
export function targetScopes(project) {
  assertGeneralImportProject(project);
  return [{pointer:'',label:'Form fields · one source record only'},...projectDescriptor(project).collections.filter(entry=>!protectedPath(entry.pointer)).map(entry=>({pointer:entry.pointer,label:`${entry.pointer} · replace records (${entry.rows} current)`}))];
}
export function createImportReview(project,text,filename) {
  assertGeneralImportProject(project);
  const source = parseStructuredImport(text,filename), design = designOf(project), scopes = targetScopes(project);
  const targetPointer = design.blocks.items.enabled && scopes.some(scope=>scope.pointer === design.collection) ? design.collection : '';
  const sourceScope = source.scopes.find(scope=>scope.rows.length > 1) || source.scopes[0];
  importTargets(project,targetPointer);
  return {baseProject:project,source,sourcePointer:sourceScope.pointer,targetPointer,mappings:{},preview:null};
}
function assign(row,pointer,value) {
  const parts = importParts(pointer), last = parts.pop(); let parent = row;
  for (const key of parts) {
    if (!Object.hasOwn(parent,key)) parent[key] = {};
    else if (!parent[key] || typeof parent[key] !== 'object' || Array.isArray(parent[key])) fail('Conflicting nested mapping targets.');
    parent = parent[key];
  }
  parent[last] = value;
}
function assertType(value,target) {
  const types = (target.type || '').split('|');
  if (!types.length || types.includes('mixed')) fail(`Target ${target.pointer} has ambiguous types. Repair the form schema before importing.`);
  const type = value === null ? 'null' : typeof value;
  if (!types.includes(type) && !(types.includes('text') && type === 'string') && !(types.includes('integer') && type === 'number' && Number.isInteger(value))) fail(`${target.label} (${target.pointer}) requires ${target.type}; select an explicit conversion. Source spelling is never converted automatically.`);
}
export function previewImport(project,review) {
  if (project !== review.baseProject) fail('The form changed after import review began. Replace the import to review against the current form.');
  const scope = review.source.scopes.find(entry=>entry.pointer === review.sourcePointer);
  if (!scope || !scope.rows.length) fail('Choose a source with 1–500 records.');
  if (!review.targetPointer && scope.rows.length !== 1) fail('Form-field mapping requires exactly one source record. Choose a collection target for multiple records.');
  const targets = importTargets(project,review.targetPointer), targetMap = new Map(targets.map(target=>[target.pointer,target]));
  const mappings = Object.entries(review.mappings).filter(([,mapping])=>mapping.source);
  if (!mappings.length) fail('Map at least one source field before previewing.');
  for (const [pointer,mapping] of mappings) {
    if (!targetMap.has(pointer) || !scope.fields.some(field=>field.pointer === mapping.source)) fail('A mapping no longer belongs to the selected source or target scope.');
    importParts(pointer); importParts(mapping.source);
  }
  if (review.targetPointer) for (const target of targets) {
    if (target.required && !review.mappings[target.pointer]?.source) fail(`Map required target ${target.label} (${target.pointer}); no old row values or generated defaults will be copied.`);
  }
  const mapped = scope.rows.map((row,index)=> {
    const result = {};
    for (const [pointer,mapping] of mappings) {
      try {
        const value = convertImportValue(dataValue(row,mapping.source),mapping.conversion);
        assertType(value,targetMap.get(pointer)); assign(result,pointer,value);
      } catch (error) { fail(`Source record ${index+1}: ${error.message}`); }
    }
    return result;
  });
  const data = structuredClone(project.sampleData);
  if (review.targetPointer) setDataValue(data,review.targetPointer,mapped);
  else for (const [pointer] of mappings) setDataValue(data,pointer,dataValue(mapped[0],pointer));
  assertBoundedJson(data);
  const currency = suppliedPrimaryCurrency(data) ?? project.manifest.currency;
  const candidate = {...project,sampleData:data,manifest:{...project.manifest,currency}}, validation = bindingValidation(candidate);
  if (!validation.valid) fail(validation.errors[0].message);
  return {data,currency,rows:mapped,mappings:mappings.map(([target,mapping])=>({target,...mapping})),sourceRows:scope.rows,targets};
}
