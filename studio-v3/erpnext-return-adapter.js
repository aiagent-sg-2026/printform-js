import { normalizeErpTransaction, ERP_TRANSACTION_PROFILE } from './erp-transaction-adapter.js';
import { createErpTransactionProject } from './erp-transaction-project.js';
import { fail, object, text, currency, jsonSafe, has, provenance, array } from './erp-transaction-validation.js';
import { ERPNEXT_RETURN_PROFILE, ERPNEXT_RETURN_VERSION, returnTypes, trace, flag, header, postingStamp, childIndex, exactFacts } from './erpnext-return-source.js';

export { ERPNEXT_RETURN_PROFILE, ERPNEXT_RETURN_VERSION } from './erpnext-return-source.js';
const summaries = Object.freeze({ net_total: 'subtotal', total_taxes_and_charges: 'taxTotal', grand_total: 'grandTotal', rounding_adjustment: 'rounding' });

function mappedReturn(input) {
  jsonSafe(input);
  object(input, 'input', ['profile', 'context', 'document', 'original', 'exact']);
  if (input.profile !== ERPNEXT_RETURN_PROFILE) fail('SOURCE_PROFILE', 'profile', `Supply ${ERPNEXT_RETURN_PROFILE}; other ERPNext versions are not inferred.`);
  const context = object(input.context, 'context', ['erpnextVersion', 'company', 'scope']);
  if (context.erpnextVersion !== ERPNEXT_RETURN_VERSION) fail('SOURCE_PROFILE', 'context.erpnextVersion', 'This adapter is pinned to the upstream 15.0.0 DocType/controller contract.');
  object(context.company, 'context.company', ['id', 'name', 'baseCurrency']);
  currency(context.company.baseCurrency, 'context.company.baseCurrency');
  object(context.scope, 'context.scope', ['extent', 'reason', 'provenance']);
  provenance(context.scope.provenance, 'context.scope.provenance');
  const doc = header(input.document, 'document'), config = returnTypes[doc.doctype];
  const original = header(input.original, 'original', doc.doctype);
  if (doc.is_return !== 1 || original.is_return !== 0) fail('SOURCE_RETURN', 'document.is_return', 'Current document must be a return against a non-return original.');
  if (doc.return_against !== original.name || doc.name === original.name) fail('SOURCE_IDENTITY', 'document.return_against', 'Supply the exact distinct original document identified by return_against.');
  for (const key of ['company', config.party, 'currency', 'conversion_rate']) if (doc[key] !== original[key]) fail(key === 'currency' ? 'CURRENCY' : 'SOURCE_IDENTITY', `original.${key}`, 'Original and return must share their native company, party, document currency and conversion rate.');
  if (context.company.id !== doc.company) fail('SOURCE_IDENTITY', 'context.company.id', 'Company metadata must belong to the native document company.');
  if (postingStamp(doc) < postingStamp(original)) fail('SOURCE_LIFECYCLE', 'document.posting_date', 'Return timestamp cannot precede the original.');
  const invoice = doc.doctype !== 'Purchase Receipt';
  const stock = !invoice || flag(doc.update_stock, 'document.update_stock') === 1;
  if (doc.doctype === 'Sales Invoice') {
    flag(original.update_stock, 'original.update_stock');
    if (stock && original.update_stock !== 1) fail('SOURCE_RETURN', 'document.update_stock', 'The original Sales Invoice did not deliver stock.');
    if (flag(doc.is_pos, 'document.is_pos') !== 0) fail('SOURCE_RETURN', 'document.is_pos', 'POS cash-return execution is outside this read-only return profile.');
  }
  if (doc.doctype === 'Purchase Invoice' && flag(doc.is_paid, 'document.is_paid') !== 0) fail('SOURCE_RETURN', 'document.is_paid', 'Immediate paid-invoice cash facts require a separate cash profile.');
  const originals = childIndex(original, 'original'); childIndex(doc, 'document');
  const facts = exactFacts(input.exact), inventory = stock ? (config.party === 'supplier' ? 'outflow' : 'inflow') : 'none';
  const accounting = invoice ? 'decrease' : 'none';
  const lines = doc.items.map((row, index) => {
    const path = `document.items[${index}]`, sourceLineId = text(row[config.link], `${path}.${config.link}`), linked = originals.get(sourceLineId);
    if (!linked) fail('SOURCE_IDENTITY', `${path}.${config.link}`, 'Original child identity must resolve in the supplied original parent, not by item code or ordinal.');
    for (const field of ['item_code', 'uom']) if (row[field] !== linked[field]) fail('SOURCE_IDENTITY', `${path}.${field}`, 'Returned item/UOM differs from the exact linked original child.');
    if (has(row, 'rejected_qty') && row.rejected_qty !== 0) fail('SOURCE_RETURN', `${path}.rejected_qty`, 'Separate rejected-warehouse movement requires another verified profile; it is not merged into accepted returns.');
    const qty = facts.get(row, 'qty', path, null, 'valuation', 'negative');
    const quantity = { role: stock ? 'returned' : 'billed', amount: qty.amount, decimalPlaces: qty.minorUnitDigits,
      uom: row.uom, direction: stock ? inventory : 'none', provenance: qty.provenance };
    if (stock) quantity.warehouse = { id: text(row.warehouse, `${path}.warehouse`) };
    const amounts = [];
    for (const [field, role, code, direction] of [['rate', 'unitRate', doc.currency, 'valuation'], ['net_amount', 'netAmount', doc.currency, invoice ? 'decrease' : 'valuation'], ['base_net_amount', 'baseAmount', context.company.baseCurrency, invoice ? 'decrease' : 'valuation']]) {
      if (!has(row, field) && field !== 'net_amount') continue;
      const amount = facts.get(row, field, path, code, direction, field === 'net_amount' ? 'nonpositive' : '');
      const fact = { id: `${row.name}:${field}`, label: `ERPNext ${field}`, role, amount };
      if (role === 'baseAmount') fact.basis = 'Supplied company-currency base_net_amount; independent ERP value, not converted here.';
      amounts.push(fact);
    }
    return { id: row.name, description: row.item_name, item: { id: row.item_code, code: row.item_code, name: row.item_name },
      sourceReferenceId: 'erpnext:original', sourceLineId, quantities: [quantity], amounts };
  });
  const result = {
    profile: ERP_TRANSACTION_PROFILE,
    source: { system: `ERPNext ${ERPNEXT_RETURN_VERSION}`, documentType: doc.doctype, id: doc.name },
    document: { kind: config.kind, number: doc.name, date: doc.posting_date, currency: doc.currency },
    company: { id: context.company.id, name: text(context.company.name, 'context.company.name') },
    party: { id: doc[config.party], type: config.party, name: text(doc[`${config.party}_name`], `document.${config.party}_name`) },
    references: [{ id: 'erpnext:original', role: 'original', document: { system: `ERPNext ${ERPNEXT_RETURN_VERSION}`, documentType: original.doctype,
      id: original.name, number: original.name, date: original.posting_date, currency: original.currency, companyId: original.company, partyId: original[config.party] },
    provenance: trace(`document.return_against; document.items[].${config.link}; original.items[].name/parent/parenttype/parentfield`, 'Exact native original parent and child links, not item-code grouping.') }],
    scope: context.scope,
    effects: {
      inventory: { direction: inventory, provenance: trace(invoice ? 'document.is_return/update_stock; document.items[].qty/warehouse' : 'document.is_return; document.items[].qty/warehouse', 'ERPNext submitted return stock effect; no movement executed here.') },
      accounting: { basis: invoice ? (config.party === 'supplier' ? 'payable' : 'receivable') : 'none', direction: accounting,
        provenance: trace('document.doctype/is_return/return_against/docstatus', invoice ? `ERPNext return invoice reduces ${config.party === 'supplier' ? 'supplier payable' : 'customer receivable'}; no posting or refund executed here.` : 'Purchase Receipt return is not a supplier payable adjustment; perpetual-inventory GL is not represented as a payable.') }
    },
    lines
  };
  if (has(doc, 'status')) result.document.status = text(doc.status, 'document.status');
  const summary = [];
  for (const [field, role] of Object.entries(summaries)) if (has(doc, field)) summary.push({ id: `erpnext:${field}`, label: `ERPNext ${field}`, role,
    amount: facts.get(doc, field, 'document', doc.currency, invoice ? 'decrease' : 'valuation') });
  if (has(doc, 'base_grand_total')) summary.push({ id: 'erpnext:base_grand_total', label: 'ERPNext base_grand_total', role: 'baseAmount',
    basis: 'Supplied company-currency base_grand_total; no FX calculation or document-currency conflation.', amount: facts.get(doc, 'base_grand_total', 'document', context.company.baseCurrency, invoice ? 'decrease' : 'valuation') });
  if (summary.length) result.summary = summary;
  if (has(doc, 'taxes')) result.taxes = array(doc.taxes, 'document.taxes').map((row, index) => {
    const path = `document.taxes[${index}]`; object(row, path);
    for (const [key, expected] of [['doctype', doc.doctype === 'Sales Invoice' ? 'Sales Taxes and Charges' : 'Purchase Taxes and Charges'], ['parent', doc.name], ['parenttype', doc.doctype], ['parentfield', 'taxes']]) if (row[key] !== expected) fail('SOURCE_IDENTITY', `${path}.${key}`, 'Tax row must identify the native return parent.');
    const name = text(row.name, `${path}.name`), basis = text(row.description, `${path}.description`);
    return { id: name, label: basis, role: 'tax', basis: `${text(row.charge_type, `${path}.charge_type`)}; ${text(row.account_head, `${path}.account_head`)}; supplied tax_amount only, not recomputed`,
      amount: facts.get(row, 'tax_amount', path, doc.currency, invoice ? 'decrease' : 'valuation') };
  });
  facts.finish();
  return result;
}

/** Pure offline boundary: no fetching, authentication, posting or monetary derivation. */
export function adaptErpNextReturn(input) { return normalizeErpTransaction(mappedReturn(input)); }
export function createErpNextReturnProject(input) { return createErpTransactionProject(mappedReturn(input)); }
