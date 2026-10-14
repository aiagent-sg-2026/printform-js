import { fail, object, text, date, currency, money, has, jsonSafe } from './erp-settlement-validation.js';

export const ERPNEXT_PAYMENT_PROFILE = 'erpnext-payment-entry-v15.0.0-exact-v1';
export const ERPNEXT_PAYMENT_VERSION = '15.0.0';
export const trace = (sourcePath, meaning) => ({ sourcePath, meaning });
export function list(value, path) {
  if (!Array.isArray(value)) fail('SOURCE_ROWS', path, 'Supply an explicit array, including [] when absent.');
  return value;
}
export function submitted(doc, path, type) {
  object(doc, path);
  if (doc.doctype !== type) fail('SOURCE_TYPE', `${path}.doctype`, `Expected native ${type}.`);
  text(doc.name, `${path}.name`); text(doc.company, `${path}.company`);
  date(doc.posting_date, `${path}.posting_date`);
  if (doc.docstatus !== 1) fail('SOURCE_LIFECYCLE', `${path}.docstatus`, 'Only submitted snapshots are supported.');
  if (['Draft', 'Cancelled', 'Canceled'].includes(doc.status)) fail('SOURCE_LIFECYCLE', `${path}.status`, 'Status contradicts the submitted snapshot.');
  return doc;
}
export function children(doc, field, type) {
  const names = new Set();
  return list(doc[field], `document.${field}`).map((row, index) => {
    const path = `document.${field}[${index}]`; object(row, path);
    text(row.name, `${path}.name`);
    if (names.has(row.name)) fail('SOURCE_IDENTITY', `${path}.name`, 'Duplicate native child identity.');
    names.add(row.name);
    for (const [key, value] of Object.entries({ doctype: type, parent: doc.name, parenttype: 'Payment Entry', parentfield: field })) {
      if (row[key] !== value) fail('SOURCE_IDENTITY', `${path}.${key}`, 'Child must belong to the exact native Payment Entry and table.');
    }
    return row;
  });
}
export function sourceAccounts(context, doc) {
  const company = object(context.company, 'context.company');
  if (company.doctype !== 'Company' || company.name !== doc.company) fail('SOURCE_IDENTITY', 'context.company', 'Supply the native document Company snapshot.');
  text(company.company_name, 'context.company.company_name'); currency(company.default_currency, 'context.company.default_currency');
  const accounts = new Map();
  list(context.accounts, 'context.accounts').forEach((account, index) => {
    const path = `context.accounts[${index}]`; object(account, path); text(account.name, `${path}.name`);
    if (account.doctype !== 'Account' || account.company !== doc.company || account.is_group !== 0 || account.disabled !== 0 || accounts.has(account.name)) {
      fail('SOURCE_IDENTITY', path, 'Expected distinct active leaf Account snapshots in the document company.');
    }
    currency(account.account_currency, `${path}.account_currency`); accounts.set(account.name, account);
  });
  return (id, code, path, type) => {
    const account = accounts.get(text(id, path));
    if (!account || account.account_currency !== code || (type && account.account_type !== type)) fail('SOURCE_ACCOUNT', path, 'Account identity, currency or native account type contradicts the supplied document.');
    return account;
  };
}

