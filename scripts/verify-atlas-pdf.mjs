import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {longNarrative} from '../gallery/designs/assets/atlas/fixtures.mjs';
const out = path.resolve(process.env.ATLAS_ARTIFACT_DIR || path.join(import.meta.dirname, '../../artifacts/atlas'));
const compact = s => s.replace(/\s/g, '');
const results = [];
for (const name of (process.env.ATLAS_PDF_NAMES || 'default,long,dense,metadata').split(',')) {
  const dom = JSON.parse(await fs.readFile(path.join(out, `${name}-dom.json`)));
  const loading = getDocument({data:new Uint8Array(await fs.readFile(path.join(out, `${name}.pdf`))), useSystemFonts:false});
  const doc = await loading.promise;
  assert.equal(doc.numPages, dom.pages);
  let moneyCount = 0, splitCount = 0;
  const texts = [], narrative = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number), view = page.getViewport({scale:1});
    assert.ok(Math.abs(view.width - 297 * 72 / 25.4) < 1 && Math.abs(view.height - 210 * 72 / 25.4) < 1, 'A4 landscape PDF');
    const {items} = await page.getTextContent(), text = items.map(i => i.str).join(' '); texts.push(text);
    assert.match(text, /ATLAS \/ LOGISTICS COSTING/); assert.match(text, /Demo only · fictional costing/);
    assert.match(text, new RegExp(`Page\\s+${number}\\s*/\\s*${doc.numPages}\\b`));
    assert.doesNotMatch(text, /\b(?:NaN|undefined|Infinity)\b/);
    if (number === doc.numPages) assert.match(text, /Prepared by.*Reviewed by.*Date/);
    else assert.doesNotMatch(text, /Print record \/ Demo only/);
    for (const item of items) if (item.str.trim()) {
      assert.ok(item.transform[4] >= 32 && item.transform[4] + item.width <= view.width - 32, `${name}/${number} horizontal bounds: ${item.str}`);
      assert.ok(item.transform[5] >= 27 && item.transform[5] <= view.height - 27, `${name}/${number} vertical bounds`);
      assert.ok(item.height >= 9.49, `${name}/${number} minimum readable size`);
    }
    for (const field of dom.monetaryRects.filter(r => r.page === number)) {
      const x = 12 * 72 / 25.4 + field.x * .75, top = 10 * 72 / 25.4 + field.y * .75, bottom = top + field.height * .75;
      // A minus glyph may be a separate PDF font run. Reconstruct only this
      // field's exact geometry, never search for an amount elsewhere on a page.
      const right = x + field.width * .75;
      const hits = items.filter(i => i.str.trim() && i.transform[4] >= x - 1 && i.transform[4] + i.width <= right + 1 && view.height - i.transform[5] >= top - 1 && view.height - i.transform[5] <= bottom + 1);
      assert.equal(hits.map(i => i.str).join(''), field.text, `${name}/${number} anchored exact money ${field.id}`);
      assert.ok(hits.every(i => i.height >= 10.49), 'body money at least 10.5pt (Chromium emission tolerance)'); moneyCount++;
    }
    for (const cell of dom.splitRects.filter(r => r.page === number)) {
      const left = 12 * 72 / 25.4 + cell.x * .75, right = left + cell.width * .75;
      const top = 10 * 72 / 25.4 + cell.y * .75, bottom = top + cell.height * .75;
      const selected = items.filter(i => i.str && i.transform[4] >= left - .5 && i.transform[4] + i.width <= right + .5 && view.height - i.transform[5] >= top && view.height - i.transform[5] <= bottom);
      assert.equal(compact(selected.map(i => i.str).join('')), compact(cell.text), `${name}/${number} exact split-cell PDF content ${cell.key || ''}`);
      if (cell.key === 'narrative') narrative.push(selected.map(i => i.str).join(''));
      splitCount++;
    }
  }
  assert.equal(moneyCount, dom.money.length);
  const landed = dom.money.filter(m => m.id.startsWith('landed-'));
  assert.equal(landed.length, name === 'dense' ? 120 : 24);
  if (name === 'long') assert.equal(compact(narrative.join('')), compact(longNarrative()), 'exact PDF CJK and English source order, no normalization');
  await fs.writeFile(path.join(out, `${name}-pdf-text.json`), JSON.stringify(texts, null, 2));
  results.push({name, pages:doc.numPages, anchoredMoney:moneyCount, exactSplitCells:splitCount, landedLines:landed.length, passed:true});
  await loading.destroy();
}
await fs.writeFile(path.join(out, 'pdf-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
