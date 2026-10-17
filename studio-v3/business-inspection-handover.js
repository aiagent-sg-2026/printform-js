import { object, text, metadata, provenance, has, rows, quantity, fail } from './business-facts-validation.js';

const trace = value => `${value.provenance.sourcePath}: ${value.provenance.meaning}`;
function sourced(value, path, names, required) {
  object(value, path, [...names, 'provenance']);
  const plain = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'provenance'));
  return { ...metadata(plain, path, names, required), provenance: provenance(value.provenance, `${path}.provenance`) };
}
function optionalQuantity(value, path) {
  const parsed = quantity(value, path);
  if (parsed.amount.trimStart().startsWith('-') && /[1-9]/.test(parsed.amount)) fail('QUANTITY', `${path}.amount`, 'Supply a nonnegative asset count; do not encode direction in its sign.');
  return parsed;
}
const quantityText = value => value ? `${value.amount} ${value.uom}` : '';
const quantityTrace = value => value ? `\n${trace(value)}; precision=${value.decimalPlaces}` : '';

export function normalizeInspection(value, add, unique) {
  object(value, 'inspection', ['reference', 'subject', 'status', 'checks']);
  const result = {
    reference: sourced(value.reference, 'inspection.reference', ['id', 'number'], ['id', 'number']),
    subject: sourced(value.subject, 'inspection.subject', ['id', 'name', 'lot', 'serialNumber'], ['id', 'name'])
  };
  if (has(value, 'status')) result.status = sourced(value.status, 'inspection.status', ['value'], ['value']);
  result.checks = rows(value.checks, 'inspection.checks', true).map((entry, i) => {
    const path = `inspection.checks[${i}]`;
    object(entry, path, ['id', 'characteristic', 'observed', 'expected', 'method', 'result', 'measure', 'provenance']);
    const parsed = { id: unique(entry.id, `${path}.id`), characteristic: text(entry.characteristic, `${path}.characteristic`),
      observed: text(entry.observed, `${path}.observed`), provenance: provenance(entry.provenance, `${path}.provenance`) };
    for (const key of ['expected', 'method', 'result']) if (has(entry, key)) parsed[key] = text(entry[key], `${path}.${key}`);
    // A signed measurement is legitimate; neither limits nor a pass/fail result is calculated.
    if (has(entry, 'measure')) parsed.measure = quantity(entry.measure, `${path}.measure`);
    const description = [`Observed: ${parsed.observed}`, ...['expected', 'method'].filter(key => has(parsed, key)).map(key => `${key}: ${parsed[key]}`)].join('\n');
    add(parsed.id, parsed.characteristic, description, quantityText(parsed.measure), parsed.result || '', `${parsed.id}\n${trace(parsed)}${quantityTrace(parsed.measure)}`);
    return parsed;
  });
  return result;
}

export function normalizeHandover(value, add, unique) {
  object(value, 'handover', ['record', 'from', 'to', 'status', 'assets']);
  const result = { record: sourced(value.record, 'handover.record', ['id', 'number', 'purpose'], ['id', 'number', 'purpose']) };
  for (const key of ['from', 'to']) result[key] = sourced(value[key], `handover.${key}`, ['id', 'name'], ['id', 'name']);
  if (has(value, 'status')) result.status = sourced(value.status, 'handover.status', ['value'], ['value']);
  result.assets = rows(value.assets, 'handover.assets', true).map((entry, i) => {
    const path = `handover.assets[${i}]`;
    object(entry, path, ['id', 'asset', 'condition', 'accessories', 'quantity', 'provenance']);
    const parsed = { id: unique(entry.id, `${path}.id`), asset: metadata(entry.asset, `${path}.asset`, ['id', 'name', 'serialNumber'], ['id', 'name']),
      condition: text(entry.condition, `${path}.condition`), provenance: provenance(entry.provenance, `${path}.provenance`) };
    if (has(entry, 'accessories')) parsed.accessories = text(entry.accessories, `${path}.accessories`);
    if (has(entry, 'quantity')) parsed.quantity = optionalQuantity(entry.quantity, `${path}.quantity`);
    const description = [parsed.asset.name, `Condition: ${parsed.condition}`, ...(parsed.asset.serialNumber ? [`Serial: ${parsed.asset.serialNumber}`] : []),
      ...(parsed.accessories ? [`Accessories: ${parsed.accessories}`] : [])].join('\n');
    add(parsed.id, parsed.asset.id, description, quantityText(parsed.quantity), '', `${parsed.id}\n${trace(parsed)}${quantityTrace(parsed.quantity)}`);
    return parsed;
  });
  return result;
}

export function inspectionHandoverFields(data, field) {
  const fields = [];
  const group = (base, value, names) => {
    for (const [key, label] of Object.entries(names)) if (has(value, key)) fields.push(field(`${base}/${key}`.replaceAll('/', '-').replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), label, `/${base}/${key}`));
    for (const [key, label] of [['sourcePath', 'Source path'], ['meaning', 'Source meaning']]) fields.push(field(`${base}/${key === 'sourcePath' ? 'source' : 'meaning'}`.replaceAll('/', '-'), label, `/${base}/provenance/${key}`));
  };
  if (data.inspection) {
    group('inspection/reference', data.inspection.reference, { id: 'Inspection ID', number: 'Inspection number' });
    group('inspection/subject', data.inspection.subject, { id: 'Subject ID', name: 'Subject', lot: 'Supplied lot', serialNumber: 'Supplied serial' });
    if (data.inspection.status) group('inspection/status', data.inspection.status, { value: 'Source status (not certification)' });
  }
  if (data.handover) {
    group('handover/record', data.handover.record, { id: 'Record ID', number: 'Record number', purpose: 'Supplied purpose' });
    for (const key of ['from', 'to']) group(`handover/${key}`, data.handover[key], { id: `${key} ID`, name: `${key} party / location` });
    if (data.handover.status) group('handover/status', data.handover.status, { value: 'Source status (not receipt)' });
  }
  return fields;
}
