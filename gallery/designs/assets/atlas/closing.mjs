import {heading, row, block, esc, monetary} from './dom.mjs';
import {sum} from './validate.mjs';
export function bridge(form, r) {
  const e = r.estimated, a = r.actual;
  heading(form, '05', 'Estimate / actual bridge', 'bridge', ['Allocation-side bridge', 'SGD', 'Interpretation'], [38, 18, 44]);
  const partial = Object.values(e.chargeAllocations).some(x => x.reason) || Object.values(a.chargeAllocations).some(x => x.reason);
  [
    ['Goods unchanged', e.goodsTotalCents, 'Source quantity × unit goods cents; no tax or FX.'],
    ['Estimated allocated fees', e.allocatedFeesCents, 'Only fees assigned to goods lines.'],
    [partial ? 'Estimated partial landed subtotal' : 'Estimated landed total', e.landedTotalCents, 'Goods plus estimated allocated fees.'],
    ['Allocated-fee variance', sum([a.allocatedFeesCents, -e.allocatedFeesCents]), 'Actual allocated fees minus estimated allocated fees.'],
    ['Actual allocated fees', a.allocatedFeesCents, 'Estimated allocated fees plus allocation-side variance.'],
    [partial ? 'Actual partial landed subtotal' : 'Actual landed total', a.landedTotalCents, 'Estimated landed subtotal plus allocation-side variance.'],
    ['Estimated unallocated fees', e.unallocatedFeesCents, 'Excluded from estimated line landed amounts.'],
    ['Unallocated-side variance', sum([a.unallocatedFeesCents, -e.unallocatedFeesCents]), 'Separate unresolved-side variance, not a landed adjustment.'],
    ['Actual unallocated fees', a.unallocatedFeesCents, 'Excluded from actual line landed amounts.']
  ].forEach(([label, value, note], i) => row(form, [{text:label}, {html:monetary(value, `bridge-${i}`), numeric:true}, {text:note, policy:'split'}], [38, 18, 44], 'bridge'));
}
export function sources(form, r, state) {
  heading(form, '06', 'Source register & methods', 'sources', ['Source / reference', 'Explicit membership or eligibility', 'Scope'], [30, 50, 20]);
  row(form, [{text:`${r.data.document.id} / ${r.data.document.asOfDate}`, policy:'split'}, {text:`${r.data.shipment.id} / ${r.data.shipment.departureDate} → ${r.data.shipment.arrivalDate}`, policy:'split'}, {text:'Fictional shipment'}], [30, 50, 20], 'sources');
  for (const c of r.containers) row(form, [{text:`${c.id} / ${c.label} / ${c.reference} / seal ${c.sealReference}`, policy:'split'},
    {text:c.lines.map(l => l.id).join(', '), policy:'split'}, {text:'Container membership'}], [30, 50, 20], 'sources');
  for (const c of r.data.charges) row(form, [{text:`${c.id} / ${c.sourceRef}`, policy:'split'}, {text:c.eligibleLineIds.join(', ') || 'Empty eligibility', policy:'split'},
    {text:c.scopeContainerIds.join(', ') || 'Empty scope', policy:'split'}], [30, 50, 20], 'sources');
  const methods = [
    ['Signed largest remainder', 'Independently floor each ideal magnitude with BigInt; award residual cents by descending remainder, then ASCII ID ascending. Apply sign last. No compounding or derived unit-cost rounding enters totals. Negative landed amounts are not clamped.'],
    ['Unknown is not zero', 'Positive quantity × null weight is unknown: under weight basis, leave the entire charge unresolved. Zero quantity has zero extended weight even with null unit weight. Zero charges are complete. Empty eligibility or zero denominators leave nonzero charges unresolved.'],
    ['Source relationships & conservation', 'Eligible IDs alone allocate; container scope validates membership. Never join by SKU/description. Per charge: allocated + unallocated = selected amount. Goods + allocated = landed subtotal; adding unallocated equals goods + all selected charges. Unresolved charges stay excluded even if signed amounts net to zero.'],
    ['Selected fictional scenario', `${state.scenario} / ${r.basis} / ${r.mode} / ${state.notes}. Zero-basis fixtures change visible source fields. Synthetic demonstration only: no tax, customs, FX, posting, approval, payment, send or live ERP operation; not professional advice.`]
  ];
  heading(form, '06', 'Method notes / Demo only', 'methods');
  methods.forEach(([title, text]) => row(form, [{text:title}, {text, policy:'split'}], [25, 75], 'methods'));
  block(form, `<h3>Print record / Demo only</h3><div class="print-record">${['Prepared by', 'Reviewed by', 'Date'].map(label => `<div>${esc(label)}<span class="blank"></span></div>`).join('')}</div>`, 'final-record', 'methods');
}
