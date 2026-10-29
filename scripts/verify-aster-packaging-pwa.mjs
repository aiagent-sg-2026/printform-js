// Run after verify-aster-packaging.mjs; serve its controlled shared site on 4199.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {ready, select, inspect} from './aster-browser-checks.mjs';
import {watchNetwork, checkFonts, checkNetwork} from './aster-network-checks.mjs';
import {reconcile} from '../gallery/designs/assets/aster/reconcile.mjs';
const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(root, '../artifacts/aster-package');
const base = process.env.ASTER_PWA_BASE_URL || 'http://127.0.0.1:4199';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
try {
  const context = await browser.newContext();
  const gallery = await context.newPage();
  await gallery.goto(`${base}/gallery/index.html`);
  await gallery.waitForFunction(() => !!navigator.serviceWorker.controller, null, {timeout:180000});
  const keys = await gallery.evaluate(async () => {
    const cache = await caches.open('pf-gallery-shell-aaaaaaaaaaaa');
    return (await cache.keys()).map(request => request.url);
  });
  const document = keys.find(url => url.endsWith('/designs/aster-three-way-match-review-pack.html'));
  assert.ok(document);
  const fonts = keys.filter(url => /\/assets\/fonts\/aster-v1\/.*\.woff2$/.test(url));
  assert.equal(fonts.length, 3);
  assert.ok(keys.every(url => !url.includes('standalone')));
  await gallery.close();
  await context.setOffline(true);
  const page = await context.newPage(), network = watchNetwork(page), sources = [];
  page.on('response', response => sources.push({url:response.url(), serviceWorker:response.fromServiceWorker()}));
  await page.goto(document); await ready(page);
  const loadedFonts = await checkFonts(page);
  await select(page, {notes:'long'});
  const sample = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/aster/sample.json')));
  const dom = await inspect(page, reconcile(sample), {detail:'all', notes:'long'});
  checkNetwork(network, [document, ...fonts]);
  assert.equal(sources.length, 4);
  assert.ok(sources.every(source => source.serviceWorker), 'all HTML and fonts came from existing SW while offline');
  await fs.writeFile(path.join(out, 'pwa-offline.json'), JSON.stringify({cachedFiles:keys.length, sharedFontCopies:fonts.length,
    standaloneInCache:false, pages:dom.pages, loadedFonts, sources, network, passed:true}, null, 2));
  console.log('Existing Gallery SW: real offline release HTML + all three shared fonts; bilingual 11-page fixture passed.');
} finally { await browser.close(); }
