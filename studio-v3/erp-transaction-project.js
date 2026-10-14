import { normalizeErpTransaction } from './erp-transaction-adapter.js';
import { transactionError } from './erp-transaction-validation.js';
import { newProject, designOf, compileProject } from './model.js';
import { bindingValidation } from './validation.js';

const titles = Object.freeze({ PurchaseReceipt: 'PURCHASE RECEIPT', PurchaseReturn: 'PURCHASE RETURN', SalesReturn: 'SALES RETURN', CreditNote: 'CREDIT NOTE', DebitNote: 'DEBIT NOTE', Refund: 'CASH REFUND' });
const field = (id, label, pointer) => ({ id: id.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), label, pointer, format: '' });
const optional = (fields, data, base, labels, prefix = '') => {
  for (const [key, label] of Object.entries(labels)) if (Object.hasOwn(data || {}, key)) fields.push(field(`${prefix}${key}`, label, `${base}/${key}`));
};

export function createErpTransactionProject(input) {
  const normalized = normalizeErpTransaction(input), kind = normalized.document.kind;
  if (!['MYR', 'USD', 'SGD', 'EUR', 'CNY', 'JPY'].includes(normalized.document.currency)) {
    throw transactionError('PROJECT_CURRENCY', 'document.currency', 'Studio manifest supports MYR, USD, SGD, EUR, CNY and JPY; linked/base monetary facts may use other supported ISO currencies.');
  }
  const project = newProject(normalized.party.type === 'supplier' ? 'purchase' : 'invoice'), design = designOf(project);
  project.manifest.title = `ERP ${titles[kind]} · Supplied facts`;
  project.manifest.sampleDataTitle = `${normalized.document.number} · supplied transaction`.slice(0, 100);
  project.manifest.currency = normalized.document.currency;
  project.sampleData = normalized;
  design.title = titles[kind];
  design.page = { paper: 'A4', orientation: 'portrait', margins: { top: 22, right: 22, bottom: 22, left: 22 } };
  design.layoutPreset = 'progress-certificate';
  design.repeatHeader = false;
  design.titleStyle = { fontSize: 16, bold: true };
  for (const id of ['header', 'customer', 'totals', 'footer']) design.blocks[id].layout = { columns: 2, gap: 12 };
  design.blocks.totals.keepTogether = true;
  design.blocks.customer.label = 'Source party and explicit ERP effects';
  design.blocks.items.label = 'Linked source, quantities and supplied monetary facts';
  design.blocks.totals.label = 'Actual supplied cash movement';
  design.header = [field('company', 'Company', '/company/name'), field('number', 'Document number', '/document/number'),
    field('date', 'Document date', '/document/date'), field('currency', 'Document presentation currency', '/document/currency'),
    field('source', 'Source system', '/source/system'), field('source-type', 'Source document type', '/source/documentType'),
    field('source-id', 'Source document ID', '/source/id'), field('kind', 'Canonical business kind', '/document/kind')];
  optional(design.header, normalized.document, '/document', { status: 'ERP supplied document status', reference: 'Document reference' });
  design.customer = [field('party', 'Source party', '/party/name'), field('party-id', 'Party ID', '/party/id'),
    field('party-type', 'Party business role', '/party/type'), field('company-id', 'Company ID', '/company/id'),
    field('extent', 'Supplied full / partial scope', '/scope/extent'), field('reason', 'Supplied reason', '/scope/reason'),
    field('inventory', 'ERP inventory direction (not executed here)', '/effects/inventory/direction'),
    field('accounting-basis', 'Party receivable / payable basis', '/effects/accounting/basis'),
    field('accounting', 'Party balance adjustment direction (not posted here)', '/effects/accounting/direction'),
    field('inventory-source', 'Inventory source field', '/effects/inventory/provenance/sourcePath'),
    field('inventory-meaning', 'Inventory provenance meaning', '/effects/inventory/provenance/meaning'),
    field('accounting-source', 'Accounting source field', '/effects/accounting/provenance/sourcePath'),
    field('accounting-meaning', 'Accounting provenance meaning', '/effects/accounting/provenance/meaning')];
  optional(design.customer, normalized.party, '/party', { address: 'Party address' });
  optional(design.customer, normalized.company, '/company', { address: 'Company address', registration: 'Company registration' }, 'company-');
  design.customer.push(field('scope-source', 'Scope source field', '/scope/provenance/sourcePath'), field('scope-meaning', 'Scope provenance meaning', '/scope/provenance/meaning'));
  design.collection = '/printRows';
  design.columns = [
    { ...field('no', '#', './no'), width: 4 },
    { ...field('meaning', 'Supplied meaning / source document', './meaning'), width: 29 },
    { ...field('value', 'Quantity / currency amount', './value'), width: 20, valueStyle: { align: 'right' } },
    { ...field('direction', 'Explicit direction', './direction'), width: 12 },
    { ...field('trace', 'Source identity / provenance', './trace'), width: 35 }
  ];
  design.totals = [];
  if (normalized.cashMovement) {
    design.totals.push(field('cash-movement', 'Actual cash movement', '/cashMovement/amount/displayAmount'),
      field('cash-direction', 'Cash direction', '/cashMovement/direction'),
      field('cash-source', 'Cash source field', '/cashMovement/amount/provenance/sourcePath'),
      field('cash-meaning', 'Cash provenance meaning', '/cashMovement/amount/provenance/meaning'));
    if (normalized.cashMovement.sourceAmount) design.totals.push(field('source-cash', 'Source-side cash amount (not converted here)', '/cashMovement/sourceAmount/displayAmount'),
      field('source-cash-source', 'Source-side cash field', '/cashMovement/sourceAmount/provenance/sourcePath'),
      field('source-cash-meaning', 'Source-side cash meaning', '/cashMovement/sourceAmount/provenance/meaning'));
  }
  // An absent optional summary remains absent, not a zero amount or a synthetic invoice total.
  design.blocks.totals.enabled = design.totals.length > 0;
  design.footer = [{ id: 'boundary', label: 'Business boundary', pointer: '', format: '', kind: 'static',
    text: 'Read-only ERP-supplied snapshot. No accounting posting, stock movement, refund execution, tax/total/FX calculation or bank reconciliation. Printed status does not certify cash clearance. Original documents remain separate.' }];
  optional(design.footer, normalized.bank, '/bank', { name: 'Bank', account: 'Bank account', transactionReference: 'Bank reference', date: 'Bank reference date', status: 'ERP bank status', paymentMethod: 'Payment method' }, 'bank-');
  optional(design.footer, normalized.approval, '/approval', { status: 'ERP approval status', approvedBy: 'ERP approved by', date: 'Approval date', reference: 'Approval reference' }, 'approval-');
  if (normalized.notes) design.footer.push(field('notes', 'ERP supplied notes', '/notes'));
  const compiled = compileProject(project, design), validation = bindingValidation(compiled);
  if (!validation.valid) throw Object.assign(transactionError('BINDING', 'project', 'Transaction fact bindings are invalid.'), { validation });
  return compiled;
}
