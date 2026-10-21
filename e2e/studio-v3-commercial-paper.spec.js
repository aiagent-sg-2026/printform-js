import {clickHeaderAction} from './header-action.js';
import { test, expect } from './studio-v3-test.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { fictionalLongCommercialProject } from '../tests/fixtures/erp-business-acceptance.js';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30000 });
const fields = ['sku', 'description', 'quantity', 'rate', 'discount', 'amount'];
const currency = (value, manifest) => new Intl.NumberFormat(manifest.locale || 'en-MY', {
  style: 'currency', currency: manifest.currency
}).format(value);
const number = (value, manifest) => new Intl.NumberFormat(manifest.locale || 'en-MY').format(value);

// Aggregate fragments by the renderer's actual source index, never by DOM ordinal.
// A repeated/missing value on a continued row therefore cannot pass as preservation.
async function sourceRows(root) {
  return root.locator('.prowitem_processed').evaluateAll((nodes, fields) => {
    const rows = {}, order = [];
    for (const node of nodes) {
      const index = Number(node.dataset.pfRowIndex);
      order.push(index);
      rows[index] ||= Object.fromEntries(fields.map(field => [field, '']));
      for (const field of fields) rows[index][field] += node.querySelector(`[data-v3-id="items-${field}"]`)?.textContent || '';
    }
    return { rows, order };
  }, fields);
}

async function assertConsumer(root, project) {
  const { sampleData: data, manifest } = project;
  const actual = await sourceRows(root);
  const expected = Object.fromEntries(data.items.map((row, index) => [index, {
    sku: row.sku, description: row.description, quantity: number(row.quantity, manifest),
    rate: currency(row.rate, manifest), discount: currency(row.discount, manifest), amount: currency(row.amount, manifest)
  }]));
  expect(actual.rows).toEqual(expected);
  expect([...new Set(actual.order)]).toEqual(data.items.map((_, index) => index));
  expect(actual.order).toEqual([...actual.order].sort((a, b) => a - b));
  await expect(root.locator('[data-v3-id=header-company]').first()).toHaveText(data.company.name);
  await expect(root.locator('[data-v3-id=customer-bill]').first()).toHaveText(data.customer.name);
  await expect(root.locator('[data-v3-id=header-reference]').first()).toHaveText(data.document.reference);
  await expect(root.locator('[data-v3-id=totals-total]')).toHaveText(currency(data.summary.total, manifest));
  await expect(root.locator('[data-v3-id=totals]')).toHaveCount(1);
  await expect(root.locator('[data-v3-id=footer]')).toHaveCount(1);
  expect(await root.locator('.printform_page').count()).toBeGreaterThan(1);
  // Real text rectangles, not only scrollWidth or serialized source, must fit the sheet.
  const overflow = await root.locator('.printform_page').evaluateAll(pages => pages.flatMap(page => {
    const bounds = page.getBoundingClientRect();
    return [...page.querySelectorAll('[data-v3-role=value],.prowitem_processed td')].flatMap(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      return [...range.getClientRects()].filter(rect => rect.width && rect.height && (
        rect.left < bounds.left - 1 || rect.right > bounds.right + 1 ||
        rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1
      )).map(() => node.dataset.v3Id || node.tagName);
    });
  }));
  expect(overflow).toEqual([]);
}

for (const kind of ['SalesInvoice', 'PurchaseOrder', 'PurchaseInvoice']) {
  for (const paper of ['A4', 'LETTER']) {
    test(`${kind} ${paper}: long bilingual source facts survive pagination and portable print`, async ({ page, context, browserName }, info) => {
      page.on('dialog', dialog => dialog.accept());
      const project = fictionalLongCommercialProject(kind, paper);
      const name = `${kind}-${paper}`, input = saveProject(project);
      await page.goto('/studio-v3/'); await ready(page);
      await page.locator('#open-file').setInputFiles({
        name: `${name}.printform.json`, mimeType: 'application/json', buffer: Buffer.from(input)
      });
      await expect(page.locator('#document-name')).toHaveValue(project.manifest.title); await ready(page);
      const preview = page.frameLocator('#preview-frame');
      await assertConsumer(preview, project);
      if (kind === 'PurchaseInvoice') {
        await expect(preview.locator('[data-v3-id=header-supplier-invoice]').first()).toHaveText(project.sampleData.document.supplierInvoiceNumber);
        await expect(preview.locator('[data-v3-id=customer-ship]')).toHaveCount(0);
      }
      const saving = page.waitForEvent('download'); await clickHeaderAction(page,'save');
      const saved = await saving, savedPath = info.outputPath(`${name}.printform.json`); await saved.saveAs(savedPath);
      const serialized = await readFile(savedPath, 'utf8'), restored = readProject(serialized);
      expect(restored.sampleData).toEqual(project.sampleData);
      expect(restored.manifest.studioV3).toEqual(project.manifest.studioV3);
      await page.locator('#open-file').setInputFiles({
        name: `${name}-reopened.printform.json`, mimeType: 'application/json', buffer: Buffer.from(serialized)
      });
      await ready(page); await assertConsumer(preview, project);
      const exporting = page.waitForEvent('download'); await clickHeaderAction(page,'export');
      const exported = await exporting, htmlPath = info.outputPath(`${name}.html`); await exported.saveAs(htmlPath);
      const printed = await context.newPage();
      await printed.route(/^https?:/, route => route.abort());
      await printed.goto(pathToFileURL(htmlPath).href);
      await expect(printed.locator('html')).toHaveAttribute('data-printform-status', 'ready');
      await assertConsumer(printed, project);
      await printed.emulateMedia({ media: 'print' });
      const [width, height] = paper === 'A4' ? [794, 1123] : [816, 1056];
      const sheets = await printed.locator('.physical_page_wrapper').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect(); return [rect.width, rect.height];
      }));
      expect(sheets.length).toBeGreaterThan(1);
      for (const [actualWidth, actualHeight] of sheets) {
        expect(Math.abs(actualWidth - width)).toBeLessThan(1);
        expect(Math.abs(actualHeight - height)).toBeLessThan(1);
      }
      await printed.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
      if (browserName === 'chromium') await printed.pdf({ path: info.outputPath(`${name}.pdf`), preferCSSPageSize: true, printBackground: true });
      await printed.close();
    });
  }
}
