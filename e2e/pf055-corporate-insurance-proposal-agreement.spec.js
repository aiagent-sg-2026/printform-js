import { test, expect } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

async function ready(page) {
  await page.waitForFunction(() => window.__printFormProcessed === true);
}
async function inspect(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.printform_page')];
    const content = [...document.querySelectorAll('.printform_page [data-content-id]')];
    const pages = nodes.map((p, index) => {
      const b = p.getBoundingClientRect();
      const children = [...p.children];
      return {
        index, width: b.width, height: b.height, overflow: p.scrollWidth > p.clientWidth + 1,
        ids: [...p.querySelectorAll('[data-content-id]')].map(n => n.dataset.contentId),
        headers: [...p.querySelectorAll('.prowheader_processed')].map(n => n.dataset.pfTableId),
        tables: [...new Set([...p.querySelectorAll('.prowitem_processed')].map(n => n.dataset.pfTableId))],
        header: p.querySelectorAll('.pheader_processed').length,
        footer: p.querySelectorAll('.page-footer').length,
        number: p.querySelector('[data-page-number]')?.textContent,
        total: p.querySelector('[data-page-total]')?.textContent,
        outside: [...p.children, ...p.querySelectorAll('[data-content-id],td,th,.pf-flow-column,.page-footer,.brand')].filter(n => {
          const r = n.getBoundingClientRect();
          return r.left < b.left - .1 || r.right > b.right + .1 || r.top < b.top - .1 || r.bottom > b.bottom + .1 || n.scrollWidth > n.clientWidth + 1;
        }).map(n => n.dataset.contentId || n.className),
        overlap: children.slice(1).filter((n, i) => n.getBoundingClientRect().top < children[i].getBoundingClientRect().bottom - .1).map(n => n.className)
      };
    });
    const position = id => {
      const node = content.find(n => n.dataset.contentId === id);
      const p = node.closest('.printform_page');
      return { page: nodes.indexOf(p), top: node.getBoundingClientRect().top - p.getBoundingClientRect().top };
    };
    return {
      source: window.PF055_SOURCE,
      output: content.map(n => ({ id: n.dataset.contentId, text: n.textContent })),
      pages,
      positions: Object.fromEntries(['benefit-001', 'benefit-028', 'parallel-001', 'parallel-036', 'package-001', 'package-022', 'supplement-001', 'signature', 'appendix-001', 'appendix-060', 'document-end'].map(id => [id, position(id)])),
      rowHeights: [...document.querySelectorAll('.schedule-2.prowitem_processed')].map(n => n.getBoundingClientRect().height)
    };
  });
}
function assertReport(report) {
  expect(report.output).toEqual(report.source);
  expect(new Set(report.output.map(n => n.id)).size).toBe(report.source.length);
  expect(report.pages.length).toBeGreaterThan(10);
  for (const page of report.pages) {
    expect(page.ids.length).toBeGreaterThan(0);
    expect(page.width).toBeCloseTo(745.7007874, 0);
    expect(page.height).toBeCloseTo(1074.519685, 0);
    expect(page.header).toBe(1); expect(page.footer).toBe(1);
    expect(page.number).toBe(String(page.index + 1)); expect(page.total).toBe(String(report.pages.length));
    expect(page.overflow).toBe(false);
    expect(page.outside).toEqual([]); expect(page.overlap).toEqual([]);
    expect(page.headers.sort()).toEqual(page.tables.sort()); // No leaked or orphan header.
  }
  const p = report.positions;
  expect(p['benefit-001'].page).toBe(2);
  expect(p['benefit-001'].top).toBeGreaterThan(350);
  expect(p['benefit-028'].page).toBe(5);
  expect(p['parallel-001'].page).toBe(p['benefit-028'].page);
  expect(p['parallel-001'].top).toBeGreaterThan(p['benefit-028'].top);
  expect(p['package-001'].page).toBe(p['parallel-036'].page);
  expect(p['package-001'].top).toBeGreaterThan(300);
  expect(p['signature'].page).toBeLessThanOrEqual(p['appendix-001'].page);
  expect(p['appendix-060'].page - p['appendix-001'].page).toBeGreaterThanOrEqual(4);
  expect(p['document-end'].page).toBe(report.pages.length - 1);
  expect(Math.max(...report.rowHeights) / Math.min(...report.rowHeights)).toBeGreaterThan(2);
}

