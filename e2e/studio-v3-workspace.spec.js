import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const frame = page=>page.frameLocator('#preview-frame');
async function ready(page) {await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});}
async function edit(page,work) {const revision=await page.locator('#revision').innerText();await work();await expect(page.locator('#revision')).not.toHaveText(revision);await ready(page);}
async function saved(page,info,name) {
  const download=page.waitForEvent('download');await page.locator('[data-action=save]').click();const file=info.outputPath(name);await(await download).saveAs(file);return JSON.parse(await fs.readFile(file,'utf8'));
}
test.setTimeout(90000);
test.beforeEach(async ({page})=>{page.on('dialog',d=>d.accept());await page.goto('/studio-v3/');await ready(page);});

test('canvas fitting, zoom, panels, thumbnails, preview and current page affect no print geometry, data or revision',async({page},info)=>{
  const baseline=await saved(page,info,'before.printform.json'),revision=await page.locator('#revision').innerText();
  const geometry=()=>frame(page).locator('.printform_page').evaluateAll(ps=>ps.map(p=>({width:Math.round(p.getBoundingClientRect().width),height:Math.round(p.getBoundingClientRect().height),text:p.innerText})));
  const before=await geometry();
  await page.locator('#zoom').selectOption('width');
  const initialZoom=Number(await page.locator('#preview-frame').getAttribute('data-zoom'));
  await page.locator('[data-layout=structure]').first().click();await page.locator('[data-layout=properties]').first().click();
  await expect.poll(async()=>Number(await page.locator('#preview-frame').getAttribute('data-zoom'))).toBeGreaterThan(initialZoom);
  await page.locator('#zoom').selectOption('1');await expect(page.locator('#preview-frame')).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
  await page.locator('[data-layout=zoom-in]').click();await expect.poll(async()=>Number(await page.locator('#preview-frame').getAttribute('data-zoom'))).toBeGreaterThan(1);
  await page.locator('[data-layout=zoom-out]').click();await page.locator('#zoom').selectOption('fit');
  await page.locator('[data-action=next]').click();await expect(page.locator('#page-count')).toHaveText('Page 2 / 3');
  await page.locator('#paper-scroll').evaluate(n=>{n.scrollTop=n.scrollHeight;});await expect(page.locator('#page-count')).toHaveText('Page 3 / 3');
  await page.locator('[data-layout=thumbnails]').click();await expect(page.locator('#thumbnails')).toBeHidden();
  await page.locator('[data-layout=thumbnails]').click();await expect(page.locator('#thumbnails')).toBeVisible();
  await page.locator('[data-layout=structure]').first().click();await page.locator('[data-layout=properties]').first().click();await page.locator('#zoom').selectOption('width');
  const narrow=Number(await page.locator('#preview-frame').getAttribute('data-zoom'));
  await page.locator('[data-action=preview]').click();await expect.poll(async()=>Number(await page.locator('#preview-frame').getAttribute('data-zoom'))).toBeGreaterThan(narrow);
  await page.locator('[data-action=preview]').click();
  expect(await geometry()).toEqual(before);await expect(page.locator('#revision')).toHaveText(revision);
  expect(await saved(page,info,'after.printform.json')).toEqual(baseline);
  await page.screenshot({path:info.outputPath('canvas-fit-width.png')});
});

