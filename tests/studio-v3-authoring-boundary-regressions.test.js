import { describe,it,expect } from 'vitest';
import { nestedDatasetFixture } from './fixtures/nested-dataset.js';
import { newProject,designOf,compileProject,selectionField } from '../studio-v3/model.js';
import { createBus,editProject,designOperations,importRasterAsset,formDesign } from '../studio-v3/controller.js';
import { alterTables } from '../studio-v3/additional-table-controls.js';
import { tableDefinitions } from '../studio-v3/additional-tables.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { readProject,saveProject } from '../studio-v3/file-io.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { businessDemoInput } from '../studio-v3/business-document-demos.js';
import { createBusinessDocumentProject } from '../studio-v3/business-document-project.js';

const unitPNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
function observedEmpty() {
  const {project} = nestedDatasetFixture(true);
  project.schema = {type:'object',additionalProperties:true};
  delete project.manifest.datasetSchema;
  return project;
}
function extra(design,id='table-extra',enabled=true) {
  return {id,label:'Independent allocations',collection:'/allocations',enabled,repeatHeader:true,breakBefore:false,columns:structuredClone(design.columns)};
}
function bind(project) {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  return bindTemplate(template,project.sampleData,project.manifest);
}
async function rejectedWithoutCommit(bus,design) {
  const before = structuredClone(bus.project), revision = bus.revision;
  await expect(editProject(bus,designOperations(bus.project,design),'reject empty rebinding')).rejects.toThrow();
  expect(bus.project).toEqual(before); expect(bus.revision).toBe(revision);
}

it('keeps compatible non-financial quantity bindings callable when selecting another supplied collection',()=> {
  const project = newProject('delivery');
  project.sampleData.lines = structuredClone(project.sampleData.items);
  project.sampleData.lines[0].description = 'Alternate supplied delivery record';
  const before = structuredClone(project.sampleData), draft = createDraft(project,{request:'Use the supplied /lines collection'});
  draft.apply('Select supplied delivery rows',[{type:'set_collection',value:'/lines'}]);
  expect(designOf(draft.project).collection).toBe('/lines');
  const output = bind(draft.project);
  expect(output.report.errors).toEqual([]);
  expect(output.fragment.textContent).toContain('Alternate supplied delivery record');
  expect(draft.project.sampleData).toEqual(before);
  expect(project.sampleData).toEqual(before);
});

it('retains canonical supplied identifiers in additional tables while permitting label styling',()=> {
  const project = createBusinessDocumentProject(businessDemoInput('Timesheet'));
  const added = alterTables(project,'items','add-table'), table = added.design.additionalTables[0], field = table.columns[0];
  const current = compileProject(project,added.design), before = structuredClone(current.sampleData);
  const draft = createDraft(current,{request:'Restyle the supplied entry reference'});
  const target = `${table.id}-${field.id}`;
  draft.apply('Style the source entry label',[{type:'set_field',target,patch:{label:'Source entry reference',labelStyle:{bold:true}}}]);
  const valid = draft.project;
  expect(()=>draft.apply('Invent source entry',[{type:'set_field',target,patch:{kind:'static',text:'INVENTED SUPPLIED ENTRY',pointer:'',format:''}}])).toThrow('UNSAFE_PROPOSAL');
  expect(draft.project).toBe(valid);
  expect(designOf(draft.project).additionalTables[0].columns[0]).toMatchObject({pointer:field.pointer,label:'Source entry reference',labelStyle:{bold:true}});
  expect(draft.project.sampleData).toEqual(before);
  expect(current.sampleData).toEqual(before);
});

