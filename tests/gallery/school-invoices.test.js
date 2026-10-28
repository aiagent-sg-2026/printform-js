import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { categoryOf } from '../../gallery/js/categories.js';
import { independentTotals } from '../../scripts/school-invoice-dom-checks.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const dir = path.join(root, 'gallery/designs/assets/school-invoices');
const source = name => fs.readFileSync(path.join(dir, name), 'utf8');
const data = JSON.parse(source('data.json'));
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(source('math.js'), sandbox);
const math = sandbox.window.SchoolInvoiceMath;
const plain = value => JSON.parse(JSON.stringify(value));

describe('six fictional school invoices', () => {
  it('keeps one canonical fixture and six distinct styles in Sales', () => {
    execFileSync(process.execPath, ['scripts/sync-school-invoices.mjs', '--check'], { cwd: root });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'gallery/manifest.json')));
    expect(data.styles.map(n => n.number)).toEqual([58, 59, 60, 61, 62, 63]);
    for (const style of data.styles) {
      const entry = manifest.find(n => n.no === `PF-${String(style.number).padStart(3, '0')}`);
      expect(entry.id).toBe(style.file); expect(categoryOf(entry)).toBe('sales');
      const html = fs.readFileSync(path.join(root, 'gallery', entry.file), 'utf8');
      expect(html).toContain('value="long"'); expect(html).toContain('<option>A5</option>');
      expect(html).toContain(`data-style="${style.id}"`);
    }
  });
  for (const mode of ['short', 'long']) it(`reconciles ${mode} independently using BigInt`, () => {
    const items = plain(math.lines(data, mode));
    expect(plain(math.calculate(data, items))).toEqual(independentTotals(data, items));
    expect(items).toHaveLength(mode === 'short' ? 4 : 44);
    expect(new Set(items.map(n => n.id)).size).toBe(items.length);
    expect(items.some(n => n.unitCents < 0)).toBe(true);
    if (mode === 'long') {
      expect(items.some(n => n.quantity === 0)).toBe(true);
      expect(items.some(n => n.description.includes('\n'))).toBe(true);
      expect(items.some(n => /\w{50}/.test(n.description))).toBe(true);
    }
  });
  it('has exact short sample totals, signed adjustments and tax rounding', () => {
    expect(plain(math.calculate(data, math.lines(data)))).toEqual({ amounts: [54000, 3500, 8800, -2500],
      lineSubtotal: 63800, adjustment: -1500, subtotal: 62300, tax: 1558, due: 63858 });
    const clone = structuredClone(data); clone.adjustments = [{ cents: 25 }];
    clone.invoice.taxBasisPoints = 5000;
    const items = [{ id: 'C1', quantity: 1, unitCents: -100 }];
    expect(plain(math.calculate(clone, items))).toEqual(independentTotals(clone, items));
    expect(math.calculate(clone, items).tax).toBe(-38);
    delete clone.invoice.taxBasisPoints; delete clone.adjustments;
    expect(math.calculate(clone, items).due).toBe(-100);
    expect(math.money(Number.MAX_SAFE_INTEGER)).toBe('90,071,992,547,409.91');
    expect(math.money(-1)).toBe('−0.01');
  });
  it('rejects duplicate IDs, fractional quantities, unsafe amounts and negative quantities', () => {
    const item = { id: 'X', quantity: 1, unitCents: 100 };
    for (const rows of [[item, item], [{ ...item, quantity: .5 }], [{ ...item, quantity: -1 }], [{ ...item, unitCents: Number.MAX_SAFE_INTEGER }]])
      expect(() => math.calculate(data, rows)).toThrow();
    const taxFree = { invoice: { taxBasisPoints: 0 } };
    expect(() => math.calculate(taxFree, [
      { id: 'A', quantity: 1, unitCents: Number.MAX_SAFE_INTEGER },
      { id: 'B', quantity: 1, unitCents: 2 },
      { id: 'C', quantity: 1, unitCents: -Number.MAX_SAFE_INTEGER }
    ])).toThrow();
  });
  it('keeps editable semantic rows, a two-column statement, and final-only totals', () => {
    const dom = new JSDOM('<main></main>', { runScripts: 'outside-only' });
    for (const file of ['math.js', 'art.js', 'template.js']) dom.window.eval(source(file));
    for (const style of data.styles) {
      const { form } = dom.window.SchoolInvoiceTemplate.render(data, style, 'long', 'A5');
      expect(form.querySelectorAll('.prowitem')).toHaveLength(44);
      expect(form.querySelectorAll('.pheader, .prowheader, .pfooter, .pfooter_pagenum')).toHaveLength(4);
      expect(form.querySelectorAll('[data-totals], [data-payment]')).toHaveLength(2);
      expect(form.querySelectorAll('[data-pf-keep-with-next]')).toHaveLength(1);
      expect(form.querySelector('.table-heading .line-grid').children).toHaveLength(style.id === 'statement' ? 2 : 4);
      if (style.id === 'bilingual') expect(form.textContent).toContain('应付金额 / AMOUNT DUE');
    }
    dom.window.close();
  });
  it('escapes data as text, never executable markup', () => {
    const dom = new JSDOM('', { runScripts: 'outside-only' });
    for (const file of ['math.js', 'art.js', 'template.js']) dom.window.eval(source(file));
    const clone = structuredClone(data); clone.customer.name = '<img src=x onerror=alert(1)>';
    clone.lineItems[0].description = '<script>alert(1)</script>';
    const { form } = dom.window.SchoolInvoiceTemplate.render(clone, data.styles[0], 'short', 'A4');
    expect(form.querySelectorAll('script, [onerror]')).toHaveLength(0);
    expect(form.textContent).toContain(clone.customer.name); dom.window.close();
  });
  it('ships the licensed CJK subset with complete fixture glyph coverage', () => {
    const chars = new Set([...['data.json', 'template.js', 'controller.js'].map(source).join('')].filter(c => /[\u3400-\u9fff]/u.test(c)));
    const inventory = new Set([...source('cjk-glyphs.txt')]);
    for (const char of chars) expect(inventory.has(char), char).toBe(true);
    for (const weight of ['Regular', 'Bold']) {
      const font = path.join(dir, `DemoSchoolCJK-${weight}.woff2`);
      expect(fs.readFileSync(font).subarray(0, 4).toString()).toBe('wOF2');
      expect(fs.statSync(font).size).toBeLessThan(30000);
      let charset;
      try { charset = execFileSync('fc-scan', ['--format', '%{charset}\n', font], { encoding: 'utf8' }).split('\n')[0].split(' '); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      // FontTools also asserts cmap coverage at regeneration; fc-scan is an extra Linux check.
      if (charset) for (const char of chars) {
        const cp = char.codePointAt(0);
        expect(charset.some(range => { const [lo, hi = lo] = range.split('-').map(n => parseInt(n, 16)); return cp >= lo && cp <= hi; }), char).toBe(true);
      }
    }
    expect(source('FONT-LICENSE.txt')).toContain('SIL OPEN FONT LICENSE');
  });
  it('uses no real payment target, identity or QR payload', () => {
    expect(data.payment.url).toBe('https://example.org/demo-school-invoice');
    expect(data.payment.account).toBe('DEMO-XXXX-NONVALID');
    expect(data.styles.every(n => n.name.startsWith('Demo '))).toBe(true);
    expect(data.customer.email).toMatch(/@example\.org$/);
  });
});
