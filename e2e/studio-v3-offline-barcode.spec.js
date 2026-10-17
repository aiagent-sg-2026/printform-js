import {test,expect} from './studio-v3-test.js';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {saveProject,readProject} from '../studio-v3/file-io.js';
import {decodeBarcodeRow} from '../tests/support/barcode-decode.js';

const title = 'Offline barcode supplied-string fixture';
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
function sourceProject() {
  const project = newProject('invoice',true), design = designOf(project);
  project.manifest.title = title;
  project.sampleData = {codes:{code128:'00A<&',ean13:'0001234567895'},amount:'00012.3400'};
  design.blocks.footer.enabled = true;
  design.footer = [
    {id:'code128',kind:'static',label:'CODE128',pointer:'',text:'Pending barcode',format:''},
    {id:'ean13',kind:'static',label:'EAN13',pointer:'',text:'Pending barcode',format:''},
    {id:'supplied-amount',label:'Supplied amount',pointer:'/amount',format:''}
  ];
  design.repeatHeader = false; design.pageNumbers = false;
  return compileProject(project,design);
}
async function load(page,source,name='barcode.printform.json') {
  const generation = await page.evaluate(()=>window.barcodeRenderGeneration || 0);
  await page.locator('#open-file').setInputFiles({name,mimeType:name.endsWith('.html') ? 'text/html' : 'application/json',buffer:Buffer.from(source)});
  await page.waitForFunction(before=>window.barcodeRenderGeneration > before,generation,{timeout:30000});
  await expect(page.locator('#document-name')).toHaveValue(title); await ready(page);
  // Fit-page scales the iframe, not the paper. Decode actual screenshots at 1:1
  // so the clean module oracle samples bars rather than a downscaled label row.
  await page.locator('#zoom').selectOption('1');
  await expect(page.locator('#preview-frame')).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
}
async function bindHumanBarcode(page,id,format) {
  const structure = page.locator('[data-layout=structure]').first();
  if (await structure.getAttribute('aria-expanded') !== 'true') await structure.click();
  await page.locator(`#left-panel [data-select=footer-${id}]`).click();
  await page.locator('[data-action=binding]').click();
  const form = page.locator('form[data-form=binding]');
  await form.getByLabel('Value source',{exact:true}).selectOption('barcode');
  await form.locator('[name=pointer]').fill(`/codes/${id}`);
  const details = form.locator('details').filter({has:page.locator('[name=barcodeFormat]')});
  if (!await details.evaluate(node=>node.open)) await details.locator('summary').click();
  await form.locator('[name=barcodeFormat]').selectOption(format);
  await form.locator('[name=barcodeModuleWidth]').fill('2');
  await form.locator('[name=barcodeHeight]').fill('48');
  await form.locator('[name=barcodeDisplayValue]').check();
  await form.getByRole('button',{name:'Apply binding',exact:true}).click();
  await expect(page.frameLocator('#preview-frame').locator(`[data-v3-id=footer-${id}] svg`)).toHaveCount(1);
  await ready(page);
}
async function decodeRenderedRaster(page,svg,format,info,label) {
  const png = await svg.screenshot({scale:'css'});
  await info.attach(`${label}-${format}.png`,{body:png,contentType:'image/png'});
  const row = await page.evaluate(async bytes=> {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap,0,0); bitmap.close();
    const pixels = ctx.getImageData(0,20,canvas.width,1).data;
    return Array.from({length:canvas.width},(_,i)=>pixels[i*4]+pixels[i*4+1]+pixels[i*4+2] < 384 ? 1 : 0);
  },[...png]);
  return decodeBarcodeRow(row,format);
}
async function assertCodes(page,root,info,label) {
  if (await page.locator('#preview-frame').count()) {
    // A selected field's blue editor border overlaps the SVG's left quiet zone.
    // Select the fixture's hidden header through the UI: no printed node is
    // selected, and the full, unchanged native screenshot contains only paper.
    await page.locator('#left-panel [data-select=header]').click();
    await expect(root.locator('[data-v3-selection]')).toHaveCount(0);
  }
  for (const [id,format,value] of [['code128','CODE128','00A<&'],['ean13','EAN13','0001234567895']]) {
    const svg = root.locator(`[data-v3-id=footer-${id}] svg`);
    await expect(svg.locator('text')).toHaveText(value);
    expect(await decodeRenderedRaster(page,svg,format,info,label)).toBe(value);
  }
  await expect(root.locator('[data-v3-id=footer-supplied-amount]')).toHaveText('00012.3400');
}

