import {it,expect,afterEach} from 'vitest';
import {installPrintFormDocument} from '../../studio-v2/core/runtime.js';
import {validateProject} from '../../studio-v2/core/acceptance.js';
import {createSalesInvoiceProject} from '../../studio-v2/samples/sales-invoice.js';

const originalFonts=Object.getOwnPropertyDescriptor(document,'fonts');
afterEach(()=>{if(originalFonts)Object.defineProperty(document,'fonts',originalFonts);else delete document.fonts;});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function finishPageFixture() {
  const form=document.querySelector('.printform');
  form.querySelectorAll('.pdocinfo').forEach(node=>node.classList.replace('pdocinfo','pdocinfo_processed'));
  form.classList.replace('printform','printform_page');
}
function setup(manifest={},template='<section class="printform"><div class="pdocinfo"><span data-pf-text="/name"></span></div></section>',schema={type:'object'}) {
  document.documentElement.lang='en-MY';
  document.head.innerHTML=`<title>Runtime boundaries</title><script id="pf-manifest" type="application/json">${JSON.stringify(manifest)}</script><script id="pf-schema" type="application/json">${JSON.stringify(schema)}</script>`;
  document.body.innerHTML=`<main id="pf-mount"></main><template id="pf-template">${template}</template><script id="pf-sample-data" type="application/json">{"name":"auto"}</script>`;
  Object.defineProperty(document,'fonts',{value:{ready:Promise.resolve()},configurable:true});
  const events=[];
  const scope={document,dispatchEvent:event=>events.push(event.detail),PrintForm:{formatAll:async()=>finishPageFixture()}};
  return {scope,events,api:installPrintFormDocument(scope)};
}

it('uses the same financial-rule switch for Studio and standalone validation',async()=>{
  const project=createSalesInvoiceProject();project.sampleData.items[0].lineTotal+=1;
  const {api}=setup(project.manifest,project.templateHtml,project.schema);
  expect(api.validate(project.sampleData).errors.map(e=>e.code)).toContain('LINE_TOTAL_MISMATCH');
  expect(validateProject(project).errors.map(e=>e.code)).toContain('LINE_TOTAL_MISMATCH');
  await api.render({});
  for(const manifest of [{...project.manifest,businessRules:false},{...project.manifest,studioV3:{type:'invoice'}}]) {
    const runtime=setup(manifest,project.templateHtml,project.schema).api;
    expect(runtime.validate(project.sampleData).errors.map(e=>e.code)).not.toContain('LINE_TOTAL_MISMATCH');
    expect(validateProject({...project,manifest}).errors.map(e=>e.code)).not.toContain('LINE_TOTAL_MISMATCH');
    await runtime.render({}); // Explicitly suppress queued automatic rendering for this installation.
  }
});
it.each([
  ['number',{minimumFractionDigits:5,maximumFractionDigits:2}],
  ['date',{timeZone:'Not/AZone'}],
  ['currency',{currency:'INVALID'}],
  ['number',[]]
])('returns pointer/component diagnostics instead of rejecting for invalid %s options',async(format,options)=>{
  const html=`<section class="printform"><span data-pf-component-id="amount" data-pf-text="/value" data-pf-format="${format}" data-pf-format-options='${JSON.stringify(options)}'></span></section>`;
  const {api,events}=setup({},html);
  const report=await api.render({value:format==='date'?'2026-10-13':12});
  expect(report.status).toBe('blocked');
  expect(report.validation.errors).toContainEqual(expect.objectContaining({code:'FORMAT_CONFIG',path:'/value',component:'amount'}));
  const project={...createSalesInvoiceProject(),templateHtml:html};
  expect(validateProject(project).errors).toContainEqual(expect.objectContaining({code:'FORMAT_CONFIG',path:'/value',component:'amount'}));
  expect(events.at(-1).status).toBe('blocked');expect(document.querySelector('#pf-mount').children).toHaveLength(0);
});
it('catches locale overrides at the binding boundary',async()=>{
  const {api}=setup({},'<section class="printform"><span data-pf-text="/value" data-pf-format="number"></span></section>');
  const report=await api.render({value:1},{locale:'invalid_locale'});
  expect(report.status).toBe('blocked');expect(report.validation.errors[0]).toMatchObject({code:'FORMAT_CONFIG',path:'/value'});
});
it('returns blocked pagination errors instead of rejecting or reporting ready',async()=>{
  const {api,scope,events}=setup();
  scope.PrintForm.formatAll=async()=>{throw new AggregateError([Object.assign(new Error('Row could not fit'),{code:'ROW_TOO_TALL',componentId:'items'})]);};
  const result=await api.render({name:'new'});
  expect(result.status).toBe('blocked');expect(result.validation.errors[0]).toMatchObject({code:'ROW_TOO_TALL',path:'/template',component:'items'});
  expect(events).toHaveLength(1);expect(document.querySelector('#pf-mount').children).toHaveLength(0);
});
it('does not let a stale asset rejection clear a newer ready mount or publish status',async()=>{
  const {api,events}=setup();const oldAssets=deferred();
  Object.defineProperty(document,'fonts',{value:{ready:oldAssets.promise},configurable:true});
  const old=api.render({name:'old'});
  Object.defineProperty(document,'fonts',{value:{ready:Promise.resolve()},configurable:true});
  const fresh=await api.render({name:'fresh'});expect(fresh.status).toBe('ready');
  oldAssets.reject(new Error('Old font failed'));
  expect((await old).status).toBe('superseded');expect(events).toHaveLength(1);
  expect(document.documentElement.dataset.printformStatus).toBe('ready');expect(document.querySelector('#pf-mount').textContent).toBe('fresh');
});
it.each(['resolve','reject'])('does not publish stale pagination %s after a newer render finishes',async(outcome)=>{
  const {api,scope,events}=setup();const oldWork=deferred(),entered=deferred();let calls=0;
  scope.PrintForm.formatAll=async()=>{
    if(++calls===1){entered.resolve();await oldWork.promise;return;}
    finishPageFixture();
  };
  const old=api.render({name:'old'});await entered.promise;
  expect((await api.render({name:'fresh'})).status).toBe('ready');
  if(outcome==='reject')oldWork.reject(new Error('Old pagination failed'));else oldWork.resolve();
  expect((await old).status).toBe('superseded');expect(events).toHaveLength(1);
  expect(document.documentElement.dataset.printformStatus).toBe('ready');expect(document.querySelector('#pf-mount').textContent).toBe('fresh');
});
