import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfRuns, compact, measurePDFSafety } from './pf057-print-safety.mjs';

export async function verifyInvoicePDF(file, { paper, mode, expected, ids, bilingual, imageDir }) {
  const task = getDocument({ data: new Uint8Array(await fs.readFile(file)), useSystemFonts: false, fontExtraProperties: true });
  const pdf = await task.promise;
  const result = { pages: pdf.numPages, physical: [], minimumFontPt: Infinity, minimumSafetyMm: Infinity, images: [], embeddedFonts: [] };
  assert.ok(mode === 'short' ? pdf.numPages === 1 : pdf.numPages >= 2);
  const allIds = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i), view = page.getViewport({ scale: 1 });
    const mm = paper === 'A5' ? [148, 210] : [210, 297];
    const dims = [view.width, view.height].map(n => n * 25.4 / 72);
    dims.forEach((value, axis) => assert.ok(Math.abs(value - mm[axis]) < .3, 'Physical PDF dimensions'));
    result.physical.push(dims);
    const content = await page.getTextContent(), runs = pdfRuns(content, view.height);
    await page.getOperatorList();
    for (const key of Object.keys(content.styles)) {
      const font = page.commonObjs.get(key);
      assert.ok(font.data?.length > 0 && !font.missingFile && !font.isType3Font, 'Embedded outline font, not a system fallback or Type 3');
      if (!result.embeddedFonts.includes(font.name)) result.embeddedFonts.push(font.name);
    }
    if (bilingual) for (const item of content.items.filter(n => /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/u.test(n.str || ''))) {
      assert.ok(page.commonObjs.get(item.fontName).name.includes('DemoSchoolCJK'), `CJK uses licensed bundled font: ${item.str}`);
    }
    const text = runs.map(n => n.text).join(' '), dense = compact(text);
    allIds.push(...text.match(/\bL\d{3}\b/g) || []);
    const warning = 'SAMPLE — NOT VALID FOR PAYMENT';
    assert.ok(dense.includes(compact(warning)), `Selectable warning page ${i}`);
    assert.ok(dense.includes(compact(`Page ${i} / ${pdf.numPages}`)), 'PDF page x/y');
    assert.ok(dense.includes('DEMO-2027-014'), 'Repeated invoice identity in PDF');
    const safety = measurePDFSafety(runs, view.width, view.height, [warning,
      ...(bilingual ? ['示例 — 不可用于付款'] : []),
      ...(i === pdf.numPages ? ['Demonstration only. Do not transfer money. QR opens an example.org demo URL.', 'DEMO-XXXX-NONVALID'] : [])]);
    for (const item of safety.critical) {
      assert.ok(item.minSizePt >= 7.49, `Physical safety font: ${item.minSizePt}pt`);
      assert.ok(item.bottomMarginMm >= 5, '5mm bottom safety');
      assert.ok(item.horizontalMarginMm >= 5, '5mm horizontal safety');
    }
    result.minimumSafetyMm = Math.min(result.minimumSafetyMm, ...safety.critical.map(n => Math.min(n.bottomMarginMm, n.horizontalMarginMm)));
    result.minimumFontPt = Math.min(result.minimumFontPt, ...runs.map(n => n.sizePt));
    assert.ok(runs.every(n => n.sizePt >= 7.49), 'All PDF text at least 7.5pt');
    for (const n of runs) {
      const margin = 5 / (25.4 / 72);
      assert.ok(n.left >= margin - .1 && n.right <= view.width - margin + .1 && n.top >= margin - .1 && n.bottom <= view.height - margin + .1,
        `PDF text outside 5mm: ${n.text}`);
      assert.ok(!n.text.includes('\ufffd'), 'No replacement glyph');
    }
    const label = compact(bilingual ? '应付金额 / AMOUNT DUE' : 'AMOUNT DUE');
    assert.equal(dense.includes(label), i === pdf.numPages, 'Final-only total in PDF');
    assert.equal(dense.includes('DEMO-XXXX-NONVALID'), i === pdf.numPages, 'Final-only payment in PDF');
    if (i === pdf.numPages) {
      const due = (Math.abs(expected.due) / 100).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      assert.ok(dense.includes(compact(due)), 'Computed final amount is selectable PDF text');
    }
    if (bilingual) {
      for (const value of ['示例花桥学苑', '发票', '学生资料', '示例 — 不可用于付款']) assert.ok(dense.includes(compact(value)), `CJK selectable: ${value}`);
    }
    // Rasterize actual PDF first/continuation/final, never DOM screenshots as print proof.
    if (i === 1 || (mode === 'long' && (i === 2 || i === pdf.numPages))) {
      const viewport = page.getViewport({ scale: 1.1 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const output = path.join(imageDir, `${path.basename(file, '.pdf')}-p${i}.png`);
      await fs.writeFile(output, canvas.toBuffer('image/png'));
      result.images.push(output);
    }
    page.cleanup();
  }
  assert.deepEqual(allIds, ids, 'PDF exact ordered line IDs, each once');
  await task.destroy();
  return result;
}
