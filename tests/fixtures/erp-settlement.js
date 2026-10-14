// Authored fictional data only. No copied customer identifiers, balances or bank accounts.
export const settlementMoney = (amount, currency = 'MYR', minorUnitDigits = 3) => ({ amount, currency, minorUnitDigits });
const invoice = (id, number, currency, partyId) => ({
  system: 'FictionalERP', documentType: 'Invoice', id, number, currency, partyId, companyId: 'company-fictional-17'
});
const base = kind => ({
  profile: 'erp-supplied-settlement-v1',
  source: { system: 'FictionalERP', documentType: kind === 'BankReceipt' ? 'Customer Payment Entry' : 'Supplier Payment Entry', id: `fictional-${kind}-17` },
  document: { kind, number: kind === 'BankReceipt' ? 'BR-FICTIONAL-17' : 'BP-FICTIONAL-17', date: '2026-09-14', currency: 'MYR', status: 'Submitted in fictional ERP' },
  company: { id: 'company-fictional-17', name: 'Fictional Meridian Workshop', address: '17 Fictional Lane · Test City' },
  party: { id: kind === 'BankReceipt' ? 'customer-fictional-17' : 'supplier-fictional-17', type: kind === 'BankReceipt' ? 'customer' : 'supplier', name: kind === 'BankReceipt' ? 'Fictional Harbor Customer' : 'Fictional Orchard Supplier' },
  bank: { name: 'Fictional Test Bank', account: 'FICTIONAL-NONBANK-17', transactionReference: 'TRANSFER-FICTIONAL-17', date: '2026-09-14', status: 'Not bank-reconciled', paymentMethod: 'Fictional transfer' },
  approval: { status: 'Approved in fictional ERP', approvedBy: 'Fictional Approver', date: '2026-09-13', reference: 'APPROVAL-FICTIONAL-17' },
  notes: 'Authored Pilot fixture. This is not a production payment or evidence of bank clearance.'
});

export function fictionalMixedReceipt() {
  const input = base('BankReceipt');
  input.cashMovement = { direction: 'inflow', amount: settlementMoney('1150.000'), sourceAmount: settlementMoney('250.000', 'USD') };
  input.allocations = [
    { id: 'allocation-fictional-1', sourceReference: invoice('invoice-fictional-usd', 'INV-FICTIONAL-USD-17', 'USD', input.party.id), state: 'full',
      invoiceAppliedAmount: settlementMoney('100.000', 'USD'), invoiceClearedAmount: settlementMoney('100.000', 'USD'),
      invoiceBalanceBefore: settlementMoney('100.000', 'USD'), invoiceRemainingBalance: settlementMoney('0.000', 'USD'), cashAppliedAmount: settlementMoney('450.000') },
    { id: 'allocation-fictional-2', sourceReference: invoice('invoice-fictional-sgd', 'INV-FICTIONAL-SGD-18', 'SGD', input.party.id), state: 'partial',
      invoiceAppliedAmount: settlementMoney('200.000', 'SGD'), invoiceClearedAmount: settlementMoney('205.000', 'SGD'),
      invoiceBalanceBefore: settlementMoney('300.000', 'SGD'), invoiceRemainingBalance: settlementMoney('95.000', 'SGD'), cashAppliedAmount: settlementMoney('550.000') }
  ];
  input.adjustments = [
    { id: 'withholding-fictional-1', kind: 'withholding', label: 'ERP supplied retention tax', affects: 'invoice', allocationId: 'allocation-fictional-2', amount: settlementMoney('5.000', 'SGD'), account: 'FICTIONAL-WITHHOLDING' },
    { id: 'fee-fictional-1', kind: 'bankFee', label: 'ERP supplied charge', affects: 'cash', amount: settlementMoney('-2.500'), account: 'FICTIONAL-BANK-FEES' },
    { id: 'fx-fictional-1', kind: 'fxGain', label: 'ERP supplied realized FX', affects: 'ledger', amount: settlementMoney('1.234'), account: 'FICTIONAL-FX-GAIN' }
  ];
  input.summary = { cashAppliedAmount: settlementMoney('1000.000'), unappliedAmount: settlementMoney('150.000'),
    remainingBalance: settlementMoney('95.000', 'SGD'), balanceBasis: 'ERP party receivable snapshot in SGD; not unallocated cash', fxDifference: settlementMoney('1.234') };
  return input;
}

export function fictionalAdjustedPayment() {
  const input = base('BankPayment');
  input.cashMovement = { direction: 'outflow', amount: settlementMoney('900.000') };
  input.allocations = [
    { id: 'payment-allocation-fictional-1', sourceReference: invoice('bill-fictional-myr', 'BILL-FICTIONAL-MYR-17', 'MYR', input.party.id), state: 'full',
      invoiceAppliedAmount: settlementMoney('400.000'), invoiceClearedAmount: settlementMoney('410.000'), invoiceRemainingBalance: settlementMoney('0.000'), cashAppliedAmount: settlementMoney('400.000') },
    { id: 'payment-allocation-fictional-2', sourceReference: invoice('bill-fictional-usd', 'BILL-FICTIONAL-USD-18', 'USD', input.party.id), state: 'partial',
      invoiceAppliedAmount: settlementMoney('100.00', 'USD', 2), invoiceClearedAmount: settlementMoney('105.000', 'USD'), invoiceRemainingBalance: settlementMoney('5.000', 'USD'), cashAppliedAmount: settlementMoney('450.000') }
  ];
  input.adjustments = [
    { id: 'discount-fictional-1', kind: 'discount', label: 'ERP approved discount', affects: 'invoice', allocationId: 'payment-allocation-fictional-1', amount: settlementMoney('10.000') },
    { id: 'withholding-fictional-2', kind: 'withholding', label: 'ERP withholding', affects: 'invoice', allocationId: 'payment-allocation-fictional-2', amount: settlementMoney('5.000', 'USD') },
    { id: 'fee-fictional-2', kind: 'bankFee', label: 'Supplied zero bank charge', affects: 'cash', amount: settlementMoney('0.000') },
    { id: 'fx-fictional-2', kind: 'fxLoss', label: 'ERP supplied FX loss', affects: 'ledger', amount: settlementMoney('-3.210') }
  ];
  input.summary = { cashAppliedAmount: settlementMoney('850.000'), unappliedAmount: settlementMoney('50.000'), fxDifference: settlementMoney('-3.210') };
  return input;
}

export function fictionalAdvance(kind = 'BankReceipt') {
  const input = base(kind);
  input.document.number = kind === 'BankReceipt' ? 'BR-FICTIONAL-ADVANCE' : 'BP-FICTIONAL-PREPAYMENT';
  input.cashMovement = { direction: kind === 'BankReceipt' ? 'inflow' : 'outflow', amount: settlementMoney('75.000') };
  input.allocations = [];
  input.summary = { unappliedAmount: settlementMoney('75.000') };
  delete input.approval;
  delete input.bank;
  return input;
}
