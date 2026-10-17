import { test,expect } from './studio-v3-test.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { newProject } from '../studio-v3/model.js';
import { saveProject,readProject } from '../studio-v3/file-io.js';

const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function panel(page,name) {
  const button=page.locator(`[data-layout=${name}]`).first();
  if (await button.getAttribute('aria-expanded')!=='true') await button.click();
}
async function open(page,source) {
  await page.locator('#open-file').setInputFiles({name:'supplied.printform.json',mimeType:'application/json',buffer:Buffer.from(source)});
  await expect(page.locator('#document-name')).toHaveValue('Independent supplied arrays'); await ready(page);
}
function fixture() {
  const project=newProject(); project.manifest.title='Independent supplied arrays'; project.sampleData.items=project.sampleData.items.slice(0,3);
  project.sampleData.operations=Array.from({length:65},(_,index)=>({operation:`Operation-${String(index).padStart(3,'0')}`,hours:`0${index}.500`,sourceId:`SRC-${String(index).padStart(4,'0')}`}));
  project.sampleData.identifiers={code:'00012345-AB',ean:'0123456789012'};
  return project;
}

test('human independent table + exact EAN13 + supported currency persist and print entirely offline',async({page,context},info)=> {
  page.on('dialog',dialog=>dialog.accept()); await page.goto('/studio-v3/'); await ready(page);
  const initial=fixture(); await open(page,saveProject(initial)); await panel(page,'structure'); await panel(page,'properties');
  await page.locator('[data-action=add-table]').click();
  const form=page.locator('[data-form=additional-table]'); await expect(form).toBeVisible();
  await form.locator('[name=label]').fill('Supplied work operations'); await form.getByRole('button',{name:'Apply source table',exact:true}).click();
  await ready(page);
  const select=page.locator('[data-select^="table-"]').first(), id=await select.getAttribute('data-select');
  const frame=page.frameLocator('#preview-frame');
  await expect(frame.locator(`.prowitem_processed[data-pf-table-id="${id}"]`)).toHaveCount(65);
  await expect(frame.locator('.prowitem_processed[data-pf-table-id=items]')).toHaveCount(3);
  expect(await frame.locator('.physical_page_wrapper').count()).toBeGreaterThan(1);
  await expect(frame.locator(`[data-v3-id="${id}-column-2"]`).first()).toHaveText('00.500');
  await page.locator('[data-select=footer]').click();
  await page.locator('[data-action=add-field]').last().click();
  await page.locator('[data-action=binding]').click();
  const binding=page.locator('[data-form=binding]'); await binding.locator('[name=bindingMode]').selectOption('barcode');
  await binding.getByText('Offline barcode',{exact:true}).click();
  await binding.locator('[name=pointer]').fill('/identifiers/ean'); await binding.locator('[name=barcodeFormat]').selectOption('EAN13');
  await binding.getByRole('button',{name:'Apply binding',exact:true}).click(); await ready(page);
  await expect(frame.locator('[data-pf-barcode-svg]')).toHaveCount(1);
  await expect(frame.locator('[data-pf-barcode-svg]')).toContainText('0123456789012');
  await page.locator('[data-mode=data]').click();
  const locale=page.locator('[data-form=locale]'); await locale.locator('..').locator('..').locator('summary').click();
  await locale.locator('[name=currency]').selectOption('GBP'); await locale.getByRole('button',{name:'Apply locale',exact:true}).click(); await ready(page);
  const saving=page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const jsonPath=info.outputPath('capabilities.printform.json'); await (await saving).saveAs(jsonPath);
  const source=await readFile(jsonPath,'utf8'), saved=readProject(source);
  expect(saved.manifest.currency).toBe('GBP'); expect(saved.sampleData).toEqual(initial.sampleData);
  expect(saved.manifest.studioV3.additionalTables[0].collection).toBe('/operations');
  const barcode=saved.manifest.studioV3.footer.find(field=>field.kind==='barcode'); expect(barcode.pointer).toBe('/identifiers/ean');
  await open(page,source); await expect(frame.locator('[data-pf-barcode-svg]')).toHaveCount(1);
  const downloading=page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const htmlPath=info.outputPath('capabilities.html'); await (await downloading).saveAs(htmlPath);
  const standalone=await context.newPage(); await standalone.route('http**/*',route=>route.abort());
  await standalone.goto(pathToFileURL(htmlPath).href);
  await expect(standalone.locator(`.prowitem_processed[data-pf-table-id="${id}"]`)).toHaveCount(65);
  await expect(standalone.locator('[data-pf-barcode-svg]')).toContainText('0123456789012');
  await standalone.emulateMedia({media:'print'}); await expect(standalone.locator('[data-pf-barcode-svg]')).toBeVisible();
  await standalone.locator('[data-pf-barcode-svg]').screenshot({path:info.outputPath('actual-ean13.png')});
  await standalone.close();
});
