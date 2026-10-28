import {sum, product, difference} from './validate.mjs';
export function reviewCases(data, rows, unmatched) {
  const cases = [];
  const add = (kind, suffix, row, title, facts, question, amount = null, extra = []) => cases.push({
    id:`REV-${kind}-${suffix}`, poId:row?.id || null, title, facts, question, amount,
    refs:[...(row ? [row.id, ...row.linked.map(l => l.id), ...row.receipts.map(r => r.documentId)] : []), ...extra]
  });
  for (const row of rows) {
    const suffix = row.id.replace(/^POL-/, '');
    const prices = row.linked.filter(l => l.unitPriceCents !== row.unitPriceCents);
    if (prices.length) add('PRICE', suffix, row, 'Unit price differs',
      `PO unit ${row.unitPriceCents} cents; invoice unit ${prices.map(l => l.unitPriceCents).join(', ')} cents; billed ${row.billed} EA. Difference ${sum(prices.map(l => product(l.billedQty, difference(l.unitPriceCents, row.unitPriceCents))))} cents.`,
      'Is there a documented price change?', row.amount);
    if (row.billed > row.net) {
      if (!row.receipts.length) add('NORECEIPT', suffix, row, 'No receipt evidence',
        `Ordered ${row.orderedQty} EA. No receipt row; billed ${row.billed} EA.`, 'Was receipt omitted or was this billed before receipt?', row.amount);
      else if (row.returned) add('RETURN', suffix, row, 'Receipt reduced by return',
        `Received ${row.gross}, returned ${row.returned}, net ${row.net}, billed ${row.billed} EA. Return reference ${row.receipts.map(r => r.returnReference).filter(Boolean).join(', ')} is an attached adjustment summary, not a new document.`,
        'Is corresponding supplier evidence pending?', row.amount);
      else add('PARTIAL', suffix, row, 'Billed above partial receipt',
        `Ordered ${row.orderedQty}, gross/net received ${row.net}, billed ${row.billed} EA; billed exceeds net by ${difference(row.billed, row.net)}.`,
        'Is another receipt missing or is quantity being queried?', row.amount);
    }
  }
  for (const line of unmatched) add('UNMATCHED', line.id.replace(/^IL-/, ''), null, 'Missing PO link',
    `Null PO reference; ${line.billedQty} EA × ${line.unitPriceCents} cents = ${line.amount} cents. SKU resemblance is not a join.`,
    'Which explicit PO line should the source refer to?', line.amount, [line.id]);
  const groups = Map.groupBy(data.ingestionEvents, e => e.sourceRecordKey);
  for (const [key, events] of groups) if (events.length > 1) {
    const line = data.invoices.flatMap(i => i.lines).find(l => l.id === events[0].invoiceLineId);
    const row = rows.find(r => r.id === line.poLineId);
    add('DUPIMPORT', line.id.replace(/^IL-/, ''), row, 'Repeated import reference',
      `Same ${key} imported ${events.length} times; one canonical line ${line.billedQty} × ${line.unitPriceCents} = ${product(line.billedQty, line.unitPriceCents)} cents. Import events never enter financial totals.`,
      'Confirm duplicate event handling; no extra payable is created here.', product(line.billedQty, line.unitPriceCents), events.map(e => e.id));
  }
  return cases.sort((a, b) => a.id.slice(-3).localeCompare(b.id.slice(-3)) || a.id.localeCompare(b.id));
}