test('properties and binding are separate; picker paths, static text and truthful data provenance agree with print',async({page},info)=>{
  await expect(page.locator('#data-source')).toHaveText('Built-in demo · 45 rows');
  await expect(page.locator('body')).not.toContainText('Your supplied dataset');
  await page.locator('#left-panel [data-select=customer-bill]').click();
  await expect(page.getByLabel('Label',{exact:true})).toBeVisible();await expect(page.getByLabel('Data field (/field)',{exact:true})).toHaveCount(0);
  await page.locator('[data-action=binding]').click();await expect(page.getByLabel('Label',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Data field (/field)',{exact:true})).toHaveValue('/customer/name');
  await expect(page.locator('#right-panel')).toContainText('Current bound value');
  await page.getByLabel('Value source',{exact:true}).selectOption('static');await page.getByLabel('Static text',{exact:true}).fill('Fixed customer caption');
  await edit(page,()=>page.getByRole('button',{name:'Apply binding',exact:true}).click());
  await expect(frame(page).locator('[data-v3-id=customer-bill]').first()).toHaveText('Fixed customer caption');
  await page.getByLabel('Value source',{exact:true}).selectOption('bound');await expect(page.getByLabel('Data field (/field)',{exact:true})).toHaveValue('/customer/name');
  await page.getByLabel('Pick a data field',{exact:true}).selectOption('/customer/address');
  await expect(page.getByLabel('Data field (/field)',{exact:true})).toHaveValue('/customer/address');
  await edit(page,()=>page.getByRole('button',{name:'Apply binding',exact:true}).click());
  await expect(frame(page).locator('[data-v3-id=customer-bill]').first()).toContainText('455 Western Avenue');
  await page.locator('[data-action=properties]').click();await page.locator('#left-panel [data-select=items-sku]').click();await page.locator('[data-action=binding]').click();
  await page.getByLabel('Pick a data field',{exact:true}).selectOption('./quantity');await expect(page.getByLabel('Row field (./field)',{exact:true})).toHaveValue('./quantity');
  await edit(page,()=>page.getByRole('button',{name:'Apply binding',exact:true}).click());
  await expect(frame(page).locator('.prowitem_processed').first().locator('td').nth(1)).toHaveText('2');
  await page.locator('[data-mode=data]').click();await page.locator('#database-workbench [data-db-group=json]').click();
  const data=JSON.parse(await page.locator('#data-json').inputValue());data.items=data.items.slice(0,2);data.company.name='Imported fixture company';
  await page.locator('#data-json').fill(JSON.stringify(data));await edit(page,()=>page.getByRole('button',{name:'Apply JSON data',exact:true}).click());
  await expect(page.locator('#data-source')).toHaveText('Imported data · 2 rows');
  await edit(page,()=>page.locator('[data-sample="1"]').click());await expect(page.locator('#data-source')).toHaveText('Validation sample · Single item · 1 rows');
  await edit(page,()=>page.locator('[data-sample=erp]').click());await expect(page.locator('#data-source')).toHaveText('Imported data · 2 rows');
  await expect(frame(page).locator('[data-v3-id=header-company]').first()).toHaveText('Imported fixture company');
  await page.screenshot({path:info.outputPath('wide-json-source.png')});
});

test('required viewports support visible modes, structure search/folding, drawers, focus and canvas-only pan',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [width,height] of [[1366,768],[1440,900],[768,1024],[390,844],[430,932]]) {
    await page.setViewportSize({width,height});
    await page.locator('[data-mode=design]').click();
    if(width<=900) await page.locator('[data-layout=structure]').first().click();
    await page.getByLabel('Search structure',{exact:true}).fill('Qty');
    await expect(page.locator('#left-panel [data-select=items-quantity]')).toBeVisible();
    await expect(page.locator('#left-panel [data-select=customer-bill]')).toBeHidden();
    await page.getByLabel('Search structure',{exact:true}).fill('');
    await page.locator('[data-fold=customer]').click();await expect(page.locator('#left-panel [data-select=customer-bill]')).toBeHidden();
    await page.locator('[data-fold=customer]').click();await expect(page.locator('#left-panel [data-select=customer-bill]')).toBeVisible();
    await page.locator('#left-panel [data-select=items-sku]').click();
    await expect(page.getByLabel('Label',{exact:true})).toBeVisible();
    await page.getByLabel('Label',{exact:true}).fill(`Stock code ${width}`);
    await edit(page,()=>page.getByRole('button',{name:'Apply field',exact:true}).click());
    await page.screenshot({path:info.outputPath(`design-properties-${width}x${height}.png`)});
    if(width<=900) {
      await page.locator('#right-panel [data-layout=close]').click();await expect(page.locator('#right-panel')).toBeHidden();
      await expect(page.locator('[data-layout=properties]').first()).toBeFocused();
      await page.locator('[data-layout=properties]').first().click();await page.keyboard.press('Escape');await expect(page.locator('#right-panel')).toBeHidden();
    }
    await page.locator('#zoom').selectOption('1');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(width<794) expect(await page.locator('#paper-scroll').evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(true);
    await page.locator('#zoom').selectOption('width');
    await page.screenshot({path:info.outputPath(`canvas-${width}x${height}.png`)});
    for(const mode of ['data','validate','design']) {await page.locator(`[data-mode=${mode}]`).click();await expect(page.locator(`[data-mode=${mode}]`)).toHaveAttribute('aria-current','page');}
  }
  expect(errors).toEqual([]);
});


test('database actions protect unapplied binding edits while keeping table save explicit',async({page})=>{
  await page.locator('#left-panel [data-select=customer-bill]').click();await page.locator('[data-mode=data]').click();
  await page.getByLabel('Data field (/field)',{exact:true}).fill('/customer/address');
  await page.locator('[data-db-group=customer]').click();await page.locator('[data-draft-choice=stay]').click();
  await expect(page.getByLabel('Data field (/field)',{exact:true})).toHaveValue('/customer/address');
  await page.locator('[data-db-action=copy]').click();await expect(page.locator('#draft-dialog')).toBeVisible();
  await page.locator('[data-draft-choice=apply]').click();await ready(page);
  await expect(frame(page).locator('[data-v3-id=customer-bill]').first()).toContainText('455 Western Avenue');
  await expect(page.locator('#database-notice')).toContainText('Dataset saved locally');
  await expect(page.locator('#draft-state')).toHaveText('No unapplied edits');
});
