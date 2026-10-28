import {heading, block, row, esc, monetary} from './dom.mjs';
import {money} from './reconcile.mjs';
import {longNarrative} from './fixtures.mjs';
export function reviews(form, report, state) {
  if (!report.rows.length) return;
  heading(form, 'Review notes', '03 / Questions, not decisions', 'prose');
  if (!report.cases.length) {
    block(form, '✓ No review differences under demo rules. This is not an approval.', 'no-differences', 'prose'); return;
  }
  report.cases.forEach(c => {
    const long = state.notes === 'long' && c.id === 'REV-PARTIAL-003';
    // A measured long row may exceed a keep-next chain's fresh-page budget.
    // Keep the first fact inside the small atomic heading, not in that long chain.
    const title = block(form, `<span class="case-id">△ ${esc(c.id)}</span><h3>${esc(c.title)}</h3>${long ? `<p>${esc(c.facts)}</p>` : ''}`, 'case-heading', 'prose');
    title.dataset.pfKeepWithNext = 'true';
    const narrative = long ? `<p class="stress-text" data-stress>${esc(longNarrative())}</p>` : '';
    row(form, [
      {html:c.refs.map(esc).join('<br>'), policy:'repeat'},
      {html:`${long ? '' : `<p>${esc(c.facts)}</p>`}<p class="review-question"><b>Review question</b> · ${esc(c.question)}</p>${narrative}`, policy:'split', key:`narrative-${c.id}`},
      {html:c.amount === null ? '—' : `<span class="muted">Invoice evidence<br>SGD</span><br>${monetary(c.amount, `case-${c.id}`)}`, numeric:true}
    ], [18, 66, 16], 'prose', {caseId:c.id});
  });
  block(form, 'Case facts may overlap: do not sum evidence amounts as a KPI. Ordered-versus-billed differences alone are informational.', 'schedule-end without_prowheader', 'prose');
}
function receiptScope(receipt) {
  const returns = receipt.lines.filter(l => l.returnedQty > 0);
  if (!returns.length) return 'Gross receipt quantities, with attached return summary fields.';
  const references = [...new Set(returns.map(l => l.returnReference).filter(Boolean))];
  const missing = returns.some(l => !l.returnReference);
  return `Includes attached return adjustments · references: ${references.length ? references.join(' / ') : 'not supplied'}${references.length && missing ? ' (some not supplied)' : ''}; no separate return document is claimed.`;
}
export function sources(form, report) {
  if (!report.rows.length) return;
  const {data, totals:t} = report;
  heading(form, 'Source register', '04 / Synthetic references only', 'sources',
    ['Source / date', 'Contents', 'Evidence scope'], [22, 40, 38]);
  row(form, [
    {text:`${data.purchaseOrder.id} / ${data.purchaseOrder.orderDate}`},
    {text:`${t.poLineCount} PO lines · ${t.poOrderedQty} EA · SGD ${money(t.poOrderValueCents)}`},
    {text:'One synthetic purchase order. No actual attachment or external verification link.'}
  ], [22, 40, 38], 'sources');
  data.receipts.forEach(r => row(form, [
    {text:`${r.id} / ${r.receivedDate}`},
    {text:r.lines.length ? `${r.lines.length} receipt rows · ${r.lines.map(l => l.poLineId).join(', ')}` : 'No lines in this fixture', policy:'split'},
    {text:receiptScope(r), policy:'split'}
  ], [22, 40, 38], 'sources'));
  data.invoices.forEach(i => row(form, [
    {text:`${i.id} / ${i.invoiceDate}`},
    {text:i.lines.length ? `${i.lines.length} canonical lines · SGD ${money(t.invoiceTotalsCents[i.id])}` : 'No lines in this fixture'},
    {text:i.lines.length ? i.lines.map(l => l.id).join(', ') : 'Empty synthetic container, not evidence of an actual invoice.', policy:'split'}
  ], [22, 40, 38], 'sources'));
  heading(form, 'Import evidence', 'Events are not financial lines', 'imports', ['Event references', 'Canonical reference', 'Interpretation'], [30, 30, 40]);
  const groups = Map.groupBy(data.ingestionEvents, e => e.sourceRecordKey);
  const repeats = [...groups].filter(([, events]) => events.length > 1);
  if (!repeats.length) block(form, `${t.ingestionEventCount} import events · ${t.uniqueSourceRecordCount} unique source keys. No repeated import references.`, 'empty', 'imports');
  repeats.forEach(([key, events]) => row(form, [
    {text:events.map(e => e.id).join(' / ')}, {text:`${key} / ${events[0].invoiceLineId}`},
    {text:'△ Same canonical invoice/line imported again. One financial line only; confirm event handling.', policy:'split'}
  ], [30, 30, 40], 'imports'));
  block(form, `${t.ingestionEventCount} events · ${t.uniqueSourceRecordCount} unique source keys · ${t.canonicalInvoiceLineCount} canonical invoice lines. Repeated reference labels and physical text fragments do not add records.`, 'schedule-end', 'imports');
  heading(form, 'Method & review record', '05 / A bounded demonstration', 'method');
  [
    ['Exact integer arithmetic', 'Every quantity is integer EA and every monetary value is integer SGD cents. Products, sums and signed deltas are checked against JavaScript safe-integer bounds. Currency formatting is display only. No tax, discounts, freight or FX are included.'],
    ['Explicit source relationships', 'Only an exact non-null PO line ID creates a link. Unknown IDs block input; a null ID creates missing-link evidence. SKU resemblance never creates a join. Demo price and quantity tolerances are zero; this is not a recommended procurement policy.'],
    ['One review unit per primary issue', 'Quantity precedence is no receipt, then return-adjusted shortage, then partial receipt shortage. Price, missing link and repeated import are separate types. A related PO row with no explicit invoice is not a second invoice.'],
    ['Import scope & document status', 'Repeated source keys are review evidence only for the same canonical invoice/line; conflicting keys fail validation. Only canonical invoice lines enter totals. All names, references and narratives are fictional; there are no live attachments or ERP actions.']
  ].forEach(([title, text]) => block(form, `<h3>${title}</h3><p>${text}</p>`, 'method-note', 'method', false));
  block(form, `<h3>Review record <span class="muted">/ Demo only</span></h3><div class="review-record">${['Prepared by', 'Reviewed by', 'Review date'].map(label => `<div><b>${label}</b><span class="blank"></span><small>Demo only · blank print space</small></div>`).join('')}</div>`, 'final-record', 'method');
}
