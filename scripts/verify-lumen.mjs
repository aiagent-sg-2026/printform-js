import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fixture, defaults} from '../gallery/designs/assets/lumen/fixtures.mjs';
import {ready, select, bind, inspect} from './lumen-browser-checks.mjs';
const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(root, '../artifacts/lumen');
const base = process.env.LUMEN_BASE_URL || 'http://127.0.0.1:4268';
const detached = process.argv.includes('--standalone'), prefix = detached ? 'standalone-' : '';
const url = detached ? `file://${path.resolve(root, '../artifacts/standalone/lumen-learning-progress-portfolio.html')}` : `${base}/gallery/designs/lumen-learning-progress-portfolio.html`;
const sample = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/lumen/sample.json')));
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/home/ai-agent/.cache/ms-playwright/chromium-1234/chrome-linux/chrome'});
const results = [], errors = [], networkErrors = [];
async function save(page, name, dom, data, screenshots = true) {
  name = prefix + name;
  await fs.writeFile(path.join(out, `${name}-dom.json`), JSON.stringify(dom, null, 2));
  await fs.writeFile(path.join(out, `${name}-source.json`), JSON.stringify(data, null, 2));
  await page.pdf({path:path.join(out, `${name}.pdf`), preferCSSPageSize:true, printBackground:true});
  if (screenshots) for (const index of [...new Set([0, Math.floor(dom.pages / 2), dom.pages - 1])]) await page.locator('.physical_page_wrapper').nth(index).screenshot({path:path.join(out, `${name}-page-${index + 1}.png`)});
}
try {
  const page = await browser.newPage({viewport:{width:1200,height:1100}});
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => networkErrors.push(r.url()));
  page.on('response', r => { if (!r.ok()) networkErrors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url); await ready(page);
  let dom = await inspect(page, sample, defaults); await save(page, 'default', dom, sample);
  results.push({name:'default', pages:dom.pages});
  if (!detached) {
    await page.locator('.physical_page_wrapper').first().screenshot({path:path.join(out, 'thumbnail.png')});
    await fs.copyFile(path.join(out, 'thumbnail.png'), path.join(root, 'gallery/thumbs/lumen-learning-progress-portfolio.png'));
    for (const [name, values] of [['small', {domains:4, terms:1, language:'english'}], ['stress', {domains:12, terms:2}], ['missing', {attendance:'missing'}], ['zero', {attendance:'zero'}]]) {
      const state = {...defaults, ...values}, data = fixture(sample, state);
      await select(page, state); dom = await inspect(page, data, state); await save(page, name, dom, data);
      results.push({name, pages:dom.pages});
    }
  }
  const long = {...defaults, comments:'long'}, longData = fixture(sample, long);
  await select(page, long); dom = await inspect(page, longData, long);
  const longFragments = dom.fields.filter(f => f.key === 'reflections.0.comment').length;
  assert.ok(longFragments > 1, 'actual long CJK paragraph continues across pages');
  await save(page, 'long', dom, longData); results.push({name:'long', pages:dom.pages, longFragments});
  if (!detached) {
    const mutated = structuredClone(sample), marker = '<>& "literal" 中文';
    Object.assign(mutated.document, {id:'LUMEN-MUTATED-888', title:`A different fictional learning journal ${marker}`, notice:`Changed notice ${marker}`, issued:'2026-12-12'});
    Object.assign(mutated.school, {name:`Imagined Studio ${marker}`, address:Array(25).fill(`Fictional garden lane ${marker}`).join(' '), teacher:`Educator Cedar ${marker}`});
    Object.assign(mutated.child, {id:'FICTIONAL-LEARNER-42', pseudonym:`Demo Fern ${marker}`, className:`Imagined learning circle ${marker}`, ageBand:`Fictional group ${marker}`, introduction:Array.from({length:45}, (_, i) => `Context ${i + 1}: Fern selected paper leaves and described a learning invitation. 情境${i + 1}：保留原始记录中的完整语句与顺序，不作能力推断。 ${marker}`).join('\n')});
    mutated.teacherReview.reviewer = `Educator Cedar ${marker}`;
    mutated.domains[0].id = 'DOMAIN-MUTATED-01';
    for (const r of mutated.reflections) if (r.domainId === sample.domains[0].id) r.domainId = mutated.domains[0].id;
    for (const e of mutated.evidence) e.domainIds = e.domainIds.map(id => id === sample.domains[0].id ? mutated.domains[0].id : id);
    for (const g of mutated.goals) if (g.domainId === sample.domains[0].id) g.domainId = mutated.domains[0].id;
    mutated.evidence[0].description = Array.from({length:36}, (_, i) => `Record detail ${i + 1}: Source text <material> & observation. 观察细节${i + 1}：完整记录材料、情境与教师提供的支持。`).join('\n');
    await fs.writeFile(path.join(out, 'metadata-source.json'), JSON.stringify(mutated, null, 2));
    await bind(page, mutated, defaults); dom = await inspect(page, mutated, defaults); await save(page, 'metadata', dom, mutated);
    assert.ok(dom.pageInfo.every(p => p.footer.includes(mutated.document.id) && !p.footer.includes(sample.document.id)));
    assert.ok(!dom.pageInfo.map(p => p.text).join('').includes(sample.child.id));
    results.push({name:'metadata', pages:dom.pages});
    for (const edge of JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/lumen/edges.json')))) {
      const state = {...defaults, domains:4, terms:1}, data = Object.assign(fixture(sample, state), edge.replaceTopLevel);
      if (edge.valid) {
        await bind(page, data, state); dom = await inspect(page, data, state); await save(page, edge.name, dom, data, false);
        results.push({name:edge.name, pages:dom.pages});
      } else {
        await page.locator('#sample-data').evaluate((n, d) => n.textContent = JSON.stringify(d), data);
        await page.selectOption('#language', 'english'); await page.waitForFunction(() => document.body.dataset.state === 'error');
        assert.equal(await page.locator('.printform_page').count(), 0); assert.ok(await page.locator('#print').isDisabled());
        assert.equal(await page.evaluate(() => LUMEN_RESULT), null);
        await page.screenshot({path:path.join(out, `${edge.name}-error.png`)});
        await bind(page, sample, defaults); await inspect(page, sample, defaults);
        results.push({name:edge.name, staleCleared:true, printDisabled:true, recovered:true});
      }
    }
    for (const domains of [4, 8, 12]) for (const terms of [1, 2]) {
      await page.goto(url); await ready(page);
      const state = {...defaults, domains, terms}; await select(page, state);
      dom = await inspect(page, fixture(sample, state), state); results.push({name:`browser-scale-${domains}x${terms}`, pages:dom.pages});
    }
    const multi = fixture(sample, {...defaults, domains:4, terms:1}); multi.evidence[0].domainIds.push(multi.domains[3].id);
    await bind(page, multi, {...defaults, domains:4, terms:1}); dom = await inspect(page, multi, {...defaults, domains:4, terms:1});
    assert.equal(dom.result.summary.observedRecordCount, 2); assert.equal(dom.result.summary.evidenceCoverage.numerator, 3);
    await save(page, 'multi-domain', dom, multi, false); results.push({name:'multi-domain-once-globally', pages:dom.pages});
    await page.goto(url); await ready(page);
    await page.evaluate(() => {
      for (let i = 0; i < 20; i++) for (const [key, v] of Object.entries({domains:i % 2 ? 12 : 4, terms:i % 2 ? 2 : 1, attendance:i % 2 ? 'missing' : 'zero', comments:i % 2 ? 'long' : 'standard'})) {
        const n = document.getElementById(key); n.value = String(v); n.dispatchEvent(new Event('change'));
      }
    });
    await select(page, defaults); await inspect(page, sample, defaults);
    assert.deepEqual(await page.evaluate(() => LUMEN_RESULT.state), defaults);
    results.push({name:'rapid-85-events-final-state-wins', passed:true});
    await page.locator('#reset').focus(); await page.keyboard.press('Enter'); await ready(page);
    await page.locator('#domains').focus(); await page.keyboard.press('Home'); await page.keyboard.press('Enter'); await ready(page);
    assert.equal(await page.locator('#domains').inputValue(), '4');
    await page.evaluate(() => window.print = () => window.LUMEN_PRINT_CALLED = true);
    await page.locator('#print').focus(); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => LUMEN_PRINT_CALLED), true);
    await page.locator('#reset').click(); await ready(page);
    await page.setViewportSize({width:390,height:844});
    const narrow = await page.locator('#preview-scroll').evaluate(n => {n.scrollLeft = 300; return {width:n.clientWidth, scroll:n.scrollWidth, left:n.scrollLeft, document:document.documentElement.scrollWidth, controls:[...document.querySelectorAll('button,select')].map(n => n.getBoundingClientRect().height)};});
    assert.equal(narrow.width, 390); assert.equal(narrow.document, 390); assert.ok(narrow.scroll > 790 && narrow.left >= 300); assert.ok(narrow.controls.every(h => h >= 44));
    await inspect(page, sample, defaults); await page.screenshot({path:path.join(out, 'narrow.png')}); results.push({name:'keyboard-print-reset-narrow', ...narrow});
    const gallery = await browser.newPage({viewport:{width:1400,height:1000}});
    await gallery.goto(`${base}/gallery/index.html?category=education&q=PF-067`);
    const card = gallery.locator('[data-design-id="lumen-learning-progress-portfolio"]'); await card.waitFor();
    assert.equal(await gallery.locator('.gallery-card').count(), 1); assert.ok(await card.locator('img').evaluate(n => n.complete && n.naturalWidth > 0));
    await card.click(); await gallery.waitForFunction(() => [...document.querySelectorAll('iframe')].some(n => n.contentWindow?.LUMEN_READY), null, {timeout:180000});
    await gallery.waitForFunction(() => document.querySelector('[data-print]').disabled === false);
    assert.ok(await gallery.locator('.preview-status').isHidden());
    await gallery.screenshot({path:path.join(out, 'gallery.png')});
    const frame = gallery.frames().find(f => f.url().includes('lumen-learning-progress-portfolio.html'));
    await frame.evaluate(() => window.print = () => window.LUMEN_GALLERY_PRINT = true);
    await gallery.locator('[data-print]').click(); assert.equal(await frame.evaluate(() => LUMEN_GALLERY_PRINT), true);
    await gallery.locator('[data-close]').click(); assert.equal(await gallery.locator('#design-modal').evaluate(n => n.open), false);
    assert.ok(await card.evaluate(n => n === document.activeElement));
    results.push({name:'gallery-category-search-modal-print-close-focus', passed:true});
  }
  assert.deepEqual(errors, []); assert.deepEqual(networkErrors, []);
} finally {
  await fs.writeFile(path.join(out, `${prefix}browser-results.json`), JSON.stringify({results, errors, networkErrors}, null, 2)); await browser.close();
}
console.log(JSON.stringify(results));
