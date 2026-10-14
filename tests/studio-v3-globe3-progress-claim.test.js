import { describe, expect, it } from 'vitest';
import { adaptGlobe3ProgressClaim } from '../studio-v3/globe3-progress-claim-adapter.js';
import { createGlobe3RawProgressClaimProject } from '../studio-v3/globe3-progress-claim-project.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { rawProgressClaimInput, fractionalProgressClaimInput } from './fixtures/globe3-progress-claim.js';

const adapt = adaptGlobe3ProgressClaim;
describe('raw PCAR exact SO work-done projection', () => {
  it('joins both header and non-unique line group, uses original rather than distributed amount', () => {
    const data = adapt(rawProgressClaimInput());
    expect(data.valuations.map(row => row.source.linkedLinePrimaryKey)).toEqual([101, 102]);
    expect(data.valuations.map(row => row.linkedContractAmount)).toEqual([2005, 500]);
    expect(data.valuations.map(row => row.sourceReference)).toEqual(['SOC-FICTIONAL-A · line 101', 'SOC-FICTIONAL-B · line 102']);
    expect(data.valuations.map(row => row.source.sourceRowIndex)).toEqual([0, 1]);
  });
  it('chooses latest eligible prior certificate, not array order or prior application, preserving negative movements', () => {
    const input = rawProgressClaimInput(), before = structuredClone(input);
    input.previousCertificates.reverse();
    const data = adapt(input);
    expect(data.claim.previousCertificateId).toBe('cert:latest');
    expect(data.valuations.map(row => row.previousGross)).toEqual([900.375, 250]);
    expect(data.valuations.map(row => row.currentGross)).toEqual([349.75, -50]);
    expect(data.valuations.map(row => row.currentMeasure)).toEqual([2, -1]);
    expect(data.summary.currentGrossMinor).toBe(2997500);
    expect(data.headerAmounts.find(row => row.column === 'amount_forex').display).toBe('SGD 271.471');
    expect(data.summary).not.toHaveProperty('currentNet');
    expect(data.summary).not.toHaveProperty('outstandingAmount');
    expect(input.workDoneRows).toEqual(before.workDoneRows);
  });
  it('stored Last Claim has a deliberately different Previous/Current basis', () => {
    const input = rawProgressClaimInput(); input.context.basisProfile = 'globe3-stored-last-claim';
    const data = adapt(input);
    expect(data.valuations.map(row => row.previousGross)).toEqual([1100, 200]);
    expect(data.valuations.map(row => row.currentGross)).toEqual([150.125, 0]);
    expect(data.valuations.map(row => row.currentMeasure)).toEqual([1, 0]);
    expect(data.claim).not.toHaveProperty('previousCertificateId');
  });
  it('fraction storage is not interpreted as quantity; percentage and raw fraction remain distinct', () => {
    const data = adapt(fractionalProgressClaimInput());
    expect(data.valuations[0]).toMatchObject({ rawCumulativeMeasure: '0.8000', rawCumulativeMeasureKind: 'fraction', rawPreviousMeasure: '7.00', rawPreviousMeasureKind: 'quantity', previousMeasure: 70, currentMeasure: 10, cumulativeMeasure: 80, measureKind: 'percentage' });
    expect(data.valuations[0].display.currentMeasure).toBe('10.00%');
    expect(data.valuations[0].source.linkColumn).toBe('var_50_002');
  });
  it('first claim requires an explicit empty prior snapshot, then its entire gross is current', () => {
    const input = rawProgressClaimInput(); input.previousCertificates = [];
    const data = adapt(input);
    expect(data.valuations.map(row => row.previousGross)).toEqual([0, 0]);
    expect(data.summary.currentGrossMinor).toBe(data.summary.cumulativeGrossMinor);
    expect(data.claim).not.toHaveProperty('previousCertificateId');
  });
  it('missing prior line is not silently zero; genuine new work can be explicitly identified', () => {
    const input = rawProgressClaimInput(); input.previousCertificates[0].workDoneRows.pop();
    expect(() => adapt(input)).toThrow(/Prior certified line is missing/);
    input.context.newWorkLines = [{ salesHeaderId: 'so:fictional-b', lineGroupKey: 'line:shared-group' }];
    const row = adapt(input).valuations[1];
    expect(row.previousGross).toBe(0); expect(row.currentGross).toBe(200);
  });
  it('excludes future, unapproved, inactive and void baselines without using them as certification', () => {
    const input = rawProgressClaimInput(), latest = input.previousCertificates[0];
    const future = structuredClone(latest); future.header.uniquenum_pri = 'cert:future'; future.header.date_trans = '2026-09-01';
    const pending = structuredClone(latest); pending.header.uniquenum_pri = 'cert:pending'; pending.header.tag_wflow_app_yn = 'n';
    const voided = structuredClone(latest); voided.header.uniquenum_pri = 'cert:voided'; voided.header.tag_void_yn = 'y';
    const deleted = structuredClone(latest); deleted.header.uniquenum_pri = 'cert:deleted'; deleted.header.tag_deleted_yn = 'de';
    input.previousCertificates.push(future, pending, voided, deleted);
    expect(adapt(input).claim.previousCertificateId).toBe('cert:latest');
  });
  it('same-day eligible certificates require an explicit identity, never first/last array order', () => {
    const input = rawProgressClaimInput(), duplicateDate = structuredClone(input.previousCertificates[0]);
    duplicateDate.header.uniquenum_pri = 'cert:other-latest';
    duplicateDate.workDoneRows.forEach(row => { row.uniquenum_pri = 'cert:other-latest'; });
    input.previousCertificates.push(duplicateDate);
    expect(() => adapt(input)).toThrow(/Same-date certificates/);
    input.context.previousCertificateId = 'cert:other-latest';
    expect(adapt(input).claim.previousCertificateId).toBe('cert:other-latest');
    input.context.previousCertificateId = 'cert:older';
    expect(() => adapt(input)).toThrow(/not one of the latest/);
  });
  it('inactive source work rows are not counted as active usage or cloned into output', () => {
    const input = rawProgressClaimInput(); input.workDoneRows[0].tag_deleted_yn = 'de';
    const data = adapt(input);
    expect(data.valuations.map(row => [row.no, row.source.sourceRowIndex])).toEqual([[1, 1]]);
    expect(data.summary.currentGross).toBe(-50);
  });
  it('selected d numeric profile is supported; no d0 fallback or conflict laundering', () => {
    const input = rawProgressClaimInput(); input.context.numericSlotVariant = 'd';
    for (const row of [...input.workDoneRows, ...input.previousCertificates.flatMap(cert => cert.workDoneRows)]) {
      for (const key of Object.keys(row).filter(key => key.includes('_d0_'))) { row[key.replace('_d0_', '_d_')] = row[key]; delete row[key]; }
    }
    expect(adapt(input).summary.currentGross).toBe(299.75);
    input.workDoneRows[0].num_20_4_d0_002 = '999.0000';
    expect(() => adapt(input)).toThrow(/conflicting/);
  });
  it('portable projects preserve four-digit gross, three-digit header figures and exact references', () => {
    const project = createGlobe3RawProgressClaimProject(rawProgressClaimInput());
    const reopened = readProject(saveProject(project));
    expect(reopened.manifest.studioV3.collection).toBe('/valuations');
    expect(reopened.sampleData.valuations[0].display.currentGross).toBe('SGD 349.7500');
    expect(reopened.sampleData.headerAmounts.find(row => row.column === 'amount_forex').display).toBe('SGD 271.471');
    expect(reopened.sampleData.valuations[1].display.currentGross).toBe('SGD -50.0000');
    expect(reopened.sampleData).not.toHaveProperty('items');
    expect(reopened.sampleData).not.toHaveProperty('paidAmount');
    expect(reopened.sampleData.document.creditTerms).toBe('Fictional claim-snapshot terms');
  });
});
