import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const out = path.resolve(import.meta.dirname, '../../artifacts/lumen'), compact = s => s.replace(/\s/g, '');
const names = (process.env.LUMEN_PDF_NAMES || 'default,small,stress,long,metadata,missing,zero,all-missing,zero-observed-planned-not-observed,zero-denominator,multi-domain,standalone-default,standalone-long,offline-default,offline-long').split(',');
const results = [];
for (const name of names) {
  const dom = JSON.parse(await fs.readFile(path.join(out, `${name}-dom.json`)));
  const load = getDocument({data:new Uint8Array(await fs.readFile(path.join(out, `${name}.pdf`))), useSystemFonts:false}), doc = await load.promise;
  assert.equal(doc.numPages, dom.pages); const texts = [], coordinates = []; let count = 0;
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number), view = page.getViewport({scale:1});
    assert.ok(Math.abs(view.width - 210 * 72 / 25.4) < 1 && Math.abs(view.height - 297 * 72 / 25.4) < 1, 'real portrait A4');
    const {items} = await page.getTextContent(), text = items.map(i => i.str).join(' '); texts.push(text);
    assert.match(text, /LUMEN \/ LEARNING PORTFOLIO/);
    assert.match(text, /FICTIONAL LEARNING PORTFOLIO — DEMO ONLY/);
    assert.match(text, new RegExp(`Page\\s+${number}\\s+of\\s+${doc.numPages}\\b`));
    assert.doesNotMatch(text, /Print \/ Save PDF|Preparing the fictional|NaN|undefined|Infinity/);
    const nonempty = items.filter(i => i.str.trim());
    assert.ok(nonempty.length > 12, 'not a blank page');
    for (const i of nonempty) {
      assert.ok(i.transform[4] >= 33 && i.transform[4] + i.width <= view.width - 33, `${name}/${number} horizontal ${i.str}`);
      assert.ok(i.transform[5] >= 32 && i.transform[5] <= view.height - 32, `${name}/${number} vertical ${i.str}`);
      assert.ok(i.height >= 9.49, `${name}/${number} readable minimum ${i.height}`);
    }
    for (const c of dom.cells.filter(c => c.page === number)) {
      const left = 12 * 72 / 25.4 + c.x * .75, right = left + c.width * .75;
      const top = 12 * 72 / 25.4 + c.y * .75, bottom = top + c.height * .75;
      const hits = items.filter(i => i.str.trim() && i.transform[4] >= left - .7 && i.transform[4] + i.width <= right + .7 && view.height - i.transform[5] >= top - .5 && view.height - i.transform[5] <= bottom + .5);
      assert.equal(compact(hits.map(i => i.str).join('')), compact(c.text), `${name}/${number} exact anchored cell text`); count++;
    }
    coordinates.push(nonempty.map(i => ({text:i.str, x:i.transform[4], y:i.transform[5], width:i.width, height:i.height})));
  }
  await fs.writeFile(path.join(out, `${name}-pdf-text.json`), JSON.stringify(texts, null, 2));
  await fs.writeFile(path.join(out, `${name}-pdf-coordinates.json`), JSON.stringify(coordinates, null, 2));
  if (/^(standalone|offline)-/.test(name)) {
    const other = name.replace(/^(standalone|offline)-/, '');
    assert.deepEqual(texts, JSON.parse(await fs.readFile(path.join(out, `${other}-pdf-text.json`))), 'Gallery/standalone/offline exact PDF text');
    assert.deepEqual(coordinates, JSON.parse(await fs.readFile(path.join(out, `${other}-pdf-coordinates.json`))), 'Gallery/standalone/offline exact PDF coordinates');
  }
  results.push({name, pages:doc.numPages, anchoredExactCells:count, passed:true}); await load.destroy();
}
await fs.writeFile(path.join(out, 'pdf-results.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(results));
