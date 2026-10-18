import { object, metadata, provenance, quantity, rows, has, text, date, choice, fail } from './business-facts-validation.js';

const trace = value => `${value.provenance.sourcePath}: ${value.provenance.meaning}`;
const sourced = (value, path, keys, required = keys) => {
  object(value, path, [...keys, 'provenance']);
  const facts = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'provenance'));
  return { ...metadata(facts, path, keys, required), provenance: provenance(value.provenance, `${path}.provenance`) };
};
const status = (value, path) => sourced(value, path, ['value']);
const measure = (value, path) => {
  const result = quantity(value, path);
  if (result.amount.trimStart().startsWith('-') && /[1-9]/.test(result.amount)) fail('QUANTITY', `${path}.amount`, 'Supply nonnegative quantity; signed zero spelling is retained.');
  return result;
};
const measureTrace = value => `${trace(value)}; precision=${value.decimalPlaces}`;

export function normalizeRequisition(value, add, unique) {
  object(value, 'requisition', ['request', 'purpose', 'requester', 'requiredBy', 'status', 'lines']);
  const result = { request: sourced(value.request, 'requisition.request', ['id', 'number']), purpose: status(value.purpose, 'requisition.purpose') };
  choice(result.purpose.value, ['Purchase'], 'requisition.purpose.value');
  if (has(value, 'requester')) result.requester = sourced(value.requester, 'requisition.requester', ['id', 'name', 'department'], ['id', 'name']);
  if (has(value, 'requiredBy')) result.requiredBy = date(value.requiredBy, 'requisition.requiredBy');
  if (has(value, 'status')) result.status = status(value.status, 'requisition.status');
  result.lines = rows(value.lines, 'requisition.lines', true).map((entry, i) => {
    const path = `requisition.lines[${i}]`;
    object(entry, path, ['id', 'item', 'description', 'quantity', 'requiredBy', 'destination', 'project', 'status', 'provenance']);
    const parsed = { id: unique(entry.id, `${path}.id`), item: metadata(entry.item, `${path}.item`, ['id', 'code', 'name'], ['id', 'name']),
      description: text(entry.description, `${path}.description`), quantity: measure(entry.quantity, `${path}.quantity`), provenance: provenance(entry.provenance, `${path}.provenance`) };
    if (has(entry, 'requiredBy')) parsed.requiredBy = date(entry.requiredBy, `${path}.requiredBy`);
    for (const key of ['destination', 'project']) if (has(entry, key)) parsed[key] = sourced(entry[key], `${path}.${key}`, ['id', 'name'], ['id']);
    if (has(entry, 'status')) parsed.status = status(entry.status, `${path}.status`);
    add(`requisition:line:${i + 1}`, parsed.item.code || parsed.item.id, `${parsed.description}\n${parsed.item.name}${parsed.requiredBy ? `\nRequired by: ${parsed.requiredBy}` : ''}${['destination', 'project'].filter(key => parsed[key]).map(key => `\n${key}: ${parsed[key].id}${parsed[key].name ? ` · ${parsed[key].name}` : ''}`).join('')}`,
      `${parsed.quantity.amount} ${parsed.quantity.uom}`, `Requested${parsed.status ? `\nSource status: ${parsed.status.value}` : ''}`,
      `${parsed.id} · ${parsed.item.id}\n${trace(parsed)}\n${measureTrace(parsed.quantity)}${['destination', 'project', 'status'].filter(key => parsed[key]).map(key => `\n${key}: ${trace(parsed[key])}`).join('')}`);
    return parsed;
  });
  return result;
}

export function normalizeMaintenance(value, add, unique) {
  object(value, 'maintenance', ['order', 'asset', 'scheduledDate', 'status', 'tasks']);
  const result = { order: sourced(value.order, 'maintenance.order', ['id', 'number']),
    asset: sourced(value.asset, 'maintenance.asset', ['id', 'name', 'code', 'serialNumber', 'location'], ['id', 'name']) };
  if (has(value, 'scheduledDate')) result.scheduledDate = date(value.scheduledDate, 'maintenance.scheduledDate');
  if (has(value, 'status')) result.status = status(value.status, 'maintenance.status');
  result.tasks = rows(value.tasks, 'maintenance.tasks', true).map((entry, i) => {
    const path = `maintenance.tasks[${i}]`;
    object(entry, path, ['id', 'description', 'instruction', 'quantity', 'status', 'provenance']);
    const parsed = { id: unique(entry.id, `${path}.id`), description: text(entry.description, `${path}.description`), provenance: provenance(entry.provenance, `${path}.provenance`) };
    if (has(entry, 'instruction')) parsed.instruction = text(entry.instruction, `${path}.instruction`);
    if (has(entry, 'quantity')) parsed.quantity = measure(entry.quantity, `${path}.quantity`);
    if (has(entry, 'status')) parsed.status = status(entry.status, `${path}.status`);
    add(`maintenance:task:${i + 1}`, 'Maintenance task', `${parsed.description}${parsed.instruction ? `\nInstruction: ${parsed.instruction}` : ''}`,
      parsed.quantity ? `${parsed.quantity.amount} ${parsed.quantity.uom}` : '', parsed.status ? `Source status: ${parsed.status.value}` : '',
      `${parsed.id}\n${trace(parsed)}${parsed.quantity ? `\n${measureTrace(parsed.quantity)}` : ''}${parsed.status ? `\n${trace(parsed.status)}` : ''}`);
    return parsed;
  });
  return result;
}

export function requisitionMaintenanceFields(data, field) {
  const fields = [];
  const group = (base, value, names) => {
    for (const [key, label] of Object.entries(names)) if (has(value, key)) fields.push(field(`${base}-${key}`.replaceAll('/', '-').replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), label, `/${base}/${key}`));
    fields.push(field(`${base}-source`.replaceAll('/', '-'), 'Source path', `/${base}/provenance/sourcePath`), field(`${base}-meaning`.replaceAll('/', '-'), 'Source meaning', `/${base}/provenance/meaning`));
  };
  if (data.requisition) {
    group('requisition/request', data.requisition.request, { id: 'Request source ID', number: 'Request number' });
    group('requisition/purpose', data.requisition.purpose, { value: 'Supplied purpose' });
    if (data.requisition.requester) group('requisition/requester', data.requisition.requester, { id: 'Requester ID', name: 'Requester', department: 'Department' });
    if (data.requisition.requiredBy) fields.push(field('requisition-required-by', 'Required by', '/requisition/requiredBy'));
    if (data.requisition.status) group('requisition/status', data.requisition.status, { value: 'Source status (not approval)' });
  }
  if (data.maintenance) {
    group('maintenance/order', data.maintenance.order, { id: 'Work order source ID', number: 'Work order number' });
    group('maintenance/asset', data.maintenance.asset, { id: 'Asset ID', name: 'Asset', code: 'Asset code', serialNumber: 'Serial number', location: 'Asset location' });
    if (data.maintenance.scheduledDate) fields.push(field('maintenance-scheduled-date', 'Scheduled date', '/maintenance/scheduledDate'));
    if (data.maintenance.status) group('maintenance/status', data.maintenance.status, { value: 'Source status (not work execution proof)' });
  }
  return fields;
}
