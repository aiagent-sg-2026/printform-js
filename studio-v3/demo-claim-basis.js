import { amount, demoLine } from './demo-fixture-math.js';

// Fixture construction only. This is not an ERP import or accounting-posting calculator.
export function certifiedBasisItems(source, previousCertified, id) {
  return source.data.items.map((line, index) => {
    const before = previousCertified?.data.items.find(row => row.parentLineId === line.parentLineId);
    if (previousCertified && !before) throw new Error('Prior certificate must contain the same project scope line.');
    const values = {
      previousWorkMinor: before?.cumulativeWorkMinor ?? 0,
      cumulativeWorkMinor: line.cumulativeWorkMinor,
      previousRetentionMinor: before?.cumulativeRetentionMinor ?? 0,
      cumulativeRetentionMinor: line.cumulativeRetentionMinor,
      previousOnHoldMinor: before?.cumulativeOnHoldMinor ?? 0,
      cumulativeOnHoldMinor: line.cumulativeOnHoldMinor ?? 0
    };
    if (!Object.values(values).every(Number.isSafeInteger)) throw new Error('Claim fixtures require integer cumulative minor units.');
    values.currentWorkMinor = values.cumulativeWorkMinor - values.previousWorkMinor;
    values.retentionMinor = values.cumulativeRetentionMinor - values.previousRetentionMinor;
    values.onHoldMinor = values.cumulativeOnHoldMinor - values.previousOnHoldMinor;
    values.currentClaimMinor = values.currentWorkMinor - values.retentionMinor - values.onHoldMinor;
    const displays = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.replace(/Minor$/, ''), amount(value)]));
    const priced = demoLine(`${id}:line:${index + 1}`, { id: line.productId, sku: line.sku, description: line.description, unit: line.unit }, 1,
      { no: index + 1, rateMinor: values.currentClaimMinor, taxBps: line.taxBps });
    return { ...structuredClone(line), ...priced, ...values, ...displays,
      parentDocumentId: source.id, parentLineId: line.id, previousClaimLineId: before?.id ?? null };
  });
}

export function certifiedBasisSummary(items) {
  const sum = key => items.reduce((total, line) => total + line[key], 0);
  const values = Object.fromEntries(['previousWorkMinor', 'cumulativeWorkMinor', 'currentWorkMinor',
    'previousRetentionMinor', 'cumulativeRetentionMinor', 'retentionMinor',
    'previousOnHoldMinor', 'cumulativeOnHoldMinor', 'onHoldMinor', 'currentClaimMinor'].map(key => [key, sum(key)]));
  values.previousClaimMinor = values.previousWorkMinor - values.previousRetentionMinor - values.previousOnHoldMinor;
  values.cumulativeClaimMinor = values.cumulativeWorkMinor - values.cumulativeRetentionMinor - values.cumulativeOnHoldMinor;
  values.currentGrossMinor = values.currentWorkMinor;
  values.currentNetMinor = values.currentClaimMinor;
  return { ...values, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key.replace(/Minor$/, ''), amount(value)])) };
}
