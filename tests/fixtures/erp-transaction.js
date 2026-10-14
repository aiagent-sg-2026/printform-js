import { ERP_TRANSACTION_PROFILE, ERP_TRANSACTION_KINDS } from '../../studio-v3/erp-transaction-adapter.js';

// Entirely fictional ERP-supplied snapshots, not connections or claims about actual ledger entries.
export const transactionProvenance = (sourcePath, meaning = 'Fictional ERP supplied fact') => ({ sourcePath, meaning });
export const transactionMoney = (amount, currency = 'USD', minorUnitDigits = 3, direction = 'valuation', sourcePath = 'erp.amount') => ({ amount, currency, minorUnitDigits, direction, provenance: transactionProvenance(sourcePath) });
const quantity = (role, amount, direction, uom = 'Box') => ({ role, amount, uom, decimalPlaces: 3, direction, provenance: transactionProvenance(`erp.items[0].${role}`), warehouse: { id: 'WH-F', name: 'Fictional receiving store' } });
const fact = (id, role, label, amount, direction, currency = 'USD', extra = {}) => ({ id, role, label, amount: transactionMoney(amount, currency, 3, direction, `erp.${id}`), ...extra });

export function fictionalTransaction(kind = 'PurchaseReceipt') {
  if (!ERP_TRANSACTION_KINDS.includes(kind)) throw new Error('Unknown fixture kind');
  const supplier = ['PurchaseReceipt', 'PurchaseReturn', 'DebitNote'].includes(kind);
  const stock = kind === 'PurchaseReturn' ? 'outflow' : ['PurchaseReceipt', 'SalesReturn'].includes(kind) ? 'inflow' : 'none';
  const note = ['CreditNote', 'DebitNote'].includes(kind);
  const originalType = kind === 'PurchaseReceipt' ? 'Purchase Order' : kind === 'PurchaseReturn' ? 'Purchase Receipt' : kind === 'SalesReturn' ? 'Delivery Note' : kind === 'DebitNote' ? 'Purchase Invoice' : 'Sales Invoice';
  const input = {
    profile: ERP_TRANSACTION_PROFILE,
    source: { system: 'Fictional ERPNext', documentType: kind === 'Refund' ? 'Payment Entry' : kind, id: `SRC-F-${kind}` },
    document: { kind, number: `F-${kind}-014`, date: '2026-10-14', currency: kind === 'Refund' ? 'MYR' : 'USD', status: 'Fictional supplied snapshot' },
    company: { id: 'COMP-F', name: 'Fictional Components Ltd', address: 'Fictional company address' },
    party: { id: 'PARTY-F', type: supplier ? 'supplier' : 'customer', name: supplier ? 'Fictional Supplier' : 'Fictional Customer' },
    references: [{ id: 'REF-F-1', role: kind === 'PurchaseReceipt' ? 'order' : kind === 'Refund' ? 'refund-basis' : 'original',
      document: { system: 'Fictional ERPNext', documentType: kind === 'Refund' ? 'Credit Note' : originalType, id: 'ORIG-F-1', number: 'ORIG-F-014', currency: 'USD', date: '2026-10-01', companyId: 'COMP-F', partyId: 'PARTY-F' },
      provenance: transactionProvenance('erp.return_against', 'Original transaction remains separate') }],
    scope: { extent: 'partial', reason: kind === 'PurchaseReceipt' ? 'Partial receipt with rejected goods' : kind === 'Refund' ? 'Partial cash refund of existing customer credit' : 'Partial linked return or price adjustment', provenance: transactionProvenance('erp.scope') },
    effects: {
      inventory: { direction: stock, provenance: transactionProvenance('erp.update_stock', 'ERP supplied inventory effect, not executed here') },
      accounting: { basis: note ? supplier ? 'payable' : 'receivable' : 'none', direction: note ? 'decrease' : 'none', provenance: transactionProvenance('erp.accounting_effect') }
    },
    notes: 'Fictional snapshot only; no source document mutation.'
  };
  if (kind === 'Refund') {
    input.cashMovement = { direction: 'outflow', amount: transactionMoney('130.000', 'MYR', 3, 'outflow', 'erp.paid_amount'), sourceAmount: transactionMoney('30.000', 'USD', 3, 'outflow', 'erp.source_cash') };
    input.allocations = [{ id: 'ALLOC-F-1', sourceReferenceId: 'REF-F-1', amount: transactionMoney('25.000', 'USD', 3, 'outflow', 'erp.allocated_amount'), cashAppliedAmount: transactionMoney('111.000', 'MYR', 3, 'outflow', 'erp.cash_applied'), remainingAmount: transactionMoney('5.000', 'USD', 3, 'balance', 'erp.credit_remaining'), state: 'partial' }];
    input.bank = { transactionReference: 'BANK-F-14', status: 'Not bank-reconciled' };
    return input;
  }
  input.lines = [{ id: 'LINE-F-1', description: note ? 'Price adjustment, goods retained' : 'Fictional control units',
    ...(stock !== 'none' ? { item: { id: 'ITEM-F-1', code: 'CTRL-F', name: 'Fictional control unit' } } : {}),
    sourceReferenceId: 'REF-F-1', sourceLineId: 'ORIG-LINE-F-1',
    quantities: kind === 'PurchaseReceipt' ? [quantity('received', '3.000', stock), quantity('accepted', '2.500', stock), quantity('rejected', '0.500', stock)] : stock !== 'none' ? [quantity('returned', '-1.250', stock)] : [],
    amounts: [fact('RATE-F', 'unitRate', 'Original supplied unit rate', '19.876', 'valuation'), fact('NET-F', 'netAmount', 'ERP supplied line net, not quantity times rate', kind === 'PurchaseReceipt' ? '49.123' : '-7.891', note ? 'decrease' : 'valuation'),
      fact('BASE-F', 'baseAmount', 'ERP base valuation', '-35.670', note ? 'decrease' : 'valuation', 'MYR', { basis: 'Source supplied MYR base value; no FX computation' })] }];
  input.taxes = [fact('TAX-F', 'tax', 'Supplied VAT adjustment', '-0.789', note ? 'decrease' : 'valuation', 'USD', { basis: 'ERP tax snapshot, no rate evaluation', sourceReferenceId: 'REF-F-1' })];
  input.summary = [fact('TOTAL-F', 'grandTotal', 'Supplied transaction total', kind === 'PurchaseReceipt' ? '50.017' : '-8.680', note ? 'decrease' : 'valuation')];
  return input;
}

