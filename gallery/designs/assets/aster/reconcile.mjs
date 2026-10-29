import {validate, sum, product, difference} from './validate.mjs';
import {reviewCases} from './reviews.mjs';
export const money = cents => {
  const n = BigInt(cents), abs = n < 0n ? -n : n;
  return `${n < 0n ? '−' : ''}${(abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${(abs % 100n).toString().padStart(2, '0')}`;
};
export function reconcile(input) {
  const data = validate(input), po = data.purchaseOrder.lines;
  const receipts = data.receipts.flatMap(r => r.lines.map(l => ({...l, documentId:r.id})));
  const invoices = data.invoices.flatMap(i => i.lines.map(l => ({...l, documentId:i.id, amount:product(l.billedQty, l.unitPriceCents)})));
  const rows = po.map(p => {
    const rs = receipts.filter(r => r.poLineId === p.id), linked = invoices.filter(l => l.poLineId === p.id);
    const gross = sum(rs.map(r => r.receivedQty)), returned = sum(rs.map(r => r.returnedQty));
    return {...p, receipts:rs, linked, gross, returned, net:difference(gross, returned),
      billed:sum(linked.map(l => l.billedQty)), amount:sum(linked.map(l => l.amount))};
  });
  const unmatched = invoices.filter(l => l.poLineId === null);
  const matched = invoices.filter(l => l.poLineId !== null);
  const poMap = new Map(po.map(p => [p.id, p]));
  const totals = {
    poLineCount:po.length, receiptDocumentCount:data.receipts.length, receiptLineCount:receipts.length,
    invoiceDocumentCount:data.invoices.length, canonicalInvoiceLineCount:invoices.length,
    ingestionEventCount:data.ingestionEvents.length, uniqueSourceRecordCount:new Set(data.ingestionEvents.map(e => e.sourceRecordKey)).size,
    poOrderedQty:sum(po.map(p => p.orderedQty)), grossReceivedQty:sum(receipts.map(r => r.receivedQty)),
    returnedQty:sum(receipts.map(r => r.returnedQty)), netReceivedQty:sum(rows.map(r => r.net)),
    invoiceBilledQty:sum(invoices.map(l => l.billedQty)), matchedBilledQty:sum(matched.map(l => l.billedQty)),
    unmatchedBilledQty:sum(unmatched.map(l => l.billedQty)),
    poOrderValueCents:sum(po.map(p => product(p.orderedQty, p.unitPriceCents))),
    invoiceTotalsCents:Object.fromEntries(data.invoices.map(i => [i.id, sum(i.lines.map(l => product(l.billedQty, l.unitPriceCents)))])),
    invoiceCanonicalTotalCents:sum(invoices.map(l => l.amount)), matchedInvoiceTotalCents:sum(matched.map(l => l.amount)),
    unmatchedInvoiceTotalCents:sum(unmatched.map(l => l.amount)), netReceivedAtPoPriceCents:sum(rows.map(r => product(r.net, r.unitPriceCents))),
    quantityBridgeAtPoPriceCents:sum(rows.map(r => product(difference(r.billed, r.orderedQty), r.unitPriceCents))),
    priceBridgeOnMatchedCents:sum(matched.map(l => product(l.billedQty, difference(l.unitPriceCents, poMap.get(l.poLineId).unitPriceCents))))
  };
  totals.invoiceMinusPoCents = difference(totals.invoiceCanonicalTotalCents, totals.poOrderValueCents);
  if (sum([totals.poOrderValueCents, totals.quantityBridgeAtPoPriceCents, totals.priceBridgeOnMatchedCents, totals.unmatchedInvoiceTotalCents]) !== totals.invoiceCanonicalTotalCents) throw new Error('Reconciliation does not balance');
  const cases = reviewCases(data, rows, unmatched);
  totals.expectedReviewCaseCount = cases.length;
  totals.reviewCaseIds = cases.map(c => c.id);
  return {data, rows, invoices, unmatched, cases, totals};
}
