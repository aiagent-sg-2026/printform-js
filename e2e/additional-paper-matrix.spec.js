import { expect, test } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ADDITIONAL_PAPER_PROFILES, additionalPaperFixture } from '../tests/fixtures/additional-paper.js';
import { CSS_PX_PER_MM } from '../tests/fixtures/special-paper.js';
import { inspectPaperScenario, openPaperScenario } from './special-paper-scenario.js';
import { specialPaperFontCss } from './special-paper-font.js';

const compact = text => text.normalize('NFKC').replace(/\s+/gu, '');
const occurrences = (text, token) => compact(text).split(compact(token)).length - 1;
function scripts(text) {
  const counts = {};
  for (const character of text.normalize('NFKC')) {
    if (/\p{Script=Han}|\p{Script=Arabic}/u.test(character)) counts[character] = (counts[character] || 0) + 1;
  }
  return counts;
}

function assertOutput(result, fixture, mode, coverage) {
  if (mode === 'standalone') expect(result.status).toBe('ready');
  expect(Object.values(result.values)).toEqual(fixture.sampleData.rows);
  expect([...new Set(result.rowOrder)]).toEqual(fixture.sampleData.rows.map((_, index) => index));
  expect(result.rowOrder).toEqual([...result.rowOrder].sort((left, right) => left - right));
  if (coverage === 'one-row') {
    expect(result.pages).toHaveLength(1);
    expect(result.fragments).toBe(1);
  } else if (fixture.profile.id === 'label50') {
    expect(result.pages).toHaveLength(3);
    expect(result.rowOrder).toEqual([0, 1, 2]);
    for (let index = 0; index < 3; index += 1) expect(result.pages[index].fields).toEqual(fixture.sampleData.rows[index]);
  } else {
    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.fragments).toBeGreaterThan(fixture.sampleData.rows.length);
  }
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
    expect(logical.assets).toEqual([]);
  }
  const all = result.pages.map(logical => logical.fields);
  for (const row of fixture.sampleData.rows) for (const field of ['id', 'date', 'amount']) {
    expect(occurrences(all.map(fields => fields[field]).join(''), row[field])).toBe(1);
  }
}

async function assertPdf(page, fixture, geometry, info, stem) {
  const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true, scale: 1, displayHeaderFooter: false });
  await info.attach(`${stem}.pdf`, { body: bytes, contentType: 'application/pdf' });
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
  const pdf = await loading.promise;
  const evidence = [];
  try {
    expect(pdf.numPages).toBe(geometry.pages.length);
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const physical = await pdf.getPage(number);
      const viewport = physical.getViewport({ scale: 1 });
      expect(Math.abs(viewport.width - fixture.profile.widthMm * 72 / 25.4)).toBeLessThan(1);
      expect(Math.abs(viewport.height - fixture.profile.heightMm * 72 / 25.4)).toBeLessThan(1);
      const content = await physical.getTextContent();
      const text = content.items.map(item => item.str || '').join(' ');
      const expected = geometry.pages[number - 1].fields;
      for (const row of fixture.sampleData.rows) for (const field of ['id', 'date', 'amount']) {
        expect(occurrences(text, row[field]), `page ${number}: ${row[field]}`).toBe(occurrences(expected[field], row[field]));
      }
      expect(scripts(text), `page ${number}: CJK/Arabic glyph conservation`).toEqual(scripts(expected.cjk + expected.rtl));
      const x = fixture.profile.insetX * 72 / 25.4;
      const y = fixture.profile.insetY * 72 / 25.4;
      const items = content.items.filter(item => item.str?.trim());
      for (const item of items) {
        expect(item.transform[4]).toBeGreaterThanOrEqual(x - 1);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(viewport.width - x + 1);
        expect(item.transform[5]).toBeGreaterThanOrEqual(y - 1);
        expect(item.transform[5]).toBeLessThanOrEqual(viewport.height - y + 1);
      }
      evidence.push({ page: number, widthPt: viewport.width, heightPt: viewport.height, text,
        items: items.map(item => ({ text: item.str, width: item.width, height: item.height, transform: item.transform })) });
    }
    for (const row of fixture.sampleData.rows) for (const field of ['id', 'date', 'amount']) {
      expect(occurrences(evidence.map(item => item.text).join(' '), row[field])).toBe(1);
    }
    await info.attach(`${stem}-pdf-pages.json`, {
      body: Buffer.from(JSON.stringify(evidence, null, 2)), contentType: 'application/json'
    });
  } finally { await loading.destroy(); }
}

for (const profile of ADDITIONAL_PAPER_PROFILES) for (const coverage of ['one-row', 'multi-row']) {
  for (const mode of ['direct', 'standalone']) {
    test(`${profile.id} ${coverage} ${mode}: finite additional paper, exact supplied fields and real PDF`, async ({ page, context, browserName }, info) => {
      const fixture = additionalPaperFixture(profile, coverage);
      fixture.themeCss += await specialPaperFontCss();
      const printed = await openPaperScenario(page, context, fixture, mode, info);
      const stem = `${profile.id}-${coverage}-${mode}`;
      try {
        if (mode === 'standalone') expect(printed.url()).toMatch(/^file:/);
        const screen = await inspectPaperScenario(printed);
        assertOutput(screen, fixture, mode, coverage);
        await printed.emulateMedia({ media: 'print' });
        const print = await inspectPaperScenario(printed);
        assertOutput(print, fixture, mode, coverage);
        expect(print.values).toEqual(screen.values);
        expect(print.pages.map(logical => logical.fields)).toEqual(screen.pages.map(logical => logical.fields));
        await info.attach(`${stem}-geometry.json`, {
          body: Buffer.from(JSON.stringify({ screen, print }, null, 2)), contentType: 'application/json'
        });
        await printed.screenshot({ path: info.outputPath(`${stem}-print.png`), fullPage: true });
        // Firefox/WebKit execute the same consumer geometry checks, not fake PDFs.
        if (browserName === 'chromium') await assertPdf(printed, fixture, print, info, stem);
      } finally { if (printed !== page) await printed.close(); }
    });
  }
}
