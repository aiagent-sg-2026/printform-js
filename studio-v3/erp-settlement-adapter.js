import { fail, has, object, text, choice, date, currency, jsonSafe, money, reference, metadata } from './erp-settlement-validation.js';

export const ERP_SETTLEMENT_PROFILE = 'erp-supplied-settlement-v1';
const allocationMoney = ['invoiceAppliedAmount', 'invoiceClearedAmount', 'invoiceBalanceBefore', 'invoiceRemainingBalance', 'cashAppliedAmount'];
const summaryMoney = ['cashAppliedAmount', 'invoiceClearedAmount', 'unappliedAmount', 'remainingBalance', 'fxDifference'];
const adjustmentKinds = ['bankFee', 'withholding', 'discount', 'fxGain', 'fxLoss', 'writeOff', 'other'];
const labels = {
  invoiceAppliedAmount: 'Invoice-currency applied', invoiceClearedAmount: 'Invoice cleared (ERP supplied)',
  invoiceBalanceBefore: 'Invoice balance before', invoiceRemainingBalance: 'Invoice remaining balance',
  cashAppliedAmount: 'Cash-currency applied', unappliedAmount: 'Unapplied advance / prepayment',
  remainingBalance: 'ERP remaining balance', fxDifference: 'ERP FX difference',
  bankFee: 'Bank fee', withholding: 'Withholding', discount: 'Settlement discount',
  fxGain: 'FX gain', fxLoss: 'FX loss', writeOff: 'Write-off', other: 'Other adjustment'
};

