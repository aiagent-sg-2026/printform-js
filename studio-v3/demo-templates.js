import { newCompactA5Project } from './compact-a5-demo.js';
export { newProject, designOf, sampleData } from './model.js';
import { getDemoCatalog, demoRecordForKind } from './demo-catalog.js';
import { newProject, compileProject, designOf } from './model.js';
import { applyA4DemoDesign } from './a4-demo-designs.js';
import { a4PresetForKind } from './a4-presets.js';
const field=(id,label,pointer,format='')=>({id,label,pointer,format});
const column=(id,label,pointer,width,format='')=>({...field(id,label,pointer,format),width});
export function newDemoProject(kind) {
  if(kind==='CompactA5Invoice')return newCompactA5Project();
  const entry=getDemoCatalog({includePending:false}).find(e=>e.documentKind===kind);
  if(!entry)throw new Error('Choose a defined demo document type.');
  const record=demoRecordForKind(kind),project=newProject(entry.baseType),design=designOf(project);
  project.manifest.title=`${entry.label} template`;project.manifest.sampleDataTitle=record.title;project.manifest.currency=record.data.document.currency;
  project.sampleData=record.data; design.title=entry.label.toUpperCase();
  if(entry.baseType!=='delivery')design.columns=[column('no','#','./no',5),column('sku','Item code','./sku',13),column('description','Description','./description',31),column('quantity','Qty','./quantity',8,'number'),column('rate','Unit price','./rate',14,'currency'),column('discount','Discount','./discount',13,'currency'),column('amount','Net amount','./amount',16,'currency')];
  if(entry.baseType!=='delivery')design.totals[0].label='Subtotal (after discounts)';
  design.header.push(field('business-unit','Business unit','/document/businessUnit'),field('department','Department','/document/department'));
  design.footer.push(field('credit-terms','Credit terms','/document/creditTerms'));
  const due=design.header.find(f=>f.id==='due');
  if(['SalesOrder','PurchaseOrder','BankReceipt','BankPayment'].includes(kind))design.header=design.header.filter(f=>f.id!=='due');
  else Object.assign(due,{label:'Due date'},kind==='SalesQuotation'?{label:'Valid until',pointer:'/document/validUntil'}:kind==='DeliveryOrder'?{label:'Dispatch date',pointer:'/delivery/dispatchDate'}:kind==='DeliveryOrderConfirmation'?{label:'Received date',pointer:'/acceptance/receivedDate'}:kind==='SalesOrderConfirmation'?{label:'Promised delivery',pointer:'/document/promisedDeliveryDate'}:kind==='EnterpriseProject'?{label:'Project end',pointer:'/project/endDate'}:{});
  if(kind==='DeliveryOrderConfirmation')Object.assign(design.footer.find(f=>f.id==='signature'),{label:'Received by',pointer:'/acceptance/receivedBy'});
  if(kind==='SalesQuotation')design.footer.push(field('quotation-terms','Quotation terms','/terms/quotation/text'));
  if(kind.includes('Confirmation'))design.header.push(field('status','Status','/document/status'));
  if(['BankReceipt','BankPayment'].includes(kind)) {
    design.customer=design.customer.filter(f=>!f.id.startsWith('ship'));design.customer[0].label=kind==='BankReceipt'?'Received from':'Paid to';
    design.footer=design.footer.filter(f=>f.id!=='credit-terms');
    design.header.push(field('bank-reference','Transaction reference','/bank/transactionReference'));
    design.columns=[column('no','#','./no',7),column('description','Allocation / reference','./description',68),column('amount','Amount','./amount',25,'currency')];
    design.totals=[field('allocated','Allocated','/summary/allocatedAmount','currency'),field('unapplied','Unapplied','/summary/unappliedAmount','currency'),field('total',kind==='BankReceipt'?'Receipt total':'Payment total','/summary/total','currency')];
  }
  if(kind==='EnterpriseProject' || ['ProgressClaim','CertifiedClaim','PCAR','CCAR','AccountsReceivableClaim'].includes(kind)) {
    design.customer.push(field('project-name','Project','/project/name'),field('contract-reference','Contract','/project/contractReference'));
    design.header.push(field('contract-value','Contract value','/project/contractValue','currency'));
  }
  if(['ProgressClaim','CertifiedClaim','PCAR','CCAR'].includes(kind)) {
    design.columns=[column('no','#','./no',5),column('description','Work description','./description',35),column('previous','Previous','./previousWork',15,'currency'),column('current','Current','./currentWork',15,'currency'),column('cumulative','Cumulative','./cumulativeWork',15,'currency'),column('amount','After retention','./amount',15,'currency')];
    design.totals=[field('previous','Previous claim (excl. tax)','/summary/previousClaim','currency'),field('current','Current claim (excl. tax)','/summary/currentClaim','currency'),field('cumulative','Cumulative claim (excl. tax)','/summary/cumulativeClaim','currency'),field('retention','Current retention','/summary/retention','currency'),...(['CertifiedClaim','CCAR'].includes(kind)?[field('certified','Certified (excl. tax)','/summary/certifiedAmount','currency')]:[]),field('tax','Tax','/summary/tax','currency'),field('total','Current total (incl. tax)','/summary/total','currency')];
  }
  if(['PCAR','CCAR'].includes(kind)) {
    // Receivable summaries must be independently pageable, not one oversized legacy footer.
    design.page={paper:'A4',orientation:'portrait',margins:{top:22,right:22,bottom:22,left:22}};
    design.layoutPreset='progress-certificate';
    design.repeatHeader=false;
    design.titleStyle={fontSize:16,bold:true};
    design.blocks.header.layout={columns:2,gap:8};
    design.blocks.totals.layout={columns:2,gap:12};
    design.blocks.footer.layout={columns:2,gap:12};
    design.blocks.customer.keepTogether=true;
    design.blocks.totals.keepTogether=true;
    design.customer=design.customer.filter(f=>!f.id.startsWith('ship'));
    design.columns.find(c=>c.id==='previous').label='Previous certified cumulative';
    design.columns.find(c=>c.id==='current').label='Current movement';
    design.columns.find(c=>c.id==='amount').label='Current net';
    design.totals.find(f=>f.id==='previous').label='Previous certified net (excl. tax)';
    design.totals.find(f=>f.id==='current').label='Current net (excl. tax)';
    design.totals.push(field('on-hold','Current on-hold movement','/summary/onHold','currency'));
    design.header.push(field('previous-certificate','Previous certificate','/claim/previousCertificateNumber'));
    design.footer.push(field('claim-basis','Current calculation basis','/claim/basis'),field('balance-basis','Balance meaning','/claim/balanceBasis'));
    design.header.push(field('claim-period','Claim period','/claim/period'),field('claim-from','Period from','/claim/periodStart'),field('claim-to','Period to','/claim/periodEnd'),field('claim-source','Source document','/claim/sourceDocumentNumber'),field('claim-status','Receivable status','/document/status'));
    if(kind==='CCAR') {
      design.header.push(field('certified-by','Certified by','/certification/certifiedBy'),field('certified-date','Certified on','/certification/date'));
      design.header.push(field('pcar-application','PCAR application','/claim/applicationDocumentNumber'));
      design.totals.push(field('application','Application total (incl. tax)','/summary/applicationAmount','currency'),field('certification-adjustment','Application less certified (incl. tax)','/summary/certificationAdjustmentAmount','currency'));
    }
    design.totals.push(field('paid','Recorded paid amount (demo)','/summary/paidAmount','currency'),field('outstanding',kind==='PCAR'?'Provisional application balance':'Certified request balance (not ledger AR)','/summary/outstandingAmount','currency'));
  }
  return compileProject(project,applyA4DemoDesign(design,kind));
}
export function setupDemoTemplatePicker() {
  const dialog=document.querySelector('#new-dialog'),holder=dialog?.querySelector('.template-options');if(!holder)return;
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Business demo templates';details.append(summary);
  const list=document.createElement('div');list.className='demo-template-grid';
  for(const entry of [...getDemoCatalog(),{documentKind:'CompactA5Invoice',label:'Compact A5 invoice',status:'ready',scenarioCount:1,description:'45 rows · first-page company header, repeating table headings, 9pt text'}]) {
    const button=document.createElement('button');button.type='button';button.textContent=entry.label;button.disabled=entry.status!=='ready';
    const preset=a4PresetForKind(entry.documentKind);
    const hint=document.createElement('span');hint.textContent=entry.status==='ready'?`${preset ? `A4 · ${preset.label} · ` : ''}${entry.scenarioCount} fictional datasets · ${entry.description}`:'Definition pending confirmation';button.append(hint);
    if(entry.status==='ready')button.dataset.demoTemplate=entry.documentKind;
    list.append(button);
  }
  details.append(list);holder.after(details);
}