test('PF055 preserves every ordered clause and table row across mixed A4 flow and PDF', async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/gallery/designs/corporate-insurance-proposal-agreement.html'); await ready(page);
  await expect(page).toHaveTitle('PF-055 · Rose Assurance Studio · Corporate Insurance Proposal and Agreement');
  await expect(page.locator('h1')).toHaveText('Corporate InsuranceProposal and Agreement');
  const report = await inspect(page); assertReport(report); expect(errors).toEqual([]);
  await testInfo.attach('layout.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  await page.emulateMedia({ media: 'print' });
  assertReport(await inspect(page));
  const bytes = await page.pdf({ path: testInfo.outputPath('pf055.pdf'), preferCSSPageSize: true, printBackground: true });
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
  const pdf = await loading.promise;
  try {
    expect(pdf.numPages).toBe(report.pages.length);
    const all = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const sheet = await pdf.getPage(i), view = sheet.getViewport({ scale: 1 });
      expect(view.width).toBeCloseTo(595.276, 0); expect(view.height).toBeCloseTo(841.89, 0);
      const content = await sheet.getTextContent();
      const text = content.items.map(n => n.str).join(' '); all.push(text);
      expect(text).toContain('ROSE ASSURANCE STUDIO'); expect(text).toContain(`Page ${i} of ${pdf.numPages}`);
      for (const item of content.items.filter(n => n.str.trim())) {
        expect(item.transform[4]).toBeGreaterThan(10); expect(item.transform[4] + item.width).toBeLessThan(view.width - 10);
        expect(item.transform[5]).toBeGreaterThan(10); expect(item.transform[5]).toBeLessThan(view.height - 10);
      }
    }
    const text = all.join(' ');
    expect(text).toContain('Corporate Insurance'); expect(text).toContain('Proposal and Agreement');
    expect(text).not.toMatch(/purchase order|DEMO-PO|\bPO\b/i);
    for (const entry of report.source.filter(n => /^(opening|parallel|bridge|closing|appendix)-\d/.test(n.id))) {
      expect(text.split(entry.id.toUpperCase()).length - 1, entry.id).toBe(1);
    }
    const compact = text.replace(/\s/g, '');
    const signature = compact.indexOf('REVIEWACKNOWLEDGEMENT');
    expect(signature).toBeGreaterThanOrEqual(0);
    expect(signature).toBeLessThan(compact.indexOf('APPENDIX-001'));
  } finally { await loading.destroy(); }
});

test('PF055 mobile preview scales only after pagination and retains print geometry', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gallery/designs/corporate-insurance-proposal-agreement.html'); await ready(page);
  const mobile = await inspect(page);
  expect(mobile.output).toEqual(mobile.source);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const first = await page.locator('.printform_page').first().boundingBox();
  expect(first.width).toBeLessThan(390); expect(first.width).toBeGreaterThan(350);
  await page.screenshot({ path: testInfo.outputPath('pf055-mobile.png') });
  await page.setViewportSize({ width: 1200, height: 1000 });
  const desktop = await inspect(page); assertReport(desktop);
  expect(desktop.pages.map(p => p.ids)).toEqual(mobile.pages.map(p => p.ids));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ media: 'print' }); assertReport(await inspect(page));
});

test('PF055 standalone offline HTML reloads with no network dependency', async ({ browser }, testInfo) => {
  const output = testInfo.outputPath('pf055-offline.html');
  execFileSync(process.execPath, ['scripts/export-pf055.mjs', output]);
  const context = await browser.newContext({ offline: true });
  try {
    const page = await context.newPage(); const requests = [], errors = [];
    page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(output).href); await ready(page); assertReport(await inspect(page));
    await page.reload(); await ready(page); assertReport(await inspect(page));
    expect(requests).toEqual([]); expect(errors).toEqual([]);
  } finally { await context.close(); }
});
