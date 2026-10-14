import { describe, expect, it } from 'vitest';
import { adaptErpNextPaymentEntry, createErpNextPaymentEntryProject } from '../studio-v3/erpnext-payment-adapter.js';
import { normalizeErpSettlement } from '../studio-v3/erp-settlement-adapter.js';
import { fictionalErpNextPayment, paymentEntryCases } from './fixtures/erpnext-payment.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { bindingValidation } from '../studio-v3/validation.js';

const bind = project => {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  const result = bindTemplate(template, project.sampleData, project.manifest);
  expect(result.report.errors).toEqual([]); expect(bindingValidation(project).errors).toEqual([]);
  return result.fragment;
};
const value = (fragment, id) => fragment.querySelector(`[data-v3-id="${id}"]`)?.textContent;
describe('fixed-tag ERPNext Payment Entry exact native facts', () => {
  it.each(paymentEntryCases)('%s creates a portable, bound canonical project without conflating currencies', (_, type, advance, foreignInvoice) => {
    const input = fictionalErpNextPayment(type, advance, foreignInvoice), before = structuredClone(input);
    const normalized = adaptErpNextPaymentEntry(input), project = createErpNextPaymentEntryProject(input);
    const reopened = readProject(saveProject(project)), fragment = bind(reopened);
    expect(input).toEqual(before); expect(reopened.sampleData).toEqual(project.sampleData);
    expect(normalized.document.kind).toBe(type === 'Receive' ? 'BankReceipt' : 'BankPayment');
    expect(normalized.cashMovement.amount.displayAmount).toBe('MYR 1000.000');
    expect(normalized.cashMovement.sourceAmount).toMatchObject({ amount: '0250.000', currency: 'USD' });
    expect(normalized.summary.partyUnappliedAmount).toMatchObject({ amount: advance ? '0250.000' : '025.000', currency: 'USD', minorUnitDigits: 3 });
    expect(value(fragment, 'totals-party-unapplied-amount')).toBe(advance ? 'USD 250.000' : 'USD 25.000');
    expect(value(fragment, 'customer-party-account-currency')).toBe('USD');
    expect(normalized.erpnextEvidence.precisionMetadata).toEqual(input.context.precisionMetadata);
    expect(normalized.summary).not.toHaveProperty('unappliedAmount');
    expect(normalized.summary).not.toHaveProperty('fxDifference');
    expect(normalized).not.toHaveProperty('approval'); expect(normalized.bank).not.toHaveProperty('status');
    expect(normalized.allocations).toHaveLength(advance ? 0 : 2);
    if (advance) expect(fragment.querySelector('[data-v3-id=items-amount]')).toBeNull();
    else {
      expect(normalized.allocations.map(row => row.state)).toEqual(['full', 'partial']);
      expect(normalized.allocations.map(row => row.sourceReference.id)).toEqual(input.invoices.map(row => row.name));
      expect(normalized.allocations[0]).not.toHaveProperty('invoiceBalanceBefore');
      expect(normalized.allocations[0]).not.toHaveProperty('invoiceClearedAmount');
      expect(normalized.allocations[0].invoiceAppliedAmount.provenance.sourcePath).toBe('document.references[0].allocated_amount');
      expect(normalized.allocations[1].partyAppliedAmount).toMatchObject({ amount: '125.000', currency: 'USD' });
      expect(normalized.allocations[1].invoiceAppliedAmount).toMatchObject({ amount: foreignInvoice ? '100.000' : '125.000', currency: foreignInvoice ? 'EUR' : 'USD' });
    }
    if (type === 'Pay' && !advance) {
      expect(value(fragment, 'items-amount')).toBe('USD 100.000');
      expect(normalized.adjustments[0]).toMatchObject({ kind: 'other', affects: 'ledger', account: foreignInvoice ? 'F-FEES-USD' : 'F-FEES-SGD', amount: { currency: foreignInvoice ? 'USD' : 'SGD', amount: '1.234' } });
    }
  });
  const cases = [
    ['version', d => { d.context.erpnextVersion = '15.1.0'; }, 'SOURCE_PROFILE'],
    ['Internal Transfer', d => { d.document.payment_type = 'Internal Transfer'; }, 'SOURCE_TYPE'],
    ['refund', d => { d.document.party_type = 'Supplier'; }, 'SOURCE_TYPE'],
    ['draft', d => { d.document.docstatus = 0; }, 'SOURCE_LIFECYCLE'],
    ['cancelled', d => { d.document.docstatus = 2; }, 'SOURCE_LIFECYCLE'],
    ['status contradiction', d => { d.document.status = 'Paid'; }, 'SOURCE_LIFECYCLE'],
    ['foreign company', d => { d.context.company.name = 'Other'; }, 'SOURCE_IDENTITY'],
    ['account currency contradiction', d => { d.context.accounts[0].account_currency = 'EUR'; }, 'SOURCE_ACCOUNT'],
    ['cash not bank', d => { d.context.accounts[1].account_type = 'Cash'; }, 'SOURCE_ACCOUNT'],
    ['same-currency submitted amount contradiction', d => { d.document.paid_to_account_currency = 'USD'; d.context.accounts[1].account_currency = 'USD'; }, 'SOURCE_VALUE'],
    ['wrong reference parent', d => { d.document.references[0].parent = 'Other'; }, 'SOURCE_IDENTITY'],
    ['duplicate reference child', d => { d.document.references[1].name = d.document.references[0].name; }, 'SOURCE_IDENTITY'],
    ['wrong original invoice', d => { d.invoices[0].name = 'Other'; }, 'SOURCE_IDENTITY'],
    ['wrong original party', d => { d.invoices[0].customer = 'Other'; }, 'SOURCE_IDENTITY'],
    ['wrong original account', d => { d.invoices[0].debit_to = 'Other'; }, 'SOURCE_ACCOUNT'],
    ['invoice currency conversion unknown', d => { d.invoices[0].currency = 'EUR'; }, 'CURRENCY'],
    ['missing exact field', d => { delete d.exact['document.paid_amount']; }, 'SHAPE'],
    ['invoice currency account contradiction', d => { d.invoices[0].party_account_currency = 'EUR'; }, 'CURRENCY'],
    ['precision metadata contradiction', d => { d.exact['document.paid_amount'].precision = 2; }, 'SOURCE_PRECISION'],
    ['precision exceeds declaration', d => { d.exact['document.paid_amount'].amount = '250.0001'; }, 'AMOUNT_PRECISION'],
    ['numeric contradiction', d => { d.document.paid_amount = 251; }, 'SOURCE_VALUE'],
    ['nonzero submission difference', d => { d.document.difference_amount = 1; d.exact['document.difference_amount'].amount = '1.000'; }, 'SOURCE_VALUE'],
    ['missing provenance', d => { delete d.exact['document.paid_amount'].provenance; }, 'SHAPE'],
    ['unused overlay', d => { d.exact['document.unknown'] = d.exact['document.paid_amount']; }, 'SOURCE_FIELD'],
    ['contradictory full state', d => { d.settlements[d.document.references[1].name].state = 'full'; }, 'BALANCE'],
    ['unknown settlement child', d => { d.settlements.Unknown = d.settlements[d.document.references[0].name]; }, 'SOURCE_IDENTITY'],
    ['term-based invoice allocation', d => { d.document.references[0].payment_term = 'Term 1'; }, 'SOURCE_SCOPE'],
    ['tax table', d => { d.document.taxes = [{}]; }, 'SOURCE_SCOPE'],
    ['unknown withholding facts', d => { d.document.apply_tax_withholding_amount = 1; }, 'SOURCE_SCOPE']
  ];
  it.each(cases)('rejects %s before delivering a printable project', (_, mutate, code) => {
    const input = fictionalErpNextPayment(); mutate(input);
    expect(() => createErpNextPaymentEntryProject(input)).toThrow(expect.objectContaining({ code: `ERP_SETTLEMENT_${code}` }));
  });
  it('does not infer full/partial or outstanding-before from native post-submit reference values', () => {
    const input = fictionalErpNextPayment(); delete input.settlements;
    const result = adaptErpNextPaymentEntry(input);
    for (const row of result.allocations) {
      expect(row).not.toHaveProperty('state'); expect(row).not.toHaveProperty('invoiceRemainingBalance');
      expect(row).not.toHaveProperty('invoiceBalanceBefore');
    }
    expect(result.erpnextEvidence.exact['document.references[0].outstanding_amount'].amount).toBe('0.000');
  });
  it('requires independent authorized invoice-currency money, not the native party allocated amount', () => {
    const input = fictionalErpNextPayment('Receive', false, true), row = input.document.references[1];
    delete input.settlements[row.name].invoiceAppliedAmount;
    expect(() => createErpNextPaymentEntryProject(input)).toThrow(expect.objectContaining({ code: 'ERP_SETTLEMENT_SOURCE_INVOICE_AMOUNT' }));
    input.settlements[row.name].invoiceAppliedAmount = { amount: '125.000', currency: 'USD', minorUnitDigits: 3, provenance: { sourcePath: 'F-export', meaning: 'Wrong currency deliberately supplied' } };
    expect(() => createErpNextPaymentEntryProject(input)).toThrow(expect.objectContaining({ code: 'ERP_SETTLEMENT_CURRENCY' }));
  });
  it('enforces party-account currency without weakening canonical cash-unapplied semantics', () => {
    const money = (amount, currency) => ({ amount, currency, minorUnitDigits: 3 });
    const input = { profile: 'erp-supplied-settlement-v1', source: { system: 'Fictional', documentType: 'Payment', id: 'F-1' },
      document: { kind: 'BankReceipt', number: 'F-1', date: '2026-10-15', currency: 'MYR' }, company: { name: 'Fictional' },
      party: { id: 'F-C', type: 'customer', name: 'Fictional customer' }, allocations: [],
      partyAccount: { id: 'F-USD', currency: 'USD', provenance: { sourcePath: 'F-account', meaning: 'Supplied USD party account' } },
      cashMovement: { direction: 'inflow', amount: money('100.000', 'MYR') }, summary: { partyUnappliedAmount: money('25.000', 'USD') } };
    expect(normalizeErpSettlement(input).summary.partyUnappliedAmount.currency).toBe('USD');
    input.summary.partyUnappliedAmount.currency = 'MYR';
    expect(() => normalizeErpSettlement(input)).toThrow(expect.objectContaining({ code: 'ERP_SETTLEMENT_CURRENCY', path: 'summary.partyUnappliedAmount.currency' }));
    input.summary = { unappliedAmount: money('25.000', 'USD') };
    expect(() => normalizeErpSettlement(input)).toThrow(expect.objectContaining({ code: 'ERP_SETTLEMENT_CURRENCY', path: 'summary.unappliedAmount.currency' }));
  });
});
