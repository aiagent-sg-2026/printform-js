import assert from 'node:assert/strict';
export const MIN_PT = 7.5;
export const MIN_BOTTOM_MM = 5;
export const MM_PER_PT = 25.4 / 72;
export const SAFETY_SELECTORS = [
  '.pf057-rate > small', '.pf057-date', '.pf057-benefits small',
  '.pf057-table-note', '.pf057-mini', '.pf057-notes h3', '.pf057-notes p',
  '.pf057-base small', '.pf057-outcome small', '.pf057-footer-top small',
  '.pf057-footer-top > div:last-child b', '.pf057-warning strong', '.pf057-warning span'
];
export function safetyCopy(t, warning) {
  return [t.rateNote, t.periodLabel, t.perYear, t.noRebateHead, ...t.benefitDetails, t.tableNote, t.noRebate, t.mathTitle,
    t.math, t.flat, t.condition, t.footerLine, t.offerWarning, warning, t.localWarning];
}
export const compact = value => value.normalize('NFKC').replace(/\s+/g, '');

// PDF text transforms are in physical points, independent of renderer CSS.
// Use the embedded font's ascent/descent, including descenders, not baseline-only y.
export function pdfRuns(content, height) {
  return content.items.filter(n => n.str?.trim()).map(n => {
    const sizePt = Math.hypot(n.transform[2], n.transform[3]);
    const style = content.styles[n.fontName];
    assert.ok(Number.isFinite(style?.ascent) && Number.isFinite(style?.descent), 'Embedded font metrics required');
    assert.ok(Math.abs(n.transform[1]) < .001 && Math.abs(n.transform[2]) < .001, 'Unrotated placemat text');
    const baseline = height - n.transform[5];
    return { text: n.str, sizePt, left: n.transform[4], right: n.transform[4] + n.width,
      top: baseline - style.ascent * sizePt, bottom: baseline - style.descent * sizePt };
  });
}
export function measurePDFSafety(runs, width, height, copy) {
  let offset = 0;
  const indexed = runs.map(run => {
    const start = offset; offset += compact(run.text).length;
    return { run, start, end: offset };
  });
  const text = runs.map(n => compact(n.text)).join('');
  const critical = copy.flatMap(value => {
    const needle = compact(value), occurrences = [];
    assert.ok(needle.length, 'Non-empty safety text');
    for (let start = text.indexOf(needle); start >= 0; start = text.indexOf(needle, start + needle.length)) {
      const end = start + needle.length;
      const matches = indexed.filter(n => n.end > start && n.start < end).map(n => n.run);
      const bbox = { left: Math.min(...matches.map(n => n.left)), right: Math.max(...matches.map(n => n.right)),
        top: Math.min(...matches.map(n => n.top)), bottom: Math.max(...matches.map(n => n.bottom)) };
      occurrences.push({ text: value, minSizePt: Math.min(...matches.map(n => n.sizePt)), bbox,
        bottomMarginMm: (height - bbox.bottom) * MM_PER_PT,
        horizontalMarginMm: Math.min(bbox.left, width - bbox.right) * MM_PER_PT });
    }
    assert.ok(occurrences.length, `Complete selectable safety text: ${value}`);
    return occurrences;
  });
  return { critical, lowestBottomMarginMm: Math.min(...critical.map(n => n.bottomMarginMm)),
    minCriticalSizePt: Math.min(...critical.map(n => n.minSizePt)),
    // Compact non-critical labels are deliberately reported, never silently certified at 7.5pt.
    smallText: runs.filter(n => n.sizePt < MIN_PT - .002) };
}
export function assertPDFSafety(safety, page) {
  for (const n of safety.critical) {
    assert.ok(n.minSizePt >= MIN_PT - .002, `PDF safety font page ${page}: ${n.minSizePt.toFixed(3)}pt: ${n.text}`);
    assert.ok(n.bottomMarginMm >= MIN_BOTTOM_MM - 1e-6, `PDF safety bottom page ${page}: ${n.bottomMarginMm.toFixed(3)}mm: ${n.text}`);
    assert.ok(n.horizontalMarginMm >= 7, `PDF safety horizontal margin page ${page}: ${n.text}`);
  }
}
export async function inspectDOMSafety(page) {
  return page.evaluate(selectors => [...document.querySelectorAll('.pf057 .printform_page')].map(sheet => {
    const b = sheet.getBoundingClientRect(), scale = b.width / (210 / 25.4 * 96);
    const critical = [...sheet.querySelectorAll(selectors.join(','))].map(n => {
      const range = document.createRange(); range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      return { text: n.textContent, sizePx: parseFloat(getComputedStyle(n).fontSize),
        bottomMarginMm: (b.bottom - r.bottom) / scale / 96 * 25.4,
        horizontalMarginMm: Math.min(r.left - b.left, b.right - r.right) / scale / 96 * 25.4 };
    });
    const overlaps = [];
    for (const [a, z] of [['.pf057-pitch', '.pf057-rate'], ['.pf057-rate', '.pf057-date'],
      ['.pf057-tiers', '.pf057-table-note'], ['.pf057-table-note', '.pf057-no-rebate'],
      ['.pf057-mini', '.pf057-notes'], ['.pf057-footer-top', '.pf057-warning']]) {
      if (sheet.querySelector(a).getBoundingClientRect().bottom > sheet.querySelector(z).getBoundingClientRect().top + .2) overlaps.push(`${a} / ${z}`);
    }
    const benefits = sheet.querySelector('.pf057-benefits').getBoundingClientRect();
    for (const n of sheet.querySelectorAll('.pf057-benefits small')) {
      if (n.getBoundingClientRect().bottom > benefits.bottom + .2) overlaps.push('benefit copy / guide');
    }
    return { critical, overlaps };
  }), SAFETY_SELECTORS);
}
export function assertDOMSafety(pages) {
  assert.equal(pages.length, 2);
  for (const [i, p] of pages.entries()) {
    assert.deepEqual(p.overlaps, [], `Internal safety overlap page ${i + 1}`);
    assert.ok(p.critical.length >= 20, 'All safety elements measured');
    for (const n of p.critical) {
      assert.ok(n.sizePx >= 10, `DOM safety font page ${i + 1}: ${n.text}`);
      assert.ok(n.bottomMarginMm >= MIN_BOTTOM_MM, `DOM safety bottom page ${i + 1}: ${n.text}`);
      assert.ok(n.horizontalMarginMm >= 7, `DOM safety horizontal page ${i + 1}: ${n.text}`);
    }
  }
}
