import { test, expect } from './studio-v3-test.js';
import { BUSINESS_DEMO_TEMPLATES, businessDemoInput } from '../studio-v3/business-document-demos.js';
import { createBusinessDocumentProject } from '../studio-v3/business-document-project.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30000 });
function sourceValues(input) {
  if (input.statement) return [...input.statement.entries.flatMap(row => row.amounts), ...(input.statement.balances || [])].map(row => `${row.amount.currency} ${row.amount.amount}`);
  if (input.stock) return input.stock.lines.map(row => `${row.quantity.amount} ${row.quantity.uom}`);
  return [...input.payroll.components, ...(input.payroll.summary || [])].map(row => `${row.amount.currency} ${row.amount.amount}`);
}
async function assertFacts(paper, input) {
  await expect(paper.locator('[data-v3-id=header-kind]').last()).toHaveText(input.document.kind);
  await expect(paper.locator('[data-v3-id=header-source-id]').last()).toHaveText(input.source.id);
  await expect(paper.locator('[data-v3-id=header-number]').last()).toHaveText(input.document.number);
  await expect(paper.locator('[data-v3-id=header-company]').last()).toHaveText(input.company.name);
  await expect(paper.locator('[data-v3-id=items-amount]')).toHaveText(sourceValues(input));
  await expect(paper.locator('[data-v3-id=totals-total],[data-v3-id=totals-tax],[data-v3-id=customer-bill]')).toHaveCount(0);
  if (input.statement) {
    await expect(paper.locator('[data-v3-id=customer-debit-meaning]').last()).toHaveText(input.statement.account.debitMeaning);
    await expect(paper.locator('[data-v3-id=customer-credit-meaning]').last()).toHaveText(input.statement.account.creditMeaning);
    await expect(paper.locator('[data-v3-id=customer-account-id]').last()).toHaveText(input.statement.account.id);
    const trace = (await paper.locator('[data-v3-id=items-trace]').allTextContents()).join('\n');
    for (const entry of input.statement.entries) expect(trace).toContain(entry.reference.id);
  }
  if (input.stock) {
    await expect(paper.locator('[data-v3-id=customer-purpose]').last()).toHaveText(input.stock.purpose);
    const directions = await paper.locator('[data-v3-id=items-direction]').allTextContents();
    input.stock.lines.forEach((line, i) => {
      expect(directions[i]).toContain(line.direction);
      for (const location of [line.from, line.to].filter(Boolean)) expect(directions[i]).toContain(location.id);
    });
  }
  if (input.payroll) {
    await expect(paper.locator('[data-v3-id=customer-employee-id]').last()).toHaveText(input.payroll.employee.id);
    await expect(paper.locator('[data-v3-id=customer-employee]').last()).toHaveText(input.payroll.employee.name);
    await expect(paper.locator('[data-v3-id=items-direction]')).toHaveText([...input.payroll.components, ...(input.payroll.summary || [])].map(row => row.role));
  }
}
async function assertGeometry(page) {
  const reports = await page.locator('.physical_page_wrapper').evaluateAll(pages => pages.map(page => {
    const bounds = page.getBoundingClientRect();
    return [...page.querySelectorAll('[data-v3-role=value],[data-v3-role=label],h1')].filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1;
    }).map(node => node.dataset.v3Id || node.tagName);
  }));
  reports.forEach(outside => expect(outside).toEqual([]));
}
async function assertPdf(bytes, input) {
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }), pdf = await loading.promise;
  try {
    const text = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i), content = await page.getTextContent();
      text.push(content.items.filter(item => typeof item.str === 'string').map(item => item.str).join(' '));
    }
    const all = text.join(' ').replace(/\s+/g, ' ');
    for (const value of [input.document.number, input.source.id, ...sourceValues(input)]) expect(all).toContain(value);
  } finally { await loading.destroy(); }
}

for (const entry of BUSINESS_DEMO_TEMPLATES) test(`${entry.documentKind}: no-code New plus supplied Open/save/reopen/offline export`, async ({ page, context, browserName }, info) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/studio-v3/'); await ready(page);
  await page.locator('[data-action=new]').click();
  await page.locator('#new-dialog details').filter({ has: page.locator(`[data-demo-template="${entry.documentKind}"]`) }).locator('summary').click();
  await page.locator(`[data-demo-template="${entry.documentKind}"]`).click(); await ready(page);
  await assertFacts(page.frameLocator('#preview-frame'), businessDemoInput(entry.documentKind));
  const input = businessDemoInput(entry.documentKind);
  // Deliberately independent source snapshots: a print creator must not reconcile/recompute them.
  if (input.statement) input.statement.balances.at(-1).amount.amount = '-0007.2300';
  if (input.payroll) input.payroll.summary.find(row => row.role === 'netPay').amount.amount = '+0.001';
  if (input.stock) input.stock.lines[0].quantity.amount = '-0.000';
  const project = createBusinessDocumentProject(input);
  await page.locator('#open-file').setInputFiles({ name: `${entry.documentKind}.printform.json`, mimeType: 'application/json', buffer: Buffer.from(saveProject(project)) });
  await ready(page); await assertFacts(page.frameLocator('#preview-frame'), input);
  const saving = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const saved = await saving, savedPath = info.outputPath(`${entry.documentKind}.printform.json`); await saved.saveAs(savedPath);
  expect(readProject(await readFile(savedPath, 'utf8')).sampleData).toEqual(project.sampleData);
  await page.locator('#open-file').setInputFiles(savedPath); await ready(page);
  await assertFacts(page.frameLocator('#preview-frame'), input);
  const exporting = page.waitForEvent('download'); await page.locator('[data-action=export]').click();
  const exported = await exporting, exportedPath = info.outputPath(`${entry.documentKind}.html`); await exported.saveAs(exportedPath);
  const offline = await context.newPage(); await offline.route(/^https?:/, route => route.abort());
  await offline.goto(pathToFileURL(exportedPath).href);
  await expect(offline.locator('html')).toHaveAttribute('data-printform-status', 'ready');
  await assertFacts(offline, input); await offline.emulateMedia({ media: 'print' }); await assertGeometry(offline);
  const indices = await offline.locator('table.prowitem_processed').evaluateAll(nodes => nodes.map(node => Number(node.dataset.pfRowIndex)));
  expect(indices).toEqual(project.sampleData.printRows.map((_, i) => i));
  if (browserName === 'chromium') {
    const bytes = await offline.pdf({ path: info.outputPath(`${entry.documentKind}.pdf`), preferCSSPageSize: true, printBackground: true });
    await assertPdf(bytes, input); await info.attach(`${entry.documentKind}.pdf`, { body: bytes, contentType: 'application/pdf' });
  }
  await offline.close();
  await page.locator('#open-file').setInputFiles(exportedPath); await ready(page);
  await assertFacts(page.frameLocator('#preview-frame'), input);
});
