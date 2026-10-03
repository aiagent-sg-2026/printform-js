import {it,expect} from 'vitest';
import {newDemoProject} from '../studio-v3/demo-templates.js';
import {newProject} from '../studio-v3/model.js';
import {saveProject,readProject} from '../studio-v3/file-io.js';
import {DemoDatabase} from '../studio-v3/database-controller.js';
import {starterRecords} from '../studio-v3/database-model.js';
it.each(['SalesQuotation','BankReceipt','PurchaseInvoice'])('file serialization and Open preserve %s design and supplied data',kind=>{
 const initial=newDemoProject(kind),opened=readProject(saveProject(initial));
 expect(opened.manifest.studioV3).toEqual(initial.manifest.studioV3);
 expect(opened.sampleData).toEqual(initial.sampleData);
 expect(opened.sampleData.document.kind).toBe(kind);
 expect(opened.manifest.title).toBe(initial.manifest.title);
});
it.each(['SalesQuotation','BankReceipt','PurchaseInvoice'])('remembered %s data never contaminates a fresh invoice',kind=>{
 const database=new DemoDatabase({}),records=starterRecords();database.records=records;
 const remembered=records.find(record=>record.data.document?.kind===kind);
 database.selected={invoice:remembered.id,purchase:remembered.id};
 const recovered=database.starting(newProject()).project;
 expect(recovered.manifest.studioV3.title).toBe('INVOICE');
 expect(recovered.sampleData.document.kind).not.toBe(kind);
 expect(recovered.sampleData.document.number).toMatch(/^INV-/);
});
