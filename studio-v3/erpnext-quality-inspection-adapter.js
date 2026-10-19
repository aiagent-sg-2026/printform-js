import { BUSINESS_DOCUMENT_PROFILE, normalizeBusinessDocument } from './business-document-adapter.js';
import { createBusinessDocumentProject } from './business-document-project.js';
import { text, fail } from './business-facts-validation.js';
import { source, exactFacts, present, trace, ERPNEXT_QUALITY_INSPECTION_VERSION } from './erpnext-quality-inspection-source.js';
export { ERPNEXT_QUALITY_INSPECTION_PROFILE, ERPNEXT_QUALITY_INSPECTION_VERSION, ERPNEXT_QUALITY_INSPECTION_REVISION } from './erpnext-quality-inspection-source.js';

const sourced = (facts, path, meaning) => ({ ...facts, provenance: trace(path, meaning) });
function mappedInspection(input) {
  const { doc, company, item } = source(input), exact = exactFacts(input), checks = [];
  doc.readings.forEach((row, index) => {
    const path = `snapshot.document.readings[${index}]`;
    let expected;
    if (row.formula_based_criteria) {
      if (present(row, 'acceptance_formula')) expected = `Source formula (not evaluated): ${text(row.acceptance_formula, `${path}.acceptance_formula`)}`;
    } else if (!row.numeric) {
      if (present(row, 'value')) expected = text(row.value, `${path}.value`);
    } else {
      const bounds = ['min_value', 'max_value'].map(key => {
        const fact = exact.get(row[key], `${path}.${key}`, true);
        return fact ? `${key}: ${fact.amount} ${fact.uom}` : '';
      }).filter(Boolean);
      if (bounds.length) expected = bounds.join('\n');
    }
    const fields = row.numeric ? Array.from({ length: 10 }, (_, i) => `reading_${i + 1}`) : ['reading_value'];
    let observations = 0;
    for (const field of fields) {
      if (!present(row, field)) continue;
      if (typeof row[field] === 'string' && !row[field].trim()) continue;
      // These are native Data, including numeric readings: no Number(), locale conversion or mean.
      const observed = text(row[field], `${path}.${field}`);
      const check = sourced({ id: `${row.name}:${field}`, characteristic: row.specification, observed }, `${path}.${field}`, `Native ${field} Data spelling; numeric=${row.numeric}, manual_inspection=${row.manual_inspection}. No tolerance, acceptance or average calculated.`);
      if (expected !== undefined) check.expected = expected;
      if (present(row, 'status')) check.result = row.status;
      const measure = exact.get(row[field], `${path}.${field}`);
      if (measure) check.measure = measure;
      checks.push(check); observations++;
    }
    if (!observations) fail('SOURCE_OBSERVATION', path, 'Supply at least one observation in the active native reading branch; criteria and status cannot stand in for an observation.');
  });
  exact.finish();
  const subject = { id: item.name, name: item.item_name };
  for (const [native, target] of [['batch_no', 'lot'], ['item_serial_no', 'serialNumber']]) if (present(doc, native)) subject[target] = text(doc[native], `snapshot.document.${native}`);
  const inspection = {
    reference: sourced({ id: doc.reference_name, number: doc.reference_name }, 'snapshot.document.reference_type/reference_name -> snapshot.reference.doctype/name', `Explicit ${doc.reference_type} inspection basis; not the inspection record itself or a generated transaction.`),
    subject: sourced(subject, 'snapshot.document.item_code/item_name/batch_no/item_serial_no -> snapshot.item', 'Exact linked item and supplied tracking labels; no sample quantity, UOM or serial parsing inferred.'), checks
  };
  if (present(doc, 'status')) inspection.status = sourced({ value: doc.status }, 'snapshot.document.status/docstatus', `Source label with docstatus=${doc.docstatus}; not local acceptance, approval or certification.`);
  const canonical = { profile: BUSINESS_DOCUMENT_PROFILE,
    source: { system: `ERPNext ${ERPNEXT_QUALITY_INSPECTION_VERSION}`, documentType: doc.doctype, id: doc.name, number: doc.name },
    document: { kind: 'InspectionReport', number: doc.name, date: doc.report_date },
    company: { id: company.name, name: company.company_name }, inspection,
    notes: 'Read-only Quality Inspection snapshot. Numeric reading_1..10 and qualitative reading_value are original Data text. Native Float limits/sample_size are not printed without authorized exact decimal, precision and UOM facts. No calculation, formula evaluation, calibration, acceptance, approval, compliance or ERP connection. Raw snapshot remains embedded unprinted live data, including in share copies; review privacy before sharing.' };
  return { canonical, evidence: structuredClone(input) };
}
export function adaptErpNextQualityInspection(input) {
  const { canonical, evidence } = mappedInspection(input);
  return { ...normalizeBusinessDocument(canonical), erpnextEvidence: evidence };
}
export function createErpNextQualityInspectionProject(input) {
  const { canonical, evidence } = mappedInspection(input), project = createBusinessDocumentProject(canonical);
  project.sampleData.erpnextEvidence = evidence;
  return project;
}
