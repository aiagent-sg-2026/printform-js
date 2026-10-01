import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const frame = page => page.frameLocator('#preview-frame');
const button = (page,name) => page.locator(`[data-db-action=${name}]`).filter({visible:true}).first();
async function ready(page) { await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000}); }
async function records(page) {
  return page.evaluate(() => new Promise((resolve,reject) => {
    const open = indexedDB.open('printform-studio-v3-demo-db',1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('datasets'), request = tx.objectStore('datasets').getAll();
      request.onsuccess = () => { resolve(request.result); db.close(); };
    };
  }));
}
async function enter(page,group='items') {
  await page.locator('[data-mode=data]').click();
  await page.locator(`#database-workbench nav [data-db-group=${group}]`).click();
  await expect(page.locator('#database-workbench')).toBeVisible();
}
async function save(page,copy=false) {
  const before = await page.locator('#revision').innerText();
  await button(page,copy ? 'copy' : 'save').click();
  await expect(page.locator('#revision')).not.toHaveText(before); await ready(page);
  await expect(page.locator('#db-draft-status')).toHaveText('Form matches saved dataset');
}
async function newForm(page,type) {
  await page.locator('[data-action=new]').click(); await page.locator(`[data-template=${type}]`).click(); await ready(page);
}
test.setTimeout(90000);
test.beforeEach(async ({page}) => {
  page.on('dialog',d=>d.accept()); await page.goto('/studio-v3/'); await ready(page);
});

test('visible database edits persist, retain supplied totals, undo only form and match exported print', async ({page,context,browserName},info) => {
  await enter(page,'customer');
  await expect(page.locator('#database-workbench')).toContainText('IndexedDB · browser-local');
  await page.getByLabel('/customer/name',{exact:true}).fill('Client demo / 用户客户');
  await page.locator('#database-name').fill('Client invoice');
  await page.locator('[data-db-group=items]').click();
  await page.getByLabel('/items/0/quantity',{exact:true}).fill('9');
  await page.getByLabel('/items/0/rate',{exact:true}).fill('999');
  await expect(page.getByLabel('/items/0/amount',{exact:true})).toHaveValue('250');
  await button(page,'add-row').click();
  await expect(page.getByLabel('/items/45/amount',{exact:true})).toHaveValue('0');
  await page.locator('[data-db-action=delete-row][data-row="45"]').click();
  await page.locator('[data-db-group=summary]').click();
  await page.getByLabel('/summary/total',{exact:true}).fill('12001');
  await expect(frame(page).locator('[data-v3-id=customer-bill]').first()).toHaveText('Sterling Manufacturing Sdn. Bhd.');
  await save(page,true);
  await expect(frame(page).locator('[data-v3-id=customer-bill]').first()).toHaveText('Client demo / 用户客户');
  await expect(frame(page).locator('[data-v3-id=totals-total]')).toContainText('12,001');
  const saved = (await records(page)).find(r=>r.title === 'Client invoice');
  expect(saved.data.items[0]).toMatchObject({quantity:9,rate:999,amount:250});
  expect(saved.data.items).toHaveLength(45);
  await page.locator('[data-action=undo]').click(); await ready(page);
  await expect(frame(page).locator('[data-v3-id=customer-bill]').first()).toHaveText('Sterling Manufacturing Sdn. Bhd.');
  expect((await records(page)).find(r=>r.id === saved.id).data.summary.total).toBe(12001);
  await page.locator('[data-action=redo]').click(); await ready(page);
  await page.reload(); await ready(page); await enter(page,'summary');
  await expect(page.getByLabel('/summary/total',{exact:true})).toHaveValue('12001');
  const preview = await frame(page).locator('.printform_page').evaluateAll(ps=>ps.map(p=>({text:p.innerText.replace(/\s+/g,' ').trim(),rows:[...p.querySelectorAll('.prowitem_processed')].map(r=>r.dataset.pfRowIndex)})));
  const promise = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const filename = info.outputPath('database-invoice.html'); await (await promise).saveAs(filename);
  const printed = await context.newPage(); await printed.goto(pathToFileURL(filename).href);
  await expect(printed.locator('html')).toHaveAttribute('data-printform-status','ready');
  const output = await printed.locator('.printform_page').evaluateAll(ps=>ps.map(p=>({text:p.innerText.replace(/\s+/g,' ').trim(),rows:[...p.querySelectorAll('.prowitem_processed')].map(r=>r.dataset.pfRowIndex)})));
  expect(output).toEqual(preview);
  if (browserName === 'chromium') await printed.pdf({path:info.outputPath('database-invoice-A4.pdf'),preferCSSPageSize:true,printBackground:true});
  await page.screenshot({path:info.outputPath('database-table.png')});
  await fs.writeFile(info.outputPath('database-record.json'),JSON.stringify(saved,null,2));
});

