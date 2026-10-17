import { adaptGlobe3CertifiedClaim } from './globe3-claim-adapter.js';
import { newProject, designOf, compileProject } from './model.js';
import { bindingValidation } from './validation.js';
import { claimPrecision, parseClaimAmount, displayClaimAmount } from './globe3-claim-money.js';
import { newDemoProject } from './demo-templates.js';
import { isSupportedCurrency } from './currency-catalog.js';

const field = (id, label, pointer) => ({ id: id.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), label, pointer, format: '' });

// Read-only print projection. Call createBus(project, null, 'imported-data') for host provenance.
export function createGlobe3CertifiedClaimProject(input) {
  const normalized = adaptGlobe3CertifiedClaim(input);
  if (!isSupportedCurrency(normalized.document.currency)) {
    throw Object.assign(new Error('This Studio version cannot round-trip the supplied currency.'), { code: 'GLOBE3_CLAIM_CURRENCY', path: 'header.curr_short_forex' });
  }
  const project = newProject('invoice'), design = designOf(project);
  project.manifest.title = 'Globe3 Certified Claim Account Receivable';
  project.manifest.sampleDataTitle = `${normalized.document.number} · supplied financial ledger`.slice(0, 100);
  project.manifest.currency = normalized.document.currency;
  project.sampleData = {
    ...normalized,
    company: normalized.context.company, customer: normalized.context.customer,
    project: normalized.context.project
  };
  design.title = 'CERTIFIED CLAIM ACCOUNT RECEIVABLE';
  design.page = { paper: 'A4', orientation: 'portrait', margins: { top: 22, right: 22, bottom: 22, left: 22 } };
  design.layoutPreset = 'progress-certificate';
  design.repeatHeader = false;
  design.titleStyle = { fontSize: 16, bold: true };
  design.blocks.header.layout = { columns: 2, gap: 8 };
  design.blocks.customer.layout = { columns: 2, gap: 12 };
  design.blocks.totals.layout = { columns: 2, gap: 12 };
  design.blocks.totals.keepTogether = true;
  design.header = [field('company', 'Company', '/company/name'), field('number', 'CCAR no.', '/document/number'),
    field('date', 'Transaction date', '/document/date'), field('currency', 'Currency', '/document/currency'),
    field('claim', 'Claim number', '/claim/number'), field('period-from', 'Period from', '/claim/period/from'),
    field('period-to', 'Period to', '/claim/period/to'), field('reference', 'Reference', '/document/reference')];
  design.customer = [field('bill', 'Customer', '/customer/name'), field('project', 'Project', '/project/name')];
  if (normalized.claim.sourceDocumentNumber) design.header.push(field('application', 'PCAR application', '/claim/sourceDocumentNumber'));
  if (normalized.certification) design.header.push(field('certified-by', 'Certified by', '/certification/certifiedBy'),
    field('certified-date', 'Certified on', '/certification/date'), field('certified-status', 'Certification status', '/certification/status'));
  design.collection = '/financialRows';
  // No fabricated scm_sal_data item rows. Exact decimal display comes from supplied curr_decimal.
  design.columns = [
    { ...field('no', '#', './no'), width: 6 }, { ...field('section', 'ERP section', './section'), width: 20 },
    { ...field('description', 'Supplied financial label', './label'), width: 49 },
    { ...field('amount', 'Supplied amount', './displayAmount'), width: 25, valueStyle: { align: 'right' } }
  ];
  design.totals = [field('total', 'Certificate amount (not ledger balance)', '/summary/displayAmounts/total')];
  for (const [key, label] of [['paidAmount', 'Ledger paid'], ['outstandingAmount', 'Ledger outstanding']]) {
    if (Object.hasOwn(normalized.summary, key)) design.totals.push(field(key, label, `/summary/displayAmounts/${key}`));
  }
  design.footer = [field('recognition', 'Accounting recognition', '/claim/accountingRecognition')];
  if (normalized.document.creditTerms) design.footer.push(field('credit-terms', 'Claim snapshot payment terms', '/document/creditTerms'));
  const compiled = compileProject(project, design), validation = bindingValidation(compiled);
  if (!validation.valid) throw Object.assign(new Error('Normalized claim bindings are invalid.'), { code: 'GLOBE3_CLAIM_BINDING', validation });
  return compiled;
}

