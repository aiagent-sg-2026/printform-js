import { test,expect } from './studio-v3-test.js';
import { keepStructureOpen } from './studio-v3-structure.js';
import { nestedDatasetFixture } from '../tests/fixtures/nested-dataset.js';
import { readProject,saveProject } from '../studio-v3/file-io.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

globalThis.DOMParser ??= new JSDOM('').window.DOMParser;

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const paper = page => page.frameLocator('#preview-frame');
async function change(page,action) {
  const revision = await page.locator('#revision').textContent();
  await action(); await expect(page.locator('#revision')).not.toHaveText(revision);
}
async function save(page,info,name) {
  const pending = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const file = await pending, path = info.outputPath(name); await file.saveAs(path);
  return {path,project:readProject(await readFile(path,'utf8'))};
}
async function exactRows(target,amount) {
  await expect(target.locator('[data-v3-id=items-identity]')).toHaveText(['00007']);
  await expect(target.locator('[data-v3-id=items-exact]')).toHaveText([amount]);
  await expect(target.locator('[data-v3-id=items-currency]')).toHaveText(['USD']);
}

test('explicit empty schema survives real nested binding/save/reopen/later input/table/undo/offline lifecycle',async({page,context},info)=> {
  const errors = [], warnings = [];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{ if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text()); });
  page.on('dialog',dialog=>dialog.accept());
  await keepStructureOpen(page); await page.goto('/studio-v3/'); await ready(page);
  const empty = nestedDatasetFixture(true), full = nestedDatasetFixture();
  await page.locator('#open-file').setInputFiles({name:'empty-nested.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(empty.project))});
  await expect(page.locator('#document-name')).toHaveValue('Nested dataset contract'); await ready(page);
  await page.locator('#left-panel [data-select=items]').click(); await page.locator('[data-action=binding]').click();
  const picker = page.getByLabel('Pick a collection',{exact:true});
  await picker.selectOption('/parentDocuments/0/allocations');
  await change(page,()=>page.getByRole('button',{name:'Apply collection',exact:true}).click()); await ready(page);
  await expect(paper(page).locator('.prowitem_processed')).toHaveCount(0);
  const emptySaved = await save(page,info,'empty-selected.printform.json');
  expect(emptySaved.project.schema).toEqual(empty.schema);
  expect(emptySaved.project.manifest.datasetSchema.version).toBe('2026-10-15.1');
  expect(emptySaved.project.manifest.studioV3.collection).toBe('/parentDocuments/0/allocations');
  await page.locator('#open-file').setInputFiles(emptySaved.path); await ready(page);
  await page.locator('#left-panel [data-select=items-identity]').click(); await page.locator('[data-action=binding]').click();
  await page.getByLabel('Pick a data field',{exact:true}).selectOption('./currency');
  await change(page,()=>page.getByRole('button',{name:'Apply binding',exact:true}).click()); await ready(page);
  await page.locator('[data-action=binding]').click();
  await page.getByLabel('Pick a data field',{exact:true}).selectOption('./line~1id');
  await change(page,()=>page.getByRole('button',{name:'Apply binding',exact:true}).click()); await ready(page);
  await page.locator('[data-mode=data]').click(); await page.locator('#database-workbench [data-db-group=schema]').click();
  await expect(page.locator('[data-tree-path="/parentDocuments/0/allocations"]')).toBeVisible();
  await expect(page.locator('[data-tree-path="/a~1b~0c"]')).toBeVisible();
  await page.locator('#database-workbench [data-db-group=json]').click();
  await page.locator('#data-json').fill(JSON.stringify(full.data));
  await change(page,()=>page.getByRole('button',{name:'Apply JSON data',exact:true}).click()); await ready(page);
  await exactRows(paper(page),'-001.250');
  const beforeInvalid = await page.locator('#revision').textContent(), invalid = structuredClone(full.data);
  invalid.parentDocuments[0].allocations.push({'line/id':'BAD-SECOND','amount~raw':77,currency:'USD'});
  await page.locator('#data-json').fill(JSON.stringify(invalid));
  await page.getByRole('button',{name:'Apply JSON data',exact:true}).click();
  await expect(page.locator('#revision')).toHaveText(beforeInvalid);
  await expect(page.locator('#data-json')).toHaveValue(JSON.stringify(invalid));
  await exactRows(paper(page),'-001.250');
  await page.locator('#data-json').fill(JSON.stringify(full.data));
  await change(page,()=>page.getByRole('button',{name:'Apply JSON data',exact:true}).click()); await ready(page);
  await page.locator('#database-workbench [data-db-group=items]').click();
  const exact = page.locator('[data-db-pointer="/parentDocuments/0/allocations/0/amount~0raw"]');
  await expect(exact).toHaveValue('-001.250'); await exact.fill('-009.875');
  await change(page,()=>page.getByRole('button',{name:'Save as new & apply',exact:true}).click()); await ready(page);
  await exactRows(paper(page),'-009.875');
  await change(page,()=>page.locator('[data-action=undo]').click()); await ready(page); await exactRows(paper(page),'-001.250');
  await change(page,()=>page.locator('[data-action=redo]').click()); await ready(page); await exactRows(paper(page),'-009.875');
  await page.screenshot({path:info.outputPath('nested-studio.png'),fullPage:true});
  const saved = await save(page,info,'populated-nested.printform.json');
  expect(saved.project.sampleData.parentDocuments[0].allocations[0]['amount~raw']).toBe('-009.875');
  expect(saved.project.sampleData.parentDocuments[1].allocations[0]['amount~raw']).toBe('999.000');
  expect(saved.project.sampleData.custom).toEqual(full.data.custom);
  await page.locator('#open-file').setInputFiles(saved.path); await ready(page); await exactRows(paper(page),'-009.875');
  const pending = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const exported = await pending, path = info.outputPath('nested.html'); await exported.saveAs(path);
  const html = await readFile(path,'utf8');
  const reopened = readProject(html,'nested.html');
  expect(reopened.schema).toEqual(full.schema); expect(reopened.sampleData).toEqual(saved.project.sampleData);
  const offline = await context.newPage(); await offline.route(/^https?:/,route=>route.abort());
  await offline.goto(pathToFileURL(path).href); await expect(offline.locator('html')).toHaveAttribute('data-printform-status','ready');
  await exactRows(offline,'-009.875');
  expect(await offline.locator('.prowitem_processed').evaluateAll(rows=>rows.map(row=>Number(row.dataset.pfRowIndex)))).toEqual([0]);
  await offline.close(); expect(errors).toEqual([]);
  await info.attach('browser-diagnostics.json',{body:Buffer.from(JSON.stringify({errors,warnings},null,2)),contentType:'application/json'});
  for (const warning of warnings) console.warn(warning);
});
