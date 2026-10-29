import {block, esc, monetary} from './dom.mjs';
import {money} from './reconcile.mjs';
export function summary(form, report, logo) {
  const {data, totals:t, cases} = report;
  const activeR = data.receipts.filter(r => r.lines.length).length, activeI = data.invoices.filter(i => i.lines.length).length;
  block(form, `<div class="hero-top"><img src="${logo}" alt="Original Aster geometric asterisk wordmark"><h1>Three-way match <em>review pack</em></h1></div>
    <div class="parties"><b>${esc(data.document.buyer)}</b><span>Supplier · ${esc(data.document.supplier)}</span><span>As of ${esc(data.document.asOfDate)} · SGD · integer EA</span></div>
    <div class="scope"><span>${data.purchaseOrder.lines.length ? 1 : 0} active PO</span><span>${activeR} active receipts / ${data.receipts.length} containers</span><span>${activeI} active invoices / ${data.invoices.length} containers</span><span>${data.purchaseOrder.lines.length} PO lines</span></div>
    <p class="eyebrow">Full document totals</p><div class="metrics"><div><span>Canonical invoice total · SGD</span><strong>${monetary(t.invoiceCanonicalTotalCents, 'summary-invoice')}</strong></div><div><span>Net received quantity · EA</span><strong>${t.netReceivedQty}</strong></div><div><span>Human review cases</span><strong>${cases.length.toString().padStart(2, '0')}</strong></div></div>
    <div class="relationship" aria-label="Source relationship diagram"><div><b>01 / Purchase order</b><span>${esc(data.purchaseOrder.id)}</span></div><i>→</i><div><b>02 / Receipt evidence</b><span>${t.receiptLineCount} rows · net = gross − returns</span></div><i>→</i><div><b>03 / Canonical invoices</b><span>${t.canonicalInvoiceLineCount} lines · explicit links only</span></div></div>
    <p class="summary-note">Unmatched invoice amount <b>SGD ${money(t.unmatchedInvoiceTotalCents)}</b> · Import events are evidence, never extra financial lines.</p>
    ${!t.poLineCount ? '<p class="empty">No items. No review cases. All five receipt/invoice containers have no lines in this fixture.</p>' : ''}`, 'opening', 'opening');
  if (!t.poLineCount) return;
  const bridge = [
    ['PO order value', t.poOrderValueCents, 'Ordered quantity × PO unit price'],
    ['Quantity bridge at PO price', t.quantityBridgeAtPoPriceCents, 'Explicit linked billed quantity less ordered quantity'],
    ['Price bridge on matched lines', t.priceBridgeOnMatchedCents, 'Linked billed quantity × unit price difference'],
    ['Unmatched invoice amount', t.unmatchedInvoiceTotalCents, 'Null PO references remain separate']
  ];
  block(form, `<div class="section-title"><span>01 / Reconciliation</span><h2>From ordered to invoiced</h2></div><div class="bridge">${bridge.map(([title, value, note]) => `<div><b>${title}</b><span>${note}</span><strong>${money(value)}</strong></div>`).join('')}<div class="bridge-result"><b>Canonical invoice total · SGD</b><span>${bridge.map(([, v], i) => `${i && v >= 0 ? '+ ' : ''}${money(v)}`).join(' ')} = ${money(t.invoiceCanonicalTotalCents)}</span><strong>${money(t.invoiceCanonicalTotalCents)}</strong></div></div><p class="summary-note">Invoice minus PO: SGD ${money(t.invoiceMinusPoCents)}. The unlinked PO quantity remains in the quantity bridge; the unmatched invoice is added separately. This does not establish a match.</p>`, 'reconciliation', 'bridge');
}
