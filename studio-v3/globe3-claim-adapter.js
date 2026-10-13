import { claimError, claimPrecision, parseClaimAmount, displayClaimAmount } from './globe3-claim-money.js';

const MAIN = 'entp_pcar';
const MAIN_ROLES = ['contractValue', 'workDone', 'variation', 'subtotalA', 'retention', 'subtotalB', 'previousCertified', 'subtotalC', 'tax', 'total'];
const SECTIONS = {
  entp_pcar: { slots: 10 },
  entp_pcar_mb: { slots: 10, role: 'variationDetail' },
  entp_pcar_mc: { slots: 10, role: 'advancePayment' },
  entp_pcar_mk: { slots: 1, role: 'contractOmission' },
  entp_pcar_mm: { slots: 1, role: 'contractVariation' },
  entp_pcar_mn: { slots: 1, role: 'workDoneOmission' },
  entp_pcar_mp: { slots: 1, role: 'onHold' }
};
const present = value => value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');
const fail = (code, path, detail) => { throw claimError(`GLOBE3_CLAIM_${code}`, path, detail); };

function object(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INPUT', path, 'Expected a record object.');
  return Object.assign(Object.create(null), value);
}
function text(value, path, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) fail('MISSING_REFERENCE', path, 'Expected a supplied string; identifiers cannot be empty.');
  return value;
}
function date(value, path) {
  text(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    fail('DATE', path, 'Expected a valid ISO calendar date (YYYY-MM-DD).');
  }
  return value;
}
function match(value, expected, path) {
  if (value !== undefined && value !== expected) fail('IDENTITY', path, 'Supplied identity differs from the document context.');
}
function type(record, path, required = false) {
  const keys = ['tag_table_usage', 'cslsegm'];
  if (required && !keys.some(key => present(record[key]))) fail('TYPE', path, 'Expected an entp_pcar transaction type.');
  for (const key of keys) if (record[key] !== undefined && record[key] !== MAIN) fail('TYPE', `${path}.${key}`, 'Only Certified Claim AR (entp_pcar) is supported.');
}
function entity(value, path) {
  value = object(value, path);
  text(value.id, `${path}.id`);
  text(value.name, `${path}.name`);
  return structuredClone(value);
}
function suppliedContext(context, header) {
  context = object(context, 'context');
  const result = {};
  for (const key of ['company', 'customer', 'project']) result[key] = entity(context[key], `context.${key}`);
  const period = object(context.period, 'context.period');
  date(period.from, 'context.period.from');
  date(period.to, 'context.period.to');
  if (period.from > period.to) fail('DATE', 'context.period', 'Period start must not follow its end.');
  result.period = structuredClone(period);
  match(header.companyfn, result.company.id, 'header.companyfn');
  match(header.party_unique, result.customer.id, 'header.party_unique');
  match(header.entprojfn, result.project.id, 'header.entprojfn');
  match(header.documentId, header.uniquenum_pri, 'header.documentId');
  return result;
}
function certification(value) {
  value = object(value, 'context.certification');
  for (const key of ['applicationId', 'applicationNumber', 'certifiedBy', 'status']) text(value[key], `context.certification.${key}`);
  date(value.date, 'context.certification.date');
  return structuredClone(value);
}
function addSummary(summary, role, parsed, currency, precision) {
  summary[role] = parsed.amount;
  summary[`${role}Minor`] = parsed.amountMinor;
  summary.rawAmounts[role] = parsed.amountRaw;
  summary.displayAmounts[role] = displayClaimAmount(parsed.amountMinor, precision, currency);
}