// Exact decimal export is authoritative; native JSON numbers only establish consistency.
export function paymentFacts(exact, precisionMetadata) {
  object(exact, 'exact');
  object(precisionMetadata, 'context.precisionMetadata', ['fields', 'provenance']);
  object(precisionMetadata.fields, 'context.precisionMetadata.fields');
  object(precisionMetadata.provenance, 'context.precisionMetadata.provenance', ['sourcePath', 'meaning']);
  text(precisionMetadata.provenance.sourcePath, 'context.precisionMetadata.provenance.sourcePath');
  text(precisionMetadata.provenance.meaning, 'context.precisionMetadata.provenance.meaning');
  const used = new Set(), evidence = {};
  const get = (raw, field, path, code, sign = '') => {
    const key = `${path}.${field}`, value = exact[key];
    object(value, `exact.${key}`, ['amount', 'currency', 'precision', 'provenance']);
    if (precisionMetadata.fields[key] !== value.precision) fail('SOURCE_PRECISION', `exact.${key}.precision`, 'Exact amount precision must match the separately supplied field-precision export metadata.');
    text(value.amount, `exact.${key}.amount`);
    if (value.currency !== code) fail('CURRENCY', `exact.${key}.currency`, 'Exact fact must use the native field account/company currency.');
    const parsed = money({ amount: value.amount, currency: code, minorUnitDigits: value.precision, provenance: value.provenance }, `exact.${key}`);
    if (typeof raw[field] !== 'number' || !Number.isFinite(raw[field]) || parsed.amountMinor / 10 ** parsed.minorUnitDigits !== raw[field]) fail('SOURCE_VALUE', key, 'Exact export contradicts the native numeric field.');
    if ((sign === 'positive' && parsed.amountMinor <= 0) || (sign === 'nonnegative' && parsed.amountMinor < 0) || (sign === 'zero' && parsed.amountMinor !== 0)) fail('SOURCE_VALUE', key, `Expected ${sign} supplied fact.`);
    used.add(key); evidence[key] = structuredClone(value);
    return { amount: value.amount, currency: code, minorUnitDigits: value.precision,
      provenance: trace(key, `ERPNext ${ERPNEXT_PAYMENT_VERSION}; exact export ${parsed.provenance.sourcePath}: ${parsed.provenance.meaning}`) };
  };
  return { get, evidence, finish() {
    for (const key of Object.keys(exact)) if (!used.has(key)) fail('SOURCE_FIELD', `exact.${key}`, 'Unused exact fact; unsupported monetary semantics must not be silently discarded.');
    for (const key of Object.keys(precisionMetadata.fields)) if (!used.has(key)) fail('SOURCE_PRECISION', `context.precisionMetadata.fields.${key}`, 'Unused field-precision metadata.');
  } };
}
export function paymentInput(input) {
  jsonSafe(input); object(input, 'input', ['profile', 'context', 'document', 'invoices', 'exact', 'settlements']);
  if (input.profile !== ERPNEXT_PAYMENT_PROFILE || input.context?.erpnextVersion !== ERPNEXT_PAYMENT_VERSION) fail('SOURCE_PROFILE', 'profile', `Expected explicit ${ERPNEXT_PAYMENT_PROFILE} and version ${ERPNEXT_PAYMENT_VERSION}.`);
  object(input.context, 'context', ['erpnextVersion', 'company', 'accounts', 'precisionMetadata']);
  const doc = submitted(input.document, 'document', 'Payment Entry');
  if (!['Receive', 'Pay'].includes(doc.payment_type)) fail('SOURCE_TYPE', 'document.payment_type', 'Only Receive/Customer and Pay/Supplier, never Internal Transfer or refunds.');
  if (doc.status !== 'Submitted') fail('SOURCE_LIFECYCLE', 'document.status', 'v15.0.0 controller sets submitted Payment Entry status to Submitted.');
  const receipt = doc.payment_type === 'Receive';
  if (doc.party_type !== (receipt ? 'Customer' : 'Supplier')) fail('SOURCE_TYPE', 'document.party_type', 'Refunds and other party types require a separately verified profile.');
  text(doc.party, 'document.party'); text(doc.party_name, 'document.party_name');
  if (doc.book_advance_payments_in_separate_party_account !== 0 || doc.apply_tax_withholding_amount !== 0 || list(doc.taxes, 'document.taxes').length) fail('SOURCE_SCOPE', 'document', 'Separate advance-account booking and Payment Entry tax/withholding tables require another verified profile. Native deductions are supported without classification inference.');
  for (const field of ['total_taxes_and_charges', 'base_total_taxes_and_charges']) if (has(doc, field) && doc[field] !== 0) fail('SOURCE_SCOPE', `document.${field}`, 'Nonzero Payment Entry taxes require a separate verified tax profile.');
  for (const field of ['paid_from_account_currency', 'paid_to_account_currency']) currency(doc[field], `document.${field}`);
  for (const field of ['source_exchange_rate', 'target_exchange_rate']) if (typeof doc[field] !== 'number' || !Number.isFinite(doc[field]) || doc[field] <= 0) fail('SOURCE_VALUE', `document.${field}`, 'Supply native positive exchange rates; never calculate FX here.');
  return { doc, receipt };
}
