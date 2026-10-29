// Real existing Service Worker, isolated local release from the packaging audit.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {ready, select, inspect} from './lumen-browser-checks.mjs';
import {fixture, defaults} from '../gallery/designs/assets/lumen/fixtures.mjs';
const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(root, '../artifacts/lumen');
const base = process.env.LUMEN_PWA_BASE_URL || 'http://127.0.0.1:4269';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/home/ai-agent/.cache/ms-playwright/chromium-1234/chrome-linux/chrome'});
try {
  const context = await browser.newContext(), gallery = await context.newPage();
  await gallery.goto(`${base}/gallery/index.html`);
  await gallery.waitForFunction(() => !!navigator.serviceWorker.controller, null, {timeout:180000});
  const keys = await gallery.evaluate(async () => (await (await caches.open('pf-gallery-shell-cccccccccccc')).keys()).map(r => r.url));
  const documentURL = keys.find(u => u.endsWith('/designs/lumen-learning-progress-portfolio.html'));
  const fonts = keys.filter(u => /\/assets\/fonts\/aster-v1\/.*\.woff2$/.test(u));
  assert.ok(documentURL); assert.equal(fonts.length, 3); assert.ok(keys.every(u => !u.includes('standalone')));
  await gallery.close(); await context.setOffline(true);
  const page = await context.newPage({viewport:{width:1200,height:1100}}), responses = [], errors = [];
  page.on('response', r => responses.push({url:r.url(), serviceWorker:r.fromServiceWorker(), ok:r.ok()}));
  page.on('pageerror', e => errors.push(e.message)); page.on('requestfailed', r => errors.push(r.url()));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(documentURL); await ready(page);
  const sample = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/lumen/sample.json'))), documents = [];
  for (const [name, state] of [['default', defaults], ['long', {...defaults, comments:'long'}]]) {
    await select(page, state); const data = fixture(sample, state), dom = await inspect(page, data, state);
    await fs.writeFile(path.join(out, `offline-${name}-dom.json`), JSON.stringify(dom, null, 2));
    await page.pdf({path:path.join(out, `offline-${name}.pdf`), preferCSSPageSize:true, printBackground:true});
    documents.push({name, pages:dom.pages});
  }
  const loaded = await page.evaluate(() => [...document.fonts].map(f => ({family:f.family, status:f.status})));
  assert.ok(loaded.length === 3 && loaded.every(f => f.status === 'loaded'));
  const network = responses.filter(r => !r.url.startsWith('data:'));
  assert.deepEqual(network.map(r => r.url).sort(), [documentURL, ...fonts].sort());
  assert.ok(network.every(r => r.serviceWorker && r.ok)); assert.deepEqual(errors, []);
  await page.screenshot({path:path.join(out, 'offline.png')});
  const result = {passed:true, cachedFiles:keys.length, sharedFontCopies:fonts.length, standaloneInCache:false, documents, loaded, network, errors};
  await fs.writeFile(path.join(out, 'pwa-offline.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
