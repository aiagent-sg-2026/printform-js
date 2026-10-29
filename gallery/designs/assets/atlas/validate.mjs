// All calculations cross the safe-integer boundary explicitly; no floating money.
export function safe(value) {
  const n = typeof value === 'bigint' ? value : BigInt(integer(value));
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < -BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Unsafe integer result');
  return Number(n);
}
export function integer(value, nonnegative = false) {
  if (!Number.isSafeInteger(value) || (nonnegative && value < 0)) throw new TypeError('Expected safe integer');
  return value;
}
export const sum = values => safe(values.reduce((a, b) => a + BigInt(integer(b)), 0n));
export const product = (a, b) => safe(BigInt(integer(a)) * BigInt(integer(b)));
const text = v => { if (typeof v !== 'string' || !v.length) throw new TypeError('Expected nonempty text'); };
const id = v => { text(v); if (!/^[\x20-\x7e]+$/.test(v)) throw new TypeError('IDs must be exact ASCII'); };
function shape(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== fields.split(' ').sort().join('|')) throw new TypeError('Unsupported source structure');
}
function date(value) {
  text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new TypeError('Invalid ISO date');
}
function list(value) { if (!Array.isArray(value)) throw new TypeError('Expected array'); return value; }
function unique(values) {
  values.forEach(id);
  if (new Set(values).size !== values.length) throw new TypeError('Duplicate ID');
}
export const weight = line => line.quantity === 0 ? 0 : line.unitWeightGrams === null ? null : product(line.quantity, line.unitWeightGrams);
export function validate(data) {
  shape(data, 'schemaVersion document shipment containers lines charges');
  if (data.schemaVersion !== 1) throw new TypeError('Unsupported schema version');
  shape(data.document, 'id title company currency asOfDate notice');
  id(data.document.id); ['title', 'company', 'notice'].forEach(k => text(data.document[k]));
  if (data.document.currency !== 'SGD') throw new TypeError('Only SGD is supported; no FX');
  date(data.document.asOfDate);
  shape(data.shipment, 'id origin destination routeLabel departureDate arrivalDate');
  id(data.shipment.id); ['origin', 'destination', 'routeLabel'].forEach(k => text(data.shipment[k]));
  date(data.shipment.departureDate); date(data.shipment.arrivalDate);
  ['containers', 'lines', 'charges'].forEach(k => unique(list(data[k]).map(x => x?.id)));
  if (!data.containers.length) throw new TypeError('At least one container required');
  const containers = new Set(data.containers.map(c => c.id));
  data.containers.forEach(c => {
    shape(c, 'id label reference sealReference');
    ['label', 'reference', 'sealReference'].forEach(k => text(c[k]));
  });
  const lines = new Map(data.lines.map(l => [l.id, l]));
  data.lines.forEach(l => {
    shape(l, 'id containerId sku description quantity unitGoodsCents unitWeightGrams');
    if (!containers.has(l.containerId)) throw new TypeError('Unknown line container');
    text(l.sku); text(l.description); integer(l.quantity, true); integer(l.unitGoodsCents, true);
    if (l.unitWeightGrams !== null) integer(l.unitWeightGrams, true);
    product(l.quantity, l.unitGoodsCents); weight(l);
  });
  sum(data.lines.map(l => product(l.quantity, l.unitGoodsCents)));
  sum(data.lines.map(l => l.quantity)); sum(data.lines.map(l => weight(l) ?? 0));
  data.charges.forEach(c => {
    shape(c, 'id description scopeContainerIds eligibleLineIds estimatedCents actualCents sourceRef');
    text(c.description); text(c.sourceRef);
    unique(list(c.scopeContainerIds)); unique(list(c.eligibleLineIds));
    c.scopeContainerIds.forEach(i => { if (!containers.has(i)) throw new TypeError('Unknown charge container'); });
    c.eligibleLineIds.forEach(i => {
      if (!lines.has(i)) throw new TypeError('Unknown eligible line');
      if (!c.scopeContainerIds.includes(lines.get(i).containerId)) throw new TypeError('Eligibility outside explicit scope');
    });
    integer(c.estimatedCents); integer(c.actualCents); sum([c.actualCents, -c.estimatedCents]);
  });
  for (const mode of ['estimated', 'actual']) sum(data.charges.map(c => c[mode + 'Cents']));
  sum(data.charges.map(c => sum([c.actualCents, -c.estimatedCents])));
  return data;
}
