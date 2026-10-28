import schema from './input.schema.json' with {type:'json'};
export const integer = (n, label = 'arithmetic') => {
  if (typeof n === 'bigint') {
    if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`Unsafe integer ${label}`);
    return Number(n);
  }
  if (!Number.isSafeInteger(n)) throw new Error(`Unsafe integer ${label}`);
  return n;
};
export const sum = values => values.reduce((a, b) => integer(BigInt(a) + BigInt(b)), 0);
export const product = (a, b) => integer(BigInt(a) * BigInt(b));
export const difference = (a, b) => integer(BigInt(a) - BigInt(b));
// Deliberately small interpreter for every keyword present in the supplied schema.
// Unknown keywords fail closed so future schema additions cannot be ignored.
export function structure(value, rule = schema, at = 'input') {
  const supported = ['$schema', '$id', 'title', 'type', 'additionalProperties', 'required', 'properties', 'const', 'minLength', 'minimum', 'maximum', 'items'];
  for (const key of Object.keys(rule)) if (!supported.includes(key)) throw new Error(`Unsupported schema keyword ${key}`);
  if ('const' in rule && value !== rule.const) throw new Error(`${at}: expected ${rule.const}`);
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const types = [].concat(rule.type || []);
  if (types.length && !types.some(t => t === type || (t === 'integer' && Number.isSafeInteger(value)))) throw new Error(`${at}: invalid type or unsafe integer`);
  if (type === 'string' && value.length < (rule.minLength || 0)) throw new Error(`${at}: empty string`);
  if (type === 'number' && (value < rule.minimum || value > rule.maximum)) throw new Error(`${at}: out of bounds`);
  if (type === 'object') {
    for (const key of rule.required || []) if (!Object.hasOwn(value, key)) throw new Error(`${at}.${key}: required`);
    for (const [key, item] of Object.entries(value)) {
      if (!rule.properties?.[key] && rule.additionalProperties === false) throw new Error(`${at}.${key}: unexpected property`);
      if (rule.properties?.[key]) structure(item, rule.properties[key], `${at}.${key}`);
    }
  }
  if (type === 'array') value.forEach((item, i) => structure(item, rule.items, `${at}[${i}]`));
  return value;
}
function unique(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate ${label}: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
}
function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid ISO date: ${value}`);
  const [y, m, d] = value.split('-').map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  if (m < 1 || m > 12 || d < 1 || d > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]) throw new Error(`Invalid ISO date: ${value}`);
}
export function validate(data) {
  structure(data);
  const {purchaseOrder:po, receipts, invoices, ingestionEvents:events} = data;
  if (po.lines.length > 150) throw new Error('This bounded fixture supports at most 150 PO lines');
  unique([data.document, po, ...receipts, ...invoices], 'document ID');
  const poIds = unique(po.lines, 'PO line ID');
  unique(receipts.flatMap(r => r.lines), 'receipt line ID');
  unique(invoices.flatMap(i => i.lines), 'canonical invoice line ID');
  unique(events, 'event ID');
  date(data.document.asOfDate); date(po.orderDate);
  receipts.forEach(r => date(r.receivedDate)); invoices.forEach(i => date(i.invoiceDate));
  const known = new Map();
  po.lines.forEach(l => product(l.orderedQty, l.unitPriceCents));
  for (const receipt of receipts) for (const line of receipt.lines) {
    if (!poIds.has(line.poLineId)) throw new Error(`Unknown receipt PO reference: ${line.poLineId}`);
    if (line.returnedQty > line.receivedQty) throw new Error(`Return exceeds receipt: ${line.id}`);
  }
  for (const invoice of invoices) for (const line of invoice.lines) {
    if (line.poLineId !== null && !poIds.has(line.poLineId)) throw new Error(`Unknown invoice PO reference: ${line.poLineId}`);
    product(line.billedQty, line.unitPriceCents);
    known.set(line.id, invoice.id);
  }
  const keys = new Map();
  for (const event of events) {
    if (!known.has(event.invoiceLineId) || known.get(event.invoiceLineId) !== event.invoiceId) throw new Error(`Invalid event reference: ${event.id}`);
    const content = `${event.invoiceId}/${event.invoiceLineId}`;
    if (keys.has(event.sourceRecordKey) && keys.get(event.sourceRecordKey) !== content) throw new Error(`Conflicting import key: ${event.sourceRecordKey}`);
    keys.set(event.sourceRecordKey, content);
  }
  return data;
}
