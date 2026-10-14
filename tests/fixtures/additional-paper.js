import { specialPaperFixture } from './special-paper.js';

// Nominal CSS paper, not a certified device printable area.
export const ADDITIONAL_PAPER_PROFILES = [
  { id: 'a5wide', name: 'A5 landscape', widthMm: 210, heightMm: 148, insetX: 5, insetY: 5, cjkRepeats: 90, rtlRepeats: 65 },
  { id: 'label50', name: '50x30mm small label', widthMm: 50, heightMm: 30, insetX: 2, insetY: 2, cjkRepeats: 1, rtlRepeats: 1 },
  { id: 'fanfold280', name: '210x280mm bounded fanfold / continuous pages', widthMm: 210, heightMm: 280, insetX: 13, insetY: 5, cjkRepeats: 180, rtlRepeats: 130 }
];

export function additionalPaperFixture(profile, coverage) {
  const fixture = specialPaperFixture(profile);
  if (profile.id === 'label50') {
    // Three authored labels, not copies to pad a page count. No barcode squeezed
    // into this format: 12px Latin/CJK + 12px/24px Arabic need 96px of height.
    fixture.sampleData.rows = [
      { id: 'L50-001', date: '2026-10-14', amount: 'MYR 00123.4500', cjk: '巡检甲', rtl: 'فحص', barcode: '' },
      { id: 'L50-002', date: '2026-10-15', amount: 'SGD -0007.0050', cjk: '巡检乙', rtl: 'سجل', barcode: '' },
      { id: 'L50-003', date: '2026-10-16', amount: 'JPY 00042', cjk: '巡检丙', rtl: 'تم', barcode: '' }
    ];
    // Each supplied label occupies one logical page, with no dummy source rows.
    fixture.themeCss += `\n.prowitem,.prowitem_processed {height:${fixture.height}px}`;
  }
  if (coverage === 'one-row') {
    const row = fixture.sampleData.rows[0];
    fixture.sampleData.rows = [{ ...row, cjk: '单行巡检记录', rtl: 'فحص' }];
  }
  return fixture;
}
