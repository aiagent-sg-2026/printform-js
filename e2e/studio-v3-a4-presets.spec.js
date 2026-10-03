import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {A4_PRESETS} from '../studio-v3/a4-presets.js';
import {demoStarterRecords} from '../studio-v3/demo-catalog.js';

// Runs under the repository's normal GitHub PR CI in all three browser engines.
// No provider request or model output is represented by this layout acceptance test.
// Keep normal service-worker handling: Playwright's block shim reads the forbidden
// serviceWorker getter inside the intentionally opaque preview sandbox.
test.setTimeout(120000);
const preview=page=>page.frameLocator('#preview-frame');
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function choose(page,kind) {
 await page.locator('[data-action=new]').click();
 const details=page.locator('#new-dialog details').filter({hasText:'Business demo templates'});
 if(await details.getAttribute('open')===null)await details.locator('summary').click();
 await page.locator(`[data-demo-template=${kind}]`).click();await ready(page);
}
async function chooseDataset(page,record) {
 await page.locator('[data-mode=data]').click();
 await page.locator('#database-choice').selectOption(record.id);
 await expect(page.locator('#database-choice')).toHaveValue(record.id);await ready(page);
 await expect(page.locator('#db-draft-status')).toHaveText('Form matches saved dataset');
}
async function save(page,info,name,record) {
 // Prove which dataset is active before downloading, then compare the complete saved data.
 await expect(page.locator('#database-choice')).toHaveValue(record.id);
 await expect(page.locator('#database-name')).toHaveValue(record.title);
 const downloading=page.waitForEvent('download');await page.locator('[data-action=save]').click();
 const download=await downloading,path=info.outputPath(`${name}.printform.json`);await download.saveAs(path);
 const source=JSON.parse(await fs.readFile(path,'utf8'));
 expect(JSON.stringify(source.project.sampleData)).toBe(JSON.stringify(record.data));
 return {path,source};
}
async function facts(root) {
 return root.locator('.printform_page').evaluateAll(pages=>pages.map(p=>({
  width:Math.round(p.getBoundingClientRect().width),height:Math.round(p.getBoundingClientRect().height),
  text:p.innerText.replace(/\s+/g,' ').trim(),
  rows:[...p.querySelectorAll('.prowitem_processed')].map(r=>Number(r.dataset.pfRowIndex)),
  headings:p.querySelectorAll('[data-v3-id=items-header]').length,
  pageNumbers:p.querySelectorAll('[data-v3-id=page-number]').length
 })));
}
test.beforeEach(async({page})=>{
 page.on('dialog',dialog=>dialog.accept());await page.goto('/studio-v3/');await ready(page);
});

