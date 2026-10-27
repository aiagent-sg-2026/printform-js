import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const html = fs.readFileSync(path.join(root, 'gallery/designs/sanyo-blue-sales-quotation.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'gallery/designs/assets/sanyo-blue-quotation.js'), 'utf8');
function render() {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  dom.window.eval(script);
  return dom.window.document;
}
describe('SANYO navy blue five-page quotation sample', () => {
  it('contains 48 uniquely identified fictional allocations and exact integer-cent totals', () => {
    const document = render();
    expect([...document.querySelectorAll('[data-sample-row]')].map(node => Number(node.dataset.sampleRow)))
      .toEqual(Array.from({ length: 48 }, (_, index) => index + 1));
    const models = [...document.querySelectorAll('.model')].map(node => node.textContent);
    expect(new Set(models).size).toBe(48);
    expect(models.every(model => /^DEMO-.*-\d{3}$/.test(model))).toBe(true);
    expect(document.body.textContent).not.toContain('undefined');
    expect(document.querySelector('#subtotal').textContent).toBe('40,120.00');
    expect(document.querySelector('#discount').textContent).toBe('-2,006.00');
    expect(document.querySelector('#total').textContent).toBe('38,114.00');
  });
  it('preserves A4, repeating headings, and last-page-only commercial summary', () => {
    const document = render();
    const form = document.querySelector('.printform');
    expect((Number(form.dataset.papersizeWidth) + 48) * 25.4 / 96).toBeCloseTo(210, 5);
    expect((Number(form.dataset.papersizeHeight) + 48) * 25.4 / 96).toBeCloseTo(297, 5);
    expect(form.dataset.repeatHeader).toBe('y');
    expect(form.dataset.repeatRowheader).toBe('y');
    expect(form.dataset.repeatFooter).toBe('n');
    expect(form.dataset.repeatFooterPagenum).toBe('y');
    expect(document.querySelector('.sample-badge').textContent).toBe('SAMPLE');
    expect(document.querySelector('.pfooter_pagenum').textContent).toContain('NOT VALID FOR ORDER');
  });
});
