import { describe, expect, it } from 'vitest';
import { adaptErpNextQualityInspection, createErpNextQualityInspectionProject } from '../studio-v3/erpnext-quality-inspection-adapter.js';
import { fictionalErpNextQualityInspection, changeQualitySnapshot, qualityInspectionRaw } from './fixtures/erpnext-quality-inspection.js';
import { saveProject, readProject, projectForSharing } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { compileProject, designOf } from '../studio-v3/model.js';

const base = 'snapshot.document.readings[1]';
const bind = project => {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  const result = bindTemplate(template, project.sampleData, project.manifest);
  expect(result.report.errors).toEqual([]); return result.fragment;
};
const mutate = fn => input => changeQualitySnapshot(input, fn);

describe('immutable ERPNext Quality Inspection optional Node source', () => {
  it('preserves qualitative and all populated numeric Data lexemes through real canonical binding and project IO', () => {
    const input = fictionalErpNextQualityInspection(), before = structuredClone(input);
    const facts = adaptErpNextQualityInspection(input), project = readProject(saveProject(createErpNextQualityInspectionProject(input)));
    expect(input).toEqual(before); expect(project.sampleData).toEqual(facts);
    expect(facts.document).toEqual({ kind: 'InspectionReport', number: 'F-QI-2026-001', date: '2026-10-19' });
    expect(facts.inspection.reference.id).toBe('F-PR-2026-019'); expect(facts.source.id).toBe('F-QI-2026-001');
    expect(facts.inspection.subject).toMatchObject({ id: 'F-BRACKET', lot: '000-LOT-F', serialNumber: '000-SERIAL-F' });
    expect(facts.inspection.checks.map(row => row.observed)).toEqual(['Visible source scratch <not markup>', '-0000.1250', '+0000.0000', '1.234,50', '  0.1000  ', 'C']);
    expect(facts.inspection.checks[1].measure).toEqual(input.exact[`${base}.reading_1`]);
    expect(facts.inspection.checks[2].measure.amount).toBe('+0000.0000');
    expect(facts.inspection.checks[3]).not.toHaveProperty('measure');
    expect(facts.inspection.checks[1].expected).toBe('min_value: -0000.2000 mm\nmax_value: +0000.2000 mm');
    // Deliberately contradictory manual source labels must not be recomputed from the criteria.
    expect(facts.inspection.checks[0]).toMatchObject({ observed: 'Visible source scratch <not markup>', expected: 'Smooth', result: 'Accepted' });
    expect(facts.inspection.checks[5]).toMatchObject({ observed: 'C', expected: "Source formula (not evaluated): reading_value in ('A', 'B')", result: 'Accepted' });
    expect(facts.inspection.status.value).toBe('Rejected');
    const fragment = bind(project);
    expect([...fragment.querySelectorAll('[data-v3-id=items-amount]')].map(node => node.textContent)).toEqual(facts.printRows.map(row => row.amount));
    expect(fragment.textContent).not.toContain('UNPRINTED-RAW-QI'); expect(fragment.textContent).not.toContain('UNPRINTED-VERIFIER-F');
    expect(fragment.querySelector('script,not')).toBeNull();
    expect(facts.erpnextEvidence.snapshotJson).toBe(qualityInspectionRaw());
    expect(readProject(saveProject(compileProject(project, designOf(project)))).sampleData).toEqual(facts);
    for (const key of ['approval', 'compliance', 'mean', 'average', 'tolerance', 'acceptedQuantity', 'sampleSize']) expect(facts).not.toHaveProperty(key);
  });
  it('keeps native Float criteria and sample_size raw without inventing precision, measurement UOM or status', () => {
    const input = fictionalErpNextQualityInspection(); delete input.exact;
    changeQualitySnapshot(input, snapshot => {
      snapshot.document.docstatus = 0; delete snapshot.document.status;
      for (const row of snapshot.document.readings) delete row.status;
      snapshot.document.readings[1].reading_3 = '9007199254740993123.000000000001';
    });
    const facts = adaptErpNextQualityInspection(input);
    expect(facts.inspection).not.toHaveProperty('status');
    for (const row of facts.inspection.checks) { expect(row).not.toHaveProperty('measure'); expect(row).not.toHaveProperty('result'); }
    expect(facts.inspection.checks[1]).not.toHaveProperty('expected');
    expect(facts.inspection.checks[3].observed).toBe('9007199254740993123.000000000001');
    expect(JSON.parse(facts.erpnextEvidence.snapshotJson).document.sample_size).toBe(2.5);
    expect(facts.printRows.every(row => row.amount === '')).toBe(true);
  });
  it('retains byte-identical unprinted raw evidence in ordinary and share saves without aliasing caller data', () => {
    const input = fictionalErpNextQualityInspection(), project = createErpNextQualityInspectionProject(input);
    for (const saved of [saveProject(project), saveProject(project, { omitSource: true }), saveProject(projectForSharing(project))]) {
      const reopened = readProject(saved); expect(reopened.sampleData.erpnextEvidence).toEqual(input);
      expect(new TextEncoder().encode(reopened.sampleData.erpnextEvidence.snapshotJson)).toEqual(new TextEncoder().encode(input.snapshotJson));
    }
    input.exact[`${base}.reading_1`].amount = '999';
    expect(project.sampleData.erpnextEvidence.exact[`${base}.reading_1`].amount).toBe('-0000.1250');
  });
  it.each(['Purchase Receipt', 'Purchase Invoice', 'Subcontracting Receipt', 'Delivery Note', 'Sales Invoice', 'Stock Entry', 'Job Card'])('honors exact native %s reference identity', type => {
    const input = fictionalErpNextQualityInspection();
    changeQualitySnapshot(input, snapshot => {
      snapshot.document.reference_type = type; snapshot.reference.doctype = type;
      if (type === 'Job Card') { snapshot.reference.production_item = snapshot.document.item_code; delete snapshot.reference.items; }
      else { const row = snapshot.reference.items[0]; row.parenttype = type; row.doctype = type === 'Stock Entry' ? 'Stock Entry Detail' : `${type} Item`; }
    });
    if (type === 'Job Card') delete input.context.referenceRowName;
    expect(adaptErpNextQualityInspection(input).inspection.reference.provenance.meaning).toContain(type);
  });
  it.each([0, 1, 2])('keeps supplied status separate from lifecycle docstatus=%s', status => {
    const input = fictionalErpNextQualityInspection(); changeQualitySnapshot(input, snapshot => { snapshot.document.docstatus = status; });
    expect(adaptErpNextQualityInspection(input).inspection.status.value).toBe('Rejected');
  });
  const bad = [
    ['profile', input => { input.profile = 'auto-erpnext'; }],
    ['version', input => { input.context.erpnextVersion = '15.1.0'; }],
    ['revision', input => { input.context.sourceRevision = 'v15.0.0'; }],
    ['selected site', input => { input.context.site = 'other.invalid'; }],
    ['selected inspection', input => { input.context.inspectionName = 'F-OTHER'; }],
    ['selected reference row', input => { input.context.referenceRowName = 'F-OTHER'; }],
    ['doctype', mutate(s => { s.document.doctype = 'Inspection'; })],
    ['date', mutate(s => { s.document.report_date = '2026-02-30'; })],
    ['company relation', mutate(s => { s.reference.company = 'OTHER'; })],
    ['reference identity', mutate(s => { s.reference.name = 'OTHER'; })],
    ['reference type', mutate(s => { s.reference.doctype = 'Sales Invoice'; })],
    ['reference item relation', mutate(s => { s.reference.items[0].item_code = 'OTHER'; })],
    ['reference batch relation', mutate(s => { s.reference.items[0].batch_no = 'OTHER'; })],
    ['reference inspection link', mutate(s => { s.reference.items[0].quality_inspection = 'OTHER'; })],
    ['item identity', mutate(s => { s.item.name = 'OTHER'; })],
    ['fetched item name', mutate(s => { s.document.item_name = 'Invented label'; })],
    ['child parent', mutate(s => { s.document.readings[1].parent = 'OTHER'; })],
    ['child type', mutate(s => { s.document.readings[1].doctype = 'Other Reading'; })],
    ['child table', mutate(s => { s.document.readings[1].parentfield = 'items'; })],
    ['child index', mutate(s => { s.document.readings[1].idx = 1; })],
    ['child duplicate', mutate(s => { s.document.readings[1].name = s.document.readings[0].name; })],
    ['reference duplicate', mutate(s => { const row = structuredClone(s.reference.items[0]); row.idx = 2; s.reference.items.push(row); })],
    ['numeric flag', mutate(s => { s.document.readings[1].numeric = '1'; })],
    ['formula flag', mutate(s => { s.document.readings[1].formula_based_criteria = true; })],
    ['missing submitted reading status', mutate(s => { delete s.document.readings[1].status; })],
    ['invented result', mutate(s => { s.document.readings[0].status = 'Certified'; })],
    ['numeric Data as JSON number', mutate(s => { s.document.readings[1].reading_1 = -0.125; })],
    ['Float as invented decimal string', mutate(s => { s.document.readings[1].min_value = '-0.2'; })],
    ['sample Float as text', mutate(s => { s.document.sample_size = '2.5'; })],
    ['no active observation', mutate(s => { delete s.document.readings[0].reading_value; s.document.readings[0].reading_1 = 'Not the active branch'; })],
    ['no readings', mutate(s => { s.document.readings = []; })],
    ['missing exact UOM', input => { delete input.exact[`${base}.reading_1`].uom; }],
    ['missing exact provenance', input => { delete input.exact[`${base}.min_value`].provenance; }],
    ['invented precision', input => { input.exact[`${base}.reading_1`].decimalPlaces = 2; }],
    ['rounded observation overlay', input => { input.exact[`${base}.reading_1`].amount = '-0.1250'; }],
    ['contradictory Float overlay', input => { input.exact[`${base}.min_value`].amount = '-0.3000'; }],
    ['unused sample overlay', input => { input.exact['snapshot.document.sample_size'] = structuredClone(input.exact[`${base}.reading_1`]); }]
  ];
  it.each(bad)('atomically refuses %s without changing any input or prior project', (_, change) => {
    const input = fictionalErpNextQualityInspection(), prior = createErpNextQualityInspectionProject(input), old = structuredClone(prior);
    change(input); const before = structuredClone(input);
    for (const consume of [adaptErpNextQualityInspection, createErpNextQualityInspectionProject]) expect(() => consume(input)).toThrow();
    expect(input).toEqual(before); expect(prior).toEqual(old);
  });
  it.each([
    raw => raw.replace('"numeric": 1', '"numeric": 0, "numeric": 1'),
    raw => raw.replace('"name": "F-QI-2026-001"', '"name": "wrong", "na\\u006de": "F-QI-2026-001"'),
    raw => raw.replace('"site":', '"__proto__": {}, "site":'),
    raw => raw.replace('"site":', '"constr\\u0075ctor": {}, "site":'),
    raw => raw.replace('"site":', '"nested": {"x": 0, "x": 1}, "site":'),
    raw => raw + ' trailing'
  ])('rejects duplicate/escaped/unsafe tokens before native typed parsing', change => {
    const input = fictionalErpNextQualityInspection(); input.snapshotJson = change(input.snapshotJson);
    expect(() => createErpNextQualityInspectionProject(input)).toThrow(expect.objectContaining({ code: 'BUSINESS_FACTS_SOURCE_JSON', path: 'snapshotJson' }));
  });
  it('rejects bounded-source overflows rather than truncating evidence', () => {
    const input = fictionalErpNextQualityInspection(); input.snapshotJson += ' '.repeat(2 * 1024 * 1024);
    expect(() => createErpNextQualityInspectionProject(input)).toThrow();
  });
});
