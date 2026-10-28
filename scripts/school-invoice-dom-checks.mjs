import assert from 'node:assert/strict';

export async function inspectInvoice(page) {
  return page.evaluate(() => {
    const sheets = [...document.querySelectorAll('.printform_page')];
    return {
      report: window.SCHOOL_FORMAT_REPORT, result: window.SCHOOL_RESULT,
      images: [...document.querySelectorAll('#invoice-root img')].every(n => n.complete && n.naturalWidth > 0),
      pages: sheets.map(sheet => {
        const bounds = sheet.getBoundingClientRect(), problems = [], textRects = [];
        const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const text = walker.currentNode;
          if (!text.textContent.trim() || text.parentElement.closest('svg')) continue;
          const range = document.createRange(); range.selectNodeContents(text);
          const style = getComputedStyle(text.parentElement);
          const cell = text.parentElement.closest('.line-grid > div, .invoice-identity dd, .brand h1, .totals > div');
          const cellBounds = cell?.getBoundingClientRect();
          for (const r of range.getClientRects()) {
            if (!r.width || !r.height) continue;
            const entry = { text: text.textContent.trim(), sizePx: parseFloat(style.fontSize),
              x: r.left - bounds.left, y: r.top - bounds.top, right: r.right - bounds.left, bottom: r.bottom - bounds.top };
            textRects.push(entry);
            if (r.left < bounds.left + 18.85 || r.right > bounds.right - 18.85 || r.top < bounds.top + 18.85 || r.bottom > bounds.bottom - 18.85)
              problems.push(`5mm text safety: ${entry.text}`);
            if (cellBounds && (r.left < cellBounds.left - 1 || r.right > cellBounds.right + 1 || r.top < cellBounds.top - 1 || r.bottom > cellBounds.bottom + 1))
              problems.push(`Text escapes cell: ${entry.text}`);
          }
        }
        const blocks = [...sheet.children].filter(n => !n.classList.contains('dummy_spacer'));
        blocks.forEach((n, i) => {
          const r = n.getBoundingClientRect();
          if (r.left < bounds.left - 1 || r.right > bounds.right + 1 || r.bottom > bounds.bottom + 1) problems.push(`Block outside page: ${n.className}`);
          if (i && blocks[i - 1].getBoundingClientRect().bottom > r.top + 1) problems.push(`Overlapping blocks: ${n.className}`);
        });
        return { width: bounds.width, height: bounds.height, text: sheet.textContent, problems, textRects,
          rows: [...sheet.querySelectorAll('[data-line-id]')].map(n => ({ id: n.dataset.lineId, cents: Number(n.dataset.amountCents) })),
          header: sheet.querySelectorAll('.invoice-header').length, tableHeader: sheet.querySelectorAll('.table-heading').length,
          totals: sheet.querySelectorAll('[data-totals]').length, payment: sheet.querySelectorAll('[data-payment]').length,
          warnings: sheet.querySelectorAll('.safety-line > strong').length,
          page: sheet.querySelector('[data-page-number]')?.textContent,
          total: sheet.querySelector('[data-page-total]')?.textContent,
          due: Number(sheet.querySelector('[data-due-cents]')?.dataset.dueCents) };
      })
    };
  });
}
export function independentTotals(data, items) {
  const amounts = items.map(n => BigInt(n.quantity) * BigInt(n.unitCents));
  const lineSubtotal = amounts.reduce((a, b) => a + b, 0n);
  const adjustment = (data.adjustments || []).reduce((a, n) => a + BigInt(n.cents), 0n);
  const subtotal = lineSubtotal + adjustment;
  const product = subtotal * BigInt(data.invoice.taxBasisPoints || 0);
  const tax = product < 0n ? -((-product + 5000n) / 10000n) : (product + 5000n) / 10000n;
  return { amounts: amounts.map(Number), lineSubtotal: Number(lineSubtotal), adjustment: Number(adjustment),
    subtotal: Number(subtotal), tax: Number(tax), due: Number(subtotal + tax) };
}
export function assertInvoice(snapshot, paper, mode, expected, items) {
  assert.equal(snapshot.report.failedCount, 0);
  assert.equal(snapshot.report.formattedCount, 1, 'actual formatAll invocation');
  assert.ok(snapshot.images, 'QR image decoded');
  const pages = snapshot.pages;
  assert.ok(mode === 'short' ? pages.length === 1 : pages.length >= 2, `Expected ${mode} page count, got ${pages.length}`);
  assert.deepEqual(pages.flatMap(p => p.rows.map(n => n.id)), items.map(n => n.id), 'Every line exactly once, in order');
  assert.deepEqual(pages.flatMap(p => p.rows.map(n => n.cents)), expected.amounts);
  assert.deepEqual(snapshot.result.total, expected, 'Independent BigInt reconciliation');
  for (const [i, p] of pages.entries()) {
    const mm = paper === 'A5' ? [148, 210] : [210, 297];
    assert.ok(Math.abs(p.width * 25.4 / 96 - mm[0]) < .02);
    assert.ok(Math.abs(p.height * 25.4 / 96 - mm[1]) < .02);
    assert.deepEqual(p.problems, [], `Page ${i + 1} geometry`);
    assert.equal(p.header, 1); assert.equal(p.warnings, 1);
    assert.ok(p.text.includes('SAMPLE — NOT VALID FOR PAYMENT'));
    assert.equal(Number(p.page), i + 1); assert.equal(Number(p.total), pages.length);
    assert.equal(p.tableHeader, p.rows.length ? 1 : 0, 'No orphaned table heading');
    assert.equal(p.totals, i === pages.length - 1 ? 1 : 0);
    assert.equal(p.payment, i === pages.length - 1 ? 1 : 0);
    assert.ok(p.textRects.every(n => n.sizePx >= 10), 'No text below 7.5pt CSS equivalent');
  }
  assert.equal(pages.at(-1).due, expected.due);
  assert.ok(pages.at(-1).rows.length > 0, 'Final amount stays with transaction lines');
}
