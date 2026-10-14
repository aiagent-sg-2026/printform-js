import { ERPNEXT_PAYMENT_PROFILE } from '../../studio-v3/erpnext-payment-source.js';

const provenance = sourcePath => ({ sourcePath: `fictional-authorized-export:${sourcePath}`, meaning: 'Fictional supplied exact export; not a real ERP, bank or approval.' });
const amount = (value, currency, precision = 3) => ({ amount: value, currency, minorUnitDigits: precision, provenance: provenance('settlement-state') });
export const paymentEntryCases = [
  ['receive-multi', 'Receive', false], ['pay-multi-deduction', 'Pay', false],
  ['receive-advance', 'Receive', true], ['pay-prepayment', 'Pay', true],
  ['receive-foreign-invoice', 'Receive', false, true], ['pay-foreign-invoice', 'Pay', false, true]
];
export function fictionalErpNextPayment(paymentType = 'Receive', advance = false, foreignInvoice = false) {
  const receipt = paymentType === 'Receive', partyType = receipt ? 'Customer' : 'Supplier';
  const name = `PE-${receipt ? 'RECEIVE' : 'PAY'}-${advance ? 'ADVANCE' : 'MULTI'}-F`, company = 'Fictional Garden';
  const party = receipt ? 'F-CUSTOMER' : 'F-SUPPLIER', partyAccount = receipt ? 'F-RECEIVABLE-USD' : 'F-PAYABLE-USD';
  const base = foreignInvoice ? (receipt ? '250.000' : '251.234') : receipt || advance ? '337.500' : '338.734';
  const companyCurrency = foreignInvoice ? 'USD' : 'SGD';
  const feeAccount = `F-FEES-${companyCurrency}`;
  const document = { doctype: 'Payment Entry', name, company, payment_type: paymentType, party_type: partyType,
    party, party_name: `Fictional ${partyType}`, docstatus: 1, status: 'Submitted', posting_date: '2026-10-15',
    paid_from: receipt ? partyAccount : 'F-BANK-MYR', paid_to: receipt ? 'F-BANK-MYR' : partyAccount,
    paid_from_account_currency: receipt ? 'USD' : 'MYR', paid_to_account_currency: receipt ? 'MYR' : 'USD',
    source_exchange_rate: receipt ? (foreignInvoice ? 1 : 1.35) : foreignInvoice ? 0.251234 : advance ? 0.3375 : 0.338734,
    target_exchange_rate: receipt ? (foreignInvoice ? 0.25 : 0.3375) : foreignInvoice ? 1 : 1.35,
    book_advance_payments_in_separate_party_account: 0, apply_tax_withholding_amount: 0, taxes: [],
    references: [], deductions: [], reference_no: 'F-BANK-REF-15', reference_date: '2026-10-15', mode_of_payment: 'Fictional bank transfer' };
  const input = { profile: ERPNEXT_PAYMENT_PROFILE, context: { erpnextVersion: '15.0.0',
    company: { doctype: 'Company', name: company, company_name: company, default_currency: companyCurrency },
    accounts: [
      { doctype: 'Account', name: partyAccount, company, account_currency: 'USD', account_type: receipt ? 'Receivable' : 'Payable', is_group: 0, disabled: 0 },
      { doctype: 'Account', name: 'F-BANK-MYR', company, account_currency: 'MYR', account_type: 'Bank', is_group: 0, disabled: 0 },
      { doctype: 'Account', name: feeAccount, company, account_currency: companyCurrency, account_type: 'Expense Account', is_group: 0, disabled: 0 }
    ], precisionMetadata: { fields: {}, provenance: provenance('native-field-precision') } }, document, invoices: [], exact: {}, settlements: {} };
  const put = (row, field, path, value, code, precision = 3) => {
    row[field] = Number(value);
    const key = `${path}.${field}`;
    input.exact[key] = { amount: value, currency: code, precision, provenance: provenance(key) };
    input.context.precisionMetadata.fields[key] = precision;
  };
  put(document, 'paid_amount', 'document', receipt ? '0250.000' : '1000.000', receipt ? 'USD' : 'MYR');
  put(document, 'received_amount', 'document', receipt ? '1000.000' : '0250.000', receipt ? 'MYR' : 'USD');
  put(document, 'difference_amount', 'document', '0.000', companyCurrency);
  put(document, 'base_paid_amount', 'document', base, companyCurrency);
  put(document, 'base_received_amount', 'document', foreignInvoice ? '250.000' : '337.500', companyCurrency);
  put(document, 'base_total_allocated_amount', 'document', advance ? '0.000' : foreignInvoice ? '225.000' : '303.750', companyCurrency);
  put(document, 'total_allocated_amount', 'document', advance ? '0.000' : '225.000', 'USD');
  put(document, 'unallocated_amount', 'document', advance ? '0250.000' : '025.000', 'USD');
  if (!advance) for (let index = 0; index < 2; index += 1) {
    const invoiceName = `${receipt ? 'SI' : 'PI'}-F-${index + 1}`, invoiceType = receipt ? 'Sales Invoice' : 'Purchase Invoice';
    const invoice = { doctype: invoiceType, name: invoiceName, company, [receipt ? 'customer' : 'supplier']: party,
      currency: foreignInvoice && index ? 'EUR' : 'USD', party_account_currency: 'USD', [receipt ? 'debit_to' : 'credit_to']: partyAccount,
      docstatus: 1, status: index ? 'Partly Paid' : 'Paid', is_return: 0, posting_date: '2026-10-01',
      grand_total: index ? (foreignInvoice ? 160 : 200) : 100, outstanding_amount: index ? 75 : 0,
      conversion_rate: foreignInvoice ? (index ? 1.25 : 1) : 1.35 };
    input.invoices.push(invoice);
    const row = { doctype: 'Payment Entry Reference', name: `${name}-REF-${index + 1}`, parent: name,
      parenttype: 'Payment Entry', parentfield: 'references', reference_doctype: invoiceType, reference_name: invoiceName,
      account: partyAccount, payment_term: '' };
    document.references.push(row);
    const path = `document.references[${index}]`;
    put(row, 'allocated_amount', path, index ? '125.000' : '100.000', 'USD');
    put(row, 'outstanding_amount', path, index ? '75.000' : '0.000', 'USD');
    put(row, 'total_amount', path, index ? '200.000' : '100.000', 'USD');
    input.settlements[row.name] = { state: index ? 'partial' : 'full', remainingAmount: amount(index ? (foreignInvoice ? '60.000' : '75.000') : '0.000', invoice.currency),
      ...(foreignInvoice && index ? { invoiceAppliedAmount: amount('100.000', 'EUR') } : {}) };
  }
  if (!receipt && !advance) {
    const row = { doctype: 'Payment Entry Deduction', name: `${name}-FEE`, parent: name, parenttype: 'Payment Entry', parentfield: 'deductions',
      account: feeAccount, cost_center: 'Fictional Main', description: 'Fictional supplied bank charge (description only)' };
    document.deductions.push(row); put(row, 'amount', 'document.deductions[0]', '1.234', companyCurrency);
  }
  return input;
}
