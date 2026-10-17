import { describe, expect, it } from 'vitest';
import { normalizeErpSettlement } from '../studio-v3/erp-settlement-adapter.js';
import { createErpSettlementProject } from '../studio-v3/erp-settlement-project.js';
import { fictionalMixedReceipt, fictionalAdjustedPayment, fictionalAdvance, settlementMoney as m } from './fixtures/erp-settlement.js';
import { designOf } from '../studio-v3/model.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { bindingValidation } from '../studio-v3/validation.js';
import { bindTemplate } from '../studio-v2/core/binding.js';

const reopened = input => readProject(saveProject(createErpSettlementProject(input)));
const bind = project => {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  const result = bindTemplate(template, project.sampleData, project.manifest);
  expect(result.report.errors).toEqual([]);
  expect(bindingValidation(project).errors).toEqual([]);
  return result;
};
const text = (fragment, id) => fragment.querySelector(`[data-v3-id="${id}"]`)?.textContent;

describe('ERP supplied settlement facts, without posting or recalculation', () => {
  it('preserves cash, source cash, two invoice currencies, cleared values and independent balance meanings', () => {
    const input = fictionalMixedReceipt(), before = structuredClone(input), result = normalizeErpSettlement(input);
    expect(input).toEqual(before);
    expect(result.source).toEqual(input.source);
    expect(result.document).toEqual(input.document);
    expect(result.cashMovement.amount).toMatchObject({ amount: '1150.000', amountMinor: 1150000, currency: 'MYR' });
    expect(result.cashMovement.sourceAmount).toMatchObject({ amount: '250.000', currency: 'USD' });
    expect(result.allocations.map(row => row.sourceReference)).toEqual(input.allocations.map(row => row.sourceReference));
    expect(result.allocations[1]).toMatchObject({
      invoiceAppliedAmount: { amount: '200.000', currency: 'SGD' }, invoiceClearedAmount: { amount: '205.000', currency: 'SGD' },
      cashAppliedAmount: { amount: '550.000', currency: 'MYR' }, invoiceRemainingBalance: { amount: '95.000', currency: 'SGD' }
    });
    expect(result.summary.unappliedAmount).toMatchObject({ amount: '150.000', currency: 'MYR' });
    expect(result.summary.remainingBalance).toMatchObject({ amount: '95.000', currency: 'SGD' });
    expect(result.summary).not.toHaveProperty('invoiceClearedAmount');
    expect(result.adjustments.map(row => row.amount.amount)).toEqual(['5.000', '-2.500', '1.234']);
    expect(result.printRows).toHaveLength(13);
    expect(result.printRows[10]).toMatchObject({ section: 'ERP adjustment', adjustmentKind: 'withholding', allocationId: 'allocation-fictional-2', sourcePath: 'adjustments[0].amount', amount: '5.000' });
    expect(result.printRows[10].sourceReference).toEqual(input.allocations[1].sourceReference);
    expect(result.printRows[12]).toMatchObject({ adjustmentKind: 'fxGain', amountMinor: 1234, sourceId: 'fx-fictional-1' });
    expect(result).not.toHaveProperty('items');
    expect(result).not.toHaveProperty('tax');
  });

  it('retains per-value declared precision, zero and negative ERP adjustments', () => {
    const result = normalizeErpSettlement(fictionalAdjustedPayment());
    expect(result.allocations[1].invoiceAppliedAmount.displayAmount).toBe('USD 100.00');
    expect(result.allocations[1].invoiceClearedAmount.displayAmount).toBe('USD 105.000');
    expect(result.adjustments.map(row => row.amount.displayAmount)).toEqual(['MYR 10.000', 'USD 5.000', 'MYR 0.000', 'MYR -3.210']);
    expect(result.printRows).toHaveLength(12);
  });

  it('does not derive a new balance or status while transitioning from advance to partial then full snapshots', () => {
    const advance = fictionalAdvance(), original = normalizeErpSettlement(advance);
    expect(original.allocations).toEqual([]);
    const partial = fictionalMixedReceipt(); delete partial.summary.remainingBalance; delete partial.summary.balanceBasis;
    delete partial.allocations[1].invoiceBalanceBefore;
    const partialResult = normalizeErpSettlement(partial);
    expect(partialResult.allocations[1].state).toBe('partial');
    expect(partialResult.allocations[1]).not.toHaveProperty('invoiceBalanceBefore');
    expect(partialResult.summary).not.toHaveProperty('remainingBalance');
    const full = structuredClone(partial);
    full.allocations[1].state = 'full'; full.allocations[1].invoiceRemainingBalance = m('0.000', 'SGD');
    // Deliberately not an arithmetic transition: these are independent ERP snapshots.
    full.allocations[1].invoiceClearedAmount = m('7.891', 'SGD');
    const fullResult = normalizeErpSettlement(full);
    expect(fullResult.allocations[1].invoiceClearedAmount.amount).toBe('7.891');
    expect(fullResult.document.status).toBe('Submitted in fictional ERP');
    expect(original.allocations).toEqual([]);
  });

  it.each(['BankReceipt', 'BankPayment'])('prints a real %s advance with no phantom allocation or balance', kind => {
    const input = fictionalAdvance(kind), project = reopened(input), { fragment, report } = bind(project);
    expect(project.sampleData.allocations).toEqual([]);
    expect(project.sampleData.printRows).toEqual([]);
    expect(report.tableRows).toBe(0);
    expect(text(fragment, 'header-mode')).toBe(kind === 'BankReceipt' ? 'Unallocated customer advance' : 'Unallocated supplier prepayment');
    expect(text(fragment, 'totals-unapplied-amount')).toBe('MYR 75.000');
    expect(text(fragment, 'totals-cash-movement')).toBe('MYR 75.000');
    expect(project.sampleData).not.toHaveProperty('bank');
    expect(project.sampleData).not.toHaveProperty('approval');
    expect(project.sampleData.summary).not.toHaveProperty('remainingBalance');
    expect(project.sampleData.summary).not.toHaveProperty('cashAppliedAmount');
    expect(fragment.querySelector('[data-v3-id="items-amount"]')).toBeNull();
  });

  it.each([fictionalMixedReceipt, fictionalAdjustedPayment])('round-trips all facts and permanently binds each distinct printed monetary meaning', fixture => {
    const input = fixture(), project = createErpSettlementProject(input), restored = readProject(saveProject(project));
    expect(restored.sampleData).toEqual(project.sampleData);
    expect(designOf(restored)).toEqual(designOf(project));
    const { fragment, report } = bind(restored), rows = restored.sampleData.printRows;
    expect(report.tableRows).toBe(rows.length);
    expect([...fragment.querySelectorAll('[data-v3-id="items-amount"]')].map(node => node.textContent)).toEqual(rows.map(row => row.displayAmount));
    expect([...fragment.querySelectorAll('[data-v3-id="items-metric"]')].map(node => node.textContent)).toEqual(rows.map(row => row.label));
    expect(text(fragment, 'header-bank-status')).toBe('Not bank-reconciled');
    expect(text(fragment, 'footer-approval-approved-by')).toBe('Fictional Approver');
    expect(restored.sampleData.source).toEqual(input.source);
    expect(restored.sampleData.approval).toEqual(input.approval);
    expect(text(fragment, 'totals-cash-applied-amount')).toBe(input.summary.cashAppliedAmount.currency + ' ' + input.summary.cashAppliedAmount.amount);
    expect(text(fragment, 'totals-invoice-cleared-amount')).toBeUndefined();
  });

  it.each([['-0.000', 'MYR -0.000'], ['+0.000', 'MYR +0.000'], ['-7.891', 'MYR -7.891'], ['+7.891', 'MYR +7.891']])('keeps supplied sign %s through JSON Open and print', (amount, expected) => {
    const input = fictionalAdvance(); input.summary.unappliedAmount.amount = amount;
    const project = reopened(input), { fragment } = bind(project);
    expect(project.sampleData.summary.unappliedAmount.amount).toBe(amount);
    expect(text(fragment, 'totals-unapplied-amount')).toBe(expected);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])('uses declared precision %i rather than a two-decimal currency formatter', precision => {
    const input = fictionalAdvance(); input.summary.unappliedAmount = m('0', 'MYR', precision);
    const { fragment } = bind(reopened(input));
    expect(text(fragment, 'totals-unapplied-amount')).toBe(`MYR ${precision ? `0.${'0'.repeat(precision)}` : '0'}`);
  });

  it('accepts maintained foreign invoice and primary manifest currencies without conversion', () => {
    const input = fictionalMixedReceipt();
    input.allocations[0].sourceReference.currency = 'GBP';
    for (const key of ['invoiceAppliedAmount', 'invoiceClearedAmount', 'invoiceBalanceBefore', 'invoiceRemainingBalance']) input.allocations[0][key].currency = 'GBP';
    const { fragment } = bind(reopened(input));
    expect([...fragment.querySelectorAll('[data-v3-id="items-amount"]')].map(node => node.textContent)).toContain('GBP 100.000');
    const foreign = fictionalAdvance(); foreign.document.currency = 'GBP'; foreign.cashMovement.amount.currency = foreign.summary.unappliedAmount.currency = 'GBP';
    expect(normalizeErpSettlement(foreign).cashMovement.amount.currency).toBe('GBP');
    expect(reopened(foreign).manifest.currency).toBe('GBP');
  });
});

