import { describe, expect, it } from 'vitest';
import { ERP_TRANSACTION_KINDS, normalizeErpTransaction } from '../studio-v3/erp-transaction-adapter.js';
import { createErpTransactionProject } from '../studio-v3/erp-transaction-project.js';
import { fictionalTransaction, fictionalSupplierRefund, fictionalOdooDebit, fictionalStockCredit, transactionMoney as m } from './fixtures/erp-transaction.js';
import { designOf } from '../studio-v3/model.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';

const reopened = input => readProject(saveProject(createErpTransactionProject(input)));
const bind = project => {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  const result = bindTemplate(template, project.sampleData, project.manifest);
  expect(result.report.errors).toEqual([]);
  return result;
};
const values = (fragment, id) => [...fragment.querySelectorAll(`[data-v3-id="${id}"]`)].map(node => node.textContent);
const value = (fragment, id) => fragment.querySelector(`[data-v3-id="${id}"]`)?.textContent;

describe('six explicit inventory, adjustment and actual cash contracts', () => {

  it('keeps accepted, rejected and received quantities distinct; never derives receipt valuation', () => {
    const normalized = normalizeErpTransaction(fictionalTransaction());
    expect(normalized.lines[0].quantities.map(q => [q.role, q.displayQuantity])).toEqual([['received', '3.000 Box'], ['accepted', '2.500 Box'], ['rejected', '0.500 Box']]);
    expect(normalized.lines[0].amounts[1].amount.amount).toBe('49.123');
    expect(normalized.summary[0].amount.amount).toBe('50.017');
    expect(normalized.effects.accounting).toMatchObject({ basis: 'none', direction: 'none' });
  });
  it('does not confuse ERPNext supplier debit decrease with Odoo supplier debit increase', () => {
    expect(normalizeErpTransaction(fictionalTransaction('DebitNote')).effects.accounting).toMatchObject({ basis: 'payable', direction: 'decrease' });
    expect(normalizeErpTransaction(fictionalOdooDebit()).effects.accounting).toMatchObject({ basis: 'payable', direction: 'increase' });
    expect(normalizeErpTransaction(fictionalSupplierRefund()).cashMovement.direction).toBe('inflow');
  });
  it('retains optional item/warehouse identity without inventing names and preserves supplied approval facts', () => {
    const input = fictionalTransaction('PurchaseReturn'); delete input.lines[0].item.code; delete input.lines[0].item.name;
    delete input.lines[0].quantities[0].warehouse.name;
    input.approval = { status: 'Source review only', approvedBy: 'Fictional Reviewer', date: '2026-10-14', reference: 'APP-F-1' };
    const project = reopened(input), { fragment } = bind(project);
    expect(project.sampleData.lines[0].item).toEqual({ id: 'ITEM-F-1' });
    expect(project.sampleData.lines[0].quantities[0].warehouse).toEqual({ id: 'WH-F' });
    expect(project.sampleData.approval).toEqual(input.approval);
    expect(value(fragment, 'footer-approval-approved-by')).toBe('Fictional Reviewer');
    expect(values(fragment, 'items-trace').join(' ')).not.toContain('undefined');
  });
  it('allows price-only credit without fake inventory and an explicitly separate stock-updating credit', () => {
    const price = normalizeErpTransaction(fictionalTransaction('CreditNote')), stock = normalizeErpTransaction(fictionalStockCredit());
    expect(price.lines[0]).not.toHaveProperty('item'); expect(price.lines[0].quantities).toEqual([]);
    expect(stock.lines[0].quantities[0]).toMatchObject({ role: 'returned', amount: '-1.250', uom: 'Each', direction: 'inflow' });
    expect(stock.effects.accounting.direction).toBe('decrease');
  });
  it('keeps absent optional facts absent and supports direct receipt with supplied stock facts only', () => {
    const input = fictionalTransaction(); input.references = []; delete input.lines[0].sourceReferenceId; delete input.lines[0].sourceLineId;
    input.lines[0].amounts = []; delete input.taxes; delete input.summary; delete input.notes;
    for (const q of input.lines[0].quantities) delete q.warehouse;
    const project = reopened(input), { fragment } = bind(project);
    for (const key of ['summary', 'taxes', 'bank', 'approval', 'notes']) expect(project.sampleData).not.toHaveProperty(key);
    expect(project.sampleData.printRows).toHaveLength(3);
    expect(designOf(project).blocks.totals.enabled).toBe(false);
    expect(fragment.querySelector('[data-v3-id="totals-summary-0"],[data-v3-id="footer-bank-status"]')).toBeNull();
    expect(project.sampleData.lines[0].quantities[0]).not.toHaveProperty('warehouse');
  });
  it.each(['-0.000', '+0.000', '1.250', '-1.250'])('preserves supplied quantity sign %s, without deriving stock direction from sign', amount => {
    const input = fictionalTransaction('PurchaseReturn'); input.lines[0].quantities[0].amount = amount;
    const project = reopened(input), { fragment } = bind(project);
    expect(project.sampleData.lines[0].quantities[0]).toMatchObject({ amount, direction: 'outflow' });
    expect(values(fragment, 'items-value')).toContain(`${amount} Box`);
  });
  it.each([0, 1, 2, 3, 4, 5, 6])('prints declared money precision %i with source sign intact', precision => {
    const input = fictionalTransaction('CreditNote'); input.lines[0].amounts[1].amount = m('-0', 'USD', precision, 'decrease');
    const { fragment } = bind(reopened(input));
    expect(values(fragment, 'items-value')).toContain(`USD -0${precision ? `.${'0'.repeat(precision)}` : ''}`);
  });
  it('preserves independent partial/full snapshots without recalculating original quantities or money', () => {
    const partial = fictionalTransaction('Refund'), full = structuredClone(partial);
    full.scope.extent = 'full'; full.allocations[0].state = 'full'; full.allocations[0].remainingAmount.amount = '0.000';
    full.allocations[0].amount.amount = '2.345';
    const normalized = normalizeErpTransaction(full);
    expect(normalized.allocations[0].amount.amount).toBe('2.345');
    expect(normalized.allocations[0].cashAppliedAmount.amount).toBe('111.000');
    expect(normalizeErpTransaction(partial).allocations[0].state).toBe('partial');
    const stock = fictionalTransaction('SalesReturn'); stock.scope.extent = 'full';
    expect(normalizeErpTransaction(stock).lines[0].quantities[0].amount).toBe('-1.250');
  });
  it('allows foreign linked/base currencies but rejects unsupported Studio manifest currencies', () => {
    const input = fictionalTransaction('Refund'); input.references[0].document.currency = 'GBP';
    input.allocations[0].amount.currency = input.allocations[0].remainingAmount.currency = 'GBP';
    expect(reopened(input).sampleData.allocations[0].amount.displayAmount).toBe('GBP 25.000');
    input.document.currency = input.cashMovement.amount.currency = input.allocations[0].cashAppliedAmount.currency = 'GBP';
    expect(normalizeErpTransaction(input).document.currency).toBe('GBP');
    expect(() => createErpTransactionProject(input)).toThrow(expect.objectContaining({ code: 'ERP_TRANSACTION_PROJECT_CURRENCY', path: 'document.currency' }));
  });
  it('supports customer debit increase and vendor credit decrease explicitly', () => {
    const debit = fictionalOdooDebit(); debit.party.type = 'customer'; debit.effects.accounting.basis = 'receivable';
    expect(normalizeErpTransaction(debit).effects.accounting.direction).toBe('increase');
    const credit = fictionalTransaction('CreditNote'); credit.party.type = 'supplier'; credit.effects.accounting.basis = 'payable';
    expect(normalizeErpTransaction(credit).effects.accounting.direction).toBe('decrease');
  });
});

