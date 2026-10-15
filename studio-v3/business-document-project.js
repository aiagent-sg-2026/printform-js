import { normalizeBusinessDocument } from './business-document-adapter.js';
import { businessError } from './business-facts-validation.js';
import { newProject, designOf, compileProject } from './model.js';
import { bindingValidation } from './validation.js';

const titles = { AccountStatement: 'ACCOUNT STATEMENT', StockMovement: 'STOCK MOVEMENT', PayrollSlip: 'PAYROLL SLIP' };
const field = (id, label, pointer) => ({ id, label, pointer, format: '' });
const optional = (fields, data, base, names, prefix = '') => {
  for (const [key, label] of Object.entries(names)) if (Object.hasOwn(data, key)) fields.push(field(`${prefix}${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, label, `${base}/${key}`));
};
export function createBusinessDocumentProject(input) {
  const data = normalizeBusinessDocument(input), kind = data.document.kind;
  const project = newProject(kind === 'StockMovement' ? 'delivery' : 'invoice'), design = designOf(project);
  project.manifest.title = `${titles[kind]} · Supplied facts`;
  project.manifest.sampleDataTitle = `${data.document.number} · supplied facts`.slice(0, 100);
  if (data.document.currency) project.manifest.currency = data.document.currency;
  project.sampleData = data;
  // Declares the actual print collection, including its empty-array shape, using the existing schema profile.
  project.schema = { type: 'object', required: ['profile', 'document', 'source', 'company', 'printRows'], properties: {
    profile: { type: 'string', const: data.profile },
    document: { type: 'object', required: ['kind', 'number', 'date'], properties: {
      kind: { type: 'string', const: kind }, number: { type: 'string', minLength: 1 }, date: { type: 'string', format: 'date' }
    }, additionalProperties: true },
    source: { type: 'object' }, company: { type: 'object' },
    printRows: { type: 'array', maxItems: 10000, items: { type: 'object', required: ['id', 'no', 'section', 'description', 'amount', 'direction', 'trace'], properties: {
      id: { type: 'string', minLength: 1 }, no: { type: 'integer', minimum: 1 },
      ...Object.fromEntries(['section', 'description', 'amount', 'direction', 'trace'].map(key => [key, { type: 'string' }]))
    }, additionalProperties: false } }
  }, additionalProperties: true };
  design.title = titles[kind]; design.logo = null;
  design.page = { paper: 'A4', orientation: 'portrait', margins: { top: 22, right: 22, bottom: 22, left: 22 } };
  design.layoutPreset = 'progress-certificate'; design.repeatHeader = false;
  design.titleStyle = { fontSize: 16, bold: true };
  for (const id of ['header', 'customer', 'footer']) design.blocks[id].layout = { columns: 2, gap: 12 };
  design.blocks.customer.label = 'Explicit business context';
  design.blocks.items.label = 'Supplied source facts (not recalculated)';
  design.header = [field('company', 'Company', '/company/name'), field('number', 'Document number', '/document/number'),
    field('date', 'Document date', '/document/date'), field('kind', 'Business kind', '/document/kind'),
    field('source', 'Source system', '/source/system'), field('source-id', 'Source ID', '/source/id'),
    field('source-type', 'Source type', '/source/documentType'), field('source-number', 'Source number', '/source/number'),
    field('company-id', 'Company ID', '/company/id')];
  optional(design.header, data.document, '/document', { currency: 'Supplied currency', status: 'Supplied status' });
  optional(design.header, data.company, '/company', { address: 'Company address' });
  design.customer = [];
  if (data.statement) {
    design.customer = [field('party', 'Party', '/statement/party/name'), field('party-id', 'Party ID', '/statement/party/id'),
      field('party-role', 'Party role', '/statement/party/role'), field('account', 'Account', '/statement/account/name'),
      field('account-id', 'Account ID', '/statement/account/id'), field('account-basis', 'Account basis', '/statement/account/basis'),
      field('period-from', 'Period from', '/statement/period/from'), field('period-to', 'Period to', '/statement/period/to'),
      field('debit-meaning', 'Supplied debit meaning', '/statement/account/debitMeaning'), field('credit-meaning', 'Supplied credit meaning', '/statement/account/creditMeaning')];
    optional(design.customer, data.statement.party, '/statement/party', { address: 'Party address' });
  }
  if (data.stock) design.customer = [field('purpose', 'Supplied movement purpose', '/stock/purpose')];
  if (data.payroll) {
    design.customer = [field('employee', 'Employee', '/payroll/employee/name'), field('employee-id', 'Employee ID', '/payroll/employee/id'),
      field('period-from', 'Pay period from', '/payroll/period/from'), field('period-to', 'Pay period to', '/payroll/period/to')];
    optional(design.customer, data.payroll.employee, '/payroll/employee', { department: 'Department', jobTitle: 'Job title' });
    optional(design.customer, data.payroll, '/payroll', { payDate: 'Supplied pay date (not proof of payment)' });
  }
  design.collection = '/printRows';
  design.columns = [
    { ...field('no', '#', './no'), width: 4 }, { ...field('section', 'Business fact', './section'), width: 15 },
    { ...field('description', 'Description / supplied basis', './description'), width: 26 },
    { ...field('amount', kind === 'StockMovement' ? 'Supplied quantity / UOM' : 'Supplied amount', './amount'), width: 18, valueStyle: { align: 'right' } },
    { ...field('direction', kind === 'StockMovement' ? 'Direction / locations' : 'Explicit role', './direction'), width: 15 },
    { ...field('trace', 'Source identity / provenance', './trace'), width: 22 }
  ];
  // Summaries are source facts in the same pageable collection, not synthetic invoice totals.
  design.totals = []; design.blocks.totals.enabled = false;
  design.footer = [{ id: 'boundary', kind: 'static', label: 'Production Pilot boundary', pointer: '', format: '',
    text: 'Supplied snapshot only. No ledger reconciliation, FX, stock posting, UOM conversion, payroll/tax calculation or bank/payment execution. Missing balances, totals and payment states are not inferred. Payroll demo identities are fictional.' }];
  if (data.notes) design.footer.push(field('notes', 'Source notes', '/notes'));
  const compiled = compileProject(project, design), validation = bindingValidation(compiled);
  if (!validation.valid) throw Object.assign(businessError('BINDING', 'project', 'Supplied business bindings are invalid.'), { validation });
  return compiled;
}
