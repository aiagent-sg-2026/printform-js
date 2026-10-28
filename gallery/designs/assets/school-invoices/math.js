/* Shared integer-cent arithmetic; usable in browser and VM tests. */
(() => {
  'use strict';
  const integer = (value, label) => {
    if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be a safe integer`);
    return value;
  };
  function lines(data, mode = 'short') {
    const result = data.lineItems.map(item => ({ ...item }));
    if (mode === 'long') {
      const fixture = data.longSample;
      for (let i = result.length; i < fixture.count; i++) {
        const kind = i % fixture.descriptions.length;
        result.push({ id: `L${String(i + 1).padStart(3, '0')}`,
          description: fixture.descriptions[kind], descriptionZh: fixture.descriptionsZh[kind],
          quantity: kind === 4 ? 0 : 1 + i % 3,
          unitCents: kind === 5 ? -1200 : 1850 + i * 25 });
      }
    }
    return result;
  }
  function calculate(data, items) {
    const ids = new Set();
    const amounts = items.map(item => {
      if (!item.id || ids.has(item.id)) throw new TypeError('Unique line IDs required');
      ids.add(item.id);
      integer(item.quantity, 'quantity');
      if (item.quantity < 0) throw new RangeError('Use signed unitCents for credits');
      return integer(item.quantity * integer(item.unitCents, 'unitCents'), 'line amount');
    });
    const lineSubtotal = amounts.reduce((sum, cents) => integer(sum + cents, 'line subtotal'), 0);
    const adjustment = (data.adjustments || []).reduce((sum, item) => integer(sum + integer(item.cents, 'adjustment'), 'adjustments'), 0);
    const subtotal = integer(lineSubtotal + adjustment, 'subtotal');
    const bp = integer(data.invoice.taxBasisPoints || 0, 'taxBasisPoints');
    if (bp < 0 || bp > 10000) throw new RangeError('Tax basis points outside sample range');
    // Half away from zero, including credit-only invoices; multiplication remains exact.
    const product = integer(subtotal * bp, 'tax product');
    const tax = Math.sign(product) * Math.floor(integer(Math.abs(product) + 5000, 'tax rounding') / 10000);
    return { amounts, lineSubtotal, adjustment, subtotal, tax, due: integer(subtotal + tax, 'amount due') };
  }
  const money = cents => {
    integer(cents, 'money');
    const absolute = Math.abs(cents);
    return `${cents < 0 ? '−' : ''}${Math.floor(absolute / 100).toLocaleString('en-SG')}.${String(absolute % 100).padStart(2, '0')}`;
  };
  window.SchoolInvoiceMath = { lines, calculate, money };
})();
