// Exact business kinds remain separate from the legacy renderer's three layout families.
export const DEMO_DOCUMENT_KINDS = [
  ['SalesQuotation','Sales quotation','invoice','Proposed scope, validity, prices and quotation terms.'],
  ['SalesOrder','Sales order','invoice','Accepted customer order linked to its quotation.'],
  ['SalesOrderConfirmation','Sales order confirmation','invoice','Acknowledged scope and promised delivery linked to an order.'],
  ['DeliveryOrder','Delivery order','delivery','Partial fulfilment with ordered, dispatched and remaining quantities.'],
  ['DeliveryOrderConfirmation','Delivery order confirmation','delivery','Accepted delivery quantities and proof-of-receipt status.'],
  ['SalesInvoice','Sales invoice','invoice','Invoice for the quantities actually delivered.'],
  ['PurchaseOrder','Purchase order','purchase','Supplier purchase commitment supporting a customer order.'],
  ['PurchaseInvoice','Purchase invoice','purchase','Supplier invoice linked to the corresponding purchase order.'],
  ['BankReceipt','Bank receipt','invoice','Customer receipt with reconciled invoice allocations and unapplied cash.'],
  ['BankPayment','Bank payment','purchase','Supplier payment with reconciled invoice allocations and deposits.'],
  ['EnterpriseProject','Enterprise project','invoice','Project scope, customer, contract value and commercial references.'],
  ['ProgressClaim','Progress claim','invoice','Measured cumulative work, previous claims, retention and current application.'],
  ['CertifiedClaim','Certified claim','invoice','Independently certified cumulative value with an explicit variance from the application.'],
  ['AccountsReceivableClaim','AR claim (generic demo)','invoice','Generic receivable request against a certified amount; no ERP-specific acronym meaning is assumed.'],
  ['AccountsPayableClaim','AP claim (generic demo)','purchase','Generic supplier payable request against a purchase invoice; no ERP-specific acronym meaning is assumed.']
].map(([documentKind,label,baseType,description]) => ({documentKind,kind:documentKind,label,baseType,description,status:'ready'}));
export const PENDING_DEMO_KINDS = ['PCA','CCAR','PCAP','CCAP'].map(kind => ({
  documentKind:kind,kind,label:`${kind} · definition pending`,status:'pending-definition',scenarioCount:0,
  description:'Reserved spoken abbreviation. Confirm the exact ERP document meaning and required fields before adding a template or sample.'
}));
export function demoKind(kind) {
  const definition = DEMO_DOCUMENT_KINDS.find(entry => entry.documentKind === kind);
  if (!definition) throw new Error(`Unknown or undefined demo document kind: ${kind}`);
  return definition;
}
