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
  it('PDF guard accepts split kerning runs but still rejects misplaced/missing labels and wrong amounts', async () => {
    const { rows } = (await rendered())[0];
    const items = [{ text: 'Principal / scenario', x: 40, y: 100 }];
    rows[0].slice(1).forEach((n, i) => items.push({ text: n.text, x: 157 + i * 136, y: 94 }));
    rows[1].forEach((n, i) => items.push({ text: n.text, x: 157 + Math.floor(i / 2) * 136 + (i % 2) * 96, y: 106 }));
    rows.slice(2).forEach((row, r) => {
      const y = 120 + r * 14, label = row[0].text;
      items.push({ text: label[0], x: 40, y }, { text: label.slice(1), x: 42.25, y });
      row.slice(1).forEach((n, i) => items.push({ text: n.text, x: r === 0 ? 190 + i * 68 : 207 + i * 136, y }));
    });
    expect(assertRepaymentPDF({ items }, data)).toHaveLength(3);
    const missing = items.filter(n => n.text !== 'otal Amount to be settled');
    expect(() => assertRepaymentPDF({ items: missing }, data)).toThrow('PDF repayment total row');
    const misplaced = items.map(n => n.text === 'otal Amount to be settled' ? { ...n, x: 300 } : n);
    expect(() => assertRepaymentPDF({ items: misplaced }, data)).toThrow('PDF repayment total row');
    const wrong = items.map(n => n.text === 'RM1,236.00' ? { ...n, text: 'RM1,236.01' } : n);
    expect(() => assertRepaymentPDF({ items: wrong }, data)).toThrow();
  });
  it('PDF guard rejects the original missing scenario header', () => {
    expect(() => assertRepaymentPDF({items:[{text:'Outstanding Balance', x:40, y:305}]}, data)).toThrow(/scenario header/);
  });
});
