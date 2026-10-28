import assert from 'node:assert/strict';
import {money} from '../gallery/designs/assets/aster/reconcile.mjs';
export async function ready(page) {
  await page.waitForFunction(() => ['ready', 'error'].includes(document.body.dataset.state), null, {timeout:120000});
  assert.equal(await page.locator('body').getAttribute('data-state'), 'ready', await page.locator('#status').textContent());
}
export async function select(page, values) {
  for (const [id, value] of Object.entries(values)) {
    await page.selectOption(`#${id}`, String(value)); await ready(page);
  }
}
export async function inspect(page, report, state) {
  const expectedPO = state.detail === 'review' ? report.rows.filter(r => report.cases.some(c => (c.poId || `POL-${c.id.slice(-3)}`) === r.id)) : report.rows;
  const actual = await page.evaluate(() => {
    const pages = [...document.querySelectorAll('#preview .printform_page')];
    const errors = [], lineMoney = [], allMoney = [], po = [], monetaryRects = [];
    const fragments = [];
    pages.forEach((p, i) => {
      const b = p.getBoundingClientRect();
      if (Math.abs(b.width - 273 * 96 / 25.4) > 1 || Math.abs(b.height - 190 * 96 / 25.4) > 1) errors.push(`paper geometry ${i}`);
      if (p.querySelector('[data-page-number]')?.textContent !== String(i + 1) || p.querySelector('[data-page-total]')?.textContent !== String(pages.length)) errors.push(`page numbering ${i}`);
      if (p.querySelectorAll('.running-header').length !== 1 || p.querySelectorAll('.running-footer').length !== 1) errors.push(`chrome ${i}`);
      const business = [...p.children].filter(n => !n.matches('.running-header,.running-footer,.dummy_spacer'));
      if (!business.length) errors.push(`empty business page ${i}`);
      for (const n of p.querySelectorAll('table,td,th,img,.opening,.final-record')) {
        const r = n.getBoundingClientRect();
        if (r.left < b.left - 1 || r.right > b.right + 1 || r.bottom > b.bottom + 1 || n.scrollWidth > n.clientWidth + 1) errors.push(`overflow page ${i + 1} ${n.tagName}`);
      }
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT), range = document.createRange();
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) continue;
        range.selectNodeContents(walker.currentNode);
        const owner = walker.currentNode.parentElement.closest('td,th') || p;
        const cell = owner.getBoundingClientRect();
        for (const r of range.getClientRects()) if (r.width && (r.left < cell.left - 1 || r.right > cell.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1)) errors.push(`text overflow page ${i + 1}`);
      }
      p.querySelectorAll('[data-money-id]').forEach(n => {
        if (!n.textContent.trim()) return;
        const value = {id:n.dataset.moneyId, text:n.textContent}; allMoney.push(value);
        if (value.id.startsWith('line-')) lineMoney.push(value);
        const r = n.getBoundingClientRect();
        monetaryRects.push({...value, page:i + 1, x:r.left - b.left, y:r.top - b.top, width:r.width, height:r.height});
      });
      p.querySelectorAll('[data-po-id]').forEach(n => { if (n.dataset.pfFragmentIndex === undefined || n.dataset.pfFragmentIndex === '0') po.push(n.dataset.poId); });
      p.querySelectorAll('[data-pf-source-row]').forEach(n => fragments.push({token:n.dataset.pfSourceRow, index:Number(n.dataset.pfFragmentIndex), count:Number(n.dataset.pfFragmentCount), case:n.dataset.caseId,
        cells:[...n.querySelectorAll('td')].map(c => ({policy:c.dataset.pfCellPolicy, key:c.dataset.cellKey, text:c.textContent}))}));
    });
    const records = [...document.querySelectorAll('#preview .final-record')];
    return {errors, po, lineMoney, allMoney, fragments, monetaryRects, pages:pages.length,
      recordPages:records.map(n => pages.indexOf(n.closest('.printform_page')) + 1)};
  });
  assert.deepEqual(actual.errors, []);
  assert.deepEqual(actual.po, expectedPO.map(r => r.id));
  const expectedLines = [...expectedPO.flatMap(r => r.linked), ...report.unmatched];
  assert.deepEqual(actual.lineMoney, expectedLines.map(l => ({id:`line-${l.id}`, text:money(l.amount)})));
  assert.equal(new Set(actual.allMoney.map(m => m.id)).size, actual.allMoney.length, 'monetary fields must be first-only');
  assert.deepEqual(actual.recordPages, report.rows.length ? [actual.pages] : []);
  const groups = Map.groupBy(actual.fragments, f => f.token);
  for (const list of groups.values()) {
    assert.deepEqual(list.map(f => f.index), Array.from({length:list[0].count}, (_, i) => i));
    for (let cell = 0; cell < list[0].cells.length; cell++) {
      if (list[0].cells[cell].policy === 'first') assert.ok(list.slice(1).every(f => !f.cells[cell].text.trim()));
    }
  }
  if (state.notes === 'long' && report.cases.some(c => c.id === 'REV-PARTIAL-003')) {
    const fragments = actual.fragments.filter(f => f.case === 'REV-PARTIAL-003');
    assert.ok(fragments.length > 1, 'real measured bilingual continuations required');
    const expectedText = await page.evaluate(async () => {
      const {render} = await import('/gallery/designs/assets/aster/template.mjs');
      const {reconcile} = await import('/gallery/designs/assets/aster/reconcile.mjs');
      const {fixture} = await import('/gallery/designs/assets/aster/fixtures.mjs');
      const sample = JSON.parse(document.querySelector('#sample-data').textContent);
      return render(reconcile(fixture(sample, Number(document.querySelector('#count').value))), {detail:document.querySelector('#detail').value, notes:'long'}, '').form.querySelector('[data-cell-key="narrative-REV-PARTIAL-003"]').textContent;
    });
    assert.equal(fragments.map(f => f.cells[1].text).join(''), expectedText, 'exact CJK/English grapheme order');
  }
  return actual;
}
