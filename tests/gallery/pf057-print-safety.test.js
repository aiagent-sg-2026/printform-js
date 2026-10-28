import { describe, it, expect } from 'vitest';
import { pdfRuns, measurePDFSafety, assertPDFSafety, MM_PER_PT } from '../../scripts/pf057-print-safety.mjs';

describe('PF057 physical PDF safety boundaries (actual PDF coverage in Playwright)', () => {
  const run = (text = 'warning', sizePt = 7.5, marginMm = 5) => ({ text, sizePt,
    left: 30, right: 200, top: 800, bottom: 842 - marginMm / MM_PER_PT });
  const measure = runs => measurePDFSafety(runs, 595, 842, ['warning']);
  it('accepts the exact size/margin boundary, rejects either independent regression', () => {
    expect(() => assertPDFSafety(measure([run()]), 1)).not.toThrow();
    expect(() => assertPDFSafety(measure([run('warning', 7.497)]), 1)).toThrow('PDF safety font');
    expect(() => assertPDFSafety(measure([run('warning', 8, 4.999)]), 2)).toThrow('PDF safety bottom');
  });
  it('uses embedded font descenders rather than baseline-only bounds', () => {
    const runs = pdfRuns({ items: [{ str: 'warning', fontName: 'f', width: 40,
      transform: [8, 0, 0, 8, 30, 15] }], styles: { f: { ascent: .93, descent: -.24 } } }, 842);
    expect(runs[0].bottom).toBeCloseTo(828.92);
    expect(() => assertPDFSafety(measure(runs), 1)).toThrow('PDF safety bottom');
  });
  it('checks every repeated occurrence and all split runs, including ligatures', () => {
    expect(() => assertPDFSafety(measure([run(), run('warning', 5)]), 1)).toThrow('PDF safety font');
    const report = measurePDFSafety([run('ﬂat'), run(' rate', 5)], 595, 842, ['flat rate']);
    expect(() => assertPDFSafety(report, 1)).toThrow('PDF safety font');
    expect(() => measurePDFSafety([run('partial')], 595, 842, ['complete warning'])).toThrow('Complete selectable safety text');
    expect(() => measurePDFSafety([run()], 595, 842, [' '])).toThrow('Non-empty safety text');
  });
});
