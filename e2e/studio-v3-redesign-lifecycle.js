import {clickHeaderAction} from './header-action.js';
import { replyText, responsesReply, userText } from './demo-gateway-fixture.js';
import { expect } from '@playwright/test';
import { reviewCandidate } from './studio-v3-scope.js';
import { expectApplied } from './ai-applied.js';
import { operationAutoApplicable } from '../studio-v3/ai-auto-apply-policy.js';
import fs from 'node:fs/promises';
import { publicDemoPlanner } from './studio-v3-live-redesign.js';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const frame = page => page.frameLocator('#preview-frame');
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const proposal = operations => ({kind:'proposal',summary:'Complete synthetic invoice redesign',operations});
const syntheticRedesigns = [
  proposal([
    {type:'set_style',patch:{font:10,padding:6,color:'#163a65',striped:false,borders:false}},
    {type:'set_section',target:'header',patch:{layout:{columns:1,gap:8}}},
    {type:'set_section',target:'customer',patch:{layout:{columns:2,gap:20}}},
    {type:'set_section',target:'items',patch:{breakBefore:true}},
    {type:'reorder_fields',section:'items',order:['items-no','items-description','items-sku','items-quantity','items-rate','items-amount']},
    {type:'set_field',target:'items-description',patch:{width:37,valueStyle:{fontSize:10}}},
    {type:'set_element_style',target:'header-title',patch:{fontSize:22,bold:true}},
    {type:'add_field',section:'footer',field:{id:'redesign-note',kind:'static',label:'',text:'Synthetic redesigned footer',format:''}}
  ]),
  proposal([
    {type:'set_style',patch:{font:9,padding:8,color:'#243b53',striped:true,borders:true}},
    {type:'set_section',target:'header',patch:{layout:{columns:2,gap:16}}},
    {type:'set_section',target:'customer',patch:{layout:{columns:1,gap:10}}},
    {type:'reorder_fields',section:'items',order:['items-no','items-sku','items-description','items-quantity','items-amount','items-rate']},
    {type:'set_section',target:'footer',patch:{layout:{columns:2,gap:12}}},
    {type:'set_heading',value:'REDESIGNED INVOICE'}
  ])
];
const defaultRedesigns = process.env.PRINTFORM_REAL_PROPOSALS
  ? JSON.parse(readFileSync(process.env.PRINTFORM_REAL_PROPOSALS,'utf8'))
  : syntheticRedesigns;
