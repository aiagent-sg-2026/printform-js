// Fictional purchase-order model. Money is integer cents; round half up per line.
export const MAX_BYTES = 1048576;
const fail = message => { throw new Error(message); };
function text(value, label, max = 240, optional = false) {
  if (optional && value == null) return '';
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim()))
    fail(`${label}: expected ${optional ? 'optional ' : ''}text, at most ${max} characters.`);
  return value;
}
function decimal(value, label, max, scale = 100) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max ||
      value !== Math.round(value * scale) / scale)
    fail(`${label}: expected a finite number from 0 to ${max}, at most ${Math.log10(scale)} decimal places.`);
  return Math.round(value * scale);
}
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}: expected an object.`);
  return value;
}
const rounded = (n, d) => Number((n + d / 2n) / d);
export function parse(textValue) {
  if (typeof textValue !== 'string' || textValue.length > MAX_BYTES || new TextEncoder().encode(textValue).length > MAX_BYTES)
    fail('JSON must not exceed 1 MiB.');
  let data;
  try { data = JSON.parse(textValue); } catch { fail('Invalid JSON. Correct the editor or import a valid JSON file.'); }
  return validate(data);
}
export function validate(input) {
  const d = object(input, 'Purchase order');
  if (!Array.isArray(d.items) || d.items.length > 200) fail('Items must be an array containing 0–200 items.');
  const supplier = object(d.supplier, 'Supplier');
  const deliverTo = object(d.deliverTo, 'Deliver To');
  const data = {
    poNumber: text(d.poNumber, 'PO number', 24), date: text(d.date, 'Date', 40),
    deliveryDate: text(d.deliveryDate, 'Delivery date', 40), paymentTerms: text(d.paymentTerms, 'Payment terms', 40),
    supplierCode: text(d.supplierCode, 'Supplier code', 40), reference: text(d.reference, 'Reference', 60, true),
    supplier: {name: text(supplier.name, 'Supplier name'), address: text(supplier.address, 'Supplier address', 400, true),
      email: text(supplier.email, 'Supplier email', 120, true)},
    deliverTo: {name: text(deliverTo.name, 'Delivery name'), address: text(deliverTo.address, 'Delivery address', 400, true)},
    remarks: text(d.remarks, 'Remarks', 1400, true), taxRate: decimal(d.taxRate, 'GST rate', 100) / 100,
    items: d.items.map((raw, i) => {
      const r = object(raw, `Item ${i + 1}`);
      const item = {code: text(r.code, `Item ${i + 1} code`, 24), barcode: text(r.barcode, `Item ${i + 1} barcode`, 12),
        description: text(r.description, `Item ${i + 1} description`, 12000), uom: text(r.uom, 'UOM', 12),
        quantity: decimal(r.quantity, 'Quantity', 1000000, 1000) / 1000,
        unitPrice: decimal(r.unitPrice, 'Unit price', 1000000) / 100,
        discount: decimal(r.discount, 'Discount', 100) / 100};
      if (!/^[0-9]{4,12}$/.test(item.barcode)) fail(`Item ${i + 1} barcode: use 4–12 fictional ASCII digits.`);
      return item;
    })
  };
  if (!/^[\x20-\x7e]+$/.test(data.poNumber)) fail('PO number must be printable ASCII for Code128.');
  calculate(data);
  return data;
}
export function calculate(data) {
  const gross = [], amounts = [];
  for (const item of data.items) {
    const q = BigInt(Math.round(item.quantity * 1000)), p = BigInt(Math.round(item.unitPrice * 100));
    gross.push(rounded(q * p, 1000n));
    amounts.push(rounded(q * p * BigInt(10000 - Math.round(item.discount * 100)), 10000000n));
  }
  const subtotal = amounts.reduce((a, b) => a + b, 0), beforeDiscount = gross.reduce((a, b) => a + b, 0);
  const tax = rounded(BigInt(subtotal) * BigInt(Math.round(data.taxRate * 100)), 10000n);
  const grand = subtotal + tax;
  if (![grand, beforeDiscount].every(Number.isSafeInteger) || grand > 999999999999)
    fail('Total exceeds the supported SGD 9,999,999,999.99 limit.');
  return {gross, amounts, beforeDiscount, discount: beforeDiscount - subtotal, subtotal, tax, grand};
}
export const money = cents => (cents / 100).toLocaleString('en-SG', {minimumFractionDigits: 2, maximumFractionDigits: 2});
export function preset(sample, count) {
  if (![0, 6, 20, 100, 200].includes(count)) fail('Unsupported item-count preset.');
  const data = structuredClone(sample);
  data.items = Array.from({length: count}, (_, i) => ({...sample.items[i % sample.items.length],
    code: `DEMO-${String(i + 1).padStart(3, '0')}`, barcode: `880000${String(i + 1).padStart(6, '0')}`}));
  return data;
}
