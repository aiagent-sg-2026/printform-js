import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { inspectRepaymentDOM, assertRepaymentDOM, assertRepaymentPDF } from '../../scripts/demobank-repayment-checks.mjs';

const dir = path.resolve(import.meta.dirname, '../../gallery/designs/assets/demobank');
const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
async function rendered() {
  const context = vm.createContext({window:{}});
  for (const file of ['money.js', 'information.js']) vm.runInContext(fs.readFileSync(path.join(dir, file), 'utf8'), context);
  const dom = new JSDOM(`<div class="printform_page">${context.window.DemoInformation(data, context.window.DemoMoney)}</div>`);
  Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', {get() {return this.textContent;}});
  try {
    return await inspectRepaymentDOM({locator: selector => ({
      evaluateAll: callback => callback([...dom.window.document.querySelectorAll(selector)])
    })});
  } finally {dom.window.close();}
}

describe('PF-056 repayment rendering regression', () => {
  it('renders three grouped scenarios whose displayed values reconcile independently', async () => {
    const plans = assertRepaymentDOM(await rendered(), data);
    expect(plans.map(p => [p.months, p.interest, p.total, p.regular, p.final])).toEqual([
      [6,3600,123600,20600,20600], [12,7200,127200,10600,10600], [18,10800,130800,7266,7278]
    ]);
  });
  it.each([
    ['period span', table => {table.rows[3][1].span = 1;}],
    ['missing scenario scope', table => {table.rows[0][1].scope = null;}],
    ['ambiguous final header', table => {table.rows[1][1].text = 'Regular (n−1)';}],
    ['filler', table => {table.rows[3][2].text = 'DEMO';}],
    ['detached currency', table => {table.rows[4][2].text = '72.00 RM';}],
    ['incorrect displayed final', table => {table.rows[2][6].text = 'RM72.66';}],
    ['incorrect displayed total', table => {table.rows[5][1].text = 'RM1,236.01';}]
  ])('rejects %s even if the source plan data is correct', async (_, mutate) => {
    const tables = await rendered(); mutate(tables[0]);
    expect(() => assertRepaymentDOM(tables, data)).toThrow();
  });
  it('PDF guard rejects the original missing scenario header', () => {
    expect(() => assertRepaymentPDF({items:[{text:'Outstanding Balance', x:40, y:305}]}, data)).toThrow(/scenario header/);
  });
});
