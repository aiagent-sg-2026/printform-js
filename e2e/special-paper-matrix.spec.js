import { expect, test } from '@playwright/test';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { CSS_PX_PER_MM, SPECIAL_PAPER_PROFILES, SUPPLIED_BARCODE_PNG, specialPaperFixture } from '../tests/fixtures/special-paper.js';
import { inspectPaperScenario, openPaperScenario } from './special-paper-scenario.js';
import { specialPaperFontCss } from './special-paper-font.js';

const compact = text => text.normalize('NFKC').replace(/\s+/gu, '');
const occurrences = (text, token) => compact(text).split(compact(token)).length - 1;
function scriptInventory(text) {
  const counts = {};
  for (const character of text.normalize('NFKC')) {
    if (/\p{Script=Han}|\p{Script=Arabic}/u.test(character)) counts[character] = (counts[character] || 0) + 1;
  }
  return counts;
}

function assertGeometry(result, fixture, mode) {
  if (mode === 'standalone') expect(result.status).toBe('ready');
  expect(Object.values(result.values)).toEqual(fixture.sampleData.rows);
  expect([...new Set(result.rowOrder)]).toEqual(fixture.sampleData.rows.map((_, index) => index));
  expect(result.rowOrder).toEqual([...result.rowOrder].sort((left, right) => left - right));
  expect(result.pages.length).toBeGreaterThan(1);
  if (fixture.profile.id === 'label') {
    expect(result.pages).toHaveLength(fixture.sampleData.rows.length);
    expect(result.fragments).toBe(fixture.sampleData.rows.length);
  } else expect(result.fragments).toBeGreaterThan(fixture.sampleData.rows.length);
  for (const logical of result.pages) {
    expect(logical.rect.width).toBeCloseTo(fixture.width, 1);
    expect(logical.rect.height).toBeCloseTo(fixture.height, 1);
    expect(logical.sheet.width).toBeCloseTo(fixture.profile.widthMm * CSS_PX_PER_MM, 1);
    expect(logical.sheet.height).toBeCloseTo(fixture.profile.heightMm * CSS_PX_PER_MM, 1);
    expect(logical.contained).toBe(true);
    expect(logical.scrollWidth).toBeLessThanOrEqual(fixture.width + 1);
    expect(logical.scrollHeight).toBeLessThanOrEqual(fixture.height + 1);
    expect(logical.overflow).toEqual([]);
    expect(logical.clipping).toBe(false);
    expect(logical.scaled).toBe(false);
    expect(logical.fonts.every(size => size === '12px')).toBe(true);
    expect(logical.rtl.every(direction => direction === 'rtl')).toBe(true);
  }
  const assets = result.pages.flatMap(logical => logical.assets);
  expect(assets).toHaveLength(fixture.profile.id === 'label' ? fixture.sampleData.rows.length : 0);
  for (const asset of assets) {
    expect(asset).toMatchObject({ src: SUPPLIED_BARCODE_PNG, complete: true, width: 67, height: 32 });
    expect(asset.rect.width).toBeCloseTo(134, 1);
    expect(asset.rect.height).toBeCloseTo(32, 1);
  }
}

async function assertRealPdf(page, fixture, geometry, info, mode) {
  const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true, scale: 1, displayHeaderFooter: false });
  await info.attach(`${fixture.profile.id}-${mode}.pdf`, { body: bytes, contentType: 'application/pdf' });
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
  const pdf = await loading.promise;
  const allText = [], evidence = [];
  try {
    // This is the parsed PDF page tree, not a DOM wrapper count masquerading as PDF verification.
    expect(pdf.numPages).toBe(geometry.pages.length);
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const physical = await pdf.getPage(number);
      const viewport = physical.getViewport({ scale: 1 });
      expect(Math.abs(viewport.width - fixture.profile.widthMm * 72 / 25.4)).toBeLessThan(1);
      expect(Math.abs(viewport.height - fixture.profile.heightMm * 72 / 25.4)).toBeLessThan(1);
      const content = await physical.getTextContent();
      const text = content.items.map(item => item.str || '').join(' ');
      const expected = geometry.pages[number - 1];
      for (const row of fixture.sampleData.rows) for (const field of ['id', 'date', 'amount']) {
        expect(occurrences(text, row[field]), `PDF page ${number}: ${row[field]}`).toBe(occurrences(expected.fields[field], row[field]));
      }
      expect(scriptInventory(text), `CJK/Arabic PDF glyph conservation on page ${number}`)
        .toEqual(scriptInventory(expected.fields.cjk + expected.fields.rtl));
      if (expected.assets.length) {
        expect(occurrences(text, 'CODE39 A')).toBe(expected.assets.length);
        const operators = await physical.getOperatorList();
        const images = operators.fnArray.filter(operator => [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(operator));
        expect(images).toHaveLength(expected.assets.length);
      }
      const insetX = fixture.profile.insetX * 72 / 25.4;
      const insetY = fixture.profile.insetY * 72 / 25.4;
      for (const item of content.items.filter(item => item.str?.trim())) {
        expect(item.transform[4]).toBeGreaterThanOrEqual(insetX - 1);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(viewport.width - insetX + 1);
        expect(item.transform[5]).toBeGreaterThanOrEqual(insetY - 1);
        expect(item.transform[5]).toBeLessThanOrEqual(viewport.height - insetY + 1);
      }
      allText.push(text);
      evidence.push({ page: number, widthPt: viewport.width, heightPt: viewport.height, text });
    }
    for (const row of fixture.sampleData.rows) for (const field of ['id', 'date', 'amount']) {
      expect(occurrences(allText.join(' '), row[field])).toBe(1);
    }
    await info.attach(`${fixture.profile.id}-${mode}-pdf-pages.json`, {
      body: Buffer.from(JSON.stringify(evidence, null, 2)), contentType: 'application/json'
    });
  } finally { await loading.destroy(); }
}

for (const profile of SPECIAL_PAPER_PROFILES) for (const mode of ['direct', 'standalone']) {
  test(`${profile.id} ${mode}: real screen/print geometry and conserved finite paper output`, async ({ page, context, browserName }, info) => {
    const fixture = specialPaperFixture(profile);
    fixture.themeCss += await specialPaperFontCss();
    const printed = await openPaperScenario(page, context, fixture, mode, info);
    try {
      const screen = await inspectPaperScenario(printed);
      assertGeometry(screen, fixture, mode);
      await printed.emulateMedia({ media: 'print' });
      const print = await inspectPaperScenario(printed);
      assertGeometry(print, fixture, mode);
      expect(print.values).toEqual(screen.values);
      expect(print.pages.map(logical => logical.fields)).toEqual(screen.pages.map(logical => logical.fields));
      await info.attach(`${profile.id}-${mode}-geometry.json`, {
        body: Buffer.from(JSON.stringify({ screen, print }, null, 2)), contentType: 'application/json'
      });
      await printed.screenshot({ path: info.outputPath(`${profile.id}-${mode}-print.png`), fullPage: true });
      // Firefox/WebKit still execute all geometry/content assertions; no fictional PDF fallback.
      if (browserName === 'chromium') await assertRealPdf(printed, fixture, print, info, mode);
    } finally { if (printed !== page) await printed.close(); }
  });
}
