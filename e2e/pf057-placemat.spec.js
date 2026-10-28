import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { inspectPlacemat, assertPlacemat, inspectPlacematPDF } from '../scripts/pf057-checks.mjs';
const data = JSON.parse(fs.readFileSync('gallery/designs/assets/pf057/data.json', 'utf8'));
const url = '/gallery/designs/demobank-bilingual-financing-placemat.html';
const ready = page => page.waitForFunction(() => window.PF057_READY);

test('PF057 real formatAll: bilingual grouped rates, warnings, bounds and selectable A4 PDF', async ({ page, browserName }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await ready(page);
  assertPlacemat(await inspectPlacemat(page), data);
  const result = await page.evaluate(() => window.PF057_FORMAT_REPORT);
  expect(result.failedCount).toBe(0);
  await page.emulateMedia({ media: 'print' }); assertPlacemat(await inspectPlacemat(page), data);
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
  await expect(page.locator('#result-count')).toHaveText('1/57 design');
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('.printform_page')).toHaveCount(2);
  await expect(frame.locator('.pf057-warning')).toHaveCount(2);
  await expect(frame.locator('[lang="ms"] h1')).toContainText('Rancang masa depan.');
});
