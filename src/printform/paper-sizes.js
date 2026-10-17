// Finite nominal media only. These are not device capability or cutter claims.
export const PAPER_SIZES_MM = Object.freeze({
  A4: Object.freeze({ widthMm: 210, heightMm: 297, label: 'A4' }),
  A5: Object.freeze({ widthMm: 148, heightMm: 210, label: 'A5' }),
  LETTER: Object.freeze({ widthMm: 215.9, heightMm: 279.4, label: 'Letter' }),
  LEGAL: Object.freeze({ widthMm: 215.9, heightMm: 355.6, label: 'Legal' }),
  RECEIPT_58: Object.freeze({ widthMm: 58, heightMm: 120, label: '58 × 120 mm receipt (finite)' }),
  RECEIPT_80: Object.freeze({ widthMm: 80, heightMm: 160, label: '80 × 160 mm receipt (finite)' }),
  LABEL_100_70: Object.freeze({ widthMm: 100, heightMm: 70, label: '100 × 70 mm label' }),
  LABEL_50_30: Object.freeze({ widthMm: 50, heightMm: 30, label: '50 × 30 mm label' }),
  CONTINUOUS_210_140: Object.freeze({ widthMm: 210, heightMm: 140, label: '210 × 140 mm continuous stock (finite pages)' }),
  FANFOLD_210_280: Object.freeze({ widthMm: 210, heightMm: 280, label: '210 × 280 mm fanfold (finite pages)' })
});