// Canonical PCAR projection: upstream resolves the matching prior certificate or stored Last Claim.
// Supplied valuation/retention/tax/payment values are copied, never recalculated.
export function createGlobe3ProgressClaimProject(data) {
  if (data?.document?.kind !== 'PCAR' || data.document.sourceType !== 'entp_pbill') {
    throw Object.assign(new Error('PCAR requires the Progress Claim storage type entp_pbill.'), { code: 'GLOBE3_CLAIM_TYPE' });
  }
  const profile = data.claim?.basisProfile;
  if (!['globe3-prior-certified', 'globe3-stored-last-claim'].includes(profile)) {
    throw Object.assign(new Error('Choose an evidence-backed Previous/Current basis.'), { code: 'GLOBE3_CLAIM_BASIS' });
  }
  const precision = claimPrecision(data.document.minorUnitDigits), currency = data.document.currency;
  if (!isSupportedCurrency(currency)) {
    throw Object.assign(new Error('This Studio version cannot round-trip the supplied currency.'), { code: 'GLOBE3_CLAIM_CURRENCY' });
  }
  const project = newDemoProject('PCAR'), design = designOf(project);
  project.manifest.title = 'Globe3 Progress Claim Account Receivable';
  project.manifest.sampleDataTitle = `${data.document.number} · supplied valuation`.slice(0, 100);
  project.manifest.currency = currency;
  project.sampleData = structuredClone(data);
  if (data.summary?.currency !== undefined && data.summary.currency !== currency) {
    throw Object.assign(new Error('Document and supplied valuation currency must match.'), { code: 'GLOBE3_CLAIM_CURRENCY' });
  }
  design.header = [field('company', 'Company', '/company/name'), field('number', 'PCAR no.', '/document/number'),
    field('date', 'Transaction date', '/document/date'), field('currency', 'Currency', '/document/currency')];
  design.customer = [field('bill', 'Customer', '/customer/name'), field('project', 'Project', '/project/name')];
  if (data.claim.previousCertificateNumber !== undefined) design.header.push(field('previous-certificate', 'Previous certificate', '/claim/previousCertificateNumber'));
  const format = (value, path) => displayClaimAmount(parseClaimAmount(value, precision, path).amountMinor, precision, currency);
  if (!Array.isArray(data.items)) throw Object.assign(new Error('Supplied PCAR valuation rows are required.'), { code: 'GLOBE3_CLAIM_ROWS' });
  project.sampleData.items.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw Object.assign(new Error(`Invalid PCAR row ${index}.`), { code: 'GLOBE3_CLAIM_ROWS' });
    if (row.currency !== undefined && row.currency !== currency) throw Object.assign(new Error(`PCAR row ${index} uses a different currency.`), { code: 'GLOBE3_CLAIM_CURRENCY' });
    row.printAmounts = {};
    for (const key of ['previousWork', 'currentWork', 'cumulativeWork', 'amount']) row.printAmounts[key] = format(row[key], `items[${index}].${key}`);
  });
  design.columns.forEach(column => {
    if (['previous', 'current', 'cumulative', 'amount'].includes(column.id)) {
      column.pointer = `./printAmounts/${{previous:'previousWork',current:'currentWork',cumulative:'cumulativeWork',amount:'amount'}[column.id]}`;
      column.format = '';
    }
  });
  design.columns.find(column => column.id === 'previous').label = profile === 'globe3-prior-certified' ? 'Previous certified cumulative' : 'Stored Last Claim';
  const required = ['previousClaim', 'currentClaim', 'cumulativeClaim', 'retention', 'tax', 'total'];
  project.sampleData.printAmounts = {};
  for (const key of [...required, 'onHold', 'paidAmount', 'outstandingAmount']) {
    if (!required.includes(key) && !Object.hasOwn(data.summary || {}, key)) continue;
    project.sampleData.printAmounts[key] = format(data.summary?.[key], `summary.${key}`);
  }
  design.totals = required.map(key => field(key, {previousClaim:'Previous net',currentClaim:'Current net',cumulativeClaim:'Cumulative net',retention:'Current retention',tax:'Supplied tax',total:'Application total'}[key], `/printAmounts/${key}`));
  for (const [key, label] of [['onHold','Current on-hold'],['paidAmount','ERP supplied paid'],['outstandingAmount','ERP supplied balance']]) {
    if (Object.hasOwn(project.sampleData.printAmounts, key)) design.totals.push(field(key, label, `/printAmounts/${key}`));
  }
  design.footer = [{id:'recognition',label:'Accounting boundary',pointer:'',format:'',kind:'static',text:'Print projection only; printing does not determine accounting recognition or post receivables.'}];
  if (data.document.creditTerms !== undefined) design.footer.push(field('credit-terms', 'Claim snapshot payment terms', '/document/creditTerms'));
  const compiled = compileProject(project, design), validation = bindingValidation(compiled);
  if (!validation.valid) throw Object.assign(new Error('Supplied PCAR bindings are invalid.'), { code: 'GLOBE3_CLAIM_BINDING', validation });
  return compiled;
}
