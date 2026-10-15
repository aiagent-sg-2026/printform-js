import * as supplied from './erp-settlement-validation.js';
import { assertBoundedJson } from './json-safety.js';

export function businessError(code, path, detail) {
  return Object.assign(new Error(`[BUSINESS_FACTS_${code}] ${path}: ${detail}`), { code: `BUSINESS_FACTS_${code}`, path });
}
export const fail = (code, path, detail) => { throw businessError(code, path, detail); };
const reuse = fn => (...args) => {
  try { return fn(...args); } catch (error) {
    if (!error.code?.startsWith('ERP_SETTLEMENT_')) throw error;
    throw businessError(error.code.slice('ERP_SETTLEMENT_'.length), error.path, error.message);
  }
};
export const object = reuse(supplied.object);
export const text = reuse(supplied.text);
export const choice = reuse(supplied.choice);
export const date = reuse(supplied.date);
export const metadata = reuse(supplied.metadata);
export const reference = reuse(supplied.reference);
export const has = supplied.has;
export function safe(input) { reuse(supplied.jsonSafe)(input); assertBoundedJson(input); }
export function provenance(value, path) { return metadata(value, path, ['sourcePath', 'meaning'], ['sourcePath', 'meaning']); }
export function rows(value, path, nonempty = false) {
  if (!Array.isArray(value) || value.length > 500 || (nonempty && !value.length)) fail('ROWS', path, 'Supply an array of at most 500 facts; detail lines must not be empty.');
  return value;
}
export function identitySet() {
  const used = new Set();
  return (value, path) => {
    text(value, path);
    if (used.has(value)) fail('IDENTIFIER', path, 'Supply unique fact identities.');
    used.add(value); return value;
  };
}
const parseMoney = reuse(supplied.money);
export function money(value, path, currency) {
  object(value, path, ['amount', 'currency', 'minorUnitDigits', 'provenance']);
  text(value.amount, `${path}.amount`);
  const parsed = parseMoney(value, path);
  if (parsed.currency !== currency) fail('CURRENCY', `${path}.currency`, 'This profile is single-currency; supply a separate document for another currency.');
  parsed.provenance = provenance(value.provenance, `${path}.provenance`);
  // The exact supplied spelling is the print value, not an Intl/rounded decimal projection.
  parsed.displayAmount = `${parsed.currency} ${parsed.amount}`;
  return parsed;
}
export function quantity(value, path) {
  object(value, path, ['amount', 'decimalPlaces', 'uom', 'provenance']);
  text(value.amount, `${path}.amount`);
  let parsed;
  try { parsed = parseMoney({ amount: value.amount, currency: 'MYR', minorUnitDigits: value.decimalPlaces }, path); }
  catch (error) {
    if (error.path === `${path}.minorUnitDigits`) fail('PRECISION', `${path}.decimalPlaces`, 'Supply quantity precision from 0 through 6.');
    throw error;
  }
  return { amount: parsed.amount, decimalPlaces: parsed.minorUnitDigits, uom: text(value.uom, `${path}.uom`), provenance: provenance(value.provenance, `${path}.provenance`) };
}
export function period(value, path) {
  object(value, path, ['from', 'to']);
  const result = { from: date(value.from, `${path}.from`), to: date(value.to, `${path}.to`) };
  if (result.to < result.from) fail('PERIOD', path, 'Period end precedes start.');
  return result;
}
