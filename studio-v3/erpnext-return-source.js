import { fail, object, text, date, currency, money, has, array } from './erp-transaction-validation.js';

export const ERPNEXT_RETURN_PROFILE = 'erpnext-return-v15.0.0-exact-v1';
export const ERPNEXT_RETURN_VERSION = '15.0.0';
export const returnTypes = Object.freeze({
  'Purchase Receipt': { kind: 'PurchaseReturn', party: 'supplier', link: 'purchase_receipt_item' },
  'Sales Invoice': { kind: 'SalesReturn', party: 'customer', link: 'sales_invoice_item' },
  'Purchase Invoice': { kind: 'DebitNote', party: 'supplier', link: 'purchase_invoice_item' }
});
export const trace = (sourcePath, meaning) => ({ sourcePath, meaning });
export function flag(value, path) {
  if (value !== 0 && value !== 1) fail('SOURCE_FLAG', path, 'Supply native ERPNext Check value 0 or 1, not truthy text.');
  return value;
}
export function header(value, path, expectedType) {
  object(value, path);
  if (!has(returnTypes, value.doctype) || (expectedType && value.doctype !== expectedType)) fail('SOURCE_TYPE', `${path}.doctype`, 'Expected a supported native return DocType.');
  for (const key of ['name', 'company', returnTypes[value.doctype].party]) text(value[key], `${path}.${key}`);
  date(value.posting_date, `${path}.posting_date`); currency(value.currency, `${path}.currency`);
  if (value.docstatus !== 1) fail('SOURCE_LIFECYCLE', `${path}.docstatus`, 'Only submitted snapshots are supported; drafts and cancellations are not active return facts.');
  if (['Draft', 'Cancelled', 'Canceled'].includes(value.status)) fail('SOURCE_LIFECYCLE', `${path}.status`, 'Native status contradicts the submitted active snapshot.');
  flag(value.is_return, `${path}.is_return`);
  if (typeof value.conversion_rate !== 'number' || !Number.isFinite(value.conversion_rate) || value.conversion_rate <= 0) fail('SOURCE_VALUE', `${path}.conversion_rate`, 'Supply native positive conversion rate for original-contract equality, never FX calculation.');
  if (typeof value.posting_time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?$/.test(value.posting_time)) fail('SOURCE_VALUE', `${path}.posting_time`, 'Supply a real native posting time to establish original/return order.');
  return value;
}
export function postingStamp(doc) {
  return `${doc.posting_date}T${`${doc.posting_time}${doc.posting_time.includes('.') ? '' : '.'}`.padEnd(15, '0')}`;
}
export function childIndex(doc, path) {
  const names = new Map();
  array(doc.items, `${path}.items`, true).forEach((row, index) => {
    const location = `${path}.items[${index}]`; object(row, location);
    text(row.name, `${location}.name`);
    if (names.has(row.name)) fail('SOURCE_IDENTITY', `${location}.name`, 'Duplicate child row identity.');
    for (const [key, expected] of [['doctype', `${doc.doctype} Item`], ['parent', doc.name], ['parenttype', doc.doctype], ['parentfield', 'items']]) {
      if (row[key] !== expected) fail('SOURCE_IDENTITY', `${location}.${key}`, 'Child row must identify its exact native parent and table.');
    }
    for (const key of ['item_code', 'item_name', 'uom']) text(row[key], `${location}.${key}`);
    names.set(row.name, row);
  });
  return names;
}

// Overlay is authoritative exact export evidence; JSON numbers only check consistency.
export function exactFacts(overlay) {
  object(overlay, 'exact');
  const used = new Set();
  return {
    get(raw, field, path, code, direction, sign = '') {
      const key = `${path}.${field}`, fact = overlay[key];
      object(fact, `exact.${key}`, ['amount', 'precision', 'currency', 'provenance']);
      text(fact.amount, `exact.${key}.amount`);
      if (typeof raw[field] !== 'number' || !Number.isFinite(raw[field])) fail('SOURCE_VALUE', key, 'Supply the native JSON numeric field as well as its exact export overlay.');
      const parsed = money({ amount: fact.amount, currency: code || 'MYR', minorUnitDigits: fact.precision, direction, provenance: fact.provenance }, `exact.${key}`);
      if (code ? fact.currency !== code : has(fact, 'currency')) fail('CURRENCY', `exact.${key}.currency`, code ? 'Overlay currency must match the mapped native field currency.' : 'A quantity has no currency.');
      if (parsed.amountMinor / 10 ** parsed.minorUnitDigits !== raw[field]) fail('SOURCE_VALUE', key, 'Exact export fact contradicts the native numeric snapshot.');
      if (sign === 'negative' && (parsed.amountMinor >= 0 || !fact.amount.startsWith('-'))) fail('SOURCE_RETURN', key, 'Returned quantity must be explicitly negative and nonzero.');
      if (sign === 'nonpositive' && parsed.amountMinor > 0) fail('SOURCE_RETURN', key, 'Return net amount must be nonpositive; a supplied free-item zero is not invented valuation.');
      used.add(key);
      return { amount: fact.amount, currency: code, minorUnitDigits: fact.precision, direction,
        provenance: trace(key, `ERPNext ${ERPNEXT_RETURN_VERSION} supplied field; exact export ${fact.provenance.sourcePath}: ${fact.provenance.meaning}`) };
    },
    finish() {
      for (const key of Object.keys(overlay)) if (!used.has(key)) fail('SOURCE_FIELD', `exact.${key}`, 'Unused overlay field; this profile must not silently discard supplied exact facts.');
    }
  };
}
