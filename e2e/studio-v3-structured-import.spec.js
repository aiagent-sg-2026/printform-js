import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { saveProject } from '../studio-v3/file-io.js';
import { generalImportProject } from '../tests/fixtures/structured-import-general.js';

const csv = 'n,code,description,qty,unit,total,uom\r\n1,00007,"Fictional, 中文\nline",2,001.250,2.500,box\r\n2,00008,Second fictional item,3,2.000,6.000,kg\r\n';
const action = (page,name) => page.locator(`[data-db-action="${name}"]`).filter({visible:true}).first();
const ready = page => expect(page.locator('[data-action="export"]')).toBeEnabled({timeout:30000});
async function file(page,name,text) {
  const chooser = page.waitForEvent('filechooser'); await action(page,'import').click();
  await (await chooser).setFiles({name,mimeType:name.endsWith('.csv') ? 'text/csv' : 'application/json',buffer:Buffer.isBuffer(text) ? text : Buffer.from(text)});
}
async function map(page,target,source,conversion='preserve') {
  await page.getByLabel(`Source for ${target}`,{exact:true}).selectOption(source);
  if (conversion !== 'preserve') await page.getByLabel(`Conversion for ${target}`,{exact:true}).selectOption(conversion);
}
async function mapCSV(page) {
  for (const [target,source,conversion] of [['/no','/n','number'],['/sku','/code','preserve'],['/description','/description','preserve'],['/quantity','/qty','number'],['/rate','/unit','number'],['/amount','/total','number']]) await map(page,target,source,conversion);
}
async function assertPrintedValues(page,values) {
  await action(page,'preview').click();
  await expect(page.locator('#database-workbench')).toBeHidden();
  await expect(page.locator('#preview-frame')).toBeVisible();
  // Match the existing business-form checks: inspect the current live main-world DOM, not an auxiliary locator world across srcdoc navigation.
  const element = await page.locator('#preview-frame').elementHandle();
  try {
    const frame = await element.contentFrame();
    if (!frame) throw new Error('The rendered preview iframe is detached.');
    await frame.waitForLoadState('load',{timeout:12000});
    const actual = await frame.evaluate(ids=>Object.fromEntries(ids.map(id=>[id,document.querySelector(`[data-v3-id="${id}"]`)?.textContent.replace(/\s+/g,' ').trim() ?? null])),Object.keys(values));
    expect(actual).toEqual(values);
  } finally { await element.dispose(); }
  await page.locator('#show-database').click();
  await expect(page.locator('#database-workbench')).toBeVisible();
}
async function currentData(page) {
  await page.locator('#database-workbench [data-db-group="json"]').click();
  return JSON.parse(await page.locator('#data-json').inputValue());
}
async function stored(page) {
  return page.evaluate(()=>new Promise((resolve,reject)=> {
    const open = indexedDB.open('printform-studio-v3-demo-db',1); open.onerror = ()=>reject(open.error);
    open.onsuccess = ()=> { const db = open.result, request = db.transaction('datasets').objectStore('datasets').getAll(); request.onsuccess = ()=> { resolve(request.result); db.close(); }; request.onerror = ()=>reject(request.error); };
  }));
}
test.setTimeout(90000);
test.beforeEach(async({page})=> {
  page.on('dialog',dialog=>dialog.accept()); await page.goto('/studio-v3/'); await ready(page);
  await page.locator('[data-mode="data"]').click();
});
test('fictional CSV review explicitly converts typed fields, changes real print only on Apply, and survives undo and portable reopen',async({page},info)=> {
  const original = await currentData(page), records = await stored(page), revision = await page.locator('#revision').innerText();
  await file(page,'fictional-local.csv',csv);
  await expect(page.getByRole('heading',{name:'Review local CSV / JSON import'})).toBeVisible();
  await expect(action(page,'import-apply')).toBeDisabled();
  await action(page,'import-preview').click(); await expect(page.locator('#database-notice')).toContainText('Map at least one');
  await mapCSV(page); await action(page,'import-preview').click();
  await expect(page.getByRole('region',{name:'Reviewed import preview'})).toContainText('001.250');
  await expect(page.getByRole('region',{name:'Reviewed import preview'})).toContainText('00007');
  await expect(page.locator('#revision')).toHaveText(revision); expect(await stored(page)).toEqual(records);
  await expect(page.frameLocator('#preview-frame').locator('[data-v3-id="items-sku"]').first()).not.toHaveText('00007');
  await action(page,'import-apply').click(); await ready(page);
  await assertPrintedValues(page,{'items-sku':'00007'});
  const imported = await currentData(page);
  expect(imported.items.map(row=>row.sku)).toEqual(['00007','00008']); expect(imported.items[0]).toMatchObject({quantity:2,rate:1.25,amount:2.5});
  expect(imported.summary).toEqual(original.summary); expect(await stored(page)).toEqual(records);
  await page.locator('[data-action="undo"]').click(); await ready(page); expect(await currentData(page)).toEqual(original);
  await page.locator('[data-action="redo"]').click(); await ready(page); expect(await currentData(page)).toEqual(imported);
  const download = page.waitForEvent('download'); await page.locator('[data-action="save"]').click();
  const path = info.outputPath('fictional-local.printform.json'); await (await download).saveAs(path);
  const portable = JSON.parse(await fs.readFile(path,'utf8'));
  expect(portable.project.manifest.localImport.sourceText).toBe(csv);
  expect(portable.project.manifest.localImport.filename).toBe('fictional-local.csv');
  await action(page,'copy').click(); await ready(page);
  const saved = (await stored(page)).find(record=>record.localImport?.filename === 'fictional-local.csv');
  expect(saved.data.items).toEqual(imported.items); expect(saved.localImport.sourceText).toBe(csv);
  const chooser = page.waitForEvent('filechooser'); await page.locator('[data-action="open"]').click(); await (await chooser).setFiles(path); await ready(page);
  expect(await currentData(page)).toEqual(imported);
  await expect(page.locator('#database-workbench')).toContainText('local file: fictional-local.csv (unverified)');
  await page.screenshot({path:info.outputPath('local-import-reopened.png')});
});
test('plain JSON nested arrays preserve chosen-parent order and exact identifiers; malformed replacement and Cancel retain all data',async({page})=> {
  const original = await currentData(page), storedBefore = await stored(page);
  const json = '{"customer":"Fictional JSON customer","batches":[{"lines":[{"n":1,"id":9007199254740993,"description":"First exact JSON row","quantity":2,"rate":1.2500,"amount":2.5000},{"n":2,"id":"00009","description":"Second exact JSON row","quantity":3,"rate":2.0000,"amount":6.0000}]},{"lines":[{"id":"WRONG-PARENT"}]}]}';
  await file(page,'fictional-nested.json',json);
  await page.locator('#database-import-source').selectOption('/batches/0/lines');
  for (const [target,source,conversion] of [['/no','/n','number'],['/sku','/id','preserve'],['/description','/description','preserve'],['/quantity','/quantity','number'],['/rate','/rate','number'],['/amount','/amount','number']]) await map(page,target,source,conversion);
  await action(page,'import-preview').click();
  await expect(page.getByRole('region',{name:'Reviewed import preview'})).toContainText('9007199254740993');
  await expect(page.getByRole('region',{name:'Reviewed import preview'})).toContainText('1.2500');
  await file(page,'duplicate.csv','id, ID \n1,2');
  await expect(page.locator('#database-notice')).toContainText('duplicate');
  await expect(page.locator('#database-import-source')).toHaveValue('/batches/0/lines');
  await action(page,'import-cancel').click(); expect(await currentData(page)).toEqual(original); expect(await stored(page)).toEqual(storedBefore);
  await file(page,'fictional-nested.json',json); await page.locator('#database-import-source').selectOption('/batches/0/lines');
  for (const [target,source,conversion] of [['/no','/n','number'],['/sku','/id','preserve'],['/description','/description','preserve'],['/quantity','/quantity','number'],['/rate','/rate','number'],['/amount','/amount','number']]) await map(page,target,source,conversion);
  await action(page,'import-preview').click(); await action(page,'import-apply').click(); await ready(page);
  const nested = await currentData(page);
  expect(nested.items.map(row=>row.sku)).toEqual(['9007199254740993','00009']);
  expect(nested.items[0].rate).toBe(1.25); expect(nested.summary).toEqual(original.summary);
  await assertPrintedValues(page,{'items-sku':'9007199254740993'});
  await file(page,'fictional-header.json','{"customer":"Fictional JSON customer"}');
  await page.locator('#database-import-target').selectOption(''); await map(page,'/customer/name','/customer');
  await action(page,'import-preview').click(); await action(page,'import-apply').click(); await ready(page);
  expect((await currentData(page)).customer.name).toBe('Fictional JSON customer');
  expect((await currentData(page)).items).toEqual(nested.items); expect(await stored(page)).toEqual(storedBefore);
});
test('invalid UTF-8 is rejected before decoding can replace source identifiers',async({page})=> {
  const original = await currentData(page), records = await stored(page), revision = await page.locator('#revision').innerText();
  const statusBefore = await page.locator('#status').innerText();
  await file(page,'invalid-utf8.csv',Buffer.from([0x69,0x64,0x0a,0xc3,0x28,0x0a]));
  await expect(page.locator('#status')).not.toHaveText(statusBefore);
  await expect(page.getByRole('heading',{name:'Review local CSV / JSON import'})).toHaveCount(0);
  await expect(action(page,'import-apply')).toHaveCount(0);
  await expect(page.locator('#revision')).toHaveText(revision);
  expect(await currentData(page)).toEqual(original); expect(await stored(page)).toEqual(records);
});
async function openGeneral(page,project) {
  const chooser = page.waitForEvent('filechooser'); await page.locator('[data-action="open"]').click();
  await (await chooser).setFiles({name:'fictional-general.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(project))});
  await expect(page.locator('#document-name')).toHaveValue(project.manifest.title); await ready(page);
}
async function saveGeneral(page,info,name) {
  const download = page.waitForEvent('download'); await page.locator('[data-action="save"]').click();
  const path = info.outputPath(name); await (await download).saveAs(path);
  return {path,portable:JSON.parse(await fs.readFile(path,'utf8'))};
}
test('human-opened strict generic /records form imports exact string quantity without /items and exports real standalone HTML',async({page,context},info)=> {
  const fixture = generalImportProject(); await openGeneral(page,fixture);
  const original = await currentData(page), records = await stored(page);
  expect(original).not.toHaveProperty('items');
  await expect(action(page,'copy')).toBeDisabled(); await expect(action(page,'export')).toBeDisabled();
  await expect(page.locator('#database-compatibility')).toContainText('Save form / Open');
  const source = 'code,quantity,uom\n00009,-001.250,kg\n00007,0002.500,box\n';
  await file(page,'fictional-workshop.csv',source);
  await expect(page.locator('#database-import-target')).toHaveValue('/records');
  for (const key of ['code','quantity','uom']) await map(page,`/${key}`,`/${key}`);
  await action(page,'import-preview').click();
  await expect(page.getByRole('region',{name:'Reviewed import preview'})).toContainText('-001.250');
  await action(page,'import-apply').click(); await ready(page);
  const imported = await currentData(page);
  expect(imported.records).toEqual([{code:'00009',quantity:'-001.250',uom:'kg'},{code:'00007',quantity:'0002.500',uom:'box'}]);
  expect(imported.workOrder).toEqual(original.workOrder); expect(imported).not.toHaveProperty('items'); expect(await stored(page)).toEqual(records);
  await assertPrintedValues(page,{'items-quantity':'-001.250'});
  await page.locator('[data-action="undo"]').click(); await ready(page); expect(await currentData(page)).toEqual(original);
  await page.locator('[data-action="redo"]').click(); await ready(page);
  const {path,portable} = await saveGeneral(page,info,'generic-records.printform.json');
  expect(portable.project.schema).toEqual(fixture.schema); expect(portable.project.manifest.localImport.sourceText).toBe(source);
  const chooser = page.waitForEvent('filechooser'); await page.locator('[data-action="open"]').click(); await (await chooser).setFiles(path); await ready(page);
  expect(await currentData(page)).toEqual(imported);
  await expect(action(page,'copy')).toBeDisabled(); await expect(action(page,'export')).toBeDisabled();
  const exported = page.waitForEvent('download'); await page.locator('[data-action="export"]').click();
  const htmlPath = info.outputPath('generic-records.html'); await (await exported).saveAs(htmlPath);
  const printed = await context.newPage(); await printed.goto(pathToFileURL(htmlPath).href);
  await expect(printed.locator('html')).toHaveAttribute('data-printform-status','ready');
  await expect(printed.locator('[data-v3-id="items-quantity"]').first()).toHaveText('-001.250');
  await expect(printed.locator('[data-v3-id="items-code"]').first()).toHaveText('00009'); await printed.close();
});
test('human-opened no-table work order defaults to global fields, applies CSV then saves/reopens with no invented collection',async({page},info)=> {
  const fixture = generalImportProject(false); await openGeneral(page,fixture);
  await expect(page.locator('#right-panel .binding-error')).toHaveCount(0);
  const original = await currentData(page), storedBefore = await stored(page);
  const source = 'job,instruction,token\nWO-00042,Fictional supplied work instruction,000042\n';
  await file(page,'fictional-global.csv',source); await expect(page.locator('#database-import-target')).toHaveValue('');
  await map(page,'/workOrder/number','/job'); await map(page,'/workOrder/instruction','/instruction'); await map(page,'/media/token','/token');
  await action(page,'import-preview').click(); await action(page,'import-apply').click(); await ready(page);
  const imported = await currentData(page);
  expect(imported).toEqual({workOrder:{number:'WO-00042',instruction:'Fictional supplied work instruction',status:'Source draft'},media:{token:'000042'}});
  await assertPrintedValues(page,{'header-work-order':'WO-00042','footer-token':'000042'});
  await page.locator('[data-action="undo"]').click(); await ready(page); expect(await currentData(page)).toEqual(original);
  await page.locator('[data-action="redo"]').click(); await ready(page);
  const {path,portable} = await saveGeneral(page,info,'generic-work-order.printform.json');
  expect(portable.project.schema).toEqual(fixture.schema); expect(portable.project.manifest.localImport.sourceText).toBe(source);
  const chooser = page.waitForEvent('filechooser'); await page.locator('[data-action="open"]').click(); await (await chooser).setFiles(path); await ready(page);
  expect(await currentData(page)).toEqual(imported); expect(await stored(page)).toEqual(storedBefore);
  await expect(action(page,'copy')).toBeDisabled(); await expect(page.locator('#database-workbench')).not.toContainText('Repair it in Advanced JSON');
});
test('phone-sized no-table import keeps source selectors usable and applies the real reviewed source',async({page})=> {
  await page.setViewportSize({width:375,height:920});
  const fixture = generalImportProject(false); await openGeneral(page,fixture);
  await file(page,'fictional-phone.csv','job\nWO-PHONE-00042\n');
  const source = page.getByLabel('Source for /workOrder/number',{exact:true});
  const bounds = await source.evaluate(el=>({control:el.getBoundingClientRect().width,row:el.closest('tr').getBoundingClientRect().width}));
  expect(bounds.control).toBeGreaterThan(bounds.row*.8);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  await source.selectOption('/job'); await action(page,'import-preview').click();
  await expect(page.locator('#revision')).toHaveText('r0');
  await action(page,'import-apply').click(); await ready(page);
  await assertPrintedValues(page,{'header-work-order':'WO-PHONE-00042'});
  expect((await currentData(page)).workOrder).toEqual({...fixture.sampleData.workOrder,number:'WO-PHONE-00042'});
});
