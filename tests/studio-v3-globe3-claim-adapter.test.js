import { describe, expect, it } from 'vitest';
import { adaptGlobe3CertifiedClaim } from '../studio-v3/globe3-claim-adapter.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { globe3ClaimInput, mainAmounts, mainLabels, summaryKeys } from './fixtures/globe3-certified-claim.js';

const adapt = input => adaptGlobe3CertifiedClaim(input || globe3ClaimInput());

describe('Globe3 Certified Claim AR projection (not a production ERP endpoint)', () => {
  it('maps entp_pcar to CCAR, never to the similarly named PCAR business abbreviation', () => {
    const input = globe3ClaimInput(), data = adapt(input);
    expect(data.document).toMatchObject({ kind: 'CCAR', baseType: 'CertifiedClaim', sourceType: 'entp_pcar', currency: 'SGD', minorUnitDigits: 2, sourcePrecision: '2' });
    expect(data.claim).toMatchObject({ direction: 'receivable', stage: 'certified', accountingRecognition: 'not-assessed', number: '4', reference: input.header.dnum_reference });
    expect(data).not.toHaveProperty('certification');
    expect(data.claim).not.toHaveProperty('sourceDocumentId');
    delete input.header.tag_table_usage;
    expect(adapt(input).document.kind).toBe('CCAR');
    input.header.tag_table_usage = 'entp_pcar';
    delete input.header.cslsegm;
    expect(adapt(input).document.kind).toBe('CCAR');
  });

  it('builds the full financial ledger without inventing scm_sal_data product lines', () => {
    const input = globe3ClaimInput(), data = adapt(input);
    expect(data).not.toHaveProperty('items');
    expect(data.financialRows).toHaveLength(17);
    expect(data.financialRows.slice(0, 10).map(row => row.label)).toEqual(mainLabels);
    expect(data.financialRows.slice(0, 10).map(row => row.amountRaw)).toEqual(mainAmounts);
    summaryKeys.forEach((key, index) => {
      expect(data.summary[key]).toBe(Number(mainAmounts[index]));
      expect(data.summary.rawAmounts[key]).toBe(mainAmounts[index]);
      expect(Number.isSafeInteger(data.summary[`${key}Minor`])).toBe(true);
    });
    expect(data.financialRows.map(row => row.no)).toEqual(Array.from({ length: 17 }, (_, index) => index + 1));
    expect(new Set(data.financialRows.map(row => row.id)).size).toBe(17);
    expect(data.financialRows[12]).toMatchObject({ section: 'entp_pcar_mc', role: 'advancePayment', amount: -61.2, amountRaw: '-61.20', column: 'num_20_2_d0_001', labelColumn: 'var_100_001', sourceDocumentId: 'cert:fictional', sourceSlot: 1, sourceRowIndex: 2 });
    expect(data.summary.subtotalA).not.toBe(data.summary.workDone + data.summary.variation);
    expect(data.summary.subtotalB).not.toBe(data.summary.subtotalA - data.summary.retention);
    expect(data.summary.total).not.toBe(data.summary.subtotalC + data.summary.tax);
  });

  it('retains caller record order and original slot order even with main in the middle', () => {
    const input = globe3ClaimInput();
    const main = input.tabData.shift();
    input.tabData.splice(2, 0, main);
    const data = adapt(input);
    expect(data.financialRows.map(row => row.section)).toEqual([
      'entp_pcar_mb', 'entp_pcar_mb', 'entp_pcar_mc', ...Array(10).fill('entp_pcar'),
      'entp_pcar_mk', 'entp_pcar_mm', 'entp_pcar_mn', 'entp_pcar_mp'
    ]);
    expect(data.summary.contractValue).toBe(12345.67);
    expect(data.financialRows[3].sourceRowIndex).toBe(2);
  });

  it('keeps zero and negative amounts and omits unknown independent balances', () => {
    const input = globe3ClaimInput();
    input.tabData[0].num_20_2_d0_007 = '0.00';
    input.tabData[0].num_20_2_d0_009 = '-19.45';
    const data = adapt(input);
    expect(data.summary.previousCertified).toBe(0);
    expect(data.summary.tax).toBe(-19.45);
    expect(data.financialRows[11]).toMatchObject({ label: 'Zero detail retained', amount: 0, amountRaw: '0.00' });
    expect(data.summary).not.toHaveProperty('paidAmount');
    expect(data.summary).not.toHaveProperty('outstandingAmount');
    input.context.receivable = { paidAmount: '0.00', outstandingAmount: '-18.23', currency: 'SGD' };
    const balances = adapt(input).summary;
    expect(balances).toMatchObject({ paidAmount: 0, outstandingAmount: -18.23, paidAmountMinor: 0, outstandingAmountMinor: -1823 });
    expect(balances.outstandingAmount).not.toBe(balances.total - balances.paidAmount);
    delete input.context.receivable.outstandingAmount;
    expect(adapt(input).summary).not.toHaveProperty('outstandingAmount');
    input.context.receivable = { outstandingAmount: '0.00' };
    expect(adapt(input).summary).not.toHaveProperty('paidAmount');
  });

  it('uses only explicit application/certification references and snapshot payment terms', () => {
    const input = globe3ClaimInput();
    input.header.uniquenum_sec = 'application:fictional';
    input.header.tag_datasource = 'entp_pbill';
    input.header.creditterm_desc = 'Fictional negotiated settlement terms';
    input.header.creditterm_days = 3;
    input.context.certification = {
      applicationId: 'application:fictional', applicationNumber: 'PCAR-FICTIONAL-37',
      date: '2026-08-17', certifiedBy: 'Independent Reviewer (Fictional)', status: 'Partially certified'
    };
    const data = adapt(input);
    expect(data.certification).toEqual(input.context.certification);
    expect(data.claim).toMatchObject({ sourceDocumentId: 'application:fictional', sourceDocumentNumber: 'PCAR-FICTIONAL-37', sourceDocumentKind: 'ProgressClaim' });
    expect(data.document.creditTerms).toBe(input.header.creditterm_desc);
    expect(data.document).not.toHaveProperty('dueDate');
    delete input.context.certification;
    const noMetadata = adapt(input);
    expect(noMetadata).not.toHaveProperty('certification');
    expect(noMetadata.claim.sourceDocumentId).toBe('application:fictional');
    expect(noMetadata.claim).not.toHaveProperty('sourceDocumentNumber');
  });

  it('binds actual financial rows and supplied three-place currency displays without product data', () => {
    const input = globe3ClaimInput();
    input.header.curr_decimal = '3';
    input.tabData[0].num_20_2_d0_010 = '123.456';
    input.tabData[1].num_20_2_d0_001 = '-2.345';
    const data = adapt(input), template = document.createElement('template');
    template.innerHTML = `<h1 data-pf-text="/document/kind"></h1>
      <div class="prowitem" data-pf-table-id="claim-ledger" data-pf-each="/financialRows">
        <span class="label" data-pf-text="./label"></span><span class="money" data-pf-text="./displayAmount"></span>
      </div><strong data-pf-text="/summary/displayAmounts/total"></strong>`;
    const bound = bindTemplate(template, data, { locale: 'en-SG' });
    expect(bound.report.errors).toEqual([]);
    expect(bound.report.tableRows).toBe(17);
    expect(bound.fragment.querySelector('h1').textContent).toBe('CCAR');
    expect(bound.fragment.querySelector('strong').textContent).toBe('SGD 123.456');
    expect([...bound.fragment.querySelectorAll('.money')].map(node => node.textContent)).toContain('SGD -2.345');
    expect(bound.fragment.querySelector('.label').textContent).toBe('Contract Sum');
    expect(data.document.sourcePrecision).toBe('3');
    expect(data.summary.totalMinor).toBe(123456);
  });

  it('returns detached output and survives a plain JSON consumer round trip', () => {
    const input = globe3ClaimInput(), before = structuredClone(input), data = adapt(input);
    expect(input).toEqual(before);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
    data.context.company.name = 'Changed';
    data.claim.period.from = '2026-01-01';
    data.financialRows[0].label = 'Changed';
    expect(input).toEqual(before);
  });
});