export function fictionalSupplierRefund() {
  const input = fictionalTransaction('Refund');
  input.party.type = 'supplier'; input.party.name = 'Fictional Supplier';
  input.references[0].document.documentType = 'Debit Note';
  input.scope.reason = 'Supplier repays part of existing supplier credit';
  input.cashMovement.direction = 'inflow';
  input.cashMovement.amount.direction = input.cashMovement.sourceAmount.direction = 'inflow';
  input.allocations[0].amount.direction = input.allocations[0].cashAppliedAmount.direction = 'inflow';
  delete input.bank;
  return input;
}
export function fictionalOdooDebit() {
  const input = fictionalTransaction('DebitNote');
  input.source.system = input.references[0].document.system = 'Fictional Odoo';
  input.effects.accounting.direction = 'increase';
  input.effects.accounting.provenance.meaning = 'Vendor debit increases payable, not ERPNext purchase return';
  input.scope.reason = 'Additional vendor billing adjustment; no goods returned';
  input.lines[0].amounts[1].amount = transactionMoney('7.891', 'USD', 3, 'increase', 'erp.debit_net');
  input.lines[0].amounts[2].amount.direction = input.taxes[0].amount.direction = input.summary[0].amount.direction = 'increase';
  return input;
}
export function fictionalStockCredit() {
  const input = fictionalTransaction('CreditNote');
  input.effects.inventory.direction = 'inflow';
  input.lines[0].description = 'Goods return and receivable adjustment in the same supplied document';
  input.lines[0].item = { id: 'ITEM-F-1', code: 'CTRL-F', name: 'Fictional control unit' };
  input.lines[0].quantities = [quantity('returned', '-1.250', 'inflow', 'Each')];
  return input;
}
export const transactionJourneyCases = [
  ...ERP_TRANSACTION_KINDS.map(kind => [kind, () => fictionalTransaction(kind)]),
  ['SupplierRefund', fictionalSupplierRefund], ['OdooDebitNote', fictionalOdooDebit], ['StockCreditNote', fictionalStockCredit]
];
