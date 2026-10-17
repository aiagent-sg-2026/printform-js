import { object, text, metadata, provenance, quantity, period, date, rows, has, choice, fail } from './business-facts-validation.js';

const trace = value => `${value.provenance.sourcePath}: ${value.provenance.meaning}`;
const sourced = (value, path, keys, required = keys) => {
  object(value, path, [...keys, 'provenance']);
  const facts = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'provenance'));
  return { ...metadata(facts, path, keys, required), provenance: provenance(value.provenance, `${path}.provenance`) };
};
const status = (value, path) => sourced(value, path, ['value']);
const measure = (value, path) => {
  const result = quantity(value, path);
  if (result.amount.trimStart().startsWith('-') && /[1-9]/.test(result.amount)) fail('QUANTITY', `${path}.amount`, 'Supply nonnegative quantity or hours; signed zero spelling is retained.');
  return result;
};
const measureTrace = value => `${trace(value)}; precision=${value.decimalPlaces}`;

// Supplied manufacturing snapshots, not native ERP ingestion, inventory movement or posting.
export function normalizeManufacturing(value, add, unique) {
  object(value, 'manufacturing', ['order', 'product', 'quantity', 'status', 'lines']);
  const result = {
    order: sourced(value.order, 'manufacturing.order', ['id', 'number', 'bom'], ['id', 'number']),
    product: sourced(value.product, 'manufacturing.product', ['id', 'code', 'name'], ['id', 'name']),
    quantity: measure(value.quantity, 'manufacturing.quantity')
  };
  if (has(value, 'status')) result.status = status(value.status, 'manufacturing.status');
  add('manufacturing:order', 'Order quantity', `${result.product.name}\n${result.product.code || result.product.id}`, `${result.quantity.amount} ${result.quantity.uom}`, 'Supplied order quantity',
    `${result.order.id} · ${result.product.id}\n${measureTrace(result.quantity)}`);
  result.lines = rows(value.lines, 'manufacturing.lines', true).map((entry, i) => {
    const path = `manufacturing.lines[${i}]`;
    object(entry, path, ['id', 'item', 'description', 'role', 'quantity', 'status', 'provenance']);
    const parsed = { id: unique(entry.id, `${path}.id`), item: metadata(entry.item, `${path}.item`, ['id', 'code', 'name'], ['id', 'name']),
      description: text(entry.description, `${path}.description`), role: choice(entry.role, ['required', 'transferred', 'consumed', 'produced'], `${path}.role`),
      quantity: measure(entry.quantity, `${path}.quantity`), provenance: provenance(entry.provenance, `${path}.provenance`) };
    if (has(entry, 'status')) parsed.status = status(entry.status, `${path}.status`);
    add(`manufacturing:line:${i + 1}`, parsed.item.code || parsed.item.id, `${parsed.description}\n${parsed.item.name}`, `${parsed.quantity.amount} ${parsed.quantity.uom}`,
      `${parsed.role}${parsed.status ? `\nSource status: ${parsed.status.value}` : ''}`,
      `${parsed.id} · ${parsed.item.id}\n${trace(parsed)}\n${measureTrace(parsed.quantity)}${parsed.status ? `\n${trace(parsed.status)}` : ''}`);
    return parsed;
  });
  return result;
}

export function normalizeTimesheet(value, add, unique) {
  object(value, 'timesheet', ['employee', 'period', 'status', 'entries']);
  const result = { employee: sourced(value.employee, 'timesheet.employee', ['id', 'name', 'department'], ['id', 'name']), period: period(value.period, 'timesheet.period') };
  if (has(value, 'status')) result.status = status(value.status, 'timesheet.status');
  result.entries = rows(value.entries, 'timesheet.entries', true).map((entry, i) => {
    const path = `timesheet.entries[${i}]`;
    object(entry, path, ['id', 'date', 'activity', 'description', 'project', 'task', 'hours', 'status', 'provenance']);
    const parsed = { id: unique(entry.id, `${path}.id`), date: date(entry.date, `${path}.date`), activity: text(entry.activity, `${path}.activity`),
      description: text(entry.description, `${path}.description`), hours: measure(entry.hours, `${path}.hours`), provenance: provenance(entry.provenance, `${path}.provenance`) };
    choice(parsed.hours.uom, ['hour'], `${path}.hours.uom`);
    if (parsed.date < result.period.from || parsed.date > result.period.to) fail('PERIOD', `${path}.date`, 'Entry date must be inside the supplied period.');
    for (const key of ['project', 'task']) if (has(entry, key)) parsed[key] = sourced(entry[key], `${path}.${key}`, ['id', 'name']);
    if (has(entry, 'status')) parsed.status = status(entry.status, `${path}.status`);
    add(`timesheet:entry:${i + 1}`, `${parsed.date} · ${parsed.activity}`,
      `${parsed.description}${parsed.project ? `\nProject: ${parsed.project.id} · ${parsed.project.name}` : ''}${parsed.task ? `\nTask: ${parsed.task.id} · ${parsed.task.name}` : ''}`,
      `${parsed.hours.amount} ${parsed.hours.uom}`, parsed.status ? `Source status: ${parsed.status.value}` : '',
      `${parsed.id}\n${trace(parsed)}\n${measureTrace(parsed.hours)}${['project', 'task', 'status'].filter(key => parsed[key]).map(key => `\n${key}: ${trace(parsed[key])}`).join('')}`);
    return parsed;
  });
  return result;
}

export function manufacturingTimesheetFields(data, field) {
  const fields = [];
  const group = (base, value, names, sourcedValue = true) => {
    for (const [key, label] of Object.entries(names)) if (has(value, key)) fields.push(field(`${base}-${key}`.replaceAll('/', '-').replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), label, `/${base}/${key}`));
    if (sourcedValue) fields.push(field(`${base}-source`.replaceAll('/', '-'), 'Source path', `/${base}/provenance/sourcePath`), field(`${base}-meaning`.replaceAll('/', '-'), 'Source meaning', `/${base}/provenance/meaning`));
  };
  if (data.manufacturing) {
    group('manufacturing/order', data.manufacturing.order, { id: 'Order source ID', number: 'Order number', bom: 'Supplied BOM reference' });
    group('manufacturing/product', data.manufacturing.product, { id: 'Product ID', code: 'Product code', name: 'Product' });
    if (data.manufacturing.status) group('manufacturing/status', data.manufacturing.status, { value: 'Source status (not production proof)' });
  }
  if (data.timesheet) {
    group('timesheet/employee', data.timesheet.employee, { id: 'Employee source ID', name: 'Employee', department: 'Department' });
    group('timesheet/period', data.timesheet.period, { from: 'Period from', to: 'Period to' }, false);
    if (data.timesheet.status) group('timesheet/status', data.timesheet.status, { value: 'Source status (not approval)' });
  }
  return fields;
}
