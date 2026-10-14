import { claimPrecision } from './globe3-claim-money.js';
import { pcarFail, sourceObject, sourceText, sourceDate, sourceType, sourceScope, sourceActive, sourceList, progressContext, salesIndex, linkedSales, selectPriorCertificate } from './globe3-progress-source.js';
import { decimalValue, cumulativeValues, storedPrevious, zeroPrevious, valuationValues, grossSummary } from './globe3-progress-values.js';

function workRows(values, header, context, indexes, path) {
  const rows = [], seen = new Set();
  sourceList(values, path, 500).forEach((value, index) => {
    const location = `${path}[${index}]`, row = sourceObject(value, location);
    sourceScope(row, context, location);
    if (row.uniquenum_pri !== header.uniquenum_pri) pcarFail('SCOPE', `${location}.uniquenum_pri`, 'Tab document FK does not match its header.');
    if (row.tag_table_usage !== undefined && row.tag_table_usage !== header.cslsegm && row.tag_table_usage !== header.tag_table_usage) pcarFail('TYPE', location, 'Work-done storage type differs from its document.');
    if (row.tag_tab_type !== 'wd_detail_soc') pcarFail('TYPE', `${location}.tag_tab_type`, 'Only AR wd_detail_soc is supported; AP wd_detail is a different join.');
    if (!sourceActive(row, location)) return;
    const linked = linkedSales(row, context, indexes, location);
    if (seen.has(linked.key)) pcarFail('DUPLICATE', location, 'Duplicate work-done record for the same exact SO line group.');
    seen.add(linked.key);
    if (linked.header.curr_short_forex !== header.curr_short_forex) pcarFail('CURRENCY', location, 'Cross-currency work-done valuation needs a separately verified conversion profile.');
    rows.push({ row, index, location, linked, cumulative: cumulativeValues(row, context, location, header.curr_short_forex) });
  });
  return rows;
}
function lexicalValue(value, path, currency = '') {
  if (typeof value !== 'string' && typeof value !== 'number') pcarFail('VALUE', path, 'Expected a supplied decimal.');
  const text = String(value), fraction = text.trim().split('.')[1] || '';
  return decimalValue(value, claimPrecision(fraction.length, path), path, currency);
}

/**
 * Pure, pre-authorized input projection. Does not query SQL, post or infer tax/net payable.
 * Source source-row identity is an input ordinal; scm_sal_data.idcode is the line PK.
 * Linked header + uniquenum_uniq must resolve exactly once; ambiguous groups are rejected.
 */