function financialLedger(tabData, document, companyId, numericSlotPrefix) {
  if (!Array.isArray(tabData)) fail('INPUT', 'tabData', 'Expected an ordered array of pre-scoped trans_tab_data records.');
  const mains = tabData.map((row, index) => {
    return object(row, `tabData[${index}]`).tag_tab_type === MAIN ? index : -1;
  }).filter(index => index >= 0);
  if (mains.length !== 1) fail('MAIN_BLOCK', 'tabData', `Expected exactly one main financial block; found ${mains.length}.`);
  const financialRows = [];
  const summary = { currency: document.currency, minorUnitDigits: document.minorUnitDigits, sourcePrecision: document.sourcePrecision, rawAmounts: {}, displayAmounts: {} };
  tabData.forEach((row, rowIndex) => {
    row = object(row, `tabData[${rowIndex}]`);
    const path = `tabData[${rowIndex}]`, section = row.tag_tab_type;
    text(section, `${path}.tag_tab_type`);
    const spec = Object.hasOwn(SECTIONS, section) ? SECTIONS[section] : null;
    if (!spec) fail('UNSUPPORTED_RECORD', `${path}.tag_tab_type`, 'Unsupported tab section; project only supported financial records upstream.');
    type(row, path);
    match(row.companyfn, companyId, `${path}.companyfn`);
    // documentId is an explicit adapter envelope, not a guessed Globe3 foreign key.
    match(row.documentId, document.id, `${path}.documentId`);
    match(row.uniquenum_pri, document.id, `${path}.uniquenum_pri`);
    text(row.uniquenum_pri, `${path}.uniquenum_pri`);
    for (const key of Object.keys(row)) {
      const column = /^(?:var_100_|num_20_2_d0?_)(\d+)$/.exec(key);
      if (column && (+column[1] < 1 || +column[1] > 10) && present(row[key])) fail('UNSUPPORTED_RECORD', `${path}.${key}`, 'Unsupported financial column.');
    }
    const before = financialRows.length;
    for (let slot = 1; slot <= 10; slot++) {
      const suffix = String(slot).padStart(3, '0'), labelColumn = `var_100_${suffix}`, amountColumn = `${numericSlotPrefix}${suffix}`;
      const otherColumn = `${numericSlotPrefix === 'num_20_2_d0_' ? 'num_20_2_d_' : 'num_20_2_d0_'}${suffix}`;
      const label = row[labelColumn], raw = row[amountColumn], amountPath = `${path}.${amountColumn}`;
      if (Object.hasOwn(row, otherColumn)) {
        const other = parseClaimAmount(row[otherColumn], document.minorUnitDigits, `${path}.${otherColumn}`);
        if (Object.hasOwn(row, amountColumn)) {
          if (parseClaimAmount(raw, document.minorUnitDigits, amountPath).amountMinor !== other.amountMinor) {
            fail('AMBIGUOUS_AMOUNT', `${path}.${otherColumn}`, 'Numeric profiles supply conflicting amounts for the same slot.');
          }
        } else if (section === MAIN || present(label) || other.amountMinor !== 0) {
          fail('MISSING_AMOUNT_COLUMN', amountPath, 'Selected numeric profile is missing a required amount column.');
        }
      }
      if (section !== MAIN && !present(label)) {
        // Unused database slots commonly contain numeric zero, not a financial line.
        if (present(raw) && parseClaimAmount(raw, document.minorUnitDigits, amountPath).amountMinor !== 0) {
          fail('MISSING_REFERENCE', `${path}.${labelColumn}`, 'A supplied nonzero amount requires its original label.');
        }
        continue;
      }
      text(label, `${path}.${labelColumn}`);
      if (slot > spec.slots) fail('UNSUPPORTED_RECORD', `${path}.${labelColumn}`, 'This section supports only its documented financial slots.');
      if (!Object.hasOwn(row, amountColumn)) fail('MISSING_AMOUNT_COLUMN', amountPath, 'Selected numeric profile is missing a required amount column.');
      const parsed = parseClaimAmount(raw, document.minorUnitDigits, amountPath);
      const role = section === MAIN ? MAIN_ROLES[slot - 1] : spec.role;
      financialRows.push({
        id: `${document.id}:${section}:${rowIndex}:${amountColumn}`, no: financialRows.length + 1, section, role, label,
        ...parsed, displayAmount: displayClaimAmount(parsed.amountMinor, document.minorUnitDigits, document.currency),
        column: amountColumn, labelColumn, sourceDocumentId: document.id, sourceRowIndex: rowIndex, sourceSlot: slot
      });
      if (section === MAIN) addSummary(summary, role, parsed, document.currency, document.minorUnitDigits);
    }
    if (financialRows.length === before) fail('EMPTY_BLOCK', path, 'A financial block must contain a supplied label/amount pair.');
  });
  return { financialRows, summary };
}