describe('rejects ambiguous, unsupported and lossy canonical transactions', () => {
  const stockCases = [
    ['absent profile', d => { delete d.profile; }, 'PROFILE', 'profile'],
    ['raw ERP profile', d => { d.profile = 'raw-erpnext'; }, 'PROFILE', 'profile'],
    ['unknown kind', d => { d.document.kind = 'Invoice'; }, 'SEMANTICS', 'document.kind'],
    ['missing source', d => { delete d.source.id; }, 'TEXT', 'source.id'],
    ['missing company ID', d => { delete d.company.id; }, 'TEXT', 'company.id'],
    ['wrong party', d => { d.party.type = 'customer'; }, 'SEMANTICS', 'party.type'],
    ['bad date', d => { d.document.date = '2026-02-30'; }, 'DATE', 'document.date'],
    ['currency code', d => { d.document.currency = 'XYZ'; }, 'CURRENCY', 'document.currency'],
    ['missing stock direction', d => { delete d.effects.inventory.direction; }, 'SEMANTICS', 'effects.inventory.direction'],
    ['cash inferred from receipt', d => { d.cashMovement = {}; }, 'FIELD', 'cashMovement'],
    ['accounting inferred from receipt', d => { d.effects.accounting.direction = 'increase'; }, 'SEMANTICS', 'effects.accounting.direction'],
    ['missing accepted quantity', d => { d.lines[0].quantities.splice(1, 1); }, 'QUANTITY', 'lines[0].quantities'],
    ['missing UOM', d => { delete d.lines[0].quantities[0].uom; }, 'TEXT', 'lines[0].quantities[0].uom'],
    ['missing quantity precision', d => { delete d.lines[0].quantities[0].decimalPlaces; }, 'PRECISION', 'lines[0].quantities[0].decimalPlaces'],
    ['quantity precision overflow', d => { d.lines[0].quantities[0].amount = '0.0001'; }, 'AMOUNT_PRECISION', 'lines[0].quantities[0].amount'],
    ['quantity as number', d => { d.lines[0].quantities[0].amount = 1; }, 'TEXT', 'lines[0].quantities[0].amount'],
    ['quantity direction', d => { d.lines[0].quantities[0].direction = 'outflow'; }, 'SEMANTICS', 'lines[0].quantities[0].direction'],
    ['duplicate quantity role', d => { d.lines[0].quantities[1].role = 'received'; }, 'IDENTIFIER', 'lines[0].quantities[1].role'],
    ['missing item ID', d => { delete d.lines[0].item.id; }, 'TEXT', 'lines[0].item.id'],
    ['unknown line reference', d => { d.lines[0].sourceReferenceId = 'UNKNOWN'; }, 'REFERENCE', 'lines[0].sourceReferenceId'],
    ['different party identity', d => { d.references[0].document.partyId = 'OTHER'; }, 'REFERENCE', 'references[0].document.partyId'],
    ['different company identity', d => { d.references[0].document.companyId = 'OTHER'; }, 'REFERENCE', 'references[0].document.companyId'],
    ['reference current document', d => { Object.assign(d.references[0].document, d.source); }, 'REFERENCE', 'references[0].document'],
    ['duplicate fact ID', d => { d.lines[0].amounts[0].id = d.lines[0].id; }, 'IDENTIFIER', 'lines[0].amounts[0].id'],
    ['missing money precision', d => { delete d.lines[0].amounts[0].amount.minorUnitDigits; }, 'PRECISION', 'lines[0].amounts[0].amount.minorUnitDigits'],
    ['amount scientific notation', d => { d.lines[0].amounts[0].amount.amount = '1e3'; }, 'AMOUNT', 'lines[0].amounts[0].amount.amount'],
    ['money precision overflow', d => { d.lines[0].amounts[0].amount.amount = '1.0001'; }, 'AMOUNT_PRECISION', 'lines[0].amounts[0].amount.amount'],
    ['unsafe amount', d => { d.lines[0].amounts[0].amount.amount = '9007199254740992'; }, 'UNSAFE_AMOUNT', 'lines[0].amounts[0].amount.amount'],
    ['money currency mismatch', d => { d.lines[0].amounts[0].amount.currency = 'MYR'; }, 'CURRENCY', 'lines[0].amounts[0].amount.currency'],
    ['missing provenance', d => { delete d.lines[0].amounts[0].amount.provenance.sourcePath; }, 'TEXT', 'lines[0].amounts[0].amount.provenance.sourcePath'],
    ['base conversion meaning absent', d => { delete d.lines[0].amounts[2].basis; }, 'SEMANTICS', 'lines[0].amounts[2].basis'],
    ['tax meaning absent', d => { delete d.taxes[0].basis; }, 'TEXT', 'taxes[0].basis'],
    ['unknown summary meaning', d => { d.summary[0].role = 'autoTax'; }, 'SEMANTICS', 'summary[0].role'],
    ['undefined optional', d => { d.approval = undefined; }, 'JSON', 'input.approval'],
    ['negative numeric zero', d => { d.lines[0].amounts[0].amount.amount = -0; }, 'JSON', 'input.lines.0.amounts.0.amount.amount'],
    ['sparse lines', d => { delete d.lines[0]; }, 'JSON', 'input.lines'],
    ['cycle', d => { d.notes = d; }, 'JSON', 'input.notes'],
    ['nonplain object', d => { d.bank = new Date(); }, 'JSON', 'input.bank'],
    ['unknown source field', d => { d.source.sqlTable = 'invoice'; }, 'FIELD', 'source.sqlTable']
  ];
  it.each(stockCases)('rejects %s with an actionable path', (_, change, code, path) => {
    const input = fictionalTransaction(); change(input);
    for (const fn of [normalizeErpTransaction, createErpTransactionProject]) expect(() => fn(input)).toThrow(expect.objectContaining({ code: `ERP_TRANSACTION_${code}`, path }));
  });
  const boundaries = [
    ['PurchaseReturn', d => { d.references = []; }, 'REFERENCE', 'references'],
    ['SalesReturn', d => { delete d.lines[0].sourceLineId; }, 'REFERENCE', 'lines[0].sourceLineId'],
    ['CreditNote', d => { d.effects.accounting.direction = 'increase'; }, 'SEMANTICS', 'effects.accounting.direction'],
    ['CreditNote', d => { d.lines[0].amounts[1].amount.direction = 'inflow'; }, 'SEMANTICS', 'lines[0].amounts[1].amount.direction'],
    ['CreditNote', d => { d.lines[0].amounts.splice(1, 1); }, 'AMOUNT', 'lines[0].amounts'],
    ['CreditNote', d => { d.effects.accounting.basis = 'payable'; }, 'SEMANTICS', 'effects.accounting.basis'],
    ['Refund', d => { delete d.cashMovement; }, 'SHAPE', 'cashMovement'],
    ['Refund', d => { d.cashMovement.direction = 'inflow'; }, 'SEMANTICS', 'cashMovement.direction'],
    ['Refund', d => { d.cashMovement.amount.direction = 'inflow'; }, 'SEMANTICS', 'cashMovement.amount.direction'],
    ['Refund', d => { d.cashMovement.amount.currency = 'USD'; }, 'CURRENCY', 'cashMovement.amount.currency'],
    ['Refund', d => { d.allocations = []; }, 'ROWS', 'allocations'],
    ['Refund', d => { d.references[0].role = 'original'; }, 'REFERENCE', 'references'],
    ['Refund', d => { d.allocations[0].sourceReferenceId = 'UNKNOWN'; }, 'REFERENCE', 'allocations[0].sourceReferenceId'],
    ['Refund', d => { delete d.references[0].document.currency; }, 'CURRENCY', 'allocations[0].sourceReferenceId'],
    ['Refund', d => { d.allocations[0].amount.currency = 'MYR'; }, 'CURRENCY', 'allocations[0].amount.currency'],
    ['Refund', d => { d.allocations[0].cashAppliedAmount.currency = 'USD'; }, 'CURRENCY', 'allocations[0].cashAppliedAmount.currency'],
    ['Refund', d => { d.allocations[0].remainingAmount.direction = 'outflow'; }, 'SEMANTICS', 'allocations[0].remainingAmount.direction'],
    ['Refund', d => { d.allocations[0].state = 'full'; }, 'BALANCE', 'allocations[0].state'],
    ['Refund', d => { d.lines = []; }, 'FIELD', 'lines'],
    ['Refund', d => { d.effects.inventory.direction = 'inflow'; }, 'SEMANTICS', 'effects.inventory.direction']
  ];
  it.each(boundaries)('%s rejects unsupported or contradictory facts %#', (kind, change, code, path) => {
    const input = fictionalTransaction(kind); change(input);
    expect(() => createErpTransactionProject(input)).toThrow(expect.objectContaining({ code: `ERP_TRANSACTION_${code}`, path }));
  });
  it('rejects conflicting references to the same original and orphan original line IDs', () => {
    const input = fictionalTransaction(); const duplicate = structuredClone(input.references[0]); duplicate.id = 'REF-F-2'; duplicate.document.number = 'CONFLICT'; input.references.push(duplicate);
    expect(() => normalizeErpTransaction(input)).toThrow(expect.objectContaining({ code: 'ERP_TRANSACTION_REFERENCE', path: 'references[1].document.number' }));
    input.references.pop(); delete input.lines[0].sourceReferenceId;
    expect(() => normalizeErpTransaction(input)).toThrow(expect.objectContaining({ code: 'ERP_TRANSACTION_REFERENCE', path: 'lines[0].sourceLineId' }));
  });
  it.each(ERP_TRANSACTION_KINDS)('%s is never treated as a stock/cash action based on document title', kind => {
    const input = fictionalTransaction(kind); delete input.effects.inventory;
    expect(() => normalizeErpTransaction(input)).toThrow(expect.objectContaining({ code: 'ERP_TRANSACTION_SHAPE', path: 'effects.inventory' }));
  });
});
