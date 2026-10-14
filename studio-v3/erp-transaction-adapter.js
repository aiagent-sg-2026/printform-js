import { fail, has, object, text, choice, date, currency, jsonSafe, money, quantity, reference, metadata, provenance, array, identities, effect } from './erp-transaction-validation.js';
import { transactionPrintRows } from './erp-transaction-rows.js';

export const ERP_TRANSACTION_PROFILE = 'erp-supplied-transaction-v1';
export const ERP_TRANSACTION_KINDS = Object.freeze(['PurchaseReceipt', 'PurchaseReturn', 'SalesReturn', 'CreditNote', 'DebitNote', 'Refund']);
const inventoryKinds = ['PurchaseReceipt', 'PurchaseReturn', 'SalesReturn'];
const noteKinds = ['CreditNote', 'DebitNote'];

// Portable read-only ERP facts, never raw ERP database mapping or accounting/stock execution.
export function normalizeErpTransaction(input) {
  jsonSafe(input);
  object(input, 'input', ['profile', 'source', 'document', 'company', 'party', 'references', 'scope', 'effects', 'lines', 'taxes', 'summary', 'cashMovement', 'allocations', 'bank', 'approval', 'notes']);
  if (input.profile !== ERP_TRANSACTION_PROFILE) fail('PROFILE', 'profile', `Supply explicit ${ERP_TRANSACTION_PROFILE}; raw ERP meanings are not inferred.`);
  const source = metadata(input.source, 'source', ['system', 'documentType', 'id'], ['system', 'documentType', 'id']);
  object(input.document, 'document', ['kind', 'number', 'date', 'currency', 'status', 'reference']);
  const kind = choice(input.document.kind, ERP_TRANSACTION_KINDS, 'document.kind');
  const document = { kind, number: text(input.document.number, 'document.number'), date: date(input.document.date, 'document.date'), currency: currency(input.document.currency, 'document.currency') };
  for (const key of ['status', 'reference']) if (has(input.document, key)) document[key] = text(input.document[key], `document.${key}`);
  const company = metadata(input.company, 'company', ['id', 'name', 'address', 'registration'], ['id', 'name']);
  const party = metadata(input.party, 'party', ['id', 'type', 'name', 'address'], ['id', 'type', 'name']);
  choice(party.type, ['PurchaseReceipt', 'PurchaseReturn'].includes(kind) ? ['supplier'] : kind === 'SalesReturn' ? ['customer'] : ['customer', 'supplier'], 'party.type');
  const unique = identities(), refs = new Map(), sourceFacts = new Map();
  const references = array(input.references, 'references').map((entry, index) => {
    const path = `references[${index}]`;
    object(entry, path, ['id', 'role', 'document', 'provenance']);
    const id = unique(entry.id, `${path}.id`), ref = reference(entry.document, `${path}.document`);
    for (const [field, expected] of [['companyId', company.id], ['partyId', party.id]]) {
      if (has(ref, field) && ref[field] !== expected) fail('REFERENCE', `${path}.document.${field}`, 'Reference identity differs from the supplied transaction identity.');
    }
    const key = JSON.stringify([ref.system, ref.documentType, ref.id]);
    if (key === JSON.stringify([source.system, source.documentType, source.id])) fail('REFERENCE', `${path}.document`, 'An original or linked source must not be the current document itself.');
    const previous = sourceFacts.get(key);
    if (previous) for (const [field, value] of Object.entries(ref)) {
      if (has(previous, field) && previous[field] !== value) fail('REFERENCE', `${path}.document.${field}`, 'Conflicting facts for the same linked source document.');
    }
    sourceFacts.set(key, { ...previous, ...ref });
    const result = { id, role: choice(entry.role, ['original', 'order', 'related-adjustment', 'refund-basis', 'payment'], `${path}.role`), document: ref, provenance: provenance(entry.provenance, `${path}.provenance`) };
    refs.set(id, result);
    return result;
  });
  const linked = (id, path, roles) => {
    text(id, path);
    const ref = refs.get(id);
    if (!ref || (roles && !roles.includes(ref.role))) fail('REFERENCE', path, 'Supply an existing reference ID with the required business role.');
    return ref;
  };
  if (kind !== 'PurchaseReceipt' && !references.some(ref => ref.role === (kind === 'Refund' ? 'refund-basis' : 'original'))) {
    fail('REFERENCE', 'references', 'Returns and notes require an original document; cash refunds require a refund-basis document. Unlinked adjustments are outside this profile.');
  }
  object(input.scope, 'scope', ['extent', 'reason', 'provenance']);
  const scope = { extent: choice(input.scope.extent, ['full', 'partial'], 'scope.extent'), reason: text(input.scope.reason, 'scope.reason'), provenance: provenance(input.scope.provenance, 'scope.provenance') };
  object(input.effects, 'effects', ['inventory', 'accounting']);
  const expectedStock = kind === 'PurchaseReturn' || (noteKinds.includes(kind) && party.type === 'supplier') ? 'outflow' : 'inflow';
  const inventory = effect(input.effects.inventory, 'effects.inventory', kind === 'SalesReturn' ? ['none', 'inflow'] : inventoryKinds.includes(kind) ? [expectedStock] : kind === 'Refund' ? ['none'] : ['none', expectedStock]);
  const accounting = effect(input.effects.accounting, 'effects.accounting', kind === 'SalesReturn' ? ['none', 'decrease'] : noteKinds.includes(kind) ? ['increase', 'decrease'] : ['none'], kind === 'SalesReturn' ? ['none', 'receivable'] : noteKinds.includes(kind) ? [party.type === 'customer' ? 'receivable' : 'payable'] : ['none']);
  if (kind === 'SalesReturn') {
    if (accounting.basis !== (accounting.direction === 'none' ? 'none' : 'receivable')) fail('SEMANTICS', 'effects.accounting.basis', 'Sales returns declare either stock-only none accounting or an explicit receivable decrease.');
    if (inventory.direction === 'none' && accounting.direction === 'none') fail('SEMANTICS', 'effects', 'A sales return must declare stock returned or receivable reduced; a no-effect document is not a return.');
  }
  if (kind === 'CreditNote' && accounting.direction !== 'decrease') fail('SEMANTICS', 'effects.accounting.direction', 'A credit note reduces the explicitly identified receivable or payable.');
  if (kind === 'DebitNote' && party.type === 'customer' && accounting.direction !== 'increase') fail('SEMANTICS', 'effects.accounting.direction', 'Customer debit notes increase receivable. Supplier debit direction must be explicitly mapped for ERPNext versus Odoo.');
  const result = { profile: input.profile, source, document, company, party, references, scope, effects: { inventory, accounting } };
  const monetaryFacts = (supplied, path, roles, expectedCurrency) => array(supplied, path).map((entry, index) => {
    const itemPath = `${path}[${index}]`;
    object(entry, itemPath, ['id', 'label', 'role', 'amount', 'sourceReferenceId', 'basis']);
    const fact = { id: unique(entry.id, `${itemPath}.id`), label: text(entry.label, `${itemPath}.label`), role: choice(entry.role, roles, `${itemPath}.role`), amount: money(entry.amount, `${itemPath}.amount`) };
    if (expectedCurrency && fact.role !== 'baseAmount' && fact.amount.currency !== expectedCurrency) fail('CURRENCY', `${itemPath}.amount.currency`, 'Document monetary facts use document currency; only explicitly identified baseAmount facts use another currency.');
    if (has(entry, 'sourceReferenceId')) {
      linked(entry.sourceReferenceId, `${itemPath}.sourceReferenceId`);
      fact.sourceReferenceId = entry.sourceReferenceId;
    }
    if (has(entry, 'basis')) fact.basis = text(entry.basis, `${itemPath}.basis`);
    if (fact.role === 'baseAmount' && !fact.basis) fail('SEMANTICS', `${itemPath}.basis`, 'A supplied base-currency value requires its explicit valuation/conversion meaning; no FX is calculated.');
    return fact;
  });
  if (kind === 'Refund') {
    for (const key of ['lines', 'taxes', 'summary']) if (has(input, key)) fail('FIELD', key, 'A cash refund is not an inventory/tax invoice; use separate linked note documents.');
    object(input.cashMovement, 'cashMovement', ['direction', 'amount', 'sourceAmount']);
    const direction = choice(input.cashMovement.direction, [party.type === 'customer' ? 'outflow' : 'inflow'], 'cashMovement.direction');
    const amount = money(input.cashMovement.amount, 'cashMovement.amount');
    if (amount.currency !== document.currency) fail('CURRENCY', 'cashMovement.amount.currency', 'Document currency must identify the actual cash movement.');
    if (amount.direction !== direction) fail('SEMANTICS', 'cashMovement.amount.direction', 'Cash monetary direction must match the explicit movement.');
    result.cashMovement = { direction, amount };
    if (has(input.cashMovement, 'sourceAmount')) {
      result.cashMovement.sourceAmount = money(input.cashMovement.sourceAmount, 'cashMovement.sourceAmount');
      if (result.cashMovement.sourceAmount.direction !== direction) fail('SEMANTICS', 'cashMovement.sourceAmount.direction', 'Source cash direction must match the movement.');
    }
    result.allocations = array(input.allocations, 'allocations', true).map((entry, index) => {
      const path = `allocations[${index}]`;
      object(entry, path, ['id', 'sourceReferenceId', 'amount', 'cashAppliedAmount', 'remainingAmount', 'state']);
      const ref = linked(entry.sourceReferenceId, `${path}.sourceReferenceId`, ['refund-basis']);
      if (!ref.document.currency) fail('CURRENCY', `${path}.sourceReferenceId`, 'Refund basis reference must identify its currency.');
      const allocation = { id: unique(entry.id, `${path}.id`), sourceReferenceId: entry.sourceReferenceId, amount: money(entry.amount, `${path}.amount`) };
      if (allocation.amount.currency !== ref.document.currency) fail('CURRENCY', `${path}.amount.currency`, 'Refund-basis allocation uses the referenced currency, not guessed cash currency.');
      if (allocation.amount.direction !== direction) fail('SEMANTICS', `${path}.amount.direction`, 'Refund allocation direction must match the cash movement.');
      for (const key of ['cashAppliedAmount', 'remainingAmount']) if (has(entry, key)) {
        allocation[key] = money(entry[key], `${path}.${key}`);
        if (allocation[key].currency !== (key === 'cashAppliedAmount' ? amount.currency : ref.document.currency)) fail('CURRENCY', `${path}.${key}.currency`, 'Use the explicitly affected currency.');
        if (allocation[key].direction !== (key === 'cashAppliedAmount' ? direction : 'balance')) fail('SEMANTICS', `${path}.${key}.direction`, 'Cash allocation follows movement; remaining amount is a balance.');
      }
      if (has(entry, 'state')) {
        allocation.state = choice(entry.state, ['full', 'partial'], `${path}.state`);
        if (allocation.remainingAmount && (allocation.state === 'full') !== (allocation.remainingAmount.amountMinor === 0)) fail('BALANCE', `${path}.state`, 'Supplied allocation extent conflicts with supplied remaining balance.');
      }
      return allocation;
    });
    if (has(input, 'bank')) result.bank = metadata(input.bank, 'bank', ['name', 'account', 'transactionReference', 'date', 'status', 'paymentMethod']);
  } else {
    for (const key of ['cashMovement', 'allocations', 'bank']) if (has(input, key)) fail('FIELD', key, 'Inventory returns and notes do not imply a cash refund; supply a separate Refund document.');
    result.lines = array(input.lines, 'lines', true).map((entry, index) => {
      const path = `lines[${index}]`;
      object(entry, path, ['id', 'description', 'item', 'sourceReferenceId', 'sourceLineId', 'quantities', 'amounts']);
      const line = { id: unique(entry.id, `${path}.id`), description: text(entry.description, `${path}.description`) };
      if (has(entry, 'item')) line.item = metadata(entry.item, `${path}.item`, ['id', 'code', 'name'], ['id']);
      if (kind !== 'PurchaseReceipt' || has(entry, 'sourceReferenceId')) {
        linked(entry.sourceReferenceId, `${path}.sourceReferenceId`, kind === 'PurchaseReceipt' ? ['order'] : ['original']);
        line.sourceReferenceId = entry.sourceReferenceId;
      }
      if (has(entry, 'sourceLineId')) {
        if (!line.sourceReferenceId) fail('REFERENCE', `${path}.sourceLineId`, 'An original line identity requires its linked document identity.');
        line.sourceLineId = text(entry.sourceLineId, `${path}.sourceLineId`);
      }
      line.quantities = array(entry.quantities, `${path}.quantities`).map((value, i) => quantity(value, `${path}.quantities[${i}]`));
      const roles = new Set();
      line.quantities.forEach((value, i) => {
        const qpath = `${path}.quantities[${i}]`;
        if (roles.has(value.role)) fail('IDENTIFIER', `${qpath}.role`, 'Each quantity role is unique within a source line.');
        roles.add(value.role);
        const allowed = kind === 'PurchaseReceipt' ? ['received', 'accepted', 'rejected'] : inventory.direction === 'none' ? ['billed'] : ['returned', 'billed'];
        choice(value.role, allowed, `${qpath}.role`);
        if (value.direction !== (value.role === 'billed' ? 'none' : inventory.direction)) fail('SEMANTICS', `${qpath}.direction`, 'Quantity direction must identify the actual inventory effect; billed quantity is not stock movement.');
      });
      if (inventory.direction !== 'none') {
        if (!line.item) fail('ITEM', `${path}.item`, 'A stock fact requires explicit source item identity.');
        if (!roles.has(kind === 'PurchaseReceipt' ? 'accepted' : 'returned')) fail('QUANTITY', `${path}.quantities`, 'Supply the accepted or returned quantity; never infer it from billed quantity or money.');
        if (kind !== 'PurchaseReceipt' && !line.sourceLineId) fail('REFERENCE', `${path}.sourceLineId`, 'Linked stock returns require the original ERP line identity.');
      }
      line.amounts = monetaryFacts(entry.amounts, `${path}.amounts`, ['unitRate', 'netAmount', 'valuationAmount', 'baseAmount'], document.currency);
      line.amounts.forEach((fact, i) => {
        const direction = fact.role === 'unitRate' || fact.role === 'valuationAmount' ? 'valuation'
          : fact.role === 'netAmount' ? (noteKinds.includes(kind) || (kind === 'SalesReturn' && accounting.direction === 'decrease') ? accounting.direction : 'valuation') : undefined;
        if (direction && fact.amount.direction !== direction) fail('SEMANTICS', `${path}.amounts[${i}].amount.direction`, 'Unit rates and valuations are not cash; net amount follows the explicit accounting effect or inventory valuation.');
      });
      if (!line.quantities.length && !line.amounts.length) fail('ROWS', path, 'A line must contain a supplied quantity or monetary fact, not a title-only placeholder.');
      if ((noteKinds.includes(kind) || (kind === 'SalesReturn' && accounting.direction === 'decrease')) && !line.amounts.some(fact => fact.role === 'netAmount')) fail('AMOUNT', `${path}.amounts`, 'An accounting adjustment line requires an explicit netAmount, not only a unit rate or title.');
      return line;
    });
    if (has(input, 'taxes')) {
      result.taxes = monetaryFacts(input.taxes, 'taxes', ['tax', 'charge', 'baseAmount'], document.currency);
      result.taxes.forEach((entry, i) => { if (!entry.basis) fail('TEXT', `taxes[${i}].basis`, 'Supply tax/charge meaning, not an inferred rate or total.'); });
    }
    if (has(input, 'summary')) {
      result.summary = monetaryFacts(input.summary, 'summary', ['subtotal', 'taxTotal', 'grandTotal', 'rounding', 'remainingBalance', 'baseAmount'], document.currency);
      result.summary.forEach((fact, index) => {
        if (fact.role === 'remainingBalance' && (fact.amount.direction !== 'balance' || !fact.basis)) fail('SEMANTICS', `summary[${index}]`, 'Remaining balance requires balance direction and its supplied basis.');
      });
    }
  }
  if (has(input, 'approval')) result.approval = metadata(input.approval, 'approval', ['status', 'approvedBy', 'date', 'reference']);
  if (has(input, 'notes')) result.notes = text(input.notes, 'notes');
  result.printRows = transactionPrintRows(result);
  return result;
}
