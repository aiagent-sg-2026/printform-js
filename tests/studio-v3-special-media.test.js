import { describe,it,expect } from 'vitest';
import { newProject,designOf,compileProject } from '../studio-v3/model.js';
import { pageDimensions,contentDimensions } from '../studio-v3/design-authoring.js';
import { validatePageSettings,validatePrinterProfile,printerStatus } from '../studio-v3/paper-settings.js';
import { pageFromForm,profileFromForm } from '../studio-v3/paper-controls.js';
import { createBus,formDesign,designOperations,editProject } from '../studio-v3/controller.js';
import { rightView } from '../studio-v3/workspace-views.js';
import { readProject,saveProject } from '../studio-v3/file-io.js';
import { bindingValidation,inspectProject } from '../studio-v3/validation.js';
import { resolvePaperDimensions } from '../src/printform/helpers.js';
import { restoreDraftRecords } from '../studio-v3/form-drafts.js';

const userProfile = patch => ({version:1,source:'user-supplied',name:'User declarations, not a real-device test',...patch});
const pageWith = patch => ({paper:'CUSTOM',orientation:'portrait',customSizeMm:{width:82.5,height:133.2},margins:{top:8,right:8,bottom:8,left:8},...patch});
const inspector = project => {
  const root = document.createElement('div');
  root.innerHTML = rightView(project,{mode:'design',selected:'global-style',tab:'properties',report:null});
  return root.querySelector('form[data-form="style"]');
};

