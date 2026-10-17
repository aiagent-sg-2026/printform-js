import { parseProjectHtml, createEmptyProject } from '../studio-v2/core/project-model.js';
import { createStandaloneHtml } from '../studio-v2/core/exporter.js';
import { compileProject } from './model.js';
import { datasetName } from './database-model.js';
import { inspectProject } from './validation.js';
import { runtimeSources } from './runtime-assets.js';
import { assertBoundedJson, assertJsonBytes, assertJsonStructure, JSON_PROJECT_LIMITS, parseBoundedJson } from './json-safety.js';
import { validateImportReceipt } from './structured-import-receipt.js';
import { isSupportedCurrency } from './currency-catalog.js';
import { tableDefinitions } from './additional-tables.js';
import { validateBarcode } from '../studio-v2/core/barcode.js';
import { resolvePointer } from '../studio-v2/core/json.js';

import { assertProjectSchema, assertCollectionBinding } from './dataset-schema.js';
export { validateDesign } from './design-validation.js';
import { validateDesign } from './design-validation.js';

// Only the downloaded copy loses the receipt. Live data, bindings and assets remain.
export function projectForSharing(project) {
  const copy = structuredClone(project);
  delete copy.manifest.localImport;
  delete copy.studioV3Session;
  return copy;
}
export function saveProject(project,{omitSource=false}={}) {
  project = omitSource ? projectForSharing(project) : project;
  validateImportReceipt(project.manifest.localImport,project.sampleData);
  assertProjectSchema(project);
  const envelope = {format:'printform-studio-v3',version:1,project:{manifest:project.manifest,schema:project.schema,sampleData:project.sampleData,revision:project.revision}};
  // Validate serialized JSON: compiler metadata may contain omitted undefined properties.
  const content = JSON.stringify(envelope,null,2);
  parseBoundedJson(content,JSON_PROJECT_LIMITS);
  return content;
}
export function readProject(source, name = '') {
  assertJsonBytes(source,JSON_PROJECT_LIMITS);
  source = source.replace(/^\uFEFF/,'');
  let imported;
  if (/\.html$/i.test(name) || source.trim().startsWith('<')) {
    imported = parseProjectHtml(source);
    assertJsonStructure(imported,JSON_PROJECT_LIMITS);
  } else {
    const data = parseBoundedJson(source,JSON_PROJECT_LIMITS);
    if (!data || data.format !== 'printform-studio-v3' || data.version !== 1 || !data.project || typeof data.project !== 'object' || Array.isArray(data.project)) throw new Error('Choose a Studio v3 .printform.json file or exported HTML.');
    imported = data.project;
  }
  const design = imported.manifest?.studioV3;
  if (!design) throw new Error('This is a legacy HTML template. Edit it in Studio v2, or start with a v3 template.');
  validateDesign(design);
  const manifest = imported.manifest;
  if (typeof manifest.title !== 'string' || manifest.title.length > 100 || !['en-MY','zh-CN','ms-MY','ja-JP','vi-VN'].includes(manifest.locale) || !isSupportedCurrency(manifest.currency)) throw new Error('Invalid template name, locale or currency.');
  if (!imported.sampleData || Array.isArray(imported.sampleData) || typeof imported.sampleData !== 'object') throw new Error('Sample data must be a JSON object.');
  assertBoundedJson(imported.sampleData);
  const base = createEmptyProject();
  base.manifest = {...base.manifest,title:manifest.title,documentId:`v3-${crypto.randomUUID()}`,locale:manifest.locale,currency:manifest.currency};
  if (manifest.sampleDataTitle !== undefined) base.manifest.sampleDataTitle = datasetName(manifest.sampleDataTitle);
  base.sampleData = structuredClone(imported.sampleData);
  base.schema = structuredClone(imported.schema ?? {type:'object',additionalProperties:true});
  if (manifest.datasetSchema !== undefined) base.manifest.datasetSchema = structuredClone(manifest.datasetSchema);
  const localImport = validateImportReceipt(manifest.localImport,base.sampleData);
  if (localImport) base.manifest.localImport = localImport;
  for (const table of tableDefinitions(design).filter(table=>table.enabled)) {
    if (table.id !== 'items' || table.columns.some(field=>field.kind === 'barcode')) assertCollectionBinding(base,table.collection,table.columns,false);
  }
  for (const section of ['header','customer','totals','footer']) {
    if (design.blocks[section].enabled) for (const field of design[section]) {
      if (field.kind === 'barcode') validateBarcode(resolvePointer(base.sampleData,field.pointer),field.barcode);
    }
  }
  assertProjectSchema(base);
  base.revision = Number.isInteger(imported.revision) && imported.revision >= 0 ? imported.revision : 0;
  return compileProject(base, design);
}
export function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export const filenameFor = project => (project.manifest.title || 'printform').replace(/[^\p{L}\p{N} -]/gu, '').trim().replace(/\s+/g, '-').slice(0,80) || 'printform';
export async function exportProject(project, report,{omitSource=false}={}) {
  project = omitSource ? projectForSharing(project) : project;
  validateImportReceipt(project.manifest.localImport,project.sampleData);
  const quality = inspectProject(project, report);
  if (!quality.ready) throw new Error('Render and resolve the current data or layout errors before exporting.');
  const result = await createStandaloneHtml(project, {runtimeSources:await runtimeSources(),validation:{...quality,valid:true,productionValid:true},requireTrusted:true,networkDisabled:true,revision:project.revision});
  return result;
}
