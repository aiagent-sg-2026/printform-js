import { parseClaimAmount, displayClaimAmount } from './globe3-claim-money.js';
import { pcarFail } from './globe3-progress-source.js';

export function decimalValue(value, precision, path, currency = '') {
  const parsed = parseClaimAmount(value, precision, path);
  return { ...parsed, precision, display: displayClaimAmount(parsed.amountMinor, precision, currency).trim() };
}
export function unitValue(units, precision, path, currency = '') {
  return decimalValue(displayClaimAmount(units, precision, '').trim(), precision, path, currency);
}
export function movement(current, previous, path, currency = '') {
  return unitValue(BigInt(current.amountMinor) - BigInt(previous.amountMinor), current.precision, path, currency);
}
export function workSlot(row, digits, slot, context, path, precision, currency = '', required = true) {
  const suffix = String(slot).padStart(3, '0'), prefix = `num_20_${digits}_${context.numericSlotVariant}_`;
  const column = `${prefix}${suffix}`, alternative = `num_20_${digits}_${context.numericSlotVariant === 'd0' ? 'd' : 'd0'}_${suffix}`;
  if (!Object.hasOwn(row, column)) {
    if (!required) return undefined;
    pcarFail('SLOT', `${path}.${column}`, 'Selected numeric profile is missing; no other profile is inferred.');
  }
  const value = decimalValue(row[column], precision, `${path}.${column}`, currency);
  if (Object.hasOwn(row, alternative) && decimalValue(row[alternative], precision, `${path}.${alternative}`).amountMinor !== value.amountMinor) pcarFail('SLOT', `${path}.${alternative}`, 'Numeric profiles contain conflicting values.');
  return { ...value, column };
}
export function cumulativeValues(row, context, path, currency) {
  return {
    gross: workSlot(row, 4, 2, context, path, 4, currency),
    measure: workSlot(row, 4, 1, context, path, 4),
    percent: workSlot(row, 2, 1, context, path, 2)
  };
}
export function storedPrevious(row, context, path, currency) {
  return {
    gross: workSlot(row, 2, 3, context, path, 4, currency),
    measure: workSlot(row, 2, 4, context, path, 4),
    percent: workSlot(row, 2, 2, context, path, 2)
  };
}
export function zeroPrevious(currency) {
  return { gross: decimalValue('0', 4, 'newWork.gross', currency), measure: decimalValue('0', 4, 'newWork.measure'), percent: decimalValue('0', 2, 'newWork.percent') };
}
export function valuationValues(current, previous, context, path, currency) {
  const currentGross = movement(current.gross, previous.gross, `${path}.currentGross`, currency);
  const quantity = context.workDoneMeasureKind === 'quantity';
  const currentMeasure = movement(quantity ? current.measure : current.percent, quantity ? previous.measure : previous.percent, `${path}.currentMeasure`);
  const displayMeasure = value => quantity ? value.display : `${value.display}%`;
  return {
    previousGross: previous.gross.amount, previousGrossMinor: previous.gross.amountMinor,
    currentGross: currentGross.amount, currentGrossMinor: currentGross.amountMinor,
    cumulativeGross: current.gross.amount, cumulativeGrossMinor: current.gross.amountMinor,
    previousMeasure: quantity ? previous.measure.amount : previous.percent.amount,
    currentMeasure: currentMeasure.amount,
    cumulativeMeasure: quantity ? current.measure.amount : current.percent.amount,
    rawCumulativeMeasure: current.measure.amountRaw,
    rawPreviousMeasure: previous.measure.amountRaw,
    rawCumulativeMeasureKind: context.workDoneMeasureKind,
    rawPreviousMeasureKind: context.basisProfile === 'globe3-stored-last-claim' ? 'quantity' : context.workDoneMeasureKind,
    measureKind: quantity ? 'quantity' : 'percentage',
    display: {
      previousGross: previous.gross.display, currentGross: currentGross.display, cumulativeGross: current.gross.display,
      previousMeasure: displayMeasure(quantity ? previous.measure : previous.percent),
      currentMeasure: displayMeasure(currentMeasure),
      cumulativeMeasure: displayMeasure(quantity ? current.measure : current.percent)
    }
  };
}
export function grossSummary(rows, currency) {
  const summary = { precision: 4, currency, display: {} };
  for (const role of ['previousGross', 'currentGross', 'cumulativeGross']) {
    const value = unitValue(rows.reduce((sum, row) => sum + BigInt(row[`${role}Minor`]), 0n), 4, `summary.${role}`, currency);
    summary[role] = value.amount; summary[`${role}Minor`] = value.amountMinor; summary.display[role] = value.display;
  }
  return summary;
}