async function inspect(page, scope=frame(page)) {
  const result = await scope.locator('.printform_page').evaluateAll(pages=>({
    geometry:pages.map(p=>{const rect=p.getBoundingClientRect(), wrapper=p.closest('.physical_page_wrapper');
      const css=wrapper ? getComputedStyle(wrapper) : null;
      return {width:Math.round(rect.width),height:Math.round(rect.height),margins:['Top','Right','Bottom','Left'].map(side=>css ? parseFloat(css[`padding${side}`]) || 0 : 0)};}),
    structure: {
      headerFields:[...pages[0].querySelectorAll('.v3-header [data-v3-field]')].map(n=>n.dataset.v3Field),
      tableFields:[...pages.find(p=>p.querySelector('.prowheader_processed'))?.querySelectorAll('.prowheader_processed [data-v3-role=label]') || []].map(n=>n.dataset.v3Id),
      grids:['.v3-header .company-fields','.v3-customer','.v3-notes'].map(selector=>{
        const node=pages.map(p=>p.querySelector(selector)).find(Boolean);
        return node ? getComputedStyle(node).gridTemplateColumns.split(/\s+/).length : 0;
      })
    },
    money:[...pages.flatMap(p=>[...p.querySelectorAll('[data-pf-format=currency]')])].map(n=>{
      const range=document.createRange();range.selectNodeContents(n);const rs=[...range.getClientRects()].filter(r=>r.width&&r.height);
      const box=(n.closest('td,th,.field') || n.parentElement).getBoundingClientRect();
      return {id:n.dataset.v3Id,lines:new Set(rs.map(r=>Math.round(r.top))).size,
        fits:rs.every(r=>r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1)};
    }),
    pages:pages.map(p=>({headers:p.querySelectorAll('.pheader_processed').length,
      tableHeaders:p.querySelectorAll('.prowheader_processed').length,
      rows:[...p.querySelectorAll('.prowitem_processed')].map(n=>Number(n.dataset.pfRowIndex)),
      text:p.innerText.replace(/\s+/g,' ').trim()}))
  }));
  expect(result.money.length).toBeGreaterThan(0);
  expect(result.money.every(m=>m.lines===1 && m.fits)).toBe(true);
  expect(result.pages.length).toBeGreaterThan(1);
  expect(result.pages.every(p=>p.headers===1)).toBe(true);
  expect(result.pages.filter(p=>p.rows.length).every(p=>p.tableHeaders===1)).toBe(true);
  expect(result.pages.flatMap(p=>p.rows)).toEqual(Array.from({length:45},(_,i)=>i));
  return result;
}
export async function runRedesignLifecycle({page,context},info,fixtures) {
  const redesigns=fixtures || defaultRedesigns;
  const requests = [], errors = [], modelReplies = []; let index = 0;
  const livePlan = !fixtures && process.env.PRINTFORM_LIVE_REDESIGN ? await publicDemoPlanner(context) : null;
  page.on('pageerror', e=>errors.push(e.message)); page.on('dialog', d=>d.accept());
  // Deterministic model replies cover broad structural operations. No real
  // demo request, origin spoofing, credentials or server changes are involved.
  await page.route('https://gpt.yapweijun1996.com/demo/**', async route=> {
    const path = new URL(route.request().url()).pathname;
    let body;
    if (path.endsWith('/session')) body={token:'dmo_synthetic123456',expires_in:900};
    else if (path.endsWith('/models')) body={data:[{id:'demo-fast'},{id:'demo-auto'}]};
    else {
      const wire=route.request().postDataJSON();requests.push(wire);
      body=livePlan ? await livePlan(wire) : responsesReply(redesigns[Math.min(index++,1)],{total_tokens:20});
      modelReplies.push(replyText(body));
      await fs.writeFile(info.outputPath('model-replies.json'),JSON.stringify(modelReplies,null,2));
      await fs.writeFile(info.outputPath('repair-diagnostics.json'),JSON.stringify(requests.map(r=>JSON.parse(userText(r)).repair || null),null,2));
    }
    await route.fulfill({status:path.endsWith('/session')?201:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/studio-v3/'); await ready(page);
  const baseline = await inspect(page), total = await frame(page).locator('[data-v3-id=totals-total]').textContent();
  const initialDownload=page.waitForEvent('download'); await clickHeaderAction(page,'save');
  const initialPath=info.outputPath('baseline.printform.json'); await (await initialDownload).saveAs(initialPath);
  const baselineProject=JSON.parse(await fs.readFile(initialPath,'utf8'));
  await page.locator('[data-ai-toggle]').click();
  const evidence = {baseline,rounds:[]};
  for (const prompt of ['Redesign this invoice freely. Rebuild its structure, layout and typography, not just its colors.','Redesign it again with a different structure and typography.'].slice(0,redesigns.length)) {
    await page.locator('#ai-prompt').fill(prompt); await page.locator('[data-ai-send]').click();
    const revision=evidence.rounds.length+1,options={timeout:livePlan ? 150000 : 45000};
    await expect(page.locator('[data-ai-proposal]').or(page.locator(`.ai-change-card:has([data-ai=undo][title="Undo Revision ${revision}"])`))).toBeVisible(options);
    if (livePlan) {
      const operations=JSON.parse(modelReplies.at(-1)).operations || [];
      expect(operations.length).toBeLessThanOrEqual(24);
      expect(operations.some(o=>o.type==='set_section' && o.patch?.layout)).toBe(true);
      expect(operations.some(o=>['reorder_fields','reorder_sections'].includes(o.type))).toBe(true);
      expect(operations.some(o=>o.type==='set_element_style' || (o.type==='set_style' && o.patch?.font!==undefined))).toBe(true);
    }
    const operations=JSON.parse(modelReplies.at(-1)).operations || [];
    const automatic=operations.length>0 && operations.every(op=>operationAutoApplicable(op));
    let preview;
    if(!automatic) {
      await reviewCandidate(page);preview=await inspect(page);
      await page.locator('[data-ai=apply]').click();await ready(page);
    } else {
      await expectApplied(page,revision,options);await ready(page);preview=await inspect(page);
    }
    const applied = await inspect(page); expect(applied).toEqual(preview);
    expect(applied.structure).not.toEqual((evidence.rounds.at(-1)?.applied || baseline).structure);
    if (fixtures) {
      expect(applied.structure.grids[0]).toBe(evidence.rounds.length===0 ? 2 : 3);
      expect(applied.geometry.every(g=>g.margins.every(m=>m===14))).toBe(true);
    }
    expect(await frame(page).locator('[data-v3-id=totals-total]').textContent()).toBe(total);
    evidence.rounds.push({prompt,preview,applied});
  }
  if (livePlan) { expect(requests.length).toBeGreaterThanOrEqual(2);expect(requests.length).toBeLessThanOrEqual(6); }
  else expect(requests).toHaveLength(redesigns.length);
  await page.locator('[data-ai=undo]').click(); await ready(page);
  expect(await inspect(page)).toEqual(evidence.rounds.length > 1 ? evidence.rounds.at(-2).applied : baseline);
  await page.locator('[data-action=redo]').click(); await ready(page);
  const final = await inspect(page); expect(final).toEqual(evidence.rounds.at(-1).applied);
  const pending = page.waitForEvent('download'); await clickHeaderAction(page,'save');
  const download = await pending, saved = info.outputPath('redesign.printform.json'); await download.saveAs(saved);
  const savedProject=JSON.parse(await fs.readFile(saved,'utf8'));
  expect(savedProject.project.sampleData).toEqual(baselineProject.project.sampleData);
  await clickHeaderAction(page,'new'); await page.locator('[data-template=purchase]').click(); await ready(page);
  const chooser = page.waitForEvent('filechooser'); await clickHeaderAction(page,'open'); await (await chooser).setFiles(saved);
  await expect(page.locator('#document-name')).toHaveValue(savedProject.project.manifest.title);
  await expect(page.locator('#revision')).toContainText(`r${savedProject.project.revision}`);
  await ready(page);
  expect(await inspect(page)).toEqual(final);
  await page.locator('[data-mode=validate]').click();
  await expect(page.locator('#right-panel')).toContainText('Current browser layout passed.');
  const exportDownload=page.waitForEvent('download'); await clickHeaderAction(page,'export');
  const exportedPath=info.outputPath('redesigned-standalone.html'); await (await exportDownload).saveAs(exportedPath);
  const exported=await context.newPage(), outbound=[]; exported.on('request',r=>{if(/^https?:/.test(r.url()))outbound.push(r.url());});
  await exported.goto(pathToFileURL(exportedPath).href);
  await expect(exported.locator('html')).toHaveAttribute('data-printform-status','ready');
  const printed=await inspect(exported,exported);expect(printed).toEqual(final);
  const printedData=JSON.parse(await exported.locator('#pf-sample-data').textContent());
  expect(printedData).toEqual(savedProject.project.sampleData);expect(outbound).toEqual([]);
  const expectedMargins=savedProject.project.manifest.studioV3.page?.margins || {};
  expect(printed.geometry.every(p=>JSON.stringify(p.margins)===JSON.stringify(['top','right','bottom','left'].map(k=>expectedMargins[k] || 0)))).toBe(true);
  evidence.standalone={snapshot:printed,dataMatches:true,marginsMatch:true,outboundRequests:outbound};
  await exported.screenshot({path:info.outputPath('standalone-all-pages.png'),fullPage:true});
  await page.locator('[data-ai-toggle]').click();
  await page.screenshot({path:info.outputPath('redesign-desktop.png'),fullPage:true});
  const previewFrame = await page.locator('#preview-frame').elementHandle();
  const doc = await previewFrame.contentFrame();
  await doc.locator('.printform_page').nth(1).screenshot({path:info.outputPath('redesign-page2.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath('redesign-mobile.png'),fullPage:true});
  // Playwright's block-service-worker init script reads this getter inside
  // the intentionally opaque preview sandbox; preserve and classify that
  // runner-only error without weakening the application's sandbox.
  evidence.runnerErrors = errors.filter(e=>/service.?worker.*sandboxed.*allow-same-origin/i.test(e));
  expect(errors.filter(e=>!evidence.runnerErrors.includes(e))).toEqual([]);
  await fs.writeFile(info.outputPath('redesign-evidence.json'),JSON.stringify(evidence,null,2));
}
