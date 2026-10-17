import { test,expect } from './studio-v3-test.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { newProject,designOf,compileProject,BLOCKS } from '../studio-v3/model.js';
import { saveProject,readProject } from '../studio-v3/file-io.js';
import { PAPERS } from '../studio-v3/paper-settings.js';

// Nominal requested media, independent of the implementation's dimension helpers.
const expectedMm = {A4:[210,297],A5:[148,210],LETTER:[215.9,279.4],LEGAL:[215.9,355.6],
  RECEIPT_58:[58,120],RECEIPT_80:[80,160],LABEL_100_70:[100,70],LABEL_50_30:[50,30],
  CONTINUOUS_210_140:[210,140],FANFOLD_210_280:[210,280],CUSTOM:[133.2,82.5]};
const sourceTitle = 'Fictional supplied general Studio media record';
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
function suppliedProject() {
  const project = newProject('invoice',true), design = designOf(project);
  project.manifest.title = sourceTitle;
  project.sampleData = {media:{token:'MEDIA-001',sourceAmount:'0001.2300',note:'Supplied values, not a device test'}};
  design.repeatHeader = false; design.pageNumbers = false; design.sectionOrder = [...BLOCKS];
  design.blocks.footer.enabled = true;
  design.footer = [{id:'token',label:'Supplied token',pointer:'/media/token',format:'',showLabel:false}];
  return compileProject(project,design);
}
async function load(page,source,name='media.printform.json') {
  const generation = await page.evaluate(()=>window.mediaRenderGeneration || 0);
  await page.locator('#open-file').setInputFiles({name,mimeType:name.endsWith('.html') ? 'text/html' : 'application/json',buffer:Buffer.from(source)});
  await page.waitForFunction(before=>window.mediaRenderGeneration>before,generation,{timeout:30000});
  await expect(page.locator('#document-name')).toHaveValue(sourceTitle);
  await ready(page);
}
async function saveState(page,info,name) {
  const saving = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const path = info.outputPath(name); await (await saving).saveAs(path);
  return readProject(await readFile(path,'utf8'));
}
async function settings(page) {
  const structure = page.locator('[data-layout=structure]').first();
  if (await structure.getAttribute('aria-expanded') !== 'true') await structure.click();
  await page.locator('[data-action=go-style]').click();
  const properties = page.locator('[data-layout=properties]').first();
  if (await properties.getAttribute('aria-expanded') !== 'true') await properties.click();
  return page.locator('form[data-form=style]');
}
async function assertGeometry(root,design) {
  const [widthMm,heightMm] = expectedMm[design.page.paper], physical = {width:widthMm*96/25.4,height:heightMm*96/25.4}, margins = design.page?.margins || {left:0,right:0,top:0,bottom:0};
  const sheets = await root.locator('.physical_page_wrapper').evaluateAll(nodes=>nodes.map(node=> {
    const sheet = node.getBoundingClientRect(), logical = node.querySelector('.printform_page').getBoundingClientRect();
    return {width:sheet.width,height:sheet.height,innerWidth:logical.width,innerHeight:logical.height,left:logical.left-sheet.left,top:logical.top-sheet.top};
  }));
  expect(sheets).toHaveLength(1);
  for (const sheet of sheets) {
    expect(Math.abs(sheet.width-physical.width)).toBeLessThan(1);
    expect(Math.abs(sheet.height-physical.height)).toBeLessThan(1);
    expect(Math.abs(sheet.innerWidth-(physical.width-margins.left-margins.right))).toBeLessThan(1);
    expect(Math.abs(sheet.innerHeight-(physical.height-margins.top-margins.bottom))).toBeLessThan(1);
    expect(Math.abs(sheet.left-margins.left)).toBeLessThan(1); expect(Math.abs(sheet.top-margins.top)).toBeLessThan(1);
  }
  await expect(root.locator('[data-v3-id=footer-token]')).toHaveText('MEDIA-001');
  return sheets;
}
async function assertPdf(page,design,info) {
  const bytes = await page.pdf({preferCSSPageSize:true,printBackground:true,scale:1,displayHeaderFooter:false});
  await info.attach('actual-browser.pdf',{body:bytes,contentType:'application/pdf'});
  const loading = getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
  try {
    const pdf = await loading.promise; expect(pdf.numPages).toBe(1);
    const physical = await pdf.getPage(1), viewport = physical.getViewport({scale:1}), [widthMm,heightMm] = expectedMm[design.page.paper];
    expect(Math.abs(viewport.width-widthMm*72/25.4)).toBeLessThan(1);
    expect(Math.abs(viewport.height-heightMm*72/25.4)).toBeLessThan(1);
    const text = (await physical.getTextContent()).items.map(item=>item.str || '').join(' ');
    expect(text).toContain('MEDIA-001');
  } finally { await loading.destroy(); }
}

