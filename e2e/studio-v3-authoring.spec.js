import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { newProject, designOf, compileProject, sampleData } from '../studio-v3/model.js';
import { saveProject } from '../studio-v3/file-io.js';
import { pageDimensions, contentDimensions } from '../studio-v3/design-authoring.js';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const preview = page => page.frameLocator('#preview-frame');
async function open(page,project) {
  const source=saveProject(project);
  await page.locator('#open-file').setInputFiles({name:'authoring.printform.json',mimeType:'application/json',buffer:Buffer.from(source)});
  await expect(page.locator('#document-name')).toHaveValue(project.manifest.title);
  await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
}
async function facts(page) {
  return preview(page).locator('.printform_page').evaluateAll(pages=>pages.map(p=>({width:Math.round(p.getBoundingClientRect().width),height:Math.round(p.getBoundingClientRect().height),text:p.innerText.replace(/\s+/g,' ').trim(),rows:[...p.querySelectorAll('.prowitem_processed')].map(r=>Number(r.dataset.pfRowIndex)),sections:[...p.children].map(n=>n.dataset.v3Id).filter(Boolean)})));
}
test.beforeEach(async({page})=> {
  page.on('dialog',d=>d.accept());await page.goto('/studio-v3/');
  await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
});
test('selected customer label gets 12pt bold while the value and supplied amounts remain unchanged',async({page},info)=> {
  const p=newProject(),d=designOf(p);p.manifest.title='Selected label typography';
  d.customer[0].labelStyle={fontSize:12,bold:true};
  d.titleStyle={fontSize:20,bold:false};d.pageNumberStyle={fontSize:9,bold:true};
  const c=compileProject(p,d);await open(page,c);
  const label=preview(page).locator('[data-v3-id="label-customer-bill"]').first();
  const value=preview(page).locator('[data-v3-id="customer-bill"]').first();
  expect(await label.evaluate(n=>({font:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight}))).toEqual({font:'16px',weight:'700'});
  expect(await value.evaluate(n=>getComputedStyle(n).fontSize)).toBe('12px');
  await label.click();
  await expect(page.locator('#right-panel .inspector-title')).toContainText('Bill to');
  await expect(preview(page).locator('[data-v3-id="totals-total"]')).toContainText('12,150');
  await page.screenshot({path:info.outputPath('selected-customer-label-12pt-bold.png')});
});
test('native ordered sections, embedded images and column operations preserve every ERP row',async({page},info)=> {
  const p=newProject();p.sampleData=sampleData('invoice',45);p.manifest.title='Framework authoring flow';
  const d=designOf(p);d.sectionOrder=['header','footer','items','totals','customer'];
  d.assets=[{id:'mark',src:PNG,alt:'Embedded company mark'}];d.logo={assetId:'mark',width:48,height:48,fit:'contain'};
  d.footer.unshift({id:'opening',kind:'static',pointer:'',format:'',label:'Opening note',text:'Native flow before items'});
  d.blocks.customer.layout={columns:2,gap:12};d.blocks.totals.keepTogether=true;
  d.customer.push({id:'seal',kind:'image',pointer:'',format:'',label:'Seal',assetId:'mark',width:32,height:32});
  d.columns=[d.columns[2],d.columns[0],d.columns[5]];d.columns[0].width=60;d.columns[1].width=10;d.columns[2].width=30;
  const c=compileProject(p,d);await open(page,c);
  const rendered=await facts(page);
  expect(rendered.flatMap(p=>p.rows)).toEqual(Array.from({length:45},(_,i)=>i));
  expect(rendered.flatMap(p=>p.sections).filter(id=>['footer','items','totals','customer'].includes(id)).filter(id=>id!=='items')).toEqual(['footer','totals','customer']);
  expect(rendered[0].text.indexOf('Native flow before items')).toBeLessThan(rendered[0].text.indexOf('Modular Control Unit'));
  await expect(preview(page).locator('[data-v3-id="footer-opening"]')).toHaveText('Native flow before items');
  expect(await preview(page).locator('[data-v3-id="header-logo"]').first().evaluate(n=>n.complete && n.naturalWidth>0)).toBe(true);
  expect(await preview(page).locator('[data-v3-id="customer-seal"]').evaluate(n=>n.complete && n.naturalWidth>0)).toBe(true);
  await fs.writeFile(info.outputPath('framework-flow-pages.json'),JSON.stringify(rendered,null,2));
});
for(const paper of ['A4','A5','LETTER','LEGAL']) {
  test(`${paper} landscape and page margins use measured framework geometry`,async({page},info)=> {
    const p=newProject();p.sampleData=sampleData('invoice',20);p.manifest.title=`${paper} geometry`;
    const d=designOf(p);d.page={paper,orientation:'landscape',margins:{top:20,right:16,bottom:20,left:16}};
    const c=compileProject(p,d),physical=pageDimensions(d),inner=contentDimensions(d);await open(page,c);
    await expect(page.locator('#paper-kind')).toHaveText(paper);
    await expect(page.locator('#paper-dimensions')).toHaveText(`${Math.round(physical.width/96*25.4)} × ${Math.round(physical.height/96*25.4)} mm`);
    const rendered=await facts(page);
    expect(rendered.flatMap(p=>p.rows)).toEqual(Array.from({length:20},(_,i)=>i));
    expect(rendered.every(p=>Math.abs(p.width-inner.width)<=1 && Math.abs(p.height-inner.height)<=1)).toBe(true);
    const wrappers=await preview(page).locator('.physical_page_wrapper').evaluateAll(nodes=>nodes.map(n=>({width:Math.round(n.getBoundingClientRect().width),height:Math.round(n.getBoundingClientRect().height)})));
    expect(wrappers.every(p=>Math.abs(p.width-physical.width)<=1 && Math.abs(p.height-physical.height)<=1)).toBe(true);
    await expect(preview(page).locator('[data-v3-id="totals"]')).toHaveCount(1);
    await expect(preview(page).locator('[data-v3-id="footer"]')).toHaveCount(1);
    await fs.writeFile(info.outputPath(`${paper.toLowerCase()}-landscape-geometry.json`),JSON.stringify({physical,inner,rendered,wrappers},null,2));
  });
}
test('blocked custom geometry still shows its actual paper and keeps print/export locked',async({page})=> {
  const p=newProject(),d=designOf(p);p.manifest.title='Oversized A5 footer';
  d.page={paper:'A5',orientation:'landscape',margins:{top:20,right:16,bottom:20,left:16}};
  d.footer[0].valueStyle={fontSize:72};
  await page.locator('#open-file').setInputFiles({name:'blocked-a5.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(compileProject(p,d)))});
  await expect(page.locator('#document-name')).toHaveValue(p.manifest.title);
  await expect(page.locator('#page-count')).toHaveText('Render blocked',{timeout:30000});
  await expect(page.locator('#status')).toContainText('exceed');
  await expect(page.locator('#paper-kind')).toHaveText('A5');
  await expect(page.locator('#paper-dimensions')).toHaveText('210 × 148 mm');
  await expect(page.locator('[data-action=print]')).toBeDisabled();
  await expect(page.locator('[data-action=export]')).toBeDisabled();
});
test('non-repeating table heading survives ordered flow with no repeated or dropped rows',async({page})=> {
  const p=newProject();p.sampleData=sampleData('invoice',100);p.manifest.title='One-time heading ordered flow';
  const d=designOf(p);d.sectionOrder=['header','footer','items','customer','totals'];d.repeatTable=false;
  await open(page,compileProject(p,d));
  expect((await facts(page)).flatMap(p=>p.rows)).toEqual(Array.from({length:100},(_,i)=>i));
  await expect(preview(page).locator('[data-v3-id="items-header"]')).toHaveCount(1);
});
