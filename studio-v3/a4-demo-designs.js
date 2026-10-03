import { a4PresetForKind } from './a4-presets.js';

const field = (id,label,pointer,format='')=>({id,label,pointer,format});
const column = (id,label,pointer,width,format='')=>({...field(id,label,pointer,format),width});
const get = (d,block,id)=>d[block].find(f=>f.id === id);
const add = (d,block,...fields)=>d[block].push(...fields);
const label = (d,block,id,value)=>{ const f=get(d,block,id); if(f)f.label=value; };
const remove = (d,block,...ids)=>{d[block]=d[block].filter(f=>!ids.includes(f.id));};
function common(design,preset) {
  design.layoutPreset=preset.id;
  design.page={paper:'A4',orientation:'portrait',margins:{top:22,right:22,bottom:22,left:22}};
  design.font=9;design.padding=7;design.repeatHeader=false;design.repeatTable=true;design.pageNumbers=true;
  design.blocks.customer.keepTogether=true;design.blocks.totals.keepTogether=true;
  design.titleStyle={fontSize:20,bold:true};
  design.pageNumberStyle={fontSize:8,color:'#59677a'};
  add(design,'header',field('currency','Currency','/document/currency'));
  // Departments belong with preparation details, leaving document identity easy to scan.
  const organization=design.header.filter(f=>['business-unit','department'].includes(f.id));
  remove(design,'header','business-unit','department');add(design,'footer',...organization);
  design.blocks.footer.layout={columns:2,gap:12};
  get(design,'header','number').valueStyle={bold:true};
  get(design,'customer','bill').valueStyle={bold:true};
  get(design,'totals',design.totals.at(-1).id).valueStyle={bold:true,fontSize:12};
}
const styles = {
  SalesQuotation(d) {
    d.color='#285e76';d.borders=false;d.striped=false;d.padding=9;
    label(d,'customer','bill','Prepared for');label(d,'totals','total','Quotation total');
    label(d,'header','reference','Related reference');
    d.titleStyle={fontSize:22,bold:false};
    get(d,'footer','quotation-terms').valueStyle={bold:true};
  },
  SalesOrder(d) {
    d.color='#244a68';d.padding=6;d.striped=true;
    add(d,'header',field('status','Order status','/document/status'));
    label(d,'header','reference','Accepted quotation');label(d,'totals','total','Order total');
    label(d,'customer','bill','Ordered by');d.titleStyle={fontSize:19,bold:true};
  },
  DeliveryOrder(d) {
    d.color='#294b58';d.borders=false;d.striped=false;d.padding=9;
    label(d,'customer','bill','Customer');label(d,'customer','ship','Deliver to');
    label(d,'header','reference','Sales order');label(d,'footer','signature','Dispatched by');
    add(d,'footer',field('carrier','Carrier','/delivery/carrier'),field('dispatch-reference','Dispatch reference','/delivery/trackingReference'));
    d.columns=[column('no','#','./no',5),column('sku','Item code','./sku',15),column('description','Goods / specification','./description',35),column('ordered','Ordered','./orderedQuantity',12,'number'),column('quantity','Dispatched','./quantity',12,'number'),column('remaining','Remaining','./remainingQuantity',12,'number'),column('unit','Unit','./unit',9)];
    d.totals[0].valueStyle={fontSize:16,bold:true};
  },
  SalesInvoice(d) {
    d.color='#24559b';d.borders=false;d.striped=true;d.padding=8;
    label(d,'header','reference','Delivery / order');label(d,'totals','total','Invoice total');
    add(d,'header',field('status','Payment status','/document/status'));
    d.titleStyle={fontSize:25,bold:true};
    // Invoice total is the supplied face value; it is never labelled outstanding balance.
  },
  PurchaseOrder(d) {
    d.color='#715a40';d.borders=true;d.striped=false;d.padding=7;
    label(d,'header','reference','Customer order');label(d,'customer','ship','Receive at');
    label(d,'totals','total','Purchase order total');
    add(d,'header',field('status','Order status','/document/status'));
    d.titleStyle={fontSize:19,bold:true};
  },
  PurchaseInvoice(d) {
    d.color='#605378';d.borders=false;d.striped=false;d.padding=6;
    label(d,'header','reference','Purchase order');label(d,'totals','total','Supplier invoice total');
    add(d,'header',field('supplier-invoice','Supplier invoice no.','/document/supplierInvoiceNumber'));
    remove(d,'customer','ship','ship-address');d.titleStyle={fontSize:19,bold:false};
    label(d,'footer','approval','Reviewed by');
  },
  BankReceipt(d) {
    d.color='#286e66';d.borders=false;d.striped=false;d.padding=12;
    remove(d,'header','reference');
    add(d,'customer',field('bank-ledger','Received into','/bank/name'),field('payment-method','Method','/bank/method'));
    add(d,'footer',field('cash-reference','Related invoice','/document/reference'),field('invoice-balance','Invoice balance after allocation','/summary/outstandingAmount','currency'));
    d.titleStyle={fontSize:24,bold:false};d.totals.at(-1).valueStyle={fontSize:18,bold:true};
  },
  BankPayment(d) {
    d.color='#73554d';d.borders=true;d.striped=false;d.padding=9;
    add(d,'customer',field('bank-ledger','Paid from','/bank/name'),field('payment-method','Method','/bank/method'));
    label(d,'header','reference','Supplier invoice');label(d,'footer','approval','Payment approved by');
    add(d,'footer',field('invoice-balance','Invoice balance after allocation','/summary/outstandingAmount','currency'));
    d.titleStyle={fontSize:22,bold:true};d.blocks.footer.layout={columns:3,gap:14};
  },
  EnterpriseProject(d) {
    d.color='#35656a';d.borders=false;d.striped=false;d.padding=8;
    remove(d,'header','contract-value');label(d,'header','due','Programme end');
    add(d,'header',field('start','Programme start','/project/startDate'));
    add(d,'customer',field('project-manager','Project manager','/project/manager'));
    d.customer=[...d.customer.filter(f=>['project-name','contract-reference'].includes(f.id)),...d.customer.filter(f=>!['project-name','contract-reference'].includes(f.id))];
    d.blocks.customer.layout={columns:2,gap:14};
    d.columns=[column('no','#','./no',6),column('description','Contract scope','./description',50),column('quantity','Qty','./quantity',12,'number'),column('unit','Unit','./unit',10),column('amount','Scope value','./amount',22,'currency')];
    d.totals=[field('contract','Contract value (excl. tax)','/project/contractValue','currency')];
    add(d,'footer',field('scope-note','Scope basis','/project/description'));
    d.titleStyle={fontSize:26,bold:false};d.totals[0].valueStyle={fontSize:14,bold:true};
  },
  ProgressClaim(d) {
    d.color='#3d526f';d.borders=true;d.striped=false;d.padding=6;
    d.title='PROGRESS CLAIM';d.titleStyle={fontSize:21,bold:true};
    remove(d,'customer','ship','ship-address');
    add(d,'header',field('period','Valuation period','/claim/period'),field('period-start','Period from','/claim/periodStart'),field('period-end','Period to','/claim/periodEnd'));
    d.customer=[...d.customer.filter(f=>['project-name','contract-reference'].includes(f.id)),...d.customer.filter(f=>!['project-name','contract-reference'].includes(f.id))];
    d.blocks.customer.layout={columns:2,gap:14};
    label(d,'columns','amount','After retention');
    add(d,'footer',field('claim-basis','Valuation basis','/claim/basis'));
  }
};
export function applyA4DemoDesign(design,kind) {
  const preset=a4PresetForKind(kind);if(!preset)return design;
  common(design,preset);styles[kind](design);return design;
}
