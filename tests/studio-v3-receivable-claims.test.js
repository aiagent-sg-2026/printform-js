import { describe, expect, it } from 'vitest';
import { demoRecordById, demoStarterRecords } from '../studio-v3/demo-catalog.js';
import { newDemoProject } from '../studio-v3/demo-templates.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { availableBindings } from '../studio-v3/ai-authoring.js';
import { createBus, replaceData } from '../studio-v3/controller.js';
import { buildReceivableClaim } from '../studio-v3/demo-receivable-claims.js';
import { DEMO_SCENARIOS } from '../studio-v3/demo-records.js';

describe('PCAR and CCAR receivable stages', () => {
  for (const [kind, sourceKind] of [['PCAR', 'ProgressClaim'], ['CCAR', 'CertifiedClaim']]) {
    it(`${kind} preserves source cumulative valuation and lineage with a certified movement basis`, () => {
      for (const record of demoStarterRecords(kind)) {
        const source = demoRecordById(record.data.claim.sourceDocumentId);
        expect(source.documentKind).toBe(sourceKind);
        expect(record.data.claim.direction).toBe('receivable');
        if (kind === 'CCAR') {
          expect(record.data.summary.totalMinor).toBe(source.data.summary.totalMinor);
          expect(record.data.summary.retentionMinor).toBe(source.data.summary.retentionMinor);
          expect(record.data.summary.taxMinor).toBe(source.data.summary.taxMinor);
        }
        expect(record.data.items.map(row => row.cumulativeWorkMinor)).toEqual(source.data.items.map(row => row.cumulativeWorkMinor));
        expect(record.data.claim.recognition).toBe('not-accounting-posting');
        expect(record.data.claim.accountingPosting).toBe(false);
        expect(record.data.claim.basisProfile).toBe('globe3-prior-certified');
        expect(record.data.summary.outstandingMinor).toBe(record.data.summary.totalMinor - record.data.summary.paidMinor);
        expect(record.data.summary.currentNetMinor).toBe(record.data.summary.currentWorkMinor - record.data.summary.retentionMinor - record.data.summary.onHoldMinor);
        expect(record.data.summary.subtotalMinor).toBe(record.data.summary.currentNetMinor);
        expect(record.data.summary.totalMinor).toBe(record.data.summary.subtotalMinor + record.data.summary.taxMinor);
        expect(record.data.items.map(row => row.parentLineId)).toEqual(source.data.items.map(row => row.id));
        const reopened = readProject(saveProject({ ...newDemoProject(kind), sampleData: record.data }));
        expect(reopened.sampleData).toEqual(record.data);
      }
    });
  }

  it('certification refers to its application rather than conflating applied and certified amounts', () => {
    for (const record of demoStarterRecords('CCAR')) {
      const application = demoRecordById(record.data.certification.applicationId);
      expect(application.documentKind).toBe('PCAR');
      const certificate = demoRecordById(record.data.claim.sourceDocumentId);
      expect(record.data.summary.applicationAmountMinor).toBe(application.data.summary.totalMinor);
      expect(record.data.summary.certificationAdjustmentMinor).toBe(application.data.summary.totalMinor - certificate.data.summary.totalMinor);
      expect(record.data.claim.stage).toBe('certified');
      expect(record.data.certification.date).toBe(certificate.data.document.date);
      expect(record.data.certification.certifiedBy).toBe(certificate.data.certification.certifiedBy);
      expect(record.data.certification.sourceApplicationId).toBe(certificate.data.certification.applicationId);
      expect(record.data.claim.applicationDocumentNumber).toBe(application.data.document.number);
    }
  });

  it.each(['PCAR', 'CCAR'])('uses supplied %s values without recomputation on apply and undo', async kind => {
    const bus = createBus(newDemoProject(kind));
    const before = structuredClone(bus.project.sampleData), data = structuredClone(before);
    data.summary.paidAmount = 123.45;
    data.summary.outstandingAmount = 456.78;
    data.summary.currentWorkMinor = 987654;
    data.summary.currentNetMinor = 765432;
    data.summary.taxMinor = 1234;
    data.claim.recognition = 'erp-supplied-recognition';
    await replaceData(bus, data);
    expect(bus.project.sampleData).toEqual(data);
    await bus.navigateHistory('undo', bus.revision);
    expect(bus.project.sampleData).toEqual(before);
  });

  it('uses the latest prior certificate rather than the prior application and never deducts it twice', () => {
    const applications = demoStarterRecords('PCAR'), certificates = demoStarterRecords('CCAR');
    for (let index = 1; index < applications.length; index++) {
      const current = applications[index].data.summary, prior = certificates[index - 1].data.summary;
      expect(prior.cumulativeWorkMinor).not.toBe(applications[index - 1].data.summary.cumulativeWorkMinor);
      expect(current.previousWorkMinor).toBe(prior.cumulativeWorkMinor);
      expect(current.previousRetentionMinor).toBe(prior.cumulativeRetentionMinor);
      expect(current.currentWorkMinor).toBe(current.cumulativeWorkMinor - prior.cumulativeWorkMinor);
      expect(current.currentNetMinor).toBe(current.cumulativeClaimMinor - prior.cumulativeClaimMinor);
      expect(applications[index].data.claim.status).toBe('awaiting-certification');
      expect(applications[index].data.claim.balanceBasis).toBe('provisional-application-not-ledger-ar');
    }
  });

  it('moves retention and on-hold against the same certificate, including an on-hold release', () => {
    const prior = demoStarterRecords('CertifiedClaim')[0], source = demoStarterRecords('ProgressClaim')[1];
    prior.data.items.forEach((row, index) => { row.cumulativeOnHoldMinor = 500 + index; });
    source.data.items.forEach((row, index) => { row.cumulativeOnHoldMinor = 100 + index; });
    const scenario = { ...DEMO_SCENARIOS[0], id: 'basis-release', name: 'Fictional basis release' };
    const record = buildReceivableClaim('PCAR', scenario, source, source, prior);
    expect(record.data.summary.onHoldMinor).toBe(-400 * source.data.items.length);
    for (const [index, row] of record.data.items.entries()) {
      expect(row.retentionMinor).toBe(row.cumulativeRetentionMinor - prior.data.items[index].cumulativeRetentionMinor);
      expect(row.currentClaimMinor).toBe(row.currentWorkMinor - row.retentionMinor - row.onHoldMinor);
      expect(row.previousClaimLineId).toBe(prior.data.items[index].id);
    }
    expect(record.data.summary.currentNetMinor).toBe(record.data.summary.cumulativeClaimMinor - record.data.summary.previousClaimMinor);
    const certificate = demoStarterRecords('CertifiedClaim')[1];
    certificate.data.items.forEach((row, index) => { row.cumulativeOnHoldMinor = 50 + index; });
    const ccar = buildReceivableClaim('CCAR', scenario, certificate, record, prior);
    expect(ccar.data.summary.applicationAmountMinor).toBe(record.data.summary.totalMinor);
    expect(ccar.data.summary.certificationAdjustmentMinor).toBe(record.data.summary.totalMinor - ccar.data.summary.totalMinor);
    expect(ccar.data.items.map(row => row.applicationLineId)).toEqual(record.data.items.map(row => row.id));
    expect(() => buildReceivableClaim('PCAR', scenario, source, source, source)).toThrow(/CertifiedClaim/);
  });

  it('offers receivable and certificate binding paths without reading private object keys', () => {
    const project = newDemoProject('CCAR');
    project.sampleData.privateTenantName = 'DO-NOT-SHARE';
    const paths = availableBindings(project).map(field => field.pointer);
    for (const path of ['/claim/sourceDocumentNumber', '/certification/date', '/summary/paidAmount', '/summary/outstandingAmount', '/summary/certificationAdjustmentAmount']) expect(paths).toContain(path);
    expect(paths).not.toContain('/privateTenantName');
  });
});
