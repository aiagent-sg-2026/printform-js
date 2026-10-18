import { describe, expect, it } from 'vitest';
import { normalizeBusinessDocument } from '../studio-v3/business-document-adapter.js';
import { createBusinessDocumentProject } from '../studio-v3/business-document-project.js';
import { businessDemoInput } from '../studio-v3/business-document-demos.js';
import { newDemoProject, setupDemoTemplatePicker } from '../studio-v3/demo-templates.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { compileProject, designOf } from '../studio-v3/model.js';

const kinds = { PurchaseRequisition: 'requisition', MaintenanceWorkOrder: 'maintenance' };
function consume(input) {
  const before = structuredClone(input), project = readProject(saveProject(createBusinessDocumentProject(input)));
  expect(input).toEqual(before);
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  const bound = bindTemplate(template, project.sampleData, project.manifest);
  expect(bound.report.errors).toEqual([]);
  const values = id => [...bound.fragment.querySelectorAll(`[data-v3-id="${id}"]`)].map(node => node.textContent);
  for (const key of ['no', 'section', 'description', 'amount', 'direction', 'trace']) expect(values(`items-${key}`)).toEqual(project.sampleData.printRows.map(row => String(row[key])));
  return { project, values };
}

describe('general supplied requisition and maintenance consumers', () => {
  it.each(Object.entries(kinds))('%s is selectable through New and produces a genuinely editable portable project', (kind, branch) => {
    document.body.innerHTML = '<dialog id="new-dialog"><div class="template-options"></div></dialog>';
    setupDemoTemplatePicker(); expect(document.querySelector(`[data-demo-template="${kind}"]`)?.disabled).toBe(false);
    const input = businessDemoInput(kind), { project, values } = consume(input);
    expect(newDemoProject(kind).sampleData).toEqual(project.sampleData);
    expect(project.sampleData[branch]).toEqual(input[branch]);
    expect(values(`customer-${branch}-status-value`)).toEqual([input[branch].status.value]);
    expect(designOf(project).collection).toBe('/printRows'); expect(designOf(project).totals).toEqual([]);
    const design = designOf(project); design.title = 'Human edited title';
    const edited = readProject(saveProject(compileProject(project, design)));
    expect(designOf(edited).title).toBe('Human edited title'); expect(edited.sampleData).toEqual(project.sampleData);
    for (const key of ['items', 'summary', 'approval', 'accounting', 'inventory']) expect(project.sampleData).not.toHaveProperty(key);
    expect(project.sampleData.document).not.toHaveProperty('currency'); document.body.replaceChildren();
  });
  it('conserves exact requested quantities, independent required dates and destination/project identities', () => {
    const input = businessDemoInput('PurchaseRequisition'), row = input.requisition.lines[0];
    row.project = { id: 'PROJECT-000', name: 'Supplied project', provenance: { sourcePath: 'source/project', meaning: 'Explicit project link' } };
    input.requisition.requiredBy = '2026-10-26';
    const { project, values } = consume(input);
    expect(values('items-amount')).toEqual(['0008.500 Each', '-0000.000 kit']);
    expect(values('items-description')[0]).toContain(row.destination.id); expect(values('items-description')[0]).toContain(row.project.id);
    expect(values('items-description')[0]).toContain('2026-10-24'); expect(values('customer-requisition-required-by')).toEqual(['2026-10-26']);
    expect(values('items-trace')[0]).toContain('source/project: Explicit project link');
    expect(project.sampleData.requisition).not.toHaveProperty('purchaseOrder');
  });
  it('preserves absent task quantities/status, supplied instructions, serial strings and signed-zero without execution inference', () => {
    const input = businessDemoInput('MaintenanceWorkOrder'); input.maintenance.tasks[1].quantity.amount = '-0000.000';
    input.maintenance.scheduledDate = '2026-10-31'; delete input.maintenance.status;
    const { project, values } = consume(input);
    expect(values('items-amount')).toEqual(['', '-0000.000 Each']);
    expect(values('customer-maintenance-asset-serial-number')).toEqual(['F-PUMP-0001']);
    expect(values('customer-maintenance-scheduled-date')).toEqual(['2026-10-31']);
    expect(values('items-description')[0]).toContain(input.maintenance.tasks[0].instruction);
    expect(project.sampleData.maintenance.tasks[0]).not.toHaveProperty('quantity');
    expect(project.sampleData.maintenance.tasks[1]).not.toHaveProperty('status');
    expect(project.sampleData.maintenance).not.toHaveProperty('status');
    expect(project.sampleData.maintenance).not.toHaveProperty('completedDate');
  });
  it.each([
    ['PurchaseRequisition', d => { delete d.requisition.purpose; }, 'requisition.purpose'],
    ['PurchaseRequisition', d => { d.requisition.purpose.value = 'Material Transfer'; }, 'requisition.purpose.value'],
    ['PurchaseRequisition', d => { d.requisition.lines[1].quantity.amount = 0; }, 'requisition.lines[1].quantity.amount'],
    ['PurchaseRequisition', d => { d.requisition.lines[1].quantity.amount = '-1.000'; }, 'requisition.lines[1].quantity.amount'],
    ['PurchaseRequisition', d => { d.requisition.lines[1].quantity.amount = '0.0001'; }, 'requisition.lines[1].quantity.amount'],
    ['PurchaseRequisition', d => { d.requisition.lines[1].id = d.requisition.lines[0].id; }, 'requisition.lines[1].id'],
    ['PurchaseRequisition', d => { d.requisition.lines[1].requiredBy = '2026-02-30'; }, 'requisition.lines[1].requiredBy'],
    ['PurchaseRequisition', d => { d.requisition.approvedBy = 'Invented approver'; }, 'requisition.approvedBy'],
    ['MaintenanceWorkOrder', d => { d.maintenance.asset.provenance = {}; }, 'maintenance.asset.provenance.sourcePath'],
    ['MaintenanceWorkOrder', d => { d.maintenance.tasks[1].quantity.amount = '1e3'; }, 'maintenance.tasks[1].quantity.amount'],
    ['MaintenanceWorkOrder', d => { d.maintenance.tasks[1].status = { value: 'Executed' }; }, 'maintenance.tasks[1].status.provenance'],
    ['MaintenanceWorkOrder', d => { d.maintenance.tasks[1].executed = true; }, 'maintenance.tasks[1].executed'],
    ['MaintenanceWorkOrder', d => { d.maintenance.tasks = []; }, 'maintenance.tasks'],
    ['MaintenanceWorkOrder', d => { d.document.currency = 'SGD'; }, 'document.currency'],
    ['MaintenanceWorkOrder', d => { d.document.status = 'Approved'; }, 'document.status']
  ])('%s rejects invalid or invented later facts atomically at %s', (kind, change, path) => {
    const input = businessDemoInput(kind); change(input); const before = structuredClone(input);
    for (const consume of [normalizeBusinessDocument, createBusinessDocumentProject]) expect(() => consume(input)).toThrow(expect.objectContaining({ path }));
    expect(input).toEqual(before);
    expect(() => createBusinessDocumentProject(businessDemoInput(kind))).not.toThrow();
  });
});
