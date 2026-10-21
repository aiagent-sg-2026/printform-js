import {clickHeaderAction} from './header-action.js';
import { test, expect } from './studio-v3-test.js';
import { BUSINESS_DEMO_TEMPLATES, businessDemoInput } from '../studio-v3/business-document-demos.js';
import { createBusinessDocumentProject } from '../studio-v3/business-document-project.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30000 });
async function changeDocument(page, change) {
  const before = await page.evaluate(() => window.businessRenderGeneration || 0);
  await change();
  await page.waitForFunction(previous => window.businessRenderGeneration > previous, before, {timeout:30000});
  await ready(page);
  // A render postMessage precedes iframe navigation completion; wait for the current browsing context too.
  const element = await page.locator('#preview-frame').elementHandle();
  const frame = await element.contentFrame();
  if (!frame) throw new Error('The rendered preview iframe is detached.');
  await frame.waitForLoadState('load');
  await element.dispose();
  return frame;
}
function sourceValues(input) {
  if (input.statement) return [...input.statement.entries.flatMap(row => row.amounts), ...(input.statement.balances || [])].map(row => `${row.amount.currency} ${row.amount.amount}`);
  if (input.stock) return input.stock.lines.map(row => `${row.quantity.amount} ${row.quantity.uom}`);
  if (input.payroll) return [...input.payroll.components, ...(input.payroll.summary || [])].map(row => `${row.amount.currency} ${row.amount.amount}`);
  if (input.service) return input.service.observations.map(row => row.quantity ? `${row.quantity.amount} ${row.quantity.uom}` : '');
  if (input.packing) return input.packing.packages.flatMap(pack => [
    '', ...['grossWeight', 'netWeight'].filter(key => pack[key]).map(key => `${pack[key].amount} ${pack[key].uom}`),
    ...pack.items.map(row => `${row.quantity.amount} ${row.quantity.uom}`)
  ]);
  if (input.inspection) return input.inspection.checks.map(row => row.measure ? `${row.measure.amount} ${row.measure.uom}` : '');
  if (input.handover) return input.handover.assets.map(row => row.quantity ? `${row.quantity.amount} ${row.quantity.uom}` : '');
  if (input.manufacturing) return [input.manufacturing.quantity, ...input.manufacturing.lines.map(row => row.quantity)].map(fact => `${fact.amount} ${fact.uom}`);
  if (input.timesheet) return input.timesheet.entries.map(row => `${row.hours.amount} ${row.hours.uom}`);
  if (input.requisition) return input.requisition.lines.map(row => `${row.quantity.amount} ${row.quantity.uom}`);
  if (input.maintenance) return input.maintenance.tasks.map(row => row.quantity ? `${row.quantity.amount} ${row.quantity.uom}` : '');
  throw new Error(`Unsupported supplied business kind: ${input.document.kind}`);
}
function sourceContext(input) {
  const branch = ['service', 'packing', 'inspection', 'handover', 'manufacturing', 'timesheet', 'requisition', 'maintenance'].find(key => input[key]);
  if (!branch) return [];
  const keys = {service:['job','customer','asset','status'],packing:['shipment','from','to','status'],inspection:['reference','subject','status'],handover:['record','from','to','status'],manufacturing:['order','product','status'],timesheet:['employee','period','status'],requisition:['request','purpose','requester','status'],maintenance:['order','asset','status']}[branch];
  return keys.filter(key => input[branch][key]).flatMap(key => Object.entries(input[branch][key]).flatMap(([name, value]) =>
    name === 'provenance' ? [['source', value.sourcePath], ['meaning', value.meaning]].map(([suffix, text]) => [`${branch}-${key}-${suffix}`, text]) : [[`${branch}-${key}-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, value]]));
}
async function assertFacts(paper, input) {
  // Capture the current live DOM in its main world; do not depend on an auxiliary locator world across srcdoc navigation.
  const actual = await paper.evaluate(() => {
    const fields = {};
    for (const node of document.querySelectorAll('[data-v3-id]')) (fields[node.dataset.v3Id] ||= []).push(node.textContent || '');
    return {fields, forbidden:document.querySelectorAll('[data-v3-id=totals-total],[data-v3-id=totals-tax],[data-v3-id=customer-bill]').length};
  });
  const normalize = value => String(value).replace(/\s+/g, ' ').trim();
  const values = id => actual.fields[id] || [];
  const last = (id, expected) => { expect(values(id).at(-1)).toBeDefined(); expect(normalize(values(id).at(-1))).toBe(normalize(expected)); };
  const rows = (id, expected) => expect(values(id).map(normalize)).toEqual(expected.map(normalize));
  last('header-kind', input.document.kind);
  last('header-source-id', input.source.id);
  last('header-number', input.document.number);
  last('header-company', input.company.name);
  rows('items-amount', sourceValues(input));
  const project = createBusinessDocumentProject(input);
  for (const key of ['no', 'section', 'description', 'direction', 'trace']) rows(`items-${key}`, project.sampleData.printRows.map(row => String(row[key])));
  last('header-company-id', input.company.id);
  last('header-address', input.company.address);
  rows('footer-notes', [input.notes]);
  rows('footer-boundary', [project.manifest.studioV3.footer.find(field => field.id === 'boundary').text]);
  expect(actual.forbidden).toBe(0);
  for (const [id, value] of sourceContext(input)) last(`customer-${id}`, value);
  if (input.statement) {
    last('customer-debit-meaning', input.statement.account.debitMeaning);
    last('customer-credit-meaning', input.statement.account.creditMeaning);
    last('customer-account-id', input.statement.account.id);
    const trace = values('items-trace').join('\n');
    for (const entry of input.statement.entries) expect(trace).toContain(entry.reference.id);
  }
  if (input.stock) {
    last('customer-purpose', input.stock.purpose);
    const directions = values('items-direction');
    input.stock.lines.forEach((line, i) => {
      expect(directions[i]).toContain(line.direction);
      for (const location of [line.from, line.to].filter(Boolean)) expect(directions[i]).toContain(location.id);
    });
  }
  if (input.payroll) {
    last('customer-employee-id', input.payroll.employee.id);
    last('customer-employee', input.payroll.employee.name);
    rows('items-direction', [...input.payroll.components, ...(input.payroll.summary || [])].map(row => row.role));
  }
}
async function assertGeometry(page) {
  const reports = await page.locator('.physical_page_wrapper').evaluateAll(pages => pages.flatMap(page => {
    const bounds = page.getBoundingClientRect(), failures = [];
    for (const node of page.querySelectorAll('[data-v3-role=value],[data-v3-role=label],h1')) {
      if (!node.getClientRects().length) continue;
      const style = getComputedStyle(node), cell = node.closest('td,th'), cellBounds = cell?.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter(rect => rect.width && rect.height);
      const outside = rects.some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1);
      const escapedCell = cellBounds && rects.some(rect => rect.left < cellBounds.left - 1 || rect.right > cellBounds.right + 1 || rect.bottom > cellBounds.bottom + 1);
      const clipped = style.visibility !== 'visible' || style.overflow === 'hidden' || style.textOverflow === 'ellipsis';
      if (outside || escapedCell || clipped || parseFloat(style.fontSize) < 8 * 96 / 72 - .01) failures.push({ id: node.dataset.v3Id, outside, escapedCell, clipped, fontSize: style.fontSize });
    }
    return failures;
  }));
  expect(reports).toEqual([]);
}
async function assertPdf(bytes, input) {
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }), pdf = await loading.promise;
  try {
    expect(pdf.numPages).toBe(1);
    const text = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i), content = await page.getTextContent();
      text.push(content.items.filter(item => typeof item.str === 'string').map(item => item.str).join(' '));
    }
    const all = text.join(' '), compact = value => String(value).replace(/\s+/g, '');
    // Preserve every financial/source token; PDF wrapping adds whitespace mid-ID.
    for (const value of [input.document.number, input.source.id, ...sourceValues(input)]) expect(compact(all)).toContain(compact(value));
    // Chromium may map a CJK glyph to its compatibility radical in PDF text.
    // Compare non-financial prose by standard NFKC equivalence; DOM stays exact.
    const semantic = value => compact(String(value).normalize('NFKC')), project = createBusinessDocumentProject(input);
    const supplied = [input.company.id, input.company.name, input.company.address, input.source.system, input.source.documentType,
      input.source.number, input.document.date, input.document.kind, input.notes, ...sourceContext(input).map(([, value]) => value),
      ...project.sampleData.printRows.flatMap(row => ['section', 'description', 'amount', 'direction', 'trace'].map(key => row[key])),
      project.manifest.studioV3.footer.find(field => field.id === 'boundary').text];
    for (const value of supplied) expect(semantic(all)).toContain(semantic(value));
  } finally { await loading.destroy(); }
}

for (const entry of BUSINESS_DEMO_TEMPLATES) test(`${entry.documentKind}: no-code New plus supplied Open/save/reopen/offline export`, async ({ page, context, browserName }, info) => {
  page.on('dialog', dialog => dialog.accept());
  await page.addInitScript(() => {
    if (window !== window.top) return;
    window.businessRenderGeneration = 0;
    window.addEventListener('message', event => {
      if (event.source === document.querySelector('#preview-frame')?.contentWindow &&
        event.data?.source === 'printform-studio-v3-preview' && event.data.type === 'rendered') window.businessRenderGeneration++;
    });
  });
  await page.goto('/studio-v3/'); await ready(page);
  await clickHeaderAction(page,'new');
  await page.locator('#new-dialog details').filter({ has: page.locator(`[data-demo-template="${entry.documentKind}"]`) }).locator('summary').click();
  let paper = await changeDocument(page, () => page.locator(`[data-demo-template="${entry.documentKind}"]`).click());
  await assertFacts(paper, businessDemoInput(entry.documentKind));
  const input = businessDemoInput(entry.documentKind);
  // Deliberately independent source snapshots: a print creator must not reconcile/recompute them.
  if (input.statement) input.statement.balances.at(-1).amount.amount = '-0007.2300';
  if (input.payroll) input.payroll.summary.find(row => row.role === 'netPay').amount.amount = '+0.001';
  if (input.stock) input.stock.lines[0].quantity.amount = '-0.000';
  if (input.service) input.service.observations.find(row => row.quantity).quantity.amount = '-0000.000';
  if (input.packing) input.packing.packages[0].items[0].quantity.amount = '-0000.000';
  if (input.manufacturing) {
    input.manufacturing.lines[1].quantity.amount = '+0099.000';
    input.manufacturing.status.value = '待复核 / Work In Progress';
  }
  if (input.timesheet) {
    input.timesheet.entries[0].hours.amount = '+0011.125';
    input.timesheet.entries[0].status.value = 'Recorded / 未批准';
  }
  if (input.requisition) {
    input.requisition.lines[0].quantity.amount = '+0011.125';
    input.requisition.status.value = 'Source review pending / 未批准';
  }
  if (input.maintenance) {
    input.maintenance.tasks[1].quantity.amount = '-0000.000';
    input.maintenance.asset.serialNumber = 'EXACT-0000-SERIAL';
  }
  const project = createBusinessDocumentProject(input);
  paper = await changeDocument(page, () => page.locator('#open-file').setInputFiles({ name: `${entry.documentKind}.printform.json`, mimeType: 'application/json', buffer: Buffer.from(saveProject(project)) }));
  await assertFacts(paper, input);
  const saving = page.waitForEvent('download'); await clickHeaderAction(page,'save');
  const saved = await saving, savedPath = info.outputPath(`${entry.documentKind}.printform.json`); await saved.saveAs(savedPath);
  expect(readProject(await readFile(savedPath, 'utf8')).sampleData).toEqual(project.sampleData);
  paper = await changeDocument(page, () => page.locator('#open-file').setInputFiles(savedPath));
  await assertFacts(paper, input);
  const exporting = page.waitForEvent('download'); await clickHeaderAction(page,'export');
  const exported = await exporting, exportedPath = info.outputPath(`${entry.documentKind}.html`); await exported.saveAs(exportedPath);
  const offline = await context.newPage(); await offline.route(/^https?:/, route => route.abort());
  await offline.goto(pathToFileURL(exportedPath).href);
  await expect(offline.locator('html')).toHaveAttribute('data-printform-status', 'ready');
  await assertFacts(offline, input); await offline.emulateMedia({ media: 'print' }); await assertGeometry(offline);
  await expect(offline.locator('.physical_page_wrapper')).toHaveCount(1);
  const indices = await offline.locator('table.prowitem_processed').evaluateAll(nodes => nodes.map(node => Number(node.dataset.pfRowIndex)));
  expect(indices).toEqual(project.sampleData.printRows.map((_, i) => i));
  if (browserName === 'chromium') {
    const bytes = await offline.pdf({ path: info.outputPath(`${entry.documentKind}.pdf`), preferCSSPageSize: true, printBackground: true });
    await assertPdf(bytes, input); await info.attach(`${entry.documentKind}.pdf`, { body: bytes, contentType: 'application/pdf' });
  }
  await offline.close();
  paper = await changeDocument(page, () => page.locator('#open-file').setInputFiles(exportedPath));
  await assertFacts(paper, input);
});
