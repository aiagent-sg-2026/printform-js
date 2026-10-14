import { claimPrecision, parseClaimAmount, displayClaimAmount } from './globe3-claim-money.js';

export function settlementError(code, path, detail) {
  return Object.assign(new Error(`[ERP_SETTLEMENT_${code}] ${path}: ${detail}`), { code: `ERP_SETTLEMENT_${code}`, path });
}
export const fail = (code, path, detail) => { throw settlementError(code, path, detail); };
export const has = (object, key) => Object.hasOwn(object, key);
export function object(value, path, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('SHAPE', path, 'Expected an object.');
  if (keys) for (const key of Object.keys(value)) if (!keys.includes(key)) fail('FIELD', `${path}.${key}`, 'Unknown canonical field; map its meaning explicitly.');
  return value;
}
export function text(value, path) {
  if (typeof value !== 'string' || !value.trim()) fail('TEXT', path, 'Expected a nonempty supplied string.');
  return value;
}
export function choice(value, values, path) {
  if (!values.includes(value)) fail('SEMANTICS', path, `Expected one of: ${values.join(', ')}.`);
  return value;
}
export function date(value, path) {
  text(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    fail('DATE', path, 'Expected a real calendar date in YYYY-MM-DD form.');
  }
  return value;
}
const currencyCodes = new Set(Intl.supportedValuesOf('currency'));
export function currency(value, path) {
  if (typeof value !== 'string' || !currencyCodes.has(value)) fail('CURRENCY', path, 'Expected a supported uppercase ISO currency code.');
  return value;
}
// Reject data JSON would silently drop/change before cloning or serializing it.
export function jsonSafe(value, path = 'input', ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) fail('JSON', path, 'Nonfinite numbers and numeric negative zero are not lossless JSON; use a decimal string.');
    return;
  }
  if (typeof value !== 'object') fail('JSON', path, 'Expected JSON-safe data, without undefined, BigInt, functions or symbols.');
  if (ancestors.has(value)) fail('JSON', path, 'Cyclic data cannot be saved.');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) fail('JSON', path, 'Expected a plain JSON object.');
  if (Object.getOwnPropertySymbols(value).length) fail('JSON', path, 'Symbol keys cannot be saved.');
  ancestors.add(value);
  const keys = Reflect.ownKeys(value).filter(key => key !== 'length' || !Array.isArray(value));
  if (Array.isArray(value) && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) fail('JSON', path, 'Sparse arrays and named array properties cannot be saved.');
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !has(descriptor, 'value')) fail('JSON', `${path}.${key}`, 'Accessors and hidden properties cannot be saved.');
    if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('JSON', `${path}.${key}`, 'Unsafe object key.');
    jsonSafe(descriptor.value, `${path}.${key}`, ancestors);
  }
  ancestors.delete(value);
}
export function money(value, path) {
  object(value, path, ['amount', 'currency', 'minorUnitDigits', 'provenance']);
  const code = currency(value.currency, `${path}.currency`);
  let precision, parsed;
  try {
    precision = claimPrecision(value.minorUnitDigits, `${path}.minorUnitDigits`);
    parsed = parseClaimAmount(value.amount, precision, `${path}.amount`);
  } catch (error) {
    throw settlementError(error.code.replace('GLOBE3_CLAIM_', ''), error.path || path, error.message);
  }
  let display = displayClaimAmount(parsed.amountMinor, precision, code);
  // Raw signed zero remains visible, although JSON cannot preserve numeric -0.
  if (parsed.amountMinor === 0 && /^-/.test(parsed.amountRaw.trim())) display = display.replace(`${code} `, `${code} -`);
  if (/^\+/.test(parsed.amountRaw.trim())) display = display.replace(`${code} `, `${code} +`);
  return { amount: parsed.amountRaw, currency: code, minorUnitDigits: precision, amountMinor: parsed.amountMinor, displayAmount: display,
    ...(has(value, 'provenance') ? { provenance: metadata(value.provenance, `${path}.provenance`, ['sourcePath', 'meaning'], ['sourcePath', 'meaning']) } : {}) };
}
export function reference(value, path) {
  object(value, path, ['system', 'documentType', 'id', 'number', 'currency', 'date', 'partyId', 'companyId']);
  for (const key of ['system', 'documentType', 'id', 'number']) text(value[key], `${path}.${key}`);
  if (has(value, 'currency')) currency(value.currency, `${path}.currency`);
  if (has(value, 'date')) date(value.date, `${path}.date`);
  for (const key of ['partyId', 'companyId']) if (has(value, key)) text(value[key], `${path}.${key}`);
  return structuredClone(value);
}
export function metadata(value, path, keys, required = []) {
  object(value, path, keys);
  for (const key of required) text(value[key], `${path}.${key}`);
  for (const [key, entry] of Object.entries(value)) key === 'date' ? date(entry, `${path}.${key}`) : text(entry, `${path}.${key}`);
  return structuredClone(value);
}