export function adaptGlobe3ProgressClaim(input) {
  input = sourceObject(input, 'input');
  const header = sourceObject(input.header, 'header'), context = progressContext(input.context);
  sourceType(header, 'entp_pbill', 'header'); sourceScope(header, context, 'header', true);
  if (!sourceActive(header, 'header')) pcarFail('LIFECYCLE', 'header', 'Current claim is inactive or void.');
  const currency = sourceText(header.curr_short_forex, 'header.curr_short_forex');
  if (!/^[A-Z]{3}$/.test(currency)) pcarFail('CURRENCY', 'header.curr_short_forex', 'Expected a three-letter currency code.');
  const document = {
    id: sourceText(header.uniquenum_pri, 'header.uniquenum_pri'), kind: 'PCAR', baseType: 'ProgressClaim', sourceType: 'entp_pbill',
    number: sourceText(header.dnum_auto, 'header.dnum_auto'), date: sourceDate(header.date_trans, 'header.date_trans'), currency,
    minorUnitDigits: claimPrecision(header.curr_decimal), sourcePrecision: header.curr_decimal, valuationPrecision: 4
  };
  if (header.dnum_reference !== undefined) document.reference = sourceText(header.dnum_reference, 'header.dnum_reference', true);
  if (header.creditterm_desc !== undefined) document.creditTerms = sourceText(header.creditterm_desc, 'header.creditterm_desc', true);
  if (header.wflow_status !== undefined) document.status = sourceText(header.wflow_status, 'header.wflow_status', true);
  const indexes = salesIndex(input.salesHeaders, input.salesLines, context);
  const currentRows = workRows(input.workDoneRows, header, context, indexes, 'workDoneRows');
  const prior = selectPriorCertificate(input, header, context);
  const priorRows = prior ? workRows(prior.workDoneRows, prior.header, context, indexes, 'previousCertificate.workDoneRows') : [];
  const priorMap = new Map(priorRows.map(row => [row.linked.key, row]));
  const newLines = new Set(context.newWorkLines || []), consumedNewLines = new Set();
  const valuations = currentRows.map(({ row, index, location, linked, cumulative }, ordinal) => {
    let previous, basisSource, basisKind;
    if (context.basisProfile === 'globe3-stored-last-claim') {
      previous = storedPrevious(row, context, location, currency); basisSource = document.id; basisKind = 'stored-last-claim';
    } else if (!prior) {
      previous = zeroPrevious(currency); basisSource = null; basisKind = 'no-eligible-certificate';
    } else if (priorMap.has(linked.key)) {
      previous = priorMap.get(linked.key).cumulative; basisSource = prior.header.uniquenum_pri; basisKind = 'certified-record';
    } else if (newLines.has(linked.key)) {
      previous = zeroPrevious(currency); basisSource = prior.header.uniquenum_pri; basisKind = 'explicit-new-work'; consumedNewLines.add(linked.key);
    } else pcarFail('BASELINE', location, 'Prior certified line is missing; declare genuine new work explicitly instead of filling an unknown value with zero.');
    const line = linked.line, price = lexicalValue(line.price_unitrate_forex, `${location}.linked.price_unitrate_forex`, currency);
    const quantity = lexicalValue(line.qnty_total, `${location}.linked.qnty_total`);
    const contract = decimalValue(line.extnamt_orig_forex, context.linkedAmountPrecision ?? claimPrecision(linked.header.curr_decimal), `${location}.linked.extnamt_orig_forex`, currency);
    return {
      id: `${document.id}:work-done:${index}`, no: ordinal + 1,
      description: sourceText(line.stkcode_desc, `${location}.linked.stkcode_desc`, true),
      sku: sourceText(line.stkcode_code, `${location}.linked.stkcode_code`, true),
      sourceReference: `${linked.header.dnum_auto} · line ${line.idcode}`,
      linkedContractAmount: contract.amount, linkedContractAmountRaw: contract.amountRaw,
      linkedContractDisplay: contract.display, linkedQuantityRaw: quantity.amountRaw, unitPriceRaw: price.amountRaw, unitPriceDisplay: price.display,
      ...valuationValues(cumulative, previous, context, location, currency),
      source: {
        documentId: document.id, sourceRowIndex: index, tabType: 'wd_detail_soc', linkedHeaderId: linked.header.uniquenum_pri,
        linkedLineGroupKey: line.uniquenum_uniq, linkedLinePrimaryKey: line.idcode, linkColumn: linked.linkColumn,
        numericSlotVariant: context.numericSlotVariant, workDoneAmountColumn: cumulative.gross.column,
        contractAmountColumn: 'extnamt_orig_forex', basisDocumentId: basisSource,
        basisAmountColumn: previous.gross.column || null, basisKind, measureKind: context.workDoneMeasureKind
      }
    };
  });
  for (const key of newLines) if (!consumedNewLines.has(key)) pcarFail('BASELINE', 'context.newWorkLines', 'New-work declaration is unused or conflicts with an existing baseline.');
  const summary = grossSummary(valuations, currency), headerAmounts = [];
  for (const [column, label] of [['subtot_forex', 'ERP header subtotal'], ['nettot_forex', 'ERP header net total'], ['amount_forex', 'ERP header amount'], ['salestaxamt_forex', 'ERP header tax amount']]) {
    if (Object.hasOwn(header, column)) headerAmounts.push({ column, label, ...decimalValue(header[column], document.minorUnitDigits, `header.${column}`, currency) });
  }
  const claim = {
    stage: 'application', direction: 'receivable', basisProfile: context.basisProfile, linkProfile: context.linkProfile,
    period: context.period, workDoneMeasureKind: context.workDoneMeasureKind, accountingRecognition: 'not-assessed',
    basis: context.basisProfile === 'globe3-prior-certified' ? 'Latest eligible certificate in supplied prior snapshot; not previous application or paid cash.' : 'Stored Last Claim; Current = cumulative Work Done minus stored Last Claim.'
  };
  if (prior) Object.assign(claim, { previousCertificateId: prior.header.uniquenum_pri, previousCertificateNumber: prior.header.dnum_auto, previousCertificateDate: prior.header.date_trans });
  return { document, company: context.company, customer: context.customer, project: context.project, claim, valuations, summary, headerAmounts };
}