describe('authoring services retain empty collection binding boundaries',()=> {
  it('rejects the original escaped empty rebinding after source authority is removed',async()=> {
    const project = observedEmpty(), bus = createBus(project), design = designOf(project);
    design.collection = '/a~1b~0c';
    await rejectedWithoutCommit(bus,design);
    expect(designOf(bus.project).collection).toBe('/allocations');
  });
  it.each(['primary','additional'])('permits pure %s column reordering without inventing empty schema',async scope=> {
    const project = observedEmpty(), initial = designOf(project);
    if (scope === 'additional') initial.additionalTables = [extra(initial)];
    const bus = createBus(compileProject(project,initial)), design = designOf(bus.project);
    const columns = scope === 'primary' ? design.columns : design.additionalTables[0].columns;
    columns.reverse();
    await editProject(bus,designOperations(bus.project,design),'reorder unchanged empty columns');
    const table = tableDefinitions(designOf(bus.project)).find(entry=>entry.id === (scope === 'primary' ? 'items' : 'table-extra'));
    expect(table.columns.map(column=>column.id)).toEqual(['currency','exact','identity']);
  });


  it.each(['primary','additional'])('allows unchanged legal empty %s bindings to receive label and style edits',async scope=> {
    let project = observedEmpty();
    if (scope === 'additional') {
      const design = designOf(project); design.additionalTables = [extra(design)];
      project = compileProject(project,design);
    }
    const bus = createBus(project), design = designOf(bus.project);
    const columns = scope === 'primary' ? design.columns : design.additionalTables[0].columns;
    columns[0].label = 'Human label, no invented row'; columns[0].width = 34;
    await editProject(bus,designOperations(bus.project,design),'empty label edit');
    expect(tableDefinitions(designOf(bus.project)).find(table=>table.id === (scope === 'primary' ? 'items' : 'table-extra')).columns[0].label).toBe('Human label, no invented row');
    expect(bus.project.sampleData).toEqual(project.sampleData);
    expect(bind(bus.project).report.errors).toEqual([]);
  });

  it.each(['collection','pointer','kind','new','enabled'])('requires empty schema for an additional table %s change',async change=> {
    const project = observedEmpty(), initial = designOf(project);
    initial.additionalTables = change === 'new' ? [] : [extra(initial,'table-extra',change !== 'enabled')];
    const bus = createBus(compileProject(project,initial)), design = designOf(bus.project);
    if (change === 'new') design.additionalTables.push(extra(design));
    else {
      const table = design.additionalTables[0];
      if (change === 'collection') table.collection = '/a~1b~0c';
      if (change === 'pointer') table.columns[0].pointer = './unknown';
      if (change === 'kind') {
        table.columns[0].kind = 'barcode'; table.columns[0].text = '';
        table.columns[0].barcode = {format:'CODE128',moduleWidth:2,height:48,displayValue:true};
      }
      if (change === 'enabled') table.enabled = true;
    }
    await rejectedWithoutCommit(bus,design);
  });

  it.each(['pointer','kind','enabled'])('requires empty schema for primary %s changes too',async change=> {
    const project = observedEmpty(), initial = designOf(project);
    if (change === 'enabled') initial.blocks.items.enabled = false;
    const bus = createBus(compileProject(project,initial)), design = designOf(bus.project);
    if (change === 'pointer') design.columns[0].pointer = './unknown';
    if (change === 'enabled') design.blocks.items.enabled = true;
    if (change === 'kind') {
      design.columns[0].kind = 'barcode'; design.columns[0].text = '';
      design.columns[0].barcode = {format:'CODE128',moduleWidth:2,height:48,displayValue:true};
    }
    await rejectedWithoutCommit(bus,design);
  });

  it('matches unchanged additional tables by ID rather than position',async()=> {
    const project = observedEmpty(), initial = designOf(project);
    initial.additionalTables = [extra(initial,'table-one'),{...extra(initial,'table-two'),collection:'/a~1b~0c'}];
    const bus = createBus(compileProject(project,initial)), design = designOf(bus.project);
    design.additionalTables.reverse(); design.additionalTables[0].label = 'Moved unchanged binding';
    await editProject(bus,designOperations(bus.project,design),'reorder empty tables');
    expect(designOf(bus.project).additionalTables.map(table=>table.id)).toEqual(['table-two','table-one']);
  });

  it('permits schema-declared empty rebinding on both primary and newly added tables',async()=> {
    const {project} = nestedDatasetFixture(true), bus = createBus(project), design = designOf(project);
    design.collection = '/a~1b~0c'; design.additionalTables = [extra(design)];
    await editProject(bus,designOperations(bus.project,design),'declared empty tables');
    expect(tableDefinitions(designOf(bus.project)).map(table=>table.collection)).toEqual(['/a~1b~0c','/allocations']);
    expect(bus.project.sampleData).toEqual(project.sampleData);
  });
});

