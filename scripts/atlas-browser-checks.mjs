import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {render} from '../gallery/designs/assets/atlas/template.mjs';
const {window} = new JSDOM('');
export async function ready(page) {
  await page.waitForFunction(() => ['ready', 'error'].includes(document.body.dataset.state), null, {timeout:120000});
  assert.equal(await page.locator('body').getAttribute('data-state'), 'ready', await page.locator('#status').textContent());
}
export async function select(page, values) {
  // One browser task gives a genuine burst and exercises serialized last-state-wins.
  await page.evaluate(values => {
    for (const [key, value] of Object.entries(values)) {
      const n = document.getElementById(key); n.value = String(value); n.dispatchEvent(new Event('change', {bubbles:true}));
    }
  }, values);
  await ready(page);
}
export async function inspect(page, report, state) {
  globalThis.document = window.document;
  const source = render(report, state, 'data:image/svg+xml,');
  const sourceMoney = [...source.querySelectorAll('[data-money-id]')].map(n => ({id:n.dataset.moneyId, text:n.textContent}));
  const rows = [...source.querySelectorAll('[data-row-key]')].map(n => ({key:n.dataset.rowKey, text:n.textContent,
    cells:[...n.querySelectorAll('td')].map(c => ({policy:c.dataset.pfCellPolicy, text:c.textContent}))}));
  const actual = await page.evaluate(() => {
    const pages = [...document.querySelectorAll('#preview .printform_page')];
    const errors = [], money = [], monetaryRects = [], splitRects = [], rows = [], lineIds = [], headings = [];
    for (const [index, p] of pages.entries()) {
      const b = p.getBoundingClientRect();
      if (Math.abs(b.width - 273 * 96 / 25.4) > 1 || Math.abs(b.height - 190 * 96 / 25.4) > 1) errors.push(`paper ${index}`);
      if (p.querySelector('[data-page-number]')?.textContent !== String(index + 1) || p.querySelector('[data-page-total]')?.textContent !== String(pages.length)) errors.push(`number ${index}`);
      if (p.querySelectorAll('.running-header').length !== 1 || p.querySelectorAll('.running-footer').length !== 1) errors.push(`chrome ${index}`);
      const header = p.querySelector('.running-header').getBoundingClientRect(), footer = p.querySelector('.running-footer').getBoundingClientRect();
      const business = [...p.children].filter(n => !n.matches('.running-header,.running-footer,.dummy_spacer'));
      if (!business.length) errors.push(`empty ${index}`);
      let bottom = header.bottom;
      for (const n of business) {
        const r = n.getBoundingClientRect();
        if (r.top < bottom - 1 || r.bottom > footer.top + 1) errors.push(`overlap ${index}`);
        bottom = r.bottom;
      }
      for (const n of p.querySelectorAll('table,td,th,img,.masthead,.final-record')) {
        const r = n.getBoundingClientRect();
        if (r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1 || n.scrollWidth > n.clientWidth + 1) errors.push(`overflow ${index}/${n.tagName}`);
      }
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT), range = document.createRange();
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) continue;
        range.selectNodeContents(walker.currentNode);
        const owner = walker.currentNode.parentElement.closest('td,th') || p, cell = owner.getBoundingClientRect();
        for (const r of range.getClientRects()) if (r.width && (r.left < cell.left - 1 || r.right > cell.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1)) errors.push(`text bounds ${index}`);
      }
      for (const n of p.querySelectorAll('[data-money-id]')) {
        if (!n.textContent.trim()) continue;
        const value = {id:n.dataset.moneyId, text:n.textContent}; money.push(value);
        const r = n.getBoundingClientRect(); monetaryRects.push({...value, page:index + 1, x:r.left - b.left, y:r.top - b.top, width:r.width, height:r.height});
        if (parseFloat(getComputedStyle(n).fontSize) < 13.99) errors.push(`small body money ${index}`);
      }
      for (const n of p.querySelectorAll('td[data-pf-cell-policy="split"]')) {
        if (!n.textContent) continue;
        const r = n.getBoundingClientRect();
        splitRects.push({page:index + 1, text:n.textContent, key:n.dataset.cellKey, x:r.left - b.left, y:r.top - b.top, width:r.width, height:r.height});
      }
      for (const n of p.querySelectorAll('[data-row-key]')) rows.push({key:n.dataset.rowKey, text:n.textContent, index:n.dataset.pfFragmentIndex,
        cells:[...n.querySelectorAll('td')].map(c => ({policy:c.dataset.pfCellPolicy, text:c.textContent}))});
      for (const n of p.querySelectorAll('[data-line-id]')) if (!n.dataset.pfFragmentIndex || n.dataset.pfFragmentIndex === '0') lineIds.push(n.dataset.lineId);
      headings.push([...p.querySelectorAll('.prowheader_processed')].map(n => n.dataset.pfTableId));
    }
    return {errors, money, monetaryRects, splitRects, rows, lineIds, headings, pages:pages.length,
      recordPages:[...document.querySelectorAll('#preview .final-record')].map(n => pages.indexOf(n.closest('.printform_page')) + 1),
      mastheads:document.querySelectorAll('#preview .masthead').length};
  });
  assert.deepEqual(actual.errors, []);
  assert.deepEqual(actual.money, sourceMoney, 'all monetary fields once in exact source order');
  assert.equal(new Set(actual.money.map(n => n.id)).size, sourceMoney.length);
  assert.deepEqual(actual.lineIds, report.data.lines.map(l => l.id));
  assert.equal(actual.mastheads, 1); assert.deepEqual(actual.recordPages, [actual.pages]);
  const groups = Map.groupBy(actual.rows, n => n.key);
  assert.deepEqual([...groups.keys()], rows.map(r => r.key), 'no dropped, duplicated or reordered source rows');
  for (const row of rows) {
    const fragments = groups.get(row.key);
    if (!row.cells.length) { assert.equal(fragments.map(n => n.text).join(''), row.text); continue; }
    for (let i = 0; i < row.cells.length; i++) {
      const cell = row.cells[i], values = fragments.map(n => n.cells[i].text);
      if (cell.policy === 'repeat') values.forEach(value => assert.equal(value, cell.text));
      else {
        assert.equal(values.join(''), cell.text, `exact text conservation row ${row.key}/${i}`);
        if (cell.policy === 'first') assert.ok(values.slice(1).every(v => v === ''));
      }
    }
  }
  assert.deepEqual(await page.evaluate(() => ATLAS_RESULT.totals), report.totals);
  assert.equal(await page.evaluate(() => ATLAS_RESULT.partial), report.partial);
  return actual;
}
