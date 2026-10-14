import {describe,it,expect,vi} from 'vitest';
import {bindTemplate} from '../studio-v2/core/binding.js';
import {compileProject,designOf,newProject,sampleData} from '../studio-v3/model.js';
import {readProject,saveProject} from '../studio-v3/file-io.js';
import {datasetRecord,exportDataset,importDataset,validateDataset} from '../studio-v3/database-model.js';
import {parseSampleJSON} from '../studio-v3/json-error.js';
import {createBus,replaceData} from '../studio-v3/controller.js';
import {DemoDatabase} from '../studio-v3/database-controller.js';

const MB = 1024*1024;
function projectFile(data,extra = {}) {
  const file = JSON.parse(saveProject(newProject()));
  file.project.sampleData = data;
  return JSON.stringify({...file,...extra});
}
function htmlFile(project,sampleSource = JSON.stringify(project.sampleData),schemaSource = '{}') {
  const manifest = JSON.stringify(project.manifest).replace(/<\/script/gi,'<\\/script');
  return `<script id="pf-manifest" type="application/json">${manifest}</script>
    <script id="pf-schema" type="application/json">${schemaSource}</script>
    <script id="pf-sample-data" type="application/json">${sampleSource}</script>
    <style id="pf-theme"></style><template id="pf-template"></template>`;
}
function nested(depth) {
  let value = 'leaf';
  for (let i=0;i<depth;i++) value = {next:value};
  return value;
}
function rejectedSources() {
  return [
    ['unsafe','{"items":[],"custom":{"__pro\\u0074o__":{"polluted":true}}}','UNSAFE_JSON_KEY'],
    ['deep','{"items":[],"custom":'+'['.repeat(10000)+'0'+']'.repeat(10000)+'}','JSON_STRUCTURE_LIMIT'],
    ['wide',JSON.stringify({items:[],custom:Array(50000).fill(null)}),'JSON_STRUCTURE_LIMIT'],
    ['large',JSON.stringify({items:[],notes:'界'.repeat(Math.ceil(2*MB/3))}),'JSON_SIZE_LIMIT'],
    ['non-finite','{"items":[],"custom":1e999}','INVALID_JSON_VALUE'],
    ['malformed','{"items":[],"custom":}','syntax']
  ];
}
const errorFrom = operation => {
  try { operation(); } catch (error) { return error; }
  throw new Error('Expected import rejection.');
};

