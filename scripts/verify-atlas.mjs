import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {model} from '../gallery/designs/assets/atlas/model.mjs';
import {fixture, defaults} from '../gallery/designs/assets/atlas/fixtures.mjs';
import {ready, select, inspect} from './atlas-browser-checks.mjs';
import {capture, pdf} from './atlas-capture.mjs';
const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(root, '../artifacts/atlas');
const base = process.env.ATLAS_BASE_URL || 'http://127.0.0.1:4266';
const url = `${base}/gallery/designs/atlas-landed-cost-dossier.html`;
const sample = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/atlas/sample.json')));
const oracle = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/atlas/expected.json')));
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
const results = [], errors = [], networkErrors = [];
try {
  const page = await browser.newPage({viewport:{width:1400,height:1100}});
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => networkErrors.push(r.url()));
  page.on('response', r => { if (!r.ok()) networkErrors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url); await ready(page);
  let dom = await inspect(page, model(sample), defaults);
  assert.deepEqual(await page.evaluate(() => ATLAS_RESULT.totals), oracle.defaultScenarios['value-actual']);
  results.push({name:'default', pages:dom.pages});
  await capture(page, out, 'default'); await pdf(page, out, 'default', dom);
  await page.locator('.physical_page_wrapper').first().screenshot({path:path.join(out, 'thumbnail.png')});
  for (const basis of ['value', 'quantity', 'weight']) for (const mode of ['estimated', 'actual']) {
    const state = {...defaults, basis, mode}; await select(page, state);
    dom = await inspect(page, model(sample, basis, mode), state);
    assert.deepEqual(await page.evaluate(() => ATLAS_RESULT.totals), oracle.defaultScenarios[`${basis}-${mode}`]);
    results.push({name:`default-${basis}-${mode}`, pages:dom.pages});
  }
  for (const scenario of ['missing', 'zero']) for (const basis of ['value', 'quantity', 'weight']) for (const mode of ['estimated', 'actual']) {
    const state = {...defaults, scenario, basis, mode}; await select(page, state);
    const report = model(fixture(sample, state), basis, mode); dom = await inspect(page, report, state);
    results.push({name:`${scenario}-${basis}-${mode}`, pages:dom.pages, partial:report.partial, allocated:report.totals.allocatedFeesCents, unallocated:report.totals.unallocatedFeesCents});
    if (scenario === 'missing' && basis === 'weight' && mode === 'actual') await capture(page, out, 'missing', [0, dom.pages - 1]);
  }
  for (const [containers, count] of [[1, 10], [8, 10], [1, 120], [8, 120], [3, 50]]) {
    const state = {...defaults, containers, count}; await select(page, state);
    dom = await inspect(page, model(fixture(sample, state)), state);
    results.push({name:`scale-${containers}-${count}`, pages:dom.pages});
    if (containers === 8 && count === 120) {
      await capture(page, out, 'dense', [1, Math.floor(dom.pages / 2), dom.pages - 1]); await pdf(page, out, 'dense', dom);
    }
  }
  const long = {...defaults, notes:'long'}; await select(page, long);
  dom = await inspect(page, model(sample), long);
  const longPages = await page.locator('.printform_page').evaluateAll(ps => ps.flatMap((p, i) => p.querySelector('[data-narrative]') ? [i] : []));
  assert.ok(longPages.length > 1); await capture(page, out, 'long', longPages); await pdf(page, out, 'long', dom);
  results.push({name:'long-bilingual', pages:dom.pages, narrativePages:longPages.map(i => i + 1)});
  // Actual source mutation, not a second handcrafted template.
  const mutated = structuredClone(sample), marker = 'MUT-<&"literal>';
  Object.assign(mutated.document, {id:'DOC-' + marker, title:'Traceable dossier / 中文 <literal>', company:'Fictional <img src=x onerror=alert(1)> studio', asOfDate:'2027-02-19', notice:'Custom <notice> & demo only'});
  Object.assign(mutated.shipment, {id:'SHIP-' + marker, origin:'Origin <literal> 中文', destination:'Destination & delta', routeLabel:'Custom route & no map claim', departureDate:'2027-02-01', arrivalDate:'2027-02-18'});
  const oldId = mutated.containers[0].id; mutated.containers[0].id = 'BOX-' + marker;
  Object.assign(mutated.containers[0], {label:'Custom container 中文', reference:'REF-' + marker, sealReference:'SEAL-' + marker});
  mutated.lines.filter(l => l.containerId === oldId).forEach(l => l.containerId = mutated.containers[0].id);
  mutated.charges.forEach(c => c.scopeContainerIds = c.scopeContainerIds.map(id => id === oldId ? mutated.containers[0].id : id));
  const oldLine = mutated.lines[0].id; mutated.lines[0].id = 'LINE-' + marker; mutated.lines[0].sku = 'SKU-' + marker;
  mutated.lines[0].description = Array(65).fill('Long fictional <cargo> 中文 source description & exact order.').join(' ');
  mutated.charges.forEach(c => c.eligibleLineIds = c.eligibleLineIds.map(id => id === oldLine ? mutated.lines[0].id : id));
  mutated.charges[0].id = 'FEE-' + marker; mutated.charges[0].sourceRef = 'SRC-' + marker; mutated.charges[0].description = 'Custom <transport> & fictional';
  await fs.writeFile(path.join(out, 'mutated-source.json'), JSON.stringify(mutated, null, 2));
  const html = await fs.readFile(path.join(root, 'gallery/designs/atlas-landed-cost-dossier.html'), 'utf8');
  await page.route(url, route => route.fulfill({contentType:'text/html', body:html.replace(/(<script type="application\/json" id="sample-data">)[\s\S]*?(<\/script>)/, (_, a, b) => a + JSON.stringify(mutated).replace(/</g, '\\u003c') + b)}), {times:1});
  await page.goto(url); await ready(page); dom = await inspect(page, model(mutated), defaults);
  const rendered = await page.locator('#preview').textContent();
  for (const value of [mutated.document.id, mutated.document.title, mutated.document.company, mutated.document.asOfDate, mutated.document.notice,
    ...Object.values(mutated.shipment), ...Object.values(mutated.containers[0]), mutated.lines[0].sku, mutated.charges[0].sourceRef, mutated.charges[0].description]) assert.ok(rendered.includes(value), `bound metadata ${value.slice(0, 60)}`);
  const description = await page.locator('[data-line-id] [data-cell-key="description"]').allTextContents();
  assert.ok(description.join('').includes(mutated.lines[0].description), 'long description conserved across physical fragments');
  assert.equal(await page.locator('#preview [onerror],#preview script').count(), 0);
  assert.ok(!rendered.includes(sample.document.id));
  await capture(page, out, 'metadata', [0, 1, dom.pages - 1]); await pdf(page, out, 'metadata', dom);
  results.push({name:'escaped-metadata-and-long-description', pages:dom.pages});
  await page.goto(url); await ready(page);
  await page.evaluate(() => {
    for (let i = 0; i < 24; i++) for (const [key, value] of Object.entries({containers:i % 2 ? '8' : '1', count:i % 2 ? '120' : '10', basis:i % 2 ? 'weight' : 'value', mode:i % 2 ? 'estimated' : 'actual', scenario:i % 2 ? 'missing' : 'zero', notes:i % 2 ? 'long' : 'standard'})) {
      const n = document.getElementById(key); n.value = value; n.dispatchEvent(new Event('change', {bubbles:true}));
    }
  });
  const final = {...defaults, containers:1, count:10}; await select(page, final);
  await inspect(page, model(fixture(sample, final)), final); assert.deepEqual(await page.evaluate(() => ATLAS_RESULT.state), final);
  results.push({name:'rapid-150-events-last-state-wins', passed:true});
  await page.locator('#reset').focus(); await page.keyboard.press('Enter'); await ready(page);
  await page.locator('#count').focus(); await page.keyboard.press('Home'); await page.keyboard.press('Enter'); await ready(page);
  assert.equal(await page.locator('#count').inputValue(), '10');
  await page.evaluate(() => window.print = () => window.ATLAS_PRINT_CALLED = true);
  await page.locator('#print').focus(); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => ATLAS_PRINT_CALLED), true);
  await page.evaluate(() => { window.savedFormat = PrintForm.formatAll; PrintForm.formatAll = async () => {throw new Error('Deliberate acceptance failure');}; });
  await page.selectOption('#count', '24'); await page.waitForFunction(() => document.body.dataset.state === 'error');
  assert.ok(await page.locator('#print').isDisabled()); assert.equal(await page.locator('.printform_page').count(), 0); assert.equal(await page.evaluate(() => ATLAS_RESULT), null);
  assert.match(await page.locator('#status').textContent(), /Deliberate acceptance failure.*Reset/);
  await page.screenshot({path:path.join(out, 'error.png')});
  await page.evaluate(() => PrintForm.formatAll = savedFormat); await page.locator('#reset').click(); await ready(page);
  await page.setViewportSize({width:390,height:844});
  const narrow = await page.locator('#preview-scroll').evaluate(n => {n.scrollLeft = 500; return {width:n.clientWidth, scroll:n.scrollWidth, left:n.scrollLeft, document:document.documentElement.scrollWidth};});
  assert.equal(narrow.width, 390); assert.equal(narrow.document, 390); assert.ok(narrow.scroll > 1120 && narrow.left > 400);
  await page.locator('#preview-scroll').focus(); await page.keyboard.press('ArrowRight'); await inspect(page, model(sample), defaults);
  await page.screenshot({path:path.join(out, 'narrow.png')}); results.push({name:'keyboard-print-error-recovery-narrow', ...narrow});
  assert.deepEqual(errors, []); assert.deepEqual(networkErrors, []);
  await page.close();
  const gallery = await browser.newPage({viewport:{width:1400,height:1000}});
  await gallery.goto(`${base}/gallery/index.html?category=inventory-logistics&q=PF-066`);
  const card = gallery.locator('[data-design-id="atlas-landed-cost-dossier"]'); await card.waitFor();
  assert.equal(await gallery.locator('.gallery-card').count(), 1); assert.ok(await card.locator('img').evaluate(n => n.complete && n.naturalWidth > 0));
  await card.click(); await gallery.waitForFunction(() => [...document.querySelectorAll('iframe')].some(n => n.contentWindow?.ATLAS_READY), null, {timeout:120000});
  await gallery.screenshot({path:path.join(out, 'gallery.png')}); results.push({name:'gallery-category-search-modal', passed:true});
} finally {
  await fs.writeFile(path.join(out, 'browser-results.json'), JSON.stringify({results, errors, networkErrors}, null, 2)); await browser.close();
}
console.log(JSON.stringify(results, null, 2));
