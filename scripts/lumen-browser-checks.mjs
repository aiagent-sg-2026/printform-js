import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {render} from '../gallery/designs/assets/lumen/template.mjs';
import {summarize} from '../gallery/designs/assets/lumen/model.mjs';
const {window} = new JSDOM('');
export async function ready(page) {
  await page.waitForFunction(() => ['ready', 'error'].includes(document.body.dataset.state), null, {timeout:180000});
  assert.equal(await page.locator('body').getAttribute('data-state'), 'ready', await page.locator('#status').textContent());
}
export async function select(page, state) {
  await page.evaluate(values => {
    for (const [key, value] of Object.entries(values)) {
      const n = document.getElementById(key); n.value = String(value); n.dispatchEvent(new Event('change', {bubbles:true}));
    }
  }, state); await ready(page);
}
export async function bind(page, data, state) {
  await page.locator('#sample-data').evaluate((n, value) => n.textContent = JSON.stringify(value), data);
  await select(page, state);
}
export async function inspect(page, data, state) {
  globalThis.document = window.document;
  const summary = summarize(data), source = render(data, summary, state, 'data:image/svg+xml,');
  const expectedFields = [...source.querySelectorAll('[data-source-key]')].map(n => ({key:n.dataset.sourceKey, text:n.textContent}));
  const expectedRows = [...source.querySelectorAll('[data-row-key]')].map(n => ({key:n.dataset.rowKey, cells:[...n.querySelectorAll('td')].map(c => c.textContent)}));
  const dom = await page.evaluate(() => {
    const pages = [...document.querySelectorAll('#preview .printform_page')], errors = [], fields = [], rows = [], cells = [], pageInfo = [];
    for (const [i, p] of pages.entries()) {
      const b = p.getBoundingClientRect(), header = p.querySelector('.running-header'), footer = p.querySelector('.running-footer');
      if (Math.abs(b.width - 186 * 96 / 25.4) > 1 || Math.abs(b.height - 273 * 96 / 25.4) > 1) errors.push(`paper ${i}`);
      if (p.querySelector('[data-page-number]')?.textContent !== String(i + 1) || p.querySelector('[data-page-total]')?.textContent !== String(pages.length)) errors.push(`number ${i}`);
      if (!header || !footer || !footer.textContent.includes('FICTIONAL LEARNING PORTFOLIO — DEMO ONLY')) errors.push(`chrome ${i}`);
      const body = [...p.children].filter(n => !n.matches('.running-header,.running-footer,.dummy_spacer'));
      if (!body.length || !body.some(n => n.textContent.trim())) errors.push(`blank ${i}`);
      let bottom = header.getBoundingClientRect().bottom;
      for (const n of body) {
        const r = n.getBoundingClientRect();
        if (r.top < bottom - 1 || r.bottom > footer.getBoundingClientRect().top + 1) errors.push(`collision ${i}/${n.className}`);
        bottom = r.bottom;
      }
      for (const n of [p, ...p.querySelectorAll('td,th,table,img,svg')]) {
        const r = n.getBoundingClientRect();
        if (r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1 || n.scrollWidth > n.clientWidth + 1) errors.push(`overflow ${i}/${n.tagName}`);
      }
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT), range = document.createRange();
      while (walker.nextNode()) {
        const n = walker.currentNode; if (!n.textContent.trim() || n.parentElement.closest('svg')) continue;
        range.selectNodeContents(n);
        const parent = n.parentElement.closest('td,th') || p, cell = parent.getBoundingClientRect();
        for (const r of range.getClientRects()) if (r.width && (r.left < cell.left - 1 || r.right > cell.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1)) errors.push(`text bounds ${i}`);
        if (parseFloat(getComputedStyle(n.parentElement).fontSize) < 9.5 * 96 / 72 - .01) errors.push(`type too small ${i}`);
      }
      for (const n of p.querySelectorAll('[data-source-key]')) if (n.textContent) fields.push({key:n.dataset.sourceKey, text:n.textContent});
      for (const n of p.querySelectorAll('[data-row-key]')) rows.push({key:n.dataset.rowKey, cells:[...n.querySelectorAll('td')].map(c => c.textContent)});
      for (const n of p.querySelectorAll('td')) {
        if (!n.textContent.trim()) continue;
        const r = n.getBoundingClientRect(); cells.push({page:i + 1, text:n.textContent, x:r.left - b.left, y:r.top - b.top, width:r.width, height:r.height});
      }
      pageInfo.push({number:i + 1, text:p.textContent, headers:[...p.querySelectorAll('.prowheader_processed')].map(n => n.dataset.pfTableId), footer:footer.textContent, bodyBottom:bottom - b.top, footerTop:footer.getBoundingClientRect().top - b.top});
    }
    return {pages:pages.length, errors, fields, rows, cells, pageInfo, result:window.LUMEN_RESULT};
  });
  assert.deepEqual(dom.errors, []);
  assert.deepEqual(dom.result.summary, summary);
  const groups = Map.groupBy(dom.fields, f => f.key);
  assert.equal(groups.size, expectedFields.length, 'no hidden or invented source fields');
  for (const f of expectedFields) assert.equal(groups.get(f.key)?.map(n => n.text).join(''), f.text, `exact English/CJK source conservation ${f.key}`);
  const rowGroups = Map.groupBy(dom.rows, r => r.key);
  assert.deepEqual([...rowGroups.keys()], expectedRows.map(r => r.key), 'row identity and order');
  for (const r of expectedRows) r.cells.forEach((text, i) => assert.equal(rowGroups.get(r.key).map(f => f.cells[i]).join(''), text, `all words/labels in exact order ${r.key}/${i}`));
  assert.equal(await page.locator('#preview [onerror],#preview script').count(), 0);
  return dom;
}