test.beforeEach(async({page})=> {
  await page.addInitScript(()=> {
    if (window !== window.top) return;
    window.mediaRenderGeneration = 0;
    window.addEventListener('message',event=> {
      if (event.source === document.querySelector('#preview-frame')?.contentWindow && event.data?.source === 'printform-studio-v3-preview' && event.data.type === 'rendered') window.mediaRenderGeneration++;
    });
  });
  page.on('dialog',dialog=>dialog.accept()); await page.goto('/studio-v3/'); await ready(page);
});
for (const paper of PAPERS) {
  test(`${paper}: no-code selection, measured preview, save/open, offline HTML and actual PDF`,async({page,context,browserName},info)=> {
    const initial = suppliedProject(); await load(page,saveProject(initial));
    const form = await settings(page);
    await form.locator('[name=paper]').selectOption(paper);
    if (paper === 'CUSTOM') {
      await form.locator('[name=paper-width-mm]').fill('82.5'); await form.locator('[name=paper-height-mm]').fill('133.2');
      await form.locator('[name=orientation]').selectOption('landscape');
      for (const side of ['top','right','bottom','left']) await form.locator(`[name=margin-${side}]`).fill('8');
    }
    await form.getByRole('button',{name:'Apply style',exact:true}).click(); await ready(page);
    await expect(page.locator('#paper-kind')).toHaveText(paper);
    if (paper === 'CUSTOM') await expect(page.locator('#paper-dimensions')).toHaveText('133.2 × 82.5 mm');
    const saving = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
    const savedPath = info.outputPath('media.printform.json'); await (await saving).saveAs(savedPath);
    const source = await readFile(savedPath,'utf8'), restored = readProject(source), design = restored.manifest.studioV3;
    expect(restored.sampleData).toEqual(initial.sampleData); expect(design.page.paper).toBe(paper);
    const measured = await assertGeometry(page.frameLocator('#preview-frame'),design);
    await load(page,source); await assertGeometry(page.frameLocator('#preview-frame'),design);
    const exporting = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
    const htmlPath = info.outputPath('media-offline.html'); await (await exporting).saveAs(htmlPath);
    const offlineSource = await readFile(htmlPath,'utf8');
    await load(page,offlineSource,'media.html');
    const reopened = await saveState(page,info,'html-reopened.printform.json');
    expect(reopened.manifest.studioV3.page).toEqual(design.page); expect(reopened.sampleData).toEqual(initial.sampleData);
    const offline = await context.newPage(); await offline.route(/^https?:/,route=>route.abort());
    await offline.goto(pathToFileURL(htmlPath).href);
    await expect(offline.locator('html')).toHaveAttribute('data-printform-status','ready');
    await assertGeometry(offline,design); await offline.emulateMedia({media:'print'}); await assertGeometry(offline,design);
    await info.attach('measured-paper.json',{body:Buffer.from(JSON.stringify({paper,page:design.page,measured,physicalBlocked:true})),contentType:'application/json'});
    if (browserName === 'chromium') await assertPdf(offline,design,info);
    await offline.close();
  });
}
test('local capability profile import is pending, contradictions reject Apply, and removal is reversible',async({page},info)=> {
  const initial = suppliedProject(); await load(page,saveProject(initial));
  let form = await settings(page);
  await expect(form.locator('[name=printer-enabled]')).not.toBeChecked();
  await expect(form.locator('[data-physical-status=blocked]')).toContainText('capabilities are unknown');
  await form.getByText('User-supplied printer capabilities',{exact:true}).click();
  const declarations = {version:1,source:'user-supplied',name:'Explicit user declarations — no tested printer',maxWidthMm:80,orientations:['portrait'],nonPrintableMm:{left:1},dpi:203,cutter:false};
  await form.locator('[data-printer-profile-file]').setInputFiles({name:'user-declarations.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(declarations))});
  await expect(form.locator('[data-printer-profile-status]')).toContainText('pending form');
  await expect(page.locator('#paper-kind')).toHaveText('A4');
  await form.locator('[name=paper]').selectOption('RECEIPT_80');
  await form.getByRole('button',{name:'Apply style',exact:true}).click();
  await expect(page.locator('#status')).toContainText('nonprintable margin');
  await expect(page.locator('#paper-kind')).toHaveText('A4');
  await form.locator('[name=margin-left]').fill('4');
  await form.getByRole('button',{name:'Apply style',exact:true}).click(); await ready(page);
  await expect(page.locator('#paper-kind')).toHaveText('RECEIPT_80');
  form = page.locator('form[data-form=style]');
  await form.getByText('User-supplied printer capabilities',{exact:true}).click();
  await expect(form.locator('[name=printer-dpi]')).toHaveValue('203');
  await expect(form.locator('[name=printer-cutter]')).toHaveValue('false');
  await expect(form.locator('[data-physical-status=blocked]')).toContainText('not discovered or certified');
  const profileDownload = page.waitForEvent('download'); await form.locator('[data-printer-profile-export]').click();
  const profilePath = info.outputPath('declared-profile.json'); await (await profileDownload).saveAs(profilePath);
  expect(JSON.parse(await readFile(profilePath,'utf8'))).toEqual(declarations);
  const saving = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const savedPath = info.outputPath('with-profile.printform.json'); await (await saving).saveAs(savedPath);
  const saved = readProject(await readFile(savedPath,'utf8'));
  expect(saved.manifest.studioV3.page.printerProfile).toEqual(declarations);
  const exporting = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const htmlPath = info.outputPath('with-profile.html'); await (await exporting).saveAs(htmlPath);
  await load(page,await readFile(htmlPath,'utf8'),'with-profile.html');
  expect((await saveState(page,info,'profile-html-reopened.printform.json')).manifest.studioV3.page.printerProfile).toEqual(declarations);
  form = await settings(page);
  if (!await form.locator('[name=printer-enabled]').isVisible()) await form.getByText('User-supplied printer capabilities',{exact:true}).click();
  await form.locator('[name=printer-enabled]').uncheck();
  await form.getByRole('button',{name:'Apply style',exact:true}).click(); await ready(page);
  await expect(page.locator('form[data-form=style] [name=printer-enabled]')).not.toBeChecked();
  await page.locator('[data-action=undo]').click(); await ready(page);
  await expect(page.locator('form[data-form=style] [name=printer-enabled]')).toBeChecked();
});
