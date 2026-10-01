import { describe, expect, it } from 'vitest';
import { newProject, sampleData, designOf } from '../studio-v3/model.js';
import { createBus, replaceData, formDesign } from '../studio-v3/controller.js';
import { sourceLabel } from '../studio-v3/data-provenance.js';
import { parseSampleJSON } from '../studio-v3/json-error.js';
function form(kind,values) {
  const node = document.createElement('form'); node.dataset.form = kind;
  for (const [name,value] of Object.entries(values)) { const input=document.createElement('input'); input.name=name;input.value=value;node.append(input); }
  return node;
}
describe('Studio v3 editing intent and data provenance',()=> {
  it('property edits preserve the existing binding and literal text',()=> {
    const project = newProject(); const before = designOf(project).columns[1];
    const after = formDesign(project,'items-sku',form('field',{label:'Stock code',format:'',width:'15'}),'field');
    expect(after.columns[1]).toMatchObject({...before,label:'Stock code'});
  });
  it('static mode retains the manual path for switching back to bound data',()=> {
    const project = newProject();
    const design = formDesign(project,'customer-bill',form('binding',{bindingMode:'static',pointer:'/customer/name',text:'Fixed client text'}),'binding');
    expect(design.customer[0]).toMatchObject({pointer:'',lastPointer:'/customer/name',text:'Fixed client text'});
    project.manifest.studioV3 = design;
    const next = formDesign(project,'customer-bill',form('binding',{bindingMode:'bound',pointer:design.customer[0].lastPointer,text:'Fixed client text'}),'binding');
    expect(next.customer[0].pointer).toBe('/customer/name');
  });
  it('validation sample switching restores the imported dataset and its original source',async()=> {
    const bus = createBus(newProject()); expect(sourceLabel(bus.project)).toBe('Built-in demo · 45 rows');
    const data=sampleData('invoice',2);data.customer.name='Synthetic import fixture';
    await replaceData(bus,data,'erp',null); expect(sourceLabel(bus.project)).toBe('Imported data · 2 rows');
    await replaceData(bus,sampleData('invoice',100),'100'); expect(sourceLabel(bus.project)).toBe('Validation sample · Multi-page · 100 rows');
    await replaceData(bus,bus.project.studioV3Session.erpData,'erp');
    expect(sourceLabel(bus.project)).toBe('Imported data · 2 rows');expect(bus.project.sampleData.customer.name).toBe('Synthetic import fixture');
    await bus.navigateHistory('undo',bus.revision);expect(sourceLabel(bus.project)).toContain('Validation sample');
  });
  it('reports a stable JSON location and preserves native JSON values',()=> {
    expect(parseSampleJSON('{"text":"a\\nb","number":-1.2e3,"items":[]}')).toEqual({text:'a\nb',number:-1200,items:[]});
    expect(()=>parseSampleJSON('{\n  "items": [}\n}')).toThrow('line 2, column 13');
    expect(()=>parseSampleJSON('{"items":[]} trailing')).toThrow('column 14');
    expect(()=>parseSampleJSON('{"x":"\\q","items":[]}')).toThrow('Invalid JSON');
  });
});

it('applied dataset names survive form history, explicit save/reopen and HTML metadata without database links',async()=>{
  const {saveProject,readProject}=await import('../studio-v3/file-io.js');
  const bus=createBus(newProject());
  await replaceData(bus,bus.project.sampleData,'erp',null,null,'Portable dataset');
  expect(bus.project.manifest.sampleDataTitle).toBe('Portable dataset');
  const restored=readProject(saveProject(bus.project),'named.printform.json');
  expect(restored.manifest.sampleDataTitle).toBe('Portable dataset');
  expect(restored.studioV3Session).toBeUndefined();
  await bus.navigateHistory('undo',bus.revision);expect(bus.project.manifest.sampleDataTitle).not.toBe('Portable dataset');
  await bus.navigateHistory('redo',bus.revision);expect(bus.project.manifest.sampleDataTitle).toBe('Portable dataset');
  const parsed=JSON.parse(saveProject(bus.project));parsed.project.manifest.sampleDataTitle={unsafe:true};
  expect(()=>readProject(JSON.stringify(parsed))).toThrow('must be text');
});
