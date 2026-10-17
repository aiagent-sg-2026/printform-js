import {test,expect} from './studio-v3-test.js';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {saveProject,readProject} from '../studio-v3/file-io.js';
import {keepStructureOpen} from './studio-v3-structure.js';
import {standaloneHtml} from './studio-v3-rendered-probes.js';

test.setTimeout(120000);

const CODE = 'BARCODE_CONTENT_OVERFLOW';
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const paper = page => page.frameLocator('#preview-frame');
const reports = page => page.evaluate(()=>window.barcodeOverflowReports);
const lastReport = async page => (await reports(page)).at(-1);
async function renderedAfter(page,action) {
  const count = (await reports(page)).length;
  await action();
  await expect.poll(async()=> (await reports(page)).length,{timeout:30000}).toBeGreaterThan(count);
  return lastReport(page);
}
async function save(page,info,name) {
  const pending = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const path = info.outputPath(`${name}.printform.json`); await (await pending).saveAs(path);
  return readFile(path,'utf8');
}
async function bind(page,target,pointer) {
  await page.locator(`#left-panel [data-select=${target}]`).click();
  await page.locator('[data-action=binding]').click();
  const form = page.locator('[data-form=binding]');
  await form.locator('[name=bindingMode]').selectOption('barcode');
  await form.getByText('Offline barcode',{exact:true}).click();
  await form.locator('[name=pointer]').fill(pointer);
  await form.locator('[name=barcodeFormat]').selectOption('CODE128');
  return renderedAfter(page,()=>form.getByRole('button',{name:'Apply binding',exact:true}).click());
}
async function width(page,target,value) {
  await page.locator(`#left-panel [data-select=${target}]`).click();
  await page.locator('[data-action=properties]').click();
  const form = page.locator('[data-form=field]'); await form.locator('[name=width]').fill(String(value));
  return renderedAfter(page,()=>form.getByRole('button',{name:'Apply field',exact:true}).click());
}
async function layout(page,columns) {
  await page.locator('#left-panel [data-select=footer]').click();
  await page.locator('[data-action=properties]').click();
  const form = page.locator('[data-form=block]'); await form.getByText('Section layout',{exact:true}).click();
  await form.locator('[name=layoutColumns]').fill(String(columns));
  return renderedAfter(page,()=>form.getByRole('button',{name:'Apply section',exact:true}).click());
}
async function symbol(root,target) {
  return root.locator(`[data-v3-id=${target}] [data-pf-barcode-svg]`).first().evaluate(svg=>({
    markup:svg.outerHTML, source:svg.getAttribute('data-pf-barcode-source'), width:svg.getBoundingClientRect().width,
    bars:[...svg.querySelectorAll('[data-pf-barcode-bars] rect')].map(bar=>[bar.getAttribute('x'),bar.getAttribute('width')])
  }));
}
async function geometry(root,target) {
  return root.locator(`[data-v3-id=${target}] [data-pf-barcode-svg]`).first().evaluate(svg=> {
    const owner = svg.closest('td,th,.field'), page = svg.closest('.printform_page');
    const s = svg.getBoundingClientRect(), c = owner.getBoundingClientRect(), p = page.getBoundingClientRect(), style = getComputedStyle(owner);
    const px = name=>parseFloat(style[name]) || 0;
    return {owner:owner.tagName.toLowerCase(),svg:{left:s.left,right:s.right,top:s.top,bottom:s.bottom,width:s.width,height:s.height},
      box:{left:c.left,right:c.right,top:c.top,bottom:c.bottom,width:c.width,height:c.height},
      content:{left:c.left+px('paddingLeft')+px('borderLeftWidth'),right:c.right-px('paddingRight')-px('borderRightWidth'),
        top:c.top+px('paddingTop')+px('borderTopWidth'),bottom:c.bottom-px('paddingBottom')-px('borderBottomWidth')},
      page:{left:p.left,right:p.right}};
  });
}
function blocked(report,target,dimension='width') {
  expect(report.status).toBe('blocked');
  expect(report.validation.errors).toContainEqual(expect.objectContaining({code:CODE,severity:'error'}));
  expect(report.validation.errors.map(issue=>issue.code)).not.toContain('HORIZONTAL_OVERFLOW');
  const issue = report.issues.find(issue=>issue.code === CODE && issue.component_id === target);
  expect(issue).toBeDefined(); expect(issue.available_size[dimension]).toBeLessThan(issue.measured_size[dimension]);
  expect(issue.selector).toContain('svg:nth-of-type(1)'); expect(issue.container_selector).toBeTruthy();
  expect(issue).not.toHaveProperty('text'); expect(issue).not.toHaveProperty('value');
  expect(report.issues.filter(issue=>issue.code === CODE).length).toBeLessThanOrEqual(20);
}
async function standalone(page,context,info,source,name) {
  // Build a standalone specimen with the canonical exporter, not an enabled UI export.
  // Its own real runtime must independently block an invalid measured layout.
  const html = await standaloneHtml(page,readProject(source));
  const path = info.outputPath(`${name}.html`); await writeFile(path,html);
  const offline = await context.newPage(); await offline.route(/^https?:/,route=>route.abort());
  await offline.goto(pathToFileURL(path).href);
  await expect(offline.locator('html')).toHaveAttribute('data-printform-status',/ready|blocked/);
  return offline;
}
async function runtimeReport(page,media='screen') {
  await page.emulateMedia({media});
  return page.evaluate(()=>window.PrintFormDocument.render());
}
async function actualExport(page,context,info,name) {
  const downloading = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const path = info.outputPath(`${name}.html`); await (await downloading).saveAs(path);
  const offline = await context.newPage(); await offline.route(/^https?:/,route=>route.abort());
  await offline.goto(pathToFileURL(path).href);
  await expect(offline.locator('html')).toHaveAttribute('data-printform-status','ready');
  return offline;
}