describe('general Studio finite paper and user-supplied capability profiles',()=> {
  it('keeps legacy defaults and aliases while custom geometry is exact and swaps once',()=> {
    const project = newProject(), design = designOf(project);
    expect(resolvePaperDimensions({paperSize:'US_LETTER',orientation:'portrait',dpi:96})).toEqual({width:816,height:1056});
    design.page = pageWith({orientation:'landscape'});
    expect(pageDimensions(design)).toEqual({width:133.2*96/25.4,height:82.5*96/25.4});
    expect(contentDimensions(design)).toEqual({width:133.2*96/25.4-16,height:82.5*96/25.4-16});
    const compiled = compileProject(project,design);
    expect(compiled.sampleData).toEqual(project.sampleData);
  });
  it.each([
    pageWith({customSizeMm:{width:19.99,height:100}}),pageWith({customSizeMm:{width:1001,height:100}}),
    pageWith({customSizeMm:{width:'80',height:100}}),pageWith({customSizeMm:{width:NaN,height:100}}),
    pageWith({customSizeMm:{width:100}}),pageWith({customSizeMm:null}),pageWith({paper:'A4'}),
    pageWith({orientation:'auto'}),pageWith({paper:'ROLL'}),
    pageWith({customSizeMm:{width:20,height:20},margins:{left:40,right:40}}),
    pageWith({margins:{top:73}}),pageWith({margins:{left:-1}}),pageWith({margins:{unit:'mm'}})
  ])('rejects invalid paper geometry without silently clamping %j',page=> {
    const project = newProject(), design = designOf(project), before = structuredClone(project); design.page = page;
    expect(()=>compileProject(project,design)).toThrow(); expect(project).toEqual(before);
  });
  it('uses only declared capabilities, and zero/false are distinct from unknown',()=> {
    const profile = userProfile({minWidthMm:50,maxWidthMm:150,minHeightMm:30,maxHeightMm:200,orientations:['portrait'],nonPrintableMm:{left:0,right:1},dpi:203,cutter:false});
    const page = pageWith({printerProfile:profile}); expect(validatePageSettings(page)).toBe(page);
    const values = new FormData(); values.set('printer-name',profile.name); values.set('printer-cutter','false'); values.set('printer-margin-left','0');
    expect(profileFromForm(values)).toEqual(userProfile({cutter:false,nonPrintableMm:{left:0}}));
    expect(printerStatus({page}).physicalBlocked).toBe(true);
    expect(printerStatus({page}).unknown).toEqual(['top nonprintable margin','bottom nonprintable margin']);
    expect(printerStatus({}).capabilities).toBe('unknown');
  });
  it.each([
    {maxWidthMm:80},{minWidthMm:83},{maxHeightMm:130},{minHeightMm:134},
    {orientations:['landscape']},{nonPrintableMm:{left:3}},
    {minWidthMm:200,maxWidthMm:100},{orientations:[]},{orientations:['portrait','portrait']},
    {dpi:0},{dpi:203.5},{cutter:'true'},{nonPrintableMm:{top:-1}},
    {certified:true},{source:'browser-discovered'},{name:''}
  ])('blocks contradictory or malformed declarations %j',patch=> {
    expect(()=>validatePageSettings(pageWith({printerProfile:userProfile(patch)}))).toThrow();
  });
  it('checks dimensions after orientation without rotating user-declared edge margins',()=> {
    const profile = userProfile({minWidthMm:120,maxWidthMm:140,minHeightMm:80,maxHeightMm:90,orientations:['landscape'],nonPrintableMm:{left:2}});
    expect(()=>validatePageSettings(pageWith({orientation:'landscape',printerProfile:profile}))).not.toThrow();
    expect(()=>validatePageSettings(pageWith({orientation:'portrait',printerProfile:profile}))).toThrow('width');
    expect(()=>validatePrinterProfile(userProfile({nonPrintableMm:{top:101}}))).toThrow();
  });
  it('real inspector Apply saves the single page model, and history reverses profile and paper together',async()=> {
    const bus = createBus(newProject()), original = designOf(bus.project), data = structuredClone(bus.project.sampleData);
    const form = inspector(bus.project);
    expect(form.elements['printer-enabled'].checked).toBe(false);
    form.elements.paper.value = 'CUSTOM'; form.elements['paper-width-mm'].value = '82.5'; form.elements['paper-height-mm'].value = '133.2';
    form.elements['printer-enabled'].checked = true; form.elements['printer-name'].value = 'User-entered capabilities'; form.elements['printer-maxWidthMm'].value = '90';
    const design = formDesign(bus.project,'global-style',form,'style');
    expect(design.page.customSizeMm).toEqual({width:82.5,height:133.2});
    await editProject(bus,designOperations(bus.project,design),'user paper settings');
    expect(bus.project.sampleData).toEqual(data);
    const restored = readProject(saveProject(bus.project)); expect(restored.manifest.studioV3.page).toEqual(design.page);
    expect(bindingValidation(restored).valid).toBe(true);
    const quality = inspectProject(restored);
    expect(quality.physical.physicalBlocked).toBe(true);
    expect(quality.warnings.some(w=>w.code === 'PHYSICAL_PRINTER_UNVERIFIED')).toBe(true);
    await bus.navigateHistory('undo',bus.revision); expect(designOf(bus.project)).toEqual(original);
    await bus.navigateHistory('redo',bus.revision); expect(designOf(bus.project).page).toEqual(design.page);
    const removal = inspector(bus.project); removal.elements['printer-enabled'].checked = false; removal.elements.paper.value = 'A4';
    const removed = formDesign(bus.project,'global-style',removal,'style');
    expect(removed.page.printerProfile).toBeUndefined(); expect(removed.page.customSizeMm).toBeUndefined();
  });
  it('restores conditional page controls with pending/recovered drafts, including hidden stale invalid input',()=> {
    const form = inspector(newProject());
    expect(form.querySelector('[data-custom-paper]').hidden).toBe(true);
    const record = {key:'style:global',kind:'style',selected:'global-style',values:{
      paper:'CUSTOM','paper-width-mm':'82.5','paper-height-mm':'133.2','printer-enabled':true,'printer-name':'User declaration','printer-maxWidthMm':'90'
    }};
    restoreDraftRecords([record],()=>form,{});
    expect(form.querySelector('[data-custom-paper]').hidden).toBe(false);
    expect(form.elements['paper-width-mm'].disabled).toBe(false);
    expect(form.querySelector('[data-printer-fields]').hidden).toBe(false);
    expect(form.elements['printer-maxWidthMm'].disabled).toBe(false);
    const removed = {...record,values:{...record.values,paper:'A4','printer-enabled':false,'paper-width-mm':'1','printer-maxWidthMm':'-1'}};
    restoreDraftRecords([removed],()=>form,{});
    expect(form.elements['paper-width-mm'].disabled).toBe(true);
    expect(form.elements['printer-maxWidthMm'].disabled).toBe(true);
    expect(form.checkValidity()).toBe(true);
    expect(pageFromForm(new FormData(form)).printerProfile).toBeUndefined();
  });
  it('reports invalid custom geometry clearly before attempting rendered-paper dimensions',()=> {
    const project = newProject(); project.manifest.studioV3.page = pageWith({customSizeMm:{width:0,height:100}});
    const quality = inspectProject(project,{status:'ready',pageGeometry:[{width:794,height:1123}],validation:{errors:[],warnings:[]}});
    expect(quality.ready).toBe(false);
    expect(quality.errors.some(error=>error.code === 'INVALID_DESIGN' && error.message.includes('20–1000'))).toBe(true);
    expect(quality.physical.physicalBlocked).toBe(true);
  });
});
