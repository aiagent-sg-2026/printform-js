import { test, expect } from './studio-v3-test.js';
import { fictionalErpNextReturn, erpnextCases } from '../tests/fixtures/erpnext-return.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { createErpNextReturnProject } from '../studio-v3/erpnext-return-adapter.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30000 });
async function facts(paper, prefix, kind, inventory, accounting) {
  await expect(paper.locator('[data-v3-id=header-number]').last()).toHaveText(`${prefix}-RETURN-F`);
  await expect(paper.locator('[data-v3-id=header-source]').last()).toHaveText('ERPNext 15.0.0');
  await expect(paper.locator('[data-v3-id=header-kind]').last()).toHaveText(kind);
  await expect(paper.locator('[data-v3-id=header-currency]').last()).toHaveText('USD');
  await expect(paper.locator('[data-v3-id=customer-inventory]').last()).toHaveText(inventory);
  await expect(paper.locator('[data-v3-id=customer-accounting]').last()).toHaveText(accounting);
  await expect(paper.locator('[data-v3-id=items-value]')).toContainText(['-1.250 Box', 'USD 39.299', 'USD -49.123', 'SGD -66.378', 'USD -2.894', 'USD -49.123', 'USD -2.894', 'USD -52.017', 'USD -0.003', 'SGD -70.289']);
  const traces = await paper.locator('[data-v3-id=items-trace]').allTextContents();
  expect(traces.join(' ')).toContain(`${prefix}-ORIGINAL-LINE-2`);
  expect(traces.join(' ')).toContain('authorized-exact-export');
  await expect(paper.locator('[data-v3-id=totals-cash-movement],[data-v3-id=footer-bank-status],[data-v3-id=footer-approval-status]')).toHaveCount(0);
}
async function geometry(page) {
  const boxes = await page.locator('.physical_page_wrapper').evaluateAll(nodes => nodes.map(node => {
    const bounds = node.getBoundingClientRect();
    const outside = [...node.querySelectorAll('[data-v3-role=value],[data-v3-role=label],h1')].filter(value => {
      const rect = value.getBoundingClientRect();
      return rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1;
    }).map(value => value.dataset.v3Id || value.tagName);
    const rows = [...node.querySelectorAll('table.prowitem_processed')].map(row => row.getBoundingClientRect());
    return { width: bounds.width, height: bounds.height, outside, overlap: rows.some((row, index) => index && row.top < rows[index - 1].bottom - 1) };
  }));
  expect(boxes).toHaveLength(await page.locator('.printform_page').count());
  for (const box of boxes) {
    expect(box.width).toBeCloseTo(210 * 96 / 25.4, 0); expect(box.height).toBeCloseTo(297 * 96 / 25.4, 0);
    expect(box.outside).toEqual([]); expect(box.overlap).toBe(false);
  }
  return boxes.length;
}
async function pdfFacts(bytes, prefix, count) {
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }), content = [];
  try {
    const pdf = await loading.promise; expect(pdf.numPages).toBe(count);
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index), viewport = page.getViewport({ scale: 1 });
      expect(Math.abs(viewport.width - 210 * 72 / 25.4)).toBeLessThan(1);
      expect(Math.abs(viewport.height - 297 * 72 / 25.4)).toBeLessThan(1);
      const text = await page.getTextContent(); content.push(text.items.map(item => item.str || '').join(' '));
    }
    const text = content.join(' ').replace(/\s+/g, ' ');
    for (const value of [`${prefix}-RETURN-F`, `${prefix}-ORIGINAL-F`, `${prefix}-ORIGINAL-LINE-2`, 'USD -49.123', 'SGD -66.378', 'USD -52.017', 'SGD -70.289', '-1.250 Box']) expect(text).toContain(value);
  } finally { await loading.destroy(); }
}

for (const [name, doctype, stock, kind, inventory, accounting] of erpnextCases) test(`${name}: raw exact return survives Open/save/reopen/offline HTML and actual PDF`, async ({ page, context, browserName }, info) => {
  const prefix = doctype === 'Purchase Receipt' ? 'PR' : doctype === 'Sales Invoice' ? 'SI' : 'PI';
  const input = fictionalErpNextReturn(doctype, stock);
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/studio-v3/'); await ready(page);
  const project = createErpNextReturnProject(input);
  await page.locator('#open-file').setInputFiles({ name: `${name}.printform.json`, mimeType: 'application/json', buffer: Buffer.from(saveProject(project)) });
  await expect(page.locator('#document-name')).toHaveValue(project.manifest.title); await ready(page);
  await facts(page.frameLocator('#preview-frame'), prefix, kind, inventory, accounting);
  const savePromise = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const saved = await savePromise, savedPath = info.outputPath(`${name}.printform.json`); await saved.saveAs(savedPath);
  expect(readProject(await readFile(savedPath, 'utf8')).sampleData).toEqual(project.sampleData);
  await page.locator('#open-file').setInputFiles(savedPath); await ready(page);
  await facts(page.frameLocator('#preview-frame'), prefix, kind, inventory, accounting);
  const exportPromise = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const exported = await exportPromise, exportedPath = info.outputPath(`${name}.html`); await exported.saveAs(exportedPath);
  const printed = await context.newPage(); await printed.route(/^https?:/, route => route.abort());
  await printed.goto(pathToFileURL(exportedPath).href);
  await expect(printed.locator('html')).toHaveAttribute('data-printform-status', 'ready');
  await facts(printed, prefix, kind, inventory, accounting);
  expect(await printed.locator('table.prowitem_processed').evaluateAll(nodes => nodes.map(node => Number(node.dataset.pfRowIndex)))).toEqual(project.sampleData.printRows.map((_, index) => index));
  await printed.emulateMedia({ media: 'print' }); const count = await geometry(printed);
  await printed.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  if (browserName === 'chromium') {
    const bytes = await printed.pdf({ path: info.outputPath(`${name}.pdf`), preferCSSPageSize: true, printBackground: true });
    await pdfFacts(bytes, prefix, count); await info.attach(`${name}.pdf`, { body: bytes, contentType: 'application/pdf' });
  }
  await printed.close();
});
