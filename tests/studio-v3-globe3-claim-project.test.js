import { describe, expect, it } from 'vitest';
import { createGlobe3CertifiedClaimProject, createGlobe3ProgressClaimProject } from '../studio-v3/globe3-claim-project.js';
import { demoStarterRecords } from '../studio-v3/demo-catalog.js';
import { designOf } from '../studio-v3/model.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { bindingValidation } from '../studio-v3/validation.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { globe3ClaimInput } from './fixtures/globe3-certified-claim.js';

function bind(project) {
  const template = document.createElement('template');
  template.innerHTML = project.templateHtml;
  expect(bindingValidation(project).errors).toEqual([]);
  const { fragment, report } = bindTemplate(template, project.sampleData, project.manifest);
  expect(report.errors).toEqual([]);
  return { fragment, report };
}
const text = (fragment, id) => fragment.querySelector(`[data-v3-id="${id}"]`)?.textContent;
const values = (fragment, id) => [...fragment.querySelectorAll(`[data-v3-id="${id}"]`)].map(node => node.textContent);
const roundTrip = project => readProject(saveProject(project));

function threePlaceCertificate() {
  const input = globe3ClaimInput();
  input.header.curr_decimal = '3';
  input.tabData[0].num_20_2_d0_010 = '123.456';
  input.tabData[1].num_20_2_d0_001 = '-2.345';
  input.tabData[1].num_20_2_d0_002 = '0.000';
  return input;
}

function progressInput(profile = 'globe3-prior-certified') {
  const data = demoStarterRecords('PCAR')[1].data;
  Object.assign(data.document, { sourceType: 'entp_pbill', minorUnitDigits: 3 });
  data.claim.basisProfile = profile;
  data.claim.previousCertificateNumber = 'CERT-FICTIONAL-PRIOR';
  delete data.document.dueDate;
  delete data.document.creditTerms;
  for (const key of Object.keys(data.summary)) if (/paid|outstanding/i.test(key)) delete data.summary[key];
  data.items = data.items.slice(0, 2);
  Object.assign(data.items[0], { previousWork: 91.234, currentWork: -2.345, cumulativeWork: 123.456, amount: 0, currency: 'MYR' });
  Object.assign(data.items[1], { previousWork: 0, currentWork: 7.891, cumulativeWork: 6.543, amount: -4.321, currency: 'MYR' });
  Object.assign(data.summary, { previousClaim: 98.765, currentClaim: -1.234, cumulativeClaim: 234.567, retention: -0.123, onHold: 0, tax: 9.876, total: 18.765 });
  return data;
}

function suppliedData(project) {
  const data = structuredClone(project.sampleData);
  delete data.printAmounts;
  data.items.forEach(row => { delete row.printAmounts; });
  return data;
}

