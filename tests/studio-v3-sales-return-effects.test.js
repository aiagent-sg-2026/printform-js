import { describe, it, expect } from 'vitest';
import { normalizeErpTransaction } from '../studio-v3/erp-transaction-adapter.js';
import { fictionalTransaction } from './fixtures/erp-transaction.js';

function invoiceReturn(stock = 'inflow') {
  const input = fictionalTransaction('SalesReturn');
  input.references[0].document.documentType = 'Sales Invoice';
  input.effects.inventory.direction = stock;
  input.effects.accounting.basis = 'receivable';
  input.effects.accounting.direction = 'decrease';
  if (stock === 'none') input.lines[0].quantities = [];
  input.lines[0].amounts.find(fact => fact.role === 'netAmount').amount.direction = 'decrease';
  return input;
}

describe('explicit sales invoice return versus stock-only return', () => {
  it.each(['none', 'inflow'])('accepts receivable reduction with stock effect %s without deriving net from quantity', stock => {
    const result = normalizeErpTransaction(invoiceReturn(stock));
    expect(result.effects.accounting).toMatchObject({ basis: 'receivable', direction: 'decrease' });
    expect(result.effects.inventory.direction).toBe(stock);
    expect(result.lines[0].amounts.find(fact => fact.role === 'netAmount').amount).toMatchObject({ amount: '-7.891', amountMinor: -7891, direction: 'decrease' });
  });
  it('keeps delivery return valuation distinct from receivable reduction', () => {
    const result = normalizeErpTransaction(fictionalTransaction('SalesReturn'));
    expect(result.effects.accounting).toMatchObject({ basis: 'none', direction: 'none' });
    expect(result.lines[0].amounts.find(fact => fact.role === 'netAmount').amount.direction).toBe('valuation');
  });
  it.each([
    ['wrong basis', input => { input.effects.accounting.basis = 'none'; }, 'effects.accounting.basis'],
    ['increase instead of decrease', input => { input.effects.accounting.direction = 'increase'; }, 'effects.accounting.direction'],
    ['valuation instead of invoice net', input => { input.lines[0].amounts.find(fact => fact.role === 'netAmount').amount.direction = 'valuation'; }, 'lines[0].amounts[1].amount.direction'],
    ['missing supplied net', input => { input.lines[0].amounts = input.lines[0].amounts.filter(fact => fact.role !== 'netAmount'); }, 'lines[0].amounts']
  ])('rejects %s', (_label, mutate, path) => {
    const input = invoiceReturn(); mutate(input);
    expect(() => normalizeErpTransaction(input)).toThrow(expect.objectContaining({ path }));
  });
  it('rejects a purported return declaring neither stock nor receivable impact', () => {
    const input = invoiceReturn('none');
    input.effects.accounting.basis = input.effects.accounting.direction = 'none';
    expect(() => normalizeErpTransaction(input)).toThrow(expect.objectContaining({ code: 'ERP_TRANSACTION_SEMANTICS', path: 'effects' }));
  });
});