describe('settlement invariants reject ambiguous or lossy inputs before project creation', () => {
  const cases = [
    ['profile absent', data => { delete data.profile; }, 'PROFILE', 'profile'],
    ['profile ambiguous', data => { data.profile = 'guess-paid-amount'; }, 'PROFILE', 'profile'],
    ['source identity absent', data => { delete data.source.id; }, 'TEXT', 'source.id'],
    ['wrong business kind', data => { data.document.kind = 'InternalTransfer'; }, 'SEMANTICS', 'document.kind'],
    ['wrong party type', data => { data.party.type = 'supplier'; }, 'SEMANTICS', 'party.type'],
    ['wrong movement direction', data => { data.cashMovement.direction = 'outflow'; }, 'SEMANTICS', 'cashMovement.direction'],
    ['invalid date', data => { data.document.date = '2026-02-30'; }, 'DATE', 'document.date'],
    ['invalid bank date', data => { data.bank.date = '2026-13-01'; }, 'DATE', 'bank.date'],
    ['unsupported currency', data => { data.cashMovement.amount.currency = 'XYZ'; }, 'CURRENCY', 'cashMovement.amount.currency'],
    ['cash currency mismatch', data => { data.cashMovement.amount.currency = 'USD'; }, 'CURRENCY', 'cashMovement.amount.currency'],
    ['invoice applied currency mismatch', data => { data.allocations[0].invoiceAppliedAmount.currency = 'MYR'; }, 'CURRENCY', 'allocations[0].invoiceAppliedAmount.currency'],
    ['cash applied currency mismatch', data => { data.allocations[0].cashAppliedAmount.currency = 'USD'; }, 'CURRENCY', 'allocations[0].cashAppliedAmount.currency'],
    ['invoice money absent', data => { delete data.allocations[0].invoiceAppliedAmount; }, 'AMOUNT', 'allocations[0].invoiceAppliedAmount'],
    ['precision absent', data => { delete data.allocations[0].invoiceAppliedAmount.minorUnitDigits; }, 'PRECISION', 'allocations[0].invoiceAppliedAmount.minorUnitDigits'],
    ['precision overflow', data => { data.allocations[0].invoiceAppliedAmount.amount = '1.0001'; }, 'AMOUNT_PRECISION', 'allocations[0].invoiceAppliedAmount.amount'],
    ['unsafe amount', data => { data.allocations[0].invoiceAppliedAmount.amount = '9007199254740992.000'; }, 'UNSAFE_AMOUNT', 'allocations[0].invoiceAppliedAmount.amount'],
    ['scientific notation', data => { data.allocations[0].invoiceAppliedAmount.amount = '1e3'; }, 'AMOUNT', 'allocations[0].invoiceAppliedAmount.amount'],
    ['nonfinite amount', data => { data.allocations[0].invoiceAppliedAmount.amount = Infinity; }, 'JSON', 'input.allocations.0.invoiceAppliedAmount.amount'],
    ['full contradicts balance', data => { data.allocations[0].invoiceRemainingBalance.amount = '1.000'; }, 'BALANCE', 'allocations[0].state'],
    ['partial contradicts zero', data => { data.allocations[1].invoiceRemainingBalance.amount = '0.000'; }, 'BALANCE', 'allocations[1].state'],
    ['duplicate identity', data => { data.allocations[1].id = data.allocations[0].id; }, 'IDENTIFIER', 'allocations[1].id'],
    ['cross-kind duplicate identity', data => { data.adjustments[0].id = data.allocations[0].id; }, 'IDENTIFIER', 'adjustments[0].id'],
    ['different party', data => { data.allocations[0].sourceReference.partyId = 'another-fictional-party'; }, 'REFERENCE', 'allocations[0].sourceReference.partyId'],
    ['different company', data => { data.allocations[0].sourceReference.companyId = 'another-fictional-company'; }, 'REFERENCE', 'allocations[0].sourceReference.companyId'],
    ['conflicting reference number', data => { const next = structuredClone(data.allocations[0]); next.id = 'unique-third-allocation'; next.sourceReference.number = 'CONFLICT-FICTIONAL'; data.allocations.push(next); }, 'REFERENCE', 'allocations[2].sourceReference.number'],
    ['unknown allocation reference', data => { data.adjustments[0].allocationId = 'absent-allocation'; }, 'REFERENCE', 'adjustments[0].allocationId'],
    ['wrong adjustment currency', data => { data.adjustments[0].amount.currency = 'USD'; }, 'CURRENCY', 'adjustments[0].amount.currency'],
    ['ambiguous adjustment effect', data => { delete data.adjustments[0].affects; }, 'SEMANTICS', 'adjustments[0].affects'],
    ['unqualified invoice adjustment', data => { delete data.adjustments[0].allocationId; }, 'REFERENCE', 'adjustments[0]'],
    ['conflicting adjustment invoice', data => { data.adjustments[0].sourceReference = { ...data.allocations[1].sourceReference, id: 'different-fictional-invoice' }; }, 'REFERENCE', 'adjustments[0].sourceReference'],
    ['unqualified balance', data => { delete data.summary.balanceBasis; }, 'TEXT', 'summary.balanceBasis'],
    ['unknown monetary meaning', data => { data.summary.total = m('42.000'); }, 'FIELD', 'summary.total'],
    ['unapplied wrong currency', data => { data.summary.unappliedAmount.currency = 'SGD'; }, 'CURRENCY', 'summary.unappliedAmount.currency'],
    ['undefined optional context', data => { data.approval = undefined; }, 'JSON', 'input.approval'],
    ['BigInt', data => { data.cashMovement.amount.amount = 1n; }, 'JSON', 'input.cashMovement.amount.amount'],
    ['numeric negative zero', data => { data.cashMovement.amount.amount = -0; }, 'JSON', 'input.cashMovement.amount.amount'],
    ['cycle', data => { data.notes = data; }, 'JSON', 'input.notes'],
    ['nonplain object', data => { data.bank = new Date(); }, 'JSON', 'input.bank'],
    ['sparse allocations', data => { delete data.allocations[0]; }, 'JSON', 'input.allocations'],
    ['accessor', data => { Object.defineProperty(data, 'notes', { get: () => 'not safely serialized', enumerable: true }); }, 'JSON', 'input.notes']
  ];
  it.each(cases)('rejects %s with a clear field path', (_, change, code, path) => {
    const input = fictionalMixedReceipt(); change(input);
    expect(() => normalizeErpSettlement(input)).toThrow(expect.objectContaining({ code: `ERP_SETTLEMENT_${code}`, path }));
    expect(() => createErpSettlementProject(input)).toThrow(expect.objectContaining({ code: `ERP_SETTLEMENT_${code}`, path }));
  });
  it('requires an explicit unapplied fact for an advance rather than deriving it from cash', () => {
    const input = fictionalAdvance(); delete input.summary;
    expect(() => createErpSettlementProject(input)).toThrow(expect.objectContaining({ code: 'ERP_SETTLEMENT_ADVANCE' }));
  });
});
