import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import jsQR from 'jsqr';
import { inspectInvoice, assertInvoice, independentTotals } from './school-invoice-dom-checks.mjs';
import { verifyInvoicePDF } from './school-invoice-pdf-checks.mjs';
const root = path.resolve(import.meta.dirname, '..');
const assets = path.join(root, 'gallery/designs/assets/school-invoices');
const output = path.resolve(process.argv[2] || path.join(root, '../output/school-invoices'));
const base = process.env.SCHOOL_BASE_URL || 'http://127.0.0.1:4185';
for (const folder of ['pdf', 'rendered', 'offline']) await fs.mkdir(path.join(output, folder), { recursive: true });
execFileSync(process.execPath, [path.join(root, 'scripts/export-school-invoices.mjs'), path.join(output, 'offline')]);
const data = JSON.parse(await fs.readFile(path.join(assets, 'data.json'), 'utf8'));
const context = { window: {} }; vm.createContext(context);
vm.runInContext(await fs.readFile(path.join(assets, 'math.js'), 'utf8'), context);
const lines = (d, mode) => JSON.parse(JSON.stringify(context.window.SchoolInvoiceMath.lines(d, mode)));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const results = [], extras = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
  page.on('pageerror', error => errors.push(error.message));
  const ready = async () => {
    await page.waitForFunction(() => window.SCHOOL_READY || window.SCHOOL_ERROR);
    assert.equal(await page.evaluate(() => window.SCHOOL_ERROR), null);
  };
  for (const style of data.styles) {
    for (const paper of ['A4', 'A5']) for (const mode of ['short', 'long']) {
      const name = `pf${style.number}-${paper}-${mode}`;
      await page.goto(`${base}/gallery/designs/${style.file}.html?paper=${paper}&sample=${mode}`);
      await ready();
      const items = lines(data, mode), expected = independentTotals(data, items);
      const snapshot = await inspectInvoice(page);
      assertInvoice(snapshot, paper, mode, expected, items);
      if (paper === 'A4' && mode === 'short') await page.locator('.printform_page').screenshot({ path: path.join(root, 'gallery/thumbs', `${style.file}.png`) });
      await page.emulateMedia({ media: 'print' });
      const pdfFile = path.join(output, 'pdf', `${name}.pdf`);
      await page.pdf({ path: pdfFile, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, tagged: true });
      const pdf = await verifyInvoicePDF(pdfFile, { paper, mode, expected, ids: items.map(n => n.id), bilingual: style.id === 'bilingual', imageDir: path.join(output, 'rendered') });
      assert.equal(pdf.pages, snapshot.pages.length, 'PDF does not add blank or clipped pages');
      await page.emulateMedia({ media: 'screen' });
      results.push({ style: style.id, paper, mode, lineCount: items.length, dueCents: expected.due, domPages: snapshot.pages.length,
        formatAll: snapshot.report, pdf: { ...pdf, images: pdf.images.map(n => path.relative(output, n)) } });
      console.log(`${name}: ${pdf.pages} pages, ${items.length} exact lines, ${pdf.minimumFontPt.toFixed(3)}pt minimum`);
    }
    // Fresh 390px load and keyboard-driven paper/sample transitions, not stale scaled pages.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/gallery/designs/${style.file}.html`); await ready();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile fresh fit');
    await page.locator('#paper').focus(); await page.keyboard.press('End');
    await page.waitForFunction(() => window.SCHOOL_READY && window.SCHOOL_RESULT.paper === 'A5');
    await page.keyboard.press('Tab'); assert.equal(await page.locator('#sample').evaluate(n => n === document.activeElement), true);
    await page.keyboard.press('End');
    await page.waitForFunction(() => window.SCHOOL_READY && window.SCHOOL_RESULT.sample === 'long');
    assert.equal(await page.locator('[data-line-id]').count(), 44);
    await page.locator('#paper').focus(); await page.keyboard.press('Home');
    await page.waitForFunction(() => window.SCHOOL_READY && window.SCHOOL_RESULT.paper === 'A4');
    await page.locator('#sample').focus(); await page.keyboard.press('Home');
    await page.waitForFunction(() => window.SCHOOL_READY && window.SCHOOL_RESULT.sample === 'short');
    assert.equal(await page.locator('.printform_page').count(), 1);
    assert.equal(await page.locator('[data-line-id]').count(), 4);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    extras.push({ style: style.id, mobile390: true, keyboardSwitches: true, staleRows: false });
    await page.setViewportSize({ width: 1200, height: 1100 });
    // Bounded long-name, long-word and multiline custom-data probe at both sizes.
    const custom = structuredClone(data);
    custom.customer.name = 'Demo ExtendedFamilyNameWithNoSpacesForWrappingAndReadableColumnBoundaries';
    custom.student.name = 'Demo Avery Rowan with a deliberately extended fictional learning-record name';
    custom.lineItems[0].description = 'Demo multiline workshop\nSecond line with additional learning information';
    for (const paper of ['A4', 'A5']) {
      await page.goto(`${base}/gallery/designs/${style.file}.html?paper=${paper}&sample=long`); await ready();
      await page.evaluate(async value => { window.SCHOOL_CUSTOM_DATA = value; await window.SCHOOL_RERENDER(); }, custom);
      await ready();
      const items = lines(custom, 'long');
      assertInvoice(await inspectInvoice(page), paper, 'long', independentTotals(custom, items), items);
      extras.push({ style: style.id, paper, boundaryData: true });
    }
    // Standalone file:// reopen with networking disabled; exercise all four modes.
    const offline = await browser.newContext({ offline: true, viewport: { width: 1200, height: 1100 } });
    const local = await offline.newPage();
    const requests = []; local.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    local.on('pageerror', error => errors.push(error.message));
    const file = pathToFileURL(path.join(output, 'offline', `pf${style.number}-${style.file}.html`));
    for (const paper of ['A4', 'A5']) for (const mode of ['short', 'long']) {
      file.search = `?paper=${paper}&sample=${mode}`; await local.goto(file.href);
      await local.waitForFunction(() => window.SCHOOL_READY || window.SCHOOL_ERROR);
      assert.equal(await local.evaluate(() => window.SCHOOL_ERROR), null);
      const items = lines(data, mode);
      assertInvoice(await inspectInvoice(local), paper, mode, independentTotals(data, items), items);
    }
    assert.deepEqual(requests, []); await offline.close();
    extras.push({ style: style.id, offlineFourModes: true, externalRequests: 0 });
  }
  // Independent decode of the vector QR raster, not just an assertion about its source string.
  const qr = await loadImage(path.join(assets, 'demo-qr.svg'));
  const canvas = createCanvas(320, 320), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 320); ctx.drawImage(qr, 0, 0, 320, 320);
  const decoded = jsQR(new Uint8ClampedArray(ctx.getImageData(0, 0, 320, 320).data), 320, 320);
  assert.equal(decoded?.data, data.payment.url); extras.push({ qrDecoded: decoded.data });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ cases: results, extras, errors }, null, 2));
}
assert.equal(results.length, 24);
const report = { timestamp: new Date().toISOString(), node: process.version,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  engineSHA256: crypto.createHash('sha256').update(await fs.readFile(path.join(root, 'dist/printform.js'))).digest('hex'),
  cases: results, extras, errors };
await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
console.log(`Verified ${results.length} browser/PDF cases and ${extras.length} supplementary checks: ${output}`);
