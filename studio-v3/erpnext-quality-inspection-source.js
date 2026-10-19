import { safe, object, text, date, rows, has, choice, quantity, fail } from './business-facts-validation.js';
import { parseLosslessRecords } from './structured-import-parser.js';
import { parseBoundedJson } from './json-safety.js';

export const ERPNEXT_QUALITY_INSPECTION_PROFILE = 'erpnext-quality-inspection-v15.0.0-read-v1';
export const ERPNEXT_QUALITY_INSPECTION_VERSION = '15.0.0';
export const ERPNEXT_QUALITY_INSPECTION_REVISION = '0925cb28c7ab93b7900dd8f37527482d30b21785';
export const trace = (sourcePath, meaning) => ({ sourcePath, meaning });
export const present = (value, key) => has(value, key) && value[key] !== null && value[key] !== '';
export function flag(value, path) { return choice(value, [0, 1], path); }
export function nativeStatus(value, path) { return choice(value, ['Accepted', 'Rejected'], path); }
function same(actual, expected, path) {
  if (actual !== expected) fail('SOURCE_IDENTITY', path, 'Supply the exact linked native identity, not a display label or inferred relation.');
}
export function child(row, index, parent, type, field, path) {
  object(row, path); text(row.name, `${path}.name`);
  for (const [key, value] of Object.entries({ doctype: type, parent: parent.name, parenttype: parent.doctype, parentfield: field, idx: index + 1 })) same(row[key], value, `${path}.${key}`);
}
export function source(input) {
  safe(input); object(input, 'input', ['profile', 'context', 'snapshotJson', 'exact']);
  if (input.profile !== ERPNEXT_QUALITY_INSPECTION_PROFILE) fail('SOURCE_PROFILE', 'profile', 'Supply the fixed ERPNext Quality Inspection profile.');
  const context = object(input.context, 'context', ['erpnextVersion', 'sourceRevision', 'site', 'inspectionName', 'referenceRowName']);
  if (context.erpnextVersion !== ERPNEXT_QUALITY_INSPECTION_VERSION) fail('SOURCE_PROFILE', 'context.erpnextVersion', 'Only the pinned v15.0.0 contract is supported.');
  if (context.sourceRevision !== ERPNEXT_QUALITY_INSPECTION_REVISION) fail('SOURCE_PROFILE', 'context.sourceRevision', 'Supply the immutable official revision.');
  for (const key of ['site', 'inspectionName']) text(context[key], `context.${key}`);
  text(input.snapshotJson, 'snapshotJson');
  let snapshot;
  try {
    // Decoded duplicate/unsafe keys must fail before JSON.parse erases their evidence.
    parseLosslessRecords(input.snapshotJson);
    snapshot = parseBoundedJson(input.snapshotJson);
  } catch { fail('SOURCE_JSON', 'snapshotJson', 'Supply bounded native JSON without duplicate or unsafe keys.'); }
  safe(snapshot); object(snapshot, 'snapshot', ['site', 'document', 'reference', 'company', 'item']);
  same(snapshot.site, context.site, 'snapshot.site');
  const doc = object(snapshot.document, 'snapshot.document');
  same(doc.doctype, 'Quality Inspection', 'snapshot.document.doctype');
  same(doc.name, context.inspectionName, 'snapshot.document.name');
  if (typeof doc.sample_size !== 'number' || !Number.isFinite(doc.sample_size)) fail('SOURCE_VALUE', 'snapshot.document.sample_size', 'Supply native Float sample_size; it remains raw unprinted evidence, not an inferred item count.');
  date(doc.report_date, 'snapshot.document.report_date'); choice(doc.docstatus, [0, 1, 2], 'snapshot.document.docstatus');
  choice(doc.inspection_type, ['Incoming', 'Outgoing', 'In Process'], 'snapshot.document.inspection_type');
  text(doc.inspected_by, 'snapshot.document.inspected_by'); flag(doc.manual_inspection, 'snapshot.document.manual_inspection');
  if (present(doc, 'status')) nativeStatus(doc.status, 'snapshot.document.status');
  const reference = object(snapshot.reference, 'snapshot.reference');
  choice(doc.reference_type, ['Purchase Receipt', 'Purchase Invoice', 'Subcontracting Receipt', 'Delivery Note', 'Sales Invoice', 'Stock Entry', 'Job Card'], 'snapshot.document.reference_type');
  text(doc.reference_name, 'snapshot.document.reference_name'); text(doc.item_code, 'snapshot.document.item_code');
  same(reference.doctype, doc.reference_type, 'snapshot.reference.doctype'); same(reference.name, doc.reference_name, 'snapshot.reference.name');
  choice(reference.docstatus, [0, 1, 2], 'snapshot.reference.docstatus');
  const company = object(snapshot.company, 'snapshot.company'), item = object(snapshot.item, 'snapshot.item');
  same(company.doctype, 'Company', 'snapshot.company.doctype'); text(company.name, 'snapshot.company.name'); text(company.company_name, 'snapshot.company.company_name');
  same(reference.company, company.name, 'snapshot.reference.company');
  same(item.doctype, 'Item', 'snapshot.item.doctype'); same(item.name, doc.item_code, 'snapshot.item.name');
  text(item.item_name, 'snapshot.item.item_name'); same(doc.item_name, item.item_name, 'snapshot.document.item_name');
  if (present(reference, 'quality_inspection')) same(reference.quality_inspection, doc.name, 'snapshot.reference.quality_inspection');
  if (reference.doctype === 'Job Card') {
    if (has(context, 'referenceRowName')) fail('SOURCE_IDENTITY', 'context.referenceRowName', 'Job Card links the production item directly, not an invented items row.');
    same(reference.production_item, doc.item_code, 'snapshot.reference.production_item');
  } else {
    text(context.referenceRowName, 'context.referenceRowName');
    const seen = new Set();
    const linked = rows(reference.items, 'snapshot.reference.items', true).filter((row, index) => {
      const path = `snapshot.reference.items[${index}]`;
      child(row, index, reference, reference.doctype === 'Stock Entry' ? 'Stock Entry Detail' : `${reference.doctype} Item`, 'items', path);
      if (seen.has(row.name)) fail('SOURCE_IDENTITY', `${path}.name`, 'Duplicate reference child identity.');
      seen.add(row.name); return row.name === context.referenceRowName;
    });
    if (linked.length !== 1) fail('SOURCE_IDENTITY', 'context.referenceRowName', 'Supply one exact linked reference child.');
    same(linked[0].item_code, doc.item_code, 'snapshot.reference.items.item_code');
    if (present(doc, 'batch_no')) same(linked[0].batch_no, doc.batch_no, 'snapshot.reference.items.batch_no');
    if (present(linked[0], 'quality_inspection')) same(linked[0].quality_inspection, doc.name, 'snapshot.reference.items.quality_inspection');
  }
  const seen = new Set();
  rows(doc.readings, 'snapshot.document.readings', true).forEach((row, index) => {
    const path = `snapshot.document.readings[${index}]`; child(row, index, doc, 'Quality Inspection Reading', 'readings', path);
    if (seen.has(row.name)) fail('SOURCE_IDENTITY', `${path}.name`, 'Duplicate inspection reading identity.');
    seen.add(row.name); text(row.specification, `${path}.specification`);
    for (const key of ['numeric', 'manual_inspection', 'formula_based_criteria']) flag(row[key], `${path}.${key}`);
    if (present(row, 'status')) nativeStatus(row.status, `${path}.status`);
    if (doc.docstatus === 1 && !present(row, 'status')) fail('SOURCE_STATUS', `${path}.status`, 'The pinned controller requires reading status before submission.');
    for (const key of ['min_value', 'max_value']) if (present(row, key) && (typeof row[key] !== 'number' || !Number.isFinite(row[key]))) fail('SOURCE_VALUE', `${path}.${key}`, 'Native criteria are Float; only authorized exact overlays may print their decimals, precision and UOM.');
  });
  return { doc, company, item };
}

export function exactFacts(input) {
  const exact = has(input, 'exact') ? object(input.exact, 'exact') : {}, used = new Set();
  return {
    get(native, key, numeric = false) {
      if (!has(exact, key)) return undefined;
      const fact = quantity(exact[key], `exact.${key}`);
      if (numeric ? typeof native !== 'number' || !Number.isFinite(native) || Number(fact.amount.replaceAll(',', '')) !== native : fact.amount !== native) fail('SOURCE_VALUE', key, 'Authorized exact measurement must agree with the native value; Data fields retain their original spelling.');
      used.add(key); return fact;
    },
    finish() { for (const key of Object.keys(exact)) if (!used.has(key)) fail('SOURCE_FIELD', `exact.${key}`, 'Unused exact fact; sample size, inactive criteria and unrelated values remain unprinted raw evidence.'); }
  };
}