describe('bounded Studio v3 project and dataset consumers',()=>{
  it('reopens and binds custom collections without applying the database /items schema',()=>{
    const project = newProject(),design = designOf(project),data = sampleData('invoice',1);
    data.shipments = data.items; delete data.items;
    data.shipments[0].amount = 317; data.summary.total = 99123;
    data.custom = JSON.parse('{"toString":"ERP text","valueOf":17,"hasOwnProperty":false,"a/b":{"x~y":"中文"},"":"empty key"}');
    design.collection = '/shipments';
    const candidate = compileProject({...project,sampleData:data},design),before = structuredClone(candidate);
    for (const opened of [readProject(saveProject(candidate)),readProject(htmlFile(candidate),'export.html')]) {
      expect(opened.sampleData).toEqual(data);
      expect(designOf(opened).collection).toBe('/shipments');
      const template = document.createElement('template'); template.innerHTML = opened.templateHtml;
      const bound = bindTemplate(template,opened.sampleData,opened.manifest);
      expect(bound.report.tableRows).toBe(1);
      expect(bound.fragment.querySelector('[data-v3-id="totals-total"]').textContent).toContain('99,123');
      expect(opened.sampleData.shipments[0].amount).toBe(317);
    }
    expect(candidate).toEqual(before);
  });

  it('preserves unknown object keys and supplied amounts across raw, dataset and editor imports',()=>{
    const data = sampleData('invoice',1);
    data.custom = JSON.parse('{"toString":"kept","hasOwnProperty":"kept","a/b":{"x~y":null},"":"kept"}');
    data.items[0].amount = 317; data.summary.total = 99123;
    const before = structuredClone(data);
    for (const source of [JSON.stringify(data),exportDataset(datasetRecord('invoice',data,'Exact ERP data'))]) {
      expect(importDataset(source,'invoice').data).toEqual(before);
    }
    expect(parseSampleJSON(JSON.stringify(data))).toEqual(before);
    expect(validateDataset(data)).toEqual(before);
    expect(data).toEqual(before);
  });

  it.each(['__proto__','prototype','constructor'])('rejects the exact unsafe key %s at all JSON boundaries',key=>{
    const data = JSON.parse(`{"items":[],"custom":{"${key}":{"polluted":true}}}`);
    for (const operation of [
      ()=>readProject(projectFile(data)),
      ()=>readProject(htmlFile(newProject(),JSON.stringify(data)),'export.html'),
      ()=>importDataset(JSON.stringify(data),'invoice'),
      ()=>parseSampleJSON(JSON.stringify(data)),
      ()=>validateDataset(data)
    ]) expect(errorFrom(operation).code).toBe('UNSAFE_JSON_KEY');
    expect(Object.hasOwn(Object.prototype,'polluted')).toBe(false);
  });

  it('checks envelope and discarded HTML JSON before normalization can hide unsafe fields',()=>{
    const unsafe = JSON.parse('{"constructor":{"prototype":{"polluted":true}}}');
    expect(errorFrom(()=>readProject(projectFile({items:[]},{extra:unsafe}))).code).toBe('UNSAFE_JSON_KEY');
    const wrapped = JSON.parse(exportDataset(datasetRecord('invoice',{items:[]},'Dataset')));
    wrapped.extra = unsafe;
    expect(errorFrom(()=>importDataset(JSON.stringify(wrapped),'invoice')).code).toBe('UNSAFE_JSON_KEY');
    expect(errorFrom(()=>readProject(htmlFile(newProject(),'{"items":[]}',JSON.stringify(unsafe)),'export.html')).code).toBe('UNSAFE_JSON_KEY');
  });

  it('accepts the data depth boundary for both raw and wrapped imports, rejecting the next level',()=>{
    const allowed = {items:[],custom:nested(15)},denied = {items:[],custom:nested(16)};
    for (const data of [allowed,denied]) {
      const wrapped = JSON.stringify({format:'printform-studio-v3-dataset',version:1,dataset:{type:'invoice',title:'Depth',data}});
      const consumers = [()=>importDataset(JSON.stringify(data),'invoice'),()=>importDataset(wrapped,'invoice'),()=>readProject(projectFile(data)),()=>parseSampleJSON(JSON.stringify(data))];
      for (const consume of consumers) {
        if (data === allowed) {
          const result = consume();
          expect(result.sampleData ?? result.data ?? result).toEqual(allowed);
        }
        else expect(errorFrom(consume).code).toBe('JSON_STRUCTURE_LIMIT');
      }
    }
  });

  it('rejects malformed, non-finite and over-budget project data without changing the active document',()=>{
    const bus = createBus(newProject()),before = structuredClone(bus.project),revision = bus.revision;
    for (const [,source,code] of rejectedSources()) {
      const shell = JSON.parse(saveProject(newProject()));
      const prefix = JSON.stringify({...shell,project:{...shell.project,sampleData:'REPLACE'}});
      const projectSource = prefix.replace('"sampleData":"REPLACE"',`"sampleData":${source}`);
      const error = errorFrom(()=>readProject(projectSource));
      if (code === 'syntax') expect(error).toBeInstanceOf(SyntaxError);
      else expect(error.code).toBe(code);
      expect(bus.project).toEqual(before); expect(bus.revision).toBe(revision);
    }
    expect(errorFrom(()=>readProject(' '.repeat(10*MB+1))).code).toBe('JSON_SIZE_LIMIT');
    for (const value of ['null','[]','1','"text"']) expect(()=>readProject(value)).toThrow('Choose a Studio v3');
  });

  it('leaves saved records, selection, form and pending drafts intact when dataset import rejects',async()=>{
    vi.stubGlobal('indexedDB',undefined);
    const bus = createBus(newProject()),state = {sample:'erp',dataDraft:'Unapplied JSON',mode:'data'};
    const database = new DemoDatabase({project:()=>bus.project,state:()=>state,context:()=>bus,render:()=>{},busy:()=>{},apply:(data,reference,context)=>replaceData(context,data,'erp',reference)});
    try {
      await database.init(); database.ensureDraft(); database.draft.data.notes = 'Unapplied table';
      const records = await database.store.list(),selected = {...database.selected};
      const draft = structuredClone(database.draft),before = structuredClone(bus.project),revision = bus.revision;
      const active = await database.store.selected('invoice');
      for (const [,source,code] of rejectedSources()) {
        await expect(database.import(source)).rejects.toThrow();
        const error = errorFrom(()=>importDataset(source,'invoice'));
        if (code === 'syntax') expect(error).toBeInstanceOf(SyntaxError);
        else expect(error.code).toBe(code);
        expect(await database.store.list()).toEqual(records);
        expect(await database.store.selected('invoice')).toBe(active);
        expect(database.selected).toEqual(selected); expect(database.draft).toEqual(draft);
        expect(state.dataDraft).toBe('Unapplied JSON');
        expect(bus.project).toEqual(before); expect(bus.revision).toBe(revision);
      }
    } finally { database.store?.close(); vi.unstubAllGlobals(); }
  });

  it('retains line and column syntax diagnostics while exposing safety errors unchanged in the editor',()=>{
    expect(errorFrom(()=>parseSampleJSON('{\n  "items": [],\n  "custom": }'))).toMatchObject({code:'INVALID_JSON',line:3});
    for (const [,source,code] of rejectedSources().filter(([, ,code])=>code !== 'syntax')) {
      expect(errorFrom(()=>parseSampleJSON(source)).code).toBe(code);
    }
  });
});