for(const preset of A4_PRESETS)test(`${preset.documentKind}: real data → edit → reopen → A4 print`,async({page,context,browserName},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await choose(page,preset.documentKind);
 await expect(page.locator('#paper-kind')).toHaveText('A4');
 await expect(page.locator('#paper-dimensions')).toHaveText('210 × 297 mm');
 // New uses the remembered compatible dataset or title-sorted fallback. Choose
 // this fixture explicitly; catalog construction order is not the active dataset.
 const records=demoStarterRecords(preset.documentKind);await chooseDataset(page,records[0]);
 const first=await save(page,info,`${preset.id}-original`,records[0]);
 expect(first.source.project.sampleData).toEqual(records[0].data);
 expect(first.source.project.manifest.studioV3.layoutPreset).toBe(preset.id);
 await expect(preview(page).locator('.prowitem_processed')).toHaveCount(records[0].data.items.length);
 // The existing inspector edits the chosen design without a second layout picker.
 await page.locator('[data-mode=design]').click();
 await page.locator('#left-panel [data-select=items-description]').click();
 await page.getByLabel('Label',{exact:true}).fill('Scope / 项目');
 const before=await page.locator('#revision').textContent();
 await page.getByRole('button',{name:'Apply field',exact:true}).click();
 await expect(page.locator('#revision')).not.toHaveText(before);await ready(page);
 const campus=records.find(record=>record.data.demo.scenario==='campus');
 if(campus) {
  await chooseDataset(page,campus);
  await expect(preview(page).locator('.prowitem_processed')).toHaveCount(campus.data.items.length);
 }
 const chosen=campus || records[0],saved=await save(page,info,`${preset.id}-edited`,chosen);
 expect(saved.source.project.sampleData).toEqual(chosen.data);
 expect(saved.source.project.manifest.studioV3.columns.find(f=>f.id==='description').label).toBe('Scope / 项目');
 // Fictional long-name variation changes only display strings, never a financial value.
 const long=structuredClone(saved.source);
 long.project.sampleData.company.name+=' · Building controls, installation and commercial services division';
 long.project.sampleData.customer.name+=' · Facilities procurement and project coordination department / 工程采购及项目协调部门';
 const longPath=info.outputPath(`${preset.id}-long-names.printform.json`);await fs.writeFile(longPath,JSON.stringify(long));
 // Opening another form first proves the imported layout identity survives a real reopen.
 await page.locator('[data-action=new]').click();await page.locator('[data-template=blank]').click();await ready(page);
 await page.locator('#open-file').setInputFiles(longPath);
 await expect(page.locator('#document-name')).toHaveValue(long.project.manifest.title);await ready(page);
 await expect(preview(page).locator('[data-v3-id=header-company]').first()).toHaveText(long.project.sampleData.company.name);
 await expect(preview(page).locator('[data-v3-id=customer-bill]').first()).toHaveText(long.project.sampleData.customer.name);
 const reopened=await save(page,info,`${preset.id}-reopened`,{id:'',title:long.project.manifest.sampleDataTitle,data:long.project.sampleData});
 expect(reopened.source.project.sampleData).toEqual(long.project.sampleData);
 expect(reopened.source.project.manifest.studioV3).toEqual(long.project.manifest.studioV3);
 const rendered=await facts(preview(page));
 expect(rendered.flatMap(p=>p.rows)).toEqual(chosen.data.items.map((_,i)=>i));
 expect(rendered.every(p=>p.width===750 && p.height===1079)).toBe(true);
 expect(rendered.filter(p=>p.rows.length).every(p=>p.headings===1)).toBe(true);
 expect(rendered.every(p=>p.pageNumbers===1)).toBe(true);
 // Bank campus fixtures have two real allocation rows and remain short forms.
 if(campus?.data.items.length===64)expect(rendered.length).toBeGreaterThan(1);
 await expect(preview(page).locator('[data-v3-id=totals]')).toHaveCount(1);
 await expect(preview(page).locator('[data-v3-id=footer]')).toHaveCount(1);
 const bodyOverflow=await preview(page).locator('.prowitem_processed td').evaluateAll(cells=>cells.filter(cell=>cell.scrollWidth>cell.clientWidth+1).length);
 expect(bodyOverflow).toBe(0);
 const exported=page.waitForEvent('download');await page.locator('[data-action=export]').click();
 const html=await exported,htmlPath=info.outputPath(`${preset.id}.html`);await html.saveAs(htmlPath);
 const print=await context.newPage();await print.goto(pathToFileURL(htmlPath).href);
 await expect(print.locator('html')).toHaveAttribute('data-printform-status','ready');
 expect(await facts(print)).toEqual(rendered);
 await print.emulateMedia({media:'print'});
 expect(await print.locator('.physical_page_wrapper').evaluateAll(nodes=>nodes.every(n=>Math.abs(n.getBoundingClientRect().width-794)<1 && Math.abs(n.getBoundingClientRect().height-1123)<1))).toBe(true);
 await print.screenshot({path:info.outputPath(`${preset.id}.png`),fullPage:true});
 if(browserName==='chromium')await print.pdf({path:info.outputPath(`${preset.id}-A4.pdf`),preferCSSPageSize:true,printBackground:true});
 await fs.writeFile(info.outputPath(`${preset.id}-pagination.json`),JSON.stringify({kind:preset.documentKind,preset:preset.id,scenario:chosen.id,...{pages:rendered}},null,2));
 await print.close();expect(errors).toEqual([]);
});
