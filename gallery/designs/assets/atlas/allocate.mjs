import {integer, safe, sum} from './validate.mjs';
export const ascii = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export function trace(amount, eligible, bases) {
  integer(amount);
  const ids = [...eligible].sort(ascii);
  if (new Set(ids).size !== ids.length) throw new TypeError('Duplicate eligible ID');
  ids.forEach(i => { if (bases[i] !== null) integer(bases[i], true); });
  const allocationsCents = Object.fromEntries(ids.map(i => [i, 0]));
  const missing = ids.some(i => bases[i] === null);
  const denominator = missing ? null : sum(ids.map(i => bases[i]));
  let reason = null;
  if (amount !== 0) reason = missing ? 'missing-basis' : !denominator ? 'zero-basis' : null;
  const result = {allocationsCents, unallocatedCents:reason ? amount : 0, reason};
  const audit = {result, denominator, residualCents:0, recipients:[], sample:null};
  if (amount === 0 || reason) return audit;
  const magnitude = BigInt(Math.abs(amount)), B = BigInt(denominator), sign = amount < 0 ? -1 : 1;
  const shares = ids.map(id => {
    const numerator = magnitude * BigInt(bases[id]);
    return {id, floor:numerator / B, remainder:numerator % B, numerator};
  });
  const remaining = magnitude - shares.reduce((total, s) => total + s.floor, 0n);
  const ranked = [...shares].sort((a, b) => a.remainder === b.remainder ? ascii(a.id, b.id) : a.remainder > b.remainder ? -1 : 1);
  audit.residualCents = safe(remaining);
  audit.recipients = ranked.slice(0, audit.residualCents).map(s => s.id);
  for (const s of shares) allocationsCents[s.id] = sign * safe(s.floor + (audit.recipients.includes(s.id) ? 1n : 0n)) || 0;
  const example = shares.find(s => audit.recipients.includes(s.id));
  if (example) audit.sample = {id:example.id, numerator:String(example.numerator), floor:safe(example.floor), remainder:String(example.remainder)};
  if (sum(Object.values(allocationsCents)) !== amount) throw new Error('Per-charge conservation failure');
  return audit;
}
export const allocate = (amount, ids, bases) => trace(amount, ids, bases).result;
