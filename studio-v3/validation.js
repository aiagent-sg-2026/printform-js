import { validateProject } from '../studio-v2/core/acceptance.js';
import { resolvePointer } from '../studio-v2/core/json.js';
import { BLOCKS, designOf } from './model.js';

export function validPointer(pointer, relative = false) {
  if (typeof pointer !== 'string' || !pointer.startsWith(relative ? './' : '/') || pointer.length > 240) return false;
  return !pointer.includes('*') && !pointer.split('/').some(t => ['__proto__', 'prototype', 'constructor'].includes(t));
}
export function bindingValidation(project) {
  const d = designOf(project);
  const errors = [];
  const issue = (code, path, message, component) => errors.push({ code, path, message, component, severity:'error' });
  BLOCKS.filter(id => d.blocks[id].enabled).forEach(id => {
    if (id === 'items') return;
    d[id].forEach(f => {
      if (!f.pointer) return;
      const component = `${id}-${f.id}`;
      if (!validPointer(f.pointer)) return issue('INVALID_POINTER', f.pointer, 'Use an absolute JSON pointer such as /customer/name.', component);
      check(resolvePointer(project.sampleData, f.pointer), f, f.pointer, component, issue);
    });
  });
  if (d.blocks.items.enabled) {
    const items = validPointer(d.collection) ? resolvePointer(project.sampleData, d.collection) : undefined;
    if (!Array.isArray(items)) issue('COLLECTION_NOT_ARRAY', d.collection, 'Collection must be an array. Use /items, without a wildcard.', 'items');
    else d.columns.forEach(f => {
      if (!validPointer(f.pointer, true)) return issue('INVALID_POINTER', f.pointer, 'Use a row-relative pointer such as ./description.', `items-${f.id}`);
      items.forEach((item, i) => check(resolvePointer(project.sampleData, f.pointer, item), f, `${d.collection}/${i}/${f.pointer.slice(2)}`, `items-${f.id}`, issue));
    });
    if (!d.columns.length) issue('COLUMNS_EMPTY', '/columns', 'Add at least one item column.', 'items');
    const width = d.columns.reduce((sum, c) => sum + Number(c.width), 0);
    if (width > 100.1 || width <= 0) issue('COLUMN_WIDTHS', '/columns', 'Column widths must total 100% or less.', 'items');
  }
  return { valid: !errors.length, errors: errors.slice(0, 30), errorCount: errors.length };
}
function check(value, field, path, component, issue) {
  if (value === undefined || value === null) return issue('MISSING_FIELD', path, `No value found for ${path}.`, component);
  if (['currency', 'number', 'percent'].includes(field.format) && (typeof value !== 'number' || !Number.isFinite(value))) issue('NUMBER_REQUIRED', path, 'A numeric format requires a finite ERP number.', component);
  if (typeof value === 'object') issue('SCALAR_REQUIRED', path, 'Bind a text or numeric field, not an object.', component);
}
export function inspectProject(project, rendered = null) {
  const staticReport = validateProject(project);
  const bindings = bindingValidation(project);
  const errors = [...staticReport.errors, ...bindings.errors, ...(rendered?.validation?.errors || [])];
  const warnings = [...staticReport.warnings, ...(rendered?.validation?.warnings || [])];
  const ready = rendered?.status === 'ready' && !errors.length;
  return { valid: !errors.length, ready, errors, warnings, metrics: rendered?.metrics || {}, bindingErrors: bindings.errorCount };
}

export function validatePaperReport(report) {
  const oversized = (report.pageGeometry || []).filter(p => p.height > 1124 || p.width > 795);
  if (!oversized.length) return report;
  const errors = oversized.map((p,i) => ({code:'PAPER_SIZE_OVERFLOW',path:`/pages/${p.pageIndex ?? i}`,message:`Page ${(p.pageIndex ?? i)+1} is ${p.width} × ${p.height}px and exceeds A4. Shorten the oversized content or reduce typography.`,component:'items',severity:'error'}));
  return {...report,status:'blocked',validation:{...report.validation,valid:false,errors:[...(report.validation?.errors || []),...errors]},metrics:{...report.metrics,verticalOverflowPages:oversized.length}};
}
