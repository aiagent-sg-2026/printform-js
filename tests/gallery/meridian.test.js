import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {describe, it, expect} from 'vitest';
import {parse, validate, calculate, preset, money, MAX_BYTES} from '../../gallery/designs/assets/meridian/model.mjs';
const sample = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../../gallery/designs/assets/meridian/sample.json'),'utf8'));
describe('Meridian bounded fictional purchase order', () => {
  it('ships a single offline editable HTML with genuine runtime hash and MIT provenance', () => {
    const html = fs.readFileSync(path.resolve(import.meta.dirname,'../../gallery/designs/meridian-enterprise-purchase-order.html'),'utf8');
    const doc = new DOMParser().parseFromString(html,'text/html');
    expect(doc.querySelectorAll('script[src],link[rel=stylesheet]').length).toBe(0);
    expect(doc.querySelector('#editor')).not.toBeNull();
    expect(doc.querySelector('#engine-source').type).toBe('text/plain');
    const hash = createHash('sha256').update(doc.querySelector('#engine-source').textContent).digest('hex');
    expect(html).toContain(`Embedded runtime SHA-256: ${hash}`);
    expect(html).toContain('Copyright (c) 2026 YAP WEI JUN');
    expect(html).toContain('Copyright (c) 2016 Johan Lindell');
    expect(html.split('\n').length).toBeLessThanOrEqual(300);
  });
  it('calculates the six correct sample amounts, tax and total in cents', () => {
    const total = calculate(validate(sample));
    expect(total.amounts).toEqual([45000,33000,92500,168000,25000,45600]);
    expect(total.subtotal).toBe(409100); expect(total.tax).toBe(36819); expect(total.grand).toBe(445919);
    expect(money(total.grand)).toBe('4,459.19');
  });
  it.each([0,6,20,100,200])('roundtrips and reconciles %i items', count => {
    const data = preset(sample,count), result = parse(JSON.stringify(data));
    expect(result.items).toHaveLength(count); expect(parse(JSON.stringify(result))).toEqual(result);
    const total = calculate(result);
    expect(total.subtotal).toBe(total.amounts.reduce((a,b) => a+b,0));
    expect(total.grand).toBe(total.subtotal + total.tax);
  });
  it('accepts missing optional contacts and literal injection text', () => {
    const data = structuredClone(sample); delete data.supplier.email; delete data.reference;
    data.items[0].description = '<script>alert(1)</script>';
    expect(validate(data).supplier.email).toBe('');
    expect(validate(data).items[0].description).toBe('<script>alert(1)</script>');
  });
  it.each([-1,NaN,Infinity,'45',null])('rejects invalid price %s', value => {
    const data = structuredClone(sample); data.items[0].unitPrice = value;
    expect(() => validate(data)).toThrow('Unit price');
  });
  it.each([-1,101,Infinity])('rejects discount %s', value => {
    const data = structuredClone(sample); data.items[0].discount = value;
    expect(() => validate(data)).toThrow('Discount');
  });
  it.each([-1,101,NaN,Infinity])('rejects GST rate %s', value => {
    const data = structuredClone(sample); data.taxRate = value;
    expect(() => validate(data)).toThrow('GST rate');
  });
  it('rejects malformed, excessive, precision-losing and oversized input', () => {
    expect(() => parse('{')).toThrow('Invalid JSON');
    expect(() => parse(' '.repeat(MAX_BYTES + 1))).toThrow('1 MiB');
    const data = preset(sample,200); data.items.push(sample.items[0]);
    expect(() => validate(data)).toThrow('0–200');
    data.items = [{...sample.items[0],quantity:1.0001}]; expect(() => validate(data)).toThrow('Quantity');
    data.items = [{...sample.items[0],unitPrice:0.001}]; expect(() => validate(data)).toThrow('Unit price');
    data.items = [{...sample.items[0],barcode:'<script>'}]; expect(() => validate(data)).toThrow('barcode');
    data.items = [{...sample.items[0],unitPrice:1000000,quantity:1000000}]; expect(() => validate(data)).toThrow('Total exceeds');
  });
  it('rounds half cents up after discount and then tax on the net subtotal', () => {
    const data = structuredClone(sample);
    data.items = [{...data.items[0],quantity:0.5,unitPrice:0.01,discount:0}];
    expect(calculate(validate(data)).subtotal).toBe(1);
    data.items = [{...data.items[0],quantity:1,unitPrice:0.03,discount:50}];
    expect(calculate(validate(data)).subtotal).toBe(2);
    data.items[0].discount = 100; expect(calculate(validate(data)).grand).toBe(0);
  });
});
