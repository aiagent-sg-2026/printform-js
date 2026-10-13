import { makeDemoRecord, recordId } from './demo-records.js';
import { addDays, amount, reference, summaryFor } from './demo-fixture-math.js';
import { certifiedBasisItems, certifiedBasisSummary } from './demo-claim-basis.js';

// Alternative claim stages, never additional sales or accounting postings.
// Only fixture generation computes these values; live ERP imports remain untouched.
export function buildReceivableClaim(kind, scenario, source, application, previousCertified = null) {
  if (!['PCAR', 'CCAR'].includes(kind)) throw new Error('Unsupported receivable claim fixture kind.');
  if (previousCertified && previousCertified.documentKind !== 'CertifiedClaim') throw new Error('Previous basis must be a CertifiedClaim.');
  const id = recordId(kind, scenario), certified = kind === 'CCAR';
  if (source.documentKind !== (certified ? 'CertifiedClaim' : 'ProgressClaim')) throw new Error('Unsupported claim source.');
  if (certified && application.documentKind !== 'PCAR') throw new Error('CCAR comparison requires its PCAR application.');
  const items = certifiedBasisItems(source, previousCertified, id);
  if (certified) items.forEach((line, index) => {
    line.applicationDocumentId = application.id;
    line.applicationLineId = application.data.items[index].id;
  });
  const valuation = certifiedBasisSummary(items), monetary = summaryFor(items);
  const totalMinor = monetary.totalMinor;
  const applicationMinor = certified ? application.data.summary.totalMinor : totalMinor;
  const adjustmentMinor = applicationMinor - totalMinor;
  return makeDemoRecord(kind, scenario, items, {
    date: addDays(source.data.document.date, 1),
    parents: [reference(source, certified ? 'receivable-from-certificate' : 'receivable-from-application'),
      ...(certified ? [reference(application, 'certifies-pcar-application')] : []),
      ...(previousCertified ? [reference(previousCertified, 'previous-certified-basis')] : [])],
    status: certified ? 'Certified claim · payment requested' : 'Submitted application · awaiting certification',
    summary: {
      ...structuredClone(source.data.summary), ...valuation, ...monetary,
      claimedAmountMinor: totalMinor, claimedAmount: amount(totalMinor),
      paidMinor: 0, paidAmount: 0, outstandingMinor: totalMinor, outstandingAmount: amount(totalMinor),
      applicationAmountMinor: applicationMinor, applicationAmount: amount(applicationMinor),
      certificationAdjustmentMinor: adjustmentMinor, certificationAdjustmentAmount: amount(adjustmentMinor)
    },
    extra: {
      project: structuredClone(source.data.project),
      claim: {
        ...structuredClone(application.data.claim), direction: 'receivable',
        stage: certified ? 'certified' : 'application',
        status: certified ? 'certified-payment-request' : 'awaiting-certification',
        recognition: 'not-accounting-posting', accountingPosting: false,
        balanceBasis: certified ? 'certified-request-not-ledger-ar' : 'provisional-application-not-ledger-ar',
        basisProfile: 'globe3-prior-certified',
        basis: 'Current cumulative work, retention and on-hold less latest prior certified cumulative values; no second previous-certificate/payment deduction.',
        previousCertificateId: previousCertified?.id ?? null,
        previousClaimId: previousCertified?.id ?? null,
        previousCertificateNumber: previousCertified?.data.document.number ?? '',
        sourceDocumentId: source.id, sourceDocumentKind: source.documentKind,
        sourceDocumentNumber: source.data.document.number,
        applicationDocumentId: certified ? application.id : id,
        applicationDocumentNumber: certified ? application.data.document.number : `PCAR-DEMO-2026-${scenario.id.toUpperCase()}`,
        definition: certified ? 'Certified Claim Account Receivable' : 'Progress Claim Account Receivable'
      },
      ...(certified ? { certification: { ...structuredClone(source.data.certification),
        applicationId: application.id, applicationNumber: application.data.document.number,
        sourceApplicationId: source.data.certification.applicationId } } : {})
    },
    notes: 'Fictional claim-stage print example, not an accounting posting or recognition decision. PCAR is an uncertified application; CCAR requests certified payment. Do not add the two as revenue or interpret the displayed request balance as ledger AR. Actual recognition, payments, retention release and tax rules belong to the ERP contract.'
  });
}
