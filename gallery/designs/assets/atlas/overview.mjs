import {block, row, esc, monetary, grams, feeLabel} from './dom.mjs';
export function overview(form, r, state, artwork) {
  const {document:d, shipment:s} = r.data, t = r.totals;
  block(form, `<div><span class="edition">01 / SHIPMENT OVERVIEW</span><div class="wordmark">ATLAS<span>LANDED COST / DOSSIER</span></div></div><img src="${esc(artwork)}" alt="Original fictional ocean route and container diagram">`, 'masthead', 'overview');
  row(form, [{html:`<h1>${esc(d.title)}</h1><b>${esc(d.company)}</b>`, policy:'split'},
    {html:`<b>${esc(d.id)}</b><br>As of ${esc(d.asOfDate)}<br>${esc(d.notice)}`, policy:'split'}], [55, 45], 'overview');
  row(form, [{html:`<b>${esc(s.origin)} → ${esc(s.destination)}</b><br>${esc(s.routeLabel)}`, policy:'split'},
    {html:`${esc(s.id)}<br>Departure ${esc(s.departureDate)} · Arrival ${esc(s.arrivalDate)}`, policy:'split'}], [55, 45], 'overview');
  block(form, `<b class="badge">${esc(r.mode.toUpperCase())} / ${esc(r.basis.toUpperCase())} BASIS</b> <b class="${r.partial || r.weightGrams === null ? 'warning' : ''}">${r.partial ? 'UNRESOLVED CHARGES' : 'Allocation complete'}${r.weightGrams === null ? ' · Weight incomplete' : ''}</b><p>Scenario: ${esc(state.scenario)} · ${r.containers.length} containers · ${r.data.lines.length} lines · ${r.quantity} EA · ${esc(grams(r.weightGrams))}</p>`, 'selection', 'overview');
  const metrics = [['Goods', t.goodsTotalCents], ['Allocated fees', t.allocatedFeesCents], ['Unallocated fees', t.unallocatedFeesCents], [feeLabel(r), t.landedTotalCents]];
  block(form, `<div class="metrics">${metrics.map(([label, value], i) => `<div><span>${esc(label)} / SGD</span><strong>${monetary(value, `overview-${i}`)}</strong></div>`).join('')}</div>`, 'summary', 'overview');
  for (const c of r.containers) row(form, [
    {html:`<b>${esc(c.id)}</b> · ${esc(c.label)}<br>${esc(c.reference)} · Seal ${esc(c.sealReference)}`, policy:'split'},
    {text:`${c.lines.length} lines / ${c.quantity} EA / ${grams(c.weightGrams)}`},
    {html:`Goods SGD ${monetary(c.goodsCents, `card-${c.id}`)}`, numeric:true}
  ], [48, 30, 22], 'overview');
}