test.beforeEach(async({page})=> {
  await page.addInitScript(()=> {
    if (window !== window.top) return;
    window.barcodeRenderGeneration = 0;
    window.addEventListener('message',event=> {
      if (event.source === document.querySelector('#preview-frame')?.contentWindow && event.data?.source === 'printform-studio-v3-preview' && event.data.type === 'rendered') window.barcodeRenderGeneration++;
    });
  });
});

test('human barcode controls persist and independently decode preview, offline standalone and print media',async({page,browser,browserName},info)=> {
  page.on('dialog',dialog=>dialog.accept()); await page.goto('/studio-v3/'); await ready(page);
  const initial = sourceProject(); await load(page,saveProject(initial));
  await bindHumanBarcode(page,'code128','CODE128'); await bindHumanBarcode(page,'ean13','EAN13');
  await assertCodes(page,page.frameLocator('#preview-frame'),info,'preview');
  const saving = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const savedPath = info.outputPath('barcode.printform.json'); await (await saving).saveAs(savedPath);
  const source = await readFile(savedPath,'utf8'), restored = readProject(source);
  expect(restored.sampleData).toEqual(initial.sampleData);
  for (const [id,format] of [['code128','CODE128'],['ean13','EAN13']]) {
    expect(restored.manifest.studioV3.footer.find(field=>field.id === id)).toMatchObject({kind:'barcode',pointer:`/codes/${id}`,barcode:{format,moduleWidth:2,height:48,displayValue:true}});
  }
  await load(page,source); await assertCodes(page,page.frameLocator('#preview-frame'),info,'json-reopened');
  const exporting = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const htmlPath = info.outputPath('barcode-offline.html'); await (await exporting).saveAs(htmlPath);
  const html = await readFile(htmlPath,'utf8');
  await load(page,html,'barcode.html'); await assertCodes(page,page.frameLocator('#preview-frame'),info,'html-reopened');
  const offlineContext = await browser.newContext({offline:true});
  const offline = await offlineContext.newPage(), requests = [];
  await offline.route(/^https?:/,route=> { requests.push(route.request().url()); return route.abort(); });
  await offline.goto(pathToFileURL(htmlPath).href);
  await expect(offline.locator('html')).toHaveAttribute('data-printform-status','ready');
  await assertCodes(offline,offline,info,'standalone-offline');
  await offline.emulateMedia({media:'print'}); await assertCodes(offline,offline,info,'print-media');
  expect(requests).toEqual([]);
  if (browserName === 'chromium') {
    const pdfBytes = await offline.pdf({preferCSSPageSize:true,printBackground:true,scale:1});
    await info.attach('actual-offline-barcode.pdf',{body:pdfBytes,contentType:'application/pdf'});
    const loading = getDocument({data:new Uint8Array(pdfBytes),isEvalSupported:false});
    try {
      const pdf = await loading.promise; expect(pdf.numPages).toBe(1);
      const text = (await (await pdf.getPage(1)).getTextContent()).items.map(item=>item.str || '').join(' ');
      expect(text).toContain('0001234567895'); expect(text).toContain('00012.3400');
    } finally { await loading.destroy(); }
  }
  for (const [value,code] of [['000123456789','BARCODE_VALUE'],['0001234567894','BARCODE_CHECKSUM'],[1234567890123,'BARCODE_VALUE']]) {
    const invalid = structuredClone(initial.sampleData); invalid.codes.ean13 = value;
    const result = await offline.evaluate(data=>window.PrintFormDocument.render(data),invalid);
    expect(result.status).toBe('blocked');
    expect(result.validation.errors).toContainEqual(expect.objectContaining({code,path:'/codes/ean13'}));
    await expect(offline.locator('#pf-mount svg')).toHaveCount(0);
  }
  await offlineContext.close();
});
