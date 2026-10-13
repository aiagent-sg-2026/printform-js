import { test, expect } from './studio-v3-test.js';
import { createGlobe3CertifiedClaimProject, createGlobe3ProgressClaimProject } from '../studio-v3/globe3-claim-project.js';
import { globe3ClaimInput } from '../tests/fixtures/globe3-certified-claim.js';
import { demoStarterRecords } from '../studio-v3/demo-catalog.js';
import { saveProject } from '../studio-v3/file-io.js';
import { pathToFileURL } from 'node:url';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30000 });
const open = async (page, project) => {
  await page.locator('#open-file').setInputFiles({ name: 'fictional-claim.printform.json', mimeType: 'application/json', buffer: Buffer.from(saveProject(project)) });
  await expect(page.locator('#document-name')).toHaveValue(project.manifest.title);
  await ready(page);
};

for (const kind of ['CCAR', 'PCAR']) test(`${kind}: supplied three-decimal projection survives Studio Open, save and offline export`, async ({ page, context, browserName }, info) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/studio-v3/'); await ready(page);
  let project, amount, expectedRows;
  if (kind === 'CCAR') {
    const input = globe3ClaimInput();
    input.header.curr_decimal = '3'; input.header.creditterm_desc = 'Fictional certificate snapshot terms';
    input.tabData[0].num_20_2_d0_010 = '3790.471';
    project = createGlobe3CertifiedClaimProject(input); amount = 'SGD 3790.471'; expectedRows = 17;
  } else {
    const data = structuredClone(demoStarterRecords('PCAR')[1].data);
    data.document.sourceType = 'entp_pbill'; data.document.minorUnitDigits = 3;
    data.claim.basisProfile = 'globe3-stored-last-claim';
    data.summary.total = '5028.221';
    delete data.summary.paidAmount; delete data.summary.outstandingAmount;
    project = createGlobe3ProgressClaimProject(data); amount = 'MYR 5028.221'; expectedRows = data.items.length;
  }
  await open(page, project);
  const paper = page.frameLocator('#preview-frame');
  await expect(paper.locator('[data-v3-id=totals-total]').last()).toHaveText(amount);
  await expect(paper.locator('table.prowitem_processed')).toHaveCount(expectedRows);
  await expect(paper.locator('[data-v3-id=totals-paid-amount],[data-v3-id=totals-outstanding-amount]')).toHaveCount(0);
  if (kind === 'CCAR') {
    await expect(paper.locator('[data-v3-id=items-amount]')).toContainText(project.sampleData.financialRows.map(row => row.displayAmount));
    await expect(paper.locator('[data-v3-id=footer-credit-terms]').last()).toHaveText('Fictional certificate snapshot terms');
  }
  const savedPromise = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const saved = await savedPromise, savedPath = info.outputPath(`${kind}.printform.json`); await saved.saveAs(savedPath);
  await page.locator('#open-file').setInputFiles(savedPath); await ready(page);
  await expect(paper.locator('[data-v3-id=totals-total]').last()).toHaveText(amount);
  const exportedPromise = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const exported = await exportedPromise, exportedPath = info.outputPath(`${kind}.html`); await exported.saveAs(exportedPath);
  const printed = await context.newPage(); await printed.goto(pathToFileURL(exportedPath).href);
  await expect(printed.locator('html')).toHaveAttribute('data-printform-status', 'ready');
  await expect(printed.locator('[data-v3-id=totals-total]').last()).toHaveText(amount);
  expect(await printed.locator('table.prowitem_processed').evaluateAll(rows => rows.map(row => Number(row.dataset.pfRowIndex)))).toEqual(Array.from({ length: expectedRows }, (_, index) => index));
  const overflow = await printed.locator('.printform_page').evaluateAll(pages => pages.flatMap(page => {
    const bounds = page.getBoundingClientRect();
    return [...page.querySelectorAll('[data-v3-role=value],h1')].filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.right > bounds.right + 1 || rect.left < bounds.left - 1 || rect.bottom > bounds.bottom + 1;
    }).map(node => node.dataset.v3Id);
  }));
  expect(overflow).toEqual([]);
  await printed.screenshot({ path: info.outputPath(`${kind}-ledger.png`), fullPage: true });
  if (browserName === 'chromium') await printed.pdf({ path: info.outputPath(`${kind}-ledger.pdf`), preferCSSPageSize: true, printBackground: true });
  await printed.close();
});
