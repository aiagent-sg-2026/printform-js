import {heading, block, row, esc, monetary} from './dom.mjs';
import {money} from './reconcile.mjs';
export function schedule(form, report, state) {
  const {rows, cases, unmatched, totals:t} = report;
  const reviewIds = new Set(cases.map(c => c.poId || `POL-${c.id.slice(-3)}`));
  const visible = state.detail === 'review' ? rows.filter(r => reviewIds.has(r.id)) : rows;
  if (!rows.length) return {shown:0, unmatched:0};
  const widths = [8, 20, 6, 6, 6, 9, 9, 11, 25];
  heading(form, 'Comparison schedule', '02 / Explicit references only', 'comparison',
    ['Source', 'Description', 'PO qty', 'Net recv.', 'Billed qty', 'PO unit SGD', 'Inv. unit SGD', 'Inv. line SGD', 'Review note'], widths);
  block(form, `Full document totals · Showing ${visible.length} of ${rows.length} PO lines, plus ${unmatched.length} unmatched invoice lines. Quantities in EA.`, 'display-scope', 'comparison');
  for (const r of visible) {
    const related = cases.filter(c => c.poId === r.id || (!c.poId && `POL-${c.id.slice(-3)}` === r.id));
    const note = !r.linked.length ? '△ No explicit linked invoice' : related.length ? `△ ${related.map(c => c.title).join('; ')}` : '✓ Matched under demo rules';
    row(form, [
      {html:`<b>${esc(r.id)}</b>${r.linked.map(l => `<br>${esc(l.id)}`).join('')}`, policy:'repeat'},
      {html:`${esc(r.description)}<br><span class="muted">${esc(r.sku)}</span>`, policy:'split', key:'description'},
      {text:r.orderedQty, numeric:true}, {text:r.net, numeric:true}, {text:r.linked.length ? r.billed : '—', numeric:true},
      {html:monetary(r.unitPriceCents, `po-unit-${r.id}`), numeric:true},
      {html:r.linked.length ? r.linked.map(l => monetary(l.unitPriceCents, `inv-unit-${l.id}`)).join('<br>') : '—', numeric:true},
      {html:r.linked.length ? r.linked.map(l => monetary(l.amount, `line-${l.id}`)).join('<br>') : '—', numeric:true},
      {text:note, policy:'split'}
    ], widths, 'comparison', {poId:r.id});
  }
  if (!visible.length) block(form, 'No PO lines have review differences under demo rules. Full document totals are unchanged.', 'empty', 'comparison');
  heading(form, 'Unmatched invoice lines', 'Separate evidence / Never joined by SKU', 'unmatched',
    ['Source', 'Description / visible SKU', 'Billed EA', 'Unit SGD', 'Line SGD', 'Review note'], [13, 29, 10, 12, 14, 22]);
  if (!unmatched.length) block(form, 'No unmatched invoice lines.', 'empty', 'unmatched');
  unmatched.forEach(l => row(form, [
    {text:`${l.id} / ${l.documentId}`, policy:'repeat'}, {text:`${l.description} · ${l.sku}`, policy:'split'},
    {text:l.billedQty, numeric:true}, {text:money(l.unitPriceCents), numeric:true},
    {html:monetary(l.amount, `line-${l.id}`), numeric:true}, {text:'△ Missing PO link · null reference; SKU resemblance is not a join', policy:'split'}
  ], [13, 29, 10, 12, 14, 22], 'unmatched', {invoiceId:l.id}));
  block(form, `Full document totals · Ordered ${t.poOrderedQty} EA · Gross received ${t.grossReceivedQty} · Returned ${t.returnedQty} · Net received ${t.netReceivedQty} · Billed ${t.invoiceBilledQty} (${t.matchedBilledQty} explicitly matched + ${t.unmatchedBilledQty} unmatched). Net receipt value at PO price: SGD ${money(t.netReceivedAtPoPriceCents)}. This is not a payable, GL balance or inventory valuation.`, 'schedule-end', 'unmatched');
  return {shown:visible.length, unmatched:unmatched.length};
}