describe('real Globe3 CCAR project and portable print projection', () => {
  it('compiles and reopens the original 17-row financial ledger without rounding or fabricated commodity/balance fields', () => {
    const input = threePlaceCertificate(), before = structuredClone(input);
    const expected = input.tabData.flatMap((row, sourceRowIndex) => Object.keys(row)
      .filter(key => key.startsWith('num_20_2_d0_')).map(column => ({
        section: row.tag_tab_type, sourceRowIndex, column, sourceSlot: Number(column.slice(-3)),
        label: row[`var_100_${column.slice(-3)}`], amountRaw: row[column]
      })));
    const project = createGlobe3CertifiedClaimProject(input), reopened = roundTrip(project);
    expect(input).toEqual(before);
    expect(reopened.sampleData).toEqual(project.sampleData);
    expect(reopened.manifest.studioV3).toEqual(designOf(project));
    for (const candidate of [project, reopened]) {
      const { sampleData } = candidate, { fragment, report } = bind(candidate);
      expect(designOf(candidate).collection).toBe('/financialRows');
      expect(report.tableRows).toBe(17);
      expect(sampleData.financialRows.map(row => ({
        section: row.section, sourceRowIndex: row.sourceRowIndex, column: row.column,
        sourceSlot: row.sourceSlot, label: row.label, amountRaw: row.amountRaw
      }))).toEqual(expected);
      expect(values(fragment, 'items-description')).toEqual(expected.map(row => row.label));
      expect(values(fragment, 'items-amount')).toEqual(expected.map(row => `SGD ${row.amountRaw.split('.')[0]}.${row.amountRaw.split('.')[1].padEnd(3, '0')}`));
      expect(sampleData.financialRows[10]).toMatchObject({ amountMinor: -2345, amount: -2.345, amountRaw: '-2.345' });
      expect(sampleData.financialRows[11]).toMatchObject({ amountMinor: 0, amount: 0, amountRaw: '0.000' });
      expect(sampleData.summary).toMatchObject({ total: 123.456, totalMinor: 123456 });
      expect(text(fragment, 'totals-total')).toBe('SGD 123.456');
      expect(sampleData).not.toHaveProperty('items');
      expect(sampleData).not.toHaveProperty('certification');
      expect(sampleData.summary).not.toHaveProperty('paidAmount');
      expect(sampleData.summary).not.toHaveProperty('outstandingAmount');
      expect(sampleData.document).not.toHaveProperty('dueDate');
      expect(text(fragment, 'header-certified-by')).toBeUndefined();
      expect(text(fragment, 'totals-paid-amount')).toBeUndefined();
      expect(text(fragment, 'totals-outstanding-amount')).toBeUndefined();
      expect(text(fragment, 'footer-recognition')).toBe('not-assessed');
    }
  });

  it('binds only supplied optional certification, independent balances and transaction payment terms after save/open', () => {
    const input = threePlaceCertificate();
    input.header.uniquenum_sec = 'application:fictional';
    input.header.creditterm_desc = 'Fictional transaction settlement snapshot';
    input.header.creditterm_days = 3;
    input.context.receivable = { currency: 'SGD', paidAmount: '0.000', outstandingAmount: '-7.891' };
    input.context.certification = {
      applicationId: 'application:fictional', applicationNumber: 'PCAR-FICTIONAL-37',
      date: '2026-08-17', certifiedBy: 'Independent Reviewer (Fictional)', status: 'Partially certified'
    };
    const project = roundTrip(createGlobe3CertifiedClaimProject(input));
    const { fragment } = bind(project);
    expect(project.sampleData.certification).toEqual(input.context.certification);
    expect(project.sampleData.summary).toMatchObject({ paidAmountMinor: 0, outstandingAmountMinor: -7891 });
    expect(text(fragment, 'totals-paid-amount')).toBe('SGD 0.000');
    expect(text(fragment, 'totals-outstanding-amount')).toBe('SGD -7.891');
    expect(text(fragment, 'header-application')).toBe('PCAR-FICTIONAL-37');
    expect(text(fragment, 'header-certified-by')).toBe(input.context.certification.certifiedBy);
    expect(text(fragment, 'header-certified-date')).toBe('2026-08-17');
    expect(text(fragment, 'header-certified-status')).toBe('Partially certified');
    expect(text(fragment, 'footer-credit-terms')).toBe(input.header.creditterm_desc);
    expect(project.sampleData.document).not.toHaveProperty('dueDate');
    expect(project.sampleData.summary.outstandingAmount).not.toBe(project.sampleData.summary.total - project.sampleData.summary.paidAmount);
  });

  it.each(['paidAmount', 'outstandingAmount'])('does not invent the other balance when only %s is supplied', key => {
    const input = threePlaceCertificate(), other = key === 'paidAmount' ? 'outstandingAmount' : 'paidAmount';
    input.context.receivable = { [key]: '0.000' };
    const project = roundTrip(createGlobe3CertifiedClaimProject(input));
    const { fragment } = bind(project);
    expect(project.sampleData.summary[key]).toBe(0);
    expect(project.sampleData.summary).not.toHaveProperty(other);
    expect(text(fragment, `totals-${key === 'paidAmount' ? 'paid-amount' : 'outstanding-amount'}`)).toBe('SGD 0.000');
    expect(text(fragment, `totals-${other === 'paidAmount' ? 'paid-amount' : 'outstanding-amount'}`)).toBeUndefined();
  });

  it.each([
    ['unsupported currency', input => { input.header.curr_short_forex = 'GBP'; }, 'GLOBE3_CLAIM_CURRENCY'],
    ['unknown numeric profile', input => { input.context.numericSlotPrefix = 'num_unknown_'; }, 'GLOBE3_CLAIM_NUMERIC_PROFILE'],
    ['wrong storage type', input => { input.header.tag_table_usage = input.header.cslsegm = 'entp_pbill'; }, 'GLOBE3_CLAIM_TYPE'],
    ['excess precision', input => { input.tabData[0].num_20_2_d0_010 = '1.2345'; }, 'GLOBE3_CLAIM_AMOUNT_PRECISION']
  ])('rejects %s instead of creating a misleading certificate', (_, change, code) => {
    const input = threePlaceCertificate(); change(input);
    expect(() => createGlobe3CertifiedClaimProject(input)).toThrow(expect.objectContaining({ code }));
  });
});

