import {describe,it,expect} from 'vitest';
import {A4_PRESETS,A4_PRESET_IDS} from '../studio-v3/a4-presets.js';
import {a4PresetTheme} from '../studio-v3/a4-theme.js';
import {newDemoProject,setupDemoTemplatePicker} from '../studio-v3/demo-templates.js';
import {demoStarterRecords} from '../studio-v3/demo-catalog.js';
import {compileProject,designOf,newProject} from '../studio-v3/model.js';
import {validateDesign,saveProject,readProject} from '../studio-v3/file-io.js';
import {bindingValidation} from '../studio-v3/validation.js';
import {validateProject} from '../studio-v2/core/acceptance.js';
import {bindTemplate} from '../studio-v2/core/binding.js';
import {applyAuthoring,availableBindings} from '../studio-v3/ai-authoring.js';
import {createBus,editProject,designOperations} from '../studio-v3/controller.js';
import {resolvePointer} from '../studio-v2/core/json.js';

const sections=['header','customer','totals','footer'];
function boundDocument(project) {
 const template=document.createElement('template');template.innerHTML=project.templateHtml;
 return bindTemplate(template,project.sampleData,project.manifest);
}
describe('ten portable A4 business layouts',()=>{
 it('provides ten structural designs, not color-only copies',()=>{
  expect(A4_PRESETS).toHaveLength(10);expect(new Set(A4_PRESET_IDS).size).toBe(10);
  const rules=A4_PRESETS.map(({documentKind})=>a4PresetTheme(designOf(newDemoProject(documentKind)))
   .replace(/#[a-f0-9]{3,8}\b/gi,'COLOR').replace(/--v3-accent:[^;]+;/g,''));
  expect(new Set(rules).size).toBe(10);
 });
 for(const preset of A4_PRESETS) {
  it(`${preset.documentKind}: source data, editable registry, bindings and A4 contract`,()=>{
   const project=newDemoProject(preset.documentKind),design=designOf(project);
   expect(design.layoutPreset).toBe(preset.id);expect(design.page.paper).toBe('A4');
   expect(design.page.orientation).toBe('portrait');expect(design.repeatTable).toBe(true);
   expect(design.repeatHeader).toBe(false);expect(design.pageNumbers).toBe(true);expect(design.font).toBeGreaterThanOrEqual(9);
   expect(design.columns.reduce((sum,c)=>sum+c.width,0)).toBe(100);
   expect(validateProject(project).errors).toEqual([]);expect(bindingValidation(project).errors).toEqual([]);
   expect(project.sampleData).toEqual(demoStarterRecords(preset.documentKind)[0].data);
   expect(project.spec.components.some(c=>c.id==='header-title')).toBe(true);
   expect(project.spec.sections.map(s=>s.id)).toEqual(['header','customer','items','totals','footer']);
   for(const section of sections)for(const f of design[section])expect(availableBindings(project).some(b=>b.pointer===f.pointer),f.pointer).toBe(true);
  });
  it(`${preset.documentKind}: every existing scenario binds and round trips without amount changes`,()=>{
   const base=newDemoProject(preset.documentKind);
   for(const record of demoStarterRecords(preset.documentKind)) {
    const original=structuredClone(record.data),input=structuredClone(base);
    input.sampleData=record.data;input.manifest.currency=record.data.document.currency;
    const project=compileProject(input,designOf(base)),opened=readProject(saveProject(project));
    expect(opened.sampleData,record.id).toEqual(original);expect(opened.manifest.studioV3).toEqual(base.manifest.studioV3);
    const {fragment,report}=boundDocument(opened);expect(report.errors,record.id).toEqual([]);
    expect(report.tableRows).toBe(original.items.length);
    expect([...fragment.querySelectorAll('[data-pf-row-index]')].map(n=>Number(n.dataset.pfRowIndex))).toEqual(original.items.map((_,i)=>i));
    const formatter=new Intl.NumberFormat(opened.manifest.locale,{style:'currency',currency:opened.manifest.currency});
    for(const section of sections)for(const f of designOf(opened)[section].filter(f=>f.format==='currency')) {
     expect(fragment.querySelector(`[data-v3-id="${section}-${f.id}"]`).textContent).toBe(formatter.format(resolvePointer(original,f.pointer)));
    }
    for(const f of designOf(opened).columns.filter(f=>f.format==='currency')) {
     expect([...fragment.querySelectorAll(`[data-v3-id="items-${f.id}"]`)].map(n=>n.textContent)).toEqual(original.items.map(row=>formatter.format(resolvePointer(row,f.pointer.slice(1)))));
    }
   }
  });
  it(`${preset.documentKind}: style edit / undo / redo / reopen preserves all business values`,async()=>{
   const bus=createBus(newDemoProject(preset.documentKind)),original=structuredClone(bus.project.sampleData),design=designOf(bus.project);
   design.columns.find(f=>f.id==='description').label='Scope / 项目';design.color='#244668';
   await editProject(bus,designOperations(bus.project,design),'items-description');
   expect(bus.project.sampleData).toEqual(original);expect(designOf(bus.project).layoutPreset).toBe(preset.id);
   await bus.navigateHistory('undo',bus.revision);expect(bus.project.sampleData).toEqual(original);
   await bus.navigateHistory('redo',bus.revision);const reopened=readProject(saveProject(bus.project));
   expect(designOf(reopened).columns.find(f=>f.id==='description').label).toBe('Scope / 项目');
   expect(reopened.sampleData).toEqual(original);expect(designOf(reopened).layoutPreset).toBe(preset.id);
  });
  it(`${preset.documentKind}: supplied number bindings cannot be forged through AI authoring`,()=>{
   const project=newDemoProject(preset.documentKind),design=designOf(project);
   const f=design.columns.find(f=>f.format==='currency') || design.columns.find(f=>f.format==='number');
   expect(()=>applyAuthoring(designOf(project),[{type:'set_field',target:`items-${f.id}`,patch:{kind:'static',text:'1.00'}}],project)).toThrow('UNSAFE_PROPOSAL');
   expect(project.sampleData).toEqual(demoStarterRecords(preset.documentKind)[0].data);
  });
 }
 it('shows one existing business choice per kind without another preset picker',()=>{
  document.body.innerHTML='<dialog id="new-dialog"><div class="new-template-options"><div class="template-options"></div></div></dialog>';
  setupDemoTemplatePicker();
  for(const {documentKind,label} of A4_PRESETS) {
   const choices=document.querySelectorAll(`[data-demo-template="${documentKind}"]`);expect(choices).toHaveLength(1);
   expect(choices[0].textContent).toContain(`A4 · ${label}`);
  }
  expect(document.querySelectorAll('#new-dialog details')).toHaveLength(1);
 });
 it.each(['SalesQuotation','SalesOrder','PurchaseOrder'])('%s: explicit header columns clear preset child placement',kind=>{
  const project=newDemoProject(kind),design=designOf(project);
  const inspect=compiled=>{
   document.head.innerHTML=`<style>${compiled.themeCss}</style>`;
   document.body.innerHTML=`<div id="pf-mount">${compiled.templateHtml}</div>`;
   return {
    columns:getComputedStyle(document.querySelector('.company-fields')).gridTemplateColumns,
    fields:[...document.querySelectorAll('.company-fields .field')].map(node=>({
     id:node.dataset.v3Field,column:getComputedStyle(node).gridColumn,row:getComputedStyle(node).gridRow
    }))
   };
  };
  try {
   // Preserve the authored three-column composition until the user overrides it.
   const original=inspect(project);
   expect(original.columns).toBe('repeat(3,minmax(0,1fr))');
   expect(original.fields.find(f=>f.id==='header-registration').column).toBe('3');
   for(const columns of [1,2,4]) {
    design.blocks.header.layout={columns,gap:12};
    const edited=compileProject(project,design),rendered=inspect(edited);
    expect(rendered.columns).toBe(`repeat(${columns},minmax(0,1fr))`);
    expect(rendered.fields.every(f=>f.column==='auto' && f.row==='auto')).toBe(true);
    expect(edited.sampleData).toEqual(project.sampleData);
    expect(inspect(readProject(saveProject(edited)))).toEqual(rendered);
   }
   delete design.blocks.header.layout;
   expect(inspect(compileProject(project,design))).toEqual(original);
  } finally {document.head.replaceChildren();document.body.replaceChildren();}
 });
 it('rejects unrecognized layout instructions and preserves old files without a preset',()=>{
  for(const value of ['invoice-ledger; background:url(https://evil.invalid)',{},null,'unknown']) {
   const d=designOf(newDemoProject('SalesInvoice'));d.layoutPreset=value;expect(()=>validateDesign(d)).toThrow('layout preset');
   const saved=JSON.parse(saveProject(newDemoProject('SalesInvoice')));saved.project.manifest.studioV3.layoutPreset=value;
   expect(()=>readProject(JSON.stringify(saved))).toThrow('layout preset');
  }
  const legacy=newProject();expect(readProject(saveProject(legacy)).manifest.studioV3.layoutPreset).toBeUndefined();
  expect(a4PresetTheme(designOf(legacy))).toBe('');
 });
 it('uses actual dispatch, settlement, supplier and claim meanings',()=>{
  const delivery=designOf(newDemoProject('DeliveryOrder'));
  expect(delivery.columns.map(f=>f.pointer)).toContain('./orderedQuantity');expect(delivery.columns.map(f=>f.pointer)).toContain('./remainingQuantity');
  expect(designOf(newDemoProject('SalesInvoice')).totals.at(-1).label).toBe('Invoice total');
  expect(designOf(newDemoProject('PurchaseInvoice')).header.some(f=>f.pointer==='/document/supplierInvoiceNumber')).toBe(true);
  for(const [kind,label] of [['BankReceipt','Received from'],['BankPayment','Paid to']]) {
   const d=designOf(newDemoProject(kind));expect(d.customer[0].label).toBe(label);
   expect(d.totals.map(f=>f.pointer)).toEqual(['/summary/allocatedAmount','/summary/unappliedAmount','/summary/total']);
  }
  expect(designOf(newDemoProject('EnterpriseProject')).totals.map(f=>f.pointer)).toEqual(['/project/contractValue']);
  const claim=designOf(newDemoProject('ProgressClaim'));
  expect(claim.header.some(f=>f.pointer==='/claim/periodEnd')).toBe(true);
  expect(claim.totals.map(f=>f.pointer)).toContain('/summary/retention');
 });
});
