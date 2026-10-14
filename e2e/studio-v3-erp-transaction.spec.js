import { test, expect } from './studio-v3-test.js';
import { createErpTransactionProject } from '../studio-v3/erp-transaction-project.js';
import { transactionJourneyCases } from '../tests/fixtures/erp-transaction.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30000 });
async function assertFacts(paper, project) {
  const data = project.sampleData;
  await expect(paper.locator('[data-v3-id=header-source-id]').last()).toHaveText(data.source.id);
  await expect(paper.locator('[data-v3-id=header-number]').last()).toHaveText(data.document.number);
  await expect(paper.locator('[data-v3-id=header-kind]').last()).toHaveText(data.document.kind);
  await expect(paper.locator('[data-v3-id=customer-party-id]').last()).toHaveText(data.party.id);
  await expect(paper.locator('[data-v3-id=header-company]').last()).toHaveText(data.company.name);
  await expect(paper.locator('[data-v3-id=header-source]').last()).toHaveText(data.source.system);
  await expect(paper.locator('[data-v3-id=header-source-type]').last()).toHaveText(data.source.documentType);
  await expect(paper.locator('[data-v3-id=header-date]').last()).toHaveText(data.document.date);
  await expect(paper.locator('[data-v3-id=header-currency]').last()).toHaveText(data.document.currency);
  await expect(paper.locator('[data-v3-id=customer-party]').last()).toHaveText(data.party.name);
  await expect(paper.locator('[data-v3-id=customer-extent]').last()).toHaveText(data.scope.extent);
  await expect(paper.locator('[data-v3-id=customer-scope-source]').last()).toHaveText(data.scope.provenance.sourcePath);
  await expect(paper.locator('[data-v3-id=customer-inventory-source]').last()).toHaveText(data.effects.inventory.provenance.sourcePath);
  await expect(paper.locator('[data-v3-id=customer-accounting-source]').last()).toHaveText(data.effects.accounting.provenance.sourcePath);
  await expect(paper.locator('[data-v3-id=customer-company-id]').last()).toHaveText(data.company.id);
  await expect(paper.locator('[data-v3-id=customer-inventory]').last()).toHaveText(data.effects.inventory.direction);
  await expect(paper.locator('[data-v3-id=customer-accounting]').last()).toHaveText(data.effects.accounting.direction);
  await expect(paper.locator('table.prowitem_processed')).toHaveCount(data.printRows.length);
  for (const [id, key] of [['value', 'value'], ['meaning', 'meaning'], ['trace', 'trace'], ['direction', 'direction']]) {
    await expect(paper.locator(`[data-v3-id=items-${id}]`)).toHaveText(data.printRows.map(row => row[key]));
  }
  if (data.cashMovement) {
    await expect(paper.locator('[data-v3-id=totals-cash-movement]').last()).toHaveText(data.cashMovement.amount.displayAmount);
    if (data.cashMovement.sourceAmount) await expect(paper.locator('[data-v3-id=totals-source-cash]').last()).toHaveText(data.cashMovement.sourceAmount.displayAmount);
  } else await expect(paper.locator('[data-v3-id=totals-cash-movement],[data-v3-id=footer-bank-status]')).toHaveCount(0);
  await expect(paper.locator('[data-v3-id=items-sku],[data-v3-id=totals-total],[data-v3-id=totals-tax],[data-v3-id=footer-approval-status]')).toHaveCount(0);
  if (!data.bank) await expect(paper.locator('[data-v3-id=footer-bank-status]')).toHaveCount(0);
  else await expect(paper.locator('[data-v3-id=footer-bank-status]').last()).toHaveText('Not bank-reconciled');
}
async function assertGeometry(page) {
  const result = await page.locator('.physical_page_wrapper').evaluateAll(pages => pages.map(page => {
    const bounds = page.getBoundingClientRect();
    const values = [...page.querySelectorAll('[data-v3-role=value],[data-v3-role=label],h1')];
    const outside = values.filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1;
    }).map(node => node.dataset.v3Id || node.tagName);
    const rows = [...page.querySelectorAll('table.prowitem_processed')].map(node => node.getBoundingClientRect());
    return { width: bounds.width, height: bounds.height, outside,
      overlapping: rows.some((row, index) => index > 0 && row.top < rows[index - 1].bottom - 1) };
  }));
  expect(result.length).toBeGreaterThan(0);
  result.forEach(page => {
    expect(page.width).toBeCloseTo(210 * 96 / 25.4, 0); expect(page.height).toBeCloseTo(297 * 96 / 25.4, 0);
    expect(page.outside).toEqual([]); expect(page.overlapping).toBe(false);
  });
  return result.length;
}
async function assertPdf(bytes, project, pageCount) {
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
  const pdf = await loading.promise, text = [];
  try {
    expect(pdf.numPages).toBe(pageCount);
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index), viewport = page.getViewport({ scale: 1 });
      expect(Math.abs(viewport.width - 210 * 72 / 25.4)).toBeLessThan(1);
      expect(Math.abs(viewport.height - 297 * 72 / 25.4)).toBeLessThan(1);
      const content = await page.getTextContent();
      const items = content.items.filter(item => typeof item.str === 'string');
      for (const item of items.filter(item => item.str.trim())) {
        expect(item.transform[4]).toBeGreaterThanOrEqual(-1);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(item.transform[5]).toBeGreaterThanOrEqual(-1);
        expect(item.transform[5]).toBeLessThanOrEqual(viewport.height + 1);
      }
      text.push(items.map(item => item.str).join(' '));
    }
    const extracted = text.join(' ').replace(/\s+/g, ' '), data = project.sampleData;
    for (const expected of [data.source.id, data.document.number, data.party.id, data.company.id, data.references[0].document.id]) expect(extracted).toContain(expected);
    for (const row of data.printRows.filter(row => row.money || row.quantity)) expect(extracted).toContain(row.value);
    for (const fact of data.summary || []) expect(extracted).toContain(fact.amount.displayAmount);
    if (data.cashMovement) {
      expect(extracted).toContain(data.cashMovement.amount.displayAmount);
      expect(extracted).toContain(data.cashMovement.sourceAmount.displayAmount);
    }
    expect(extracted).toContain('No accounting posting');
  } finally { await loading.destroy(); }
}

