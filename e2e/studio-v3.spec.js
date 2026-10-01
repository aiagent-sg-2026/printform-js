import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const frame = page => page.frameLocator('#preview-frame');
test.setTimeout(90000);
async function ready(page) { await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000}); }
async function revisionEdit(page, operation) {
  const before = await page.locator('#revision').textContent();
  await operation();
  await expect(page.locator('#revision')).not.toHaveText(before);
}
async function sample(page, id) {
  await revisionEdit(page,() => page.locator(`[data-sample="${id}"]`).click());
  await ready(page);
  await expect(frame(page).locator('.prowitem_processed')).toHaveCount(id === 'long' ? 45 : Number(id));
}
async function newForm(page,type) {
  await page.locator('[data-action=new]').click();
  await page.locator(`[data-template=${type}]`).click();
  await ready(page);
}
async function openJSON(page) { await page.locator('[data-mode=data]').click(); await page.locator('#database-workbench [data-db-group=json]').click(); }
test.beforeEach(async ({page}) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/studio-v3/');
  await ready(page);
});

test('fresh blank -> structure -> bind -> save -> reopen -> validate -> export', async ({page,context,browserName}, info) => {
  const errors = []; page.on('pageerror',e => errors.push(e.message));
  await newForm(page,'blank');
  await expect(frame(page).locator('.prowitem_processed')).toHaveCount(0);
  for (const id of ['header','customer','items','totals','footer']) {
    await page.locator(`#left-panel [data-select=${id}]`).click();
    await page.getByLabel('Show section',{exact:true}).check();
    if (id === 'header') await page.getByLabel('Document heading',{exact:true}).fill('ACME INVOICE');
    await revisionEdit(page,() => page.getByRole('button',{name:'Apply section',exact:true}).click());
    await ready(page);
  }
  await page.locator('#left-panel [data-select=items-description]').click();
  await page.getByLabel('Label',{exact:true}).fill('Item / 项目');
  await revisionEdit(page,() => page.getByRole('button',{name:'Apply field',exact:true}).click()); await ready(page);
  await page.locator('[data-action=binding]').click();
  await page.getByLabel('Row field (./field)',{exact:true}).fill('./description');
  await revisionEdit(page,() => page.getByRole('button',{name:'Apply binding',exact:true}).click());
  await ready(page);
  await expect(frame(page).locator('.prowheader_processed th').first()).toHaveText('#');
  await page.locator('#document-name').fill('My invoice'); await page.locator('#document-name').press('Tab');
  await expect(page.locator('#revision')).toContainText('unsaved');
  await ready(page);
  const savedPromise = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const saved = await savedPromise; const savePath = info.outputPath('editable-invoice.printform.json'); await saved.saveAs(savePath);
  const savedData = JSON.parse(await fs.readFile(savePath,'utf8'));
  expect(savedData.project.manifest.studioV3.columns[2].label).toBe('Item / 项目');
  await newForm(page,'purchase');
  const chooserPromise = page.waitForEvent('filechooser'); await page.locator('[data-action=open]').click();
  await (await chooserPromise).setFiles(savePath);
  await expect(page.locator('#document-name')).toHaveValue('My invoice'); await ready(page);
  await expect(frame(page).locator('h1').first()).toHaveText('ACME INVOICE');
  await page.locator('[data-mode=validate]').click();
  await expect(page.locator('#right-panel')).toContainText('Current browser layout passed.');
  const preview = await frame(page).locator('.printform_page').evaluateAll(pages => pages.map(p => ({text:p.innerText.replace(/\s+/g,' ').trim(),rows:[...p.querySelectorAll('.prowitem_processed')].map(r=>r.dataset.pfRowIndex),width:Math.round(p.getBoundingClientRect().width),height:Math.round(p.getBoundingClientRect().height)})));
  const exportPromise = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const exported = await exportPromise; const htmlPath = info.outputPath('invoice.html'); await exported.saveAs(htmlPath);
  const html = await fs.readFile(htmlPath,'utf8');
  expect(html).not.toContain('data-v3-selection');
  expect(html.includes("connect-src 'none'")).toBe(true);
  const printPage = await context.newPage(); await printPage.goto(pathToFileURL(htmlPath).href);
  await expect(printPage.locator('html')).toHaveAttribute('data-printform-status','ready');
  const output = await printPage.locator('.printform_page').evaluateAll(pages => pages.map(p => ({text:p.innerText.replace(/\s+/g,' ').trim(),rows:[...p.querySelectorAll('.prowitem_processed')].map(r=>r.dataset.pfRowIndex),width:Math.round(p.getBoundingClientRect().width),height:Math.round(p.getBoundingClientRect().height)})));
  expect(output).toEqual(preview);
  if (browserName === 'chromium') await printPage.pdf({path:info.outputPath('invoice-a4.pdf'),preferCSSPageSize:true,printBackground:true});
  await page.screenshot({path:info.outputPath('validated-invoice.png')});
  await printPage.screenshot({path:info.outputPath('printable-invoice.png'),fullPage:true});
  expect(errors).toEqual([]);
});

