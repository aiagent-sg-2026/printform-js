import {heading, row, block, esc, monetary} from './dom.mjs';
import {sum} from './validate.mjs';
import {longNarrative} from './fixtures.mjs';
export function ledger(form, r) {
  const widths = [12, 24, 15, 10, 10, 9, 10, 10];
  heading(form, '03', 'Charge ledger / SGD', 'ledger', ['Charge ID', 'Description', 'Explicit container scope', 'Estimate', 'Actual', 'Variance', 'Selected', 'Status'], widths);
  for (const c of r.data.charges) row(form, [
    {text:c.id, policy:'repeat'}, {text:c.description + (c.actualCents < 0 || c.estimatedCents < 0 ? ' / Signed credit, not a refund action' : ''), policy:'split'},
    {text:c.scopeContainerIds.join(', ') || 'Empty scope', policy:'split'},
    ...[['estimatedCents', 'estimate'], ['actualCents', 'actual']].map(([key, label]) => ({html:monetary(c[key], `ledger-${label}-${c.id}`), numeric:true})),
    {html:monetary(sum([c.actualCents, -c.estimatedCents]), `ledger-variance-${c.id}`), numeric:true},
    {html:monetary(c[r.mode + 'Cents'], `ledger-selected-${c.id}`), numeric:true},
    {text:r.totals.chargeAllocations[c.id].reason || 'Complete', policy:'split'}
  ], widths, 'ledger', {chargeId:c.id});
  block(form, `Charge variance / actual minus estimated: SGD ${monetary(sum([r.actual.chargeTotalCents, -r.estimated.chargeTotalCents]), 'ledger-total-variance')}. Charges remain independent; no compounding.`, 'note', 'ledger');
}
export function allocation(form, r, state) {
  heading(form, '04', 'Allocation trace / exact integer cents', 'trace', ['Charge reference', 'Eligibility, denominator & computed rationale', 'Allocated SGD', 'Unallocated SGD'], [15, 59, 13, 13]);
  let residualExplained = false;
  r.data.charges.forEach((c, index) => {
    const a = r.audits[c.id], result = a.result, s = a.sample;
    const rationale = result.reason ? `Entire charge unresolved: ${result.reason}${!c.eligibleLineIds.length ? ' / empty eligibility' : ''}.` :
      c[r.mode + 'Cents'] === 0 ? 'Zero charge is complete even when the basis is missing.' :
      `Magnitude: abs(${c[r.mode + 'Cents']}) × basis / denominator; ${a.residualCents} residual cent(s), then sign.`;
    const example = s && !residualExplained ? ` Computed residual example: ${s.id} ideal ${s.numerator}/${a.denominator} cents; floor ${s.floor}, remainder ${s.remainder}/${a.denominator}; receives one residual cent → signed ${result.allocationsCents[s.id]} cents. Ties: ASCII ID ascending.` : '';
    if (example) residualExplained = true;
    row(form, [{text:c.id, policy:'repeat'},
      {html:`<p>Scope: ${esc(c.scopeContainerIds.join(', ') || 'None')}; ${c.eligibleLineIds.length} eligible IDs (source register). ${esc(r.basis)} denominator: ${a.denominator === null ? 'unknown' : a.denominator} ${r.basis === 'value' ? 'goods cents' : r.basis === 'quantity' ? 'EA' : 'g'}. ${esc(rationale + example)}</p>`, policy:'split', key:'rationale'},
      {html:monetary(sum(Object.values(result.allocationsCents)), `trace-allocated-${c.id}`), numeric:true},
      {html:monetary(result.unallocatedCents, `trace-unallocated-${c.id}`), numeric:true}
    ], [15, 59, 13, 13], 'trace', {traceId:c.id});
    if (state.notes === 'long' && index === r.data.charges.length - 1) {
      // Independent prose row: measured continuation; no amounts or oversized keep-next chain.
      row(form, [{text:c.id, policy:'repeat'}, {html:`<p class="stress-text" data-stress>${esc(longNarrative())}</p>`, policy:'split', key:'narrative'}], [15, 85], 'inspection-notes', {narrative:'inspection'});
    }
  });
  const groups = [];
  for (let i = 0; i < r.data.charges.length; i += 8) groups.push(r.data.charges.slice(i, i + 8));
  if (!groups.length) groups.push([]);
  groups.forEach((charges, index) => {
    const first = index === 0, last = index === groups.length - 1;
    const cols = 1 + charges.length + Number(first) + Number(last), widths = Array(cols).fill(100 / cols);
    const table = `matrix-${index}`;
    heading(form, '04', `Line allocation matrix / SGD / part ${index + 1}`, table,
      ['Line ID', ...(first ? ['Goods'] : []), ...charges.map(c => c.id), ...(last ? [r.partial ? 'Partial landed' : 'Landed'] : [])], widths);
    for (const l of r.data.lines) row(form, [
      {text:l.id, policy:'repeat'}, ...(first ? [{html:monetary(r.goods[l.id], `matrix-goods-${l.id}`), numeric:true}] : []),
      ...charges.map(c => ({html:monetary(r.totals.chargeAllocations[c.id].allocationsCents[l.id] ?? 0, `matrix-${c.id}-${l.id}`), numeric:true})),
      ...(last ? [{html:monetary(r.totals.lineLandedCents[l.id], `landed-${l.id}`), numeric:true}] : [])
    ], widths, table, {matrixLine:l.id, matrixPart:String(index)});
  });
}
