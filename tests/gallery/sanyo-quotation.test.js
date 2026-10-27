import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const html = fs.readFileSync(path.join(root, 'gallery/designs/sanyo-green-sales-quotation.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'gallery/designs/assets/sanyo-green-quotation.js'), 'utf8');
function render(query = '') {
  const dom = new JSDOM(html, { url: 'https://example.com/' + query, runScripts: 'outside-only' });
  dom.window.eval(script);
  return dom.window.document;
}
describe('SANYO green quotation sample', () => {
  it('uses exact A4 content budget and non-repeating totals with repeating page notice', () => {
    const document = render();
    const form = document.querySelector('.printform');
    expect((Number(form.dataset.papersizeWidth) + 48) * 25.4 / 96).toBeCloseTo(210, 5);
    expect((Number(form.dataset.papersizeHeight) + 48) * 25.4 / 96).toBeCloseTo(297, 5);
    expect(form.dataset.repeatFooter).toBe('n');
    expect(form.dataset.repeatFooterPagenum).toBe('y');
    expect(document.querySelector('.pfooter_pagenum').textContent).toContain('NOT VALID FOR ORDER');
  });
  it('calculates five fictional rows in integer cents', () => {
    const document = render();
    expect(document.querySelectorAll('.prowitem')).toHaveLength(5);
    expect(document.querySelector('#subtotal').textContent).toBe('4,065.00');
    expect(document.querySelector('#discount').textContent).toBe('-203.25');
    expect(document.querySelector('#total').textContent).toBe('3,861.75');
    expect([...document.querySelectorAll('.model')].every(node => node.textContent.startsWith('DEMO-'))).toBe(true);
  });
  it('provides bounded long-description overflow data using the same sections', () => {
    const document = render('?overflow=1');
    expect(document.querySelectorAll('.prowitem')).toHaveLength(35);
    expect(document.querySelector('#total').textContent).toBe('27,032.25');
    expect(document.querySelectorAll('#total')).toHaveLength(1);
    expect(document.querySelector('.prowitem').textContent).toContain('No real product specifications');
  });
});
