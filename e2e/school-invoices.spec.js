import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test, expect } from '@playwright/test';
import { inspectInvoice, assertInvoice, independentTotals } from '../scripts/school-invoice-dom-checks.mjs';
const dir = path.resolve(__dirname, '../gallery/designs/assets/school-invoices');
const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json')));
const context = { window: {} }; vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(dir, 'math.js'), 'utf8'), context);
const lines = mode => JSON.parse(JSON.stringify(context.window.SchoolInvoiceMath.lines(data, mode)));
const ready = async page => {
  await page.waitForFunction(() => window.SCHOOL_READY || window.SCHOOL_ERROR);
  expect(await page.evaluate(() => window.SCHOOL_ERROR)).toBeNull();
};
test.use({ serviceWorkers: 'block' });
for (const style of data.styles) {
  for (const paper of ['A4', 'A5']) for (const mode of ['short', 'long']) {
    test(`PF-${style.number} ${paper} ${mode}: measured pages, exact rows and final-only totals`, async ({ page }) => {
      await page.goto(`/gallery/designs/${style.file}.html?paper=${paper}&sample=${mode}`); await ready(page);
      const items = lines(mode);
      assertInvoice(await inspectInvoice(page), paper, mode, independentTotals(data, items), items);
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('.controls')).toBeHidden();
    });
  }
  test(`PF-${style.number} mobile fresh load and keyboard switches have no stale pages`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/gallery/designs/${style.file}.html`); await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator('#paper').focus(); await page.keyboard.press('End');
    await expect(page.locator('#paper')).toHaveValue('A5');
    await page.waitForFunction(() => window.SCHOOL_READY && window.SCHOOL_RESULT.paper === 'A5');
    await page.keyboard.press('Tab'); await expect(page.locator('#sample')).toBeFocused();
    await page.keyboard.press('End');
    await page.waitForFunction(() => window.SCHOOL_READY && window.SCHOOL_RESULT.sample === 'long');
    await expect(page.locator('[data-line-id]')).toHaveCount(44);
    await page.locator('#sample').press('Home');
    await page.waitForFunction(() => window.SCHOOL_READY && window.SCHOOL_RESULT.sample === 'short');
    await expect(page.locator('.printform_page')).toHaveCount(1);
    await expect(page.locator('[data-line-id]')).toHaveCount(4);
  });
}
test('slow CJK font load cannot publish an empty gallery-ready state', async ({ page }) => {
  await page.route('**/DemoSchoolCJK-*.woff2', async route => {
    await new Promise(resolve => setTimeout(resolve, 600)); await route.continue();
  });
  await page.goto('/gallery/designs/bilingual-academy-invoice.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__printFormProcessed === true)).toBe(false);
  await ready(page);
  await expect(page.locator('.printform_page')).toHaveCount(1);
  expect(await page.evaluate(() => document.fonts.check('700 12px DemoSchoolCJK', '示例花桥学苑'))).toBe(true);
});
test('all six Sales cards open a ready, printable design in the gallery', async ({ page }) => {
  await page.goto('/gallery/index.html?category=sales&q=school');
  // The bilingual/enrichment names are intentionally searchable by PF number too.
  for (const style of data.styles) {
    await page.locator('#search').fill(`PF-${String(style.number).padStart(3, '0')}`);
    await expect(page.locator('.gallery-card')).toHaveCount(1);
    await page.locator('.gallery-card').click();
    await expect(page.locator('[data-print]')).toBeEnabled();
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('.printform_page')).toHaveCount(1);
    await expect(frame.locator('#print')).toBeEnabled();
    await page.locator('[data-close]').click();
  }
});
