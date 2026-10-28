import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { inspectPlacemat, assertPlacemat, inspectPlacematPDF } from './pf057-checks.mjs';
import { inspectDOMSafety, assertDOMSafety } from './pf057-print-safety.mjs';
const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(process.env.PF057_OUTPUT || path.join(root, '../output/pf057'));
const design = path.join(root, 'gallery/designs/demobank-bilingual-financing-placemat.html');
const data = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/pf057/data.json'), 'utf8'));
await fs.mkdir(output, { recursive: true });
const offline = path.join(output, 'pf057-offline.html');
execFileSync(process.execPath, [path.join(root, 'scripts/export-pf057.mjs'), offline]);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const findings = { node: process.version, browser: browser.version(), date: new Date().toISOString() };
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1250 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(design).href); await page.waitForFunction(() => window.PF057_READY);
  findings.formatAll = await page.evaluate(() => window.PF057_FORMAT_REPORT);
  findings.desktop = await inspectPlacemat(page); assertPlacemat(findings.desktop, data);
  findings.domSafety = await inspectDOMSafety(page); assertDOMSafety(findings.domSafety);
  for (let i = 0; i < 2; i++) {
    const sheet = page.locator('.printform_page').nth(i);
    await sheet.screenshot({ path: path.join(output, `pf057-page-${i + 1}.png`) });
    if (i === 0) await sheet.screenshot({ path: path.join(root, 'gallery/thumbs/demobank-bilingual-financing-placemat.png') });
  }
  await page.emulateMedia({ media: 'print' }); assertPlacemat(await inspectPlacemat(page), data);
  findings.printDOMSafety = await inspectDOMSafety(page); assertDOMSafety(findings.printDOMSafety);
  const pdf = await page.pdf({ path: path.join(output, 'pf057-demobank-placemat.pdf'), preferCSSPageSize: true, printBackground: true });
  findings.pdf = await inspectPlacematPDF(pdf, data);
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(pathToFileURL(design).href); await mobile.waitForFunction(() => window.PF057_READY);
  findings.mobile = { freshLoad: true, width: await mobile.locator('.printform_page').first().evaluate(n => n.getBoundingClientRect().width),
    noHorizontalOverflow: await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    pages: await mobile.locator('.printform_page').count() };
  assert.ok(findings.mobile.width > 350 && findings.mobile.width < 390); assert.ok(findings.mobile.noHorizontalOverflow);
  assert.equal(findings.mobile.pages, 2);
  await mobile.screenshot({ path: path.join(output, 'pf057-mobile-390.png') });
  await mobile.emulateMedia({ media: 'print' }); assertPlacemat(await inspectPlacemat(mobile), data);
  await mobile.emulateMedia({ media: 'screen' }); await mobile.setViewportSize({ width: 1200, height: 1250 });
  assertPlacemat(await inspectPlacemat(mobile), data); await mobile.close();
  const context = await browser.newContext({ offline: true, viewport: { width: 1200, height: 1250 } });
  const local = await context.newPage(), network = [];
  local.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
  local.on('pageerror', error => errors.push(error.message));
  await local.goto(pathToFileURL(offline).href); await local.waitForFunction(() => window.PF057_READY);
  assertPlacemat(await inspectPlacemat(local), data);
  await local.reload(); await local.waitForFunction(() => window.PF057_READY); assertPlacemat(await inspectPlacemat(local), data);
  await local.setViewportSize({ width: 390, height: 844 }); await local.reload(); await local.waitForFunction(() => window.PF057_READY);
  await local.emulateMedia({ media: 'print' }); assertPlacemat(await inspectPlacemat(local), data);
  assertDOMSafety(await inspectDOMSafety(local));
  findings.offlinePDF = await inspectPlacematPDF(await local.pdf({ preferCSSPageSize: true, printBackground: true }), data);
  assert.deepEqual(network, []); assert.deepEqual(errors, []);
  findings.offline = { reload: true, freshMobile: true, networkRequests: network, errors };
  await context.close();
  await fs.copyFile(path.join(root, 'gallery/designs/assets/pf057/data.json'), path.join(output, 'pf057-data.json'));
  await fs.writeFile(path.join(output, 'pf057-verification.json'), JSON.stringify(findings, null, 2));
  console.log('PASS: formatAll, 2 A4 pages, bilingual DOM/text bounds, exact grouped rates, selectable PDF with >=7.5pt critical fonts / >=5mm bottom bboxes, fresh 390px mobile, offline reload and PDF.');
} finally { await browser.close(); }
