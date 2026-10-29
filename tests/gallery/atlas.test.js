import fs from 'node:fs';
import path from 'node:path';
import {describe, it, expect} from 'vitest';
import {model, money} from '../../gallery/designs/assets/atlas/model.mjs';
import {allocate} from '../../gallery/designs/assets/atlas/allocate.mjs';
import {validate, sum, product, weight} from '../../gallery/designs/assets/atlas/validate.mjs';
import {fixture, defaults, longNarrative} from '../../gallery/designs/assets/atlas/fixtures.mjs';
import {render} from '../../gallery/designs/assets/atlas/template.mjs';
const dir = path.resolve(import.meta.dirname, '../../gallery/designs/assets/atlas');
const sample = JSON.parse(fs.readFileSync(path.join(dir, 'sample.json')));
const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json')));
const change = fn => { const d = structuredClone(sample); fn(d); return d; };
describe('PF-066 Atlas exact independent allocation', () => {
  it.each(Object.entries(expected.defaultScenarios))('matches every charge and line in Python rational oracle: %s', (key, oracle) => {
    expect(model(sample, ...key.split('-')).totals).toEqual(oracle);
  });
  it.each(expected.allocationUnitFixtures)('matches independent edge $id', f => expect(allocate(f.amountCents, f.ids, f.basis)).toEqual(f.expected));
  it.each([1, 3, 8].flatMap(containers => [10, 24, 50, 120].map(count => [containers, count])))('conserves all modes/bases for %i containers / %i lines', (containers, count) => {
    const data = fixture(sample, {...defaults, containers, count});
    expect(data.lines).toHaveLength(count); expect(data.containers).toHaveLength(containers);
    for (const [index, l] of data.lines.entries()) expect(l.containerId).toBe(`CONT-${String(1 + Math.floor(index * containers / count)).padStart(2, '0')}`);
    const independentGoods = data.lines.reduce((a, l) => a + BigInt(l.quantity) * BigInt(l.unitGoodsCents), 0n);
    for (const basis of ['value', 'quantity', 'weight']) for (const mode of ['estimated', 'actual']) {
      const r = model(data, basis, mode), t = r.totals;
      expect(BigInt(t.goodsTotalCents)).toBe(independentGoods);
      expect(t.landedTotalCents + t.unallocatedFeesCents).toBe(t.goodsTotalCents + t.chargeTotalCents);
      for (const c of data.charges) expect(sum(Object.values(t.chargeAllocations[c.id].allocationsCents)) + t.chargeAllocations[c.id].unallocatedCents).toBe(c[mode + 'Cents']);
      expect(sum(r.containers.map(c => c.landedCents))).toBe(t.landedTotalCents);
    }
  });
  it('keeps canonical 24/3 source identity and missing-weight whole-charge behavior', () => {
    expect(fixture(sample)).toEqual(sample);
    const d = fixture(sample, {...defaults, scenario:'missing'}), r = model(d, 'weight');
    expect(r.totals.chargeAllocations).toEqual(expected.missingWeightActual.chargeAllocations);
    expect(r.totals.allocatedFeesCents).toBe(45000); expect(r.totals.unallocatedFeesCents).toBe(294000); expect(r.totals.landedTotalCents).toBe(1081500);
    expect(r.weightGrams).toBe(null); expect(r.partial).toBe(true);
    for (const basis of ['value', 'quantity']) expect(model(d, basis).totals).toEqual(expected.defaultScenarios[basis + '-actual']);
  });
  it.each(['value', 'quantity', 'weight'])('zero %s basis changes source, never hidden denominators', basis => {
    const d = fixture(sample, {...defaults, scenario:'zero', basis}), r = model(d, basis);
    expect(Object.values(r.bases).every(v => v === 0)).toBe(true);
    expect(r.totals.allocatedFeesCents).toBe(0); expect(r.totals.unallocatedFeesCents).toBe(339000);
    expect(r.totals.goodsTotalCents).toBe(basis === 'weight' ? 1036500 : 0);
  });
  it('handles null weight with zero quantity, zero-weight recipients, huge exact products and negative landed', () => {
    expect(weight({quantity:0, unitWeightGrams:null})).toBe(0);
    expect(allocate(5, ['B', 'A'], {A:0, B:3}).allocationsCents).toEqual({A:0, B:5});
    expect(allocate(Number.MAX_SAFE_INTEGER, ['B', 'A'], {A:1, B:1}).allocationsCents).toEqual({A:4503599627370496, B:4503599627370495});
    const r = model(change(d => d.charges[0].actualCents = -20000000));
    expect(r.totals.lineLandedCents['LIN-001']).toBeLessThan(0);
    expect(money(Number.MAX_SAFE_INTEGER)).toBe('90,071,992,547,409.91'); expect(money(-5)).toBe('−0.05');
    expect(product(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => sum([Number.MAX_SAFE_INTEGER, 1])).toThrow('Unsafe');
  });
  it('uses explicit subset eligibility only and input-order-independent ASCII ties', () => {
    const d = change(d => d.charges[0].eligibleLineIds = ['LIN-001']);
    expect(model(d).totals.chargeAllocations['CHG-01'].allocationsCents).toEqual({'LIN-001':180000});
    expect(allocate(-5, ['b', 'A', 'a'], {b:1, A:1, a:1}).allocationsCents).toEqual({A:-2, a:-2, b:-1});
    const shuffled = change(d => { d.lines.reverse(); d.charges.reverse(); d.charges.forEach(c => c.eligibleLineIds.reverse()); });
    expect(model(shuffled).totals).toEqual(model(sample).totals);
  });
  it('marks unresolved charges even when signed unallocated sums cancel', () => {
    const d = fixture(sample, {...defaults, scenario:'zero', basis:'weight'});
    d.charges = [d.charges[0], d.charges[6]]; d.charges[1].actualCents = -d.charges[0].actualCents;
    const r = model(d, 'weight'); expect(r.totals.unallocatedFeesCents).toBe(0); expect(r.partial).toBe(true);
  });
  const invalid = [
    ['line container', d => d.lines[0].containerId = 'UNKNOWN'], ['charge container', d => d.charges[0].scopeContainerIds = ['UNKNOWN']],
    ['eligible ID', d => d.charges[0].eligibleLineIds = ['UNKNOWN']], ['outside scope', d => d.charges[1].eligibleLineIds = ['LIN-009']],
    ['duplicate line', d => d.lines[1].id = d.lines[0].id], ['duplicate container', d => d.containers[1].id = d.containers[0].id],
    ['duplicate charge', d => d.charges[1].id = d.charges[0].id], ['duplicate eligibility', d => d.charges[0].eligibleLineIds.push('LIN-001')],
    ['duplicate scope', d => d.charges[0].scopeContainerIds.push('CONT-01')], ['non ASCII ID', d => d.document.id = '示例'],
    ['fraction', d => d.lines[0].quantity = 1.5], ['NaN', d => d.lines[0].unitGoodsCents = NaN],
    ['Infinity', d => d.charges[0].actualCents = Infinity], ['negative quantity', d => d.lines[0].quantity = -1],
    ['negative goods', d => d.lines[0].unitGoodsCents = -1], ['negative weight', d => d.lines[0].unitWeightGrams = -1],
    ['unsafe product', d => d.lines[0].unitGoodsCents = Number.MAX_SAFE_INTEGER],
    ['unsafe weight', d => d.lines[0].unitWeightGrams = Number.MAX_SAFE_INTEGER],
    ['unsafe sum', d => d.charges.forEach(c => c.actualCents = Number.MAX_SAFE_INTEGER)],
    ['unsafe variance', d => { d.charges[0].actualCents = Number.MAX_SAFE_INTEGER; d.charges[0].estimatedCents = -1; }],
    ['invalid date', d => d.document.asOfDate = '2026-02-30'], ['locale date', d => d.shipment.arrivalDate = '28/10/2026'],
    ['wrong currency', d => d.document.currency = 'USD'], ['extra property', d => d.lines[0].trusted = true],
    ['missing property', d => delete d.shipment], ['wrong version', d => d.schemaVersion = 2]
  ];
  it.each(invalid)('rejects invalid source: %s', (_, fn) => expect(() => model(change(fn))).toThrow());
  it('rejects null input and invalid state', () => {
    expect(() => validate(null)).toThrow(); expect(() => model(sample, 'locale')).toThrow();
    expect(() => model(sample, 'value', 'paid')).toThrow(); expect(() => fixture(sample, {count:9})).toThrow();
  });
  it('renders all bound metadata as escaped text and all monetary cells first-only', () => {
    const d = change(d => { d.document.id = 'DOC-<&"mutated>'; d.document.company = '<img src=x onerror=alert(1)> 中文'; d.shipment.routeLabel = 'Route <script>literal</script>'; d.lines[0].description = 'Literal <b>cargo</b> 中文'; d.containers[0].sealReference = 'SEAL-<&>'; });
    const form = render(model(d), {...defaults, notes:'long'}, 'data:image/svg+xml,');
    for (const value of [d.document.id, d.document.company, d.shipment.routeLabel, d.lines[0].description, d.containers[0].sealReference]) expect(form.textContent).toContain(value);
    expect(form.querySelectorAll('[onerror],script')).toHaveLength(0);
    expect(form.querySelector('[data-stress]').textContent).toBe(longNarrative());
    const all = [...form.querySelectorAll('[data-money-id]')];
    expect(new Set(all.map(n => n.dataset.moneyId)).size).toBe(all.length);
    expect(all.filter(n => n.closest('td')).every(n => n.closest('td').dataset.pfCellPolicy === 'first')).toBe(true);
    expect(form.querySelectorAll('[data-line-id]')).toHaveLength(24);
    const headers = [...form.querySelectorAll('.prowheader')].map(n => n.dataset.pfTableId);
    expect(new Set(headers).size).toBe(headers.length);
  });
});
