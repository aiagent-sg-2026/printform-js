import { BUSINESS_DOCUMENT_PROFILE, normalizeBusinessDocument } from './business-document-adapter.js';
import { createBusinessDocumentProject } from './business-document-project.js';
import { safe, object, text, date, rows, has, choice, provenance, quantity, fail } from './business-facts-validation.js';

export const ERPNEXT_MATERIAL_REQUEST_PROFILE = 'erpnext-material-request-v15.0.0-exact-v1';
export const ERPNEXT_MATERIAL_REQUEST_VERSION = '15.0.0';
const trace = (sourcePath, meaning) => ({ sourcePath, meaning });
const sourced = (facts, path, meaning) => ({ ...facts, provenance: trace(path, meaning) });

// Read-only Purchase snapshots. Native Float JSON alone cannot supply exact decimal spelling/precision.
function mappedRequest(input) {
  safe(input); object(input, 'input', ['profile', 'context', 'document', 'exact']);
  if (input.profile !== ERPNEXT_MATERIAL_REQUEST_PROFILE) fail('SOURCE_PROFILE', 'profile', `Supply ${ERPNEXT_MATERIAL_REQUEST_PROFILE}.`);
  object(input.context, 'context', ['erpnextVersion', 'company']);
  if (input.context.erpnextVersion !== ERPNEXT_MATERIAL_REQUEST_VERSION) fail('SOURCE_PROFILE', 'context.erpnextVersion', 'Only the pinned native v15.0.0 contract is supported.');
  const doc = object(input.document, 'document');
  if (doc.doctype !== 'Material Request') fail('SOURCE_TYPE', 'document.doctype', 'Expected native Material Request.');
  if (doc.material_request_type !== 'Purchase') fail('SOURCE_PURPOSE', 'document.material_request_type', 'Only explicit Purchase purpose maps to PurchaseRequisition.');
  text(doc.name, 'document.name'); text(doc.company, 'document.company'); date(doc.transaction_date, 'document.transaction_date');
  choice(doc.docstatus, [0, 1, 2], 'document.docstatus');
  const statuses = doc.docstatus === 0 ? ['Draft'] : doc.docstatus === 2 ? ['Cancelled'] : ['Submitted', 'Pending', 'Partially Ordered', 'Ordered', 'Stopped', 'Partially Received', 'Received'];
  choice(doc.status, statuses, 'document.status');
  const company = object(input.context.company, 'context.company', ['doctype', 'name', 'company_name']);
  if (company.doctype !== 'Company' || company.name !== doc.company) fail('SOURCE_IDENTITY', 'context.company', 'Supply the exact linked native Company identity.');
  text(company.company_name, 'context.company.company_name');
  object(input.exact, 'exact');
  const used = new Set(), identities = new Set();
  const lines = rows(doc.items, 'document.items', true).map((row, index) => {
    const path = `document.items[${index}]`; object(row, path);
    text(row.name, `${path}.name`);
    if (identities.has(row.name)) fail('SOURCE_IDENTITY', `${path}.name`, 'Duplicate native child identity.');
    identities.add(row.name);
    for (const [key, value] of [['doctype', 'Material Request Item'], ['parent', doc.name], ['parenttype', 'Material Request'], ['parentfield', 'items']]) {
      if (row[key] !== value) fail('SOURCE_IDENTITY', `${path}.${key}`, 'Child must identify its native parent and items table.');
    }
    for (const key of ['item_code', 'item_name', 'description', 'uom']) text(row[key], `${path}.${key}`);
    date(row.schedule_date, `${path}.schedule_date`);
    const key = `${path}.qty`, fact = object(input.exact[key], `exact.${key}`, ['amount', 'decimalPlaces', 'provenance']);
    provenance(fact.provenance, `exact.${key}.provenance`);
    const parsed = quantity({ ...fact, uom: row.uom }, `exact.${key}`);
    if (typeof row.qty !== 'number' || !Number.isFinite(row.qty) || Number(parsed.amount.replaceAll(',', '')) !== row.qty) fail('SOURCE_VALUE', key, 'Supply native numeric qty plus a consistent authorized exact decimal/precision export.');
    used.add(key);
    const result = { id: row.name, item: { id: row.item_code, code: row.item_code, name: row.item_name }, description: row.description,
      requiredBy: row.schedule_date,
      quantity: { ...parsed, provenance: trace(key, `ERPNext v15.0.0 requested qty in ${path}.uom; exact export ${fact.provenance.sourcePath}: ${fact.provenance.meaning}`) },
      provenance: trace(`${path}.name/item_code/item_name/description/schedule_date`, 'Exact native request child facts, not purchase order, receipt or approval.') };
    for (const [native, target] of [['warehouse', 'destination'], ['project', 'project']]) if (has(row, native) && row[native] !== null && row[native] !== '') {
      result[target] = sourced({ id: text(row[native], `${path}.${native}`) }, `${path}.${native}`, 'Native linked identity only; no label or fulfillment is inferred.');
    }
    return result;
  });
  for (const key of Object.keys(input.exact)) if (!used.has(key)) fail('SOURCE_FIELD', `exact.${key}`, 'Unused exact fact; this adapter maps requested qty only, never stock, ordered, received or monetary quantities.');
  const requisition = {
    request: sourced({ id: doc.name, number: doc.name }, 'document.doctype/name', 'Native Material Request identity; read-only supplied snapshot.'),
    purpose: sourced({ value: doc.material_request_type }, 'document.material_request_type', 'Explicit native Purchase purpose; no purpose inference.'),
    status: sourced({ value: doc.status }, 'document.status/docstatus', `Native status with supplied docstatus=${doc.docstatus}; not an approval or procurement assertion.`), lines
  };
  if (has(doc, 'schedule_date') && doc.schedule_date !== null && doc.schedule_date !== '') requisition.requiredBy = date(doc.schedule_date, 'document.schedule_date');
  const canonical = { profile: BUSINESS_DOCUMENT_PROFILE,
    source: { system: 'ERPNext 15.0.0', documentType: doc.doctype, id: doc.name, number: doc.name },
    document: { kind: 'PurchaseRequisition', number: doc.name, date: doc.transaction_date },
    company: { id: company.name, name: company.company_name }, requisition,
    notes: 'Read-only Purchase Material Request snapshot. Only requested qty is mapped; raw stock, ordered, received, conversion, pricing and other fields remain unprinted evidence. No inferred requester, approval, purchase execution, stock movement or accounting.' };
  const evidence = { version: ERPNEXT_MATERIAL_REQUEST_VERSION, document: structuredClone(doc), company: structuredClone(company), exact: structuredClone(input.exact) };
  return { canonical, evidence };
}

export function adaptErpNextMaterialRequest(input) {
  const { canonical, evidence } = mappedRequest(input);
  return { ...normalizeBusinessDocument(canonical), erpnextEvidence: evidence };
}
export function createErpNextMaterialRequestProject(input) {
  const { canonical, evidence } = mappedRequest(input), project = createBusinessDocumentProject(canonical);
  project.sampleData.erpnextEvidence = evidence;
  return project;
}
