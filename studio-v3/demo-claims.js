import { demoMaster } from './demo-master-data.js';
import { DEMO_SCENARIOS, makeDemoRecord, recordId } from './demo-records.js';
import { addDays, amount, demoLine, reference, relatedLines, roundRatio } from './demo-fixture-math.js';

const findRecord = (records,kind,scenario) => records.find(record=>record.id === recordId(kind,scenario));
export function buildProjectRecords(commercial) {
  return DEMO_SCENARIOS.map(scenario => {
    const order = findRecord(commercial,'SalesOrder',scenario),id = recordId('EnterpriseProject',scenario);
    const items = relatedLines(order,id);
    return makeDemoRecord('EnterpriseProject',scenario,items,{date:addDays(scenario.start,4),parents:[reference(order,'contract-scope')],status:'In progress',
      extra:{project:{id,name:`${scenario.name} project`,contractReference:order.data.document.number,contractDocumentId:order.id,
        contractValueMinor:order.data.summary.subtotalMinor,contractValue:order.data.summary.subtotal,currency:'MYR',
        startDate:addDays(scenario.start,4),endDate:addDays(scenario.start,150),manager:demoMaster('salespeople',scenario.personId).name,
        siteAddressId:order.data.shipTo.id,retentionBps:500,description:'Fictional installation contract. Values and tax treatment are illustrative.'}},
      summary:{contractValue:order.data.summary.subtotal,contractValueMinor:order.data.summary.subtotalMinor}});
  });
}
function claimItems(project,previous,id,bps) {
  return project.data.items.map((scope,i) => {
    const before = previous?.data.items[i];
    const previousWorkMinor = before?.cumulativeWorkMinor || 0;
    const cumulativeWorkMinor = roundRatio(scope.amountMinor*bps,10000);
    const currentWorkMinor = cumulativeWorkMinor-previousWorkMinor;
    const previousRetentionMinor = before?.cumulativeRetentionMinor || 0;
    const cumulativeRetentionMinor = roundRatio(cumulativeWorkMinor*project.data.project.retentionBps,10000);
    const retentionMinor = cumulativeRetentionMinor-previousRetentionMinor;
    const currentClaimMinor = currentWorkMinor-retentionMinor;
    return demoLine(`${id}:line:${i+1}`,{id:scope.productId,sku:scope.sku,description:scope.description,unit:'valuation'},1,
      {no:i+1,rateMinor:currentClaimMinor,extra:{parentDocumentId:project.id,parentLineId:scope.id,contractAmountMinor:scope.amountMinor,
        previousWorkMinor,cumulativeWorkMinor,currentWorkMinor,previousRetentionMinor,cumulativeRetentionMinor,retentionMinor,currentClaimMinor,
        previousWork:amount(previousWorkMinor),cumulativeWork:amount(cumulativeWorkMinor),currentWork:amount(currentWorkMinor),retention:amount(retentionMinor),
        measuredCompletionBps:bps,previousClaimLineId:before?.id || null}});
  });
}
function claimSummary(items) {
  const sum = key => items.reduce((total,line)=>total+line[key],0);
  const previousWorkMinor = sum('previousWorkMinor'),cumulativeWorkMinor = sum('cumulativeWorkMinor'),currentWorkMinor = sum('currentWorkMinor');
  const previousRetentionMinor = sum('previousRetentionMinor'),cumulativeRetentionMinor = sum('cumulativeRetentionMinor'),retentionMinor = sum('retentionMinor');
  const previousClaimMinor = previousWorkMinor-previousRetentionMinor,cumulativeClaimMinor = cumulativeWorkMinor-cumulativeRetentionMinor,currentClaimMinor = currentWorkMinor-retentionMinor;
  return {previousWorkMinor,cumulativeWorkMinor,currentWorkMinor,previousRetentionMinor,cumulativeRetentionMinor,retentionMinor,previousClaimMinor,cumulativeClaimMinor,currentClaimMinor,
    previousClaim:amount(previousClaimMinor),cumulativeClaim:amount(cumulativeClaimMinor),currentClaim:amount(currentClaimMinor),retention:amount(retentionMinor)};
}
export function buildClaimRecords(commercial,projects) {
  const records = [],project = projects[0],base = DEMO_SCENARIOS[0];
  let previousProgress = null, previousCertified = null;
  [2000,5500,8500].forEach((completion,index) => {
    const scenario = {...base,id:`canopy-period-${index+1}`,name:`Conservatory · valuation ${index+1}`};
    const progressId = recordId('ProgressClaim',scenario),date = ['2026-07-01','2026-08-01','2026-09-01'][index];
    const items = claimItems(project,previousProgress,progressId,completion),progressSummary = claimSummary(items);
    const parents = [reference(project,'values-project'),...(previousProgress ? [reference(previousProgress,'previous-application')] : [])];
    const progress = makeDemoRecord('ProgressClaim',scenario,items,{date,parents,summary:progressSummary,status:'Submitted',
      extra:{project:structuredClone(project.data.project),claim:{period:index+1,periodStart:index ? ['2026-07-02','2026-08-02'][index-1] : project.data.project.startDate,periodEnd:date,
        basis:'Cumulative measured work less previous application and current retention; illustrative demo convention.',previousClaimId:previousProgress?.id || null}}});
    const certifiedId = recordId('CertifiedClaim',scenario),certifiedItems = claimItems(project,previousCertified,certifiedId,[1800,5000,8000][index]);
    certifiedItems.forEach((line,i)=>{line.applicationDocumentId = progress.id;line.applicationLineId = items[i].id;});
    const certifiedSummary = claimSummary(certifiedItems);
    const certified = makeDemoRecord('CertifiedClaim',scenario,certifiedItems,{date:addDays(date,5),parents:[reference(project,'certifies-project'),reference(progress,'certifies-application'),...(previousCertified ? [reference(previousCertified,'previous-certificate')] : [])],status:'Certified with adjustment',
      summary:{...certifiedSummary,certifiedAmountMinor:certifiedSummary.currentClaimMinor,certifiedAmount:certifiedSummary.currentClaim,
        appliedCumulativeMinor:progressSummary.cumulativeWorkMinor,certifiedCumulativeMinor:certifiedSummary.cumulativeWorkMinor,
        cumulativeVarianceMinor:progressSummary.cumulativeWorkMinor-certifiedSummary.cumulativeWorkMinor},
      extra:{project:structuredClone(project.data.project),certification:{applicationId:progress.id,previousCertificateId:previousCertified?.id || null,certifiedBy:'Independent Reviewer (Fictional)',
        reason:'A measured portion remains pending site acceptance. Certification is intentionally distinct from the application.',status:'Partial certification',date:addDays(date,5)}}});
    const receivable = makeDemoRecord('AccountsReceivableClaim',scenario,relatedLines(certified,recordId('AccountsReceivableClaim',scenario)),{date:addDays(date,6),parents:[reference(certified,'requests-certified-payment')],status:'Open',
      summary:{claimedAmount:certified.data.summary.total,claimedAmountMinor:certified.data.summary.totalMinor,outstandingAmount:certified.data.summary.total,outstandingMinor:certified.data.summary.totalMinor},
      extra:{project:structuredClone(project.data.project),claim:{direction:'receivable',definition:'Generic demo receivable request for this certificate. Not an asserted meaning of PCA, CCAR, PCAP or CCAP.',sourceDocumentId:certified.id}}});
    const supplierScenario = DEMO_SCENARIOS[index],purchaseInvoice = findRecord(commercial,'PurchaseInvoice',supplierScenario);
    const payableId = recordId('AccountsPayableClaim',supplierScenario);
    const payable = makeDemoRecord('AccountsPayableClaim',supplierScenario,relatedLines(purchaseInvoice,payableId),{date:addDays(purchaseInvoice.data.document.date,2),parents:[reference(purchaseInvoice,'requests-supplier-payment')],status:'Approved',
      summary:{claimedAmount:purchaseInvoice.data.summary.total,claimedAmountMinor:purchaseInvoice.data.summary.totalMinor},
      extra:{claim:{direction:'payable',definition:'Generic demo payable request for a supplier invoice. Not an asserted meaning of PCA, CCAR, PCAP or CCAP.',sourceDocumentId:purchaseInvoice.id}}});
    records.push(progress,certified,receivable,payable);
    previousProgress = progress; previousCertified = certified;
  });
  return records;
}
