import { test, expect } from './studio-v3-test.js';
import { createErpSettlementProject } from '../studio-v3/erp-settlement-project.js';
import { fictionalMixedReceipt, fictionalAdjustedPayment, fictionalAdvance } from '../tests/fixtures/erp-settlement.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30000 });
const cases = [
  ['multi-currency-receipt', fictionalMixedReceipt], ['adjusted-payment', fictionalAdjustedPayment],
  ['unallocated-receipt', () => fictionalAdvance('BankReceipt')], ['unallocated-payment', () => fictionalAdvance('BankPayment')]
];

for (const [name, fixture] of cases) test(`${name}: supplied settlement survives Open, save, reopen and offline print export`, async ({ page, context, browserName }, info) => {
  page.on('dialog', dialog => dialog.accept());
  const input = fixture(), project = createErpSettlementProject(input), rows = project.sampleData.printRows;
  await page.goto('/studio-v3/'); await ready(page);
  await page.locator('#open-file').setInputFiles({ name: `${name}.printform.json`, mimeType: 'application/json', buffer: Buffer.from(saveProject(project)) });
  await expect(page.locator('#document-name')).toHaveValue(project.manifest.title); await ready(page);
  const paper = page.frameLocator('#preview-frame');
  await expect(paper.locator('[data-v3-id=totals-cash-movement]').last()).toHaveText(project.sampleData.cashMovement.amount.displayAmount);
  await expect(paper.locator('[data-v3-id=totals-unapplied-amount]').last()).toHaveText(project.sampleData.summary.unappliedAmount.displayAmount);
  await expect(paper.locator('table.prowitem_processed')).toHaveCount(rows.length);
  if (rows.length) {
    await expect(paper.locator('[data-v3-id=items-amount]')).toHaveText(rows.map(row => row.displayAmount));
    await expect(paper.locator('[data-v3-id=items-metric]')).toHaveText(rows.map(row => row.label));
    await expect(paper.locator('[data-v3-id=header-bank-status]').last()).toHaveText('Not bank-reconciled');
  } else {
    await expect(paper.locator('[data-v3-id=header-mode]').last()).toHaveText(project.sampleData.printMode);
    await expect(paper.locator('[data-v3-id=totals-remaining-balance],[data-v3-id=totals-cash-applied-amount],[data-v3-id=header-bank-status],[data-v3-id=footer-approval-status]')).toHaveCount(0);
  }
  await expect(paper.locator('[data-v3-id=items-sku],[data-v3-id=items-quantity],[data-v3-id=totals-tax],[data-v3-id=totals-invoice-cleared-amount]')).toHaveCount(0);
  const savedPromise = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const saved = await savedPromise, savedPath = info.outputPath(`${name}.printform.json`); await saved.saveAs(savedPath);
  const restored = readProject(await readFile(savedPath, 'utf8'));
  expect(restored.sampleData).toEqual(project.sampleData);
  await page.locator('#open-file').setInputFiles(savedPath); await ready(page);
  await expect(paper.locator('[data-v3-id=totals-unapplied-amount]').last()).toHaveText(project.sampleData.summary.unappliedAmount.displayAmount);
  const exportedPromise = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const exported = await exportedPromise, exportedPath = info.outputPath(`${name}.html`); await exported.saveAs(exportedPath);
  const printed = await context.newPage();
  await printed.route(/^https?:/, route => route.abort());
  await printed.goto(pathToFileURL(exportedPath).href);
  await expect(printed.locator('html')).toHaveAttribute('data-printform-status', 'ready');
  await expect(printed.locator('[data-v3-id=totals-cash-movement]').last()).toHaveText(project.sampleData.cashMovement.amount.displayAmount);
  await expect(printed.locator('[data-v3-id=totals-unapplied-amount]').last()).toHaveText(project.sampleData.summary.unappliedAmount.displayAmount);
  await expect(printed.locator('[data-v3-id=items-amount]')).toHaveText(rows.map(row => row.displayAmount));
  expect(await printed.locator('table.prowitem_processed').evaluateAll(nodes => nodes.map(node => Number(node.dataset.pfRowIndex)))).toEqual(rows.map((_, index) => index));
  if (name === 'multi-currency-receipt') {
    await expect(printed.locator('[data-v3-id=totals-remaining-balance]').last()).toHaveText('SGD 95.000');
    await expect(printed.locator('[data-v3-id=totals-cash-applied-amount]').last()).toHaveText('MYR 1000.000');
    await expect(printed.locator('[data-v3-id=totals-source-cash]').last()).toHaveText('USD 250.000');
    await expect(printed.locator('[data-v3-id=totals-fx-difference]').last()).toHaveText('MYR 1.234');
  }
  const overflow = await printed.locator('.printform_page').evaluateAll(pages => pages.flatMap(page => {
    const bounds = page.getBoundingClientRect();
    return [...page.querySelectorAll('[data-v3-role=value],h1')].filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.right > bounds.right + 1 || rect.left < bounds.left - 1 || rect.bottom > bounds.bottom + 1;
    }).map(node => node.dataset.v3Id);
  }));
  expect(overflow).toEqual([]);
  await printed.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  if (browserName === 'chromium') await printed.pdf({ path: info.outputPath(`${name}.pdf`), preferCSSPageSize: true, printBackground: true });
  await printed.close();
});