test.beforeEach(async({page})=> {
  page.on('dialog',dialog=>dialog.accept()); await keepStructureOpen(page);
  await page.addInitScript(()=> {
    if (window !== window.top) return;
    window.barcodeOverflowReports = [];
    window.addEventListener('message',event=> {
      if (event.source === document.querySelector('#preview-frame')?.contentWindow && event.data?.source === 'printform-studio-v3-preview' && event.data.type === 'rendered') window.barcodeOverflowReports.push(event.data.payload.report);
    });
  });
  await page.goto('/studio-v3/'); await ready(page);
});

test('default 15% SKU CODE128 crosses description inside page, blocks export, and recovers by allocating width only',async({page,context},info)=> {
  const before = readProject(await save(page,info,'default-before'));
  expect(before.manifest.studioV3.columns.find(column=>column.id === 'sku').width).toBe(15);
  expect(before.sampleData.items[0].sku).toBe('ASM-0001');
  const report = await bind(page,'items-sku','./sku'); blocked(report,'items-sku');
  await expect(page.locator('[data-action=export]')).toBeDisabled();
  const measured = await geometry(paper(page),'items-sku');
  expect(measured.svg.right).toBeGreaterThan(measured.content.right+1);
  expect(measured.svg.right).toBeLessThan(measured.page.right);
  const original = await symbol(paper(page),'items-sku');
  const invalidSource = await save(page,info,'overflow-blocked'), invalid = readProject(invalidSource);
  expect(invalid.sampleData).toEqual(before.sampleData);
  const offline = await standalone(page,context,info,invalidSource,'blocked-standalone');
  for (const media of ['screen','print']) {
    const result = await runtimeReport(offline,media); blocked(result,'items-sku');
    expect(await symbol(offline,'items-sku')).toEqual(original);
    await info.attach(`blocked-${media}-report.json`,{body:JSON.stringify(result),contentType:'application/json'});
  }
  await offline.close();
  // Free description space before widening SKU; the model never permits a >100% sum.
  await width(page,'items-description',8); const fixed = await width(page,'items-sku',44);
  expect(fixed.status).toBe('ready'); await ready(page);
  expect(fixed.validation.errors.map(issue=>issue.code)).not.toContain(CODE);
  expect(await symbol(paper(page),'items-sku')).toEqual(original);
  const corrected = readProject(await save(page,info,'width-corrected'));
  expect(corrected.sampleData).toEqual(before.sampleData);
  expect(corrected.manifest.studioV3.columns.find(column=>column.id === 'sku').barcode).toEqual(invalid.manifest.studioV3.columns.find(column=>column.id === 'sku').barcode);
  const exported = await actualExport(page,context,info,'width-corrected');
  const print = await runtimeReport(exported,'print'); expect(print.status).toBe('ready');
  expect(print.metrics.barcodeContentOverflows).toBe(0); expect(await symbol(exported,'items-sku')).toEqual(original);
  await info.attach('corrected-print-report.json',{body:JSON.stringify(print),contentType:'application/json'});
  await exported.close();
});

