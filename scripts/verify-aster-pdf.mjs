import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {longNarrative} from '../gallery/designs/assets/aster/fixtures.mjs';
const out = path.resolve(process.env.ASTER_ARTIFACT_DIR || path.join(import.meta.dirname, '../../artifacts'));
const results = [];
for (const name of ['aster-default', 'aster-long', 'aster-150']) {
  const dom = JSON.parse(await fs.readFile(path.join(out, `${name}-dom.json`)));
  const loading = getDocument({data:new Uint8Array(await fs.readFile(path.join(out, `${name}.pdf`))), useSystemFonts:false});
  const doc = await loading.promise;
  assert.equal(doc.numPages, dom.pages, `${name} PDF page count`);
  const texts = [], positions = [], sizes = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number), view = page.getViewport({scale:1});
    assert.ok(Math.abs(view.width - 297 * 72 / 25.4) < 1 && Math.abs(view.height - 210 * 72 / 25.4) < 1, 'A4 landscape geometry');
    const {items} = await page.getTextContent(), text = items.map(i => i.str).join(' ');
    assert.match(text, /ASTER\s+\/ THREE-WAY MATCH REVIEW/);
    assert.match(text, /SAMPLE · fictional data · not an approval or payment instruction/);
    assert.match(text, new RegExp(`Page\\s+${number}\\s*/\\s*${doc.numPages}\\b`));
    assert.match(text, /ASTER-REVIEW-DEMO-001/);
    assert.doesNotMatch(text, /\b(?:NaN|undefined|Infinity|paid|approved|fraud)\b/i);
    if (number < doc.numPages) assert.doesNotMatch(text, /Demo only · blank print space/);
    else assert.match(text, /Prepared by.*Reviewed by.*Review date/);
    for (const item of items) if (item.str.trim()) {
      assert.ok(item.transform[4] >= 32 && item.transform[4] + item.width <= view.width - 32, `horizontal PDF text bounds ${name}/${number}: ${item.str}`);
      assert.ok(item.transform[5] >= 27 && item.transform[5] <= view.height - 27, `vertical PDF bounds ${name}/${number}`);
      // Chromium rounds a 9.5pt font down to 9.495pt in emitted PDF matrices.
      assert.ok(item.height >= 9.49, `readable minimum ${name}/${number}`);
    }
    for (const field of dom.monetaryRects.filter(r => r.page === number)) {
      const x = 12 * 72 / 25.4 + field.x * .75;
      const top = 10 * 72 / 25.4 + field.y * .75, bottom = top + field.height * .75;
      const hits = items.filter(i => i.str === field.text && Math.abs(i.transform[4] - x) < 1.5 && view.height - i.transform[5] >= top - 1.5 && view.height - i.transform[5] <= bottom + 1.5);
      assert.equal(hits.length, 1, `${name}/${number} once-only anchored monetary field ${field.id}`);
      positions.push(field.id);
    }
    sizes.push({page:number, width:view.width, height:view.height}); texts.push(text);
  }
  assert.equal(positions.length, dom.monetaryRects.length);
  const financial = positions.filter(id => id.startsWith('line-'));
  assert.equal(new Set(financial).size, name === 'aster-150' ? 150 : 24);
  if (name === 'aster-long') {
    const cjk = text => (text.match(/[\u4e00-\u9fff]/g) || []).join('');
    assert.equal(cjk(texts.join('')), cjk(longNarrative()), 'PDF extracted CJK exact source order');
    const compact = texts.join('').replace(/\s/g, '');
    assert.equal(compact.split('Thisfictionalreviewnarrativetestsreadablecontinuation').length - 1, 5);
    assert.match(compact, /Endofbilingualfictionalnarrative/);
  }
  await fs.writeFile(path.join(out, `${name}-pdf-text.json`), JSON.stringify(texts, null, 2));
  results.push({name, pages:doc.numPages, sizes, anchoredMonetaryFields:positions.length, canonicalLineAmounts:financial.length, passed:true});
  await loading.destroy();
}
await fs.writeFile(path.join(out, 'aster-pdf-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
