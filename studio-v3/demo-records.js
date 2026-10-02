import { DEMO_MASTER_DATA as masters, demoMaster, demoAddress, demoParty } from './demo-master-data.js';
import { demoKind } from './demo-document-kinds.js';
import { addDays, amount, demoLine, reference, relatedLines, roundRatio, summaryFor } from './demo-fixture-math.js';

export const DEMO_SCENARIOS = [
  {id:'canopy',name:'Conservatory controls',customerId:'customer:amber',supplierId:'supplier:willow',personId:'person:mira',count:4,start:'2026-06-01',partial:[2,5,8,6]},
  {id:'workshop',name:'Workshop safety upgrade',customerId:'customer:finch',supplierId:'supplier:kite',personId:'person:daniel',count:6,start:'2026-07-01',partial:[4,6,8,10,2.5,4]},
  {id:'campus',name:'Campus multi-building rollout',customerId:'customer:fern',supplierId:'supplier:juniper',personId:'person:hana',count:64,start:'2026-08-01'}
];
export const recordId = (kind,scenario) => `demo:${kind}:${scenario.id}`;
const prefixes = {SalesQuotation:'SQ',SalesOrder:'SO',SalesOrderConfirmation:'SOC',DeliveryOrder:'DO',DeliveryOrderConfirmation:'DOC',SalesInvoice:'SI',PurchaseOrder:'PO',PurchaseInvoice:'PI',BankReceipt:'BR',BankPayment:'BP',EnterpriseProject:'PRJ',ProgressClaim:'PCL',CertifiedClaim:'CERT',AccountsReceivableClaim:'AR',AccountsPayableClaim:'AP'};
export function makeDemoRecord(kind,scenario,items,options = {}) {
  const definition = demoKind(kind), id = options.id || recordId(kind,scenario);
  const person = demoMaster('salespeople',scenario.personId);
  const customer = demoParty('customers',scenario.customerId), supplier = demoParty('suppliers',scenario.supplierId);
  const purchase = definition.baseType === 'purchase';
  const party = purchase ? supplier : customer;
  const term = demoMaster('creditTerms',party.creditTermId), quotationTerm = demoMaster('quotationTerms',scenario.id === 'workshop' ? 'quote:14' : 'quote:30');
  const date = options.date || scenario.start,currency = options.currency || 'MYR';
  const company = {...masters.company,address:demoAddress(masters.company.addressId)};
  const parents = options.parents || [];
  const data = {
    company,document:{id,kind,baseType:definition.baseType,number:options.number || `${prefixes[kind]}-DEMO-2026-${scenario.id.toUpperCase()}`,
      date,dueDate:addDays(date,term.days),reference:parents.map(parent=>parent.number).join(' / '),currency,minorUnitDigits:2,
      status:options.status || 'Issued',salesperson:person.name,department:demoMaster('departments',person.departmentId).name,
      businessUnit:demoMaster('businessUnits','bu:systems').name,creditTerms:term.name,...(kind === 'SalesQuotation' ? {validUntil:addDays(date,quotationTerm.validDays)} : {}),...options.document},
    customer:party,shipTo:purchase ? {id:'address:warehouse',name:'Lantern Works · receiving (Fictional)',address:demoAddress('address:warehouse')} : {id:customer.shippingAddressId,name:`${customer.name} · project site`,address:demoAddress(customer.shippingAddressId)},
    items,summary:summaryFor(items,{currency,...options.summary}),notes:options.notes || 'Fictional local demo only. Tax rates are illustrative, not tax advice or a statutory calculation.',
    preparedBy:person.name,approvedBy:'Alex Demonstration',
    masterReferences:{companyId:company.id,customerId:customer.id,supplierId:supplier.id,salespersonId:person.id,departmentId:person.departmentId,businessUnitId:'bu:systems',creditTermId:term.id,quotationTermId:quotationTerm.id,currencyId:currency,taxCodeId:'tax:demo8',
      billingAddressId:party.billingAddressId || party.addressId,shippingAddressId:purchase ? 'address:warehouse' : customer.shippingAddressId},
    terms:{credit:term,quotation:quotationTerm},parentDocuments:parents,
    demo:{fictional:true,scenario:scenario.id,scenarioName:scenario.name,edgeCase:options.edgeCase || '',purpose:options.purpose || definition.description,calculationScope:'Fixture generation only; edited ERP values are never recomputed.'},
    ...options.extra
  };
  return {id,type:definition.baseType,baseType:definition.baseType,documentKind:kind,title:`${definition.label} · ${options.title || scenario.name}`,origin:'builtin-demo',data};
}
function sourceLines(scenario,id) {
  return Array.from({length:scenario.count},(_,i) => {
    const product = masters.products[i % masters.products.length];
    const quantity = product.unit === 'hour' ? 7.5+(i%3) : 8+2*(i%7);
    const description = scenario.id === 'campus'
      ? `${product.description} — building ${String(Math.floor(i/8)+1).padStart(2,'0')}, zone ${i%8+1}. 安装及验收 / installation and acceptance. ${i%11 === 0 ? 'Coordinate access with the site supervisor; label the circuit and record inspection before handover. '.repeat(3) : ''}`
      : product.description;
    return demoLine(`${id}:line:${i+1}`,product,quantity,{no:i+1,discountBps:i%3 === 0 ? 250 : 0,description});
  });
}
function makeCashRecord(kind,scenario,invoice,index) {
  const id = recordId(kind,scenario),due = invoice.data.summary.totalMinor;
  const allocatedMinor = index === 1 ? roundRatio(due*60,100) : due;
  const unappliedMinor = index === 2 ? 25000 : 0, receivedMinor = allocatedMinor+unappliedMinor;
  const allocation = {id:`${id}:allocation:1`,invoiceId:invoice.id,invoiceNumber:invoice.data.document.number,currency:'MYR',invoiceTotalMinor:due,previouslyAllocatedMinor:0,allocatedMinor,remainingMinor:due-allocatedMinor};
  const cashProduct = {id:null,sku:'ALLOCATION',description:`Applied to ${allocation.invoiceNumber}`,unit:'allocation'};
  const items = [demoLine(`${id}:line:1`,cashProduct,1,{rateMinor:allocatedMinor,taxBps:0,extra:{allocationId:allocation.id,parentDocumentId:invoice.id,reference:allocation.invoiceNumber}})];
  if (unappliedMinor) items.push(demoLine(`${id}:line:2`,{...cashProduct,sku:'UNAPPLIED',description:'Unapplied advance for a future order'},1,{no:2,rateMinor:unappliedMinor,taxBps:0}));
  const record = makeDemoRecord(kind,scenario,items,{date:addDays(invoice.data.document.date,7),parents:[reference(invoice,'settles')],
    summary:{allocatedMinor,unappliedMinor,receivedMinor,outstandingMinor:due-allocatedMinor,allocatedAmount:amount(allocatedMinor),unappliedAmount:amount(unappliedMinor),outstandingAmount:amount(due-allocatedMinor)},
    extra:{allocations:[allocation],bank:{...demoMaster('bankAccounts','bank:demo-clearing'),transactionReference:`DEMO-${kind === 'BankReceipt' ? 'RECEIPT' : 'PAYMENT'}-${scenario.id.toUpperCase()}`,method:'Demo clearing transfer'},cashMovement:{direction:kind === 'BankReceipt' ? 'in' : 'out',amountMinor:receivedMinor,amount:amount(receivedMinor),currency:'MYR'}},
    purpose:index === 0 ? 'Full settlement, zero remaining balance.' : index === 1 ? 'Partial settlement, invoice remains open.' : 'Invoice fully settled with a separately identified unapplied advance.'});
  record.data.masterReferences.bankAccountId = 'bank:demo-clearing';
  record.data.masterReferences.taxCodeId = 'tax:zero';
  return record;
}
export function buildCommercialRecords() {
  const records = [];
  DEMO_SCENARIOS.forEach((scenario,index) => {
    const quotation = makeDemoRecord('SalesQuotation',scenario,sourceLines(scenario,recordId('SalesQuotation',scenario)),{document:{validUntil:addDays(scenario.start,index === 1 ? 14 : 30)},status:'Accepted'});
    const order = makeDemoRecord('SalesOrder',scenario,relatedLines(quotation,recordId('SalesOrder',scenario)),{date:addDays(scenario.start,3),parents:[reference(quotation,'accepted-from')],status:'Partially delivered'});
    const confirmation = makeDemoRecord('SalesOrderConfirmation',scenario,relatedLines(order,recordId('SalesOrderConfirmation',scenario)),{date:addDays(scenario.start,4),parents:[reference(order,'confirms')],document:{promisedDeliveryDate:addDays(scenario.start,15)},status:'Acknowledged'});
    const purchaseId = recordId('PurchaseOrder',scenario);
    const purchaseItems = order.data.items.map((line,i) => demoLine(`${purchaseId}:line:${i+1}`,masters.products[i%5],line.quantity,{no:i+1,rateMinor:masters.products[i%5].purchaseRateMinor,extra:{parentDocumentId:order.id,parentLineId:line.id}}));
    const purchase = makeDemoRecord('PurchaseOrder',scenario,purchaseItems,{date:addDays(scenario.start,5),parents:[reference(order,'procures-for')],status:'Invoiced'});
    const quantities = order.data.items.map((line,i)=>scenario.partial?.[i] ?? line.quantity/2);
    const delivery = makeDemoRecord('DeliveryOrder',scenario,relatedLines(order,recordId('DeliveryOrder',scenario),quantities),{date:addDays(scenario.start,15),parents:[reference(order,'fulfils')],summary:{packages:Math.ceil(quantities.reduce((a,b)=>a+b,0)/4)},status:'Delivered',
      extra:{delivery:{dispatchDate:addDays(scenario.start,15),carrier:'Fictional local delivery team',trackingReference:`DEMO-DISPATCH-${scenario.id}`,partial:true}}});
    const deliveryConfirmation = makeDemoRecord('DeliveryOrderConfirmation',scenario,relatedLines(delivery,recordId('DeliveryOrderConfirmation',scenario)),{date:addDays(scenario.start,16),parents:[reference(delivery,'acknowledges')],summary:{packages:delivery.data.summary.packages},status:'Accepted',
      extra:{acceptance:{receivedBy:'Site Receiver (Fictional)',receivedDate:addDays(scenario.start,16),condition:'Accepted after quantity and condition inspection',signatureStatus:'Demonstration placeholder; not a real signature'}}});
    const invoice = makeDemoRecord('SalesInvoice',scenario,relatedLines(delivery,recordId('SalesInvoice',scenario)),{date:addDays(scenario.start,17),parents:[reference(delivery,'invoices-delivery'),reference(order,'originating-order')],status:index === 1 ? 'Partially paid' : 'Paid'});
    const supplierInvoice = makeDemoRecord('PurchaseInvoice',scenario,relatedLines(purchase,recordId('PurchaseInvoice',scenario)),{date:addDays(scenario.start,12),parents:[reference(purchase,'invoices-purchase')],document:{supplierInvoiceNumber:`SUP-DEMO-${scenario.id.toUpperCase()}`},status:index === 1 ? 'Partially paid' : 'Paid'});
    records.push(quotation,order,confirmation,delivery,deliveryConfirmation,invoice,purchase,supplierInvoice,makeCashRecord('BankReceipt',scenario,invoice,index),makeCashRecord('BankPayment',scenario,supplierInvoice,index));
  });
  return records;
}
export function buildEdgeRecords(commercial) {
  const source = commercial.find(record=>record.documentKind === 'SalesInvoice');
  const scenario = {...DEMO_SCENARIOS[0],id:'negative-adjustment',name:'Edge case · negative adjustment'};
  const items = source.data.items.slice(0,1).map(line => demoLine(`${recordId('SalesInvoice',scenario)}:line:1`,masters.products[0],-1,{rateMinor:line.rateMinor,discountMinor:-roundRatio(line.discountMinor,Math.abs(line.quantity)),extra:{parentDocumentId:source.id,parentLineId:line.id}}));
  const negative = makeDemoRecord('SalesInvoice',scenario,items,{date:addDays(source.data.document.date,10),parents:[reference(source,'reverses-part-of')],edgeCase:'negative-adjustment',status:'Edge-case fixture only',document:{adjustmentType:'Negative reversal demonstration; not a statutory credit note'},purpose:'Negative quantity, discount, tax and total signs remain consistent. Not an additional sale.'});
  const empty = makeDemoRecord('SalesQuotation',{...DEMO_SCENARIOS[0],id:'empty-draft',name:'Edge case · empty draft'},[],{edgeCase:'empty-draft',status:'Draft',purpose:'Empty line collection and zero totals test a new unissued quotation.'});
  return [negative,empty];
}

export function buildCurrencyRecords() {
  const scenario = {...DEMO_SCENARIOS[0],id:'usd-independent',name:'Independent USD proposal'};
  const id = recordId('SalesQuotation',scenario);
  const items = [demoLine(`${id}:line:1`,masters.products[0],4,{rateMinor:31250,taxBps:0}),
    demoLine(`${id}:line:2`,masters.products[1],12,{no:2,rateMinor:4680,taxBps:0})];
  const record = makeDemoRecord('SalesQuotation',scenario,items,{currency:'USD',date:'2026-09-10',status:'Draft',
    document:{validUntil:'2026-10-10',pricingBasis:'Independent synthetic USD quote; not converted from a MYR record.'},
    notes:'Fictional independent USD proposal. These USD unit prices were authored separately; no exchange rate or currency conversion is implied. No tax is applied in this isolated formatting example.',
    purpose:'Switching datasets must synchronize document currency and renderer formatting without converting supplied amounts.'});
  record.data.masterReferences.taxCodeId = 'tax:zero';
  record.data.demo.independentCurrency = true;
  return [record];
}
