import { describe,it,expect,vi } from 'vitest';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { nestedDatasetFixture } from './fixtures/nested-dataset.js';
import { createLocalDatasetSource } from '../studio-v3/data-source-adapter.js';
import { createBus,editProject,designOperations,replaceData } from '../studio-v3/controller.js';
import { designOf,newProject,selectionField } from '../studio-v3/model.js';
import { readProject,saveProject } from '../studio-v3/file-io.js';
import { exportDataset,importDataset } from '../studio-v3/database-model.js';
import { DemoDatabase } from '../studio-v3/database-controller.js';
import { bindingValidation } from '../studio-v3/validation.js';
import { availableBindings } from '../studio-v3/ai-authoring.js';
import { datasetDescriptor,assertCollectionBinding,collectionFields,declaredCollectionFields } from '../studio-v3/dataset-schema.js';
import { dataTree } from '../studio-v3/data-tree-view.js';
import { fieldBinding } from '../studio-v3/binding-view.js';

function render(project) {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  return bindTemplate(template,project.sampleData,project.manifest);
}
const local = record => createLocalDatasetSource({list:async()=>[structuredClone(record)]});

describe('nested collections use the source JSON Schema through real consumers',()=> {
  it('exposes observed nested arrays without inventing empty row fields or source authority',async()=> {
    const {record} = nestedDatasetFixture(true); delete record.sourceSchema;
    const schema = await local(record).schema(record.id);
    expect(schema).toMatchObject({origin:'observed',version:null});
    expect(schema.collections.map(entry=>entry.pointer)).toEqual(['/items','/parentDocuments','/parentDocuments/0/allocations','/parentDocuments/1/allocations','/allocations','/a~1b~0c']);
    expect(schema.collections.find(entry=>entry.pointer === '/allocations').fields).toEqual([]);
    expect(schema.collections.find(entry=>entry.pointer === '/parentDocuments/1/allocations')).toMatchObject({parentScope:'/parentDocuments/1',fields:expect.arrayContaining([{pointer:'./amount~0raw',type:'string',required:true,origin:'observed'}])});
    expect(JSON.stringify(schema)).not.toContain('999.000');
  });

  it('supplies declared empty fields and structure-only authoring without first-row guesses',async()=> {
    const {record,project} = nestedDatasetFixture(true), source = local(record);
    const descriptor = await source.schema(record.id);
    expect(descriptor).toMatchObject({origin:'authoritative',version:'2026-10-15.1',sourceId:'fictional-erp'});
    const collection = descriptor.collections.find(entry=>entry.pointer === '/allocations');
    expect(collection.fields).toContainEqual({pointer:'./line~1id',type:'string',required:true,origin:'authoritative'});
    expect(availableBindings(project,['./line~1id'])).toContainEqual({pointer:'./line~1id',type:'string',relative:true,collection:'/allocations'});
  });

  it('saves/reopens empty schema, then binds exact nonempty input in its selected parent scope',async()=> {
    const empty = nestedDatasetFixture(true), full = nestedDatasetFixture(false);
    const project = readProject(saveProject(empty.project));
    expect(project.schema).toEqual(empty.schema); expect(project.manifest.datasetSchema).toEqual(empty.project.manifest.datasetSchema);
    const bus = createBus(project);
    await replaceData(bus,full.data);
    const design = designOf(bus.project); design.collection = '/parentDocuments/0/allocations';
    await editProject(bus,designOperations(bus.project,design),'select nested parent');
    const opened = readProject(saveProject(bus.project)), bound = render(opened);
    expect(bound.report.tableRows).toBe(1);
    expect(bound.fragment.textContent).toContain('00007'); expect(bound.fragment.textContent).toContain('-001.250');
    expect(bound.fragment.textContent).not.toContain('OTHER-PARENT'); expect(bound.fragment.textContent).not.toContain('999.000');
    expect(opened.sampleData).toEqual(full.data); expect(bindingValidation(opened).valid).toBe(true);
    const exported = importDataset(exportDataset(full.record),'invoice');
    expect(exported.sourceSchema).toEqual({...full.sourceSchema,datasetId:exported.id}); expect(exported.id).not.toBe(full.record.id); expect(exported.data.custom).toEqual(full.data.custom);
  });

  it.each([
    ['wrong later row type',data=>data.allocations.push({'line/id':'second','amount~raw':4,currency:'USD'})],
    ['missing later row field',data=>data.allocations.push({'line/id':'second',currency:'USD'})],
    ['nonobject child',data=>data.parentDocuments[0].allocations.push(null)],
    ['document identity',data=>data.document.id = 'OTHER-DOC'],
    ['data budget',data=>data.unknown = 'x'.repeat(2*1024*1024)]
  ])('rejects %s before changing the active form',async(_,change)=> {
    const {project,data} = nestedDatasetFixture(), bus = createBus(project), before = structuredClone(bus.project), revision = bus.revision;
    const next = structuredClone(data); change(next);
    await expect(replaceData(bus,next)).rejects.toThrow();
    expect(bus.project).toEqual(before); expect(bus.revision).toBe(revision);
  });

  it('keeps invalid primary parent selection repairable but rejects untyped empty rebinding',async()=> {
    const {project} = nestedDatasetFixture(true), bus = createBus(project), before = structuredClone(bus.project.sampleData);
    const design = designOf(project); design.collection = '/parentDocuments/9/allocations';
    await editProject(bus,designOperations(bus.project,design),'author unresolved parent');
    expect(bindingValidation(bus.project).errors).toContainEqual(expect.objectContaining({code:'COLLECTION_NOT_ARRAY',path:design.collection}));
    const repaired = designOf(bus.project); repaired.collection = '/parentDocuments/0/allocations';
    await editProject(bus,designOperations(bus.project,repaired),'select declared empty parent');
    expect(bindingValidation(bus.project).valid).toBe(true); expect(bus.project.sampleData).toEqual(before);
    const observed = structuredClone(project); observed.schema = {type:'object',additionalProperties:true}; delete observed.manifest.datasetSchema;
    const observedBus = createBus(observed), next = designOf(observed); next.collection = '/a~1b~0c';
    await expect(editProject(observedBus,designOperations(observed,next),'unknown empty fields')).rejects.toThrow();
    expect(designOf(observedBus.project).collection).toBe('/allocations');
  });

  it('diagnoses untyped invalid rows for repair and retains safe fields absent from the declared schema',async()=> {
    const {record,project} = nestedDatasetFixture(); delete record.sourceSchema;
    record.data.allocations.push({'line/id':'second','amount~raw':5,currency:'USD'});
    const descriptor = await local(record).schema(record.id);
    expect(descriptor.collections.find(entry=>entry.pointer === '/allocations').fields.find(field=>field.pointer === './amount~0raw').type).toBe('mixed');
    const observed = structuredClone(project); observed.schema = {type:'object',additionalProperties:true}; delete observed.manifest.datasetSchema;
    const observedBus = createBus(observed), beforeObserved = structuredClone(observedBus.project.sampleData);
    await replaceData(observedBus,record.data);
    expect(observedBus.project.sampleData).toEqual(record.data);
    expect(bindingValidation(observedBus.project).errors).toContainEqual(expect.objectContaining({code:'COLLECTION_SCHEMA_INVALID'}));
    delete record.data.allocations[1]['amount~raw'];
    await replaceData(observedBus,record.data);
    expect(observedBus.project.sampleData).toEqual(record.data);
    expect(bindingValidation(observedBus.project).errors).toContainEqual(expect.objectContaining({code:'MISSING_FIELD',path:'/allocations/1/amount~0raw'}));
    await replaceData(observedBus,beforeObserved);
    expect(bindingValidation(observedBus.project).valid).toBe(true); expect(observedBus.project.sampleData).toEqual(beforeObserved);
    const bus = createBus(project), data = structuredClone(project.sampleData);
    data.allocations[0].unlisted = '正常未知字段'; await replaceData(bus,data);
    const next = designOf(bus.project); next.columns[0].pointer = './unlisted';
    await editProject(bus,designOperations(bus.project,next),'bind safe extension');
    expect(render(bus.project).fragment.textContent).toContain('正常未知字段');
  });

  it.each([[7],['primitive'],[null],[false]])('keeps malformed primary rows repairable without suggesting a row-root field: %j',async row=> {
    const project = newProject(), bus = createBus(project), schema = structuredClone(project.schema);
    const data = {...structuredClone(project.sampleData),items:[row]};
    await replaceData(bus,data);
    expect(bus.project.sampleData).toEqual(data); expect(bus.project.schema).toEqual(schema);
    expect(collectionFields(bus.project)).toEqual([]);
    const view = document.createElement('div');
    view.innerHTML = dataTree(bus.project,{selected:'items-sku'}) + fieldBinding(bus.project,selectionField(designOf(bus.project),'items-sku'));
    expect(view.querySelector('[data-tree-path="."]')).toBeNull();
    expect(view.querySelector('option[value="."]')).toBeNull();
    expect(bindingValidation(bus.project)).toMatchObject({valid:false,errors:expect.arrayContaining([expect.objectContaining({code:'ROW_NOT_OBJECT',path:'/items'})])});
    expect(()=>assertCollectionBinding(bus.project,'/items')).toThrow();
    await replaceData(bus,project.sampleData);
    expect(bindingValidation(bus.project).valid).toBe(true);
    expect(collectionFields(bus.project).some(field=>field.pointer === './sku')).toBe(true);
  });

  it('does not catalog scalar array items as a declared root or hide later-row missing fields',async()=> {
    const schema = {type:'object',properties:{items:{type:'array',items:{type:'number'}}}};
    expect(datasetDescriptor({items:[7]},schema).collections[0].fields).toEqual([]);
    expect(declaredCollectionFields(schema,'/items')).toEqual([]);
    const project = newProject(), bus = createBus(project), data = structuredClone(project.sampleData);
    data.items = [data.items[0],7];
    await replaceData(bus,data);
    expect(collectionFields(bus.project).some(field=>field.pointer === '.')).toBe(false);
    expect(collectionFields(bus.project).find(field=>field.pointer === './sku')).toMatchObject({required:false});
    data.items[1] = {...data.items[0]}; delete data.items[1].sku;
    await replaceData(bus,data);
    expect(bindingValidation(bus.project).errors).toContainEqual(expect.objectContaining({code:'MISSING_FIELD',path:'/items/1/sku'}));
  });

  it('keeps authoritative empty object-row fields in both human binding consumers',()=> {
    const {project} = nestedDatasetFixture(true), before = structuredClone(project.schema);
    const view = document.createElement('div');
    view.innerHTML = dataTree(project,{selected:'items-identity'}) + fieldBinding(project,selectionField(designOf(project),'items-identity'));
    expect(view.querySelector('[data-tree-path="./line~1id"]:not([disabled])')).not.toBeNull();
    expect(view.querySelector('option[value="./line~1id"]')).not.toBeNull();
    expect(view.querySelector('[data-tree-path="."]')).toBeNull();
    expect(project.schema).toEqual(before); expect(bindingValidation(project).valid).toBe(true);
    assertCollectionBinding(project,'/allocations');
  });

  it('rejects source identity, schema language and combined budgets at the read boundary',async()=> {
    const {record} = nestedDatasetFixture();
    for (const change of [source=>source.datasetId = 'wrong',source=>source.version = '',source=>source.schema.anyOf = [],source=>source.schema.description = 'x'.repeat(1024*1024)]) {
      const next = structuredClone(record); change(next.sourceSchema);
      if (next.sourceSchema.schema.description) next.data.custom.large = 'x'.repeat(1024*1024);
      await expect(local(next).read(next.id)).rejects.toThrow();
      const file = JSON.parse(exportDataset(record));
      file.dataset.sourceSchema = next.sourceSchema;
      file.dataset.data = next.data;
      expect(()=>importDataset(JSON.stringify(file),'invoice')).toThrow();
    }
  });

  it('keeps the reopened empty contract when later dataset input omits a schema',async()=> {
    vi.stubGlobal('indexedDB',undefined);
    const {project,schema} = nestedDatasetFixture(true), full = nestedDatasetFixture().data;
    const bus = createBus(readProject(saveProject(project))), state = {sample:'erp',dataDraft:null,mode:'data'};
    const database = new DemoDatabase({project:()=>bus.project,state:()=>state,context:()=>bus,render:()=>{},busy:()=>{},apply:(data,reference,context,source,title,contract)=>replaceData(context,data,'erp',reference,source,title,contract)});
    try {
      await database.init(); database.context = bus; await database.import(JSON.stringify(full));
      expect(bus.project.schema).toEqual(schema); expect(render(bus.project).fragment.textContent).toContain('-001.250');
      const id = bus.project.studioV3Session.database.id;
      expect(bus.project.manifest.datasetSchema).toEqual({...project.manifest.datasetSchema,datasetId:id});
      database.ensureDraft(); state.dataDraft = 'retained JSON';
      const before = structuredClone(bus.project), records = await database.store.list(), draft = structuredClone(database.draft);
      const invalid = structuredClone(full); invalid.allocations.push({'line/id':'second','amount~raw':5,currency:'USD'});
      await expect(database.import(JSON.stringify(invalid))).rejects.toThrow();
      expect(bus.project).toEqual(before); expect(await database.store.list()).toEqual(records);
      expect(database.draft).toEqual(draft); expect(state.dataDraft).toBe('retained JSON');
    } finally { database.store?.close(); vi.unstubAllGlobals(); }
  });

  it('edits the nested table, saves schema with the dataset and rejects unsafe selection without clearing drafts',async()=> {
    vi.stubGlobal('indexedDB',undefined);
    const {project} = nestedDatasetFixture(), design = designOf(project); design.collection = '/parentDocuments/0/allocations';
    project.manifest.studioV3 = design;
    const bus = createBus(project), state = {sample:'erp',dataDraft:null,mode:'data'};
    const database = new DemoDatabase({project:()=>bus.project,state:()=>state,context:()=>bus,render:()=>{},busy:()=>{},apply:(data,reference,context,source,title,schema)=>replaceData(context,data,'erp',reference,source,title,schema)});
    try {
      await database.init(); database.context = bus;
      database.input({dataset:{dbPointer:'/parentDocuments/0/allocations/0/amount~0raw',dbType:'text'},value:'-009.875'});
      await database.save(true);
      expect(bus.project.sampleData.parentDocuments[0].allocations[0]['amount~raw']).toBe('-009.875');
      expect(bus.project.sampleData.parentDocuments[1].allocations[0]['amount~raw']).toBe('999.000');
      const saved = (await database.store.list()).find(record=>record.id === bus.project.studioV3Session.database.id);
      expect(saved.sourceSchema.schema).toEqual(project.schema); expect(saved.sourceSchema.datasetId).toBe(saved.id);
      const file = exportDataset(saved), original = structuredClone(saved);
      await database.import(file);
      const firstCopy = bus.project.studioV3Session.database.id;
      await database.import(file);
      const secondCopy = bus.project.studioV3Session.database.id, records = await database.store.list();
      expect(firstCopy).not.toBe(saved.id); expect(secondCopy).not.toBe(firstCopy);
      expect(records.find(record=>record.id === saved.id)).toEqual(original);
      for (const id of [firstCopy,secondCopy]) {
        const copy = records.find(record=>record.id === id);
        expect(copy.sourceSchema.datasetId).toBe(id); expect(copy.sourceSchema.schema).toEqual(project.schema);
        expect(copy.revision).toBe(1); expect(copy.data).toEqual(original.data);
      }
      await expect(database.store.write([{id:saved.id,record:{...saved,title:'stale overwrite'},expectedRevision:0}])).rejects.toMatchObject({code:'DATASET_CONFLICT'});
      expect((await database.store.list()).find(record=>record.id === saved.id)).toEqual(original);
      database.ensureDraft(); state.dataDraft = 'pending JSON';
      const before = structuredClone(bus.project), draft = structuredClone(database.draft), selected = {...database.selected};
      const invalid = {...saved,id:'wrong-source',sourceSchema:saved.sourceSchema};
      await database.store.write([{id:invalid.id,record:invalid,expectedRevision:null}]);
      await expect(database.choose(invalid.id)).rejects.toThrow();
      expect(bus.project).toEqual(before); expect(database.draft).toEqual(draft); expect(database.selected).toEqual(selected); expect(state.dataDraft).toBe('pending JSON');
    } finally { database.store?.close(); vi.unstubAllGlobals(); }
  });
  it('keeps declared nullable arrays as collections and prints present null scalars as blank rather than missing',()=> {
    const schema = {type:'object',properties:{items:{type:'array',items:{type:'object'}},allocations:{
      type:['array','null'],items:{type:'object',properties:{id:{type:'string'},note:{type:['string','null']}},required:['id','note']}
    }}};
    const sampleData = {items:[],allocations:[{id:'INV-1',note:null},{id:'INV-2',note:'retained exact'}]};
    const descriptor = datasetDescriptor(sampleData,schema);
    expect(descriptor.fields.map(field=>field.pointer)).not.toContain('/allocations');
    expect(descriptor.collections.find(collection=>collection.pointer === '/allocations')).toMatchObject({
      origin:'authoritative',fields:expect.arrayContaining([{pointer:'./note',type:'string|null',required:true,origin:'authoritative'}])
    });
    const manifest = {currency:'USD',locale:'en-US',studioV3:{collection:'/allocations',columns:[{pointer:'./note',kind:'bound',format:''}]}};
    assertCollectionBinding({manifest,schema,sampleData},'/allocations');
    const template = document.createElement('template');
    template.innerHTML = '<table data-pf-each="/allocations"><tbody><tr><td data-pf-text="./note"></td></tr></tbody></table>';
    const output = bindTemplate(template,sampleData,manifest);
    expect(output.report.errors).toEqual([]);
    expect([...output.fragment.querySelectorAll('td')].map(node=>node.textContent)).toEqual(['','retained exact']);
  });
});
