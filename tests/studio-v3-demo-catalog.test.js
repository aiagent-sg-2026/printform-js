import { describe, expect, it } from 'vitest';
import { DEMO_MASTER_DATA, demoDataForKind, demoRecordById, demoRecordForKind, demoStarterRecords, getDemoCatalog } from '../studio-v3/demo-catalog.js';
import { amount, demoLine, roundRatio } from '../studio-v3/demo-fixture-math.js';
import { validateDataset } from '../studio-v3/database-model.js';

const records = demoStarterRecords();
const byId = new Map(records.map(record=>[record.id,record]));
const sum = (rows,key) => rows.reduce((total,row)=>total+row[key],0);
const ready = getDemoCatalog({includePending:false});

describe('fictional document catalog and safe shared masters',()=>{
  it('keeps explicit business kinds separate from the three renderer families',()=>{
    expect(ready).toHaveLength(15);
    expect(new Set(ready.map(entry=>entry.documentKind)).size).toBe(15);
    for (const entry of ready) {
      expect(['invoice','purchase','delivery']).toContain(entry.baseType);
      expect([3,4,5]).toContain(entry.scenarioCount);
      expect(demoStarterRecords(entry.documentKind).filter(record=>!record.data.demo.edgeCase).length).toBeLessThanOrEqual(4);
      expect(demoStarterRecords(entry.documentKind)).toHaveLength(entry.scenarioCount);
    }
    expect(getDemoCatalog().filter(entry=>entry.status === 'pending-definition').map(entry=>entry.kind)).toEqual(['PCA','CCAR','PCAP','CCAP']);
    for (const abbreviation of ['PCA','CCAR','PCAP','CCAP']) expect(()=>demoDataForKind(abbreviation)).toThrow('undefined');
    expect(ready.find(entry=>entry.kind === 'PurchaseInvoice').baseType).toBe('purchase');
    expect(ready.find(entry=>entry.kind === 'DeliveryOrderConfirmation').baseType).toBe('delivery');
  });
  it('has stable unique record, document, line and master identities',()=>{
    const ids = records.flatMap(record=>[record.id,...record.data.items.map(item=>item.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(records.map(record=>record.data.document.number)).size).toBe(records.length);
    const masterIds = Object.values(DEMO_MASTER_DATA).flatMap(value=>Array.isArray(value) ? value.map(row=>row.id) : [value.id]);
    expect(new Set(masterIds).size).toBe(masterIds.length);
    expect(demoStarterRecords()).toEqual(records);
    expect(JSON.parse(JSON.stringify(records))).toEqual(records);
  });
  it('returns independent editable copies without changing shared fixture state',()=>{
    const copy = demoRecordForKind('SalesInvoice'); copy.data.items[0].amount = -999;
    copy.data.company.name = 'Changed';
    expect(demoRecordForKind('SalesInvoice')).toEqual(byId.get(copy.id));
    expect(demoRecordById(copy.id)).toEqual(byId.get(copy.id));
    expect(demoRecordForKind('SalesInvoice','canopy').id).toBe(copy.id);
    expect(()=>demoRecordForKind('SalesInvoice',999)).toThrow('scenario');
    expect(()=>demoRecordById('missing')).toThrow('Unknown');
    const catalog = getDemoCatalog(); catalog[0].label = 'Changed'; catalog.at(-1).status = 'ready';
    expect(getDemoCatalog()[0].label).not.toBe('Changed');
    expect(getDemoCatalog().at(-1).status).toBe('pending-definition');
  });
  it('uses .example contacts and openly fictional entities, with no account numbers',()=>{
    const source = JSON.stringify(records);
    const emails = source.match(/[a-z0-9.-]+@[a-z0-9.-]+/g);
    expect(emails.length).toBeGreaterThan(0);
    expect(emails.every(email=>email.endsWith('.example'))).toBe(true);
    for (const record of records) {
      expect(record.data.demo.fictional).toBe(true);
      expect(record.data.company.name).toContain('Fictional');
      expect(record.data.customer.name).toContain('Fictional');
      expect(record.data.company.registration).toMatch(/^DEMO-/);
      expect(record.title.length).toBeLessThanOrEqual(100);
    }
    expect(DEMO_MASTER_DATA.bankAccounts[0].reference).toBe('DEMO-ONLY-NO-BANK-ACCOUNT');
    expect(source).not.toMatch(/"(?:accountNumber|iban|swift)"/);
  });
  it('validates every existing common dataset contract and master reference',()=>{
    const refs = {companyId:'company',customerId:'customers',supplierId:'suppliers',salespersonId:'salespeople',departmentId:'departments',businessUnitId:'businessUnits',creditTermId:'creditTerms',quotationTermId:'quotationTerms',currencyId:'currencies',taxCodeId:'taxCodes',billingAddressId:'addresses',shippingAddressId:'addresses',bankAccountId:'bankAccounts'};
    for (const record of records) {
      expect(()=>validateDataset(record.data)).not.toThrow();
      expect(record.type).toBe(record.baseType);
      expect(record.data.document).toMatchObject({id:record.id,kind:record.documentKind,baseType:record.type,minorUnitDigits:2});
      expect(['MYR','USD']).toContain(record.data.document.currency);
      for (const [key,id] of Object.entries(record.data.masterReferences)) {
        const collection = refs[key] === 'company' ? [DEMO_MASTER_DATA.company] : DEMO_MASTER_DATA[refs[key]];
        expect(collection?.some(master=>master.id === id),`${record.id} ${key}`).toBe(true);
      }
      for (const line of record.data.items) if (line.productId) expect(DEMO_MASTER_DATA.products.some(product=>product.id === line.productId)).toBe(true);
    }
  });
});

describe('integer-minor-unit fixture accounting',()=>{
  it('rounds symmetric half ties and rejects unsafe calculations',()=>{
    expect(roundRatio(5,2)).toBe(3); expect(roundRatio(-5,2)).toBe(-3);
    expect(()=>roundRatio(1,0)).toThrow('positive divisor');
    expect(()=>roundRatio(Number.MAX_SAFE_INTEGER+1,10)).toThrow('safe integer');
    expect(()=>demoLine('line',DEMO_MASTER_DATA.products[0],1.2345)).toThrow('three decimal');
  });
  it('reconciles quantity, price, discount, line tax, and every document total',()=>{
    for (const record of records) {
      const {items,summary} = record.data;
      for (const line of items) {
        for (const key of ['quantityMilli','rateMinor','grossMinor','discountMinor','amountMinor','taxMinor','totalMinor']) expect(Number.isSafeInteger(line[key]),`${record.id} ${key}`).toBe(true);
        expect(line.quantity*1000).toBe(line.quantityMilli);
        expect(line.rate).toBe(amount(line.rateMinor));
        expect(line.grossMinor).toBe(roundRatio(line.quantityMilli*line.rateMinor,1000));
        expect(line.amountMinor).toBe(line.grossMinor-line.discountMinor);
        expect(line.amount).toBe(amount(line.amountMinor));
        expect(line.taxMinor).toBe(roundRatio(line.amountMinor*line.taxBps,10000));
        expect(line.totalMinor).toBe(line.amountMinor+line.taxMinor);
      }
      expect(summary.subtotalMinor).toBe(sum(items,'amountMinor'));
      expect(summary.taxMinor).toBe(sum(items,'taxMinor'));
      expect(summary.totalMinor).toBe(summary.subtotalMinor+summary.taxMinor);
      for (const key of ['subtotal','tax','total']) expect(summary[key]).toBe(amount(summary[`${key}Minor`]));
      expect(summary.discountMinor).toBe(sum(items,'discountMinor'));
      expect(summary.roundingMinor).toBe(0); expect(summary.currency).toBe(record.data.document.currency);
    }
  });
  it('keeps partial dispatch and discount amounts proportional to source order lines',()=>{
    for (const record of demoStarterRecords('DeliveryOrder')) {
      expect(record.data.delivery.partial).toBe(true);
      for (const line of record.data.items) {
        const parent = byId.get(line.parentDocumentId), source = parent.data.items.find(item=>item.id === line.parentLineId);
        expect(parent.documentKind).toBe('SalesOrder');
        expect(line.quantity).toBeGreaterThan(0); expect(line.quantity).toBeLessThan(source.quantity);
        expect(line.orderedQuantity).toBe(source.quantity);
        expect(line.remainingQuantity+line.quantity).toBe(source.quantity);
        expect(line.rateMinor).toBe(source.rateMinor);
        expect(line.discountMinor).toBe(roundRatio(source.discountMinor*line.quantityMilli,source.quantityMilli));
      }
    }
  });
  it('invoices delivered quantities and preserves exact source amounts',()=>{
    for (const record of demoStarterRecords('SalesInvoice').filter(entry=>!entry.data.demo.edgeCase)) {
      for (const line of record.data.items) {
        const parent = byId.get(line.parentDocumentId),source = parent.data.items.find(item=>item.id === line.parentLineId);
        expect(parent.documentKind).toBe('DeliveryOrder');
        for (const key of ['quantity','rateMinor','amountMinor','discountMinor','taxMinor','totalMinor']) expect(line[key]).toBe(source[key]);
      }
    }
  });
  it('reconciles receipt/payment allocations, balances, and unapplied advances',()=>{
    for (const kind of ['BankReceipt','BankPayment']) {
      const cash = demoStarterRecords(kind);
      expect(cash.some(record=>record.data.summary.outstandingMinor > 0)).toBe(true);
      expect(cash.some(record=>record.data.summary.unappliedMinor > 0)).toBe(true);
      for (const record of cash) {
        const {allocations,summary,cashMovement} = record.data;
        expect(sum(allocations,'allocatedMinor')).toBe(summary.allocatedMinor);
        expect(summary.totalMinor).toBe(summary.allocatedMinor+summary.unappliedMinor);
        expect(summary.receivedMinor).toBe(summary.totalMinor);
        expect(cashMovement.amountMinor).toBe(summary.totalMinor);
        expect(cashMovement.direction).toBe(kind === 'BankReceipt' ? 'in' : 'out');
        expect(summary.taxMinor).toBe(0);
        for (const allocation of allocations) {
          const invoice = byId.get(allocation.invoiceId);
          expect(invoice.documentKind).toBe(kind === 'BankReceipt' ? 'SalesInvoice' : 'PurchaseInvoice');
          expect(invoice.data.customer.id).toBe(record.data.customer.id);
          expect(invoice.data.summary.totalMinor).toBe(allocation.invoiceTotalMinor);
          expect(allocation.allocatedMinor+allocation.previouslyAllocatedMinor+allocation.remainingMinor).toBe(allocation.invoiceTotalMinor);
          expect(allocation.remainingMinor).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('document lineage, projects and cumulative claims',()=>{
  it('resolves all parent documents and line relations without forward-dated sources',()=>{
    for (const record of records) {
      for (const reference of record.data.parentDocuments) {
        const parent = byId.get(reference.id);
        expect(parent,`${record.id} -> ${reference.id}`).toBeDefined();
        expect(parent.documentKind).toBe(reference.documentKind);
        expect(parent.data.document.number).toBe(reference.number);
        expect(parent.data.document.currency).toBe(record.data.document.currency);
        expect(parent.data.document.date <= record.data.document.date).toBe(true);
      }
      for (const line of record.data.items) {
        if (line.parentDocumentId) {
          const parent = byId.get(line.parentDocumentId); expect(parent).toBeDefined();
          if (line.parentLineId) expect(parent.data.items.some(item=>item.id === line.parentLineId)).toBe(true);
        }
        if (line.previousClaimLineId) expect(records.some(parent=>parent.data.items.some(item=>item.id === line.previousClaimLineId))).toBe(true);
        if (line.applicationDocumentId) expect(byId.get(line.applicationDocumentId).data.items.some(item=>item.id === line.applicationLineId)).toBe(true);
      }
    }
  });
  it('ties each project value to its accepted scope',()=>{
    for (const record of demoStarterRecords('EnterpriseProject')) {
      const {project,summary} = record.data,source = byId.get(project.contractDocumentId);
      expect(project.contractValueMinor).toBe(source.data.summary.subtotalMinor);
      expect(project.contractValueMinor).toBe(summary.subtotalMinor);
      expect(project.startDate < project.endDate).toBe(true);
    }
  });
  it('reconciles three successive applications and separate certification histories',()=>{
    for (const kind of ['ProgressClaim','CertifiedClaim']) {
      const claims = demoStarterRecords(kind);
      claims.forEach((record,index)=>{
        const {summary,items} = record.data,previous = claims[index-1];
        expect(summary.previousWorkMinor).toBe(previous?.data.summary.cumulativeWorkMinor || 0);
        expect(summary.previousClaimMinor).toBe(previous?.data.summary.cumulativeClaimMinor || 0);
        expect(summary.previousWorkMinor+summary.currentWorkMinor).toBe(summary.cumulativeWorkMinor);
        expect(summary.previousClaimMinor+summary.currentClaimMinor).toBe(summary.cumulativeClaimMinor);
        expect(summary.currentWorkMinor-summary.retentionMinor).toBe(summary.currentClaimMinor);
        expect(summary.currentClaimMinor).toBe(summary.subtotalMinor);
        expect(summary.cumulativeWorkMinor).toBeLessThanOrEqual(record.data.project.contractValueMinor);
        for (const key of ['currentWorkMinor','cumulativeWorkMinor','previousWorkMinor','retentionMinor']) expect(summary[key]).toBe(sum(items,key));
        for (const line of items) expect(line.cumulativeRetentionMinor).toBe(roundRatio(line.cumulativeWorkMinor*500,10000));
      });
    }
    for (const record of demoStarterRecords('CertifiedClaim')) {
      const application = byId.get(record.data.certification.applicationId),summary = record.data.summary;
      expect(summary.certifiedAmountMinor).toBe(summary.currentClaimMinor);
      expect(summary.certifiedCumulativeMinor).toBeLessThan(summary.appliedCumulativeMinor);
      expect(summary.cumulativeVarianceMinor).toBe(application.data.summary.cumulativeWorkMinor-summary.cumulativeWorkMinor);
      expect(record.data.certification.reason).toContain('pending');
    }
  });
  it('ties generic receivable/payable claims to a real fixture source without inventing abbreviations',()=>{
    for (const kind of ['AccountsReceivableClaim','AccountsPayableClaim']) for (const record of demoStarterRecords(kind)) {
      const source = byId.get(record.data.claim.sourceDocumentId);
      expect(source.documentKind).toBe(kind === 'AccountsReceivableClaim' ? 'CertifiedClaim' : 'PurchaseInvoice');
      expect(record.data.summary.claimedAmountMinor).toBe(source.data.summary.totalMinor);
      expect(record.data.summary.totalMinor).toBe(source.data.summary.totalMinor);
      expect(record.data.claim.definition).toContain('Not an asserted meaning');
    }
  });
  it('offers an independent USD quotation with no conversion or mixed-currency lineage',()=>{
    const usd = demoRecordForKind('SalesQuotation','usd-independent');
    expect(usd.data.document.currency).toBe('USD'); expect(usd.data.summary.currency).toBe('USD');
    expect(usd.data.parentDocuments).toEqual([]); expect(usd.data.summary.totalMinor).toBe(181160);
    expect(usd.data.demo.independentCurrency).toBe(true);
    expect(usd.data.document.pricingBasis).toContain('not converted');
    expect(usd.data.masterReferences.currencyId).toBe('USD');
  });
  it('provides explicit empty/negative edge cases and long bilingual pagination samples',()=>{
    const empty = records.find(record=>record.data.demo.edgeCase === 'empty-draft');
    expect(empty.data.items).toEqual([]); expect(empty.data.summary.totalMinor).toBe(0);
    const negative = records.find(record=>record.data.demo.edgeCase === 'negative-adjustment');
    expect(negative.data.summary.totalMinor).toBeLessThan(0); expect(negative.title).toContain('Edge case');
    expect(negative.data.items.every(item=>item.quantity < 0 && item.amountMinor < 0 && item.taxMinor < 0)).toBe(true);
    const long = demoRecordForKind('SalesInvoice','campus');
    expect(long.data.items).toHaveLength(64);
    expect(long.data.items.some(line=>line.description.length > 300 && line.description.includes('安装'))).toBe(true);
  });
});
