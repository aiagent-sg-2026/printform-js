import { describe, it, expect } from 'vitest';
import { adaptErpNextReturn, createErpNextReturnProject } from '../studio-v3/erpnext-return-adapter.js';
import { fictionalErpNextReturn, erpnextCases } from './fixtures/erpnext-return.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';

const open = input => readProject(saveProject(createErpNextReturnProject(input)));
const bind = project => {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  const result = bindTemplate(template, project.sampleData, project.manifest);
  expect(result.report.errors).toEqual([]);
  return result.fragment;
};
const values = (fragment, id) => [...fragment.querySelectorAll(`[data-v3-id="${id}"]`)].map(node => node.textContent);

describe('pinned ERPNext raw return consumer boundary', () => {
  it.each(erpnextCases)('%s preserves exact source facts through real project IO and binding', (_, doctype, stock, kind, inventory, accounting) => {
    const input = fictionalErpNextReturn(doctype, stock), snapshot = structuredClone(input);
    const project = open(input), data = project.sampleData, fragment = bind(project);
    expect(input).toEqual(snapshot);
    expect(data.document).toMatchObject({ kind, number: input.document.name, currency: 'USD', status: 'Return' });
    expect(data.effects.inventory.direction).toBe(inventory);
    expect(data.effects.accounting).toMatchObject({ direction: accounting, basis: accounting === 'none' ? 'none' : doctype === 'Sales Invoice' ? 'receivable' : 'payable' });
    expect(data.lines[0].sourceLineId).toBe(`${doctype === 'Purchase Receipt' ? 'PR' : doctype === 'Sales Invoice' ? 'SI' : 'PI'}-ORIGINAL-LINE-2`);
    expect(data.references[0].document.id).toBe(input.original.name);
    expect(data.references[0].provenance.sourcePath).toContain('original.items[].name/parent/parenttype/parentfield');
    expect(data.lines[0].quantities[0]).toMatchObject({ amount: '-1.250', uom: 'Box', direction: inventory, role: stock ? 'returned' : 'billed' });
    expect(data.lines[0].amounts.map(fact => fact.amount.amount)).toEqual(['39.299', '-49.123', '-66.378']);
    expect(data.lines[0].amounts[2]).toMatchObject({ role: 'baseAmount', amount: { currency: 'SGD' } });
    expect(data.summary.find(fact => fact.role === 'grandTotal').amount.amount).toBe('-52.017');
    expect(data.summary.find(fact => fact.role === 'baseAmount').amount.amount).toBe('-70.289');
    expect(values(fragment, 'items-value')).toEqual(expect.arrayContaining(['-1.250 Box', 'USD 39.299', 'USD -49.123', 'SGD -66.378', 'USD -52.017', 'SGD -70.289', 'USD -2.894']));
    expect(values(fragment, 'items-trace').join(' ')).toContain('authorized-exact-export');
    expect(fragment.querySelector('[data-v3-id="totals-cash-movement"]')).toBeNull();
    expect(data).not.toHaveProperty('cashMovement'); expect(data).not.toHaveProperty('allocations');
  });
  it('preserves grouped signed export text while comparing its parsed exact value to native numbers', () => {
    const input = fictionalErpNextReturn();
    input.exact['document.items[0].qty'].amount = '-0,001.250';
    input.exact['document.items[0].rate'].amount = '+0,039.299';
    const project = open(input), fragment = bind(project);
    expect(project.sampleData.lines[0].quantities[0]).toMatchObject({ amount: '-0,001.250', displayQuantity: '-0,001.250 Box' });
    expect(project.sampleData.lines[0].amounts[0].amount).toMatchObject({ amount: '+0,039.299', amountMinor: 39299, minorUnitDigits: 3, currency: 'USD' });
    expect(values(fragment, 'items-value')).toEqual(expect.arrayContaining(['-0,001.250 Box', 'USD +39.299']));
    input.document.items[0].rate = 40.299;
    expect(() => adaptErpNextReturn(input)).toThrow(expect.objectContaining({ code: 'ERP_TRANSACTION_SOURCE_VALUE', path: 'document.items[0].rate' }));
  });
  it('preserves supplied free-item net zero while retaining a real negative returned quantity', () => {
    const input = fictionalErpNextReturn('Sales Invoice', 1);
    input.document.items[0].net_amount = 0; input.exact['document.items[0].net_amount'].amount = '0.000';
    expect(open(input).sampleData.lines[0].amounts[1].amount.amount).toBe('0.000');
    expect(open(input).sampleData.lines[0].quantities[0].amount).toBe('-1.250');
  });
  it('does not multiply supplied rate/quantity, sum tax, or convert base money', () => {
    const input = fictionalErpNextReturn('Purchase Invoice', 0);
    input.document.grand_total = -987.654; input.exact['document.grand_total'].amount = '-987.654';
    input.document.items[0].base_net_amount = -111.001; input.exact['document.items[0].base_net_amount'].amount = '-111.001';
    const data = open(input).sampleData;
    expect(data.lines[0].amounts[1].amount.amount).toBe('-49.123');
    expect(data.lines[0].amounts[2].amount.amount).toBe('-111.001');
    expect(data.summary.find(fact => fact.role === 'grandTotal').amount.amount).toBe('-987.654');
  });
  it('does not invent missing optional monetary facts or approval', () => {
    const input = fictionalErpNextReturn();
    for (const field of ['net_total', 'total_taxes_and_charges', 'grand_total', 'rounding_adjustment', 'base_grand_total']) {
      delete input.document[field]; delete input.exact[`document.${field}`];
    }
    delete input.document.taxes; delete input.exact['document.taxes[0].tax_amount'];
    delete input.document.items[0].rate; delete input.exact['document.items[0].rate'];
    delete input.document.items[0].base_net_amount; delete input.exact['document.items[0].base_net_amount'];
    const data = open(input).sampleData;
    expect(data.lines[0].amounts).toHaveLength(1);
    for (const field of ['summary', 'taxes', 'approval', 'bank']) expect(data).not.toHaveProperty(field);
  });
  it('compares real posting time including fractional seconds without losing lexical ordering', () => {
    const input = fictionalErpNextReturn(); input.document.posting_date = input.original.posting_date;
    input.document.posting_time = '09:30:00.100';
    expect(open(input).sampleData.document.date).toBe('2026-10-01');
    input.original.posting_time = '09:30:00.101';
    expect(() => open(input)).toThrow(expect.objectContaining({ code: 'ERP_TRANSACTION_SOURCE_LIFECYCLE', path: 'document.posting_date' }));
  });
  it('accepts full extent only as independent supplied source scope, never computes completeness', () => {
    const input = fictionalErpNextReturn(); input.context.scope.extent = 'full';
    expect(open(input).sampleData.scope.extent).toBe('full');
    expect(open(input).sampleData.lines[0].quantities[0].amount).toBe('-1.250');
  });
  it('preserves negative zero and exact lexical precision for supplied rounding only', () => {
    const input = fictionalErpNextReturn(); input.document.rounding_adjustment = 0;
    input.exact['document.rounding_adjustment'].amount = '-0.000';
    expect(values(bind(open(input)), 'items-value')).toContain('USD -0.000');
  });
});

