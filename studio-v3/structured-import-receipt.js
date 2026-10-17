import { assertBoundedJson, assertJsonBytes } from './json-safety.js';
import { parseStructuredImport } from './structured-import-parser.js';
import { importParts, importValue, convertImportValue, IMPORT_CONVERSIONS, protectedImportPath, declaresSourceProfile } from './structured-import-values.js';

const fail = message => { throw new Error(`Invalid local import receipt: ${message}`); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value,keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key=>Object.hasOwn(value,key));
export function validateImportReceipt(receipt,data=undefined) {
  if (receipt === undefined || receipt === null) return null;
  assertBoundedJson(receipt,{maxBytes:3*1024*1024,maxDepth:18,label:'Local import receipt'});
  if (declaresSourceProfile(data)) fail('source-profile-tagged forms cannot carry a generic import receipt.');
  if (!exactKeys(receipt,['version','format','filename','sourceText','sourcePointer','targetPointer','mappings']) || receipt.version !== 1 || !['csv','json'].includes(receipt.format)) fail('unsupported format.');
  if (typeof receipt.filename !== 'string' || !receipt.filename || receipt.filename.length > 240 || /[\u0000-\u001f]/.test(receipt.filename)) fail('filename must be bounded plain text.');
  assertJsonBytes(receipt.sourceText,{label:'Local source file'});
  for (const pointer of [receipt.sourcePointer,receipt.targetPointer]) if (pointer !== '') importParts(pointer);
  if (receipt.targetPointer && protectedImportPath(receipt.targetPointer)) fail('protected target scope.');
  if (!Array.isArray(receipt.mappings) || !receipt.mappings.length || receipt.mappings.length > 250) fail('supply 1–250 mappings.');
  // The saved format, not a misleading filename suffix, selects the parser.
  const parsed = parseStructuredImport(receipt.sourceText,`local.${receipt.format}`), scope = parsed.scopes.find(entry=>entry.pointer === receipt.sourcePointer);
  if (!scope || !scope.rows.length) fail('source scope is unavailable or empty.');
  if (!receipt.targetPointer && scope.rows.length !== 1) fail('form fields require one source record.');
  const used = new Set();
  for (const mapping of receipt.mappings) {
    if (!exactKeys(mapping,['target','source','conversion']) || !IMPORT_CONVERSIONS.includes(mapping.conversion)) fail('unsupported mapping.');
    importParts(mapping.target); importParts(mapping.source);
    if (protectedImportPath(mapping.target) || !receipt.targetPointer && mapping.target === '/document/kind') fail('protected mapping target.');
    if (used.has(mapping.target) || !scope.fields.some(field=>field.pointer === mapping.source)) fail('duplicate target or unavailable source field.');
    used.add(mapping.target);
  }
  const actual = data === undefined ? undefined : receipt.targetPointer ? importValue(data,receipt.targetPointer) : [data];
  if (actual !== undefined && (!Array.isArray(actual) || actual.length !== scope.rows.length)) fail('mapped record count no longer matches the source.');
  if (data !== undefined && actual === undefined) fail('target collection is unavailable.');
  scope.rows.forEach((row,index)=> {
    for (const mapping of receipt.mappings) {
      const expected = convertImportValue(importValue(row,mapping.source),mapping.conversion);
      if (data !== undefined && !Object.is(importValue(actual[index],mapping.target),expected)) fail(`mapped target ${mapping.target} no longer matches source record ${index+1}.`);
    }
  });
  return structuredClone(receipt);
}
export function importReceipt(review,preview) {
  return validateImportReceipt({version:1,format:review.source.format,filename:review.source.filename,sourceText:review.source.text,
    sourcePointer:review.sourcePointer,targetPointer:review.targetPointer,mappings:preview.mappings},preview.data);
}
