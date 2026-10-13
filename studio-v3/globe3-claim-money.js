// Decimal conversion only: never rounds or calculates ERP financial amounts.
export function claimError(code, path, detail) {
  const error = new Error(`[${code}] ${path}: ${detail}`);
  error.code = code;
  error.path = path;
  return error;
}

export function claimPrecision(value, path = 'header.curr_decimal') {
  const text = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  if (!/^[0-6]$/.test(text)) throw claimError('GLOBE3_CLAIM_PRECISION', path, 'Expected an integer currency precision from 0 to 6.');
  return Number(text);
}

function decimalParts(text, path) {
  const match = /^([+-]?)(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) throw claimError('GLOBE3_CLAIM_AMOUNT', path, 'Expected a finite decimal amount without exponents.');
  return { sign: match[1], integer: match[2].replaceAll(',', ''), fraction: match[3] || '' };
}

function units(parts, precision, path) {
  if (/[1-9]/.test(parts.fraction.slice(precision))) {
    throw claimError('GLOBE3_CLAIM_AMOUNT_PRECISION', path, 'Amount has nonzero digits beyond the currency precision.');
  }
  const digits = parts.integer + parts.fraction.slice(0, precision).padEnd(precision, '0');
  return BigInt(digits) * (parts.sign === '-' ? -1n : 1n);
}

export function parseClaimAmount(value, precision, path) {
  claimPrecision(precision);
  if ((typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'number' && !Number.isFinite(value))) {
    throw claimError('GLOBE3_CLAIM_AMOUNT', path, 'Expected a supplied decimal string or finite number.');
  }
  const raw = String(value), parts = decimalParts(raw, path), minor = units(parts, precision, path);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER) || minor < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw claimError('GLOBE3_CLAIM_UNSAFE_AMOUNT', path, 'Amount exceeds safe integer minor units.');
  }
  const amount = Number(`${parts.sign}${parts.integer}.${parts.fraction || '0'}`);
  if (!Number.isFinite(amount) || units(decimalParts(String(amount), path), precision, path) !== minor) {
    throw claimError('GLOBE3_CLAIM_UNSAFE_AMOUNT', path, 'Binding number cannot preserve the supplied decimal amount.');
  }
  return { amount, amountMinor: Number(minor), amountRaw: raw };
}

export function displayClaimAmount(minor, precision, currency) {
  const integer = BigInt(minor), digits = (integer < 0n ? -integer : integer).toString().padStart(precision + 1, '0');
  const value = precision ? `${digits.slice(0, -precision)}.${digits.slice(-precision)}` : digits;
  return `${currency} ${integer < 0n ? '-' : ''}${value}`;
}
