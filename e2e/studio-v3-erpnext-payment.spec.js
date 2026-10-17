import { test, expect } from './studio-v3-test.js';
import { fictionalErpNextPayment, paymentEntryCases } from '../tests/fixtures/erpnext-payment.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { createErpNextPaymentEntryProject } from '../studio-v3/erpnext-payment-adapter.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30000 });
async function assertFacts(surface, sample) {
  await expect(surface.locator('[data-v3-id=header-number]').last()).toHaveText(sample.document.number);
  await expect(surface.locator('[data-v3-id=header-date]').last()).toHaveText('2026-10-15');
  await expect(surface.locator('[data-v3-id=header-status]').last()).toHaveText('Submitted');
  await expect(surface.locator('[data-v3-id=customer-party-account]').last()).toHaveText(sample.partyAccount.id);
  await expect(surface.locator('[data-v3-id=customer-party-account-currency]').last()).toHaveText('USD');
  await expect(surface.locator('[data-v3-id=totals-cash-movement]').last()).toHaveText('MYR 1000.000');
  await expect(surface.locator('[data-v3-id=totals-source-cash]').last()).toHaveText('USD 250.000');
  await expect(surface.locator('[data-v3-id=totals-party-unapplied-amount]').last()).toHaveText(sample.summary.partyUnappliedAmount.displayAmount);
  await expect(surface.locator('[data-v3-id=items-amount]')).toHaveText(sample.printRows.map(row => row.displayAmount));
  await expect(surface.locator('[data-v3-id=items-reference]')).toHaveText(sample.printRows.map(row => row.reference));
  await expect(surface.locator('[data-v3-id=totals-fx-difference],[data-v3-id=totals-unapplied-amount],[data-v3-id=header-bank-status],[data-v3-id=footer-approval-status],[data-v3-id=items-quantity]')).toHaveCount(0);
}
async function geometry(page) {
  const boxes = await page.locator('.physical_page_wrapper').evaluateAll(nodes => nodes.map(node => {
    const bounds = node.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height,
      outside: [...node.querySelectorAll('[data-v3-role=value],[data-v3-role=label],h1')].filter(value => {
        const r = value.getBoundingClientRect();
        return r.left < bounds.left - 1 || r.right > bounds.right + 1 || r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1;
      }).map(value => value.dataset.v3Id || value.tagName) };
  }));
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.width).toBeCloseTo(210 * 96 / 25.4, 0); expect(box.height).toBeCloseTo(297 * 96 / 25.4, 0);
    expect(box.outside).toEqual([]);
  }
  return boxes.length;
}
async function pdfFacts(bytes, sample, count) {
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
  try {
    const pdf = await loading.promise; expect(pdf.numPages).toBe(count);
    const texts = [];
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index), view = page.getViewport({ scale: 1 });
      expect(Math.abs(view.width - 210 * 72 / 25.4)).toBeLessThan(1);
      expect(Math.abs(view.height - 297 * 72 / 25.4)).toBeLessThan(1);
      const content = await page.getTextContent(); texts.push(content.items.map(item => item.str || '').join(' '));
      for (const item of content.items.filter(item => item.str?.trim())) {
        expect(item.transform[4]).toBeGreaterThanOrEqual(-1);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(view.width + 1);
        expect(item.transform[5]).toBeGreaterThanOrEqual(-1); expect(item.transform[5]).toBeLessThanOrEqual(view.height + 1);
      }
    }
    const text = texts.join(' ').replace(/\s+/g, ' ');
    for (const token of [sample.document.number, '2026-10-15', 'MYR 1000.000', 'USD 250.000', sample.summary.partyUnappliedAmount.displayAmount,
      ...sample.allocations.map(row => row.sourceReference.id), ...sample.printRows.map(row => row.displayAmount)]) expect(text).toContain(token);
  } finally { await loading.destroy(); }
}
for (const [name, type, advance, foreignInvoice] of paymentEntryCases) test(`${name}: public raw adapter, Open/save/reopen/offline and real PDF`, async ({ page, context, browserName }, info) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/studio-v3/'); await ready(page);
  const project = createErpNextPaymentEntryProject(fictionalErpNextPayment(type, advance, foreignInvoice));
  const sample = project.sampleData;
  await page.locator('#open-file').setInputFiles({ name: `${name}.printform.json`, mimeType: 'application/json', buffer: Buffer.from(saveProject(project)) });
  await ready(page); await expect(page.locator('#document-name')).toHaveValue(project.manifest.title);
  await assertFacts(page.frameLocator('#preview-frame'), sample);
  const saving = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const savedPath = info.outputPath(`${name}.printform.json`); await (await saving).saveAs(savedPath);
  expect(readProject(await readFile(savedPath, 'utf8')).sampleData).toEqual(sample);
  await page.locator('#open-file').setInputFiles(savedPath); await ready(page);
  await assertFacts(page.frameLocator('#preview-frame'), sample);
  const exporting = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const offlinePath = info.outputPath(`${name}.html`); await (await exporting).saveAs(offlinePath);
  const offline = await context.newPage(); await offline.route(/^https?:/, route => route.abort());
  try {
    await offline.goto(pathToFileURL(offlinePath).href);
    await expect(offline.locator('html')).toHaveAttribute('data-printform-status', 'ready');
    await assertFacts(offline, sample); await offline.emulateMedia({ media: 'print' });
    const count = await geometry(offline);
    expect(await offline.locator('table.prowitem_processed').evaluateAll(rows => rows.map(row => Number(row.dataset.pfRowIndex)))).toEqual(sample.printRows.map((_, index) => index));
    await offline.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
    if (browserName === 'chromium') {
      const bytes = await offline.pdf({ preferCSSPageSize: true, printBackground: true, scale: 1, displayHeaderFooter: false });
      await pdfFacts(bytes, sample, count); await info.attach(`${name}.pdf`, { body: bytes, contentType: 'application/pdf' });
    }
  } finally { await offline.close(); }
});
