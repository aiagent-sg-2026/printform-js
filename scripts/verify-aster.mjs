import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createCanvas, loadImage} from '@napi-rs/canvas';
import {fixture} from '../gallery/designs/assets/aster/fixtures.mjs';
import {reconcile} from '../gallery/designs/assets/aster/reconcile.mjs';
import {ready, select, inspect} from './aster-browser-checks.mjs';
import {authoredChecks} from './aster-authored-checks.mjs';
const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(process.env.ASTER_ARTIFACT_DIR || path.join(root, '../artifacts'));
await fs.mkdir(out, {recursive:true});
const sample = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/aster/sample.json')));
const oracle = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/aster/expected.json')));
const url = `${process.env.ASTER_BASE_URL || 'http://127.0.0.1:4197'}/gallery/designs/aster-three-way-match-review-pack.html`;
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
const results = [], requests = [], errors = [];
async function screenshot(page, name, indices) {
  await page.evaluate(() => window.scrollTo(0, 0));
  // One full-page browser capture avoids stale tiles in successive element captures.
  // Crop only to each native sheet boundary; never resize or retouch document content.
  const rects = await page.locator('.physical_page_wrapper').evaluateAll(ns => ns.map(n => {
    const r = n.getBoundingClientRect(); return {x:r.left + scrollX, y:r.top + scrollY, width:r.width, height:r.height};
  }));
  const image = await loadImage(await page.screenshot({fullPage:true}));
  for (const i of indices || rects.map((_, i) => i)) {
    const r = rects[i], canvas = createCanvas(Math.ceil(r.width), Math.ceil(r.height));
    canvas.getContext('2d').drawImage(image, Math.floor(r.x), Math.floor(r.y), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    await fs.writeFile(path.join(out, `${name}-page-${i + 1}.png`), canvas.toBuffer('image/png'));
  }
}
try {
  const page = await browser.newPage({viewport:{width:1400,height:1100}});
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('data:')) requests.push(request.url()); });
  await page.goto(url); await ready(page);
  let r = await inspect(page, reconcile(sample), {detail:'all', notes:'standard'});
  assert.deepEqual(await page.evaluate(() => ASTER_RESULT.totals), oracle);
  results.push({name:'default-24', pages:r.pages, totals:oracle});
  await screenshot(page, 'aster-default');
  await page.emulateMedia({media:'print'});
  await inspect(page, reconcile(sample), {detail:'all', notes:'standard'});
  assert.equal(await page.locator('.toolbar').isVisible(), false);
  await page.pdf({path:path.join(out, 'aster-default.pdf'), preferCSSPageSize:true, printBackground:true});
  await fs.writeFile(path.join(out, 'aster-default-dom.json'), JSON.stringify(r, null, 2));
  await page.emulateMedia({media:'screen'});
  await page.locator('.physical_page_wrapper').first().screenshot({path:path.join(out, 'aster-thumbnail.png')});
  for (const count of [0, 1, 60, 150]) {
    await select(page, {count});
    r = await inspect(page, reconcile(fixture(sample, count)), {detail:'all', notes:'standard'});
    results.push({name:`review-${count}`, pages:r.pages, totals:await page.evaluate(() => ASTER_RESULT.totals)});
    if ([0,1].includes(count)) await screenshot(page, `aster-${count}`);
    if (count === 150) {
      await screenshot(page, 'aster-150', [1, Math.floor(r.pages / 2), r.pages - 1]);
      await page.emulateMedia({media:'print'});
      await inspect(page, reconcile(fixture(sample, count)), {detail:'all', notes:'standard'});
      await page.pdf({path:path.join(out, 'aster-150.pdf'), preferCSSPageSize:true, printBackground:true});
      await page.emulateMedia({media:'screen'});
      await fs.writeFile(path.join(out, 'aster-150-dom.json'), JSON.stringify(r, null, 2));
    }
  }
  for (const count of [0, 1, 24, 60, 150]) {
    await select(page, {count, scenario:'matched'});
    const report = reconcile(fixture(sample, count, true));
    r = await inspect(page, report, {detail:'all', notes:'standard'});
    assert.deepEqual(await page.evaluate(() => ASTER_RESULT.totals), report.totals);
    results.push({name:`matched-${count}`, pages:r.pages});
    assert.equal(await page.locator('.case-heading').count(), 0);
  }
  await select(page, {count:24, scenario:'review', detail:'review'});
  r = await inspect(page, reconcile(sample), {detail:'review', notes:'standard'});
  assert.deepEqual(await page.evaluate(() => ASTER_RESULT.totals), oracle);
  assert.equal((await page.evaluate(() => ASTER_RESULT.display.shown)), 6);
  results.push({name:'review-only-24', pages:r.pages}); await screenshot(page, 'aster-review-only', [1]);
  for (const count of [24, 60, 150]) {
    await select(page, {count, detail:'all', notes:'long'});
    r = await inspect(page, reconcile(fixture(sample, count)), {detail:'all', notes:'long'});
    const stressPages = await page.locator('.printform_page').evaluateAll(ps => ps.flatMap((p, i) => p.querySelector('[data-case-id="REV-PARTIAL-003"]') ? [i] : []));
    results.push({name:`bilingual-${count}`, pages:r.pages, continuationPages:stressPages.map(i => i + 1)});
    await screenshot(page, `aster-long-${count}`, [...new Set([stressPages[0], stressPages[1], stressPages.at(-1)])]);
    if (count === 24) {
      await page.emulateMedia({media:'print'});
      await inspect(page, reconcile(fixture(sample, count)), {detail:'all', notes:'long'});
      await page.pdf({path:path.join(out, 'aster-long.pdf'), preferCSSPageSize:true, printBackground:true});
      await page.emulateMedia({media:'screen'});
      await fs.writeFile(path.join(out, 'aster-long-dom.json'), JSON.stringify(r, null, 2));
    }
  }
  await page.locator('#reset').click(); await ready(page);
  results.push(await authoredChecks(page));
  // Same-task rapid changes happen while font/formatter awaits are pending.
  await page.evaluate(() => {
    for (let i = 0; i < 25; i++) {
      for (const [id, value] of Object.entries({count:i % 2 ? '150' : '60', scenario:i % 3 ? 'review' : 'matched', notes:i % 2 ? 'long' : 'standard', detail:i % 2 ? 'review' : 'all'})) {
        const n = document.getElementById(id); n.value = value; n.dispatchEvent(new Event('change', {bubbles:true}));
      }
    }
    for (const [id, value] of Object.entries({count:'1', scenario:'matched', notes:'standard', detail:'all'})) {
      const n = document.getElementById(id); n.value = value; n.dispatchEvent(new Event('change', {bubbles:true}));
    }
  });
  await ready(page);
  assert.deepEqual(await page.evaluate(() => ASTER_RESULT.state), {count:1, matched:true, detail:'all', notes:'standard'});
  await inspect(page, reconcile(fixture(sample, 1, true)), {detail:'all', notes:'standard'});
  results.push({name:'rapid-104-events', final:'1/matched/all/standard', pages:await page.locator('.printform_page').count()});
  // Native select and reset/print button keyboard operation, no custom shortcut capture.
  await page.locator('#count').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await ready(page);
  assert.equal(await page.locator('#count').inputValue(), '1');
  await page.locator('#reset').focus(); await page.keyboard.press('Enter'); await ready(page);
  assert.equal(await page.locator('#count').inputValue(), '24');
  await page.evaluate(() => window.print = () => { window.ASTER_PRINT_CALLED = true; });
  await page.locator('#print').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => ASTER_PRINT_CALLED), true);
  // Formatter rejection must never leave a stale success or enabled print button.
  await page.evaluate(() => { window.savedFormat = PrintForm.formatAll; PrintForm.formatAll = async () => {throw new Error('Deliberate acceptance failure');}; });
  await page.selectOption('#count', '1');
  await page.waitForFunction(() => document.body.dataset.state === 'error');
  assert.ok(await page.locator('#print').isDisabled()); assert.equal(await page.locator('.printform_page').count(), 0);
  assert.match(await page.locator('#status').textContent(), /Deliberate acceptance failure.*Reset/);
  await page.screenshot({path:path.join(out, 'aster-error-state.png')});
  await page.evaluate(() => PrintForm.formatAll = window.savedFormat);
  await page.locator('#reset').click(); await ready(page);
  // Real formatter rejects an oversized authored atomic asset without clipping.
  const atomic = await page.evaluate(async () => {
    const {render} = await import('/gallery/designs/assets/aster/template.mjs');
    const {reconcile} = await import('/gallery/designs/assets/aster/reconcile.mjs');
    const data = JSON.parse(document.querySelector('#sample-data').textContent);
    const {form} = render(reconcile(data), {detail:'all', notes:'standard'}, JSON.parse(document.querySelector('#logo-data').textContent));
    const asset = document.createElement('section'); asset.className = 'prowitem'; asset.dataset.pfKeepTogether = 'true'; asset.style.height = '2000px'; asset.textContent = 'Oversized fictional atomic asset'; form.append(asset);
    document.querySelector('#preview').replaceChildren(form);
    try { await PrintForm.formatAll({force:true}); return {failed:false}; }
    catch (e) { return {failed:true, message:[e.message, ...(e.errors || []).map(n => n.message)].join(': '), sourcePreserved:form.isConnected, output:document.querySelectorAll('.printform_page').length}; }
  });
  assert.equal(atomic.failed, true); assert.equal(atomic.sourcePreserved, true); assert.equal(atomic.output, 0);
  assert.match(atomic.message, /atomic|exceeds|fit/i); results.push({name:'oversized-atomic', ...atomic});
  await page.locator('#reset').click(); await ready(page);
  await page.setViewportSize({width:390,height:844});
  const narrow = await page.locator('#preview-scroll').evaluate(n => { n.scrollLeft = 500; return {client:n.clientWidth, width:n.scrollWidth, left:n.scrollLeft, documentWidth:document.documentElement.scrollWidth}; });
  assert.equal(narrow.client, 390); assert.ok(narrow.width > 1120 && narrow.left > 400); assert.equal(narrow.documentWidth, 390);
  await page.locator('#preview-scroll').focus(); await page.keyboard.press('ArrowRight');
  await inspect(page, reconcile(sample), {detail:'all', notes:'standard'});
  await page.screenshot({path:path.join(out, 'aster-narrow.png')}); results.push({name:'keyboard-print-narrow-error-recovery', ...narrow});
  assert.deepEqual(errors, []);
  const external = requests.filter(u => !u.startsWith(new URL(url).origin)); assert.deepEqual(external, []);
  // Genuine standalone works from a detached local file with networking blocked.
  const offline = await browser.newPage(); await offline.route('http**://**/*', route => route.abort());
  await offline.goto(`file://${path.resolve(root, '../artifacts/standalone/aster-three-way-match-review-pack.html')}`); await ready(offline);
  assert.deepEqual(await offline.evaluate(() => ASTER_RESULT.totals), oracle); await offline.close();
  results.push({name:'detached-file-offline', passed:true});
  const gallery = await browser.newPage({viewport:{width:1400,height:1000}});
  await gallery.goto(`${new URL(url).origin}/gallery/index.html?category=purchasing&q=PF-065`);
  const card = gallery.locator('[data-design-id="aster-three-way-match-review-pack"]');
  await card.waitFor(); assert.equal(await gallery.locator('.gallery-card').count(), 1);
  assert.ok(await card.locator('img').evaluate(n => n.complete && n.naturalWidth > 0));
  await card.click();
  await gallery.waitForFunction(() => [...document.querySelectorAll('iframe')].some(n => n.contentWindow?.ASTER_READY), null, {timeout:120000});
  const frame = gallery.frames().find(f => f.url().endsWith('aster-three-way-match-review-pack.html'));
  assert.ok(frame);
  assert.equal(await frame.locator('.printform_page').count(), 8);
  await gallery.screenshot({path:path.join(out, 'aster-gallery.png')}); await gallery.close();
  results.push({name:'gallery-category-search-modal', pages:8, passed:true});
} finally {
  await fs.writeFile(path.join(out, 'aster-browser-results.json'), JSON.stringify({results, errors}, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
