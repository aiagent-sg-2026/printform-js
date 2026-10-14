import { adaptGlobe3ProgressClaim } from './globe3-progress-claim-adapter.js';
import { newProject, designOf, compileProject } from './model.js';
import { bindingValidation } from './validation.js';

const field = (id, label, pointer) => ({ id, label, pointer, format: '' });

// Node/bundler integration: rerun for each ERP snapshot, then saveProject/Open in Studio.
export function createGlobe3RawProgressClaimProject(input) {
  const data = adaptGlobe3ProgressClaim(input), currency = data.document.currency;
  if (!['MYR', 'USD', 'SGD', 'EUR', 'CNY', 'JPY'].includes(currency)) throw Object.assign(new Error('Studio cannot round-trip this primary currency.'), { code: 'GLOBE3_PCAR_CURRENCY' });
  const project = newProject('invoice'), design = designOf(project);
  project.manifest.title = 'Globe3 raw PCAR work-done projection';
  project.manifest.sampleDataTitle = `${data.document.number} · supplied SO work done`.slice(0, 100);
  project.manifest.currency = currency; project.sampleData = data;
  project.sampleData.valuations.forEach(row => {
    row.descriptionDisplay = `${row.description}\nSKU: ${row.sku}\nSO quantity: ${row.linkedQuantityRaw}\nUnit rate: ${row.unitPriceDisplay}`;
  });
  design.title = 'PROGRESS CLAIM ACCOUNT RECEIVABLE';
  design.page = { paper: 'A4', orientation: 'landscape', margins: { top: 22, right: 22, bottom: 22, left: 22 } };
  design.layoutPreset = 'progress-certificate'; design.repeatHeader = false; design.collection = '/valuations';
  design.titleStyle = { fontSize: 16, bold: true };
  for (const block of ['header', 'customer', 'totals', 'footer']) design.blocks[block].layout = { columns: 2, gap: 8 };
  design.header = [field('company', 'Company', '/company/name'), field('number', 'PCAR no.', '/document/number'),
    field('date', 'Transaction date', '/document/date'), field('currency', 'Currency', '/document/currency'),
    field('from', 'Period from', '/claim/period/from'), field('to', 'Period to', '/claim/period/to')];
  if (data.document.reference !== undefined) design.header.push(field('reference', 'Reference', '/document/reference'));
  if (data.claim.previousCertificateNumber) design.header.push(field('previous-certificate', 'Previous certificate', '/claim/previousCertificateNumber'));
  design.customer = [field('party', 'Customer', '/customer/name'), field('project', 'Project', '/project/name')];
  const unit = data.claim.workDoneMeasureKind === 'quantity' ? 'qty' : '%';
  design.columns = [
    { ...field('no', '#', './no'), width: 4 }, { ...field('source', 'Exact SO / line', './sourceReference'), width: 12 },
    { ...field('description', 'Supplied work / rate', './descriptionDisplay'), width: 16 },
    { ...field('previous-measure', `Previous ${unit}`, './display/previousMeasure'), width: 7 },
    { ...field('current-measure', `Current ${unit}`, './display/currentMeasure'), width: 7 },
    { ...field('cumulative-measure', `Cumulative ${unit}`, './display/cumulativeMeasure'), width: 7 },
    { ...field('contract-amount', 'SO original amount', './linkedContractDisplay'), width: 11 },
    { ...field('previous-gross', 'Previous gross', './display/previousGross'), width: 11 },
    { ...field('current-gross', 'Current gross', './display/currentGross'), width: 11 },
    { ...field('cumulative-gross', 'Cumulative gross', './display/cumulativeGross'), width: 14 }
  ];
  design.columns.forEach(column => { column.valueStyle = { fontSize: 11, align: column.id === 'description' || column.id === 'source' ? 'left' : 'right' }; });
  design.totals = [field('previous-gross', 'Previous gross valuation', '/summary/display/previousGross'),
    field('current-gross', 'Current gross valuation (not payable)', '/summary/display/currentGross'),
    field('cumulative-gross', 'Cumulative gross valuation', '/summary/display/cumulativeGross')];
  data.headerAmounts.forEach((amount, index) => design.totals.push(field(`header-amount-${index}`, amount.label, `/headerAmounts/${index}/display`)));
  design.footer = [field('basis', 'Previous / Current basis', '/claim/basis'),
    { id: 'accounting-boundary', label: 'Accounting boundary', pointer: '', format: '', kind: 'static', text: 'Gross valuation is not net payable or booked receivables. Printing does not post or recalculate retention, tax, payments or FX.' }];
  if (data.document.creditTerms !== undefined) design.footer.push(field('credit-terms', 'Claim snapshot payment terms', '/document/creditTerms'));
  const compiled = compileProject(project, design), validation = bindingValidation(compiled);
  if (!validation.valid) throw Object.assign(new Error('Raw PCAR work-done bindings are invalid.'), { code: 'GLOBE3_PCAR_BINDING', validation });
  return compiled;
}
