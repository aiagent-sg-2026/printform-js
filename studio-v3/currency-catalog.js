// Maintained supported subset of ISO 4217, not a complete currency registry.
// SIX is the ISO 4217 Maintenance Agency. Metadata never overrides supplied precision.
export const CURRENCY_CATALOG_SOURCE = Object.freeze({
  url: 'https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml',
  published: '2026-09-17'
});
export const CURRENCY_CATALOG = Object.freeze([
  ['MYR', 'Malaysian Ringgit', '458', 2], ['USD', 'US Dollar', '840', 2],
  ['SGD', 'Singapore Dollar', '702', 2], ['EUR', 'Euro', '978', 2],
  ['CNY', 'Yuan Renminbi', '156', 2], ['JPY', 'Yen', '392', 0],
  ['GBP', 'Pound Sterling', '826', 2], ['AUD', 'Australian Dollar', '036', 2],
  ['NZD', 'New Zealand Dollar', '554', 2], ['HKD', 'Hong Kong Dollar', '344', 2],
  ['IDR', 'Rupiah', '360', 2], ['VND', 'Dong', '704', 0],
  ['THB', 'Baht', '764', 2], ['INR', 'Indian Rupee', '356', 2],
  ['KRW', 'Won', '410', 0], ['CHF', 'Swiss Franc', '756', 2]
].map(([code, name, numericCode, minorUnitDigits]) => Object.freeze({ code, name, numericCode, minorUnitDigits })));
export const CURRENCY_CODES = Object.freeze(CURRENCY_CATALOG.map(entry => entry.code));
const codes = new Set(CURRENCY_CODES);
export function isSupportedCurrency(value) { return typeof value === 'string' && codes.has(value); }

export function suppliedPrimaryCurrency(data) {
  const currency = data.document?.currency;
  if (typeof currency !== 'string' || !currency) return undefined;
  if (!isSupportedCurrency(currency)) throw new Error('Dataset currency is unsupported. Choose a supported dataset currency.');
  return currency;
}

export function projectCurrencyIssue(project) {
  const supplied = project.sampleData?.document?.currency;
  if (typeof supplied !== 'string' || !supplied || supplied === project.manifest.currency) return null;
  return {code:'SOURCE_CURRENCY_MISMATCH',path:'/document/currency',component:'document',severity:'error',
    message:'The template display currency conflicts with the supplied document currency. Choose the source currency or import matching source data; changing display settings does not perform FX conversion.'};
}
