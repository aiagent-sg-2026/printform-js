import { parseProjectHtml, createEmptyProject } from '../studio-v2/core/project-model.js';
import { createStandaloneHtml } from '../studio-v2/core/exporter.js';
import { compileProject, BLOCKS } from './model.js';
import { validPointer, inspectProject } from './validation.js';

const FORMATS = ['', 'currency', 'number', 'percent'];
export function validateDesign(d) {
  if (!d || d.version !== 1 || !['invoice', 'purchase', 'delivery'].includes(d.type)) throw new Error('Unsupported v3 template version or document type.');
  if (typeof d.title !== 'string' || d.title.length > 100) throw new Error('Document heading must contain at most 100 characters.');
  if (!/^#[0-9a-f]{6}$/i.test(d.color) || !Number.isFinite(d.font) || d.font < 6 || d.font > 14 || !Number.isFinite(d.padding) || d.padding < 2 || d.padding > 16) throw new Error('Invalid print style settings.');
  const ids = new Set();
  BLOCKS.forEach(id => {
    if (typeof d.blocks?.[id]?.enabled !== 'boolean' || typeof d.blocks[id].label !== 'string') throw new Error(`Invalid ${id} block.`);
    const fields = id === 'items' ? d.columns : d[id];
    if (!Array.isArray(fields) || fields.length > 30) throw new Error('A block supports at most 30 fields.');
    fields.forEach(f => {
      if (!/^[a-z0-9-]{1,60}$/.test(f.id) || ids.has(`${id}-${f.id}`)) throw new Error('Invalid or duplicate field id.');
      ids.add(`${id}-${f.id}`);
      if (typeof f.label !== 'string' || f.label.length > 100 || !FORMATS.includes(f.format) || (f.text !== undefined && (typeof f.text !== 'string' || f.text.length > 10000))) throw new Error('Invalid field label, text or format.');
      if (f.pointer && !validPointer(f.pointer, id === 'items')) throw new Error('Use /field for document bindings and ./field for item bindings. Wildcards and prototype paths are not supported.');
      if (id === 'items' && (!Number.isFinite(f.width) || f.width < 1 || f.width > 100)) throw new Error('Column width must be between 1 and 100%.');
    });
  });
  if (!validPointer(d.collection)) throw new Error('Collection must be an absolute JSON pointer such as /items.');
  for (const key of ['striped','borders','repeatHeader','repeatTable','pageNumbers','breakBefore']) if (typeof d[key] !== 'boolean') throw new Error(`Invalid ${key} setting.`);
  return d;
}
export function saveProject(project) {
  return JSON.stringify({format:'printform-studio-v3',version:1,project:{manifest:project.manifest,sampleData:project.sampleData,revision:project.revision}}, null, 2);
}
export function readProject(source, name = '') {
  if (new TextEncoder().encode(source).length > 10 * 1024 * 1024) throw new Error('The file exceeds the 10 MB limit.');
  let imported;
  if (/\.html$/i.test(name) || source.trim().startsWith('<')) imported = parseProjectHtml(source);
  else {
    const data = JSON.parse(source);
    if (data.format !== 'printform-studio-v3' || data.version !== 1 || !data.project) throw new Error('Choose a Studio v3 .printform.json file or exported HTML.');
    imported = data.project;
  }
  const design = imported.manifest?.studioV3;
  if (!design) throw new Error('This is a legacy HTML template. Edit it in Studio v2, or start with a v3 template.');
  validateDesign(design);
  const manifest = imported.manifest;
  if (typeof manifest.title !== 'string' || manifest.title.length > 100 || !['en-MY','zh-CN','ms-MY','ja-JP','vi-VN'].includes(manifest.locale) || !['MYR','USD','SGD','EUR','CNY','JPY'].includes(manifest.currency)) throw new Error('Invalid template name, locale or currency.');
  if (!imported.sampleData || Array.isArray(imported.sampleData) || typeof imported.sampleData !== 'object') throw new Error('Sample data must be a JSON object.');
  const base = createEmptyProject();
  base.manifest = {...base.manifest,title:manifest.title,documentId:`v3-${crypto.randomUUID()}`,locale:manifest.locale,currency:manifest.currency};
  base.sampleData = structuredClone(imported.sampleData);
  base.schema = {type:'object',additionalProperties:true};
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
  const quality = inspectProject(project, report);
  if (!quality.ready) throw new Error('Render and resolve the current data or layout errors before exporting.');
  const result = await createStandaloneHtml(project, {validation:{...quality,valid:true,productionValid:true},requireTrusted:true,networkDisabled:true,revision:project.revision});
  return result;
}
