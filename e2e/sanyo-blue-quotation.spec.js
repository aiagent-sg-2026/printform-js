import { test, expect } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

async function assertLayout(page) {
  await page.waitForFunction(() => window.__printFormProcessed === true);
  const pages = page.locator('.printform_page');
  await expect(pages).toHaveCount(5);
  const metrics = await pages.evaluateAll(pages => pages.map(page => {
    const bounds = page.getBoundingClientRect();
    return {
      rows: [...page.querySelectorAll('[data-sample-row]')].map(row => Number(row.dataset.sampleRow)),
      total: page.querySelectorAll('#total').length,
      header: page.querySelectorAll('h1').length,
      tableHeader: page.querySelectorAll('.column-head').length,
      number: page.querySelector('[data-page-number]')?.textContent,
      count: page.querySelector('[data-page-total]')?.textContent,
      outside: [...page.querySelectorAll('.item-grid,.summary,.terms,.acceptance,.page-foot,.brand,.parties')]
        .filter(node => {
          const box = node.getBoundingClientRect();
          return box.left < bounds.left - .1 || box.right > bounds.right + .1 ||
            box.top < bounds.top - .1 || box.bottom > bounds.bottom + .1;
        }).map(node => node.className)
    };
  }));
  expect(metrics.flatMap(item => item.rows)).toEqual(Array.from({ length: 48 }, (_, index) => index + 1));
  expect(metrics.map(item => item.total)).toEqual([0, 0, 0, 0, 1]);
  for (const [index, item] of metrics.entries()) {
    expect(item.rows.length).toBeGreaterThan(0);
    expect(item.header).toBe(1);
    expect(item.tableHeader).toBe(1);
    expect(item.number).toBe(String(index + 1));
    expect(item.count).toBe('5');
    expect(item.outside).toEqual([]);
  }
  await expect(page.locator('#total')).toHaveText('38,114.00');
}

test('PF054 real engine produces five complete A4 PDF pages with all 48 unique rows', async ({ page, browserName }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/gallery/designs/sanyo-blue-sales-quotation.html');
  await assertLayout(page);
  expect(errors).toEqual([]);
  if (browserName !== 'chromium') return;
  const bytes = await page.pdf({ path: testInfo.outputPath('sanyo-blue-five-pages.pdf'), preferCSSPageSize: true, printBackground: true });
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
  const pdf = await loading.promise;
  try {
    expect(pdf.numPages).toBe(5);
    const texts = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const sheet = await pdf.getPage(number);
      const view = sheet.getViewport({ scale: 1 });
      expect(Math.abs(view.width - 595.276)).toBeLessThan(.5);
      expect(Math.abs(view.height - 841.89)).toBeLessThan(.5);
      const content = await sheet.getTextContent();
      const text = content.items.map(item => item.str).join(' ');
      expect(text).toContain('SANYO SINGAPORE PTE LTD');
      expect(text).toContain(`Page ${number} / 5`);
      expect(text).toContain('DEMO-');
      expect(text.includes('Quotation total')).toBe(number === 5);
      texts.push(text);
    }
    const models = texts.join(' ').match(/DEMO-[A-Z]{2}-\d{3}-\d{3}/g);
    expect(models).toHaveLength(48);
    expect(new Set(models).size).toBe(48);
    expect(texts.at(-1)).toContain('38,114.00');
  } finally { await loading.destroy(); }
});

test('PF054 standalone HTML rerenders five pages without network access', async ({ browser }, testInfo) => {
  const output = testInfo.outputPath('sanyo-blue-offline.html');
  execFileSync(process.execPath, ['scripts/export-sanyo-blue-quotation.mjs', output]);
  const context = await browser.newContext({ offline: true });
  try {
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(output).href);
    await assertLayout(page);
    await page.reload();
    await assertLayout(page);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
