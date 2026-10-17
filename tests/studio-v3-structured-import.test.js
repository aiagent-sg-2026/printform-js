import { it, expect, vi } from 'vitest';
import { newProject, compileProject, designOf } from '../studio-v3/model.js';
import { createBus, replaceData } from '../studio-v3/controller.js';
import { DemoDatabase } from '../studio-v3/database-controller.js';
import { createDatabase } from '../studio-v3/database-store.js';
import { createLocalDatasetSource } from '../studio-v3/data-source-adapter.js';
import { exportDataset, importDataset } from '../studio-v3/database-model.js';
import { readProject, saveProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { parseCSV, parseLosslessRecords, parseStructuredImport } from '../studio-v3/structured-import-parser.js';
import { createImportReview, previewImport, importTargets } from '../studio-v3/structured-import-model.js';
import { convertImportValue } from '../studio-v3/structured-import-values.js';
import { validateImportReceipt } from '../studio-v3/structured-import-receipt.js';
import { nestedDatasetFixture } from './fixtures/nested-dataset.js';

const csv = 'n,code,description,qty,unit,total,uom\r\n1,00007,"Fictional, 中文\nline",2,001.250,2.500,box\r\n2,00008,Second,3,2.000,6.000,kg\r\n';
const mappings = () => Object.fromEntries([
  ['/no','/n','number'],['/sku','/code','preserve'],['/description','/description','preserve'],
  ['/quantity','/qty','number'],['/rate','/unit','number'],['/amount','/total','number']
].map(([target,source,conversion])=>[target,{source,conversion}]));
async function setup(project=newProject()) {
  const bus = createBus(project), state = {sample:'erp',mode:'data',dataDraft:null};
  const database = new DemoDatabase({project:()=>bus.project,state:()=>state,context:()=>bus,render:()=>{},busy:()=>{},
    apply:(data,reference,context,source,title,schema,receipt)=>replaceData(context,data,'erp',reference,source,title,schema,receipt)});
  database.store = await createDatabase(); database.source = createLocalDatasetSource(database.store);
  await database.refresh(); return {bus,state,database};
}
function printed(project) {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  return bindTemplate(template,project.sampleData,project.manifest).fragment.textContent;
}

it('preserves quoted CSV spelling, CRLF, embedded newline, UOM and formula-like literal text',()=> {
  const rows = parseCSV(csv);
  expect(rows[0]).toMatchObject({code:'00007',unit:'001.250',total:'2.500',description:'Fictional, 中文\nline',uom:'box'});
  expect(parseCSV('id,value\n01,=SUM(A1:A2)\n')[0]).toEqual({id:'01',value:'=SUM(A1:A2)'});
  expect(parseCSV('id,note\n0001,"a ""quoted"" value"\n')[0].note).toBe('a "quoted" value');
  expect(parseCSV(' id ,value\n 01 , x \n')[0]).toEqual({' id ':' 01 ',value:' x '});
});
it.each([
  ['a,a\n1,2','duplicate'],['a, A \n1,2','duplicate'],['é,e\u0301\n1,2','duplicate'],
  ['a,b\n1','expected'],['a,b\n1,2,3','expected'],['a\n"unterminated','unterminated'],
  ['a\n"x"tail','Unexpected'],['a\nx"y','quotes'],['__proto__\nx','safe'],['constructor\nx','safe']
])('rejects ambiguous or malformed CSV before exposing records: %s',(text,message)=>expect(()=>parseCSV(text)).toThrow(message));
it('keeps JSON numeric lexemes exactly, rejects duplicate names and prototype keys',()=> {
  expect(parseLosslessRecords('{"id":9007199254740993,"decimal":1.2300,"zero":-0,"small":1e-7,"ok":true,"empty":null}'))
    .toEqual({id:'9007199254740993',decimal:'1.2300',zero:'-0',small:'1e-7',ok:true,empty:null});
  for (const source of ['{"a":1,"a":2}','{"__proto__":{}}','{"constructor":1}','{"a":01}','[{},]']) expect(()=>parseLosslessRecords(source)).toThrow();
  expect(()=>convertImportValue('9007199254740993','number')).toThrow('unsafe integer');
  expect(convertImportValue('001.250','number')).toBe(1.25);
  expect(convertImportValue('-0','number')).toBe(0);
  for (const value of ['', ' 2', '1,000', '+2', 'Infinity']) expect(()=>convertImportValue(value,'number')).toThrow();
  expect(()=>convertImportValue('yes','boolean')).toThrow();
});
it('requires deliberate mappings and conversions and validates every later row without mutating the form',()=> {
  const project = newProject(), before = structuredClone(project), review = createImportReview(project,csv,'fictional.csv');
  expect(()=>previewImport(project,review)).toThrow('Map at least one');
  review.mappings = mappings(); review.mappings['/quantity'].conversion = 'preserve';
  expect(()=>previewImport(project,review)).toThrow('explicit conversion');
  review.mappings['/quantity'].conversion = 'number'; delete review.mappings['/no'];
  expect(()=>previewImport(project,review)).toThrow('required target');
  review.mappings = mappings(); const preview = previewImport(project,review);
  expect(preview.data.items).toEqual([{no:1,sku:'00007',description:'Fictional, 中文\nline',quantity:2,rate:1.25,amount:2.5},{no:2,sku:'00008',description:'Second',quantity:3,rate:2,amount:6}]);
  expect(preview.data.summary).toEqual(project.sampleData.summary);
  expect(project).toEqual(before);
  const bad = createImportReview(project,csv.replace('3,2.000','oops,2.000'),'bad.csv'); bad.mappings = mappings();
  expect(()=>previewImport(project,bad)).toThrow('Source record 2'); expect(project).toEqual(before);
});
it('maps exact nested JSON rows in the chosen parent scope through the existing authoritative schema and real print bindings',()=> {
  const fixture = nestedDatasetFixture(), design = designOf(fixture.project); design.collection = '/parentDocuments/0/allocations';
  const project = compileProject(fixture.project,design), before = structuredClone(project.sampleData);
  const source = '{"parents":[{"lines":[{"id":"00009","raw":"-001.250","unit":"USD","note":"exact first"},{"id":"00007","raw":"0002.500","unit":"USD","note":"exact second"}]},{"lines":[{"id":"OTHER","raw":"999.000","unit":"USD"}]}]}';
  const review = createImportReview(project,source,'nested.json');
  review.sourcePointer = '/parents/0/lines'; review.targetPointer = '/parentDocuments/0/allocations';
  review.mappings = {'/line~1id':{source:'/id',conversion:'preserve'},'/amount~0raw':{source:'/raw',conversion:'preserve'},'/currency':{source:'/unit',conversion:'preserve'},'/extra/retained':{source:'/note',conversion:'preserve'}};
  const preview = previewImport(project,review), next = {...project,sampleData:preview.data};
  expect(preview.data.parentDocuments[0].allocations.map(row=>row['line/id'])).toEqual(['00009','00007']);
  expect(preview.data.parentDocuments[1]).toEqual(before.parentDocuments[1]);
  expect(preview.data.document).toEqual(before.document); expect(next.schema).toEqual(fixture.schema);
  expect(printed(next)).toContain('-001.250'); expect(printed(next)).not.toContain('OTHER');
  expect(parseStructuredImport(source,'nested.json').scopes.map(scope=>scope.pointer)).toContain('/parents/1/lines');
});
it('supports one-record form mapping without changing totals, currency, protected signatures or statuses',()=> {
  const project = newProject('purchase'); project.sampleData.document.status = 'Source draft';
  const review = createImportReview(project,'{"client":"Fictional local customer","approved":"not-authorized"}','header.json');
  review.targetPointer = ''; review.mappings = {'/customer/name':{source:'/client',conversion:'preserve'}};
  const preview = previewImport(project,review);
  expect(preview.data.customer.name).toBe('Fictional local customer');
  expect(preview.data.approvedBy).toBe(project.sampleData.approvedBy); expect(preview.data.document.status).toBe('Source draft');
  const fields = importTargets(project,'').map(field=>field.pointer);
  expect(fields).not.toContain('/approvedBy'); expect(fields).not.toContain('/document/status');
  const canonical = structuredClone(project); canonical.sampleData.profile = 'supplied-business-v1';
  const beforeCanonical = structuredClone(canonical);
  expect(()=>createImportReview(canonical,csv,'general.csv')).toThrow();
  expect(canonical).toEqual(beforeCanonical);
  review.mappings['/__proto__/x'] = {source:'/client',conversion:'preserve'};
  expect(()=>previewImport(project,review)).toThrow(); expect({}.x).toBeUndefined();
});
it('reviews then Applies through actual history, save/open, source reads and portable dataset contracts; cancellation and malformed input are inert',async()=> {
  vi.stubGlobal('indexedDB',undefined); vi.stubGlobal('confirm',()=>true);
  const {bus,state,database} = await setup();
  try {
    const before = structuredClone(bus.project), records = await database.store.list(), revision = bus.revision;
    await database.action('import-file',{source:csv,filename:'fictional.csv'});
    expect(bus.revision).toBe(revision); expect(await database.store.list()).toEqual(records);
    await expect(database.action('import-apply',{})).rejects.toThrow('Preview');
    database.importReview.mappings = mappings(); await database.action('import-preview',{});
    expect(bus.project).toEqual(before); await database.action('import-apply',{});
    expect(bus.project.sampleData.items[0].sku).toBe('00007'); expect(printed(bus.project)).toContain('00007');
    const receipt = bus.project.manifest.localImport;
    expect(receipt.sourceText).toBe(csv); expect(receipt.mappings).toHaveLength(6);
    expect(validateImportReceipt(receipt,bus.project.sampleData)).toEqual(receipt);
    expect(await database.store.list()).toEqual(records);
    await bus.navigateHistory('undo',bus.revision); expect(bus.project.sampleData).toEqual(before.sampleData);
    expect(bus.project.manifest.localImport).toEqual(before.manifest.localImport);
    await bus.navigateHistory('redo',bus.revision);
    const reopened = readProject(saveProject(bus.project));
    expect(reopened.sampleData.items[0].sku).toBe('00007'); expect(reopened.manifest.localImport.sourceText).toBe(csv);
    database.context = bus; await database.save(true);
    const saved = await database.source.read(bus.project.studioV3Session.database.id);
    expect(saved.localImport.sourceText).toBe(csv); expect(importDataset(exportDataset(saved),'invoice').localImport).toEqual(receipt);
    const corrupt = JSON.parse(saveProject(bus.project)); corrupt.project.sampleData.items[0].sku = 'CHANGED';
    expect(()=>readProject(JSON.stringify(corrupt))).toThrow('no longer matches');
    database.ensureDraft(); database.draft.data.items[0].description = 'Unapplied'; state.dataDraft = 'Pending JSON';
    const current = structuredClone(bus.project), draft = structuredClone(database.draft), stored = await database.store.list();
    await database.action('import-file',{source:csv,filename:'fictional.csv'}); await database.action('import-cancel',{});
    expect(bus.project).toEqual(current); expect(database.draft).toEqual(draft); expect(state.dataDraft).toBe('Pending JSON');
    await expect(database.action('import-file',{source:'a,a\n1,2',filename:'bad.csv'})).rejects.toThrow('duplicate');
    expect(database.draft).toEqual(draft); expect(await database.store.list()).toEqual(stored);
    state.dataDraft = null; database.resetDraft();
    await replaceData(bus,structuredClone(bus.project.sampleData),'erp',null);
    expect(bus.project.manifest.localImport).toBeNull();
  } finally { database.store.close(); vi.unstubAllGlobals(); }
});
it('invalidates previews on mapping edits and rejects a stale project before commit',async()=> {
  vi.stubGlobal('indexedDB',undefined);
  const {bus,database} = await setup();
  try {
    await database.action('import-file',{source:csv,filename:'fictional.csv'}); database.importReview.mappings = mappings();
    await database.action('import-preview',{});
    database.input({dataset:{dbImportControl:'conversion',dbImportField:'/rate'},value:'preserve'});
    expect(database.importReview.preview).toBeNull();
    await expect(database.action('import-apply',{})).rejects.toThrow('Preview');
    database.importReview.mappings = mappings(); await database.action('import-preview',{});
    database.importReview.mappings['/sku'].source = '/uom';
    await expect(database.action('import-apply',{})).rejects.toThrow('changed after preview');
    database.importReview.mappings = mappings(); await database.action('import-preview',{});
    await replaceData(bus,structuredClone(bus.project.sampleData),'erp',null);
    const before = structuredClone(bus.project);
    await expect(database.action('import-apply',{})).rejects.toThrow('form changed'); expect(bus.project).toEqual(before);
  } finally { database.store.close(); vi.unstubAllGlobals(); }
});
it('retains safe inherited-name fields as own nested data, never mutating built-in prototypes',()=> {
  const project = newProject();
  project.sampleData.items = [{...project.sampleData.items[0],toString:{value:'old'},uom:'kg',quantityRaw:'0002.500'}];
  const text = 'n,code,description,qty,unit,total,note,uom,raw\n1,00007,Fictional,2,1.250,2.500,own value,box,0002.500\n';
  const review = createImportReview(project,text,'own-fields.csv'); review.mappings = {
    ...mappings(),'/toString/value':{source:'/note',conversion:'preserve'},'/uom':{source:'/uom',conversion:'preserve'},'/quantityRaw':{source:'/raw',conversion:'preserve'}
  };
  const preview = previewImport(project,review);
  expect(Object.hasOwn(preview.data.items[0],'toString')).toBe(true);
  expect(preview.data.items[0].toString.value).toBe('own value'); expect(Object.prototype.toString.value).toBeUndefined();
  expect(preview.data.items[0]).toMatchObject({uom:'box',quantityRaw:'0002.500'});
});
it('refuses a portable project node-budget overflow rather than truncating source rows or changing data',async()=> {
  vi.stubGlobal('indexedDB',undefined);
  const project = newProject('invoice',true), keys = Array.from({length:98},(_,index)=>`field${index}`);
  project.sampleData = {records:[Object.fromEntries(keys.map(key=>[key,'old']))]};
  project.schema = {type:'object',required:['records'],additionalProperties:false,properties:{records:{type:'array',items:{type:'object',required:keys,additionalProperties:false,properties:Object.fromEntries(keys.map(key=>[key,{type:'string'}]))}}}};
  const {bus,database} = await setup(project);
  try {
    const source = `${keys.join(',')}\n${Array.from({length:500},()=>keys.map(()=>'new').join(',')).join('\n')}\n`, before = structuredClone(bus.project);
    await database.action('import-file',{source,filename:'bounded.csv'});
    database.importReview.targetPointer = '/records'; database.importReview.mappings = Object.fromEntries(keys.map(key=>[`/${key}`,{source:`/${key}`,conversion:'preserve'}]));
    await expect(database.action('import-preview',{})).rejects.toThrow('Portable import');
    expect(bus.project).toEqual(before); expect(database.importReview.preview).toBeNull();
  } finally { database.store.close(); vi.unstubAllGlobals(); }
});
