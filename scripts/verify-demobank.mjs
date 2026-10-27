import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { inspectDemoBank, assertDemoBank, inspectDemoBankPDF } from './demobank-checks.mjs';
const root=path.resolve(import.meta.dirname,'..');
const output=path.resolve(process.env.DEMOBANK_OUTPUT || path.join(root,'../output'));
const data=JSON.parse(await fs.readFile(path.join(root,'gallery/designs/assets/demobank/data.json'),'utf8'));
await fs.mkdir(output,{recursive:true});
execFileSync(process.execPath,['scripts/sync-demobank-data.mjs','--check'],{cwd:root});
const offline=path.join(output,'demobank-statement-offline.html');
execFileSync(process.execPath,['scripts/export-demobank.mjs',offline],{cwd:root});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
const findings={};
try {
  const page=await browser.newPage({viewport:{width:1200,height:1200}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'gallery/designs/demobank-fourpage-statement.html')).href);
  await page.waitForFunction(()=>window.DEMOBANK_READY);
  findings.desktop=await inspectDemoBank(page);
  await fs.writeFile(path.join(output,'demobank-layout.json'),JSON.stringify(findings.desktop,null,2));
  assertDemoBank(findings.desktop,data); assert.deepEqual(errors,[]);
  for(let i=0;i<4;i++) {
    const sheet=page.locator('.printform_page').nth(i);
    await sheet.screenshot({path:path.join(output,`demobank-page-${i+1}.png`)});
    if(i===0) await sheet.screenshot({path:path.join(root,'gallery/thumbs/demobank-fourpage-statement.png')});
  }
  for(const [label,selector] of [['summary','.account-summary'],['transactions','.tx-header'],['continued','.continuation-payment'],['rates','.rates'],['repayment','.repayment'],['qr','.qr-line']]) {
    await page.locator(selector).first().screenshot({path:path.join(output,`zoom-${label}.png`),scale:'css'});
  }
  // Decode pixels from the rendered SVG, not its accessibility label or data JSON.
  const require=createRequire(path.join(output,'verification-tools/package.json'));
  const {PNG}=require('pngjs'), jsQR=require('jsqr');
  const qr=page.locator('.qr-line img');
  const nativePNG=PNG.sync.read(await qr.screenshot());
  findings.nativeSizeQRPayload=jsQR(new Uint8ClampedArray(nativePNG.data),nativePNG.width,nativePNG.height)?.data || null;
  await qr.evaluate(n=>{n.style.width='240px';n.style.height='240px';});
  const png=PNG.sync.read(await qr.screenshot());
  const decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
  assert.equal(decoded?.data,data.qrPayload); findings.qrPayload=decoded.data;
  await qr.evaluate(n=>{n.style.removeProperty('width');n.style.removeProperty('height');});
  await page.emulateMedia({media:'print'});
  assertDemoBank(await inspectDemoBank(page),data);
  const bytes=await page.pdf({path:path.join(output,'demobank-statement.pdf'),preferCSSPageSize:true,printBackground:true});
  findings.pdf=await inspectDemoBankPDF(bytes,data);
  await page.emulateMedia({media:'screen'}); await page.setViewportSize({width:390,height:844});
  findings.mobileWidth=await page.locator('.printform_page').first().evaluate(n=>n.getBoundingClientRect().width);
  assert.ok(findings.mobileWidth>350 && findings.mobileWidth<390);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:path.join(output,'demobank-mobile.png')});
  await page.emulateMedia({media:'print'}); assertDemoBank(await inspectDemoBank(page),data);
  const context=await browser.newContext({offline:true,viewport:{width:1200,height:1200}});
  const local=await context.newPage(), network=[];
  local.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  local.on('pageerror',e=>errors.push(e.message));
  await local.goto(pathToFileURL(offline).href); await local.waitForFunction(()=>window.DEMOBANK_READY);
  assertDemoBank(await inspectDemoBank(local),data);
  await local.reload(); await local.waitForFunction(()=>window.DEMOBANK_READY);
  assertDemoBank(await inspectDemoBank(local),data); assert.deepEqual(network,[]);
  // Also start on a mobile viewport: pagination must be independent of screen zoom.
  await local.setViewportSize({width:390,height:844}); await local.reload();
  await local.waitForFunction(()=>window.DEMOBANK_READY);
  const mobileCoverage=await local.locator('[data-transaction-id]').evaluateAll(ns=>ns.map(n=>n.dataset.transactionId));
  assert.deepEqual(mobileCoverage,data.accounts.flatMap(a=>a.transactions.map(t=>t.id)));
  await local.emulateMedia({media:'print'}); assertDemoBank(await inspectDemoBank(local),data);
  findings.offline={networkRequests:network,errors,reload:true,mobileFreshLoad:true};
  assert.deepEqual(errors,[]); await context.close();
  await fs.writeFile(path.join(output,'demobank-verification.json'),JSON.stringify(findings,null,2));
  console.log('PASS: 4 A4 pages, exact 17 transactions, PDF text/bounds, QR pixels, mobile and offline reload.');
} finally {await browser.close();}
