import { normalizeErpSettlement, ERP_SETTLEMENT_PROFILE } from './erp-settlement-adapter.js';
import { createErpSettlementProject } from './erp-settlement-project.js';
import { fail, object, text, currency, has, money } from './erp-settlement-validation.js';
import { ERPNEXT_PAYMENT_VERSION, trace, list, submitted, children, sourceAccounts, paymentFacts, paymentInput } from './erpnext-payment-source.js';

export { ERPNEXT_PAYMENT_PROFILE, ERPNEXT_PAYMENT_VERSION } from './erpnext-payment-source.js';
function mappedPayment(input) {
  const { doc, receipt } = paymentInput(input), context = input.context;
  const account = sourceAccounts(context, doc), companyCurrency = context.company.default_currency;
  const partySide = receipt ? 'paid_from' : 'paid_to', cashSide = receipt ? 'paid_to' : 'paid_from';
  const partyCurrency = doc[`${partySide}_account_currency`], cashCurrency = doc[`${cashSide}_account_currency`];
  account(doc[partySide], partyCurrency, `document.${partySide}`, receipt ? 'Receivable' : 'Payable');
  account(doc[cashSide], cashCurrency, `document.${cashSide}`, 'Bank');
  if (doc.paid_from_account_currency === doc.paid_to_account_currency && doc.paid_amount !== doc.received_amount) fail('SOURCE_VALUE', 'document.received_amount', 'The native same-account-currency branch sets received_amount equal to paid_amount; contradictory submitted snapshots are rejected.');
  const facts = paymentFacts(input.exact, context.precisionMetadata), get = facts.get;
  const paid = get(doc, 'paid_amount', 'document', doc.paid_from_account_currency, 'positive');
  const received = get(doc, 'received_amount', 'document', doc.paid_to_account_currency, 'positive');
  get(doc, 'difference_amount', 'document', companyCurrency, 'zero');
  const unallocated = get(doc, 'unallocated_amount', 'document', partyCurrency, 'nonnegative');
  const allocated = get(doc, 'total_allocated_amount', 'document', partyCurrency, 'nonnegative');
  // Independent company-currency facts remain export evidence, not invented cash/FX totals.
  for (const field of ['base_paid_amount', 'base_received_amount', 'base_total_allocated_amount']) {
    if (has(doc, field)) get(doc, field, 'document', companyCurrency, 'nonnegative');
  }
  for (const [field, code] of [['paid_amount_after_tax', doc.paid_from_account_currency], ['received_amount_after_tax', doc.paid_to_account_currency]]) {
    if (has(doc, field)) get(doc, field, 'document', code, 'positive');
  }
  const invoices = new Map();
  list(input.invoices, 'invoices').forEach((raw, index) => {
    const type = receipt ? 'Sales Invoice' : 'Purchase Invoice', path = `invoices[${index}]`;
    const invoice = submitted(raw, path, type), partyField = receipt ? 'customer' : 'supplier';
    if (invoice.company !== doc.company || invoice[partyField] !== doc.party || invoice.is_return !== 0 || invoices.has(invoice.name)) fail('SOURCE_IDENTITY', path, 'Supply distinct non-return invoices in the exact payment company and party.');
    currency(invoice.currency, `${path}.currency`);
    if (invoice.party_account_currency !== partyCurrency) fail('CURRENCY', `${path}.party_account_currency`, 'Invoice party-account currency must match the native Payment Entry party account; document currency remains independent.');
    if (invoice.currency !== partyCurrency && partyCurrency !== companyCurrency) fail('CURRENCY', `${path}.currency`, 'This verified cross-invoice-currency branch requires a company-currency party account; a different foreign party account is not relabeled.');
    if (invoice[receipt ? 'debit_to' : 'credit_to'] !== doc[partySide]) fail('SOURCE_ACCOUNT', path, 'Invoice receivable/payable account must match the native Payment Entry party account.');
    if (invoice.posting_date > doc.posting_date) fail('SOURCE_LIFECYCLE', `${path}.posting_date`, 'Future-dated invoice linkage is outside this snapshot profile.');
    invoices.set(invoice.name, invoice);
  });
  const linked = new Set(), settlements = has(input, 'settlements') ? input.settlements : {}, usedSettlements = new Set();
  object(settlements, 'settlements');
  const allocations = children(doc, 'references', 'Payment Entry Reference').map((row, index) => {
    const path = `document.references[${index}]`, invoice = invoices.get(row.reference_name);
    if (!invoice || row.reference_doctype !== invoice.doctype) fail('SOURCE_IDENTITY', `${path}.reference_name`, 'Resolve exact native reference_doctype/reference_name in the supplied invoice snapshots.');
    if (row.account !== doc[partySide]) fail('SOURCE_ACCOUNT', `${path}.account`, 'Native reference account must match the party account.');
    if (row.payment_term) fail('SOURCE_SCOPE', `${path}.payment_term`, 'Term-based allocation needs a verified payment-schedule snapshot; no invoice-level full/partial inference.');
    if (linked.has(invoice.name)) fail('SOURCE_IDENTITY', path, 'Duplicate invoice references without payment terms contradict the native duplicate-entry contract.');
    linked.add(invoice.name);
    const allocation = { id: row.name, sourceReference: { system: `ERPNext ${ERPNEXT_PAYMENT_VERSION}`, documentType: invoice.doctype,
      id: invoice.name, number: invoice.name, date: invoice.posting_date, currency: invoice.currency, companyId: invoice.company, partyId: doc.party },
    partyAppliedAmount: get(row, 'allocated_amount', path, partyCurrency, 'positive') };
    if (invoice.currency === partyCurrency) allocation.invoiceAppliedAmount = structuredClone(allocation.partyAppliedAmount);
    // Native outstanding_amount can be refreshed after submit; it is NOT balance-before.
    for (const field of ['outstanding_amount', 'total_amount']) if (has(row, field)) get(row, field, path, partyCurrency, 'nonnegative');
    if (has(row, 'exchange_gain_loss')) get(row, 'exchange_gain_loss', path, companyCurrency);
    if (has(settlements, row.name)) {
      const supplied = settlements[row.name], location = `settlements.${row.name}`;
      object(supplied, location, ['state', 'remainingAmount', 'invoiceAppliedAmount']);
      if (has(supplied, 'invoiceAppliedAmount')) {
        const applied = money(supplied.invoiceAppliedAmount, `${location}.invoiceAppliedAmount`);
        if (!applied.provenance || applied.currency !== invoice.currency || applied.amountMinor <= 0) fail('CURRENCY', `${location}.invoiceAppliedAmount`, 'Supply positive independent invoice-currency applied amount with authorized export provenance.');
        if (invoice.currency === partyCurrency && (applied.amountMinor / 10 ** applied.minorUnitDigits !== row.allocated_amount)) fail('SOURCE_VALUE', location, 'Same-currency supplemental applied amount contradicts the native allocation.');
        allocation.invoiceAppliedAmount = structuredClone(supplied.invoiceAppliedAmount);
      }
      if (has(supplied, 'remainingAmount')) {
        const remaining = money(supplied.remainingAmount, `${location}.remainingAmount`);
        if (!remaining.provenance || remaining.currency !== invoice.currency || remaining.amountMinor < 0) fail('SOURCE_VALUE', location, 'Supply nonnegative invoice-currency remaining balance with authorized export provenance.');
        allocation.invoiceRemainingBalance = structuredClone(supplied.remainingAmount);
      }
      if (has(supplied, 'state')) allocation.state = supplied.state;
      usedSettlements.add(row.name);
    }
    if (!allocation.invoiceAppliedAmount) fail('SOURCE_INVOICE_AMOUNT', `settlements.${row.name}.invoiceAppliedAmount`, 'Native allocated_amount is party-account currency. Supply authorized exact invoice-currency applied amount; conversion is never inferred.');
    return allocation;
  });
  if (!allocations.length && doc.total_allocated_amount !== 0) fail('SOURCE_VALUE', 'document.total_allocated_amount', 'An empty native references table cannot declare a nonzero allocated total.');
  for (const name of invoices.keys()) if (!linked.has(name)) fail('SOURCE_IDENTITY', 'invoices', 'Unused supplied invoice snapshot.');
  for (const name of Object.keys(settlements)) if (!usedSettlements.has(name)) fail('SOURCE_IDENTITY', `settlements.${name}`, 'Settlement state must identify an actual native reference child.');
  const adjustments = children(doc, 'deductions', 'Payment Entry Deduction').map((row, index) => {
    const path = `document.deductions[${index}]`;
    account(row.account, companyCurrency, `${path}.account`); text(row.cost_center, `${path}.cost_center`);
    return { id: row.name, kind: 'other', label: has(row, 'description') && row.description ? text(row.description, `${path}.description`) : 'ERPNext deduction (unclassified)',
      affects: 'ledger', account: row.account, amount: get(row, 'amount', path, companyCurrency) };
  });
  facts.finish();
  const canonical = { profile: ERP_SETTLEMENT_PROFILE, source: { system: `ERPNext ${ERPNEXT_PAYMENT_VERSION}`, documentType: doc.doctype, id: doc.name },
    document: { kind: receipt ? 'BankReceipt' : 'BankPayment', number: doc.name, date: doc.posting_date, currency: cashCurrency, status: doc.status },
    company: { id: doc.company, name: context.company.company_name }, party: { id: doc.party, type: receipt ? 'customer' : 'supplier', name: doc.party_name },
    partyAccount: { id: doc[partySide], currency: partyCurrency, provenance: trace(`document.${partySide}/${partySide}_account_currency; context.accounts`, 'Verified native party leaf account identity and currency, not cash currency.') },
    cashMovement: { direction: receipt ? 'inflow' : 'outflow', amount: receipt ? received : paid, sourceAmount: receipt ? paid : received },
    allocations, adjustments, summary: { partyUnappliedAmount: unallocated, partyAllocatedAmount: allocated },
    bank: { account: doc[cashSide] }, notes: 'Read-only submitted ERPNext snapshot; native deductions are unclassified ledger facts. No inferred FX, balance-before, invoice clearing, bank reconciliation or approval.' };
  for (const [native, key] of [['reference_no', 'transactionReference'], ['reference_date', 'date'], ['mode_of_payment', 'paymentMethod'], ['bank', 'name']]) if (doc[native]) canonical.bank[key] = doc[native];
  const evidence = { version: ERPNEXT_PAYMENT_VERSION, exact: facts.evidence, accounts: structuredClone(context.accounts),
    company: structuredClone(context.company), invoices: structuredClone(input.invoices), settlements: structuredClone(settlements),
    precisionMetadata: structuredClone(context.precisionMetadata),
    document: structuredClone(doc),
  };
  return { canonical, evidence };
}

/** Fixed-tag offline snapshot boundary: no ERP requests, posting, payment, FX or total calculation. */
export function adaptErpNextPaymentEntry(input) {
  const { canonical, evidence } = mappedPayment(input);
  return { ...normalizeErpSettlement(canonical), erpnextEvidence: evidence };
}
export function createErpNextPaymentEntryProject(input) {
  const { canonical, evidence } = mappedPayment(input), project = createErpSettlementProject(canonical);
  project.sampleData.erpnextEvidence = evidence;
  project.manifest.title = `ERPNext 15.0.0 ${canonical.document.kind} · Fictional pilot`;
  return project;
}