for (const [name, fixture] of transactionJourneyCases) test(`${name}: real facts survive Open/save/reopen/offline export and actual PDF`, async ({ page, context, browserName }, info) => {
  page.on('dialog', dialog => dialog.accept());
  const project = createErpTransactionProject(fixture());
  await page.goto('/studio-v3/'); await ready(page);
  await page.locator('#open-file').setInputFiles({ name: `${name}.printform.json`, mimeType: 'application/json', buffer: Buffer.from(saveProject(project)) });
  await expect(page.locator('#document-name')).toHaveValue(project.manifest.title); await ready(page);
  await assertFacts(page.frameLocator('#preview-frame'), project);
  const savePromise = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const saved = await savePromise, savedPath = info.outputPath(`${name}.printform.json`); await saved.saveAs(savedPath);
  expect(readProject(await readFile(savedPath, 'utf8')).sampleData).toEqual(project.sampleData);
  await page.locator('#open-file').setInputFiles(savedPath); await ready(page);
  await assertFacts(page.frameLocator('#preview-frame'), project);
  const exportPromise = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const exported = await exportPromise, exportedPath = info.outputPath(`${name}.html`); await exported.saveAs(exportedPath);
  const printed = await context.newPage();
  await printed.route(/^https?:/, route => route.abort());
  await printed.goto(pathToFileURL(exportedPath).href);
  await expect(printed.locator('html')).toHaveAttribute('data-printform-status', 'ready');
  await assertFacts(printed, project);
  expect(await printed.locator('table.prowitem_processed').evaluateAll(nodes => nodes.map(node => Number(node.dataset.pfRowIndex)))).toEqual(project.sampleData.printRows.map((_, index) => index));
  await printed.emulateMedia({ media: 'print' });
  const pageCount = await assertGeometry(printed);
  await printed.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  if (browserName === 'chromium') {
    const bytes = await printed.pdf({ path: info.outputPath(`${name}.pdf`), preferCSSPageSize: true, printBackground: true });
    await assertPdf(bytes, project, pageCount);
    await info.attach(`${name}.pdf`, { body: bytes, contentType: 'application/pdf' });
  }
  await printed.close();
});
