import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {fixture, defaults} from '../gallery/designs/assets/atlas/fixtures.mjs';
import {model} from '../gallery/designs/assets/atlas/model.mjs';
import {ready, select, inspect} from './atlas-browser-checks.mjs';
import {pdf} from './atlas-capture.mjs';
const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(root, '../artifacts/atlas');
const file = 'atlas-landed-cost-dossier.html', base = process.env.ATLAS_BASE_URL || 'http://127.0.0.1:4266';
const sample = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/atlas/sample.json')));
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
const results = [], fingerprints = new Map();
async function fingerprint(filename) {
  const loading = getDocument({data:new Uint8Array(await fs.readFile(filename)), useSystemFonts:false}), doc = await loading.promise;
  const result = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i), {items} = await p.getTextContent();
    result.push({view:p.view, items:items.map(({str, width, height, transform}) => ({str, width, height, transform}))});
  }
  await loading.destroy(); return result;
}
try {
  for (const kind of ['http-gallery', 'file-gallery', 'standalone']) {
    const folder = path.join(out, kind); await fs.mkdir(folder, {recursive:true});
    const context = await browser.newContext({viewport:{width:1400,height:1100}});
    if (kind !== 'http-gallery') await context.setOffline(true);
    const page = await context.newPage(), errors = [], requests = [];
    page.on('request', r => { if (!r.url().startsWith('data:')) requests.push(r.url()); });
    page.on('requestfailed', r => errors.push(`failed ${r.url()}`));
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (!r.ok()) errors.push(`${r.status()} ${r.url()}`); });
    const url = kind === 'http-gallery' ? `${base}/gallery/designs/${file}` : kind === 'file-gallery' ? `file://${root}/gallery/designs/${file}` : `file://${path.resolve(root, '../artifacts/standalone', file)}`;
    await page.goto(url); await ready(page);
    const fonts = await page.evaluate(() => [...document.fonts].map(f => ({family:f.family, status:f.status})));
    assert.equal(fonts.length, 3); assert.ok(fonts.every(f => f.status === 'loaded'));
    for (const [name, values] of [['default', defaults], ['long', {...defaults, notes:'long'}], ['dense', {...defaults, containers:8, count:120}]]) {
      await select(page, values);
      const report = model(fixture(sample, values)), dom = await inspect(page, report, values);
      await pdf(page, folder, name, dom);
      const actual = await fingerprint(path.join(folder, name + '.pdf'));
      if (kind === 'http-gallery') fingerprints.set(name, {pdf:actual, dom});
      else { assert.deepEqual(actual, fingerprints.get(name).pdf, `${kind}/${name}: exact PDF text, size and coordinates`); assert.deepEqual(dom, fingerprints.get(name).dom, 'exact DOM geometry and source conservation'); }
      results.push({kind, name, pages:dom.pages, fontCount:fonts.length, passed:true});
    }
    assert.deepEqual(errors, []);
    const expectedRequests = kind === 'standalone' ? [url] : [url, ...['NotoSans-Regular.woff2', 'NotoSans-Bold.woff2', 'NotoSansCJKsc-Regular.woff2'].map(f => new URL(`assets/fonts/aster-v1/${f}`, url).href)];
    assert.deepEqual([...new Set(requests)].sort(), expectedRequests.sort(), 'strict document + shared fonts request allowlist');
    await fs.writeFile(path.join(folder, 'network.json'), JSON.stringify({requests, errors, fonts}, null, 2));
    await context.close();
    const log = execFileSync(process.execPath, ['scripts/verify-atlas-pdf.mjs'], {cwd:root, env:{...process.env, ATLAS_ARTIFACT_DIR:folder, ATLAS_PDF_NAMES:'default,long,dense'}, maxBuffer:1024 * 1024});
    await fs.writeFile(path.join(folder, 'pdf.log'), log);
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(out, 'packaging-browser-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
