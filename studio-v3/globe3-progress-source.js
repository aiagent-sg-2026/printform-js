import { validateData } from '../studio-v2/core/schema.js';
import { claimPrecision } from './globe3-claim-money.js';

export function pcarFail(code, path, message) {
  throw Object.assign(new Error(`[GLOBE3_PCAR_${code}] ${path}: ${message}`), { code: `GLOBE3_PCAR_${code}`, path });
}
export function sourceObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![null, Object.prototype].includes(Object.getPrototypeOf(value))) pcarFail('JSON', path, 'Expected a plain JSON record.');
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (['__proto__', 'constructor', 'prototype'].includes(key) || descriptor.get || descriptor.set) pcarFail('JSON', `${path}.${key}`, 'Unsafe JSON property.');
  }
  return value;
}
export function sourceText(value, path, empty = false) {
  if (typeof value !== 'string' || (!empty && !value.trim())) pcarFail('REFERENCE', path, 'Expected a supplied string identifier or label.');
  return value;
}
export function sourceDate(value, path) {
  if (!validateData({ type: 'string', format: 'date' }, value).valid) pcarFail('DATE', path, 'Expected a valid ISO Gregorian date.');
  return value;
}
export function sourceType(record, expected, path) {
  const keys = ['tag_table_usage', 'cslsegm'].filter(key => Object.hasOwn(record, key));
  if (!keys.length || keys.some(key => record[key] !== expected)) pcarFail('TYPE', path, `Expected the explicit ${expected} storage type.`);
}
export function sourceScope(record, context, path, party = false) {
  if (sourceText(record.companyfn, `${path}.companyfn`) !== context.company.id) pcarFail('SCOPE', `${path}.companyfn`, 'Company does not match the supplied scope.');
  for (const [key, expected] of [['entprojfn', context.project.id], ...(party ? [['party_unique', context.customer.id]] : [])]) {
    if (record[key] !== undefined && record[key] !== '' && record[key] !== expected) pcarFail('SCOPE', `${path}.${key}`, 'Project/customer does not match the supplied scope.');
  }
}
export function sourceActive(record, path) {
  if (record.tag_deleted_yn !== undefined && !['n', 'ed', 'de', 'y'].includes(record.tag_deleted_yn)) pcarFail('LIFECYCLE', `${path}.tag_deleted_yn`, 'Unknown lifecycle flag.');
  if (record.tag_void_yn !== undefined && !['n', 'y'].includes(record.tag_void_yn)) pcarFail('LIFECYCLE', `${path}.tag_void_yn`, 'Unknown void flag.');
  return (record.tag_deleted_yn === undefined || record.tag_deleted_yn === 'n') && record.tag_void_yn !== 'y';
}
export function sourceList(value, path, limit = 5000) {
  if (!Array.isArray(value) || value.length > limit) pcarFail('ROWS', path, `Expected an explicit array of at most ${limit} records.`);
  return value;
}
export function progressContext(value) {
  const context = sourceObject(value, 'context'), result = {};
  for (const key of ['company', 'customer', 'project']) {
    const entity = sourceObject(context[key], `context.${key}`);
    result[key] = { id: sourceText(entity.id, `context.${key}.id`), name: sourceText(entity.name, `context.${key}.name`) };
  }
  const period = sourceObject(context.period, 'context.period');
  result.period = { from: sourceDate(period.from, 'context.period.from'), to: sourceDate(period.to, 'context.period.to') };
  if (result.period.from > result.period.to) pcarFail('DATE', 'context.period', 'Period is reversed.');
  for (const [key, choices] of [['basisProfile', ['globe3-prior-certified', 'globe3-stored-last-claim']], ['linkProfile', ['ar-soc-line25', 'view113-line50']], ['workDoneMeasureKind', ['quantity', 'fraction']], ['numericSlotVariant', ['d0', 'd']]]) {
    if (!choices.includes(context[key])) pcarFail('PROFILE', `context.${key}`, `Select one of ${choices.join(', ')} explicitly.`);
    result[key] = context[key];
  }
  if (context.previousCertificateId !== undefined) result.previousCertificateId = sourceText(context.previousCertificateId, 'context.previousCertificateId');
  if (context.asOfDate !== undefined) result.asOfDate = sourceDate(context.asOfDate, 'context.asOfDate');
  if (context.newWorkLines !== undefined) {
    const seen = new Set();
    result.newWorkLines = sourceList(context.newWorkLines, 'context.newWorkLines', 500).map((value, index) => {
      const path = `context.newWorkLines[${index}]`, line = sourceObject(value, path);
      const key = JSON.stringify([sourceText(line.salesHeaderId, `${path}.salesHeaderId`), sourceText(line.lineGroupKey, `${path}.lineGroupKey`)]);
      if (seen.has(key)) pcarFail('DUPLICATE', path, 'Duplicate declared new-work identity.');
      seen.add(key); return key;
    });
  }
  if (context.linkedAmountPrecision !== undefined) result.linkedAmountPrecision = claimPrecision(context.linkedAmountPrecision, 'context.linkedAmountPrecision');
  return result;
}
export function salesIndex(headers, lines, context) {
  const headerMap = new Map(), lineMap = new Map(), primaryKeys = new Set();
  sourceList(headers, 'salesHeaders').forEach((value, index) => {
    const path = `salesHeaders[${index}]`, header = sourceObject(value, path);
    sourceType(header, 'sal_soc', path); sourceScope(header, context, path, true);
    if (!sourceActive(header, path)) return;
    const id = sourceText(header.uniquenum_pri, `${path}.uniquenum_pri`);
    if (headerMap.has(id)) pcarFail('DUPLICATE', path, 'Duplicate SO header identity.');
    if (!/^[A-Z]{3}$/.test(sourceText(header.curr_short_forex, `${path}.curr_short_forex`))) pcarFail('CURRENCY', `${path}.curr_short_forex`, 'Expected a supplied currency code.');
    claimPrecision(header.curr_decimal, `${path}.curr_decimal`);
    sourceText(header.dnum_auto, `${path}.dnum_auto`); headerMap.set(id, header);
  });
  sourceList(lines, 'salesLines').forEach((value, index) => {
    const path = `salesLines[${index}]`, line = sourceObject(value, path);
    sourceType(line, 'sal_soc', path); sourceScope(line, context, path);
    if (!sourceActive(line, path)) return;
    const headerId = sourceText(line.uniquenum_pri, `${path}.uniquenum_pri`), group = sourceText(line.uniquenum_uniq, `${path}.uniquenum_uniq`);
    if (!Number.isSafeInteger(line.idcode) || line.idcode < 1) pcarFail('REFERENCE', `${path}.idcode`, 'Expected the supplied positive line primary key.');
    if (primaryKeys.has(line.idcode)) pcarFail('DUPLICATE', path, 'Duplicate scm_sal_data line primary key.');
    primaryKeys.add(line.idcode);
    if (!headerMap.has(headerId)) pcarFail('JOIN', path, 'Linked SO header is absent or inactive.');
    const key = JSON.stringify([headerId, group]), matches = lineMap.get(key) || [];
    matches.push(line); lineMap.set(key, matches);
  });
  return { headerMap, lineMap };
}
export function linkedSales(row, context, indexes, path) {
  const headerId = sourceText(row.var_50_001, `${path}.var_50_001`);
  const column = context.linkProfile === 'ar-soc-line25' ? 'var_25_001' : 'var_50_002';
  const lineKey = sourceText(row[column], `${path}.${column}`), key = JSON.stringify([headerId, lineKey]);
  const matches = indexes.lineMap.get(key) || [];
  if (matches.length !== 1) pcarFail('JOIN', path, matches.length ? 'Ambiguous SO line group: uniquenum_uniq is not a row primary key.' : 'Exact SO header/line join was not found.');
  return { key, header: indexes.headerMap.get(headerId), line: matches[0], linkColumn: column };
}
export function selectPriorCertificate(input, header, context) {
  if (context.basisProfile !== 'globe3-prior-certified') return null;
  const asOf = context.asOfDate || header.date_trans, seen = new Set(), eligible = [];
  sourceList(input.previousCertificates, 'previousCertificates').forEach((value, index) => {
    const path = `previousCertificates[${index}]`, certificate = sourceObject(value, path), prior = sourceObject(certificate.header, `${path}.header`);
    sourceType(prior, 'entp_pcar', `${path}.header`); sourceScope(prior, context, `${path}.header`, true);
    const id = sourceText(prior.uniquenum_pri, `${path}.header.uniquenum_pri`);
    if (seen.has(id)) pcarFail('DUPLICATE', path, 'Duplicate certificate identity.');
    seen.add(id);
    if (!sourceActive(prior, `${path}.header`) || prior.tag_wflow_app_yn === 'n') return;
    const date = sourceDate(prior.date_trans, `${path}.header.date_trans`);
    if (date > asOf) return;
    if (prior.tag_wflow_app_yn !== 'y') pcarFail('APPROVAL', `${path}.header.tag_wflow_app_yn`, 'An eligible baseline requires explicit approved workflow evidence.');
    if (prior.curr_short_forex !== header.curr_short_forex || claimPrecision(prior.curr_decimal) !== claimPrecision(header.curr_decimal)) pcarFail('CURRENCY', path, 'Prior certificate currency/precision differs.');
    if (certificate.workDoneMeasureKind !== context.workDoneMeasureKind) pcarFail('PROFILE', path, 'Prior measurement mode differs; no quantity/fraction conversion is inferred.');
    sourceText(prior.dnum_auto, `${path}.header.dnum_auto`); eligible.push(certificate);
  });
  if (!eligible.length) {
    if (context.previousCertificateId) pcarFail('BASELINE', 'context.previousCertificateId', 'Requested certificate is not eligible.');
    return null;
  }
  const latestDate = eligible.reduce((date, certificate) => certificate.header.date_trans > date ? certificate.header.date_trans : date, '');
  const latest = eligible.filter(certificate => certificate.header.date_trans === latestDate);
  if (context.previousCertificateId) {
    const selected = latest.find(certificate => certificate.header.uniquenum_pri === context.previousCertificateId);
    if (!selected) pcarFail('BASELINE', 'context.previousCertificateId', 'Requested baseline is not one of the latest eligible supplied certificates.');
    return selected;
  }
  if (latest.length !== 1) pcarFail('BASELINE', 'previousCertificates', 'Same-date certificates need an explicit selected identity; input order is not authority.');
  return latest[0];
}
