import { describe, expect, it } from 'vitest';
import { adaptOdooMaintenanceRequest, createOdooMaintenanceRequestProject } from '../studio-v3/odoo-maintenance-request-adapter.js';
import { fictionalOdooMaintenanceRequest } from './fixtures/odoo-maintenance-request.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { designOf, compileProject } from '../studio-v3/model.js';

function changeSnapshot(input, change) {
  const source = JSON.parse(input.snapshotJson); change(source);
  input.snapshotJson = JSON.stringify(source, null, 2); return input;
}
function bind(project) {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  const result = bindTemplate(template, project.sampleData, project.manifest);
  expect(result.report.errors).toEqual([]);
  return { fragment: result.fragment, values: id => [...result.fragment.querySelectorAll(`[data-v3-id="${id}"]`)].map(node => node.textContent) };
}
describe('pinned authorized Odoo maintenance.request Node consumer', () => {
  it('creates editable canonical work with native requested subject and conserves the exact supplied snapshot text', () => {
    const input = fictionalOdooMaintenanceRequest(), before = structuredClone(input), source = JSON.parse(input.snapshotJson);
    const facts = adaptOdooMaintenanceRequest(input), created = createOdooMaintenanceRequestProject(input);
    const project = readProject(saveProject(created)), { values, fragment } = bind(project);
    expect(input).toEqual(before); expect(project.sampleData).toEqual(facts);
    expect(facts.document).toMatchObject({ kind: 'MaintenanceWorkOrder', number: source.document.record.name, date: '2026-10-23' });
    expect(facts.source).toMatchObject({ system: 'Odoo 17.0', id: '417', documentType: 'maintenance.request' });
    expect(facts.company).toEqual({ id: '9', name: 'Fictional Workshop' });
    expect(facts.maintenance.order).toMatchObject({ id: '417', number: source.document.record.name });
    expect(facts.maintenance.asset).toMatchObject({ id: '63', name: source.equipment.record.name, serialNumber: 'F-PUMP-0063', location: 'Fictional bay B' });
    expect(facts.maintenance.tasks).toHaveLength(1);
    expect(facts.maintenance.tasks[0].description).toBe(source.document.record.name);
    expect(facts.maintenance.tasks[0].provenance.sourcePath).toBe('snapshot.document.record.name');
    expect(values('items-description')).toEqual([source.document.record.name]);
    expect(values('items-amount')).toEqual(['']); expect(values('items-direction')).toEqual(['']);
    expect(values('customer-maintenance-status-value')).toEqual([source.stage.record.name]);
    expect(values('header-date')).toEqual([source.document.record.request_date]);
    expect(fragment.querySelector('img,script')).toBeNull();
    expect(fragment.textContent).not.toContain('PRIVATE-NATIVE-HTML');
    expect(fragment.textContent).not.toContain('PRIVATE-NATIVE-INSTRUCTION');
    expect(fragment.textContent).not.toContain('PRIVATE-EQUIPMENT-NOTE');
    expect(fragment.textContent).not.toContain('PRIVATE-COMPANY-FOOTER');
    expect(facts.odooEvidence).toEqual(input);
    expect(readProject(saveProject(created, { omitSource: true })).sampleData.odooEvidence).toEqual(input);
    expect(Buffer.from(project.sampleData.odooEvidence.snapshotJson, 'utf8')).toEqual(Buffer.from(input.snapshotJson, 'utf8'));
    expect(JSON.parse(facts.odooEvidence.snapshotJson)).toEqual(source);
    const design = designOf(project); design.title = 'Human-reviewed requested work';
    expect(readProject(saveProject(compileProject(project, design))).sampleData).toEqual(facts);
    facts.odooEvidence.context.database = 'mutated';
    expect(project.sampleData.odooEvidence.context.database).toBe(input.context.database); expect(input).toEqual(before);
  });
  it('never promotes fold, done, close date, kanban ready or duration into execution, quantity or approval', () => {
    const input = changeSnapshot(fictionalOdooMaintenanceRequest(), source => {
      source.stage.record.fold = true; source.stage.record.done = true;
      Object.assign(source.document.record, { done: true, close_date: '2026-10-24', kanban_state: 'done', duration: 8 });
    });
    const facts = adaptOdooMaintenanceRequest(input);
    expect(facts.maintenance.status.value).toBe('Fictional technician review');
    expect(facts.printRows[0].amount).toBe(''); expect(facts.printRows[0].direction).toBe('');
    for (const key of ['scheduledDate', 'completion', 'approvedBy', 'executed', 'duration']) expect(facts.maintenance).not.toHaveProperty(key);
    for (const key of ['quantity', 'status', 'instruction']) expect(facts.maintenance.tasks[0]).not.toHaveProperty(key);
    expect(JSON.parse(facts.odooEvidence.snapshotJson).document.record.duration).toBe(8);
  });
  it.each(['omit', 'false'])('accepts %s optional fields and shared equipment without guessing status, labels, schedule or instructions', mode => {
    const input = changeSnapshot(fictionalOdooMaintenanceRequest(), source => {
      for (const key of ['stage_id', 'schedule_date', 'description', 'instruction_text', 'close_date', 'duration', 'priority', 'user_id']) {
        if (mode === 'omit') delete source.document.record[key]; else source.document.record[key] = false;
      }
      for (const key of ['serial_no', 'location']) {
        if (mode === 'omit') delete source.equipment.record[key]; else source.equipment.record[key] = false;
      }
      source.equipment.record.company_id = false; delete source.stage;
    });
    const project = createOdooMaintenanceRequestProject(input), facts = project.sampleData;
    expect(facts.maintenance).not.toHaveProperty('status'); expect(facts.maintenance).not.toHaveProperty('scheduledDate');
    expect(facts.maintenance.asset).not.toHaveProperty('serialNumber'); expect(facts.maintenance.asset).not.toHaveProperty('location');
    expect(facts.maintenance.tasks[0]).not.toHaveProperty('quantity'); expect(facts.maintenance.tasks[0]).not.toHaveProperty('instruction');
    expect(bind(project).values('customer-maintenance-status-value')).toEqual([]);
    expect(facts.odooEvidence.snapshotJson).toBe(input.snapshotJson);
  });
  it('does not replace native names with read-tuple display labels or strip requested-subject markup', () => {
    const input = changeSnapshot(fictionalOdooMaintenanceRequest(), source => {
      source.document.record.name = '<svg onload="globalThis.odooHostile=3">Requested <b>inspection</b></svg>';
      source.document.record.company_id[1] = 'A different localized company label';
      source.document.record.equipment_id[1] = 'A display name with serial suffix';
      source.document.record.stage_id[1] = 'A localized display label';
    });
    const project = createOdooMaintenanceRequestProject(input), result = bind(project);
    expect(result.values('items-description')).toEqual([JSON.parse(input.snapshotJson).document.record.name]);
    expect(result.fragment.querySelector('svg,b')).toBeNull();
    expect(project.sampleData.company.name).toBe('Fictional Workshop');
    expect(project.sampleData.maintenance.asset.name).toBe('Fictional circulation pump');
    expect(project.sampleData.maintenance.status.value).toBe('Fictional technician review');
  });
  it.each([
    ['database', s => { s.database = 'another-database'; }, 'snapshot.database'],
    ['missing database', s => { delete s.database; }, 'snapshot.database'],
    ['request identity', s => { s.document.record.id = 418; }, 'snapshot.document.record.id'],
    ['wrong request model', s => { s.document.model = 'mrp.workorder'; }, 'snapshot.document.model'],
    ['missing equipment', s => { delete s.equipment; }, 'snapshot.equipment'],
    ['wrong equipment model', s => { s.equipment.model = 'stock.lot'; }, 'snapshot.equipment.model'],
    ['missing equipment link', s => { s.document.record.equipment_id = false; }, 'snapshot.document.record.equipment_id'],
    ['wrong equipment link', s => { s.document.record.equipment_id[0] = 64; }, 'snapshot.document.record.equipment_id'],
    ['scalar relation', s => { s.document.record.equipment_id = 63; }, 'snapshot.document.record.equipment_id'],
    ['empty display label', s => { s.document.record.equipment_id[1] = ''; }, 'snapshot.document.record.equipment_id[1]'],
    ['wrong company model', s => { s.company.model = 'res.partner'; }, 'snapshot.company.model'],
    ['wrong request company', s => { s.document.record.company_id[0] = 10; }, 'snapshot.document.record.company_id'],
    ['wrong equipment company', s => { s.equipment.record.company_id[0] = 10; }, 'snapshot.equipment.record.company_id'],
    ['missing equipment company', s => { delete s.equipment.record.company_id; }, 'snapshot.equipment.record.company_id'],
    ['missing linked stage', s => { delete s.stage; }, 'snapshot.stage'],
    ['wrong stage model', s => { s.stage.model = 'project.task.type'; }, 'snapshot.stage.model'],
    ['wrong stage ID', s => { s.stage.record.id = 5; }, 'snapshot.document.record.stage_id'],
    ['unlinked stage', s => { s.document.record.stage_id = false; }, 'snapshot.stage'],
    ['missing request date', s => { delete s.document.record.request_date; }, 'snapshot.document.record.request_date'],
    ['unset request date', s => { s.document.record.request_date = false; }, 'snapshot.document.record.request_date'],
    ['impossible date', s => { s.document.record.request_date = '2026-02-29'; }, 'snapshot.document.record.request_date'],
    ['datetime as date', s => { s.document.record.request_date = '2026-10-23 10:00:00'; }, 'snapshot.document.record.request_date'],
    ['missing title', s => { delete s.document.record.name; }, 'snapshot.document.record.name'],
    ['missing asset name', s => { delete s.equipment.record.name; }, 'snapshot.equipment.record.name'],
    ['missing stage name', s => { delete s.stage.record.name; }, 'snapshot.stage.record.name'],
    ['unsafe ID', s => { s.equipment.record.id = Number.MAX_SAFE_INTEGER + 1; }, 'snapshot.equipment.record.id'],
    ['string ID', s => { s.document.record.id = '417'; }, 'snapshot.document.record.id'],
    ['unknown envelope key', s => { s.unrelated = {}; }, 'snapshot.unrelated'],
    ['unknown record-wrapper key', s => { s.document.unrelated = {}; }, 'snapshot.document.unrelated'],
    ['null optional serial', s => { s.equipment.record.serial_no = null; }, 'snapshot.equipment.record.serial_no']
  ])('rejects %s atomically without changing source or existing project', (_, change, path) => {
    const input = fictionalOdooMaintenanceRequest(), prior = createOdooMaintenanceRequestProject(input), saved = structuredClone(prior);
    changeSnapshot(input, change); const before = structuredClone(input);
    for (const consumer of [adaptOdooMaintenanceRequest, createOdooMaintenanceRequestProject]) expect(() => consumer(input)).toThrow(expect.objectContaining({ path }));
    expect(input).toEqual(before); expect(prior).toEqual(saved);
  });
  it.each([
    ['profile', i => { i.profile = 'odoo-auto'; }, 'profile'],
    ['version', i => { i.context.odooVersion = '18.0'; }, 'context.odooVersion'],
    ['revision', i => { i.context.sourceRevision = '17.0'; }, 'context.sourceRevision'],
    ['database identity', i => { i.context.database = 'other-db'; }, 'snapshot.database'],
    ['request identity', i => { i.context.requestId = 999; }, 'snapshot.document.record.id'],
    ['invalid JSON', i => { i.snapshotJson = '{'; }, 'snapshotJson'],
    ['unsafe JSON', i => { i.snapshotJson = '{"__proto__":{}}'; }, 'snapshotJson'],
    ['oversized evidence', i => { i.snapshotJson = 'x'.repeat(2 * 1024 * 1024 + 1); }, null]
  ])('rejects %s at the supported-source boundary', (_, change, path) => {
    const input = fictionalOdooMaintenanceRequest(); change(input); const before = structuredClone(input);
    for (const consumer of [adaptOdooMaintenanceRequest, createOdooMaintenanceRequestProject]) {
      if (path) expect(() => consumer(input)).toThrow(expect.objectContaining({ path })); else expect(() => consumer(input)).toThrow();
    }
    expect(input).toEqual(before);
  });
  it.each([
    ['database identity', '"database":', '"database":"WRONG-FIRST", "database":'],
    ['escaped database identity', '"database":', '"data\\u0062ase":"WRONG-FIRST", "database":'],
    ['request ID', '"id": 417', '"id": 999, "id": 417'],
    ['escaped request ID', '"id": 417', '"i\\u0064": 999, "id": 417'],
    ['native model', '"model": "maintenance.request"', '"model": "mrp.workorder", "model": "maintenance.request"'],
    ['equipment relation', '"equipment_id":', '"equipment_id":[999,"WRONG-FIRST"], "equipment_id":'],
    ['unprinted native field', '"cost": 0', '"cost": 99, "cost": 0'],
    ['identical repeated date', '"request_date": "2026-10-23"', '"request_date": "2026-10-23", "request_date": "2026-10-23"']
  ])('rejects ambiguous %s before native JSON last-key-wins can hide it', (_, needle, duplicate) => {
    const input = fictionalOdooMaintenanceRequest(), original = input.snapshotJson;
    const prior = createOdooMaintenanceRequestProject(input), saved = structuredClone(prior);
    input.snapshotJson = original.replace(needle, duplicate);
    expect(input.snapshotJson).not.toBe(original);
    // Every case looks valid after JSON.parse; validation must inspect the original tokens.
    expect(JSON.parse(input.snapshotJson)).toEqual(JSON.parse(original));
    const before = structuredClone(input);
    for (const consumer of [adaptOdooMaintenanceRequest, createOdooMaintenanceRequestProject]) {
      expect(() => consumer(input)).toThrow(expect.objectContaining({ code: 'BUSINESS_FACTS_SOURCE_JSON', path: 'snapshotJson' }));
    }
    expect(input).toEqual(before); expect(prior).toEqual(saved);
  });
});
