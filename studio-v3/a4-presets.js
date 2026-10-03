// Portable, closed layout vocabulary. Presets never contain data or arbitrary CSS.
export const A4_PRESETS = Object.freeze([
  ['SalesQuotation','quotation-letter','Proposal letter','Open letterhead, paired customer details and quotation terms.'],
  ['SalesOrder','order-register','Order register','Compact order register with status and commercial references.'],
  ['DeliveryOrder','dispatch-manifest','Dispatch manifest','Delivery destination, ordered / dispatched / remaining quantities.'],
  ['SalesInvoice','invoice-ledger','Invoice ledger','Split invoice masthead and a clear amount-due ledger.'],
  ['PurchaseOrder','procurement-order','Procurement order','Supplier and receiving address with purchasing approval.'],
  ['PurchaseInvoice','payable-voucher','Payable voucher','Supplier invoice reference with a horizontal payable summary.'],
  ['BankReceipt','receipt-advice','Receipt advice','Centered receipt, allocation ledger and unapplied cash.'],
  ['BankPayment','payment-authority','Payment authority','Payment rail, beneficiary details and approval panel.'],
  ['EnterpriseProject','project-brief','Project brief','Project identity, programme dates and contract scope.'],
  ['ProgressClaim','progress-certificate','Progress statement','Period valuation, retention and cumulative claim summary.']
].map(([documentKind,id,label,description])=>Object.freeze({documentKind,id,label,description})));
export const A4_PRESET_IDS = Object.freeze(A4_PRESETS.map(preset=>preset.id));
export const a4PresetForKind = kind => A4_PRESETS.find(preset=>preset.documentKind === kind) || null;