/**
 * Pure, fail-closed normalization of pre-scoped Globe3 Certified Claim AR records.
 * The server owns company/document/non-deleted scoping and authorization. This
 * function neither queries records nor infers undocumented deletion keys.
 *
 * Required header: uniquenum_pri, dnum_auto, dnum_master, dnum_reference,
 * date_trans (ISO date), curr_short_forex, curr_decimal (0..6), and either
 * tag_table_usage or cslsegm = entp_pcar (every supplied type must agree).
 * Required context: company/customer/project each {id,name}, period {from,to}.
 * Optional certification: {applicationId,applicationNumber,date,certifiedBy,status}.
 * Optional header.uniquenum_sec is the Progress Claim parent; if certification
 * supplies applicationId it must agree. No parent number/date is inferred.
 * Optional header.creditterm_desc is copied as the document's term snapshot.
 * Certification is a business stage, not a conclusion about AR recognition.
 * Optional receivable: {paidAmount?,outstandingAmount?,currency?}; absent measures
 * remain absent, including when only one is known. Values are never calculated.
 * tabData preserves caller record order, then original numbered slot order.
 * Each row requires uniquenum_pri as its document FK, not a unique row identity.
 * It must match header.uniquenum_pri, as must optional envelope documentId.
 * Generated financial IDs use document, section, record position and column.
 * Optional companyfn must match the explicit context company.
 * context.numericSlotPrefix selects num_20_2_d0_ (default) or num_20_2_d_.
 * Main requires ten selected-profile slots; a four-slot DB profile is unsupported.
 * Conflicting values across both numeric profiles are rejected.
 * Reserved, detail and nonfinancial tab records must be projected out upstream.
 */
export function adaptGlobe3CertifiedClaim(input = {}) {
  let { header, tabData, context } = object(input, 'input');
  header = object(header, 'header');
  context = object(context, 'context');
  type(header, 'header', true);
  const numericSlotPrefix = context.numericSlotPrefix === undefined ? 'num_20_2_d0_' : context.numericSlotPrefix;
  if (!['num_20_2_d0_', 'num_20_2_d_'].includes(numericSlotPrefix)) {
    fail('NUMERIC_PROFILE', 'context.numericSlotPrefix', 'Select a documented numeric column prefix.');
  }
  const document = {
    id: text(header.uniquenum_pri, 'header.uniquenum_pri'), kind: 'CCAR', baseType: 'CertifiedClaim',
    number: text(header.dnum_auto, 'header.dnum_auto'), date: date(header.date_trans, 'header.date_trans'),
    reference: text(header.dnum_reference, 'header.dnum_reference', true),
    currency: text(header.curr_short_forex, 'header.curr_short_forex'),
    minorUnitDigits: claimPrecision(header.curr_decimal), sourcePrecision: header.curr_decimal,
    sourceType: MAIN
  };
  if (header.dnum_revision !== undefined) document.revision = header.dnum_revision;
  if (header.creditterm_desc !== undefined) document.creditTerms = text(header.creditterm_desc, 'header.creditterm_desc', true);
  if (header.tag_datasource !== undefined && header.tag_datasource !== 'entp_pbill') {
    fail('TYPE', 'header.tag_datasource', 'Only the documented Progress Claim parent type entp_pbill is supported.');
  }
  const normalizedContext = suppliedContext(context, header);
  const claim = {
    number: text(header.dnum_master, 'header.dnum_master'), reference: document.reference,
    direction: 'receivable', stage: 'certified', period: structuredClone(normalizedContext.period),
    accountingRecognition: 'not-assessed'
  };
  const suppliedCertification = context.certification !== undefined ? certification(context.certification) : undefined;
  if (header.uniquenum_sec !== undefined) {
    claim.sourceDocumentId = text(header.uniquenum_sec, 'header.uniquenum_sec');
    if (suppliedCertification) match(suppliedCertification.applicationId, claim.sourceDocumentId, 'context.certification.applicationId');
  } else if (suppliedCertification) claim.sourceDocumentId = suppliedCertification.applicationId;
  if (claim.sourceDocumentId) claim.sourceDocumentKind = 'ProgressClaim';
  if (suppliedCertification) claim.sourceDocumentNumber = suppliedCertification.applicationNumber;
  const { financialRows, summary } = financialLedger(tabData, document, normalizedContext.company.id, numericSlotPrefix);
  summary.numericSlotPrefix = numericSlotPrefix;
  if (context.receivable !== undefined) {
    context.receivable = object(context.receivable, 'context.receivable');
    match(context.receivable.currency, document.currency, 'context.receivable.currency');
    for (const key of ['paidAmount', 'outstandingAmount']) {
      if (context.receivable[key] !== undefined) {
        const parsed = parseClaimAmount(context.receivable[key], document.minorUnitDigits, `context.receivable.${key}`);
        addSummary(summary, key, parsed, document.currency, document.minorUnitDigits);
      }
    }
  }
  return { document, claim, ...(suppliedCertification ? { certification: suppliedCertification } : {}), financialRows, summary, context: normalizedContext };
}
