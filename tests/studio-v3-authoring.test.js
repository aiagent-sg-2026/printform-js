import { describe, expect, it } from 'vitest';
import { newProject, designOf, compileProject, selectionField } from '../studio-v3/model.js';
import { validateDesign, readProject, saveProject } from '../studio-v3/file-io.js';
import { bindingValidation, validPointer, validatePaperReport } from '../studio-v3/validation.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { validateTrustedContent } from '../studio-v2/core/content-security.js';
import { validateFormSpec } from '../studio-v2/core/form-spec.js';
import { pageDimensions, contentDimensions } from '../studio-v3/design-authoring.js';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const dom = project => { const t = document.createElement('template'); t.innerHTML = project.templateHtml; return t.content; };
const field = (id,text) => ({id,label:'Static label',kind:'static',pointer:'',format:'',text});

describe('Studio v3 framework-native authoring contract',()=> {
  it('styles only the selected customer label, with a stable semantic target and ERP values unchanged',()=> {
    const project = newProject(), d = designOf(project), before = structuredClone(project.sampleData);
    d.customer[0].labelStyle = {fontSize:12,bold:true,color:'#204060',align:'center'};
    d.customer[0].valueStyle = {fontSize:9,bold:false,align:'left'};
    d.titleStyle={fontSize:20,bold:false};d.pageNumberStyle={fontSize:9,bold:true};
    const candidate = compileProject(project,d), root = dom(candidate);
    expect(root.querySelector('[data-v3-id="label-customer-bill"]').getAttribute('style')).toBe('font-size:12pt;font-weight:700;color:#204060;text-align:center');
    expect(root.querySelector('[data-v3-id="customer-bill"]').getAttribute('style')).toBe('font-size:9pt;font-weight:400;text-align:left');
    expect(selectionField(d,'label-customer-bill').field.id).toBe('bill');
    expect(root.querySelector('[data-v3-id=header-title]').getAttribute('style')).toBe('font-size:20pt;font-weight:400');
    expect(root.querySelector('[data-v3-id=page-number]').getAttribute('style')).toBe('font-size:9pt;font-weight:700');
    expect(candidate.sampleData).toEqual(before);
    expect(candidate.spec.components.find(c=>c.id==='customer-bill').labelStyle.fontSize).toBe(12);
    expect(readProject(saveProject(candidate)).manifest.studioV3).toEqual(d);
  });
  it('adds/removes/reorders fields and columns without changing supplied financial data',()=> {
    const p = newProject(), d = designOf(p), before = structuredClone(p.sampleData);
    d.footer.unshift(field('disclaimer','Printed values supplied by ERP'));
    d.customer = [d.customer[3],d.customer[0]];
    d.columns = [d.columns[5],d.columns[2],{...field('fixed','✓'),width:10}];
    d.columns[0].width=25;d.columns[1].width=65;
    const c = compileProject(p,d), t = document.createElement('template');t.innerHTML=c.templateHtml;
    const result=bindTemplate(t,c.sampleData,c.manifest);
    expect(result.report.tableRows).toBe(45);
    expect([...result.fragment.querySelectorAll('.prowitem')][0].textContent).toContain('250');
    expect(result.fragment.querySelector('[data-v3-id="items-fixed"]').textContent).toBe('✓');
    expect(c.sampleData).toEqual(before);
    expect(c.spec.components.filter(x=>x.parent==='customer').map(x=>x.id)).toEqual(['customer-ship-address','customer-bill']);
  });
  it('supports static text without binding validation and escapes every literal',()=> {
    const p=newProject(),d=designOf(p);d.customer[0]={...field('bill','<script>bad()</script>'),showLabel:false};
    const c=compileProject(p,d);delete c.sampleData.customer.name;
    expect(bindingValidation(c).valid).toBe(true);
    expect(dom(c).querySelector('[data-v3-id="customer-bill"]').textContent).toBe('<script>bad()</script>');
    expect(dom(c).querySelector('[data-v3-id="label-customer-bill"]')).toBeNull();
    expect(validateTrustedContent(c).valid).toBe(true);
  });
  it('compiles declarative embedded logos and image fields with fixed safe geometry',()=> {
    const p=newProject(),d=designOf(p);
    d.assets=[{id:'brand',src:PNG,alt:'Company mark'}];
    d.logo={assetId:'brand',width:52,height:52,fit:'contain'};
    d.footer.push({id:'seal',label:'Seal',kind:'image',assetId:'brand',width:80,height:60,fit:'cover',format:'',pointer:''});
    const c=compileProject(p,d),root=dom(c);
    expect(root.querySelector('[data-v3-id="header-logo"]').getAttribute('src')).toBe(PNG);
    expect(root.querySelector('[data-v3-id="footer-seal"]').getAttribute('style')).toContain('object-fit:cover');
    expect(validateTrustedContent(c).valid).toBe(true);
    expect(validateFormSpec(c.spec).valid).toBe(true);
    expect(c.spec.assets[0]).toMatchObject({id:'brand',mime:'image/png',embedded:true});
    expect(JSON.stringify(c.spec)).not.toContain(PNG);
    expect(readProject(saveProject(c)).manifest.studioV3.assets).toEqual(d.assets);
  });
  it('projects body section ordering, layout, breaks and keep-together through native flow rows',()=> {
    const p=newProject(),d=designOf(p);
    d.sectionOrder=['header','footer','items','totals','customer'];
    d.blocks.customer.layout={columns:3,gap:18};d.blocks.totals.keepTogether=true;d.blocks.customer.breakBefore=true;
    const c=compileProject(p,d),root=dom(c);
    expect(c.spec.sections.map(s=>s.id)).toEqual(d.sectionOrder);
    expect([...root.querySelector('.printform').children].filter(n=>n.dataset.pfComponentId && n.dataset.pfComponentId!=='items-header').map(n=>n.dataset.pfComponentId)).toEqual(d.sectionOrder);
    expect(root.querySelector('[data-v3-id="customer"]').classList.contains('ptac-rowitem')).toBe(true);
    expect(root.querySelector('[data-v3-id="customer"]').classList.contains('tb_page_break_before')).toBe(true);
    expect(root.querySelector('[data-v3-id="totals"]').getAttribute('data-pf-keep-together')).toBe('true');
    expect(c.themeCss).toContain('grid-template-columns:repeat(3,minmax(0,1fr));gap:18px');
    expect(c.spec.pagination.keepTogether).toContain('totals');
  });
  it('permits a moved non-repeating header and one-time table heading in flow order',()=> {
    const p=newProject(),d=designOf(p);d.repeatHeader=false;d.repeatTable=false;
    d.sectionOrder=['footer','items','header','customer','totals'];
    const root=dom(compileProject(p,d));
    expect(root.querySelector('.pheader')).toBeNull();
    expect(root.querySelector('[data-v3-id="header"]').classList.contains('ptac-rowitem')).toBe(true);
    expect(root.querySelector('[data-v3-id="items-header"]').classList.contains('ptac-rowitem')).toBe(true);
    d.repeatHeader=true;expect(()=>validateDesign(d)).toThrow('first section');
  });
  it.each(['A4','A5','LETTER','LEGAL'])('supports %s paper, orientation, margin reservations and contextual overflow checks',paper=> {
    const p=newProject(),d=designOf(p);d.page={paper,orientation:'landscape',margins:{top:24,left:12,bottom:24,right:12}};
    const c=compileProject(p,d),size=pageDimensions(d),inner=contentDimensions(d),root=dom(c);
    expect(c.spec.document).toMatchObject({paper,orientation:'landscape',margins:d.page.margins});
    expect(root.querySelector('.printform').dataset.papersizeHeight).toBe(String(inner.height));
    expect(c.themeCss).toContain(`width:${size.width}px!important;padding:24px 12px 24px 12px`);
    const report={status:'ready',validation:{errors:[]},pageGeometry:[size]};
    expect(validatePaperReport(report,c).status).toBe('ready');
    expect(validatePaperReport({...report,pageGeometry:[{...size,height:size.height+10}]},c).status).toBe('blocked');
  });
  it('rejects unsupported properties, duplicate/reserved IDs, executable styles and remote assets',()=> {
    const p=newProject();
    const edits=[d=>{d.customer[0].labelStyle={fontSize:73};},d=>{d.customer[0].valueStyle={css:'url(https://x.test)'};},d=>{d.header[0].id='title';},d=>{d.columns[0].id='header';},d=>{d.header.push({...d.header[0]});},d=>{d.sectionOrder=['header','items'];},d=>{d.page={paper:'A3'};},d=>{d.assets=[{id:'bad',src:'https://example.com/logo.png',alt:'Bad'}];},d=>{d.assets=[{id:'bad',src:'data:image/svg+xml;base64,PHN2Zz4=',alt:'Bad'}];},d=>{d.logo={assetId:'missing',width:52,height:52};},d=>{d.customer[0].kind='static';},d=>{d.columns[0].width=100;},d=>{d.html='<b>no</b>';},d=>{d.blocks.items.keepTogether=true;}];
    for(const edit of edits){const d=designOf(p);edit(d);expect(()=>compileProject(p,d)).toThrow();}
    expect(validPointer('/__proto__/x')).toBe(false);expect(validPointer('/foo~2bar')).toBe(false);expect(validPointer('/foo~1bar')).toBe(true);
  });
});
