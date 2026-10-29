import {validate, product, sum, weight} from './validate.mjs';
import {trace} from './allocate.mjs';
export function money(value) {
  const n = BigInt(value), magnitude = n < 0n ? -n : n;
  return `${n < 0n ? '−' : ''}${String(magnitude / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(magnitude % 100n).padStart(2, '0')}`;
}
export function model(data, basis = 'value', mode = 'actual') {
  validate(data);
  if (!['value', 'quantity', 'weight'].includes(basis) || !['estimated', 'actual'].includes(mode)) throw new TypeError('Unknown basis or mode');
  const bases = Object.fromEntries(data.lines.map(l => [l.id, basis === 'value' ? product(l.quantity, l.unitGoodsCents) : basis === 'quantity' ? l.quantity : weight(l)]));
  const goods = Object.fromEntries(data.lines.map(l => [l.id, product(l.quantity, l.unitGoodsCents)]));
  const calculate = selectedMode => {
    const audits = Object.fromEntries(data.charges.map(c => [c.id, trace(c[selectedMode + 'Cents'], c.eligibleLineIds, bases)]));
    const chargeAllocations = Object.fromEntries(Object.entries(audits).map(([id, a]) => [id, a.result]));
    const lineAllocatedFeesCents = Object.fromEntries(data.lines.map(l => [l.id, sum(Object.values(chargeAllocations).map(a => a.allocationsCents[l.id] ?? 0))]));
    const lineLandedCents = Object.fromEntries(data.lines.map(l => [l.id, sum([goods[l.id], lineAllocatedFeesCents[l.id]])]));
    const totals = {goodsTotalCents:sum(Object.values(goods)), chargeTotalCents:sum(data.charges.map(c => c[selectedMode + 'Cents'])),
      allocatedFeesCents:sum(Object.values(lineAllocatedFeesCents)), unallocatedFeesCents:sum(Object.values(chargeAllocations).map(a => a.unallocatedCents)),
      landedTotalCents:sum(Object.values(lineLandedCents)), lineAllocatedFeesCents, lineLandedCents, chargeAllocations};
    if (sum([totals.allocatedFeesCents, totals.unallocatedFeesCents]) !== totals.chargeTotalCents || sum([totals.goodsTotalCents, totals.allocatedFeesCents]) !== totals.landedTotalCents) throw new Error('Report conservation failure');
    // Check the final unresolved-side equality without unsafe floating intermediates.
    sum([totals.landedTotalCents, totals.unallocatedFeesCents]); sum([totals.goodsTotalCents, totals.chargeTotalCents]);
    return {totals, audits};
  };
  const estimated = calculate('estimated'), actual = calculate('actual');
  sum([actual.totals.allocatedFeesCents, -estimated.totals.allocatedFeesCents]);
  sum([actual.totals.unallocatedFeesCents, -estimated.totals.unallocatedFeesCents]);
  const selected = mode === 'actual' ? actual : estimated;
  const containers = data.containers.map(c => {
    const lines = data.lines.filter(l => l.containerId === c.id);
    return {...c, lines, quantity:sum(lines.map(l => l.quantity)), weightGrams:lines.some(l => weight(l) === null) ? null : sum(lines.map(weight)),
      goodsCents:sum(lines.map(l => goods[l.id])), feesCents:sum(lines.map(l => selected.totals.lineAllocatedFeesCents[l.id])), landedCents:sum(lines.map(l => selected.totals.lineLandedCents[l.id]))};
  });
  return {data, basis, mode, bases, goods, ...selected, estimated:estimated.totals, actual:actual.totals, containers,
    partial:Object.values(selected.totals.chargeAllocations).some(a => a.reason !== null),
    quantity:sum(data.lines.map(l => l.quantity)), weightGrams:data.lines.some(l => weight(l) === null) ? null : sum(data.lines.map(weight))};
}
