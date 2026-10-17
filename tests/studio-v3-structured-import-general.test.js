import { it, expect, vi } from 'vitest';
import { createBus, replaceData } from '../studio-v3/controller.js';
import { DemoDatabase } from '../studio-v3/database-controller.js';
import { createDatabase } from '../studio-v3/database-store.js';
import { databaseView } from '../studio-v3/database-view.js';
import { readProject, saveProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { generalImportProject } from './fixtures/structured-import-general.js';

const rows = 'code,quantity,uom\n00009,-001.250,kg\n00007,0002.500,box\n';
const rowMappings = () => Object.fromEntries(['code','quantity','uom'].map(key=>[`/${key}`,{source:`/${key}`,conversion:'preserve'}]));
async function setup(project) {
  const bus = createBus(readProject(saveProject(project))), state = {sample:'erp',mode:'data',dataDraft:null};
  const database = new DemoDatabase({project:()=>bus.project,state:()=>state,context:()=>bus,render:()=>{},busy:()=>{},
    apply:(data,reference,context,source,title,schema,receipt)=>replaceData(context,data,'erp',reference,source,title,schema,receipt)});
  database.store = await createDatabase(); await database.refresh(); return {bus,state,database};
}
function printed(project) {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  return bindTemplate(template,project.sampleData,project.manifest).fragment.textContent;
}
it('imports a declared /records collection without /items while preserving string quantity, exact values, source contract and real history',async()=> {
  vi.stubGlobal('indexedDB',undefined);
  const original = generalImportProject(), {bus,state,database} = await setup(original);
  try {
    const before = structuredClone(bus.project), records = await database.store.list();
    await database.action('import-file',{source:rows,filename:'fictional-workshop.csv'});
    expect(database.importReview.targetPointer).toBe('/records'); database.importReview.mappings = rowMappings();
    await database.action('import-preview',{}); expect(bus.project).toEqual(before);
    await database.action('import-apply',{});
    expect(bus.project.sampleData).not.toHaveProperty('items');
    expect(bus.project.sampleData.records).toEqual([{code:'00009',quantity:'-001.250',uom:'kg'},{code:'00007',quantity:'0002.500',uom:'box'}]);
    expect(bus.project.sampleData.workOrder).toEqual(before.sampleData.workOrder); expect(bus.project.schema).toEqual(original.schema);
    expect(bus.project.manifest.datasetSchema).toEqual(original.manifest.datasetSchema);
    expect(printed(bus.project)).toContain('-001.250'); expect(printed(bus.project)).toContain('00009');
    expect(await database.store.list()).toEqual(records);
    const reopened = readProject(saveProject(bus.project));
    expect(reopened.sampleData).toEqual(bus.project.sampleData); expect(reopened.schema).toEqual(original.schema);
    expect(reopened.manifest.localImport.sourceText).toBe(rows);
    const applied = structuredClone(bus.project);
    await bus.navigateHistory('undo',bus.revision); expect(bus.project.sampleData).toEqual(before.sampleData);
    await bus.navigateHistory('redo',bus.revision); expect(bus.project.sampleData).toEqual(applied.sampleData);
    const view = document.createElement('div'); view.innerHTML = databaseView(database,bus.project,state);
    for (const action of ['save','copy','export']) expect(view.querySelector(`[data-db-action="${action}"]`).disabled).toBe(true);
    expect(view.querySelector('#database-compatibility').textContent).toContain('Save form / Open');
    await expect(database.save(true)).rejects.toThrow('invoice-compatible /items');
    await expect(database.action('export',{})).rejects.toThrow('invoice-compatible /items');
    expect(database.draft).toBeNull(); expect(await database.store.list()).toEqual(records);
  } finally { database.store.close(); vi.unstubAllGlobals(); }
});
it('rejects required-field and strict-schema errors in generic records without changing the active form or database',async()=> {
  vi.stubGlobal('indexedDB',undefined);
  const {bus,database} = await setup(generalImportProject());
  try {
    const before = structuredClone(bus.project), saved = await database.store.list();
    await database.action('import-file',{source:'code,quantity,uom\n00009,not-a-decimal,kg\n',filename:'bad-quantity.csv'});
    database.importReview.mappings = rowMappings(); await expect(database.action('import-preview',{})).rejects.toThrow();
    expect(bus.project).toEqual(before); expect(await database.store.list()).toEqual(saved);
    await database.action('import-file',{source:rows,filename:'fictional.csv'});
    database.importReview.mappings = rowMappings(); database.importReview.mappings['/quantity'].conversion = 'number';
    await expect(database.action('import-preview',{})).rejects.toThrow('requires string');
    database.importReview.mappings = rowMappings(); delete database.importReview.mappings['/uom'];
    await expect(database.action('import-preview',{})).rejects.toThrow('required target');
    expect(bus.project).toEqual(before); expect(await database.store.list()).toEqual(saved);
  } finally { database.store.close(); vi.unstubAllGlobals(); }
});
it('defaults a no-table work order to form fields and preserves unrelated media, protected status and schema across portable reopen',async()=> {
  vi.stubGlobal('indexedDB',undefined);
  const original = generalImportProject(false), {bus,database} = await setup(original);
  try {
    const before = structuredClone(bus.project), source = 'job,instruction\nWO-00009,New supplied fictional instruction\n';
    await database.action('import-file',{source,filename:'work-order.csv'});
    expect(database.importReview.targetPointer).toBe('');
    database.importReview.mappings = {'/workOrder/number':{source:'/job',conversion:'preserve'},'/workOrder/instruction':{source:'/instruction',conversion:'preserve'}};
    await database.action('import-preview',{}); expect(bus.project).toEqual(before);
    await database.action('import-apply',{});
    expect(bus.project.sampleData).toEqual({workOrder:{number:'WO-00009',instruction:'New supplied fictional instruction',status:'Source draft'},media:{token:'MEDIA-001'}});
    expect(printed(bus.project)).toContain('WO-00009'); expect(printed(bus.project)).toContain('MEDIA-001');
    const reopened = readProject(saveProject(bus.project)); expect(reopened.sampleData).toEqual(bus.project.sampleData);
    expect(reopened.schema).toEqual(original.schema); expect(reopened.manifest.localImport.sourceText).toBe(source);
    await bus.navigateHistory('undo',bus.revision); expect(bus.project.sampleData).toEqual(before.sampleData);
  } finally { database.store.close(); vi.unstubAllGlobals(); }
});
it('preserves an ordinary object-valued customer profile through real import, printed data, receipt and portable reopen',async()=> {
  vi.stubGlobal('indexedDB',undefined);
  const original = generalImportProject(false);
  original.sampleData.profile = {category:'Fictional retail customer',reference:'00042'};
  original.schema.properties.profile = {type:'object',required:['category','reference'],additionalProperties:false,properties:{category:{type:'string'},reference:{type:'string'}}};
  const {bus,database} = await setup(original);
  try {
    await database.action('import-file',{source:'job\nWO-00042\n',filename:'fictional-profile.csv'});
    database.importReview.mappings = {'/workOrder/number':{source:'/job',conversion:'preserve'}};
    await database.action('import-preview',{}); await database.action('import-apply',{});
    expect(bus.project.sampleData.workOrder.number).toBe('WO-00042');
    expect(printed(bus.project)).toContain('WO-00042');
    const reopened = readProject(saveProject(bus.project));
    expect(reopened.sampleData.profile).toEqual(original.sampleData.profile);
    expect(reopened.sampleData.workOrder.status).toBe('Source draft');
    expect(reopened.schema).toEqual(original.schema);
    expect(reopened.manifest.localImport.sourceText).toBe('job\nWO-00042\n');
  } finally { database.store.close(); vi.unstubAllGlobals(); }
});
it('uses the real project portability budget rather than imposing the old dataset envelope limit on general forms',async()=> {
  vi.stubGlobal('indexedDB',undefined);
  const {bus,database} = await setup(generalImportProject(false));
  try {
    const instruction = 'Fictional supplied note. '.repeat(47000), source = `instruction\n${instruction}\n`;
    await database.action('import-file',{source,filename:'general-project.csv'});
    database.importReview.mappings = {'/workOrder/instruction':{source:'/instruction',conversion:'preserve'}};
    await database.action('import-preview',{}); await database.action('import-apply',{});
    const portable = saveProject(bus.project);
    expect(new TextEncoder().encode(portable).length).toBeGreaterThan(2*1024*1024);
    expect(readProject(portable).sampleData.workOrder.instruction).toBe(instruction);
    expect(bus.project.sampleData).not.toHaveProperty('items');
  } finally { database.store.close(); vi.unstubAllGlobals(); }
});