test('barcode field uses its grid content box rather than inline wrapper and recovers without changing symbol',async({page,context},info)=> {
  const project = newProject('invoice',true), design = designOf(project);
  project.manifest.title = 'Barcode field geometry'; project.sampleData = {code:'ASM-0001'};
  design.blocks.footer.enabled = true; design.blocks.footer.layout = {columns:3,gap:12};
  design.footer = [{id:'code',kind:'bound',label:'Code',pointer:'/code',format:''}];
  await renderedAfter(page,()=>page.locator('#open-file').setInputFiles({name:'field.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(compileProject(project,design)))}));
  await ready(page);
  const bad = await bind(page,'footer-code','/code'); blocked(bad,'footer-code');
  await expect(page.locator('[data-action=export]')).toBeDisabled();
  const original = await symbol(paper(page),'footer-code'), measured = await geometry(paper(page),'footer-code');
  expect(measured.owner).toBe('div'); expect(measured.svg.right).toBeLessThan(measured.page.right);
  const invalidSource = await save(page,info,'field-blocked');
  const offline = await standalone(page,context,info,invalidSource,'field-blocked');
  blocked(await runtimeReport(offline,'print'),'footer-code'); await offline.close();
  const good = await layout(page,1); expect(good.status).toBe('ready'); await ready(page);
  expect(await symbol(paper(page),'footer-code')).toEqual(original);
  const corrected = readProject(await save(page,info,'field-corrected'));
  expect(corrected.sampleData).toEqual(project.sampleData);
  const exported = await actualExport(page,context,info,'field-corrected');
  expect((await runtimeReport(exported,'print')).status).toBe('ready');
  expect(await symbol(exported,'footer-code')).toEqual(original); await exported.close();
});

test('real padded bordered field rejects horizontal and vertical content intrusion even inside its border box',async({page,context},info)=> {
  const project = newProject('invoice',true), design = designOf(project);
  project.sampleData = {code:'ASM-0001'}; design.blocks.footer.enabled = true;
  design.footer = [{id:'code',kind:'barcode',label:'',showLabel:false,pointer:'/code',format:'',barcode:{format:'CODE128',moduleWidth:2,height:48,displayValue:true}}];
  const source = saveProject(compileProject(project,design));
  const specimen = readProject(source);
  // Real CSS boxes: the SVG fits the border box but exceeds its padded content width.
  specimen.themeCss += '\n#pf-mount .v3-notes .field {width:310px;height:180px;border:6px solid black;padding:30px;}';
  const html = await standaloneHtml(page,specimen);
  const path = info.outputPath('padded-field.html'); await writeFile(path,html);
  const offline = await context.newPage(); await offline.goto(pathToFileURL(path).href);
  const horizontal = await runtimeReport(offline); blocked(horizontal,'footer-code');
  const original = await symbol(offline,'footer-code');
  const first = await geometry(offline,'footer-code');
  expect(first.box.width).toBe(310); expect(first.content.right-first.content.left).toBe(238);
  expect(first.svg.width).toBeLessThan(first.box.width);
  // Change actual CSS, then run the embedded runtime's same post-pagination acceptance path.
  await offline.locator('#pf-theme').evaluate(node=> {node.textContent += '\n#pf-mount .v3-notes .field {width:400px;height:150px;}';});
  const vertical = await runtimeReport(offline,'print'); blocked(vertical,'footer-code','height');
  const second = await geometry(offline,'footer-code');
  expect(second.svg.bottom).toBeLessThan(second.box.bottom);
  expect(second.svg.bottom).toBeGreaterThan(second.content.bottom+1);
  expect(second.content.bottom-second.content.top).toBe(78);
  expect(await symbol(offline,'footer-code')).toEqual(original);
  await offline.locator('#pf-theme').evaluate(node=> {node.textContent += '\n#pf-mount .v3-notes .field {height:180px;}';});
  const corrected = await runtimeReport(offline,'print'); expect(corrected.status).toBe('ready');
  expect(corrected.metrics.barcodeContentOverflows).toBe(0);
  expect(await symbol(offline,'footer-code')).toEqual(original);
  await info.attach('field-content-reports.json',{body:JSON.stringify({horizontal,vertical,corrected}),contentType:'application/json'});
  await offline.close();
});
