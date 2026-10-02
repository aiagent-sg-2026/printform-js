import {describe,it,expect} from 'vitest';
import {getDemoCatalog,demoStarterRecords} from '../studio-v3/demo-catalog.js';
import {newDemoProject} from '../studio-v3/demo-templates.js';
import {validateDesign} from '../studio-v3/design-validation.js';
import {validateDataset,datasetMatchesProject} from '../studio-v3/database-model.js';
import {createBus,replaceData} from '../studio-v3/controller.js';
import {saveProject,readProject} from '../studio-v3/file-io.js';
import {resolvePointer} from '../studio-v2/core/json.js';
describe('business demo templates',()=>{
 for(const entry of getDemoCatalog({includePending:false}))it(`${entry.label}: explicit bindings and portable round trip`,()=>{
  const project=newDemoProject(entry.documentKind),design=project.manifest.studioV3;
  expect(()=>validateDesign(design)).not.toThrow();expect(()=>validateDataset(project.sampleData)).not.toThrow();
  for(const section of ['header','customer','totals','footer'])for(const field of design[section])expect(resolvePointer(project.sampleData,field.pointer),`${section}/${field.id}: ${field.pointer}`).not.toBeUndefined();
  for(const column of design.columns)for(const row of project.sampleData.items)expect(resolvePointer(row,column.pointer.slice(1)),column.pointer).not.toBeUndefined();
  const restored=readProject(saveProject(project));expect(restored.sampleData.document.kind).toBe(entry.documentKind);expect(restored.manifest.currency).toBe(project.sampleData.document.currency);
 });
 it('keeps exact business kinds distinct even when they share a layout family',()=>{
  const project=newDemoProject('SalesInvoice');expect(datasetMatchesProject(demoStarterRecords('SalesInvoice')[0],project)).toBe(true);expect(datasetMatchesProject(demoStarterRecords('BankReceipt')[0],project)).toBe(false);
 });
 it('changes currency atomically with supplied data and restores it through undo',async()=>{
  const bus=createBus(newDemoProject('SalesQuotation'));const data=structuredClone(bus.project.sampleData);data.document.currency='SGD';data.summary.currency='SGD';
  await replaceData(bus,data);expect(bus.project.manifest.currency).toBe('SGD');expect(bus.project.sampleData.document.currency).toBe('SGD');
  await bus.navigateHistory('undo',bus.revision);expect(bus.project.manifest.currency).toBe('MYR');
  data.document.currency='UNSUPPORTED';await expect(replaceData(bus,data)).rejects.toThrow('currency');expect(bus.project.manifest.currency).toBe('MYR');
 });
});

it('validates every template binding against every catalogue scenario',()=>{
 for(const entry of getDemoCatalog({includePending:false})) {
  const design=newDemoProject(entry.documentKind).manifest.studioV3;
  for(const record of demoStarterRecords(entry.documentKind)) {
   for(const section of ['header','customer','totals','footer'])for(const field of design[section])expect(resolvePointer(record.data,field.pointer),`${record.id}: ${field.pointer}`).not.toBeUndefined();
   for(const row of record.data.items)for(const field of design.columns)expect(resolvePointer(row,field.pointer.slice(1)),`${record.id}: ${field.pointer}`).not.toBeUndefined();
  }
 }
});

it('offers only closed business binding paths to AI without fictional or private values',async()=>{
 const {availableBindings,shareAuthoring}=await import('../studio-v3/ai-authoring.js');
 const project=newDemoProject('CertifiedClaim');project.sampleData.privateClientKey={arbitraryValue:999};
 const paths=availableBindings(project).map(f=>f.pointer);expect(paths).toContain('/project/name');expect(paths).toContain('/summary/certifiedAmount');expect(paths).toContain('./currentWork');
 const shared=JSON.stringify(shareAuthoring(project));expect(shared).not.toContain('Lantern Works');expect(shared).not.toContain('privateClientKey');expect(shared).not.toContain('arbitraryValue');
});
