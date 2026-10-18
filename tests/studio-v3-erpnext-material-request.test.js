import { describe, expect, it } from 'vitest';
import { adaptErpNextMaterialRequest, createErpNextMaterialRequestProject } from '../studio-v3/erpnext-material-request-adapter.js';
import { fictionalErpNextMaterialRequest } from './fixtures/erpnext-material-request.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { designOf, compileProject } from '../studio-v3/model.js';

function bind(project) {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  const result = bindTemplate(template, project.sampleData, project.manifest);
  expect(result.report.errors).toEqual([]);
  return id => [...result.fragment.querySelectorAll(`[data-v3-id="${id}"]`)].map(node => node.textContent);
}
describe('optional pinned native Purchase Material Request consumer', () => {
  it('maps native requested quantity, never stock/ordered quantity, and conserves every raw source field through editable project IO', () => {
    const input = fictionalErpNextMaterialRequest(), before = structuredClone(input);
    const facts = adaptErpNextMaterialRequest(input), project = readProject(saveProject(createErpNextMaterialRequestProject(input))), values = bind(project);
    expect(input).toEqual(before);
    expect(project.sampleData).toEqual(facts);
    expect(facts.document.kind).toBe('PurchaseRequisition');
    expect(facts.company).toEqual({ id: input.context.company.name, name: input.context.company.company_name });
    expect(facts.source.id).toBe(input.document.name);
    expect(facts.erpnextEvidence.document).toEqual(input.document); expect(facts.erpnextEvidence.exact).toEqual(input.exact);
    expect(facts.erpnextEvidence.company).toEqual(input.context.company);
    expect(values('items-amount')).toEqual(['+0008.500 Each', '-0000.000 kit']);
    expect(values('items-direction')).toEqual(['Requested', 'Requested']);
    expect(values('customer-requisition-status-value')).toEqual(['Partially Ordered']);
    expect(values('customer-requisition-required-by')).toEqual([input.document.schedule_date]);
    expect(values('items-description')[1]).toContain(input.document.items[1].schedule_date);
    expect(values('items-trace')[0]).toContain(input.document.items[0].name);
    expect(values('items-trace')[0]).toContain(input.exact['document.items[0].qty'].provenance.sourcePath);
    expect(values('items-description')[0]).toContain(input.document.items[0].warehouse);
    expect(values('items-description')[0]).toContain(input.document.items[0].project);
    expect(facts.requisition).not.toHaveProperty('requester'); expect(facts.requisition).not.toHaveProperty('approvedBy');
    expect(facts.requisition.lines[1]).not.toHaveProperty('destination'); expect(facts.requisition.lines[1]).not.toHaveProperty('project');
    expect(facts.requisition.lines[0]).not.toHaveProperty('stockQuantity');
    const design = designOf(project); design.title = 'Human purchase request layout';
    expect(readProject(saveProject(compileProject(project, design))).sampleData).toEqual(facts);
    facts.erpnextEvidence.document.items[0].qty = 999;
    expect(project.sampleData.erpnextEvidence.document.items[0].qty).toBe(8.5); expect(input).toEqual(before);
  });
  it.each([[0, 'Draft'], [1, 'Pending'], [2, 'Cancelled']])('preserves explicit native lifecycle %s/%s as source status, not approval', (docstatus, status) => {
    const input = fictionalErpNextMaterialRequest(); Object.assign(input.document, { docstatus, status });
    expect(adaptErpNextMaterialRequest(input).requisition.status.value).toBe(status);
    expect(adaptErpNextMaterialRequest(input)).not.toHaveProperty('approval');
  });
  it('retains explicitly supplied zero stock and unrelated raw values unprinted rather than deriving a remaining request', () => {
    const input = fictionalErpNextMaterialRequest();
    input.document.items[0].stock_qty = 0; input.document.items[0].ordered_qty = 999; input.document.items[0].received_qty = 777;
    input.document.items[0].description = '<p>Exact source description & not executed</p>';
    const project = createErpNextMaterialRequestProject(input), values = bind(project);
    expect(values('items-amount')[0]).toBe('+0008.500 Each');
    expect(values('items-description')[0]).toContain(input.document.items[0].description);
    expect(project.sampleData.erpnextEvidence.document.items[0]).toEqual(input.document.items[0]);
    expect(project.sampleData.requisition).not.toHaveProperty('remainingQuantity');
  });
  it.each([
    ['profile', d => { d.profile = 'auto-erp'; }, 'profile'],
    ['version', d => { d.context.erpnextVersion = '15.1.0'; }, 'context.erpnextVersion'],
    ['wrong doctype', d => { d.document.doctype = 'Purchase Order'; }, 'document.doctype'],
    ...['Material Transfer', 'Material Issue', 'Manufacture', 'Customer Provided', '', undefined].map(purpose => [String(purpose), d => { d.document.material_request_type = purpose; }, 'document.material_request_type']),
    ['missing native status', d => { delete d.document.status; }, 'document.status'],
    ['contradictory lifecycle', d => { d.document.docstatus = 0; }, 'document.status'],
    ['company mismatch', d => { d.context.company.name = 'OTHER'; }, 'context.company'],
    ['no later exact quantity', d => { delete d.exact['document.items[1].qty']; }, 'exact.document.items[1].qty'],
    ['numeric exact', d => { d.exact['document.items[1].qty'].amount = 0; }, 'exact.document.items[1].qty.amount'],
    ['invented precision', d => { d.exact['document.items[1].qty'].decimalPlaces = 7; }, 'exact.document.items[1].qty.decimalPlaces'],
    ['excess precision', d => { d.exact['document.items[1].qty'].amount = '0.0001'; }, 'exact.document.items[1].qty.amount'],
    ['missing native numeric', d => { delete d.document.items[1].qty; }, 'document.items[1].qty'],
    ['native string quantity', d => { d.document.items[1].qty = '0'; }, 'document.items[1].qty'],
    ['native mismatch', d => { d.document.items[1].qty = 1; }, 'document.items[1].qty'],
    ['later child parent', d => { d.document.items[1].parent = 'OTHER'; }, 'document.items[1].parent'],
    ['duplicate child', d => { d.document.items[1].name = d.document.items[0].name; }, 'document.items[1].name'],
    ['missing later UOM', d => { delete d.document.items[1].uom; }, 'document.items[1].uom'],
    ['missing later date', d => { delete d.document.items[1].schedule_date; }, 'document.items[1].schedule_date'],
    ['missing item identity', d => { delete d.document.items[1].item_code; }, 'document.items[1].item_code'],
    ['missing provenance', d => { delete d.exact['document.items[1].qty'].provenance; }, 'exact.document.items[1].qty.provenance'],
    ['unused exact stock fact', d => { d.exact['document.items[1].stock_qty'] = structuredClone(d.exact['document.items[1].qty']); }, 'exact.document.items[1].stock_qty']
  ])('rejects %s atomically without mutating a prior project', (_, change, path) => {
    const input = fictionalErpNextMaterialRequest(), prior = createErpNextMaterialRequestProject(input), snapshot = structuredClone(prior);
    change(input);
    // Undefined is not JSON: use deletion to exercise the missing-purpose semantic boundary.
    if (input.document.material_request_type === undefined) delete input.document.material_request_type;
    const before = structuredClone(input);
    for (const consumer of [adaptErpNextMaterialRequest, createErpNextMaterialRequestProject]) expect(() => consumer(input)).toThrow(expect.objectContaining({ path }));
    expect(input).toEqual(before); expect(prior).toEqual(snapshot);
  });
});
