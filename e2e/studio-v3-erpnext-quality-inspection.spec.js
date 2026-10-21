import {clickHeaderAction} from './header-action.js';
import { test, expect } from './studio-v3-test.js';
import { fictionalErpNextQualityInspection, changeQualitySnapshot } from '../tests/fixtures/erpnext-quality-inspection.js';
import { createErpNextQualityInspectionProject, adaptErpNextQualityInspection } from '../studio-v3/erpnext-quality-inspection-adapter.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { newProject } from '../studio-v3/model.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30000 });
async function assertFacts(surface, sample) {
  await expect(surface.locator('[data-v3-id=header-kind]').last()).toHaveText('InspectionReport');
  await expect(surface.locator('[data-v3-id=header-number]').last()).toHaveText(sample.document.number);
  await expect(surface.locator('[data-v3-id=header-date]').last()).toHaveText(sample.document.date);
  await expect(surface.locator('[data-v3-id=customer-inspection-reference-id]').last()).toHaveText(sample.inspection.reference.id);
  await expect(surface.locator('[data-v3-id=customer-inspection-subject-name]').last()).toHaveText(sample.inspection.subject.name);
  await expect(surface.locator('[data-v3-id=customer-inspection-status-value]').last()).toHaveText('Rejected');
  for (const key of ['no', 'section', 'description', 'amount', 'direction', 'trace']) {
    await expect(surface.locator(`[data-v3-id=items-${key}]`)).toHaveCount(sample.printRows.length);
    expect(await surface.locator(`[data-v3-id=items-${key}]`).evaluateAll(nodes => nodes.map(node => node.textContent))).toEqual(sample.printRows.map(row => String(row[key])));
  }
  await expect(surface.locator('[data-v3-id=totals-total],[data-v3-id=header-currency],[data-v3-id=customer-approved-by]')).toHaveCount(0);
  await expect(surface.locator('[data-v3-id=items-description] not,[data-v3-id=items-description] script')).toHaveCount(0);
}
async function saveUi(page, info, name) {
  const downloading = page.waitForEvent('download'); await clickHeaderAction(page,'save');
  const path = info.outputPath(name); await (await downloading).saveAs(path);
  return { path, project: readProject(await readFile(path, 'utf8')) };
}

test('real repository Node Quality Inspection SDK survives Open/save/export/offline and cold HTML reimport from another document', async ({ page, context }, info) => {
  const input = fictionalErpNextQualityInspection(), before = structuredClone(input);
  const originalBytes = await readFile('tests/fixtures/erpnext-quality-inspection.json');
  expect(Buffer.from(input.snapshotJson, 'utf8')).toEqual(originalBytes);
  const created = createErpNextQualityInspectionProject(input), prior = structuredClone(created);
  const invalid = structuredClone(input); changeQualitySnapshot(invalid, source => { source.document.readings[1].parent = 'WRONG'; });
  expect(() => adaptErpNextQualityInspection(invalid)).toThrow(expect.objectContaining({ path: 'snapshot.document.readings[1].parent' }));
  expect(created).toEqual(prior); expect(input).toEqual(before);
  const serialized = saveProject(created), sample = readProject(serialized).sampleData;
  expect(sample.erpnextEvidence).toEqual(input);
  expect(sample.inspection.checks.map(row => row.observed)).toEqual(['Visible source scratch <not markup>', '-0000.1250', '+0000.0000', '1.234,50', '  0.1000  ', 'C']);
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/studio-v3/'); await ready(page);
  await page.locator('#open-file').setInputFiles({ name: 'quality.printform.json', mimeType: 'application/json', buffer: Buffer.from(serialized) });
  await ready(page); await assertFacts(page.frameLocator('#preview-frame'), sample);
  const saved = await saveUi(page, info, 'quality-saved.printform.json');
  expect(saved.project.sampleData).toEqual(sample);
  expect(Buffer.from(saved.project.sampleData.erpnextEvidence.snapshotJson, 'utf8')).toEqual(originalBytes);
  await page.locator('#open-file').setInputFiles(saved.path); await ready(page);
  await assertFacts(page.frameLocator('#preview-frame'), sample);
  const exporting = page.waitForEvent('download'); await clickHeaderAction(page,'export');
  const htmlPath = info.outputPath('quality.html'); await (await exporting).saveAs(htmlPath);
  const offline = await context.newPage(); await offline.route(/^https?:/, route => route.abort());
  try {
    await offline.goto(pathToFileURL(htmlPath).href);
    await expect(offline.locator('html')).toHaveAttribute('data-printform-status', 'ready');
    await assertFacts(offline, sample);
    const embedded = await offline.locator('script[type="application/json"]').evaluateAll(nodes => nodes.map(node => JSON.parse(node.textContent)).find(value => value?.erpnextEvidence));
    expect(embedded).toEqual(sample); expect(Buffer.from(embedded.erpnextEvidence.snapshotJson, 'utf8')).toEqual(originalBytes);
    expect(await offline.locator('body').innerText()).not.toContain('UNPRINTED-RAW-QI');
    expect(await offline.locator('body').innerText()).not.toContain('UNPRINTED-VERIFIER-F');
    expect(await offline.evaluate(() => globalThis.qualityRawExecuted)).toBeUndefined();
    expect(await offline.locator('table.prowitem_processed').evaluateAll(rows => rows.map(row => Number(row.dataset.pfRowIndex)))).toEqual(sample.printRows.map((_, i) => i));
    await offline.screenshot({ path: info.outputPath('quality-offline.png'), fullPage: true });
  } finally { await offline.close(); }
  // A new page first loads an unrelated document: no retained inspection state may satisfy reimport.
  const cold = await context.newPage(); cold.on('dialog', dialog => dialog.accept());
  try {
    await cold.goto('/studio-v3/'); await ready(cold);
    const other = newProject('invoice'); other.manifest.title = 'UNRELATED COLD START';
    await cold.locator('#open-file').setInputFiles({ name: 'other.printform.json', mimeType: 'application/json', buffer: Buffer.from(saveProject(other)) });
    await ready(cold); await expect(cold.locator('#document-name')).toHaveValue('UNRELATED COLD START');
    await expect(cold.frameLocator('#preview-frame').locator('[data-v3-id=customer-inspection-reference-id]')).toHaveCount(0);
    await cold.locator('#open-file').setInputFiles(htmlPath); await ready(cold);
    await assertFacts(cold.frameLocator('#preview-frame'), sample);
    const restored = await saveUi(cold, info, 'quality-cold-reimport.printform.json');
    expect(restored.project.sampleData).toEqual(sample);
    expect(Buffer.from(restored.project.sampleData.erpnextEvidence.snapshotJson, 'utf8')).toEqual(originalBytes);
  } finally { await cold.close(); }
  expect(input).toEqual(before);
});
