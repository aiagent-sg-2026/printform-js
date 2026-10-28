import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {reconcile} from '../gallery/designs/assets/aster/reconcile.mjs';
import {longNarrative} from '../gallery/designs/assets/aster/fixtures.mjs';
import {ready, inspect} from './aster-browser-checks.mjs';
const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(root, '../artifacts');
const html = await fs.readFile(path.join(root, 'gallery/designs/aster-three-way-match-review-pack.html'), 'utf8');
const sample = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/aster/sample.json')));
const url = `${process.env.ASTER_BASE_URL || 'http://127.0.0.1:4197'}/gallery/designs/aster-three-way-match-review-pack.html`;
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
const results = [], errors = [];
const compact = text => text.replace(/\s/g, '');
const custom = () => {
  const data = structuredClone(sample);
  data.document.id = 'PACK-42 <b> & "literal"';
  data.receipts[2].lines[1].returnReference = 'RET-42 <img src=x onerror=alert(1)> & "literal"';
  return data;
};
const cases = [
  {name:'custom-long', notes:'long', amend:() => {}, refs:['RET-42 <img src=x onerror=alert(1)> & "literal"']},
  {name:'multiple', amend:data => {
    const receipt = data.receipts[2];
    receipt.lines.push(
      {...receipt.lines[1], id:'RETURN-DUPLICATE', receivedQty:1, returnedQty:1},
      {...receipt.lines[1], id:'RETURN-SECOND', receivedQty:1, returnedQty:1, returnReference:'RET-SECOND & <b>literal</b>'}
    );
    receipt.lines[0].returnReference = 'NOT-A-RETURN';
  }, refs:['RET-42 <img src=x onerror=alert(1)> & "literal"', 'RET-SECOND & <b>literal</b>']},
  {name:'null-reference', amend:data => {data.receipts[2].lines[1].returnReference = null;}, refs:[], missing:'references: not supplied'},
  {name:'empty-reference', amend:data => {data.receipts[2].lines[1].returnReference = '';}, refs:[], missing:'references: not supplied'},
  {name:'mixed-reference', amend:data => {
    const receipt = data.receipts[2];
    receipt.lines.push({...receipt.lines[1], id:'RETURN-MISSING', receivedQty:1, returnedQty:1, returnReference:null});
  }, refs:['RET-42 <img src=x onerror=alert(1)> & "literal"'], missing:'(some not supplied)'},
  {name:'no-return', amend:data => {data.receipts[2].lines[1].returnedQty = 0;}, refs:[]}
];
async function checkPDF(name, data, dom, test) {
  const loading = getDocument({data:new Uint8Array(await fs.readFile(path.join(out, `${name}.pdf`))), useSystemFonts:false});
  try {
    const doc = await loading.promise, texts = [];
    assert.equal(doc.numPages, dom.pages);
    let anchored = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n), view = page.getViewport({scale:1});
      assert.ok(Math.abs(view.width - 297 * 72 / 25.4) < 1 && Math.abs(view.height - 210 * 72 / 25.4) < 1);
      const {items} = await page.getTextContent(), text = items.map(i => i.str).join(' ');
      texts.push(text);
      assert.match(text, /SAMPLE · fictional data · not an approval or payment instruction/);
      assert.match(text, new RegExp(`Page\\s+${n}\\s*/\\s*${doc.numPages}\\b`));
      // Actual custom ID must occur in both repeated header and repeated footer.
      assert.equal(compact(text).split(compact(data.document.id)).length - 1, 2);
      assert.doesNotMatch(text, /ASTER-REVIEW-DEMO-001|RET-DEMO-018|\b(?:NaN|undefined|Infinity)\b/);
      if (n < doc.numPages) assert.doesNotMatch(text, /Demo only · blank print space/);
      else assert.match(text, /Prepared by.*Reviewed by.*Review date/);
      for (const item of items) if (item.str.trim()) {
        assert.ok(item.transform[4] >= 32 && item.transform[4] + item.width <= view.width - 32, `${name}/${n} horizontal bounds`);
        assert.ok(item.transform[5] >= 27 && item.transform[5] <= view.height - 27, `${name}/${n} vertical bounds`);
        assert.ok(item.height >= 9.49, `${name}/${n} minimum font size`);
      }
      for (const field of dom.monetaryRects.filter(r => r.page === n)) {
        const x = 12 * 72 / 25.4 + field.x * .75;
        const top = 10 * 72 / 25.4 + field.y * .75, bottom = top + field.height * .75;
        const hits = items.filter(i => i.str === field.text && Math.abs(i.transform[4] - x) < 1.5 && view.height - i.transform[5] >= top - 1.5 && view.height - i.transform[5] <= bottom + 1.5);
        assert.equal(hits.length, 1, `${name}/${n} once-only anchored money ${field.id}`); anchored++;
      }
    }
    assert.equal(anchored, dom.monetaryRects.length);
    assert.equal(dom.lineMoney.length, 24);
    const text = compact(texts.join(''));
    for (const ref of test.refs) assert.ok(text.includes(compact(ref)), `PDF actual return reference: ${ref}`);
    if (test.missing) assert.ok(text.includes(compact(test.missing)));
    if (test.name === 'no-return') assert.ok(!text.includes('RET-42'));
    if (test.notes === 'long') {
      const cjk = value => (value.match(/[\u4e00-\u9fff]/g) || []).join('');
      assert.equal(cjk(texts.join('')), cjk(longNarrative()), 'exact PDF CJK source order');
      assert.equal(text.split('Thisfictionalreviewnarrativetestsreadablecontinuation').length - 1, 5);
      assert.match(text, /Endofbilingualfictionalnarrative/);
    }
    await fs.writeFile(path.join(out, `${name}-pdf-text.json`), JSON.stringify(texts, null, 2));
    return anchored;
  } finally { await loading.destroy(); }
}
try {
  const baselinePage = await browser.newPage();
  baselinePage.on('pageerror', error => errors.push(error.message));
  await baselinePage.goto(url); await ready(baselinePage);
  const baseline = await inspect(baselinePage, reconcile(sample), {detail:'all', notes:'standard'});
  await baselinePage.close();
  for (const test of cases) {
    const data = custom(); test.amend(data);
    const report = reconcile(data), state = {detail:'all', notes:test.notes || 'standard'};
    // Quantities are fixed for metadata-only cases. Added return rows have zero net EA.
    if (['custom-long', 'null-reference', 'empty-reference'].includes(test.name)) assert.deepEqual(report.totals, reconcile(sample).totals);
    assert.equal(report.totals.invoiceCanonicalTotalCents, 600250);
    assert.equal(report.totals.poOrderValueCents, 615000);
    const page = await browser.newPage({viewport:{width:1400,height:1100}});
    page.on('pageerror', error => errors.push(error.message));
    // Use the rebuilt standalone app, changing ONLY its embedded JSON fixture.
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    const modified = html.replace(/(<script type="application\/json" id="sample-data">)[\s\S]*?(<\/script>)/, (_, open, close) => open + json + close);
    assert.notEqual(modified, html);
    await page.route(url, route => route.fulfill({status:200, contentType:'text/html', body:modified}));
    await page.goto(url); await ready(page);
    if (test.notes) { await page.selectOption('#notes', test.notes); await ready(page); }
    const dom = await inspect(page, report, state);
    assert.deepEqual(await page.evaluate(() => ASTER_RESULT.totals), report.totals);
    if (test.name !== 'no-return') assert.deepEqual(dom.allMoney, baseline.allMoney, 'all financial fields unchanged');
    else assert.deepEqual(dom.lineMoney, baseline.lineMoney, 'canonical financial lines unchanged');
    const actual = await page.evaluate(() => ({
      chrome:[...document.querySelectorAll('#preview .running-header,#preview .running-footer')].map(n => n.textContent),
      text:document.querySelector('#preview').textContent,
      unsafe:document.querySelectorAll('#preview [onerror],#preview .running-header b b,#preview .running-footer b b').length,
      sources:[...document.querySelectorAll('#preview table[data-pf-table-id="sources"]')].map(n => [...n.querySelectorAll('td')].map(c => c.textContent))
    }));
    assert.equal(actual.chrome.length, dom.pages * 2);
    for (const text of actual.chrome) assert.ok(text.includes(data.document.id));
    assert.equal(actual.unsafe, 0);
    assert.doesNotMatch(actual.text, /ASTER-REVIEW-DEMO-001|RET-DEMO-018/);
    const scope = actual.sources.find(cells => cells[0].startsWith(`${data.receipts[2].id} / `))[2];
    for (const ref of test.refs) assert.equal(scope.split(ref).length - 1, 1, 'distinct actual receipt references');
    assert.ok(!scope.includes('NOT-A-RETURN'));
    for (const cells of actual.sources.filter(cells => !cells[0].startsWith(`${data.receipts[2].id} / `))) assert.ok(!cells[2].includes('RET-42'));
    if (test.missing) assert.ok(scope.includes(test.missing));
    if (test.name === 'no-return') assert.equal(scope, 'Gross receipt quantities, with attached return summary fields.');
    const name = `aster-metadata-${test.name}`;
    await page.emulateMedia({media:'print'});
    await inspect(page, report, state);
    await page.pdf({path:path.join(out, `${name}.pdf`), preferCSSPageSize:true, printBackground:true});
    await fs.writeFile(path.join(out, `${name}-dom.json`), JSON.stringify(dom, null, 2));
    await page.emulateMedia({media:'screen'});
    await page.locator('.physical_page_wrapper').last().screenshot({path:path.join(out, `${name}-last.png`)});
    const anchoredMonetaryFields = await checkPDF(name, data, dom, test);
    results.push({name, pages:dom.pages, actualDocumentId:data.document.id, receiptScope:scope, anchoredMonetaryFields, passed:true});
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await fs.writeFile(path.join(out, 'aster-metadata-results.json'), JSON.stringify({results, errors}, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
