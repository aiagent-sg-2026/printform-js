import { specialPaperFixture } from './special-paper.js';

// Nominal finite CSS sheets; 10mm authored insets do not certify any driver.
export const LETTER_LEGAL_PROFILES = [
  { id: 'letterportrait', name: 'Letter portrait', widthMm: 215.9, heightMm: 279.4, insetX: 10, insetY: 10, cjkRepeats: 260, rtlRepeats: 200 },
  { id: 'letterlandscape', name: 'Letter landscape', widthMm: 279.4, heightMm: 215.9, insetX: 10, insetY: 10, cjkRepeats: 260, rtlRepeats: 200 },
  { id: 'legalportrait', name: 'Legal portrait', widthMm: 215.9, heightMm: 355.6, insetX: 10, insetY: 10, cjkRepeats: 260, rtlRepeats: 200 },
  { id: 'legallandscape', name: 'Legal landscape', widthMm: 355.6, heightMm: 215.9, insetX: 10, insetY: 10, cjkRepeats: 260, rtlRepeats: 200 }
];
export function letterLegalFixture(profile, coverage) {
  const fixture = specialPaperFixture(profile);
  if (coverage === 'one-row') {
    fixture.sampleData.rows = [{ ...fixture.sampleData.rows[0], cjk: '虚构Letter与Legal巡检记录', rtl: 'فحص' }];
  }
  return fixture;
}
