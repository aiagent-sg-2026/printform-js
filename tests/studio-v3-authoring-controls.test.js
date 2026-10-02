import { expect, it } from 'vitest';
import { newProject, designOf } from '../studio-v3/model.js';
import { formDesign, designOperations, importRasterAsset } from '../studio-v3/controller.js';
import { rightView, leftView } from '../studio-v3/workspace-views.js';
import { pageDimensions } from '../studio-v3/design-authoring.js';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
function form(values) {
  const result = document.createElement('form');
  for (const [name,value] of Object.entries(values)) {
    const input = document.createElement('input'); input.name = name;
    if (typeof value === 'boolean') { input.type = 'checkbox'; input.checked = value; } else input.value = String(value);
    result.append(input);
  }
  return result;
}
function view(project,selected,tab='properties') {
  const root = document.createElement('div'); root.innerHTML = rightView(project,{mode:'design',selected,tab,report:null}); return root;
}
it('label/value property controls keep binding and literal text unchanged while authoring typed styles',()=> {
  const project = newProject(), before = designOf(project).customer[0];
  const after = formDesign(project,'label-customer-bill',form({label:'Client label',format:'','showLabel-present':'1',showLabel:true,'labelStyle.fontSize':'12','labelStyle.bold':'true','labelStyle.color':'#163a65','labelStyle.align':'left','valueStyle.fontSize':'','valueStyle.bold':'false','valueStyle.color':'','valueStyle.align':''}),'field');
  expect(after.customer[0]).toMatchObject({...before,label:'Client label',showLabel:true,labelStyle:{fontSize:12,bold:true,color:'#163a65',align:'left'},valueStyle:{bold:false}});
  expect(project.manifest.studioV3.customer[0]).toEqual(before); expect(()=>designOperations(project,after)).not.toThrow();
  const inspector = view(project,'label-customer-bill'); expect(inspector.querySelector('input[name="labelStyle.fontSize"]')).toBeTruthy();
  expect(inspector.querySelector('input[name="labelStyle.fontSize"]').closest('details').open).toBe(true);
  expect(inspector.querySelector('[data-ai-add]').dataset.aiAdd).toBe('label-customer-bill');
});
it('inherit clears only the chosen styles, and invalid free CSS never reaches compiled template',()=> {
  const project = newProject(); project.manifest.studioV3.customer[0].labelStyle = {fontSize:12,bold:true};
  const after = formDesign(project,'customer-bill',form({'labelStyle.fontSize':'','labelStyle.bold':'','labelStyle.color':'','labelStyle.align':''}),'field');
  expect(after.customer[0].labelStyle).toBeUndefined();
  const invalid = formDesign(project,'customer-bill',form({'labelStyle.fontSize':'12','labelStyle.color':'red;display:none'}),'field');
  expect(()=>designOperations(project,invalid)).toThrow('hex');
});
it('paper controls feed typed native page dimensions, with independent page-number typography',()=> {
  const project = newProject();
  const design = formDesign(project,'global-style',form({color:'#1763dc',font:'9',padding:'7',striped:true,borders:true,pageNumbers:true,paper:'A5',orientation:'landscape','margin-top':'10','margin-right':'16','margin-bottom':'10','margin-left':'16','pageNumberStyle.fontSize':'11','pageNumberStyle.bold':'true','pageNumberStyle.color':'','pageNumberStyle.align':'right'}),'style');
  expect(design.page).toEqual({paper:'A5',orientation:'landscape',margins:{top:10,right:16,bottom:10,left:16}});
  expect(design.pageNumberStyle).toEqual({fontSize:11,bold:true,align:'right'});
  expect(pageDimensions(design).width).toBeGreaterThan(pageDimensions(design).height);
  expect(()=>designOperations(project,design)).not.toThrow();
  expect(view(project,'global-style').querySelector('select[name="paper"]').value).toBe('A4');
});
it('section order and layout use stable sections, never infer a replacement section from an unknown selection',()=> {
  const project = newProject();
  const design = formDesign(project,'customer',form({label:'Customer',enabled:true,sectionPosition:'3',layoutColumns:'2',layoutGap:'16',keepTogether:true,sectionBreakBefore:true}),'block');
  expect(design.sectionOrder).toEqual(['header','items','totals','customer','footer']);
  expect(design.blocks.customer).toMatchObject({layout:{columns:2,gap:16},keepTogether:true,breakBefore:true});
  expect(()=>designOperations(project,design)).not.toThrow();
  expect(()=>formDesign(project,'missing-section',form({label:'Wrong',enabled:true}),'block')).toThrow('existing section');
  project.manifest.studioV3 = design; expect(leftView(project,{mode:'design',selected:'customer',collapsed:{}}).indexOf('data-tree-group="items"')).toBeLessThan(leftView(project,{mode:'design',selected:'customer',collapsed:{}}).indexOf('data-tree-group="customer"'));
});
it('heading styles bind to header semantics and repeating-header constraints are validated',()=> {
  const project = newProject();
  const design = formDesign(project,'header-title',form({label:'Header',enabled:true,title:'PRINT FORM',repeatHeader:true,sectionPosition:'0','titleStyle.fontSize':'24','titleStyle.bold':'true','titleStyle.color':'#163a65','titleStyle.align':'center'}),'block');
  expect(design.titleStyle).toEqual({fontSize:24,bold:true,color:'#163a65',align:'center'}); expect(()=>designOperations(project,design)).not.toThrow();
  const invalid = formDesign(project,'header',form({label:'Header',enabled:true,title:'PRINT FORM',repeatHeader:true,sectionPosition:'2'}),'block');
  expect(()=>designOperations(project,invalid)).toThrow('first section');
});
it('explicit image upload embeds validated raster bytes locally and retains only the previous binding path',async()=> {
  const project = newProject(), file = new File([Uint8Array.from(atob(PNG),c=>c.charCodeAt(0))],'test.png',{type:'image/png'});
  const design = await importRasterAsset(project,file,'customer-bill');
  expect(design.assets[0]).toMatchObject({src:`data:image/png;base64,${PNG}`,alt:''});
  expect(design.customer[0]).toMatchObject({kind:'image',pointer:'',lastPointer:'/customer/name',text:'',format:'',assetId:design.assets[0].id,width:80,height:60,fit:'contain'});
  expect(project.manifest.studioV3.assets).toBeUndefined(); expect(()=>designOperations(project,design)).not.toThrow();
  await expect(importRasterAsset(project,new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'}),'header-logo')).rejects.toThrow('PNG');
  await expect(importRasterAsset(project,file,'items-description')).rejects.toThrow('non-table');
});
it('image-to-text binding transitions remove image-only fields instead of keeping a hidden asset interpretation',async()=> {
  const project = newProject(), file = new File([Uint8Array.from(atob(PNG),c=>c.charCodeAt(0))],'test.png',{type:'image/png'});
  project.manifest.studioV3 = await importRasterAsset(project,file,'customer-bill');
  const design = formDesign(project,'customer-bill',form({bindingMode:'static',pointer:'/customer/name',text:'Reviewed literal'}),'binding');
  expect(design.customer[0]).toMatchObject({kind:'static',pointer:'',lastPointer:'/customer/name',text:'Reviewed literal'});
  for (const key of ['assetId','width','height','fit']) expect(design.customer[0]).not.toHaveProperty(key);
  expect(()=>designOperations(project,design)).not.toThrow();
});
