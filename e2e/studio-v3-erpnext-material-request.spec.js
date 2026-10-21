import {clickHeaderAction} from './header-action.js';
import { test, expect } from './studio-v3-test.js';
import { fictionalErpNextMaterialRequest } from '../tests/fixtures/erpnext-material-request.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { createErpNextMaterialRequestProject, adaptErpNextMaterialRequest } from '../studio-v3/erpnext-material-request-adapter.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30000 });
async function assertFacts(surface, sample) {
  await expect(surface.locator('[data-v3-id=header-kind]').last()).toHaveText('PurchaseRequisition');
  await expect(surface.locator('[data-v3-id=header-number]').last()).toHaveText(sample.document.number);
  await expect(surface.locator('[data-v3-id=customer-requisition-purpose-value]').last()).toHaveText('Purchase');
  await expect(surface.locator('[data-v3-id=customer-requisition-status-value]').last()).toHaveText('Partially Ordered');
  await expect(surface.locator('[data-v3-id=customer-requisition-required-by]').last()).toHaveText(sample.requisition.requiredBy);
  for (const key of ['no', 'section', 'description', 'amount', 'direction', 'trace']) await expect(surface.locator(`[data-v3-id=items-${key}]`)).toHaveText(sample.printRows.map(row => String(row[key])));
  await expect(surface.locator('[data-v3-id=totals-total],[data-v3-id=totals-tax],[data-v3-id=header-currency],[data-v3-id=customer-approved-by]')).toHaveCount(0);
}

test('optional Node Purchase Material Request SDK creates real Open/save/reopen/offline HTML consumer', async ({ page, context }, info) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/studio-v3/'); await ready(page);
  const input = fictionalErpNextMaterialRequest(), before = structuredClone(input);
  const created = createErpNextMaterialRequestProject(input), prior = structuredClone(created);
  const invalid = structuredClone(input); invalid.document.items[1].parent = 'WRONG-PARENT';
  expect(() => adaptErpNextMaterialRequest(invalid)).toThrow(expect.objectContaining({ path: 'document.items[1].parent' }));
  expect(created).toEqual(prior); expect(input).toEqual(before);
  const serialized = saveProject(created), project = readProject(serialized), sample = project.sampleData;
  expect(sample.erpnextEvidence.document).toEqual(input.document);
  expect(sample.erpnextEvidence.exact).toEqual(input.exact);
  expect(sample.printRows.map(row => row.amount)).toEqual(['+0008.500 Each', '-0000.000 kit']);
  await page.locator('#open-file').setInputFiles({ name: 'purchase-request.printform.json', mimeType: 'application/json', buffer: Buffer.from(serialized) });
  await ready(page); await expect(page.locator('#document-name')).toHaveValue(project.manifest.title);
  await assertFacts(page.frameLocator('#preview-frame'), sample);
  const saving = page.waitForEvent('download'); await clickHeaderAction(page,'save');
  const savedPath = info.outputPath('purchase-request.printform.json'); await (await saving).saveAs(savedPath);
  expect(readProject(await readFile(savedPath, 'utf8')).sampleData).toEqual(sample);
  await page.locator('#open-file').setInputFiles(savedPath); await ready(page);
  await assertFacts(page.frameLocator('#preview-frame'), sample);
  const exporting = page.waitForEvent('download'); await clickHeaderAction(page,'export');
  const htmlPath = info.outputPath('purchase-request.html'); await (await exporting).saveAs(htmlPath);
  const offline = await context.newPage(); await offline.route(/^https?:/, route => route.abort());
  try {
    await offline.goto(pathToFileURL(htmlPath).href);
    await expect(offline.locator('html')).toHaveAttribute('data-printform-status', 'ready');
    await assertFacts(offline, sample);
    expect(await offline.locator('table.prowitem_processed').evaluateAll(rows => rows.map(row => Number(row.dataset.pfRowIndex)))).toEqual([0, 1]);
    await offline.screenshot({ path: info.outputPath('purchase-request.png'), fullPage: true });
  } finally { await offline.close(); }
  await page.locator('#open-file').setInputFiles(htmlPath); await ready(page);
  await assertFacts(page.frameLocator('#preview-frame'), sample);
});
