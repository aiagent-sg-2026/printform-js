// Fictional export snapshots following the pinned native contract; not live ERP evidence.
export const erpnextCases = [
  ['purchase-receipt-return', 'Purchase Receipt', 1, 'PurchaseReturn', 'outflow', 'none'],
  ['sales-invoice-stock-return', 'Sales Invoice', 1, 'SalesReturn', 'inflow', 'decrease'],
  ['sales-invoice-credit-return', 'Sales Invoice', 0, 'SalesReturn', 'none', 'decrease'],
  ['purchase-invoice-debit-return', 'Purchase Invoice', 0, 'DebitNote', 'none', 'decrease'],
  ['purchase-invoice-stock-debit', 'Purchase Invoice', 1, 'DebitNote', 'outflow', 'decrease']
];
export function fictionalErpNextReturn(doctype = 'Purchase Receipt', updateStock = 1) {
  const party = doctype === 'Sales Invoice' ? 'customer' : 'supplier';
  const prefix = doctype === 'Purchase Receipt' ? 'PR' : doctype === 'Sales Invoice' ? 'SI' : 'PI';
  const link = doctype === 'Purchase Receipt' ? 'purchase_receipt_item' : doctype === 'Sales Invoice' ? 'sales_invoice_item' : 'purchase_invoice_item';
  const originalName = `${prefix}-ORIGINAL-F`, name = `${prefix}-RETURN-F`;
  const child = (parent, line) => ({ name: line, doctype: `${doctype} Item`, parent, parenttype: doctype, parentfield: 'items',
    item_code: 'ITEM-F', item_name: 'Fictional returned component', uom: 'Box', warehouse: 'WH-F', qty: 4, net_amount: 157.196 });
  const original = { doctype, name: originalName, docstatus: 1, is_return: 0, company: 'COMPANY-F', [party]: 'PARTY-F',
    currency: 'USD', conversion_rate: 1.35127, posting_date: '2026-10-01', posting_time: '09:30:00',
    items: [child(originalName, `${prefix}-ORIGINAL-LINE-1`), child(originalName, `${prefix}-ORIGINAL-LINE-2`)] };
  if (doctype !== 'Purchase Receipt') original.update_stock = 1;
  const row = { ...child(name, `${prefix}-RETURN-LINE-1`), qty: -1.25, rejected_qty: 0, rate: 39.299,
    net_amount: -49.123, base_net_amount: -66.378, [link]: `${prefix}-ORIGINAL-LINE-2` };
  const document = { doctype, name, docstatus: 1, is_return: 1, return_against: originalName, company: 'COMPANY-F',
    [party]: 'PARTY-F', [`${party}_name`]: 'Fictional source party', currency: 'USD', conversion_rate: 1.35127,
    posting_date: '2026-10-14', posting_time: '10:00:00', status: 'Return', items: [row],
    net_total: -49.123, total_taxes_and_charges: -2.894, grand_total: -52.017, rounding_adjustment: -0.003, base_grand_total: -70.289,
    taxes: [{ name: `${prefix}-TAX-F`, doctype: doctype === 'Sales Invoice' ? 'Sales Taxes and Charges' : 'Purchase Taxes and Charges',
      parent: name, parenttype: doctype, parentfield: 'taxes', description: 'Supplied return tax', charge_type: 'Actual', account_head: 'TAX-ACCOUNT-F', tax_amount: -2.894 }] };
  if (doctype !== 'Purchase Receipt') document.update_stock = updateStock;
  if (doctype === 'Sales Invoice') document.is_pos = 0;
  if (doctype === 'Purchase Invoice') document.is_paid = 0;
  const exact = {};
  const add = (path, amount, currency) => {
    exact[path] = { amount, precision: 3, ...(currency ? { currency } : {}),
      provenance: { sourcePath: `authorized-exact-export/${name}/${path}`, meaning: 'Supplied lexical decimal and field precision from offline export.' } };
  };
  add('document.items[0].qty', '-1.250');
  add('document.items[0].rate', '39.299', 'USD');
  add('document.items[0].net_amount', '-49.123', 'USD');
  add('document.items[0].base_net_amount', '-66.378', 'SGD');
  add('document.net_total', '-49.123', 'USD');
  add('document.total_taxes_and_charges', '-2.894', 'USD');
  add('document.grand_total', '-52.017', 'USD');
  add('document.rounding_adjustment', '-0.003', 'USD');
  add('document.base_grand_total', '-70.289', 'SGD');
  add('document.taxes[0].tax_amount', '-2.894', 'USD');
  return { profile: 'erpnext-return-v15.0.0-exact-v1', context: { erpnextVersion: '15.0.0',
    company: { id: 'COMPANY-F', name: 'Fictional ERPNext Company', baseCurrency: 'SGD' },
    scope: { extent: 'partial', reason: 'Supplier/customer accepted the supplied partial return.',
      provenance: { sourcePath: `authorized-return-approval/${name}`, meaning: 'Source-approved partial scope; not calculated from quantities.' } } }, document, original, exact };
}
