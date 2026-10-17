import { object, text, choice, metadata, provenance, has, rows, quantity, stockLocation, fail } from './business-facts-validation.js';

const trace = fact => `${fact.provenance.sourcePath}: ${fact.provenance.meaning}`;
const sourcedMetadata = (value, path, keys, required) => {
  object(value, path, [...keys, 'provenance']);
  const result = metadata(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'provenance')), path, keys, required);
  return { ...result, provenance: provenance(value.provenance, `${path}.provenance`) };
};
const status = (value, path) => sourcedMetadata(value, path, ['value'], ['value']);
function nonnegativeQuantity(value, path) {
  const parsed = quantity(value, path);
  if (parsed.amount.trimStart().startsWith('-') && /[1-9]/.test(parsed.amount)) fail('QUANTITY', `${path}.amount`, 'Supply a nonnegative physical quantity; negative zero spelling is retained.');
  return parsed;
}
const quantityText = value => `${value.amount} ${value.uom}`;
const quantityTrace = value => `${trace(value)}; precision=${value.decimalPlaces}`;

export function normalizeService(value, add, unique) {
  object(value, 'service', ['job', 'customer', 'asset', 'status', 'observations']);
  const job = sourcedMetadata(value.job, 'service.job', ['id', 'number', 'request'], ['id', 'number', 'request']);
  const customer = sourcedMetadata(value.customer, 'service.customer', ['id', 'name', 'address'], ['id', 'name']);
  const asset = sourcedMetadata(value.asset, 'service.asset', ['id', 'name', 'serialNumber'], ['id', 'name']);
  const result = { job, customer, asset };
  if (has(value, 'status')) result.status = status(value.status, 'service.status');
  result.observations = rows(value.observations, 'service.observations', true).map((entry, i) => {
    const path = `service.observations[${i}]`;
    object(entry, path, ['id', 'category', 'description', 'quantity', 'provenance']);
    const parsed = { id: unique(entry.id, `${path}.id`), category: choice(entry.category, ['request', 'observation', 'work', 'recommendation'], `${path}.category`),
      description: text(entry.description, `${path}.description`), provenance: provenance(entry.provenance, `${path}.provenance`) };
    if (has(entry, 'quantity')) parsed.quantity = nonnegativeQuantity(entry.quantity, `${path}.quantity`);
    add(parsed.id, parsed.category, parsed.description, parsed.quantity ? quantityText(parsed.quantity) : '', parsed.category,
      `${parsed.id}\n${trace(parsed)}${parsed.quantity ? `\n${quantityTrace(parsed.quantity)}` : ''}`);
    return parsed;
  });
  return result;
}

export function normalizePacking(value, add, unique) {
  object(value, 'packing', ['shipment', 'from', 'to', 'status', 'packages']);
  const shipment = sourcedMetadata(value.shipment, 'packing.shipment', ['id', 'number'], ['id', 'number']);
  const result = { shipment };
  for (const key of ['from', 'to']) {
    result[key] = stockLocation(value[key], `packing.${key}`);
    result[key].provenance = provenance(value[key].provenance, `packing.${key}.provenance`);
  }
  if (has(value, 'status')) result.status = status(value.status, 'packing.status');
  result.packages = rows(value.packages, 'packing.packages', true).map((entry, i) => {
    const path = `packing.packages[${i}]`;
    object(entry, path, ['id', 'type', 'marks', 'grossWeight', 'netWeight', 'provenance', 'items']);
    const parsed = { id: unique(entry.id, `${path}.id`), type: text(entry.type, `${path}.type`), marks: text(entry.marks, `${path}.marks`),
      provenance: provenance(entry.provenance, `${path}.provenance`) };
    for (const key of ['grossWeight', 'netWeight']) if (has(entry, key)) parsed[key] = nonnegativeQuantity(entry[key], `${path}.${key}`);
    const weights = ['grossWeight', 'netWeight'].filter(key => parsed[key]);
    // Output-only identities depend on row position/role, never on supplied IDs.
    add(`packing:package:${i + 1}`, 'Package', `${parsed.type}\n${parsed.marks}`, '', parsed.id, `${parsed.id}\n${trace(parsed)}`);
    for (const key of weights) {
      const label = key === 'grossWeight' ? 'Gross weight' : 'Net weight';
      add(`packing:weight:${i + 1}:${key}`, label, `Supplied ${label.toLowerCase()}`, quantityText(parsed[key]), parsed.id,
        `${parsed.id}\n${quantityTrace(parsed[key])}`);
    }
    parsed.items = rows(entry.items, `${path}.items`, true).map((item, j) => {
      const itemPath = `${path}.items[${j}]`;
      object(item, itemPath, ['id', 'item', 'description', 'quantity', 'provenance']);
      const line = { id: unique(item.id, `${itemPath}.id`), item: metadata(item.item, `${itemPath}.item`, ['id', 'code', 'name'], ['id', 'name']),
        description: text(item.description, `${itemPath}.description`), quantity: nonnegativeQuantity(item.quantity, `${itemPath}.quantity`),
        provenance: provenance(item.provenance, `${itemPath}.provenance`) };
      add(`packing:item:${i + 1}:${j + 1}`, line.item.code || line.item.id, `${line.description}\n${line.item.name}`, quantityText(line.quantity), parsed.id,
        `${line.id} · ${line.item.id}\n${trace(line)}\n${quantityTrace(line.quantity)}`);
      return line;
    });
    return parsed;
  });
  return result;
}

// Bind every supplied context value and its provenance; never stringify an object into a cell.
export function serviceLogisticsFields(data, field) {
  const fields = [];
  const group = (base, value, names) => {
    for (const [key, label] of Object.entries(names)) if (has(value, key)) fields.push(field(`${base}-${key}`.replaceAll('/', '-').replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), label, `/${base}/${key}`));
    fields.push(field(`${base}-source`.replaceAll('/', '-'), 'Source path', `/${base}/provenance/sourcePath`),
      field(`${base}-meaning`.replaceAll('/', '-'), 'Source meaning', `/${base}/provenance/meaning`));
  };
  if (data.service) {
    group('service/job', data.service.job, { id: 'Job ID', number: 'Job number', request: 'Supplied request' });
    group('service/customer', data.service.customer, { id: 'Customer ID', name: 'Customer', address: 'Customer address' });
    group('service/asset', data.service.asset, { id: 'Asset ID', name: 'Asset', serialNumber: 'Supplied serial' });
    if (data.service.status) group('service/status', data.service.status, { value: 'Source status (not acceptance)' });
  }
  if (data.packing) {
    group('packing/shipment', data.packing.shipment, { id: 'Shipment ID', number: 'Shipment number' });
    for (const key of ['from', 'to']) group(`packing/${key}`, data.packing[key], { id: `${key} ID`, name: `${key} location`, bin: `${key} bin` });
    if (data.packing.status) group('packing/status', data.packing.status, { value: 'Source status (not delivery proof)' });
  }
  return fields;
}
