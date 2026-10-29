import assert from 'node:assert/strict';
import {inspect, ready} from './aster-browser-checks.mjs';
export async function authoredChecks(page) {
  const report = await page.evaluate(async () => {
    const {render} = await import('/gallery/designs/assets/aster/template.mjs');
    const {reconcile} = await import('/gallery/designs/assets/aster/reconcile.mjs');
    const data = JSON.parse(document.querySelector('#sample-data').textContent);
    const text = '虚构长描述：明确来源，逐项复核。 Fictional description: retain source order and integer amounts. Cafe\u0301. ';
    data.purchaseOrder.lines[2].description = text.repeat(90) + '<img src=x onerror="window.ASTER_INJECTED=true"> 最后标记。';
    const report = reconcile(data);
    const {form} = render(report, {detail:'all', notes:'standard'}, JSON.parse(document.querySelector('#logo-data').textContent));
    document.querySelector('#preview').replaceChildren(form);
    await document.fonts.ready;
    await PrintForm.formatAll({force:true});
    return report;
  });
  const actual = await inspect(page, report, {detail:'all', notes:'standard'});
  const continuation = await page.locator('[data-po-id="POL-003"] [data-cell-key="description"]').allTextContents();
  assert.ok(continuation.length > 1, 'comparison description must genuinely split');
  assert.equal(continuation.join(''), report.rows[2].description + report.rows[2].sku);
  assert.equal(await page.evaluate(() => window.ASTER_INJECTED), undefined);
  assert.equal(await page.locator('#preview [onerror]').count(), 0);
  const fragments = await page.locator('[data-po-id="POL-003"]').evaluateAll(ns => ns.map(n => ({page:[...document.querySelectorAll('.printform_page')].indexOf(n.closest('.printform_page')) + 1,
    amounts:[...n.querySelectorAll('[data-money-id]')].filter(m => m.textContent.trim()).map(m => m.dataset.moneyId)})));
  assert.equal(fragments[0].amounts.length, 3);
  assert.ok(fragments.slice(1).every(f => f.amounts.length === 0));
  await page.locator('#reset').click(); await ready(page);
  return {name:'authored-long-description-literal-injection', pages:actual.pages, fragments};
}
