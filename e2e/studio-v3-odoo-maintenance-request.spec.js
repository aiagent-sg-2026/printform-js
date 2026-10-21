import {clickHeaderAction} from './header-action.js';
import { test, expect } from './studio-v3-test.js';
import { fictionalOdooMaintenanceRequest } from '../tests/fixtures/odoo-maintenance-request.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { createOdooMaintenanceRequestProject, adaptOdooMaintenanceRequest } from '../studio-v3/odoo-maintenance-request-adapter.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30000 });
async function assertFacts(surface, sample) {
  await expect(surface.locator('[data-v3-id=header-kind]').last()).toHaveText('MaintenanceWorkOrder');
  await expect(surface.locator('[data-v3-id=header-number]').last()).toHaveText(sample.document.number);
  await expect(surface.locator('[data-v3-id=header-date]').last()).toHaveText('2026-10-23');
  await expect(surface.locator('[data-v3-id=customer-maintenance-asset-name]').last()).toHaveText(sample.maintenance.asset.name);
  await expect(surface.locator('[data-v3-id=customer-maintenance-status-value]').last()).toHaveText(sample.maintenance.status.value);
  for (const key of ['no', 'section', 'description', 'amount', 'direction', 'trace']) await expect(surface.locator(`[data-v3-id=items-${key}]`)).toHaveText(sample.printRows.map(row => String(row[key])));
  await expect(surface.locator('[data-v3-id=totals-total],[data-v3-id=customer-approved-by],[data-v3-id=customer-maintenance-scheduled-date]')).toHaveCount(0);
  await expect(surface.locator('[data-v3-id=items-description] img')).toHaveCount(0);
}

test('repository Node Odoo SDK feeds real Studio Open/save/reopen/export and offline file without browser module imports', async ({ page, context }, info) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/studio-v3/'); await ready(page);
  const input = fictionalOdooMaintenanceRequest(), before = structuredClone(input);
  const originalBytes = await readFile('tests/fixtures/odoo-maintenance-request.json');
  expect(Buffer.from(input.snapshotJson, 'utf8')).toEqual(originalBytes);
  const created = createOdooMaintenanceRequestProject(input), prior = structuredClone(created);
  const invalid = structuredClone(input), wrong = JSON.parse(invalid.snapshotJson);
  wrong.document.record.equipment_id[0] = 999; invalid.snapshotJson = JSON.stringify(wrong);
  expect(() => adaptOdooMaintenanceRequest(invalid)).toThrow(expect.objectContaining({ path: 'snapshot.document.record.equipment_id' }));
  expect(created).toEqual(prior); expect(input).toEqual(before);
  const serialized = saveProject(created), project = readProject(serialized), sample = project.sampleData;
  expect(sample.odooEvidence).toEqual(input);
  expect(sample.printRows.map(row => row.amount)).toEqual(['']);
  await page.locator('#open-file').setInputFiles({ name: 'odoo-request.printform.json', mimeType: 'application/json', buffer: Buffer.from(serialized) });
  await ready(page); await expect(page.locator('#document-name')).toHaveValue(project.manifest.title);
  await assertFacts(page.frameLocator('#preview-frame'), sample);
  const saving = page.waitForEvent('download'); await clickHeaderAction(page,'save');
  const savedPath = info.outputPath('odoo-request.printform.json'); await (await saving).saveAs(savedPath);
  const saved = readProject(await readFile(savedPath, 'utf8'));
  expect(saved.sampleData).toEqual(sample);
  expect(Buffer.from(saved.sampleData.odooEvidence.snapshotJson, 'utf8')).toEqual(originalBytes);
  await page.locator('#open-file').setInputFiles(savedPath); await ready(page);
  await assertFacts(page.frameLocator('#preview-frame'), sample);
  const exporting = page.waitForEvent('download'); await clickHeaderAction(page,'export');
  const htmlPath = info.outputPath('odoo-request.html'); await (await exporting).saveAs(htmlPath);
  expect((await readFile(htmlPath, 'utf8')).startsWith('<!doctype html>')).toBe(true);
  const offline = await context.newPage(); await offline.route(/^https?:/, route => route.abort());
  try {
    await offline.goto(pathToFileURL(htmlPath).href);
    await expect(offline.locator('html')).toHaveAttribute('data-printform-status', 'ready');
    await assertFacts(offline, sample);
    const embedded = await offline.locator('script[type="application/json"]').evaluateAll(nodes => nodes.map(node => JSON.parse(node.textContent)).find(value => value?.odooEvidence));
    expect(embedded.odooEvidence).toEqual(input);
    expect(Buffer.from(embedded.odooEvidence.snapshotJson, 'utf8')).toEqual(originalBytes);
    expect(JSON.parse(embedded.odooEvidence.snapshotJson).document.record.description).toContain('PRIVATE-NATIVE-HTML');
    expect(await offline.locator('body').innerText()).not.toContain('PRIVATE-NATIVE-HTML');
    expect(await offline.locator('body').innerText()).not.toContain('PRIVATE-NATIVE-INSTRUCTION');
    expect(await offline.evaluate(() => globalThis.odooHostile)).toBeUndefined();
    expect(await offline.locator('table.prowitem_processed').evaluateAll(rows => rows.map(row => Number(row.dataset.pfRowIndex)))).toEqual([0]);
    await offline.screenshot({ path: info.outputPath('odoo-request.png'), fullPage: true });
  } finally { await offline.close(); }
  await page.locator('#open-file').setInputFiles(htmlPath); await ready(page);
  await assertFacts(page.frameLocator('#preview-frame'), sample);
  // Re-save the reimported standalone HTML to prove its unprinted evidence still exists.
  const resaving = page.waitForEvent('download'); await clickHeaderAction(page,'save');
  const reopenedPath = info.outputPath('odoo-reopened.printform.json'); await (await resaving).saveAs(reopenedPath);
  expect(readProject(await readFile(reopenedPath, 'utf8')).sampleData.odooEvidence).toEqual(input);
  expect(input).toEqual(before);
});

test('absent optional Odoo stage and equipment metadata remain absent in the browser consumer', async ({ page }) => {
  const input = fictionalOdooMaintenanceRequest(), source = JSON.parse(input.snapshotJson);
  delete source.stage; delete source.document.record.stage_id;
  delete source.document.record.schedule_date; delete source.document.record.description;
  delete source.document.record.instruction_text; delete source.equipment.record.serial_no;
  delete source.equipment.record.location; source.equipment.record.company_id = false;
  input.snapshotJson = JSON.stringify(source);
  const project = createOdooMaintenanceRequestProject(input);
  await page.goto('/studio-v3/'); await ready(page);
  await page.locator('#open-file').setInputFiles({ name: 'odoo-minimal.printform.json', mimeType: 'application/json', buffer: Buffer.from(saveProject(project)) });
  await ready(page);
  const preview = page.frameLocator('#preview-frame');
  await expect(preview.locator('[data-v3-id=items-description]')).toHaveText(source.document.record.name);
  await expect(preview.locator('[data-v3-id=items-amount]')).toHaveText('');
  await expect(preview.locator('[data-v3-id=customer-maintenance-status-value],[data-v3-id=customer-maintenance-asset-serial-number],[data-v3-id=customer-maintenance-asset-location],[data-v3-id=customer-maintenance-scheduled-date]')).toHaveCount(0);
});
