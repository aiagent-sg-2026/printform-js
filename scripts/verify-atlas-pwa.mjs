// Uses an isolated site produced by verify-atlas-packaging.mjs; no PWA policy edits.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {ready, select, inspect} from './atlas-browser-checks.mjs';
import {model} from '../gallery/designs/assets/atlas/model.mjs';
import {defaults} from '../gallery/designs/assets/atlas/fixtures.mjs';
const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(root, '../artifacts/atlas');
const base = process.env.ATLAS_PWA_BASE_URL || 'http://127.0.0.1:4267';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
try {
  const context = await browser.newContext(), gallery = await context.newPage();
  await gallery.goto(`${base}/gallery/index.html`);
  await gallery.waitForFunction(() => !!navigator.serviceWorker.controller, null, {timeout:180000});
  const keys = await gallery.evaluate(async () => {
    const cache = await caches.open('pf-gallery-shell-bbbbbbbbbbbb'); return (await cache.keys()).map(r => r.url);
  });
  const documentURL = keys.find(u => u.endsWith('/designs/atlas-landed-cost-dossier.html'));
  const fonts = keys.filter(u => /\/assets\/fonts\/aster-v1\/.*\.woff2$/.test(u));
  assert.ok(documentURL); assert.equal(fonts.length, 3); assert.ok(keys.every(u => !u.includes('standalone')));
  await gallery.close(); await context.setOffline(true);
  const page = await context.newPage(), responses = [], errors = [];
  page.on('response', r => responses.push({url:r.url(), serviceWorker:r.fromServiceWorker(), ok:r.ok()}));
  page.on('pageerror', e => errors.push(e.message)); page.on('requestfailed', r => errors.push(r.url()));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(documentURL); await ready(page); await select(page, {notes:'long'});
  const sample = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/atlas/sample.json')));
  const dom = await inspect(page, model(sample), {...defaults, notes:'long'});
  const loaded = await page.evaluate(() => [...document.fonts].map(f => ({family:f.family, status:f.status})));
  assert.ok(loaded.length === 3 && loaded.every(f => f.status === 'loaded'));
  const network = responses.filter(r => !r.url.startsWith('data:'));
  assert.deepEqual(network.map(r => r.url).sort(), [documentURL, ...fonts].sort());
  assert.ok(network.every(r => r.serviceWorker && r.ok)); assert.deepEqual(errors, []);
  const result = {cachedFiles:keys.length, sharedFontCopies:fonts.length, standaloneInCache:false, pages:dom.pages, loaded, network, errors, passed:true};
  await fs.writeFile(path.join(out, 'pwa-offline.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