describe('canonical Globe3 PCAR project preserves supplied valuation profiles', () => {
  it.each([
    ['globe3-prior-certified', 'Previous certified cumulative'],
    ['globe3-stored-last-claim', 'Stored Last Claim']
  ])('prints %s explicitly without recalculating any row or summary amount', (profile, label) => {
    const input = progressInput(profile), before = structuredClone(input);
    const project = createGlobe3ProgressClaimProject(input), reopened = roundTrip(project);
    expect(input).toEqual(before);
    expect(reopened.sampleData).toEqual(project.sampleData);
    expect(reopened.manifest.studioV3).toEqual(designOf(project));
    for (const candidate of [project, reopened]) {
      expect(suppliedData(candidate)).toEqual(before);
      expect(candidate.sampleData.claim.basisProfile).toBe(profile);
      const { fragment, report } = bind(candidate);
      expect(report.tableRows).toBe(2);
      expect(text(fragment, 'label-items-previous')).toBe(label);
      expect(values(fragment, 'items-previous')).toEqual(['MYR 91.234', 'MYR 0.000']);
      expect(values(fragment, 'items-current')).toEqual(['MYR -2.345', 'MYR 7.891']);
      expect(values(fragment, 'items-cumulative')).toEqual(['MYR 123.456', 'MYR 6.543']);
      expect(values(fragment, 'items-amount')).toEqual(['MYR 0.000', 'MYR -4.321']);
      expect(text(fragment, 'totals-previous-claim')).toBe('MYR 98.765');
      expect(text(fragment, 'totals-current-claim')).toBe('MYR -1.234');
      expect(text(fragment, 'totals-cumulative-claim')).toBe('MYR 234.567');
      expect(text(fragment, 'totals-retention')).toBe('MYR -0.123');
      expect(text(fragment, 'totals-on-hold')).toBe('MYR 0.000');
      expect(text(fragment, 'totals-tax')).toBe('MYR 9.876');
      expect(text(fragment, 'totals-total')).toBe('MYR 18.765');
      expect(text(fragment, 'totals-paid-amount')).toBeUndefined();
      expect(text(fragment, 'totals-outstanding-amount')).toBeUndefined();
      expect(text(fragment, 'footer-credit-terms')).toBeUndefined();
      expect(candidate.sampleData).not.toHaveProperty('certification');
      expect(candidate.sampleData.summary).not.toHaveProperty('paidAmount');
      expect(candidate.sampleData.summary).not.toHaveProperty('outstandingAmount');
      expect(candidate.sampleData.summary.currentClaim).not.toBe(candidate.sampleData.summary.cumulativeClaim - candidate.sampleData.summary.previousClaim);
    }
  });

  it('preserves optional independently supplied balances and snapshot terms rather than deriving a due date', () => {
    const input = progressInput();
    Object.assign(input.summary, { paidAmount: 0, outstandingAmount: -8.765 });
    input.document.creditTerms = 'Fictional milestone settlement snapshot';
    const project = roundTrip(createGlobe3ProgressClaimProject(input)), { fragment } = bind(project);
    expect(suppliedData(project)).toEqual(input);
    expect(text(fragment, 'totals-paid-amount')).toBe('MYR 0.000');
    expect(text(fragment, 'totals-outstanding-amount')).toBe('MYR -8.765');
    expect(text(fragment, 'footer-credit-terms')).toBe(input.document.creditTerms);
    expect(project.sampleData.document).not.toHaveProperty('dueDate');
  });

  it.each([
    ['missing profile', data => { delete data.claim.basisProfile; }, 'GLOBE3_CLAIM_BASIS'],
    ['previous-application profile', data => { data.claim.basisProfile = 'previous-application'; }, 'GLOBE3_CLAIM_BASIS'],
    ['unknown profile', data => { data.claim.basisProfile = 'unknown'; }, 'GLOBE3_CLAIM_BASIS'],
    ['wrong storage type', data => { data.document.sourceType = 'entp_pcar'; }, 'GLOBE3_CLAIM_TYPE'],
    ['wrong document kind', data => { data.document.kind = 'CCAR'; }, 'GLOBE3_CLAIM_TYPE'],
    ['summary currency mismatch', data => { data.summary.currency = 'SGD'; }, 'GLOBE3_CLAIM_CURRENCY'],
    ['row currency mismatch', data => { data.items[1].currency = 'SGD'; }, 'GLOBE3_CLAIM_CURRENCY'],
    ['unsupported currency', data => { data.document.currency = 'GBP'; }, 'GLOBE3_CLAIM_CURRENCY'],
    ['unknown precision', data => { data.document.minorUnitDigits = 'three'; }, 'GLOBE3_CLAIM_PRECISION'],
    ['unrepresentable row precision', data => { data.items[0].currentWork = 1.2345; }, 'GLOBE3_CLAIM_AMOUNT_PRECISION'],
    ['unrepresentable summary precision', data => { data.summary.total = 1.2345; }, 'GLOBE3_CLAIM_AMOUNT_PRECISION'],
    ['unknown monetary format', data => { data.items[0].previousWork = '1e3'; }, 'GLOBE3_CLAIM_AMOUNT'],
    ['missing monetary value', data => { delete data.summary.total; }, 'GLOBE3_CLAIM_AMOUNT']
  ])('rejects %s before producing a print projection', (_, change, code) => {
    const input = progressInput(); change(input);
    expect(() => createGlobe3ProgressClaimProject(input)).toThrow(expect.objectContaining({ code }));
  });
});
