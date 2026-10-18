import { ERPNEXT_MATERIAL_REQUEST_PROFILE } from '../../studio-v3/erpnext-material-request-adapter.js';

// Invented business identities following pinned upstream fields; not a live ERP receipt.
export function fictionalErpNextMaterialRequest() {
  const name = 'F-MAT-MR-2026-001';
  const items = [8.5, 0].map((qty, index) => ({ doctype: 'Material Request Item', name: `F-MR-CHILD-${index + 1}`,
    parent: name, parenttype: 'Material Request', parentfield: 'items', idx: index + 1,
    item_code: `F-ITEM-${index + 1}`, item_name: `Fictional filter ${index + 1}`, description: `Supplied filter description ${index + 1}`,
    qty, uom: index ? 'kit' : 'Each', schedule_date: index ? '2026-10-27' : '2026-10-24',
    stock_qty: index ? 0 : 85, stock_uom: 'piece', conversion_factor: 10, ordered_qty: index ? 0 : 3,
    received_qty: 0, rate: 7.25, amount: index ? 0 : 61.625,
    ...(index ? {} : { warehouse: 'F-STORES-A', project: 'F-PROJECT-A' }) }));
  const exact = Object.fromEntries(['+0008.500', '-0000.000'].map((amount, index) => [`document.items[${index}].qty`, {
    amount, decimalPlaces: 3, provenance: { sourcePath: `fictional-authorized-export/requested-qty-${index + 1}`,
      meaning: 'Supplied DB decimal spelling and effective field precision; fictional example only' }
  }]));
  return { profile: ERPNEXT_MATERIAL_REQUEST_PROFILE, context: { erpnextVersion: '15.0.0',
    company: { doctype: 'Company', name: 'F-COMPANY', company_name: 'Fictional Workshop' } },
    document: { doctype: 'Material Request', name, company: 'F-COMPANY', material_request_type: 'Purchase',
      transaction_date: '2026-10-18', schedule_date: '2026-10-24', docstatus: 1, status: 'Partially Ordered', items }, exact };
}