test('advanced JSON and existing form imports remain drafts; datasets are isolated by document type', async ({page},info) => {
  await enter(page,'customer'); const original = await records(page);
  await page.locator('#database-workbench [data-db-group=json]').click();
  const data = JSON.parse(await page.locator('#data-json').inputValue()); data.customer.name = 'Imported existing ERP';
  await page.locator('#data-json').fill(JSON.stringify(data));
  await page.getByRole('button',{name:'Apply JSON data',exact:true}).click(); await ready(page);
  await expect(page.locator('#db-draft-status')).toContainText('not saved');
  expect((await records(page)).find(r=>r.id === 'starter:invoice').data.customer.name).toBe('Sterling Manufacturing Sdn. Bhd.');
  await page.locator('#database-name').fill('Imported invoice'); await save(page,true);
  const savePromise = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const file = info.outputPath('existing.printform.json'); await (await savePromise).saveAs(file);
  await newForm(page,'purchase'); await enter(page,'customer');
  await expect(page.getByLabel('/customer/name',{exact:true})).toHaveValue('Sterling Manufacturing Sdn. Bhd.');
  await page.getByLabel('/customer/name',{exact:true}).fill('PO supplier'); await page.locator('#database-name').fill('PO database'); await save(page,true);
  await newForm(page,'invoice'); await enter(page,'customer');
  await expect(page.getByLabel('/customer/name',{exact:true})).toHaveValue('Imported existing ERP');
  const chooser = page.waitForEvent('filechooser'); await page.locator('[data-action=open]').click(); await (await chooser).setFiles(file); await ready(page);
  await expect(page.locator('#db-draft-status')).toContainText('not saved');
  expect((await records(page)).filter(r=>r.type === 'purchase').find(r=>r.title === 'PO database').data.customer.name).toBe('PO supplier');
  for (const record of original) expect((await records(page)).find(r=>r.id === record.id).data).toEqual(record.data);
});

test('cross-tab stale writes are blocked and reset retains drafts, saved copies and unrelated storage', async ({page,context}) => {
  await enter(page,'customer'); const second = await context.newPage(); second.on('dialog',d=>d.accept()); await second.goto('/studio-v3/'); await ready(second); await enter(second,'customer');
  await second.getByLabel('/customer/name',{exact:true}).fill('Stale second-tab edit');
  await page.getByLabel('/customer/name',{exact:true}).fill('First-tab customer'); await save(page);
  await button(second,'save').click();
  await expect(second.locator('#database-notice')).toContainText('Saved dataset changed');
  await expect(second.getByLabel('/customer/name',{exact:true})).toHaveValue('Stale second-tab edit');
  await expect(frame(second).locator('[data-v3-id=customer-bill]').first()).toHaveText('Sterling Manufacturing Sdn. Bhd.');
  expect((await records(page)).find(r=>r.id === 'starter:invoice').data.customer.name).toBe('First-tab customer');
  await page.locator('#database-name').fill('Preserved copy'); await save(page,true);
  await page.evaluate(async()=>{
    localStorage.setItem('unrelated-owner-setting','keep');
    await new Promise(resolve=>{const request=indexedDB.open('unrelated-owner-demo',1);request.onupgradeneeded=()=>request.result.createObjectStore('settings');request.onsuccess=()=>{const db=request.result,tx=db.transaction('settings','readwrite');tx.objectStore('settings').put('keep','owner');tx.oncomplete=()=>{db.close();resolve();};};});
  });
  await button(page,'reset').click();
  await expect(page.locator('#database-notice')).toContainText('Starter records restored');
  const result = await records(page);
  expect(result.find(r=>r.id === 'starter:invoice').data.customer.name).toBe('Sterling Manufacturing Sdn. Bhd.');
  expect(result.find(r=>r.title === 'Preserved copy').data.customer.name).toBe('First-tab customer');
  await expect(frame(page).locator('[data-v3-id=customer-bill]').first()).toHaveText('First-tab customer');
  expect(await page.evaluate(()=>localStorage.getItem('unrelated-owner-setting'))).toBe('keep');
  expect(await page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('unrelated-owner-demo');request.onsuccess=()=>{const db=request.result,r=db.transaction('settings').objectStore('settings').get('owner');r.onsuccess=()=>{resolve(r.result);db.close();};};}))).toBe('keep');
  await second.close();
});

