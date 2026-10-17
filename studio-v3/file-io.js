import { parseProjectHtml, createEmptyProject } from '../studio-v2/core/project-model.js';
import { createStandaloneHtml } from '../studio-v2/core/exporter.js';
import { compileProject } from './model.js';
import { datasetName } from './database-model.js';
import { inspectProject } from './validation.js';
import { runtimeSources } from './runtime-assets.js';
import { assertBoundedJson, assertJsonBytes, assertJsonStructure, JSON_PROJECT_LIMITS, parseBoundedJson } from './json-safety.js';
import { validateImportReceipt } from './structured-import-receipt.js';

import { assertProjectSchema } from './dataset-schema.js';
export { validateDesign } from './design-validation.js';
import { validateDesign } from './design-validation.js';

export function saveProject(project) {
  validateImportReceipt(project.manifest.localImport,project.sampleData);
  assertProjectSchema(project);
  return JSON.stringify({format:'printform-studio-v3',version:1,project:{manifest:project.manifest,schema:project.schema,sampleData:project.sampleData,revision:project.revision}}, null, 2);
}
export function readProject(source, name = '') {
  assertJsonBytes(source,JSON_PROJECT_LIMITS);
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
  if (typeof manifest.title !== 'string' || manifest.title.length > 100 || !['en-MY','zh-CN','ms-MY','ja-JP','vi-VN'].includes(manifest.locale) || !['MYR','USD','SGD','EUR','CNY','JPY'].includes(manifest.currency)) throw new Error('Invalid template name, locale or currency.');
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
export async function exportProject(project, report) {
  validateImportReceipt(project.manifest.localImport,project.sampleData);
  const quality = inspectProject(project, report);
  if (!quality.ready) throw new Error('Render and resolve the current data or layout errors before exporting.');
  const result = await createStandaloneHtml(project, {runtimeSources:await runtimeSources(),validation:{...quality,valid:true,productionValid:true},requireTrusted:true,networkDisabled:true,revision:project.revision});
  return result;
}