for (const type of ['invoice','purchase','delivery']) {
  test(`${type}: measured pagination for 0/1/45/100/500 rows and long bilingual content`, async ({page},info) => {
    await newForm(page,type); await page.locator('[data-mode=validate]').click();
    const evidence = [];
    for (const id of ['0','1','45','100','500','long']) {
      await sample(page,id);
      const result = await frame(page).locator('.printform_page').evaluateAll(pages => ({pageCount:pages.length,rows:pages.flatMap(p=>[...p.querySelectorAll('.prowitem_processed')].map(r=>Number(r.dataset.pfRowIndex))),headers:pages.map(p=>p.querySelectorAll('.pheader_processed').length),tableHeaders:pages.map(p=>p.querySelectorAll('.prowheader_processed').length),footers:pages.map(p=>p.querySelectorAll('.pfooter_pagenum_processed').length)}));
      expect(result.rows).toEqual(Array.from({length:id === 'long' ? 45 : Number(id)},(_,i)=>i));
      expect(result.headers.every(n=>n===1)).toBe(true);
      expect(result.footers.every(n=>n===1)).toBe(true);
      const pagesWithRows = await frame(page).locator('.printform_page').evaluateAll(ps=>ps.filter(p=>p.querySelector('.prowitem_processed')).map(p=>!!p.querySelector('.prowheader_processed')));
      expect(pagesWithRows.every(Boolean)).toBe(true);
      await expect(page.locator('#right-panel')).toContainText('Current browser layout passed.');
      evidence.push({sample:id,...result});
    }
    expect(evidence.find(e=>e.sample==='long').pageCount).toBeGreaterThan(evidence.find(e=>e.sample==='45').pageCount);
    await fs.writeFile(info.outputPath(`${type}-pagination.json`),JSON.stringify(evidence,null,2));
    await page.screenshot({path:info.outputPath(`${type}-bilingual.png`)});
  });
}

test('data errors recover; malicious text stays inert; data remains isolated between tabs', async ({page,context}) => {
  const outbound = []; page.on('request',r=> { if (/^https?:/.test(r.url()) && new URL(r.url()).hostname !== '127.0.0.1') outbound.push(r.url()); });
  await openJSON(page);
  const original = JSON.parse(await page.locator('#data-json').inputValue());
  const hostile = structuredClone(original);
  hostile.company.name = '<img src=x onerror="window.leaked=1">';
  hostile.items[0].description = '<script>window.leaked=1</script></body>';
  delete hostile.items[1].description;
  await page.locator('#data-json').fill(JSON.stringify(hostile));
  await revisionEdit(page,() => page.getByRole('button',{name:'Apply JSON data',exact:true}).click());
  await expect(page.locator('[data-action=export]')).toBeDisabled();
  await expect(page.locator('#right-panel details.quality-panel')).toContainText('/items/1/description');
  hostile.items[1].description = 'Recovered field';
  await page.locator('#data-json').fill(JSON.stringify(hostile));
  await revisionEdit(page,() => page.getByRole('button',{name:'Apply JSON data',exact:true}).click()); await ready(page);
  await expect(frame(page).locator('[data-v3-id=header-company]').first()).toHaveText(hostile.company.name);
  expect(await frame(page).locator('img').count()).toBe(0);
  const isolated = await context.newPage(); await isolated.goto('/studio-v3/'); await ready(isolated);
  await expect(frame(isolated).locator('[data-v3-id=header-company]').first()).toHaveText('ACME Industrial Supply');
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('v3')))).toEqual([]);
  await sample(page,'1');
  await revisionEdit(page,()=>page.locator('[data-sample=erp]').click()); await ready(page);
  await expect(frame(page).locator('[data-v3-id=header-company]').first()).toHaveText(hostile.company.name);
  expect(outbound).toEqual([]);
  const invalid = {...hostile,items:[{...hostile.items[0],description:'Oversized description '.repeat(2500)}]};
  await page.locator('#data-json').fill(JSON.stringify(invalid));
  await revisionEdit(page,() => page.getByRole('button',{name:'Apply JSON data',exact:true}).click());
  await expect(page.locator('#page-count')).toHaveText('Render blocked');
  await expect(page.locator('[data-action=export]')).toBeDisabled();
});