describe('uncertain, lossy, cancelled and mismatched native returns are rejected', () => {
  const cases = [
    ['unknown profile', d => { d.profile = 'erpnext-auto'; }, 'SOURCE_PROFILE', 'profile'],
    ['unverified version', d => { d.context.erpnextVersion = '15.1.0'; }, 'SOURCE_PROFILE', 'context.erpnextVersion'],
    ['not a return', d => { d.document.is_return = 0; }, 'SOURCE_RETURN', 'document.is_return'],
    ['truthy flag', d => { d.document.is_return = '1'; }, 'SOURCE_FLAG', 'document.is_return'],
    ['return of return', d => { d.original.is_return = 1; }, 'SOURCE_RETURN', 'document.is_return'],
    ['unlinked return', d => { delete d.document.return_against; }, 'SOURCE_IDENTITY', 'document.return_against'],
    ['wrong original', d => { d.document.return_against = 'OTHER'; }, 'SOURCE_IDENTITY', 'document.return_against'],
    ['same document', d => { d.document.return_against = d.document.name; d.original.name = d.document.name; }, 'SOURCE_IDENTITY', 'document.return_against'],
    ['original draft', d => { d.original.docstatus = 0; }, 'SOURCE_LIFECYCLE', 'original.docstatus'],
    ['cancelled return', d => { d.document.docstatus = 2; }, 'SOURCE_LIFECYCLE', 'document.docstatus'],
    ['contradictory cancellation status', d => { d.document.status = 'Cancelled'; }, 'SOURCE_LIFECYCLE', 'document.status'],
    ['return draft', d => { d.document.docstatus = 0; }, 'SOURCE_LIFECYCLE', 'document.docstatus'],
    ['wrong original type', d => { d.original.doctype = 'Delivery Note'; }, 'SOURCE_TYPE', 'original.doctype'],
    ['wrong original company', d => { d.original.company = 'OTHER'; }, 'SOURCE_IDENTITY', 'original.company'],
    ['wrong original party', d => { d.original.supplier = 'OTHER'; }, 'SOURCE_IDENTITY', 'original.supplier'],
    ['original currency differs', d => { d.original.currency = 'MYR'; }, 'CURRENCY', 'original.currency'],
    ['original FX differs', d => { d.original.conversion_rate = 1.5; }, 'SOURCE_IDENTITY', 'original.conversion_rate'],
    ['unscoped company metadata', d => { d.context.company.id = 'OTHER'; }, 'SOURCE_IDENTITY', 'context.company.id'],
    ['earlier date', d => { d.document.posting_date = '2026-09-30'; }, 'SOURCE_LIFECYCLE', 'document.posting_date'],
    ['missing timestamp', d => { delete d.document.posting_time; }, 'SOURCE_VALUE', 'document.posting_time'],
    ['invalid timestamp', d => { d.document.posting_time = '29:00:00'; }, 'SOURCE_VALUE', 'document.posting_time'],
    ['prototype-like DocType', d => { d.document.doctype = 'toString'; }, 'SOURCE_TYPE', 'document.doctype'],
    ['missing original line link', d => { delete d.document.items[0].purchase_receipt_item; }, 'TEXT', 'document.items[0].purchase_receipt_item'],
    ['unknown original line', d => { d.document.items[0].purchase_receipt_item = 'UNKNOWN'; }, 'SOURCE_IDENTITY', 'document.items[0].purchase_receipt_item'],
    ['original child wrong parent', d => { d.original.items[1].parent = 'OTHER'; }, 'SOURCE_IDENTITY', 'original.items[1].parent'],
    ['current child wrong parent', d => { d.document.items[0].parent = 'OTHER'; }, 'SOURCE_IDENTITY', 'document.items[0].parent'],
    ['duplicate original child', d => { d.original.items[1].name = d.original.items[0].name; }, 'SOURCE_IDENTITY', 'original.items[1].name'],
    ['different item', d => { d.document.items[0].item_code = 'OTHER'; }, 'SOURCE_IDENTITY', 'document.items[0].item_code'],
    ['different UOM', d => { d.document.items[0].uom = 'Each'; }, 'SOURCE_IDENTITY', 'document.items[0].uom'],
    ['rejected stock not conflated', d => { d.document.items[0].rejected_qty = -1; }, 'SOURCE_RETURN', 'document.items[0].rejected_qty'],
    ['no warehouse for stock', d => { delete d.document.items[0].warehouse; }, 'TEXT', 'document.items[0].warehouse'],
    ['no exact overlay', d => { delete d.exact['document.items[0].net_amount']; }, 'SHAPE', 'exact.document.items[0].net_amount'],
    ['numeric overlay loses lexical precision', d => { d.exact['document.items[0].net_amount'].amount = -49.123; }, 'TEXT', 'exact.document.items[0].net_amount.amount'],
    ['overlay contradicts numeric snapshot', d => { d.exact['document.items[0].net_amount'].amount = '-49.124'; }, 'SOURCE_VALUE', 'document.items[0].net_amount'],
    ['no export evidence', d => { delete d.exact['document.items[0].net_amount'].provenance; }, 'SHAPE', 'exact.document.items[0].net_amount.provenance'],
    ['wrong document amount currency', d => { d.exact['document.items[0].net_amount'].currency = 'SGD'; }, 'CURRENCY', 'exact.document.items[0].net_amount.currency'],
    ['wrong base amount currency', d => { d.exact['document.items[0].base_net_amount'].currency = 'USD'; }, 'CURRENCY', 'exact.document.items[0].base_net_amount.currency'],
    ['precision omitted', d => { delete d.exact['document.items[0].net_amount'].precision; }, 'PRECISION', 'exact.document.items[0].net_amount.minorUnitDigits'],
    ['precision overflow', d => { d.exact['document.items[0].net_amount'].precision = 2; }, 'AMOUNT_PRECISION', 'exact.document.items[0].net_amount.amount'],
    ['positive return quantity', d => { d.document.items[0].qty = 1.25; d.exact['document.items[0].qty'].amount = '1.250'; }, 'SOURCE_RETURN', 'document.items[0].qty'],
    ['zero return quantity', d => { d.document.items[0].qty = 0; d.exact['document.items[0].qty'].amount = '-0.000'; }, 'SOURCE_RETURN', 'document.items[0].qty'],
    ['positive return net', d => { d.document.items[0].net_amount = 49.123; d.exact['document.items[0].net_amount'].amount = '49.123'; }, 'SOURCE_RETURN', 'document.items[0].net_amount'],
    ['unused exact fact', d => { d.exact['document.outstanding_amount'] = d.exact['document.grand_total']; }, 'SOURCE_FIELD', 'exact.document.outstanding_amount'],
    ['tax belongs to another document', d => { d.document.taxes[0].parent = 'OTHER'; }, 'SOURCE_IDENTITY', 'document.taxes[0].parent'],
    ['unknown wrapper field', d => { d.apiKey = 'not-accepted'; }, 'FIELD', 'input.apiKey'],
    ['undefined raw field', d => { d.document.remarks = undefined; }, 'JSON', 'input.document.remarks'],
    ['numeric signed zero raw', d => { d.document.rounding_adjustment = -0; }, 'JSON', 'input.document.rounding_adjustment'],
    ['sparse raw table', d => { delete d.document.items[0]; }, 'JSON', 'input.document.items'],
    ['cycle', d => { d.document.loop = d.document; }, 'JSON', 'input.document.loop']
  ];
  it.each(cases)('rejects %s before creating a print project', (_, change, code, path) => {
    const input = fictionalErpNextReturn(); change(input);
    for (const consume of [adaptErpNextReturn, createErpNextReturnProject]) expect(() => consume(input)).toThrow(expect.objectContaining({ code: `ERP_TRANSACTION_${code}`, path }));
  });
  it('rejects stock SI against a non-stock original but permits the correctly separate accounting-only return', () => {
    const input = fictionalErpNextReturn('Sales Invoice', 1); input.original.update_stock = 0;
    expect(() => open(input)).toThrow(expect.objectContaining({ code: 'ERP_TRANSACTION_SOURCE_RETURN', path: 'document.update_stock' }));
    input.document.update_stock = 0; delete input.document.items[0].warehouse;
    expect(open(input).sampleData.effects.inventory.direction).toBe('none');
  });
  it.each([['Sales Invoice', 'is_pos'], ['Purchase Invoice', 'is_paid']])('rejects immediate cash %s rather than implying a refund', (doctype, field) => {
    const input = fictionalErpNextReturn(doctype, 0); input.document[field] = 1;
    expect(() => open(input)).toThrow(expect.objectContaining({ code: 'ERP_TRANSACTION_SOURCE_RETURN', path: `document.${field}` }));
  });
});
