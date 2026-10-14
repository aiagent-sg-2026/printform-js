import { normalizeErpSettlement, settlementSummaryLabels } from './erp-settlement-adapter.js';
import { settlementError } from './erp-settlement-validation.js';
import { newProject, designOf, compileProject } from './model.js';
import { bindingValidation } from './validation.js';

const field = (id, label, pointer) => ({ id: id.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), label, pointer, format: '' });
const optional = (fields, data, base, labels, prefix = '') => {
  for (const [key, label] of Object.entries(labels)) if (Object.hasOwn(data || {}, key)) fields.push(field(`${prefix}${key}`, label, `${base}/${key}`));
};

// Existing Studio Open/save/export consumes this project without a database adapter.
export function createErpSettlementProject(input) {
  const normalized = normalizeErpSettlement(input);
  if (!['MYR', 'USD', 'SGD', 'EUR', 'CNY', 'JPY'].includes(normalized.document.currency)) {
    throw settlementError('PROJECT_CURRENCY', 'document.currency', 'Studio portable manifest supports MYR, USD, SGD, EUR, CNY and JPY; normalization itself supports other ISO currencies.');
  }
  const receipt = normalized.document.kind === 'BankReceipt';
  const project = newProject(receipt ? 'invoice' : 'purchase'), design = designOf(project);
  project.manifest.title = receipt ? 'ERP Bank Receipt · Pilot' : 'ERP Bank Payment · Pilot';
  project.manifest.sampleDataTitle = `${normalized.document.number} · supplied settlement`.slice(0, 100);
  project.manifest.currency = normalized.document.currency;
  project.sampleData = normalized;
  design.title = receipt ? 'BANK RECEIPT — PILOT' : 'BANK PAYMENT — PILOT';
  design.page = { paper: 'A4', orientation: 'portrait', margins: { top: 22, right: 22, bottom: 22, left: 22 } };
  design.layoutPreset = 'progress-certificate';
  design.repeatHeader = false;
  design.titleStyle = { fontSize: 16, bold: true };
  design.blocks.header.layout = { columns: 2, gap: 8 };
  design.blocks.customer.layout = { columns: 2, gap: 12 };
  design.blocks.totals.layout = { columns: 2, gap: 12 };
  design.blocks.footer.layout = { columns: 2, gap: 12 };
  design.blocks.totals.keepTogether = true;
  design.blocks.items.label = 'Allocations and ERP adjustments';
  design.header = [field('company', 'Company', '/company/name'), field('number', 'Payment document', '/document/number'),
    field('date', 'Document date', '/document/date'), field('currency', 'Cash currency', '/document/currency'),
    field('mode', 'Settlement context', '/printMode'), field('source', 'Source system', '/source/system'),
    field('source-type', 'Source business document type', '/source/documentType'), field('source-id', 'Source document ID', '/source/id')];
  optional(design.header, normalized.document, '/document', { reference: 'Document reference', status: 'ERP document status' });
  optional(design.header, normalized.bank, '/bank', { name: 'Bank', account: 'Bank account', transactionReference: 'Bank reference', date: 'Bank reference date', status: 'ERP bank status', paymentMethod: 'Payment method' }, 'bank-');
  design.customer = [field('party', receipt ? 'Received from' : 'Paid to', '/party/name'), field('party-id', 'Source party ID', '/party/id')];
  optional(design.customer, normalized.party, '/party', { address: 'Party address' });
  optional(design.customer, normalized.company, '/company', { id: 'Company ID', address: 'Company address', registration: 'Company registration' }, 'company-');
  design.collection = '/printRows';
  design.columns = [
    { ...field('no', '#', './no'), width: 5 }, { ...field('section', 'Fact type', './section'), width: 14 },
    { ...field('reference', 'Source reference', './reference'), width: 29 },
    { ...field('metric', 'Supplied meaning', './label'), width: 30 },
    { ...field('amount', 'Supplied amount', './displayAmount'), width: 22, valueStyle: { align: 'right' } }
  ];
  // A zero-allocation advance has an empty collection, never a fictitious invoice/item.
  design.totals = [field('cash-movement', receipt ? 'Cash movement · inflow' : 'Cash movement · outflow', '/cashMovement/amount/displayAmount')];
  if (normalized.cashMovement.sourceAmount) design.totals.push(field('source-cash', 'Source-side cash amount (ERP supplied)', '/cashMovement/sourceAmount/displayAmount'));
  for (const [key, label] of Object.entries(settlementSummaryLabels)) if (normalized.summary?.[key]) {
    design.totals.push(field(key, label, `/summary/${key}/displayAmount`));
  }
  if (normalized.summary?.balanceBasis) design.totals.push(field('balance-basis', 'Remaining balance meaning (ERP supplied)', '/summary/balanceBasis'));
  design.footer = [{ id: 'boundary', label: 'Accounting boundary', pointer: '', format: '', kind: 'static',
    text: 'Pilot read-only ERP snapshot. No posting, payment execution, reconciliation, tax or FX calculation. Printed status does not certify bank clearance.' }];
  optional(design.footer, normalized.approval, '/approval', { status: 'ERP approval status', approvedBy: 'Approved by (supplied)', date: 'Approval date', reference: 'Approval reference' }, 'approval-');
  if (normalized.notes) design.footer.push(field('notes', 'ERP supplied notes', '/notes'));
  const compiled = compileProject(project, design), validation = bindingValidation(compiled);
  if (!validation.valid) throw Object.assign(settlementError('BINDING', 'project', 'Normalized settlement bindings are invalid.'), { validation });
  return compiled;
}