test('undo/redo, column operations, repeat header, explicit break and interrupted validation', async ({page}) => {
  await page.locator('#left-panel [data-select=items-description]').click();
  await page.getByLabel('Label',{exact:true}).fill('Description revised');
  await revisionEdit(page,() => page.getByRole('button',{name:'Apply field',exact:true}).click()); await ready(page);
  await page.locator('[data-action=undo]').focus(); await page.keyboard.press(process.platform==='darwin'?'Meta+z':'Control+z');
  await expect(page.locator('#left-panel')).not.toContainText('Description revised'); await ready(page);
  await page.keyboard.press(process.platform==='darwin'?'Meta+Shift+z':'Control+Shift+z');
  await expect(page.locator('#left-panel')).toContainText('Description revised'); await ready(page);
  await revisionEdit(page,() => page.getByRole('button',{name:'Up',exact:true}).click()); await ready(page);
  await expect(frame(page).locator('.prowheader_processed').first().locator('th').nth(1)).toHaveText('Description revised');
  await revisionEdit(page,() => page.getByRole('button',{name:'Remove',exact:true}).click()); await ready(page);
  await page.locator('#left-panel [data-select=items]').click();
  await page.getByLabel('Page break before items',{exact:true}).check();
  await page.getByLabel('Repeat table header',{exact:true}).uncheck();
  await revisionEdit(page,() => page.getByRole('button',{name:'Apply section',exact:true}).click()); await ready(page);
  await expect(frame(page).locator('.prowitem_processed')).toHaveCount(45);
  expect(await frame(page).locator('.printform_page').count()).toBeLessThan(10);
  await page.locator('[data-mode=validate]').click();
  await page.getByRole('button',{name:'Run all synthetic samples',exact:true}).click();
  await page.locator('[data-action=new]').click();
  await page.locator('[data-template=delivery]').click(); await ready(page);
  await expect(frame(page).locator('h1').first()).toHaveText('DELIVERY NOTE');
  await expect(frame(page).locator('.prowitem_processed')).toHaveCount(45);
  await expect(page.locator('#right-panel')).toContainText('Not checked');
});

test('desktop/tablet editing, mobile preview, keyboard focus and back navigation', async ({page},info) => {
  for (const width of [1440,820,390]) {
    await page.setViewportSize({width,height:980});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('#preview-frame')).toBeVisible();
    await page.screenshot({path:info.outputPath(`viewport-${width}.png`)});
    if (width===820) {
      await page.locator('[data-layout=structure]').first().click();
      await page.locator('#left-panel [data-select=header]').click();
      await page.getByLabel('Document heading',{exact:true}).fill('TABLET INVOICE');
      await revisionEdit(page,()=>page.getByRole('button',{name:'Apply section',exact:true}).click()); await ready(page);
      await expect(frame(page).locator('h1').first()).toHaveText('TABLET INVOICE');
    }
    if (width===390) await expect(page.locator('#left-panel')).toBeHidden();
  }
  await page.setViewportSize({width:1440,height:980});
  await page.locator('[data-action=new]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#new-dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#new-dialog')).toBeHidden();
  await expect(page.locator('[data-action=new]')).toBeFocused();
  await page.goto('/studio-v2/'); await page.goBack(); await ready(page);
  await expect(page.locator('[data-action=export]')).toBeEnabled();
});

