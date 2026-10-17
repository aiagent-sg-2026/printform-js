import { fail, object, text, choice, date, metadata, reference, has, safe, rows, identitySet, money, quantity, period, stockLocation, stockTracking } from './business-facts-validation.js';
import { normalizeService, normalizePacking } from './business-service-logistics.js';
import { normalizeInspection, normalizeHandover } from './business-inspection-handover.js';

export const BUSINESS_DOCUMENT_PROFILE = 'supplied-business-v1';
export const BUSINESS_DOCUMENT_KINDS = Object.freeze(['AccountStatement', 'StockMovement', 'PayrollSlip', 'ServiceReport', 'PackingList', 'InspectionReport', 'AssetHandover']);

export function normalizeBusinessDocument(input) {
  safe(input);
  object(input, 'input', ['profile', 'source', 'document', 'company', 'statement', 'stock', 'payroll', 'service', 'packing', 'inspection', 'handover', 'notes']);
  if (input.profile !== BUSINESS_DOCUMENT_PROFILE) fail('PROFILE', 'profile', `Expected ${BUSINESS_DOCUMENT_PROFILE}.`);
  const source = reference(input.source, 'source');
  const company = metadata(input.company, 'company', ['id', 'name', 'address'], ['id', 'name']);
  object(input.document, 'document', ['kind', 'number', 'date', 'currency', 'status']);
  const kind = choice(input.document.kind, BUSINESS_DOCUMENT_KINDS, 'document.kind');
  const document = { kind, number: text(input.document.number, 'document.number'), date: date(input.document.date, 'document.date') };
  const nonfinancial = ['ServiceReport', 'PackingList', 'InspectionReport', 'AssetHandover'].includes(kind);
  if (nonfinancial && has(input.document, 'currency')) fail('FIELD', 'document.currency', 'These supplied facts are nonfinancial.');
  if (nonfinancial && has(source, 'currency')) fail('FIELD', 'source.currency', 'These supplied facts are nonfinancial.');
  if (nonfinancial && has(input.document, 'status')) fail('FIELD', 'document.status', 'Supply branch status with its source provenance instead.');
  if (!nonfinancial && (kind !== 'StockMovement' || has(input.document, 'currency'))) document.currency = choice(input.document.currency, ['MYR', 'USD', 'SGD', 'EUR', 'CNY', 'JPY'], 'document.currency');
  if (has(input.document, 'status')) document.status = text(input.document.status, 'document.status');
  const branch = { AccountStatement: 'statement', StockMovement: 'stock', PayrollSlip: 'payroll', ServiceReport: 'service', PackingList: 'packing', InspectionReport: 'inspection', AssetHandover: 'handover' }[kind];
  for (const key of ['statement', 'stock', 'payroll', 'service', 'packing', 'inspection', 'handover']) if (key !== branch && has(input, key)) fail('FIELD', key, `Only ${branch} facts belong to ${kind}.`);
  const result = { profile: input.profile, source, document, company }, printRows = [], unique = identitySet();
  const add = (id, section, description, amount, direction, trace) => printRows.push({ id, no: printRows.length + 1, section, description, amount, direction, trace });
  const traceMoney = amount => `${amount.provenance.sourcePath}: ${amount.provenance.meaning}; precision=${amount.minorUnitDigits}`;
  const fact = (entry, path, roles, extra = []) => {
    object(entry, path, ['id', 'label', 'role', 'basis', 'amount', ...extra]);
    return { id: unique(entry.id, `${path}.id`), label: text(entry.label, `${path}.label`), role: choice(entry.role, roles, `${path}.role`),
      basis: text(entry.basis, `${path}.basis`), amount: money(entry.amount, `${path}.amount`, document.currency) };
  };
  const summaries = (value, path, roles) => rows(value, path).map((entry, i) => {
    const parsed = fact(entry, `${path}[${i}]`, roles);
    add(parsed.id, 'Supplied summary', `${parsed.label}\n${parsed.basis}`, parsed.amount.displayAmount, parsed.role, traceMoney(parsed.amount));
    return parsed;
  });
  if (kind === 'AccountStatement') {
    const value = object(input.statement, 'statement', ['party', 'account', 'period', 'entries', 'balances']);
    const party = metadata(value.party, 'statement.party', ['id', 'name', 'role', 'address'], ['id', 'name', 'role']);
    choice(party.role, ['customer', 'supplier', 'other'], 'statement.party.role');
    const account = metadata(value.account, 'statement.account', ['id', 'name', 'basis', 'debitMeaning', 'creditMeaning'], ['id', 'name', 'basis', 'debitMeaning', 'creditMeaning']);
    choice(account.basis, ['receivable', 'payable', 'other'], 'statement.account.basis');
    const range = period(value.period, 'statement.period');
    const entries = rows(value.entries, 'statement.entries').map((entry, i) => {
      const path = `statement.entries[${i}]`;
      object(entry, path, ['id', 'date', 'reference', 'description', 'amounts', 'dueDate']);
      const parsed = { id: unique(entry.id, `${path}.id`), date: date(entry.date, `${path}.date`), reference: reference(entry.reference, `${path}.reference`), description: text(entry.description, `${path}.description`) };
      if (parsed.date < range.from || parsed.date > range.to) fail('PERIOD', `${path}.date`, 'Entry date must be inside the supplied statement period.');
      if (has(entry.reference, 'companyId') && entry.reference.companyId !== company.id) fail('REFERENCE', `${path}.reference.companyId`, 'Source company differs.');
      if (has(entry.reference, 'partyId') && entry.reference.partyId !== party.id) fail('REFERENCE', `${path}.reference.partyId`, 'Source party differs.');
      if (has(entry.reference, 'currency') && entry.reference.currency !== document.currency) fail('CURRENCY', `${path}.reference.currency`, 'This profile does not convert currencies.');
      if (has(entry, 'dueDate')) parsed.dueDate = date(entry.dueDate, `${path}.dueDate`);
      parsed.amounts = rows(entry.amounts, `${path}.amounts`, true).map((amount, j) => {
        const item = fact(amount, `${path}.amounts[${j}]`, ['debit', 'credit', 'balance']);
        add(item.id, `${parsed.date} · ${item.role}`, `${parsed.description}\n${item.label}: ${item.basis}${parsed.dueDate ? `\nDue: ${parsed.dueDate}` : ''}`, item.amount.displayAmount, item.role,
          `${parsed.id} · ${parsed.reference.system}/${parsed.reference.documentType}/${parsed.reference.id} (${parsed.reference.number})\n${traceMoney(item.amount)}`);
        return item;
      });
      return parsed;
    });
    result.statement = { party, account, period: range, entries };
    if (has(value, 'balances')) result.statement.balances = summaries(value.balances, 'statement.balances', ['openingBalance', 'closingBalance']);
    if (!entries.length && !result.statement.balances?.length) fail('ROWS', 'statement', 'An empty-period statement needs at least one supplied balance; do not invent zero.');
  }
  if (kind === 'StockMovement') {
    const value = object(input.stock, 'stock', ['purpose', 'lines']);
    result.stock = { purpose: text(value.purpose, 'stock.purpose'), lines: rows(value.lines, 'stock.lines', true).map((entry, i) => {
      const path = `stock.lines[${i}]`;
      object(entry, path, ['id', 'item', 'description', 'direction', 'quantity', 'from', 'to', 'batch', 'reference', 'tracking']);
      const parsed = { id: unique(entry.id, `${path}.id`), item: metadata(entry.item, `${path}.item`, ['id', 'code', 'name'], ['id']),
        description: text(entry.description, `${path}.description`), direction: choice(entry.direction, ['inflow', 'outflow', 'transfer'], `${path}.direction`), quantity: quantity(entry.quantity, `${path}.quantity`) };
      for (const key of ['from', 'to']) if (has(entry, key)) parsed[key] = stockLocation(entry[key], `${path}.${key}`);
      if (parsed.direction !== 'inflow' && !parsed.from) fail('LOCATION', `${path}.from`, 'Supply the source location explicitly.');
      if (parsed.direction !== 'outflow' && !parsed.to) fail('LOCATION', `${path}.to`, 'Supply the destination location explicitly.');
      if ((parsed.direction === 'inflow' && parsed.from) || (parsed.direction === 'outflow' && parsed.to)) fail('LOCATION', path, 'Use transfer when both source and destination locations are supplied.');
      if (parsed.direction === 'transfer' && parsed.from.id === parsed.to.id && parsed.from.bin === parsed.to.bin) fail('LOCATION', path, 'Transfer locations must differ.');
      if (has(entry, 'batch')) parsed.batch = text(entry.batch, `${path}.batch`);
      if (has(entry, 'reference')) parsed.reference = reference(entry.reference, `${path}.reference`);
      if (has(entry, 'tracking')) parsed.tracking = stockTracking(entry.tracking, `${path}.tracking`);
      const tracking = parsed.tracking;
      const trackingText = tracking ? `${tracking.lot ? `\nLot: ${tracking.lot}` : ''}${tracking.serialNumbers ? `\nSerials: ${tracking.serialNumbers.join(', ')}` : ''}${tracking.expiryDate ? `\nExpiry: ${tracking.expiryDate}` : ''}` : '';
      const locationTrace = ['from', 'to'].filter(key => parsed[key]?.provenance).map(key => `\n${key}: ${parsed[key].provenance.sourcePath}: ${parsed[key].provenance.meaning}`).join('');
      const location = key => parsed[key] ? `${parsed[key].id}${parsed[key].name ? ` (${parsed[key].name})` : ''}${parsed[key].bin ? ` / ${parsed[key].bin}` : ''}` : '';
      add(parsed.id, parsed.item.code || parsed.item.id, `${parsed.description}${parsed.item.name ? `\n${parsed.item.name}` : ''}${parsed.batch ? `\nBatch: ${parsed.batch}` : ''}${trackingText}`,
        `${parsed.quantity.amount} ${parsed.quantity.uom}`, `${parsed.direction}\n${location('from')}${parsed.from && parsed.to ? ' → ' : ''}${location('to')}`,
        `${parsed.id} · ${parsed.item.id}\n${parsed.quantity.provenance.sourcePath}: ${parsed.quantity.provenance.meaning}; precision=${parsed.quantity.decimalPlaces}${parsed.reference ? `\n${parsed.reference.system}/${parsed.reference.documentType}/${parsed.reference.id} (${parsed.reference.number})` : ''}${tracking ? `\n${tracking.provenance.sourcePath}: ${tracking.provenance.meaning}` : ''}${locationTrace}`);
      return parsed;
    }) };
  }
  if (kind === 'PayrollSlip') {
    const value = object(input.payroll, 'payroll', ['employee', 'period', 'payDate', 'components', 'summary']);
    const employee = metadata(value.employee, 'payroll.employee', ['id', 'name', 'department', 'jobTitle'], ['id', 'name']);
    const range = period(value.period, 'payroll.period');
    result.payroll = { employee, period: range, components: rows(value.components, 'payroll.components', true).map((entry, i) => {
      const path = `payroll.components[${i}]`, parsed = fact(entry, path, ['earning', 'deduction', 'employerContribution'], ['hours', 'hourlyRate']);
      if (has(entry, 'hours')) {
        parsed.hours = quantity(entry.hours, `${path}.hours`);
        choice(parsed.hours.uom, ['hour'], `${path}.hours.uom`);
      }
      if (has(entry, 'hourlyRate')) parsed.hourlyRate = money(entry.hourlyRate, `${path}.hourlyRate`, document.currency);
      const hourText = parsed.hours ? `\nHours: ${parsed.hours.amount} ${parsed.hours.uom}` : '';
      const rateText = parsed.hourlyRate ? `\nHourly rate: ${parsed.hourlyRate.displayAmount} / hour` : '';
      const hourTrace = parsed.hours ? `\n${parsed.hours.provenance.sourcePath}: ${parsed.hours.provenance.meaning}; precision=${parsed.hours.decimalPlaces}` : '';
      add(parsed.id, parsed.role, `${parsed.label}\n${parsed.basis}${hourText}${rateText}`, parsed.amount.displayAmount, parsed.role,
        `${parsed.id}\n${traceMoney(parsed.amount)}${hourTrace}${parsed.hourlyRate ? `\n${traceMoney(parsed.hourlyRate)}` : ''}`);
      return parsed;
    }) };
    if (has(value, 'payDate')) result.payroll.payDate = date(value.payDate, 'payroll.payDate');
    if (has(value, 'summary')) result.payroll.summary = summaries(value.summary, 'payroll.summary', ['gross', 'deductions', 'netPay', 'employerContributions']);
  }
  if (kind === 'ServiceReport') result.service = normalizeService(input.service, add, unique);
  if (kind === 'PackingList') result.packing = normalizePacking(input.packing, add, unique);
  if (kind === 'InspectionReport') result.inspection = normalizeInspection(input.inspection, add, unique);
  if (kind === 'AssetHandover') result.handover = normalizeHandover(input.handover, add, unique);
  if (has(input, 'notes')) result.notes = text(input.notes, 'notes');
  result.printRows = printRows;
  return result;
}
