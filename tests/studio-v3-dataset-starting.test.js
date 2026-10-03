import {it,expect} from 'vitest';
import {A4_PRESETS} from '../studio-v3/a4-presets.js';
import {demoStarterRecords} from '../studio-v3/demo-catalog.js';
import {newDemoProject} from '../studio-v3/demo-templates.js';
import {DemoDatabase} from '../studio-v3/database-controller.js';
import {databaseView} from '../studio-v3/database-view.js';
import {createBus} from '../studio-v3/controller.js';
import {saveProject} from '../studio-v3/file-io.js';

async function databaseFor(kind) {
 const records=demoStarterRecords(kind).map(record=>({...record,revision:1}));
 const database=new DemoDatabase({});
 database.store={persistent:true,list:async()=>structuredClone(records)};
 await database.refresh();return {database,records};
}
function expectActiveAndSaved(database,initial,record) {
 const next=database.starting(initial),bus=createBus(next.project,next.reference);
 expect(next.reference.id).toBe(record.id);
 expect(bus.project.studioV3Session.database.id).toBe(record.id);
 expect(bus.project.manifest.sampleDataTitle).toBe(record.title);
 expect(bus.project.manifest.currency).toBe(record.data.document.currency);
 document.body.innerHTML=databaseView(database,bus.project,{sample:'erp',dataDraft:null});
 expect(document.querySelector('#database-choice').value).toBe(record.id);
 expect(document.querySelector('#database-name').value).toBe(record.title);
 expect(document.querySelector('#db-draft-status').textContent).toBe('Form matches saved dataset');
 const saved=JSON.parse(saveProject(bus.project));
 expect(saved.project.manifest.sampleDataTitle).toBe(record.title);
 expect(saved.project.manifest.currency).toBe(record.data.document.currency);
 expect(JSON.stringify(saved.project.sampleData)).toBe(JSON.stringify(record.data));
 expect(saved.project.manifest.studioV3).toEqual(initial.manifest.studioV3);
 return next;
}
for(const {documentKind:kind} of A4_PRESETS) {
 it(`${kind}: New fallback follows dataset title order rather than catalog order`,async()=>{
  const {database,records}=await databaseFor(kind),initial=newDemoProject(kind);
  const fallback=records.find(record=>record.data.demo.scenario===(kind==='ProgressClaim'?'canopy-period-1':'campus'));
  expect(initial.sampleData).toEqual(records[0].data);
  expect(database.records[0].id).toBe(fallback.id);
  const next=expectActiveAndSaved(database,initial,fallback);
  // Installing a saved record cannot mutate the constructor fixture or catalog.
  next.project.sampleData.customer.name='Changed in the form';
  expect(initial.sampleData).toEqual(records[0].data);
  expect(database.records[0].data).toEqual(fallback.data);
 });
 it(`${kind}: New honors a compatible remembered dataset before its title fallback`,async()=>{
  const {database,records}=await databaseFor(kind),remembered=records.at(-1);
  database.selected[remembered.type]=remembered.id;
  expectActiveAndSaved(database,newDemoProject(kind),remembered);
 });
}
it('New ignores a remembered record from another business kind even with the same base type',async()=>{
 const {database,records}=await databaseFor('SalesQuotation'),other=demoStarterRecords('SalesInvoice')[0];
 database.records.push({...other,revision:1});database.selected[other.type]=other.id;
 expectActiveAndSaved(database,newDemoProject('SalesQuotation'),records.find(record=>record.data.demo.scenario==='campus'));
});
it('campus long-form coverage uses real 64-row fixtures; bank allocations stay two rows',()=>{
 const longKinds=['SalesQuotation','SalesOrder','DeliveryOrder','SalesInvoice','PurchaseOrder','PurchaseInvoice','EnterpriseProject'];
 for(const kind of longKinds)expect(demoStarterRecords(kind).find(record=>record.data.demo.scenario==='campus').data.items,kind).toHaveLength(64);
 for(const kind of ['BankReceipt','BankPayment'])expect(demoStarterRecords(kind).find(record=>record.data.demo.scenario==='campus').data.items,kind).toHaveLength(2);
 expect(demoStarterRecords('ProgressClaim').some(record=>record.data.demo.scenario==='campus')).toBe(false);
});