describe('additional table discovery consumes actual arrays without coercion',()=> {
  it('skips tags urgent and commits the later operations Cut object-row array',async()=> {
    const project = newProject();
    Object.assign(project.sampleData,{tags:['urgent'],operations:[{operation:'Cut'}]});
    const before = structuredClone(project.sampleData), added = alterTables(project,'items','add-table');
    expect(added.design.additionalTables[0]).toMatchObject({collection:'/operations',columns:[{pointer:'./operation'}]});
    const bus = createBus(project);
    await editProject(bus,designOperations(bus.project,added.design),'operations after scalar tags');
    const result = bind(bus.project);
    expect(result.report.errors).toEqual([]); expect(result.report.tableRowsByTable[added.selected]).toBe(1);
    expect(result.fragment.textContent).toContain('Cut'); expect(bus.project.sampleData).toEqual(before);
  });

  it('skips legal scalar, mixed, fieldless and optional candidates before usable operation rows',async()=> {
    const project = newProject();
    Object.assign(project.sampleData,{
      tags:['urgent'], mixed:[{operation:'Must not select'},'scalar'], empty:[],
      objects:[{nested:{},list:['raw']}], missing:[{onlyFirst:'one'},{}],
      inconsistent:[{value:'001'},{value:2}],
      'operations/raw~source':[{operation:'Cut',hours:'01.500'},{operation:'Finish',hours:'00.250'}]
    });
    const before = structuredClone(project.sampleData), added = alterTables(project,'items','add-table');
    expect(added.design.additionalTables[0]).toMatchObject({collection:'/operations~1raw~0source',columns:[{pointer:'./operation'},{pointer:'./hours'}]});
    const bus = createBus(project);
    await editProject(bus,designOperations(bus.project,added.design),'add actual row array');
    const output = bind(bus.project);
    expect(output.report.errors).toEqual([]); expect(output.report.tableRowsByTable[added.selected]).toBe(2);
    expect(output.fragment.textContent).toContain('01.500');
    expect(project.sampleData).toEqual(before); expect(bus.project.sampleData).toEqual(before);
  });

  it('filters missing and object-valued fields but retains scalar fields present in every row',async()=> {
    const project = newProject();
    project.sampleData.operations = [{operation:'Cut',optional:'one',shape:'scalar'},{operation:'Finish',shape:{}}];
    const added = alterTables(project,'items','add-table');
    expect(added.design.additionalTables[0].columns.map(field=>field.pointer)).toEqual(['./operation']);
    const bus = createBus(project); await editProject(bus,designOperations(bus.project,added.design),'safe common field');
    expect(bind(bus.project).report.tableRowsByTable[added.selected]).toBe(2);
  });

  it.each([
    '{"constructor":[{"value":"unsafe collection"}]}',
    '{"operations":[{"constructor":"unsafe field"}]}',
    '{"operations":[{"__proto__":"unsafe field"}]}'
  ])('rejects an entire JSON-forbidden dataset instead of filtering unsafe keys',payload=> {
    const project = newProject();
    project.sampleData = {...project.sampleData,...JSON.parse(payload)};
    const before = structuredClone(project);
    expect(()=>alterTables(project,'items','add-table')).toThrow();
    expect(project).toEqual(before);
  });

  it('selects an empty collection only with safe declared scalar fields',async()=> {
    const project = newProject(); project.sampleData.unknown = []; project.sampleData.operations = [];
    project.schema = {type:'object',additionalProperties:true,properties:{operations:{type:'array',items:{type:'object',properties:{operation:{type:'string'},note:{type:['string','null']}}}}}};
    const added = alterTables(project,'items','add-table');
    expect(added.design.additionalTables[0].collection).toBe('/operations');
    expect(added.design.additionalTables[0].columns.map(field=>field.pointer)).toEqual(['./operation','./note']);
    const bus = createBus(project); await editProject(bus,designOperations(bus.project,added.design),'declared empty extra');
    expect(bus.project.sampleData.operations).toEqual([]); expect(bind(bus.project).report.errors).toEqual([]);
  });

  it('reports an actionable error when no unused eligible array exists',()=> {
    const project = newProject(); Object.assign(project.sampleData,{tags:['urgent'],mixed:[{},false],empty:[],objects:[{nested:{}}]});
    const before = structuredClone(project);
    expect(()=>alterTables(project,'items','add-table')).toThrow();
    expect(project).toEqual(before);
  });
});

describe('real raster FileReader barcode transition',()=> {
  it('clears old barcode options, retains the last pointer, commits and roundtrips exact PNG and source bytes',async()=> {
    const project = newProject(), design = designOf(project), field = selectionField(design,'header-number').field;
    Object.assign(field,{kind:'barcode',pointer:'/document/number',text:'',format:'',barcode:{format:'CODE128',moduleWidth:2,height:48,displayValue:true}});
    const bus = createBus(compileProject(project,design)), original = structuredClone(bus.project);
    const file = new File([Uint8Array.from(atob(unitPNG),character=>character.charCodeAt(0))],'unit.png',{type:'image/png'});
    const image = await importRasterAsset(bus.project,file,'header-number');
    expect(selectionField(image,'header-number').field).toMatchObject({kind:'image',pointer:'',lastPointer:'/document/number',width:80,height:60,fit:'contain'});
    expect(selectionField(image,'header-number').field).not.toHaveProperty('barcode');
    expect(image.assets[0].src).toBe(`data:image/png;base64,${unitPNG}`);
    expect(bus.project).toEqual(original);
    await editProject(bus,designOperations(bus.project,image),'barcode to raster upload');
    const reopened = readProject(saveProject(bus.project)), output = bind(reopened);
    expect(reopened.sampleData).toEqual(original.sampleData);
    expect(selectionField(designOf(reopened),'header-number').field).not.toHaveProperty('barcode');
    expect(output.report.errors).toEqual([]);
    expect(output.fragment.querySelector('img[data-v3-id="header-number"]').getAttribute('src')).toBe(`data:image/png;base64,${unitPNG}`);
    const form = document.createElement('form');
    for (const [name,value] of Object.entries({bindingMode:'bound',pointer:'/document/number',text:''})) {
      const input = document.createElement('input'); input.name = name; input.value = value; form.append(input);
    }
    const restored = formDesign(reopened,'header-number',form,'binding');
    await editProject(bus,designOperations(bus.project,restored),'restore exact source binding');
    expect(selectionField(designOf(bus.project),'header-number').field).toMatchObject({kind:'bound',pointer:'/document/number'});
    expect(bus.project.sampleData).toEqual(original.sampleData);
  });
});
