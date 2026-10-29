import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {describe, it, expect} from 'vitest';
import {fixture, longNarrative} from '../../gallery/designs/assets/aster/fixtures.mjs';
import {reconcile, money} from '../../gallery/designs/assets/aster/reconcile.mjs';
import {validate, structure, sum, product} from '../../gallery/designs/assets/aster/validate.mjs';
import {render} from '../../gallery/designs/assets/aster/template.mjs';
const dir = path.resolve(import.meta.dirname, '../../gallery/designs/assets/aster');
const sample = JSON.parse(fs.readFileSync(path.join(dir, 'sample.json')));
const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json')));
const change = fn => { const value = structuredClone(sample); fn(value); return value; };
describe('PF-065 Aster bounded review pack', () => {
  it('matches every field of the independently supplied oracle', () => {
    expect(reconcile(sample).totals).toEqual(expected);
    expect(fixture(sample, 24)).toEqual(sample);
  });
  it.each([[0,0,0,0], [1,11250,11250,0], [24,615000,600250,6], [60,2887500,2872750,6], [150,15656250,15641500,6]])('conserves %i lines and exact integer amounts', (count, po, invoice, cases) => {
    const r = reconcile(fixture(sample, count));
    expect(r.rows).toHaveLength(count); expect(r.invoices).toHaveLength(count);
    expect(r.totals.poOrderValueCents).toBe(po); expect(r.totals.invoiceCanonicalTotalCents).toBe(invoice);
    expect(r.cases).toHaveLength(cases); expect(r.data.receipts).toHaveLength(3); expect(r.data.invoices).toHaveLength(2);
    // Independent closed-form arithmetic in BigInt, never a copied oracle in UI.
    expect(BigInt(po)).toBe(10000n * BigInt(count) + 625n * BigInt(count) * BigInt(count + 1));
    expect(sum(r.invoices.map(l => l.amount))).toBe(invoice);
  });
  it.each([0,1,24,60,150])('restores every explicit link and receipt in all-matched N=%i', count => {
    const r = reconcile(fixture(sample, count, true));
    expect(r.cases).toHaveLength(0); expect(r.unmatched).toHaveLength(0);
    expect(r.totals.netReceivedQty).toBe(count * 10); expect(r.totals.invoiceBilledQty).toBe(count * 10);
    expect(r.totals.invoiceCanonicalTotalCents).toBe(r.totals.poOrderValueCents);
    expect(r.data.ingestionEvents).toHaveLength(count);
  });
  it('does not join by SKU or count import evidence as money', () => {
    const r = reconcile(sample);
    expect(r.rows[6].linked).toHaveLength(0); expect(r.unmatched[0].id).toBe('IL-007');
    const noEvents = change(d => d.ingestionEvents = []);
    expect(reconcile(noEvents).totals.invoiceCanonicalTotalCents).toBe(600250);
  });
  it('filters display only and does not mutate full-scope totals', () => {
    const report = reconcile(sample), before = JSON.stringify(report.totals);
    const {form, display} = render(report, {detail:'review', notes:'long'}, 'data:image/svg+xml,');
    expect(display).toEqual({shown:6, unmatched:1});
    expect(form.querySelectorAll('[data-po-id]')).toHaveLength(6);
    expect(form.querySelectorAll('[data-money-id^="line-"]')).toHaveLength(6);
    expect(form.querySelector('[data-stress]').textContent).toBe(longNarrative());
    const partialHeading = [...form.querySelectorAll('.case-heading')].find(n => n.textContent.includes('REV-PARTIAL-003'));
    expect(partialHeading.dataset.pfKeepTogether).toBe('true');
    expect(partialHeading.querySelector('p').textContent).toContain('Ordered 10, gross/net received 6, billed 8 EA');
    expect(JSON.stringify(report.totals)).toBe(before);
    expect((longNarrative().match(/[\u4e00-\u9fff]/g) || []).length).toBeGreaterThan(1700);
    expect(form.querySelector('[data-money-id="case-REV-PARTIAL-003"]').closest('td').dataset.pfCellPolicy).toBe('first');
  });
  it('renders literal untrusted strings as text', () => {
    const report = reconcile(change(d => d.purchaseOrder.lines[0].description = '<img src=x onerror=alert(1)> 中文测试'));
    const {form} = render(report, {detail:'all', notes:'standard'}, 'data:image/svg+xml,');
    expect(form.querySelector('[data-cell-key="description"]').textContent).toContain('<img src=x onerror=alert(1)> 中文测试');
    expect(form.querySelectorAll('[onerror]')).toHaveLength(0);
  });
  const invalid = [
    ['unknown invoice reference', d => d.invoices[0].lines[0].poLineId = 'UNKNOWN'],
    ['unknown receipt reference', d => d.receipts[0].lines[0].poLineId = 'UNKNOWN'],
    ['return exceeds receipt', d => d.receipts[0].lines[0].returnedQty = 11],
    ['conflicting import key', d => d.ingestionEvents[24].invoiceLineId = 'IL-001'],
    ['wrong event document', d => d.ingestionEvents[0].invoiceId = 'INV-DEMO-002'],
    ['missing event line', d => d.ingestionEvents[0].invoiceLineId = 'UNKNOWN'],
    ['duplicate PO ID', d => d.purchaseOrder.lines[1].id = 'POL-001'],
    ['duplicate receipt ID', d => d.receipts[1].lines[0].id = 'R1L-001'],
    ['duplicate canonical ID', d => d.invoices[1].lines[0].id = 'IL-001'],
    ['duplicate event ID', d => d.ingestionEvents[1].id = 'EVT-001'],
    ['duplicate document ID', d => d.receipts[0].id = 'INV-DEMO-001'],
    ['negative quantity', d => d.invoices[0].lines[0].billedQty = -1],
    ['unsafe product', d => d.purchaseOrder.lines[0].unitPriceCents = Number.MAX_SAFE_INTEGER],
    ['unsafe sum', d => d.purchaseOrder.lines.forEach(l => {l.orderedQty = 1; l.unitPriceCents = Number.MAX_SAFE_INTEGER;})],
    ['fractional cents', d => d.invoices[0].lines[0].unitPriceCents = 11.25],
    ['NaN', d => d.purchaseOrder.lines[0].orderedQty = NaN],
    ['infinite', d => d.purchaseOrder.lines[0].orderedQty = Infinity],
    ['extra property', d => d.purchaseOrder.lines[0].trusted = true],
    ['missing property', d => delete d.policy],
    ['nonzero tolerance', d => d.policy.priceToleranceCents = 1],
    ['impossible date', d => d.document.asOfDate = '2026-02-30'],
    ['locale date', d => d.document.asOfDate = '30/09/2026']
  ];
  it.each(invalid)('blocks semantic/structural invalid input: %s', (_, fn) => expect(() => reconcile(change(fn))).toThrow());
  it('checks safe boundaries without floating currency rounding', () => {
    expect(product(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER);
    expect(sum([Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER])).toBe(0);
    expect(() => sum([Number.MAX_SAFE_INTEGER, 1])).toThrow('Unsafe');
    expect(money(Number.MAX_SAFE_INTEGER)).toBe('90,071,992,547,409.91');
    expect(money(-14750)).toBe('−147.50');
    expect(() => structure({}, {surprise:true})).toThrow('Unsupported schema');
    expect(() => validate(null)).toThrow();
  });
  it('ships local-font Gallery HTML with current genuine-runtime provenance', () => {
    const html = fs.readFileSync(path.join(dir, '../../aster-three-way-match-review-pack.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('script[src],link[rel=stylesheet]')).toHaveLength(0);
    const hash = createHash('sha256').update(doc.querySelector('#engine-source').textContent).digest('hex');
    expect(html).toContain(`Embedded runtime SHA-256: ${hash}`);
    expect(html).toContain('SIL OPEN FONT LICENSE');
    expect(html).not.toContain('expectedReviewCaseCount":6');
  });
});
