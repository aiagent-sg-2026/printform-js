import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { inspectDemoBank, assertDemoBank, inspectDemoBankPDF } from '../scripts/demobank-checks.mjs';
const data=JSON.parse(fs.readFileSync('gallery/designs/assets/demobank/data.json','utf8'));
const ready=page=>page.waitForFunction(()=>window.DEMOBANK_READY);

test('PF056 actual engine preserves 4 A4 pages, exact transactions, header hierarchy and selectable PDF',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/gallery/designs/demobank-fourpage-statement.html');await ready(page);
  const report=await inspectDemoBank(page);assertDemoBank(report,data);
  expect(report[0].text).toContain('3,590.50');expect(report[0].text).toContain('179.53');
  expect(report[1].tableColumns).toHaveLength(6);
  report[2].tableColumns.forEach((c,i)=>{
    const first=report[1].tableColumns[i];
    expect(c.x).toBeCloseTo(first.x,2);expect(c.width).toBeCloseTo(first.width,2);
    expect(c.height).toBeCloseTo(first.height,2);expect(c.y-first.y).toBeCloseTo(22.56,1);
  });
  for(let i=0;i<4;i++)await page.locator('.printform_page').nth(i).screenshot({path:testInfo.outputPath(`demobank-page-${i+1}.png`)});
  await page.emulateMedia({media:'print'});assertDemoBank(await inspectDemoBank(page),data);
  const bytes=await page.pdf({path:testInfo.outputPath('demobank.pdf'),preferCSSPageSize:true,printBackground:true});
  await inspectDemoBankPDF(bytes,data);expect(errors).toEqual([]);
});

test('PF056 fresh mobile load scales only after measurement and keeps print geometry',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/gallery/designs/demobank-fourpage-statement.html');await ready(page);
  expect(await page.locator('.printform_page').count()).toBe(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const width=await page.locator('.printform_page').first().evaluate(n=>n.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(350);expect(width).toBeLessThan(390);
  await page.emulateMedia({media:'print'});assertDemoBank(await inspectDemoBank(page),data);
  await page.setViewportSize({width:1200,height:1000});await page.emulateMedia({media:'screen'});
  assertDemoBank(await inspectDemoBank(page),data);
});

test('PF056 standalone HTML is self-contained, offline and reloadable',async({browser},testInfo)=>{
  const file=testInfo.outputPath('demobank-offline.html');
  execFileSync(process.execPath,['scripts/export-demobank.mjs',file]);
  const context=await browser.newContext({offline:true,viewport:{width:1200,height:1200}});
  try {
    const page=await context.newPage(),requests=[],errors=[];
    page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(file).href);await ready(page);assertDemoBank(await inspectDemoBank(page),data);
    await page.reload();await ready(page);assertDemoBank(await inspectDemoBank(page),data);
    expect(requests).toEqual([]);expect(errors).toEqual([]);
  }finally{await context.close();}
});