test('dataset import/export, deletion persistence, reset cancellation and mobile/tablet editor', async ({page},info) => {
  await enter(page,'customer'); await page.getByLabel('/customer/name',{exact:true}).fill('Exported dataset');
  await page.locator('#database-name').fill('Round trip'); await save(page,true);
  const download = page.waitForEvent('download'); await button(page,'export').click();
  const datasetFile = info.outputPath('dataset.json'); await (await download).saveAs(datasetFile);
  const count = (await records(page)).length;
  const chooser = page.waitForEvent('filechooser'); await button(page,'import').click(); await (await chooser).setFiles(datasetFile); await ready(page);
  await expect.poll(async()=> (await records(page)).length).toBe(count+1);
  await button(page,'delete').click(); await ready(page);
  expect((await records(page)).length).toBe(count);
  await page.reload(); await ready(page); await enter(page,'customer');
  expect((await records(page)).length).toBe(count);
  page.removeAllListeners('dialog'); page.once('dialog',d=>d.dismiss()); const before = await records(page); await button(page,'reset').click();
  expect(await records(page)).toEqual(before); page.on('dialog',d=>d.accept());
  for (const width of [820,390]) {
    await page.setViewportSize({width,height:980}); await enter(page,'customer');
    await page.getByLabel('/customer/name',{exact:true}).fill(`Client width ${width}`); await save(page,true);
    await expect(frame(page).locator('[data-v3-id=customer-bill]').first()).toHaveText(`Client width ${width}`);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`database-width-${width}.png`)});
    await button(page,'preview').click(); await expect(page.locator('#database-workbench')).toBeHidden();
    await page.locator('#show-database').click(); await expect(page.locator('#database-workbench')).toBeVisible();
  }
});

test('dataset name Apply/Discard/Stay retains metadata until explicit save and survives form reopening',async({page},info)=>{
  await enter(page,'customer');const initial=await page.locator('#database-name').inputValue();
  await page.locator('#database-name').fill('Portable renamed dataset');await page.locator('[data-mode=design]').click();
  await page.locator('[data-draft-choice=stay]').click();await expect(page.locator('#database-name')).toHaveValue('Portable renamed dataset');await expect(page.locator('#database-name')).toBeFocused();
  await page.locator('[data-mode=design]').click();await page.locator('[data-draft-choice=apply]').click();await ready(page);
  expect((await records(page)).find(r=>r.id==='starter:invoice').title).toBe(initial);
  await page.locator('[data-action=undo]').click();await ready(page);await enter(page,'customer');await expect(page.locator('#database-name')).toHaveValue(initial);
  await page.locator('[data-action=redo]').click();await ready(page);await expect(page.locator('#database-name')).toHaveValue('Portable renamed dataset');
  await save(page);expect((await records(page)).find(r=>r.id==='starter:invoice').title).toBe('Portable renamed dataset');
  await page.reload();await ready(page);await enter(page,'customer');await expect(page.locator('#database-name')).toHaveValue('Portable renamed dataset');
  await page.locator('#database-name').fill('Discarded name');await page.locator('[data-mode=design]').click();await page.locator('[data-draft-choice=discard]').click();
  await enter(page,'customer');await expect(page.locator('#database-name')).toHaveValue('Portable renamed dataset');
  await page.locator('#database-name').fill('Applied file-only name');await page.locator('[data-mode=design]').click();await page.locator('[data-draft-choice=apply]').click();await ready(page);
  const pending=page.waitForEvent('download');await page.locator('[data-action=save]').click();const file=info.outputPath('named-dataset.printform.json');await(await pending).saveAs(file);
  await page.locator('[data-action=new]').click();await page.locator('[data-template=delivery]').click();await ready(page);
  const chooser=page.waitForEvent('filechooser');await page.locator('[data-action=open]').click();await(await chooser).setFiles(file);await ready(page);await enter(page,'customer');
  await expect(page.locator('#database-name')).toHaveValue('Applied file-only name');await expect(button(page,'save')).toBeDisabled();
  expect((await records(page)).find(r=>r.id==='starter:invoice').title).toBe('Portable renamed dataset');
});

test('custom numeric errors block navigation Apply and survive another-row deletion before Save',async({page})=>{
  await enter(page,'json');const data=JSON.parse(await page.locator('#data-json').inputValue());data.items[0].weight=5;data.items[1].weight=6;
  await page.locator('#data-json').fill(JSON.stringify(data));await page.getByRole('button',{name:'Apply JSON data',exact:true}).click();await ready(page);
  await enter(page,'items');await save(page,true);await page.getByLabel('/items/1/weight',{exact:true}).fill('');
  const revision=await page.locator('#revision').innerText();await page.locator('[data-mode=design]').click();await page.locator('[data-draft-choice=apply]').click();
  await expect(page.locator('[data-mode=data]')).toHaveAttribute('aria-current','page');await expect(page.locator('#database-notice')).toContainText('/items/1/weight');await expect(page.locator('#revision')).toHaveText(revision);
  await page.getByRole('button',{name:'Delete 1',exact:true}).click();await expect(page.locator('#database-notice')).toContainText('/items/0/weight');
  await expect(page.getByLabel('/items/0/weight',{exact:true})).toHaveAttribute('type','number');
  await button(page,'save').click();await expect(page.locator('#database-notice')).toContainText('/items/0/weight');await expect(page.locator('#revision')).toHaveText(revision);
  await page.getByLabel('/items/0/weight',{exact:true}).fill('8');await save(page);
  const saved=await records(page);expect(saved.find(r=>r.data.items.length===44).data.items[0].weight).toBe(8);
});