// Canonical facts only: no ERP connection, posting, allocation, tax or FX calculation.
export function normalizeErpSettlement(input) {
  jsonSafe(input);
  object(input, 'input', ['profile', 'source', 'document', 'company', 'party', 'cashMovement', 'allocations', 'adjustments', 'summary', 'bank', 'approval', 'notes']);
  if (input.profile !== ERP_SETTLEMENT_PROFILE) fail('PROFILE', 'profile', `Choose explicit ${ERP_SETTLEMENT_PROFILE}; ambiguous raw ERP amounts are not inferred.`);
  const source = metadata(input.source, 'source', ['system', 'documentType', 'id'], ['system', 'documentType', 'id']);
  object(input.document, 'document', ['kind', 'number', 'date', 'currency', 'reference', 'status']);
  const kind = choice(input.document.kind, ['BankReceipt', 'BankPayment'], 'document.kind');
  const document = { kind, number: text(input.document.number, 'document.number'), date: date(input.document.date, 'document.date'), currency: currency(input.document.currency, 'document.currency') };
  for (const key of ['reference', 'status']) if (has(input.document, key)) document[key] = text(input.document[key], `document.${key}`);
  const company = metadata(input.company, 'company', ['id', 'name', 'address', 'registration'], ['name']);
  const party = metadata(input.party, 'party', ['id', 'type', 'name', 'address'], ['id', 'type', 'name']);
  choice(party.type, kind === 'BankReceipt' ? ['customer'] : ['supplier'], 'party.type');
  object(input.cashMovement, 'cashMovement', ['direction', 'amount', 'sourceAmount']);
  const direction = choice(input.cashMovement.direction, kind === 'BankReceipt' ? ['inflow'] : ['outflow'], 'cashMovement.direction');
  const cashMovement = { direction, amount: money(input.cashMovement.amount, 'cashMovement.amount') };
  if (cashMovement.amount.currency !== document.currency) fail('CURRENCY', 'cashMovement.amount.currency', 'Document presentation currency must identify the cash movement currency.');
  if (has(input.cashMovement, 'sourceAmount')) cashMovement.sourceAmount = money(input.cashMovement.sourceAmount, 'cashMovement.sourceAmount');
  const rows = [], identities = new Set(), references = new Map();
  const unique = (id, path) => {
    text(id, path);
    if (identities.has(id)) fail('IDENTIFIER', path, 'Allocation and adjustment IDs must be unique.');
    identities.add(id);
  };
  const checkReference = (supplied, path) => {
    const ref = reference(supplied, path);
    if (has(ref, 'partyId') && ref.partyId !== party.id) fail('REFERENCE', `${path}.partyId`, 'Reference belongs to a different supplied party.');
    if (has(ref, 'companyId') && ref.companyId !== company.id) fail('REFERENCE', `${path}.companyId`, 'Reference company must match a supplied company ID.');
    const key = JSON.stringify([ref.system, ref.documentType, ref.id]), previous = references.get(key);
    if (previous) for (const [field, value] of Object.entries(ref)) {
      if (has(previous, field) && previous[field] !== value) fail('REFERENCE', `${path}.${field}`, 'Conflicting facts for the same source document.');
    }
    references.set(key, { ...previous, ...ref });
    return ref;
  };
  const append = (section, id, label, amount, sourcePath, ref, extra = {}) => rows.push({
    no: rows.length + 1, section, sourceId: id, sourcePath, label,
    reference: ref ? `${ref.documentType} · ${ref.number} · ${ref.id}` : '',
    ...(ref ? { sourceReference: structuredClone(ref) } : {}), ...extra,
    ...amount, displayAmount: amount.displayAmount
  });
  if (!Array.isArray(input.allocations)) fail('ROWS', 'allocations', 'Supply an array, including [] for a pure advance/prepayment.');
  const allocations = input.allocations.map((supplied, index) => {
    const path = `allocations[${index}]`;
    object(supplied, path, ['id', 'sourceReference', 'state', ...allocationMoney]);
    unique(supplied.id, `${path}.id`);
    const ref = checkReference(supplied.sourceReference, `${path}.sourceReference`);
    if (!has(ref, 'currency')) fail('CURRENCY', `${path}.sourceReference.currency`, 'Invoice reference currency is required.');
    const result = { id: supplied.id, sourceReference: ref };
    if (has(supplied, 'state')) result.state = choice(supplied.state, ['full', 'partial'], `${path}.state`);
    if (!has(supplied, 'invoiceAppliedAmount')) fail('AMOUNT', `${path}.invoiceAppliedAmount`, 'Supply the explicit invoice-currency applied amount.');
    for (const key of allocationMoney) if (has(supplied, key)) {
      const value = money(supplied[key], `${path}.${key}`);
      const expected = key === 'cashAppliedAmount' ? cashMovement.amount.currency : ref.currency;
      if (value.currency !== expected) fail('CURRENCY', `${path}.${key}.currency`, `Expected ${expected}; do not conflate invoice and cash currency amounts.`);
      result[key] = value;
      append('Invoice allocation', supplied.id, labels[key], value, `${path}.${key}`, ref, { metric: key, ...(result.state ? { state: result.state } : {}) });
    }
    if (result.state && result.invoiceRemainingBalance) {
      const zero = result.invoiceRemainingBalance.amountMinor === 0;
      if ((result.state === 'full') !== zero) fail('BALANCE', `${path}.state`, 'Supplied full/partial state conflicts with supplied invoice remaining balance.');
    }
    return result;
  });
  const allocationById = new Map(allocations.map(entry => [entry.id, entry]));
  const result = { profile: input.profile, source, document, company, party, cashMovement, allocations };
  if (has(input, 'adjustments')) {
    if (!Array.isArray(input.adjustments)) fail('ROWS', 'adjustments', 'Expected an array of supplied adjustments.');
    result.adjustments = input.adjustments.map((supplied, index) => {
      const path = `adjustments[${index}]`;
      object(supplied, path, ['id', 'kind', 'label', 'amount', 'affects', 'allocationId', 'sourceReference', 'account']);
      unique(supplied.id, `${path}.id`);
      const entry = { id: supplied.id, kind: choice(supplied.kind, adjustmentKinds, `${path}.kind`), label: text(supplied.label, `${path}.label`),
        affects: choice(supplied.affects, ['cash', 'invoice', 'ledger', 'unapplied'], `${path}.affects`), amount: money(supplied.amount, `${path}.amount`) };
      if (has(supplied, 'allocationId')) {
        if (!allocationById.has(supplied.allocationId)) fail('REFERENCE', `${path}.allocationId`, 'Unknown allocation ID.');
        entry.allocationId = supplied.allocationId;
      }
      if (has(supplied, 'sourceReference')) entry.sourceReference = checkReference(supplied.sourceReference, `${path}.sourceReference`);
      if (has(supplied, 'account')) entry.account = text(supplied.account, `${path}.account`);
      const linked = allocationById.get(entry.allocationId);
      if (entry.affects === 'invoice' && linked && entry.sourceReference
        && ['system', 'documentType', 'id'].some(key => entry.sourceReference[key] !== linked.sourceReference[key])) {
        fail('REFERENCE', `${path}.sourceReference`, 'Invoice adjustment reference conflicts with its linked allocation invoice.');
      }
      const expectedCurrency = ['cash', 'unapplied'].includes(entry.affects) ? cashMovement.amount.currency
        : entry.affects === 'invoice' ? (linked?.sourceReference.currency || entry.sourceReference?.currency) : undefined;
      if (entry.affects === 'invoice' && !expectedCurrency) fail('REFERENCE', path, 'Invoice adjustment requires an allocationId or an explicit currency-bearing invoice reference.');
      if (expectedCurrency && entry.amount.currency !== expectedCurrency) fail('CURRENCY', `${path}.amount.currency`, `Expected ${expectedCurrency} for the explicitly affected amount.`);
      const printReference = entry.sourceReference || linked?.sourceReference;
      append('ERP adjustment', supplied.id, `${labels[entry.kind]} · ${entry.label} · affects ${entry.affects}`, entry.amount, `${path}.amount`, printReference, { adjustmentKind: entry.kind, affects: entry.affects, ...(entry.allocationId ? { allocationId: entry.allocationId } : {}), ...(entry.account ? { account: entry.account } : {}) });
      return entry;
    });
  }
  if (has(input, 'summary')) {
    object(input.summary, 'summary', [...summaryMoney, 'balanceBasis']);
    result.summary = {};
    for (const key of summaryMoney) if (has(input.summary, key)) result.summary[key] = money(input.summary[key], `summary.${key}`);
    if (has(input.summary, 'remainingBalance')) result.summary.balanceBasis = text(input.summary.balanceBasis, 'summary.balanceBasis');
    else if (has(input.summary, 'balanceBasis')) fail('BALANCE', 'summary.balanceBasis', 'Balance basis requires its supplied remainingBalance.');
    for (const key of ['cashAppliedAmount', 'unappliedAmount']) if (result.summary[key] && result.summary[key].currency !== cashMovement.amount.currency) fail('CURRENCY', `summary.${key}.currency`, 'Expected the cash movement currency.');
  }
  if (!allocations.length && !result.summary?.unappliedAmount) fail('ADVANCE', 'summary.unappliedAmount', 'A pure advance/prepayment requires its ERP-supplied unapplied amount; it is not derived from cash.');
  if (has(input, 'bank')) result.bank = metadata(input.bank, 'bank', ['name', 'account', 'transactionReference', 'date', 'status', 'paymentMethod']);
  if (has(input, 'approval')) result.approval = metadata(input.approval, 'approval', ['status', 'approvedBy', 'date', 'reference']);
  if (has(input, 'notes')) result.notes = text(input.notes, 'notes');
  result.printRows = rows;
  result.printMode = allocations.length ? 'ERP supplied invoice settlement' : kind === 'BankReceipt' ? 'Unallocated customer advance' : 'Unallocated supplier prepayment';
  return result;
}

export const settlementSummaryLabels = Object.freeze(Object.fromEntries(summaryMoney.map(key => [key, labels[key]])));
