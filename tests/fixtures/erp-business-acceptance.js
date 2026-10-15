// Author-created fictional inputs only; no ERP connection, posting or bank execution.
import { rawProgressClaimInput } from './globe3-progress-claim.js';
import { financialBlock, globe3ClaimInput } from './globe3-certified-claim.js';
import { fictionalAdvance, settlementMoney } from './erp-settlement.js';
import { demoRecordForKind } from '../../studio-v3/demo-catalog.js';
import { newDemoProject } from '../../studio-v3/demo-templates.js';
import { createGlobe3RawProgressClaimProject } from '../../studio-v3/globe3-progress-claim-project.js';
import { createGlobe3CertifiedClaimProject } from '../../studio-v3/globe3-claim-project.js';
import { createErpSettlementProject } from '../../studio-v3/erp-settlement-project.js';
import { compileProject, designOf } from '../../studio-v3/model.js';

export function fictionalHistoricalPcar() {
  const input = rawProgressClaimInput();
  input.context.asOfDate = '2026-07-20';
  return input;
}

export function fictionalRepeatedCcar() {
  const input = globe3ClaimInput();
  // Identical source labels/slots in different records must not collapse to one fact.
  input.tabData.push(financialBlock('entp_pcar_mb', [['Extra work as supplied', '-8.75']]));
  return input;
}

export function fictionalSplitSettlement(kind = 'BankReceipt') {
  const input = fictionalAdvance(kind);
  input.document.number = `${kind === 'BankReceipt' ? 'BR' : 'BP'}-FICTIONAL-SPLIT`;
  input.cashMovement.amount = settlementMoney('99.125');
  input.summary.unappliedAmount = settlementMoney('17.000');
  const sourceReference = {
    system: 'FictionalERP', documentType: kind === 'BankReceipt' ? 'Sales Invoice' : 'Purchase Invoice',
    id: 'invoice-fictional-split', number: 'INV-FICTIONAL-SPLIT', currency: 'USD'
  };
  input.allocations = [
    { id: 'split-fictional-a', sourceReference: { ...sourceReference, date: '2026-09-01' },
      invoiceAppliedAmount: settlementMoney('10.00', 'USD', 2) },
    { id: 'split-fictional-b', sourceReference: { ...sourceReference },
      invoiceAppliedAmount: settlementMoney('2.345', 'USD', 3),
      invoiceRemainingBalance: settlementMoney('7.655', 'USD', 3) }
  ];
  return input;
}

export function fictionalCommercialProject(kind) {
  const project = newDemoProject(kind);
  const scenario = kind === 'SalesInvoice' ? 'negative-adjustment' : 'workshop';
  const record = demoRecordForKind(kind, scenario);
  project.sampleData = record.data;
  project.manifest.sampleDataTitle = record.title;
  return project;
}


export function fictionalLongCommercialProject(kind, paper = 'A4') {
  const project = newDemoProject(kind), record = demoRecordForKind(kind, 'workshop');
  project.sampleData = record.data;
  project.manifest.sampleDataTitle = record.title;
  project.sampleData.company.name += ' · Fictional bilingual commissioning / 虚构双语调试服务';
  project.sampleData.customer.name += ' · Fictional procurement department / 虚构采购部门';
  project.sampleData.items.forEach((row, index) => {
    row.description += ` · Fictional source row ${index + 1} / 虚构来源行 ${index + 1}. `
      + 'Retain the supplied equipment scope and inspect installation before handover / 保留来源设备范围并在移交前检查安装。 '.repeat(6);
  });
  const design = designOf(project);
  design.page.paper = paper;
  return compileProject(project, design);
}
// Consumers can serialize each project with the real saveProject API for UI Open.
export const BUSINESS_ACCEPTANCE_CASES = [
  ['historical-pcar', () => createGlobe3RawProgressClaimProject(fictionalHistoricalPcar())],
  ['repeated-ccar', () => createGlobe3CertifiedClaimProject(fictionalRepeatedCcar())],
  ['negative-sales-invoice', () => fictionalCommercialProject('SalesInvoice')],
  ['supplier-purchase-order', () => fictionalCommercialProject('PurchaseOrder')],
  ['supplier-purchase-invoice', () => fictionalCommercialProject('PurchaseInvoice')],
  ['split-payment', () => createErpSettlementProject(fictionalSplitSettlement('BankPayment'))],
  ['split-receipt', () => createErpSettlementProject(fictionalSplitSettlement('BankReceipt'))]
];
