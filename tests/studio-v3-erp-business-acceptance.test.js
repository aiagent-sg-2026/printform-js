import { describe, expect, it } from 'vitest';
import { adaptGlobe3ProgressClaim } from '../studio-v3/globe3-progress-claim-adapter.js';
import { createGlobe3CertifiedClaimProject } from '../studio-v3/globe3-claim-project.js';
import { normalizeErpSettlement } from '../studio-v3/erp-settlement-adapter.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { fictionalHistoricalPcar, fictionalRepeatedCcar, fictionalSplitSettlement } from './fixtures/erp-business-acceptance.js';

function bind(project) {
  const template = document.createElement('template');
  template.innerHTML = project.templateHtml;
  const result = bindTemplate(template, project.sampleData, project.manifest);
  expect(result.report.errors).toEqual([]);
  return result.fragment;
}

describe('previously unexercised ERP business boundaries', () => {
  it('uses the explicit historical cutoff inclusively, not the claim date or the newest supplied certificate', () => {
    const input = fictionalHistoricalPcar(), result = adaptGlobe3ProgressClaim(input);
    expect(result.claim.previousCertificateId).toBe('cert:older');
    expect(result.valuations.map(row => [row.previousGross, row.currentGross, row.cumulativeGross]))
      .toEqual([[600, 650.125, 1250.125], [100, 100, 200]]);
    input.context.previousCertificateId = 'cert:latest';
    expect(() => adaptGlobe3ProgressClaim(input)).toThrow(expect.objectContaining({
      code: 'GLOBE3_PCAR_BASELINE', path: 'context.previousCertificateId'
    }));
  });

  it('keeps repeated CCAR labels and slots as separate source records, without replacing the main total', () => {
    const project = createGlobe3CertifiedClaimProject(fictionalRepeatedCcar());
    const rows = project.sampleData.financialRows.filter(row => row.label === 'Extra work as supplied');
    expect(rows.map(row => [row.sourceRowIndex, row.sourceSlot, row.amountRaw]))
      .toEqual([[1, 1, '35.25'], [7, 1, '-8.75']]);
    expect(new Set(rows.map(row => row.id)).size).toBe(2);
    expect(project.sampleData.summary.totalMinor).toBe(379047);
    const fragment = bind(project);
    const labels = [...fragment.querySelectorAll('[data-v3-id=items-description]')].map(node => node.textContent);
    const amounts = [...fragment.querySelectorAll('[data-v3-id=items-amount]')].map(node => node.textContent);
    expect(labels.map((label, index) => [label, amounts[index]]).filter(([label]) => label === 'Extra work as supplied'))
      .toEqual([['Extra work as supplied', 'SGD 35.25'], ['Extra work as supplied', 'SGD -8.75']]);
  });

  it.each(['BankPayment', 'BankReceipt'])('%s retains two applications to one invoice without merging, inferring state or backfilling metadata', kind => {
    const input = fictionalSplitSettlement(kind), result = normalizeErpSettlement(input);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations.map(row => row.invoiceAppliedAmount.displayAmount)).toEqual(['USD 10.00', 'USD 2.345']);
    expect(result.printRows.map(row => [row.sourceId, row.metric, row.displayAmount])).toEqual([
      ['split-fictional-a', 'invoiceAppliedAmount', 'USD 10.00'],
      ['split-fictional-b', 'invoiceAppliedAmount', 'USD 2.345'],
      ['split-fictional-b', 'invoiceRemainingBalance', 'USD 7.655']
    ]);
    expect(result.allocations[0].sourceReference.date).toBe('2026-09-01');
    expect(result.allocations[1].sourceReference).not.toHaveProperty('date');
    for (const allocation of result.allocations) {
      expect(allocation).not.toHaveProperty('state');
      expect(allocation).not.toHaveProperty('cashAppliedAmount');
      expect(allocation).not.toHaveProperty('invoiceClearedAmount');
    }
    expect(result.summary.unappliedAmount.amount).toBe('17.000');
    expect(result.cashMovement.amount.amount).toBe('99.125');
  });

  it('remembers supplied invoice metadata across an intervening sparse reference when detecting conflicts', () => {
    const input = fictionalSplitSettlement();
    const third = structuredClone(input.allocations[1]);
    third.id = 'split-fictional-c'; third.sourceReference.date = '2026-09-02';
    input.allocations.push(third);
    expect(() => normalizeErpSettlement(input)).toThrow(expect.objectContaining({
      code: 'ERP_SETTLEMENT_REFERENCE', path: 'allocations[2].sourceReference.date'
    }));
  });

});
