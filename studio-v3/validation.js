import { validateProject } from '../studio-v2/core/acceptance.js';
import { resolvePointer } from '../studio-v2/core/json.js';
import { BLOCKS, designOf } from './model.js';

export { validPointer } from './design-authoring.js';
import { validPointer, fieldKind, pageDimensions, pageSettings } from './design-authoring.js';
import { validateDesign } from './design-validation.js';
import { assertProjectSchema, assertCollectionBinding } from './dataset-schema.js';
import { printerStatus } from './paper-settings.js';
import { tableDefinitions } from './additional-tables.js';
import { validateBarcode } from '../studio-v2/core/barcode.js';
import { projectCurrencyIssue } from './currency-catalog.js';

export function bindingValidation(project) {
  const d = designOf(project);
  const errors = [];
  const issue = (code, path, message, component) => errors.push({ code, path, message, component, severity:'error' });
  try { validateDesign(d); } catch (error) {
    issue('INVALID_DESIGN','/manifest/studioV3',error.message,'document');
    return {valid:false,errors,errorCount:errors.length};
  }
  try { assertProjectSchema(project); } catch (error) { issue('SOURCE_SCHEMA_INVALID','/schema',error.message,'document'); }
  const currencyIssue = projectCurrencyIssue(project);
  if (currencyIssue) errors.push(currencyIssue);
  BLOCKS.filter(id => d.blocks[id].enabled).forEach(id => {
    if (id === 'items') return;
    d[id].forEach(f => {
      if (!['bound','barcode'].includes(fieldKind(f))) return;
      const component = `${id}-${f.id}`;
      if (!validPointer(f.pointer)) return issue('INVALID_POINTER', f.pointer, 'Use an absolute JSON pointer such as /customer/name.', component);
      check(resolvePointer(project.sampleData, f.pointer), f, f.pointer, component, issue);
    });
  });
  for (const table of tableDefinitions(d).filter(table=>table.enabled)) {
    const {id,collection,columns} = table;
    const items = validPointer(collection) ? resolvePointer(project.sampleData,collection) : undefined;
    if (!Array.isArray(items)) issue('COLLECTION_NOT_ARRAY',collection,'Collection must be an array in its explicit source scope.',id);
    else if (items.some(row=>!row || typeof row !== 'object' || Array.isArray(row))) issue('ROW_NOT_OBJECT',collection,'Every collection row must be an object.',id);
    else columns.forEach(f => {
      if (!['bound','barcode'].includes(fieldKind(f))) return;
      if (!validPointer(f.pointer,true)) return issue('INVALID_POINTER',f.pointer,'Use a row-relative pointer such as ./description.',`${id}-${f.id}`);
      items.forEach((item,i)=>check(resolvePointer(project.sampleData,f.pointer,item),f,`${collection}/${i}/${f.pointer.slice(2)}`,`${id}-${f.id}`,issue));
    });
    if (!columns.length) issue('COLUMNS_EMPTY',collection,'Add at least one table column.',id);
    const width = columns.reduce((sum,c)=>sum+Number(c.width),0);
    if (width > 100.1 || width <= 0) issue('COLUMN_WIDTHS',collection,'Column widths must total 100% or less.',id);
    try { assertCollectionBinding(project,collection,columns,false); } catch (error) { issue('COLLECTION_SCHEMA_INVALID',collection,error.message,id); }
  }
  return { valid: !errors.length, errors: errors.slice(0, 30), errorCount: errors.length };
}
function check(value, field, path, component, issue) {
  if (value === undefined || value === null) return issue('MISSING_FIELD', path, `No value found for ${path}.`, component);
  if (field.kind === 'barcode') {
    try { validateBarcode(value,field.barcode); } catch (error) { issue('BARCODE_INVALID',path,error.message,component); }
    return;
  }
  if (['currency', 'number', 'percent'].includes(field.format) && (typeof value !== 'number' || !Number.isFinite(value))) issue('NUMBER_REQUIRED', path, 'A numeric format requires a finite ERP number.', component);
  if (typeof value === 'object') issue('SCALAR_REQUIRED', path, 'Bind a text or numeric field, not an object.', component);
}
export function inspectProject(project, rendered = null) {
  const staticReport = validateProject(project);
  const bindings = bindingValidation(project);
  const paper = rendered && !bindings.errors.some(error=>error.code === 'INVALID_DESIGN') ? validatePaperReport(rendered,project) : null;
  const errors = [...staticReport.errors, ...bindings.errors, ...(paper?.validation?.errors || [])];
  const physical = printerStatus(project.manifest.studioV3);
  const warnings = [...staticReport.warnings, ...(rendered?.validation?.warnings || []),{code:'PHYSICAL_PRINTER_UNVERIFIED',message:physical.message,severity:'warning'}];
  const ready = paper?.status === 'ready' && !errors.length;
  return { valid: !errors.length, ready, errors, warnings, physical, metrics: rendered?.metrics || {}, bindingErrors: bindings.errorCount };
}

export function validatePaperReport(report, projectOrDesign = null) {
  const design = projectOrDesign?.manifest?.studioV3 || projectOrDesign;
  const {width,height} = design ? pageDimensions(design) : {width:794,height:1123};
  const page = design ? pageSettings(design) : {paper:'A4',orientation:'portrait'};
  const oversized = (report.pageGeometry || []).filter(p => p.height > height+1 || p.width > width+1);
  if (!oversized.length) return report;
  const prior = (report.validation?.errors || []).filter(e => e.code !== 'PAPER_SIZE_OVERFLOW');
  const errors = oversized.map((p,i) => ({code:'PAPER_SIZE_OVERFLOW',path:`/pages/${p.pageIndex ?? i}`,message:`Page ${(p.pageIndex ?? i)+1} is ${p.width} × ${p.height}px and exceeds ${page.paper} ${page.orientation}. Shorten the oversized content or reduce typography.`,component:'items',severity:'error'}));
  return {...report,status:'blocked',validation:{...report.validation,valid:false,errors:[...prior,...errors]},metrics:{...report.metrics,verticalOverflowPages:oversized.length}};
}
