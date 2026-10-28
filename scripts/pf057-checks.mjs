import assert from 'node:assert/strict';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
export const WARNING = 'SAMPLE — FICTIONAL FINANCING DEMONSTRATION';
export async function inspectPlacemat(page) {
  return page.evaluate(() => [...document.querySelectorAll('.pf057 .printform_page')].map((sheet, index) => {
    const bounds = sheet.getBoundingClientRect();
    const relative = n => {
      const b = n.getBoundingClientRect();
      return { x: b.x - bounds.x, y: b.y - bounds.y, width: b.width, height: b.height };
    };
    const outside = [];
    const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim() || node.parentElement.closest('svg')) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        const parent = node.parentElement.closest('td,th,.pf057-card,.pf057-warning,.pf057-rate,.pf057-pitch,.pf057-date') || sheet;
        const p = parent.getBoundingClientRect();
        if (r.left < bounds.left - .6 || r.right > bounds.right + .6 || r.top < bounds.top - .6 || r.bottom > bounds.bottom + .6 ||
          r.left < p.left - .6 || r.right > p.right + .6 || r.top < p.top - .6 || r.bottom > p.bottom + .6) outside.push(node.textContent.trim());
      }
    }
    const sections = [...sheet.querySelectorAll('.pf057-hero,.pf057-benefits,.pf057-guide,.pf057-footer')];
    const overlaps = sections.slice(1).filter((n, i) => n.getBoundingClientRect().top < sections[i].getBoundingClientRect().bottom - .2).map(n => n.className);
    const text = sheet.innerText;
    return { page: index + 1, lang: sheet.lang, width: bounds.width, height: bounds.height, text, outside, overlaps,
      sections: sections.map(n => ({ name: n.className, ...relative(n) })),
      heroBp: Number(sheet.querySelector('[data-hero-bp]').dataset.heroBp),
      headers: [...sheet.querySelectorAll('.pf057-tiers thead th span')].map(n => n.textContent),
      rows: [...sheet.querySelectorAll('[data-tier]')].map(n => ({ id: n.dataset.tier, text: n.innerText,
        result: Number(n.querySelector('[data-result-bp]').dataset.resultBp),
        resultText: n.querySelector('[data-result-bp]').innerText,
        incomeText: n.querySelector('.pf057-income').textContent,
        rebateText: n.querySelector('.pf057-rebate').textContent })),
      groups: [...sheet.querySelectorAll('.pf057-tiers tbody')].map(n => ({
        destination: n.dataset.group, rows: n.rows.length,
        accountSpan: n.querySelector('th').rowSpan, baseSpan: n.querySelector('.pf057-base').rowSpan,
        baseText: n.querySelector('.pf057-base').innerText })),
      noRebate: [...sheet.querySelectorAll('[data-no-rebate-bp]')].map(n => ({ bp: Number(n.dataset.noRebateBp), text: n.textContent })),
      images: [...sheet.querySelectorAll('img')].map(n => ({ src: n.getAttribute('src').slice(0, 60), loaded: n.complete && n.naturalWidth > 0 })),
      canvas: sheet.querySelectorAll('canvas').length,
      links: [...sheet.querySelectorAll('a')].map(n => n.href)
    };
  }));
}
export function assertPlacemat(report, data) {
  assert.equal(report.length, 2, 'Exactly two pages');
  const expected = [600, 500, 400, 900, 750]; // independent approved-data oracle
  for (const [index, p] of report.entries()) {
    const lang = index === 0 ? 'en' : 'ms', t = data.translations[lang];
    assert.equal(p.lang, lang);
    assert.ok(Math.abs(p.width - 210 / 25.4 * 96) < .1);
    assert.ok(Math.abs(p.height - 297 / 25.4 * 96) < .1);
    assert.deepEqual(p.outside, [], `Text bounds page ${p.page}`);
    assert.deepEqual(p.overlaps, [], `Sections page ${p.page}`);
    assert.ok(p.text.includes(WARNING)); assert.ok(p.text.includes('NOT A FINANCIAL OFFER'));
    assert.ok(p.text.includes(t.localWarning)); assert.ok(p.text.includes(t.with)); assert.ok(p.text.includes(t.without));
    assert.ok(p.text.includes(t.math)); assert.ok(p.text.includes(t.flat)); assert.ok(p.text.includes(t.condition));
    assert.ok(p.text.includes(data.period[lang])); assert.ok(p.text.includes('RM120,000'));
    assert.deepEqual(p.headers, t.headers); assert.equal(p.heroBp, 400);
    assert.deepEqual(p.rows.map(n => n.result), expected);
    assert.deepEqual(p.rows.map(n => n.resultText.split(/\s/)[0]), ['6.00%', '5.00%', '4.00%', '9.00%', '7.50%']);
    assert.deepEqual(p.rows.map(n => n.rebateText), ['25%', '37.5%', '50%', '10%', '25%']);
    const income = tier => tier.incomeMaxRM === null ? `${tier.incomeMinRM.toLocaleString('en-GB')} ${t.above}` :
      `${tier.incomeMinRM.toLocaleString('en-GB')} – ${tier.incomeMaxRM.toLocaleString('en-GB')}`;
    assert.deepEqual(p.rows.map(n => n.incomeText), data.withRebate.flatMap(g => g.tiers.map(income)));
    assert.deepEqual(p.groups.map(g => [g.destination, g.rows, g.accountSpan, g.baseSpan]), [['demo', 3, 3, 3], ['other', 2, 2, 2]]);
    assert.deepEqual(p.groups.map(g => g.baseText.split(/\s/)[0]), ['8.00%', '10.00%']);
    assert.deepEqual(p.noRebate, [{ bp: 750, text: '7.50%' }, { bp: 550, text: '5.50%' }]);
    assert.equal(p.canvas, 0); assert.deepEqual(p.links, []); assert.ok(p.images.every(n => n.loaded));
  }
  report[0].sections.forEach((s, i) => {
    assert.ok(Math.abs(s.y - report[1].sections[i].y) < .1, 'Matched bilingual section placement');
    assert.ok(Math.abs(s.height - report[1].sections[i].height) < .1, 'Matched bilingual section heights');
  });
}
export async function inspectPlacematPDF(bytes, data) {
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
  const pdf = await loading.promise, pages = [];
  try {
    assert.equal(pdf.numPages, 2);
    for (let i = 1; i <= 2; i++) {
      const page = await pdf.getPage(i), view = page.getViewport({ scale: 1 });
      assert.ok(Math.abs(view.width - 595.27559) < .5); assert.ok(Math.abs(view.height - 841.88976) < .5);
      const content = await page.getTextContent();
      const items = content.items.filter(n => n.str?.trim()).map(n => ({ text: n.str, x: n.transform[4], y: view.height - n.transform[5], width: n.width, height: n.height }));
      const text = items.map(n => n.text).join(' '), t = data.translations[i === 1 ? 'en' : 'ms'];
      // PDF.js can split a ligature into adjacent runs ("fl" + "at").
      // Compare whitespace-free text as well as validating every run's geometry.
      const compact = value => value.normalize('NFKC').replace(/\s+/g, '');
      const normalized = compact(text);
      for (const value of [WARNING, 'NOT A FINANCIAL OFFER', t.with, t.without, t.mathTitle, '6.00%', '5.00%', '4.00%', '9.00%', '7.50%', '5.50%', '37.5%', data.website, data.email]) {
        assert.ok(normalized.includes(compact(value)), `Selectable PDF text page ${i}: ${value}`);
      }
      for (const label of t.headers) assert.ok(normalized.includes(compact(label)), `PDF table header ${label}`);
      assert.ok(items.length > 90, 'Text remains vector/selectable');
      for (const item of items) {
        assert.ok(item.x >= 15 && item.x + item.width <= view.width - 15, `PDF horizontal bounds: ${item.text}`);
        assert.ok(item.y - item.height >= 5 && item.y <= view.height - 1, `PDF vertical bounds: ${item.text}`);
      }
      assert.equal((await page.getAnnotations()).length, 0, 'No hidden application/payment links');
      pages.push({ page: i, widthPt: view.width, heightPt: view.height, textItems: items.length, text });
    }
    assert.equal(await pdf.getAttachments(), null);
    return { pages, attachments: null };
  } finally { await loading.destroy(); }
}
