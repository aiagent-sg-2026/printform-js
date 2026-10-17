import { describe, expect, it } from 'vitest';
import { normalizeBusinessDocument, BUSINESS_DOCUMENT_KINDS } from '../studio-v3/business-document-adapter.js';
import { BUSINESS_DEMO_TEMPLATES, businessDemoInput } from '../studio-v3/business-document-demos.js';
import { createBusinessDocumentProject } from '../studio-v3/business-document-project.js';
import { newDemoProject, setupDemoTemplatePicker } from '../studio-v3/demo-templates.js';
import { readProject, saveProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { designOf } from '../studio-v3/model.js';
import { parseChatReply } from '../studio-v3/ai-chat-protocol.js';
import { createDraft } from '../studio-v3/agent-draft.js';

const branches = { ManufacturingOrder: 'manufacturing', Timesheet: 'timesheet' };
const reply = operations => JSON.stringify({ kind: 'proposal', summary: 'Source-bound layout edit', operations });
function consume(kind, input = businessDemoInput(kind)) {
  const before = structuredClone(input), project = readProject(saveProject(createBusinessDocumentProject(input)));
  expect(input).toEqual(before);
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  const bound = bindTemplate(template, project.sampleData, project.manifest);
  expect(bound.report.errors).toEqual([]);
  const values = id => [...bound.fragment.querySelectorAll(`[data-v3-id="${id}"]`)].map(node => node.textContent);
  for (const key of ['no','section','description','amount','direction','trace']) expect(values(`items-${key}`)).toEqual(project.sampleData.printRows.map(row => String(row[key])));
  return { input, project, values };
}
describe('source-bound manufacturing and timesheet starters', () => {
  it.each(Object.keys(branches))('%s routes through the actual New list, starter project, portable Open and bindings', kind => {
    expect(BUSINESS_DOCUMENT_KINDS).toContain(kind);
    expect(BUSINESS_DEMO_TEMPLATES.find(entry => entry.documentKind === kind)).toMatchObject({ status: 'ready', scenarioCount: 1, baseType: 'delivery' });
    document.body.innerHTML = '<dialog id="new-dialog"><div class="template-options"></div></dialog>';
    setupDemoTemplatePicker(); expect(document.querySelector(`[data-demo-template="${kind}"]`)?.disabled).toBe(false);
    const { project, input, values } = consume(kind), starter = newDemoProject(kind), branch = branches[kind];
    expect(starter.sampleData).toEqual(project.sampleData);
    expect(project.sampleData[branch]).toEqual(input[branch]);
    expect(project.sampleData).not.toHaveProperty('items'); expect(project.sampleData).not.toHaveProperty('summary');
    expect(project.sampleData.document).not.toHaveProperty('currency'); expect(project.sampleData.document).not.toHaveProperty('status');
    expect(designOf(project).collection).toBe('/printRows'); expect(designOf(project).totals).toEqual([]);
    expect(values('header-source-id')).toEqual([input.source.id]);
    expect(values(`customer-${branch}-status-value`)).toEqual([input[branch].status.value]);
    expect(JSON.stringify(project.sampleData)).not.toMatch(/"(?:wages|inventoryBalance|approvedBy|certifiedBy|exchangeRate|calculatedHours)"/);
    document.body.replaceChildren();
  });
  it('retains independent order and material/produced quantities, exact status labels and every source trace', () => {
    const input = businessDemoInput('ManufacturingOrder'); input.manufacturing.lines[1].quantity.amount = '+0099.000';
    input.manufacturing.status.value = '待复核 / Work In Progress';
    const { values, project } = consume('ManufacturingOrder', input);
    expect(values('items-amount')).toEqual(['0008.500 Each', '12.500 sheet', '+0099.000 Each']);
    expect(project.sampleData.manufacturing).toEqual(input.manufacturing);
    for (const [i, row] of input.manufacturing.lines.entries()) {
      expect(values('items-direction')[i + 1]).toContain(row.role);
      expect(values('items-trace')[i + 1]).toContain(row.id);
      for (const fact of [row, row.quantity, ...(row.status ? [row.status] : [])]) {
        expect(values('items-trace')[i + 1]).toContain(fact.provenance.sourcePath);
        expect(values('items-trace')[i + 1]).toContain(fact.provenance.meaning);
      }
    }
    expect(values('items-direction')[2]).toContain('Pending review');
    expect(project.sampleData.manufacturing).not.toHaveProperty('remainingQuantity');
  });
  it('retains decimal hours and signed zero without summing hours, inferring projects or deriving wages', () => {
    const { input, project, values } = consume('Timesheet');
    expect(values('items-amount')).toEqual(['0007.500 hour', '-0000.000 hour']);
    expect(project.sampleData.timesheet.entries[1]).not.toHaveProperty('project');
    expect(project.sampleData.timesheet.entries[1]).not.toHaveProperty('task');
    for (const key of ['project','task','status']) {
      expect(values('items-trace')[0]).toContain(input.timesheet.entries[0][key].provenance.sourcePath);
      expect(values('items-trace')[0]).toContain(input.timesheet.entries[0][key].provenance.meaning);
    }
    expect(values('items-description')[0]).toContain(input.timesheet.entries[0].project.id);
    expect(values('items-description')[0]).toContain(input.timesheet.entries[0].task.id);
    expect(values('items-direction')[0]).toBe('Source status: Recorded');
    expect(project.sampleData.timesheet).not.toHaveProperty('totalHours');
  });
  it.each(Object.keys(branches))('%s leaves missing source status absent and isolates output identities from supplied IDs', kind => {
    const input = businessDemoInput(kind), branch = input[branches[kind]]; delete branch.status;
    const entries = branch.lines || branch.entries;
    for (const entry of entries) delete entry.status;
    entries[0].id = kind === 'ManufacturingOrder' ? 'manufacturing:order' : 'timesheet:entry:2';
    const result = normalizeBusinessDocument(input);
    expect(result[branches[kind]]).not.toHaveProperty('status');
    expect(new Set(result.printRows.map(row => row.id)).size).toBe(result.printRows.length);
    expect(result.printRows.map(row => row.trace).join('\n')).toContain(entries[0].id);
  });
  it.each(Object.keys(branches))('%s refuses AI source-context or row substitutions while allowing styling', kind => {
    const project = newDemoProject(kind), before = structuredClone(project);
    const targets = [...designOf(project).customer.map(field => `customer-${field.id}`), ...['section','description','amount','direction','trace'].map(id => `items-${id}`)];
    for (const target of targets) for (const patch of [{ kind: 'static', text: 'Approved and certified' }, { pointer: '/document/number' }, { format: 'number' }]) {
      const operations = [{ type: 'set_field', target, patch }];
      expect(() => parseChatReply(reply(operations), project)).toThrow('UNSAFE_PROPOSAL');
      expect(() => createDraft(project).apply('Substitute source facts', operations)).toThrow('UNSAFE_PROPOSAL');
    }
    project.sampleData.alternateRows = structuredClone(project.sampleData.printRows);
    expect(() => parseChatReply(reply([{ type: 'set_collection', value: '/alternateRows' }]), project, { request: 'Use /alternateRows' })).toThrow('UNSAFE_PROPOSAL');
    delete project.sampleData.alternateRows;
    const candidate = parseChatReply(reply([{ type: 'set_field', target: targets[0], patch: { valueStyle: { bold: true } } }]), project).candidate;
    expect(candidate.sampleData).toEqual(before.sampleData); expect(project).toEqual(before);
  });
});

describe('both canonical industry consumers reject ambiguous and invented facts', () => {
  it.each([
    ['ManufacturingOrder', d => { delete d.manufacturing.order.id; }, 'manufacturing.order.id'],
    ['ManufacturingOrder', d => { delete d.manufacturing.product.provenance; }, 'manufacturing.product.provenance'],
    ['ManufacturingOrder', d => { d.manufacturing.quantity.amount = 8.5; }, 'manufacturing.quantity.amount'],
    ['ManufacturingOrder', d => { d.manufacturing.lines[0].quantity.amount = '-1.000'; }, 'manufacturing.lines[0].quantity.amount'],
    ['ManufacturingOrder', d => { d.manufacturing.lines[0].role = 'inventoryPosted'; }, 'manufacturing.lines[0].role'],
    ['ManufacturingOrder', d => { d.manufacturing.lines[1].id = d.manufacturing.lines[0].id; }, 'manufacturing.lines[1].id'],
    ['ManufacturingOrder', d => { d.manufacturing.lines[0].status = { value: 'Completed' }; }, 'manufacturing.lines[0].status.provenance'],
    ['ManufacturingOrder', d => { d.manufacturing.status = 'Completed'; }, 'manufacturing.status'],
    ['ManufacturingOrder', d => { d.manufacturing.inventoryBalance = '100'; }, 'manufacturing.inventoryBalance'],
    ['ManufacturingOrder', d => { d.manufacturing.lines = []; }, 'manufacturing.lines'],
    ['Timesheet', d => { d.timesheet.entries[0].hours.uom = 'day'; }, 'timesheet.entries[0].hours.uom'],
    ['Timesheet', d => { d.timesheet.entries[0].hours.amount = '7.0001'; }, 'timesheet.entries[0].hours.amount'],
    ['Timesheet', d => { d.timesheet.entries[0].hours.amount = '1e3'; }, 'timesheet.entries[0].hours.amount'],
    ['Timesheet', d => { d.timesheet.entries[0].hours.amount = '-1.000'; }, 'timesheet.entries[0].hours.amount'],
    ['Timesheet', d => { d.timesheet.entries[0].project.provenance = {}; }, 'timesheet.entries[0].project.provenance.sourcePath'],
    ['Timesheet', d => { d.timesheet.entries[0].date = '2026-10-31'; }, 'timesheet.entries[0].date'],
    ['Timesheet', d => { d.timesheet.period.to = '2026-02-30'; }, 'timesheet.period.to'],
    ['Timesheet', d => { d.timesheet.wages = '500'; }, 'timesheet.wages'],
    ['Timesheet', d => { d.timesheet.approvedBy = 'Invented'; }, 'timesheet.approvedBy'],
    ['Timesheet', d => { d.timesheet.employee.provenance.meaning = ''; }, 'timesheet.employee.provenance.meaning'],
    ['Timesheet', d => { d.timesheet.entries[0].status.value = true; }, 'timesheet.entries[0].status.value'],
    ['Timesheet', d => { d.document.currency = 'GBP'; }, 'document.currency'],
    ['Timesheet', d => { d.source.currency = 'GBP'; }, 'source.currency'],
    ['Timesheet', d => { d.document.status = 'Approved'; }, 'document.status'],
    ['Timesheet', d => { d.manufacturing = {}; }, 'manufacturing']
  ])('%s rejects the mutation at %s', (kind, change, path) => {
    const input = businessDemoInput(kind); change(input);
    for (const consumer of [normalizeBusinessDocument, createBusinessDocumentProject]) expect(() => consumer(input)).toThrow(expect.objectContaining({ path }));
  });
  it.each(Object.keys(branches))('%s refuses portable numeric substitution for supplied source text', kind => {
    const payload = JSON.parse(saveProject(newDemoProject(kind))); payload.project.sampleData.printRows[0].amount = 0;
    expect(() => readProject(JSON.stringify(payload))).toThrow('Source schema');
  });
});
