import { BUSINESS_DOCUMENT_PROFILE, normalizeBusinessDocument } from './business-document-adapter.js';
import { createBusinessDocumentProject } from './business-document-project.js';
import { safe, object, text, date, has, fail } from './business-facts-validation.js';
import { parseBoundedJson } from './json-safety.js';
import { parseLosslessRecords } from './structured-import-parser.js';

export const ODOO_MAINTENANCE_REQUEST_PROFILE = 'odoo-maintenance-request-17.0-read-v1';
export const ODOO_MAINTENANCE_REQUEST_VERSION = '17.0';
export const ODOO_MAINTENANCE_REQUEST_REVISION = '355ff1d2eda010766b87d4bf403794382ceaec7a';
const trace = (sourcePath, meaning) => ({ sourcePath, meaning });
const sourced = (facts, path, meaning) => ({ ...facts, provenance: trace(path, meaning) });
function id(value, path) {
  if (!Number.isSafeInteger(value) || value <= 0) fail('SOURCE_IDENTITY', path, 'Supply a positive safe-integer native record ID.');
  return value;
}
function record(value, model, path) {
  object(value, path, ['model', 'record']);
  if (value.model !== model) fail('SOURCE_TYPE', `${path}.model`, `Expected ${model}.`);
  const result = object(value.record, `${path}.record`);
  id(result.id, `${path}.record.id`);
  return result;
}
function relation(value, path) {
  if (!Array.isArray(value) || value.length !== 2) fail('SOURCE_IDENTITY', path, 'Supply the native read many2one [id, display_name] tuple.');
  id(value[0], `${path}[0]`); text(value[1], `${path}[1]`);
  return value[0];
}
function linked(value, nativeId, path) {
  if (relation(value, path) !== nativeId) fail('SOURCE_IDENTITY', path, 'Linked record ID does not match the supplied native record.');
}
function optionalText(source, native, target, result, path) {
  if (!has(source, native) || source[native] === false || source[native] === '') return;
  result[target] = text(source[native], `${path}.${native}`);
}
function mappedRequest(input) {
  safe(input); object(input, 'input', ['profile', 'context', 'snapshotJson']);
  if (input.profile !== ODOO_MAINTENANCE_REQUEST_PROFILE) fail('SOURCE_PROFILE', 'profile', `Supply ${ODOO_MAINTENANCE_REQUEST_PROFILE}.`);
  const context = object(input.context, 'context', ['odooVersion', 'sourceRevision', 'database', 'requestId']);
  if (context.odooVersion !== ODOO_MAINTENANCE_REQUEST_VERSION) fail('SOURCE_PROFILE', 'context.odooVersion', 'Only the pinned 17.0 contract is supported.');
  if (context.sourceRevision !== ODOO_MAINTENANCE_REQUEST_REVISION) fail('SOURCE_PROFILE', 'context.sourceRevision', 'Supply the exact pinned official source revision.');
  text(context.database, 'context.database'); id(context.requestId, 'context.requestId');
  text(input.snapshotJson, 'snapshotJson');
  let snapshot;
  try {
    // Validate decoded keys before typed parsing can erase duplicate source identities.
    parseLosslessRecords(input.snapshotJson);
    snapshot = parseBoundedJson(input.snapshotJson);
  } catch { fail('SOURCE_JSON', 'snapshotJson', 'Supply bounded valid native JSON without duplicate or unsafe keys.'); }
  safe(snapshot); object(snapshot, 'snapshot', ['database', 'document', 'equipment', 'company', 'stage']);
  if (text(snapshot.database, 'snapshot.database') !== context.database) fail('SOURCE_IDENTITY', 'snapshot.database', 'Snapshot database must match the explicitly selected source identity.');
  const doc = record(snapshot.document, 'maintenance.request', 'snapshot.document');
  const equipment = record(snapshot.equipment, 'maintenance.equipment', 'snapshot.equipment');
  const company = record(snapshot.company, 'res.company', 'snapshot.company');
  if (doc.id !== context.requestId) fail('SOURCE_IDENTITY', 'snapshot.document.record.id', 'Request ID must match the explicitly selected source identity.');
  text(doc.name, 'snapshot.document.record.name'); date(doc.request_date, 'snapshot.document.record.request_date');
  text(equipment.name, 'snapshot.equipment.record.name'); text(company.name, 'snapshot.company.record.name');
  linked(doc.equipment_id, equipment.id, 'snapshot.document.record.equipment_id');
  linked(doc.company_id, company.id, 'snapshot.document.record.company_id');
  // Odoo permits company-less shared equipment; absent company_id is not evidence of sharing.
  if (equipment.company_id !== false) linked(equipment.company_id, company.id, 'snapshot.equipment.record.company_id');
  let stage;
  if (has(doc, 'stage_id') && doc.stage_id !== false) {
    stage = record(snapshot.stage, 'maintenance.stage', 'snapshot.stage');
    linked(doc.stage_id, stage.id, 'snapshot.document.record.stage_id');
    text(stage.name, 'snapshot.stage.record.name');
  } else if (has(snapshot, 'stage')) fail('SOURCE_IDENTITY', 'snapshot.stage', 'Do not supply an unlinked stage.');
  const asset = { id: String(equipment.id), name: equipment.name };
  optionalText(equipment, 'serial_no', 'serialNumber', asset, 'snapshot.equipment.record');
  optionalText(equipment, 'location', 'location', asset, 'snapshot.equipment.record');
  const maintenance = {
    order: sourced({ id: String(doc.id), number: doc.name }, 'snapshot.document.record.id/name', 'Native request ID and subject; subject is not a separate work-order sequence.'),
    asset: sourced(asset, 'snapshot.equipment.record.id/name/serial_no/location', 'Exact linked equipment fields; read tuple display labels are not used as names.'),
    tasks: [{ id: String(doc.id), description: doc.name,
      provenance: trace('snapshot.document.record.name', 'Requested-task subject only; not an executed operation or completion record.') }]
  };
  if (stage) maintenance.status = sourced({ value: stage.name }, 'snapshot.document.record.stage_id -> snapshot.stage.record.id/name', 'Supplied native stage name only; fold, done, kanban state and close date do not establish execution or approval.');
  const canonical = { profile: BUSINESS_DOCUMENT_PROFILE,
    source: { system: 'Odoo 17.0', documentType: 'maintenance.request', id: String(doc.id), number: doc.name },
    document: { kind: 'MaintenanceWorkOrder', number: doc.name, date: doc.request_date },
    company: { id: String(company.id), name: company.name }, maintenance,
    notes: 'Read-only maintenance.request snapshot. Document date is native request_date, not creation or scheduled time. Subject is requested work, not execution. No inferred quantity, approval, completion, timezone, HTML-to-text instruction or generated work-order number. Raw native evidence remains embedded but unprinted; review privacy before sharing project or exported HTML.' };
  // Keep original text, including whitespace and unprinted fields, not a reconstructed JSON export.
  return { canonical, evidence: structuredClone(input) };
}
export function adaptOdooMaintenanceRequest(input) {
  const { canonical, evidence } = mappedRequest(input);
  return { ...normalizeBusinessDocument(canonical), odooEvidence: evidence };
}
export function createOdooMaintenanceRequestProject(input) {
  const { canonical, evidence } = mappedRequest(input), project = createBusinessDocumentProject(canonical);
  project.sampleData.odooEvidence = evidence;
  return project;
}
