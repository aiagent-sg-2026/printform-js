import * as settlement from './erp-settlement-validation.js';

export function transactionError(code, path, detail) {
  return Object.assign(new Error(`[ERP_TRANSACTION_${code}] ${path}: ${detail}`), { code: `ERP_TRANSACTION_${code}`, path });
}
export const fail = (code, path, detail) => { throw transactionError(code, path, detail); };
const reuse = fn => (...args) => {
  try { return fn(...args); } catch (error) {
    if (!error.code?.startsWith('ERP_SETTLEMENT_')) throw error;
    throw transactionError(error.code.slice('ERP_SETTLEMENT_'.length), error.path, error.message);
  }
};
export const has = settlement.has;
export const object = reuse(settlement.object);
export const text = reuse(settlement.text);
export const choice = reuse(settlement.choice);
export const date = reuse(settlement.date);
export const currency = reuse(settlement.currency);
export const jsonSafe = reuse(settlement.jsonSafe);
export const reference = reuse(settlement.reference);
export const metadata = reuse(settlement.metadata);
const suppliedMoney = reuse(settlement.money);

export function provenance(value, path) {
  return metadata(value, path, ['sourcePath', 'meaning'], ['sourcePath', 'meaning']);
}
export function money(value, path) {
  object(value, path, ['amount', 'currency', 'minorUnitDigits', 'direction', 'provenance']);
  text(value.amount, `${path}.amount`);
  const result = suppliedMoney({ amount: value.amount, currency: value.currency, minorUnitDigits: value.minorUnitDigits }, path);
  result.direction = choice(value.direction, ['increase', 'decrease', 'inflow', 'outflow', 'valuation', 'balance'], `${path}.direction`);
  result.provenance = provenance(value.provenance, `${path}.provenance`);
  return result;
}
export function quantity(value, path) {
  object(value, path, ['role', 'amount', 'uom', 'decimalPlaces', 'direction', 'provenance', 'warehouse']);
  text(value.amount, `${path}.amount`);
  // The existing exact-decimal parser bounds precision and safe integer storage; no UOM conversion.
  let parsed;
  try {
    parsed = suppliedMoney({ amount: value.amount, currency: 'MYR', minorUnitDigits: value.decimalPlaces }, path);
  } catch (error) {
    if (error.path === `${path}.minorUnitDigits`) throw transactionError(error.code.slice('ERP_TRANSACTION_'.length), `${path}.decimalPlaces`, 'Supply quantity precision from 0 through 6.');
    throw error;
  }
  const result = {
    role: choice(value.role, ['received', 'accepted', 'rejected', 'returned', 'billed'], `${path}.role`),
    amount: parsed.amount, uom: text(value.uom, `${path}.uom`), decimalPlaces: parsed.minorUnitDigits,
    direction: choice(value.direction, ['inflow', 'outflow', 'none'], `${path}.direction`),
    provenance: provenance(value.provenance, `${path}.provenance`)
  };
  result.displayQuantity = `${result.amount} ${result.uom}`;
  if (has(value, 'warehouse')) result.warehouse = metadata(value.warehouse, `${path}.warehouse`, ['id', 'name'], ['id']);
  return result;
}
export function array(value, path, nonempty = false) {
  if (!Array.isArray(value) || (nonempty && !value.length)) fail('ROWS', path, nonempty ? 'Supply a nonempty fact array.' : 'Supply an array, including [] when absent.');
  return value;
}
export function identities() {
  const used = new Set();
  return (value, path) => {
    text(value, path);
    if (used.has(value)) fail('IDENTIFIER', path, 'Fact IDs must be unique across references, lines, money facts, taxes and summary.');
    used.add(value);
    return value;
  };
}
export function effect(value, path, directions, basis) {
  object(value, path, basis ? ['basis', 'direction', 'provenance'] : ['direction', 'provenance']);
  const result = { direction: choice(value.direction, directions, `${path}.direction`), provenance: provenance(value.provenance, `${path}.provenance`) };
  if (basis) result.basis = choice(value.basis, basis, `${path}.basis`);
  return result;
}
