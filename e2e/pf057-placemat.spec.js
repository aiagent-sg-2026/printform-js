import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { inspectPlacemat, assertPlacemat, inspectPlacematPDF } from '../scripts/pf057-checks.mjs';
import { inspectDOMSafety, assertDOMSafety, pdfRuns, measurePDFSafety, safetyCopy, assertPDFSafety } from '../scripts/pf057-print-safety.mjs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const data = JSON.parse(fs.readFileSync('gallery/designs/assets/pf057/data.json', 'utf8'));
const url = '/gallery/designs/demobank-bilingual-financing-placemat.html';
const ready = page => page.waitForFunction(() => window.PF057_READY);
const warning = 'SAMPLE — FICTIONAL FINANCING DEMONSTRATION';
async function printedSafety(page) {
  const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
  try {
    const pdf = await loading.promise, safety = [];
    expect(pdf.numPages).toBe(2);
    for (let i = 1; i <= 2; i++) {
      const sheet = await pdf.getPage(i), view = sheet.getViewport({ scale: 1 });
      safety.push(measurePDFSafety(pdfRuns(await sheet.getTextContent(), view.height), view.width, view.height,
        safetyCopy(data.translations[i === 1 ? 'en' : 'ms'], warning)));
    }
    return safety;
  } finally { await loading.destroy(); }
}

test('PF057 guard reproduces original 1.3mm / 5.4pt unsafe footer on actual PDF', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Actual PDF requires Chromium');
  await page.goto(url); await ready(page); await page.emulateMedia({ media: 'print' });
  // Old footer began at y=1023 CSSpx. Reproduce its exact typography/placement
  // without retaining an unsafe production template or depending on Git history.
  await page.addStyleTag({ content: `
    .pf057 .pf057-footer { position: relative; top: 25px; height: 95.519685px; padding: 12px 31px 9px; }
    .pf057 .pf057-footer-top small { font-size: 7px; }
    .pf057 .pf057-footer-top > div:last-child b { font-size: 9px; }
    .pf057 .pf057-warning { padding-top: 5px; margin-top: 6px; }
    .pf057 .pf057-warning strong { font-size: 9.2px; }
    .pf057 .pf057-warning span { font-size: 7.2px; }
  ` });
  const dom = await inspectDOMSafety(page);
  expect(() => assertDOMSafety(dom)).toThrow(/DOM safety/);
  for (const [i, safety] of (await printedSafety(page)).entries()) {
    expect(safety.critical.find(n => n.text === data.translations[i === 0 ? 'en' : 'ms'].localWarning).minSizePt).toBeCloseTo(5.4, 2);
    expect(safety.critical.find(n => n.text === warning).minSizePt).toBeCloseTo(6.9, 2);
    expect(safety.lowestBottomMarginMm).toBeGreaterThan(1.2);
    expect(safety.lowestBottomMarginMm).toBeLessThan(1.4);
    expect(() => assertPDFSafety(safety, i + 1)).toThrow(/PDF safety font/);
  }
});

test('PF057 PDF bottom guard rejects readable but unsafe low-positioned warnings', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Actual PDF requires Chromium');
  await page.goto(url); await ready(page); await page.emulateMedia({ media: 'print' });
  await page.addStyleTag({ content: '.pf057 .pf057-warning { position: relative; top: 18px; }' });
  const dom = await inspectDOMSafety(page);
  expect(() => assertDOMSafety(dom)).toThrow(/DOM safety bottom/);
  for (const [i, safety] of (await printedSafety(page)).entries()) {
    expect(safety.minCriticalSizePt).toBeGreaterThan(7.5);
    expect(safety.lowestBottomMarginMm).toBeLessThan(5);
    expect(() => assertPDFSafety(safety, i + 1)).toThrow(/PDF safety bottom/);
  }
});

test('PF057 real formatAll: bilingual grouped rates, warnings, bounds and selectable A4 PDF', async ({ page, browserName }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await ready(page);
  assertPlacemat(await inspectPlacemat(page), data);
  const result = await page.evaluate(() => window.PF057_FORMAT_REPORT);
  expect(result.failedCount).toBe(0);
  await page.emulateMedia({ media: 'print' }); assertPlacemat(await inspectPlacemat(page), data);
  assertDOMSafety(await inspectDOMSafety(page));
  if (browserName === 'chromium') await inspectPlacematPDF(await page.pdf({ preferCSSPageSize: true, printBackground: true }), data);
  expect(errors).toEqual([]);
});

test('PF057 fresh 390px preview and resized print retain complete data', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url); await ready(page);
  expect(await page.locator('.printform_page').count()).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const width = await page.locator('.printform_page').first().evaluate(n => n.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(350); expect(width).toBeLessThan(390);
  await page.emulateMedia({ media: 'print' }); assertPlacemat(await inspectPlacemat(page), data);
  await page.emulateMedia({ media: 'screen' }); await page.setViewportSize({ width: 1200, height: 1100 });
  assertPlacemat(await inspectPlacemat(page), data);
});

test('PF057 self-contained export reloads with networking disabled', async ({ browser }, testInfo) => {
  const file = testInfo.outputPath('pf057-offline.html');
  execFileSync(process.execPath, ['scripts/export-pf057.mjs', file]);
  const context = await browser.newContext({ offline: true, viewport: { width: 1200, height: 1250 } });
  try {
    const page = await context.newPage(), requests = [], errors = [];
    page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(file).href); await ready(page); assertPlacemat(await inspectPlacemat(page), data);
    await page.reload(); await ready(page); assertPlacemat(await inspectPlacemat(page), data);
    expect(requests).toEqual([]); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('PF057 gallery filters and preview expose the bilingual brochure', async ({ page }) => {
  await page.goto('/gallery/index.html?category=finance&q=PF-057');
  await expect(page.locator('.gallery-card')).toHaveCount(1);
  await expect(page.locator('#result-count')).toHaveText('1/63 design');
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('.printform_page')).toHaveCount(2);
  await expect(frame.locator('.pf057-warning')).toHaveCount(2);
  await expect(frame.locator('[lang="ms"] h1')).toContainText('Rancang masa depan.');
});