test('remaining authoring controls, completed matrix, page navigation and HTML reopening', async ({page},info) => {
  await page.locator('#left-panel [data-select=header-company]').click();
  await page.locator('[data-action=binding]').click(); await page.getByLabel('Value source',{exact:true}).selectOption('static');
  await page.getByLabel('Static text',{exact:true}).fill('My own company');
  await revisionEdit(page,()=>page.getByRole('button',{name:'Apply binding',exact:true}).click()); await ready(page);
  await expect(frame(page).locator('[data-v3-id=header-company]').first()).toHaveText('My own company');
  await revisionEdit(page,()=>page.locator('#left-panel [data-action=add-field]').click()); await ready(page);
  await page.locator('[data-action=properties]').click();
  await page.getByLabel('Label',{exact:true}).fill('Contact');
  await revisionEdit(page,()=>page.getByRole('button',{name:'Apply field',exact:true}).click()); await ready(page);
  await page.locator('[data-action=binding]').click(); await page.getByLabel('Static text',{exact:true}).fill('Contact info');
  await revisionEdit(page,()=>page.getByRole('button',{name:'Apply binding',exact:true}).click()); await ready(page);
  await expect(frame(page).locator('.company-fields').first()).toContainText('Contact info');
  await page.locator('#left-panel [data-action=go-style]').click();
  await page.getByLabel('Brand color',{exact:true}).fill('#174180');
  await page.getByLabel('Font size (pt)',{exact:true}).fill('10');
  await page.getByLabel('Cell padding (px)',{exact:true}).fill('5');
  await page.getByLabel('Alternate item rows',{exact:true}).uncheck();
  await revisionEdit(page,()=>page.getByRole('button',{name:'Apply style',exact:true}).click()); await ready(page);
  await page.locator('[data-mode=data]').click();
  await page.locator('#right-panel summary').filter({hasText:'Locale & currency'}).click();
  await page.getByRole('combobox',{name:'Locale',exact:true}).selectOption('zh-CN');
  await page.getByRole('combobox',{name:'Currency',exact:true}).selectOption('USD');
  await revisionEdit(page,()=>page.getByRole('button',{name:'Apply locale',exact:true}).click()); await ready(page);
  await expect(frame(page).locator('html')).toHaveAttribute('lang','zh-CN');
  await page.locator('[data-db-action=preview]').click();
  await page.locator('#zoom').selectOption('0.75');
  await expect(page.locator('#preview-frame')).toHaveCSS('transform','matrix(0.75, 0, 0, 0.75, 0, 0)');
  await page.locator('#thumbnails [data-page="1"]').click();
  expect(await page.locator('#paper-scroll').evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
  await page.locator('[data-action=previous]').click();
  expect(await page.locator('#paper-scroll').evaluate(n=>n.scrollTop)).toBeLessThan(20);
  await page.locator('[data-mode=validate]').click();
  await page.getByRole('button',{name:'Run all synthetic samples',exact:true}).click();
  await expect(page.getByRole('button',{name:'Run all synthetic samples',exact:true})).toBeVisible({timeout:45000}); await ready(page);
  await expect(page.locator('#right-panel')).not.toContainText('Not checked');
  const downloadPromise = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const exported = await downloadPromise, file = info.outputPath('custom.html'); await exported.saveAs(file);
  const chooser = page.waitForEvent('filechooser'); await page.locator('[data-action=open]').click(); await (await chooser).setFiles(file); await ready(page);
  await expect(frame(page).locator('[data-v3-id=header-company]').first()).toHaveText('My own company');
  await expect(frame(page).locator('html')).toHaveAttribute('lang','zh-CN');
  await page.locator('[data-action=preview]').click();
  await expect(page.locator('#left-panel')).toBeHidden();
  await page.locator('[data-action=preview]').click(); await expect(page.locator('#left-panel')).toBeVisible();
});

test('ERP import and sample selection remain coherent through undo/redo and multiple imports', async ({page}) => {
  await openJSON(page);
  const initial = JSON.parse(await page.locator('#data-json').inputValue());
  const apply = async name => {
    const data = structuredClone(initial); data.company.name = name;
    await page.locator('#data-json').fill(JSON.stringify(data));
    await revisionEdit(page,()=>page.getByRole('button',{name:'Apply JSON data',exact:true}).click()); await ready(page);
  };
  const history = async direction => {await revisionEdit(page,()=>page.locator(`[data-action=${direction}]`).click()); await ready(page);};
  const company = async name => {await expect(frame(page).locator('[data-v3-id=header-company]').first()).toHaveText(name);};
  await apply('ERP A'); await apply('ERP B');
  await history('undo'); await company('ERP A');
  await history('redo'); await company('ERP B');
  await history('undo'); await sample(page,'1');
  await history('undo'); await company('ERP A');
  await expect(page.locator('[data-sample=erp]')).toHaveClass('active');
  await history('redo'); await expect(page.locator('[data-sample="1"]')).toHaveClass('active');
  await revisionEdit(page,()=>page.locator('[data-sample=erp]').click()); await ready(page); await company('ERP A');
  await apply('ERP C'); await history('undo'); await company('ERP A');
  await sample(page,'0'); await revisionEdit(page,()=>page.locator('[data-sample=erp]').click()); await ready(page); await company('ERP A');
});

test('hidden header removes printed content and space in preview and standalone export', async ({page,context},info) => {
  const before = await frame(page).locator('.printform_page').count();
  await page.locator('#left-panel [data-select=header]').click();
  await page.getByLabel('Show section',{exact:true}).uncheck();
  await revisionEdit(page,()=>page.getByRole('button',{name:'Apply section',exact:true}).click()); await ready(page);
  const after = await frame(page).locator('.printform_page').count();
  expect(after).toBeLessThan(before);
  await expect(frame(page).locator('.pheader_processed')).toHaveCount(0);
  await expect(frame(page).locator('#pf-mount')).not.toContainText('Untitled form');
  expect(await frame(page).locator('.pdocinfo_processed').evaluate(n=>n.getBoundingClientRect().top-n.closest('.printform_page').getBoundingClientRect().top)).toBeLessThan(5);
  const promise = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const downloaded = await promise, file = info.outputPath('hidden-header.html'); await downloaded.saveAs(file);
  const exported = await context.newPage(); await exported.goto(pathToFileURL(file).href);
  await expect(exported.locator('html')).toHaveAttribute('data-printform-status','ready');
  await expect(exported.locator('.pheader_processed')).toHaveCount(0);
  await expect(exported.locator('.printform_page')).toHaveCount(after);
  await expect(exported.locator('#pf-mount')).not.toContainText('Untitled form');
});
