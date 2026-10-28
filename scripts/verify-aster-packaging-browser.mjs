// Same-browser/font proof for HTTP Gallery, local-file Gallery and detached standalone.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {fixture} from '../gallery/designs/assets/aster/fixtures.mjs';
import {reconcile} from '../gallery/designs/assets/aster/reconcile.mjs';
import {ready, select, inspect} from './aster-browser-checks.mjs';
import {watchNetwork, checkFonts, checkNetwork} from './aster-network-checks.mjs';
const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(root, '../artifacts/aster-package');
const file = 'aster-three-way-match-review-pack.html';
const url = `${process.env.ASTER_BASE_URL || 'http://127.0.0.1:4197'}/gallery/designs/${file}`;
const sample = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/aster/sample.json')));
const fontFiles = ['NotoSans-Regular.woff2', 'NotoSans-Bold.woff2', 'NotoSansCJKsc-Regular.woff2'];
const packages = [
  {name:'gallery', url, localFonts:true},
  {name:'file-gallery', url:pathToFileURL(path.join(root, 'gallery/designs', file)).href, localFonts:true, offline:true},
  {name:'standalone', url:pathToFileURL(path.resolve(root, '../artifacts/standalone', file)).href, offline:true}
];
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
const results = [], baselines = new Map();
async function pdfGeometry(filename) {
  const loading = getDocument({data:new Uint8Array(await fs.readFile(filename)), useSystemFonts:false});
  try {
    const doc = await loading.promise, pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n), view = page.getViewport({scale:1});
      const {items} = await page.getTextContent();
      pages.push({width:view.width, height:view.height, items:items.map(({str, transform, width, height}) => ({str, transform, width, height}))});
    }
    return pages;
  } finally { await loading.destroy(); }
}
try {
  for (const packaging of packages) {
    const dir = path.join(out, packaging.name);
    await fs.mkdir(dir, {recursive:true});
    const context = await browser.newContext({viewport:{width:1400,height:1100}, offline:!!packaging.offline});
    const page = await context.newPage(), network = watchNetwork(page);
    await page.goto(packaging.url); await ready(page);
    const fonts = await checkFonts(page);
    for (const test of [
      {name:'aster-default', count:24, notes:'standard'},
      {name:'aster-long', count:24, notes:'long'},
      {name:'aster-150', count:150, notes:'standard'}
    ]) {
      await select(page, {count:test.count, notes:test.notes});
      const state = {detail:'all', notes:test.notes}, report = reconcile(fixture(sample, test.count));
      const dom = await inspect(page, report, state);
      assert.deepEqual(await page.evaluate(() => ASTER_RESULT.totals), report.totals);
      await page.emulateMedia({media:'print'});
      await inspect(page, report, state);
      const filename = path.join(dir, `${test.name}.pdf`);
      await page.pdf({path:filename, preferCSSPageSize:true, printBackground:true});
      await fs.writeFile(path.join(dir, `${test.name}-dom.json`), JSON.stringify(dom, null, 2));
      const pdf = await pdfGeometry(filename);
      const text = await page.locator('#preview').innerText();
      const geometry = {dom, text, pdf};
      if (packaging.name === 'gallery') baselines.set(test.name, geometry);
      else assert.deepEqual(geometry, baselines.get(test.name), `${packaging.name}/${test.name}: identical text and exact DOM/PDF geometry`);
      results.push({packaging:packaging.name, fixture:test.name, pages:dom.pages, fonts, identical:true});
      await page.emulateMedia({media:'screen'});
    }
    const allowed = [packaging.url, ...(packaging.localFonts ? fontFiles.map(file => new URL(`assets/fonts/aster-v1/${file}`, packaging.url).href) : [])];
    checkNetwork(network, allowed);
    await fs.writeFile(path.join(dir, 'network.json'), JSON.stringify(network, null, 2));
    await context.close();
    // Reuse the full exact CJK / anchored amount / page-bound / font-size PDF assertions unchanged.
    const pdfLog = execFileSync(process.execPath, ['scripts/verify-aster-pdf.mjs'], {cwd:root,
      env:{...process.env, ASTER_ARTIFACT_DIR:dir}, encoding:'utf8'});
    await fs.writeFile(path.join(dir, 'pdf-check.log'), pdfLog);
  }
} finally {
  await browser.close();
}
// Compare all six metadata PDFs and DOM records produced by the separate exact suite.
for (const name of ['custom-long', 'multiple', 'null-reference', 'empty-reference', 'mixed-reference', 'no-return']) {
  const filename = `aster-metadata-${name}`;
  const dirs = ['metadata-gallery', 'metadata-standalone'].map(dir => path.join(out, dir));
  const dom = await Promise.all(dirs.map(dir => fs.readFile(path.join(dir, `${filename}-dom.json`), 'utf8')));
  assert.equal(dom[0], dom[1], `${name}: metadata DOM geometry`);
  const pdf = await Promise.all(dirs.map(dir => pdfGeometry(path.join(dir, `${filename}.pdf`))));
  assert.deepEqual(pdf[0], pdf[1], `${name}: metadata PDF text and geometry`);
}
await fs.writeFile(path.join(out, 'browser-comparison.json'), JSON.stringify({browser:browser.version(), results, metadataPairs:6}, null, 2));
console.log(`9 packaging/fixture proofs and 6 metadata pairs: exact DOM/PDF text and geometry; zero unexpected requests or font errors.`);
