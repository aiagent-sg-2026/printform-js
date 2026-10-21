import {expectApplied} from './ai-applied.js';
import { responsesReply } from './demo-gateway-fixture.js';
import { test, expect } from './studio-v3-test.js';
import { limitToSelection, limitToWholeForm } from './studio-v3-scope.js';
import { keepStructureOpen } from './studio-v3-structure.js';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

test.setTimeout(90000);
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const paper=page=>page.frameLocator('#preview-frame');
const request='row data table bg style use yellow';
const fill={kind:'proposal',summary:'Yellow table data row backgrounds',operations:[{type:'set_table_style',target:'items',patch:{rowBackground:'#ffff00'}}]};
async function mock(page,replies){
  const calls=[];
  await page.route('https://gpt.yapweijun1996.com/demo/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let body;if(path.endsWith('/session'))body={token:'dmo_synthetic123456',expires_in:900};
    else if(path.endsWith('/models'))body={data:[{id:'demo-fast'}]};
    else{calls.push(route.request().postDataJSON());body=responsesReply(replies[Math.min(calls.length-1,replies.length-1)]);}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });return calls;
}
async function save(page,info,name){
  const revision=(await page.locator('#revision').innerText()).match(/^r(\d+)(?: · unsaved template)?$/);expect(revision).not.toBeNull();
  const pending=page.waitForEvent('download');await page.locator('[data-action=save]').click();
  const download=await pending,path=info.outputPath(name);await download.saveAs(path);
  await expect(page.locator('#revision')).toHaveText(`r${revision[1]}`);
  return {path,project:JSON.parse(await fs.readFile(path,'utf8')).project};
}
async function expectYellow(locator){
  await expect(locator.first()).toHaveCSS('background-color','rgb(255, 255, 0)');
  expect(await locator.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).backgroundColor==='rgb(255, 255, 0)'))).toBe(true);
}
test.beforeEach(async({page})=>{page.on('dialog',dialog=>dialog.accept());await keepStructureOpen(page);await page.goto('/studio-v3/');await ready(page);});
test('yellow rows are rendered across pages; automatic apply, Undo and save/reopen retain data and template identity',async({page,context,browserName},info)=>{
  const calls=await mock(page,[fill]);const before=await save(page,info,'before-row-fill.printform.json');
  const totals=await paper(page).locator('[data-v3-id=totals-total]').allTextContents();
  const originalColors=await paper(page).locator('.prowitem_processed tr').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor));
  expect(await paper(page).locator('.printform_page').count()).toBeGreaterThan(1);
  await page.locator('[data-ai-toggle]').click();await page.locator('#ai-prompt').fill(request);await page.locator('[data-ai-send]').click();
  await expectApplied(page,1);expect(calls).toHaveLength(1);
  await expect(page.locator('.ai-diff')).toContainText('tableStyle.rowBackground');
  await expectYellow(paper(page).locator('.prowitem_processed'));await expectYellow(paper(page).locator('.prowitem_processed tr'));await expectYellow(paper(page).locator('.prowitem_processed td'));
  await page.screenshot({path:info.outputPath('yellow-table-row-applied.png')});
  await ready(page);await expect(page.locator('#revision')).toHaveText('r1 · unsaved template');
  await expectYellow(paper(page).locator('.prowitem_processed tr'));await expectYellow(paper(page).locator('.prowitem_processed td'));
  await expect(paper(page).locator('.brand-mark').first()).toHaveCSS('color','rgb(23, 99, 220)');
  await expect(paper(page).locator('th').first()).toHaveCSS('background-color','rgb(233, 239, 248)');
  expect(await paper(page).locator('[data-v3-id=totals-total]').allTextContents()).toEqual(totals);
  const authored=await save(page,info,'yellow-row-fill.printform.json');
  expect(authored.project.manifest.documentId).toBe(before.project.manifest.documentId);expect(authored.project.sampleData).toEqual(before.project.sampleData);
  expect(authored.project.manifest.studioV3).toEqual({...before.project.manifest.studioV3,tableStyle:{rowBackground:'#ffff00'}});
  const pending=page.waitForEvent('download');await page.locator('[data-action=export]').click();const exported=await pending,exportPath=info.outputPath('yellow-row-fill.html');await exported.saveAs(exportPath);
  const printed=await context.newPage();await printed.goto(pathToFileURL(exportPath).href);await expect(printed.locator('html')).toHaveAttribute('data-printform-status','ready');
  await expectYellow(printed.locator('.prowitem_processed'));await expectYellow(printed.locator('.prowitem_processed tr'));await expectYellow(printed.locator('.prowitem_processed td'));
  await expect(printed.locator('.prowitem_processed')).toHaveCount(before.project.sampleData.items.length);
  if(browserName==='chromium')await printed.pdf({path:info.outputPath('yellow-row-fill-A4.pdf'),preferCSSPageSize:true,printBackground:true});await printed.close();
  await page.locator('[data-ai=undo]').click();await ready(page);await expect(page.locator('#revision')).toHaveText('r2 · unsaved template');
  expect(await paper(page).locator('.prowitem_processed tr').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor))).toEqual(originalColors);
  const undone=await save(page,info,'undo-row-fill.printform.json');expect(undone.project.manifest.studioV3).toEqual(before.project.manifest.studioV3);expect(undone.project.sampleData).toEqual(before.project.sampleData);
  const chooser=page.waitForEvent('filechooser');await page.locator('[data-action=open]').click();await(await chooser).setFiles(authored.path);await ready(page);
  await expectYellow(paper(page).locator('.prowitem_processed tr'));const reopened=await save(page,info,'reopened-row-fill.printform.json');
  expect(reopened.project.manifest.studioV3).toEqual(authored.project.manifest.studioV3);expect(reopened.project.manifest.title).toBe(authored.project.manifest.title);expect(reopened.project.sampleData).toEqual(authored.project.sampleData);
});
test('table selection permits row fill; manual property clearing restores existing stripes',async({page})=>{
  await mock(page,[fill]);await page.locator('#left-panel [data-select=items]').click();await page.locator('[data-ai-toggle]').click();await limitToSelection(page);
  await page.locator('#ai-prompt').fill(request);await page.locator('[data-ai-send]').click();await expectApplied(page,1);await ready(page);
  await expectYellow(paper(page).locator('.prowitem_processed tr'));await page.locator('[data-ai=close]').click();
  const field=page.getByLabel('Table row background',{exact:true});await expect(field).toHaveValue('#ffff00');await field.fill('');
  await expectYellow(paper(page).locator('.prowitem_processed tr'));await page.getByRole('button',{name:'Apply section',exact:true}).click();await ready(page);
  await expect(paper(page).locator('.prowitem_processed tr').first()).not.toHaveCSS('background-color','rgb(255, 255, 0)');
  await page.locator('[data-action=go-style]').click();await expect(page.getByLabel('Table row background',{exact:true})).toHaveValue('');
  await page.getByLabel('Table row background',{exact:true}).fill('#ffff00');await page.getByRole('button',{name:'Apply style',exact:true}).click();await ready(page);await expectYellow(paper(page).locator('.prowitem_processed td'));
});
test('schema-valid model fill is not repaired by host request-color interpretation and remains undoable',async({page})=>{
 const blue={kind:'proposal',summary:'Light blue data rows',operations:[{type:'set_table_style',target:'items',patch:{rowBackground:'#dbeafe'}}]};
 const original=await paper(page).locator('.prowitem_processed td').first().evaluate(node=>getComputedStyle(node).backgroundColor);
 const calls=await mock(page,[blue]);await page.locator('[data-ai-toggle]').click();
 await page.locator('#ai-prompt').fill('Make every data row yellow.');await page.locator('[data-ai-send]').click();
 await expectApplied(page,1);expect(calls).toHaveLength(1);
 await expect(page.locator('.ai-diff')).toContainText('tableStyle.rowBackground');
 await expect(page.locator('#revision')).toHaveText('r1 · unsaved template');await ready(page);
 await expect(paper(page).locator('.prowitem_processed td').first()).toHaveCSS('background-color','rgb(219, 234, 254)');
 await page.locator('[data-ai=undo]').click();await ready(page);await expect(page.locator('#revision')).toHaveText('r2 · unsaved template');
 await expect(paper(page).locator('.prowitem_processed td').first()).toHaveCSS('background-color',original);
});
test('comments-only table requests share comments with the model and apply its inspected fill',async({page})=>{
 const calls=await mock(page,[fill]);await page.locator('#left-panel [data-select=items]').click();await page.locator('#left-panel [data-ai-add]').click();
 await page.getByLabel('Comment for items',{exact:true}).fill('Make this background yellow');
 await expect(page.locator('#ai-prompt')).toHaveValue('');await page.locator('[data-ai-send]').click();
 await expectApplied(page,1);expect(calls).toHaveLength(1);expect(JSON.stringify(calls[0])).toContain('Make this background yellow');
 await expect(page.locator('.ai-diff')).toContainText('tableStyle.rowBackground');await expect(page.locator('#revision')).toHaveText('r1 · unsaved template');
 await expectYellow(paper(page).locator('.prowitem_processed td'));
 await ready(page);await expect(page.locator('#revision')).toHaveText('r1 · unsaved template');await expectYellow(paper(page).locator('.prowitem_processed td'));
});
