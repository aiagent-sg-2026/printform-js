import { expect, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { autoLayoutPaginationFixture, CELL_POLICY_FIXTURE, complexPaginationFixture, multirowPaginationFixture } from "../tests/fixtures/complex-pagination.js";

async function renderFixture(page, fixture, overrides = {}) {
  await page.goto("/index001.html");
  await page.waitForFunction(() => window.__printFormProcessed === true);
  return page.evaluate(async ({ fixture, overrides }) => {
    document.body.replaceChildren();
    document.body.style.margin = "0";
    const style = document.createElement("style");
    style.textContent = ".printform_page{margin:0;padding:0}.pheader_processed,.pdocinfo_processed,.pfooter_pagenum_processed{margin:0;padding:0}small{display:block}";
    document.head.append(style);
    const form = document.createElement("section");
    form.className = "printform authored-complex";
    form.dir = "rtl";
    form.lang = "zh-CN";
    form.style.cssText = "font:12px/18px Arial;color:rgb(20,30,40);--fixture-accent:blue";
    form.innerHTML = fixture.html;
    document.body.append(form);
    const original = Object.fromEntries(Array.from(form.querySelectorAll("[data-fixture-cell]"), cell => [cell.dataset.fixtureCell, cell.textContent]));
    const output = window.PrintForm.format(form, {
      papersizeWidth: fixture.width, papersizeHeight: fixture.height,
      insertDummyRowItemWhileFormatTable: false, insertDummyRowWhileFormatTable: false,
      insertFooterSpacerWhileFormatTable: false, insertFooterSpacerWithDummyRowItemWhileFormatTable: false,
      fillPageHeightAfterFooter: false, showPhysicalPageNumber: true, repeatFooterPagenum: true, ...overrides
    });
    const rows = Array.from(output.querySelectorAll(".prowitem_processed,.ptac-rowitem_processed,.paddt-rowitem_processed"));
    const { analyzeRowIntegrity } = await import("/studio-v2/core/row-integrity.js");
    const expectedRows = fixture.expectedRows || 1;
    const identity = analyzeRowIntegrity(rows, { expectedRowCount: expectedRows, expectedRowsByRepeat: { maintenance: expectedRows } });
    const { inspectRenderedDocument } = await import("/studio-v2/core/acceptance.js");
    const acceptance = inspectRenderedDocument(document, {}, { expectedRowCount: expectedRows, expectedRowsByRepeat: { maintenance: expectedRows } });
    const cells = Object.fromEntries(Object.keys(original).map(key => [key, rows.map(row => row.querySelector(`[data-fixture-cell="${key}"]`)?.textContent || "").join("")]));
    const rowRects = rows.map(row => {
      const rect = row.getBoundingClientRect();
      const page = row.closest(".printform_page").getBoundingClientRect();
      return { height: rect.height, inside: rect.left >= page.left - 1 && rect.right <= page.right + 1 && rect.bottom <= page.bottom + 1 };
    });
    const pages = Array.from(output.querySelectorAll(".printform_page"), page => {
      const rect = page.getBoundingClientRect();
      return {
        width: rect.width, height: rect.height, scrollHeight: page.scrollHeight,
        horizontalOverflow: Array.from(page.querySelectorAll("table,td,th,img,svg")).some(node => {
          const child = node.getBoundingClientRect();
          return child.left < rect.left - 1 || child.right > rect.right + 1 || node.scrollWidth > node.clientWidth + 1;
        }),
        numbers: Array.from(page.querySelectorAll("[data-page-number]"), node => node.textContent),
        totals: Array.from(page.querySelectorAll("[data-page-total]"), node => node.textContent)
      };
    });
    return {
      original, cells, pages, rowRects, identity: { errors: identity.errors, rows: identity.renderedRows, fragments: identity.renderedRowFragments },
      acceptance: { codes: acceptance.errors.map(error => error.code), metrics: acceptance.metrics },
      currency: Array.from(output.querySelectorAll('[data-pf-format="currency"],[data-pf-monetary="currency"]'), node => node.textContent).filter(Boolean),
      fragments: rows.map(row => ({ source: row.dataset.pfSourceRow, index: row.dataset.pfFragmentIndex, count: row.dataset.pfFragmentCount })),
      markup: { strongText: Array.from(output.querySelectorAll("strong"), node => node.textContent).join(""), emphasis: output.querySelector("em")?.textContent, comment: output.innerHTML.includes("<!--authored-marker-->") },
      presentation: { dir: output.dir, lang: output.lang, font: output.style.fontSize, accent: output.style.getPropertyValue("--fixture-accent") }
    };
  }, { fixture, overrides });
}

for (const kind of ["ptac", "paddt", "prowitem"]) {
  test(`${kind}: measured multi-cell CJK/RTL continuations conserve content and one semantic row on narrow paper`, async ({ page }) => {
    const fixture = complexPaginationFixture(kind);
    const result = await renderFixture(page, fixture);
    expect(result.cells).toEqual(result.original);
    expect(result.currency).toEqual(["MYR 123.45"]);
    expect(result.cells.quantity).toBe("2");
    expect(result.cells.amount).toBe("MYR 123.45Scope fee");
    expect(result.identity.errors).toEqual([]);
    expect(result.identity.rows).toBe(1);
    expect(result.identity.fragments).toBeGreaterThan(1);
    expect(new Set(result.fragments.map(fragment => fragment.source)).size).toBe(1);
    expect(result.fragments.map(fragment => Number(fragment.index))).toEqual(result.fragments.map((_fragment, index) => index));
    expect(result.fragments.every(fragment => Number(fragment.count) === result.fragments.length)).toBe(true);
    expect(result.markup.emphasis).toBe("\u0301");
    expect(result.markup.comment).toBe(true);
    expect(result.presentation).toEqual({ dir: "rtl", lang: "zh-CN", font: "12px", accent: "blue" });
    expect(result.rowRects.every(rect => rect.inside)).toBe(true);
    result.pages.forEach(page => {
      expect(page.width).toBeCloseTo(fixture.width, 1);
      expect(Math.max(page.height, page.scrollHeight)).toBeLessThanOrEqual(fixture.height + 1);
      expect(page.horizontalOverflow).toBe(false);
      expect(page.totals.every(total => total === String(result.pages.length))).toBe(true);
    });
    expect(result.pages.flatMap(page => page.numbers)).toEqual(result.pages.map((_page, index) => String(index + 1)));
    const wide = await renderFixture(page, complexPaginationFixture(kind, 340));
    expect(result.identity.fragments).toBeGreaterThan(wide.identity.fragments);
  });
}

test("explicit first/last/repeat cell policies affect only the opted-in cell", async ({ page }) => {
  const fixture = { html: CELL_POLICY_FIXTURE.replace('data-pf-row-repeat="policies"', 'data-pf-row-repeat="maintenance"'), width: 260, height: 100 };
  const result = await renderFixture(page, fixture);
  expect(result.cells.description).toBe(result.original.description);
  expect(result.cells.first).toBe("Q1");
  expect(result.cells.last).toBe("END");
  expect(result.cells.repeat).toBe("REF-A".repeat(result.identity.fragments));
  const positions = await page.locator(".prowitem_processed").evaluateAll(rows => rows.map(row => ({ first: row.querySelector('[data-fixture-cell="first"]').textContent, last: row.querySelector('[data-fixture-cell="last"]').textContent })));
  expect(positions[0].first).toBe("Q1");
  expect(positions.slice(1).every(row => row.first === "")).toBe(true);
  expect(positions.at(-1).last).toBe("END");
  expect(positions.slice(0, -1).every(row => row.last === "")).toBe(true);
});

test("auto-layout plain multi-cell text with separate borders fits actual narrow-paper budgets", async ({ page }) => {
  const fixture = autoLayoutPaginationFixture();
  const result = await renderFixture(page, fixture);
  expect(result.cells).toEqual(result.original);
  expect(result.currency).toEqual(["MYR 123.45"]);
  expect(result.cells.quantity).toBe("2");
  expect(result.identity.errors).toEqual([]);
  expect(result.identity.rows).toBe(1);
  expect(result.identity.fragments).toBeGreaterThan(1);
  expect(result.rowRects.every(rect => rect.inside)).toBe(true);
  expect(result.pages.every(page => !page.horizontalOverflow && Math.max(page.height, page.scrollHeight) <= fixture.height + 1)).toBe(true);
  expect(result.pages.flatMap(page => page.numbers)).toEqual(result.pages.map((_page, index) => String(index + 1)));
});

test("a PADDT readability ceiling supplements rather than replaces width measurement", async ({ page }) => {
  const fixture = complexPaginationFixture("paddt");
  fixture.html = fixture.html.replace(/<span>مُراجعة[\s\S]*?<\/span><\/td>/, '<span>one <b>two three</b> four five six</span></td>');
  const result = await renderFixture(page, fixture, { paddtMaxWordsPerSegment: 2.9 });
  expect(result.cells).toEqual(result.original);
  expect(result.currency).toEqual(["MYR 123.45"]);
  expect(result.pages.every(page => !page.horizontalOverflow && page.height <= fixture.height + 0.01)).toBe(true);
  const rtlChunks = await page.locator('[data-fixture-cell="rtl"]').allTextContents();
  expect(rtlChunks.filter(Boolean).every(text => (text.match(/\S+/g) || []).length <= 2)).toBe(true);
});

test("reserved author continuation metadata cannot conceal a duplicate source row", async ({ page }) => {
  await page.goto("/index001.html");
  await page.waitForFunction(() => window.__printFormProcessed === true);
  const result = await page.evaluate(async () => {
    document.body.replaceChildren();
    const form = document.createElement("div");
    form.className = "printform";
    form.innerHTML = [0, 1].map(index => `<div class="prowitem" data-pf-row-repeat="forged" data-pf-row-index="0" data-pf-source-row="forged" data-pf-fragment-index="${index}" data-pf-fragment-count="2">MYR 10.00</div>`).join("");
    document.body.append(form);
    const output = window.PrintForm.format(form, { insertDummyRowItemWhileFormatTable: false });
    const { analyzeRowIntegrity } = await import("/studio-v2/core/row-integrity.js");
    const rows = Array.from(output.querySelectorAll(".prowitem_processed"));
    const report = analyzeRowIntegrity(rows, { expectedRowCount: 1, expectedRowsByRepeat: { forged: 1 } });
    return { reserved: rows.some(row => row.hasAttribute("data-pf-fragment-index")), rows: report.renderedRows, errors: report.errors.map(error => error.code), text: rows.map(row => row.textContent) };
  });
  expect(result.reserved).toBe(false);
  expect(result.rows).toBe(2);
  expect(result.errors).toEqual(expect.arrayContaining(["ROW_DUPLICATE_INDEX", "ROW_COUNT_MISMATCH"]));
  expect(result.text).toEqual(["MYR 10.00", "MYR 10.00"]);
});

test("genuinely atomic image/chrome failure rolls back original DOM and listeners", async ({ page }) => {
  await page.goto("/index001.html");
  await page.waitForFunction(() => window.__printFormProcessed === true);
  const result = await page.evaluate(() => {
    document.body.replaceChildren();
    const form = document.createElement("section");
    form.className = "printform";
    form.innerHTML = '<div class="pheader" style="height:20px">Fictional header</div><table class="prowitem"><tr><td><svg width="30" height="300" aria-label="Authored atomic symbol"><rect width="30" height="300" /></svg></td><td>MYR 1.00</td></tr></table>';
    document.body.append(form);
    const sourceRow = form.lastElementChild;
    const before = form.outerHTML;
    let clicks = 0;
    sourceRow.addEventListener("click", () => { clicks += 1; });
    let error = "";
    try { window.PrintForm.format(form, { papersizeHeight: 100, papersizeWidth: 260, insertDummyRowItemWhileFormatTable: false }); }
    catch (caught) { error = caught.name; }
    sourceRow.click();
    return { error, intact: form.outerHTML === before, sameRow: sourceRow === form.lastElementChild, clicks, output: document.querySelectorAll(".printform_formatter,.printform_formatter_processed").length };
  });
  expect(result.error).toBe("RangeError");
  expect(result).toMatchObject({ intact: true, sameRow: true, clicks: 1, output: 0 });
});

for (const options of [{ rowspan: false }, { rowspan: true }, { rowspan: true, zeroSpan: true }, { rowspan: true, spanningText: true }, { rowspan: true, packedRows: true }]) {
  test(`multirow claim ${JSON.stringify(options)} conserves every source cell across semantic table windows`, async ({ page, browserName }, info) => {
    const fixture = multirowPaginationFixture(options);
    const result = await renderFixture(page, fixture);
    for (const [key, text] of Object.entries(result.original)) {
      if (key !== "reference") expect(result.cells[key], key).toBe(text);
    }
    expect(result.cells.reference).toMatch(/^(REF-C)+$/);
    expect(result.currency).toEqual(["MYR 123.45", "MYR 67.89", "MYR 10.00"]);
    expect(result.identity.errors).toEqual([]);
    expect(result.identity.rows).toBe(2);
    expect(result.identity.fragments).toBeGreaterThan(2);
    expect(result.acceptance.codes.filter(code => code.startsWith("ROW_"))).toEqual([]);
    expect(result.acceptance.metrics.renderedRows).toBe(2);
    expect(result.acceptance.metrics.renderedRowFragments).toBe(result.identity.fragments);
    expect(result.rowRects.every(rect => rect.inside)).toBe(true);
    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.pages.every(page => !page.horizontalOverflow && Math.max(page.height, page.scrollHeight) <= fixture.height + 1)).toBe(true);
    const semantics = await page.locator(".prowitem_processed").evaluateAll(tables => ({
      rows: tables.flatMap(table => Array.from(table.rows, row => row.cells.length)),
      spans: tables.flatMap(table => Array.from(table.querySelectorAll('[data-fixture-cell="identity"]'), cell => ({ span: cell.rowSpan, rows: table.rows.length, tag: cell.tagName, scope: cell.getAttribute("scope") }))),
      links: tables.flatMap(table => Array.from(table.querySelectorAll("a"), link => link.getAttribute("href"))),
      dangling: tables.some(table => Array.from(table.querySelectorAll("th,td")).some(cell => cell.rowSpan > table.rows.length))
    }));
    expect(semantics.dangling).toBe(false);
    expect(semantics.rows.every(count => count > 0)).toBe(true);
    expect(semantics.links.every(href => href === "https://example.invalid/claim")).toBe(true);
    if (options.rowspan) expect(semantics.spans.every(cell => cell.tag === "TH" && cell.scope === "rowgroup")).toBe(true);
    if (options.packedRows) {
      expect(semantics.spans.some(cell => cell.span > 1)).toBe(true);
      expect(semantics.spans.length).toBeGreaterThan(1);
    }
    expect(result.markup.comment).toBe(true);
    await page.emulateMedia({ media: "print" });
    const printBounds = await page.locator(".prowitem_processed").evaluateAll(rows => rows.every(row => {
      const bounds = row.getBoundingClientRect(), page = row.closest(".printform_page").getBoundingClientRect();
      return bounds.left >= page.left - 1 && bounds.right <= page.right + 1 && bounds.bottom <= page.bottom + 1;
    }));
    expect(printBounds).toBe(true);
    if (browserName === "chromium" && options.packedRows) {
      await page.addStyleTag({ content: `@page { size:${fixture.width}px ${fixture.height}px; margin:0 } @media print { .physical_page_wrapper { break-inside:avoid; margin:0!important } }` });
      const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true, scale: 1, displayHeaderFooter: false });
      await info.attach("multirow-claim.pdf", { body: bytes, contentType: "application/pdf" });
      const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
      try {
        const pdf = await loading.promise, text = [];
        expect(pdf.numPages).toBe(result.pages.length);
        for (let number = 1; number <= pdf.numPages; number += 1) {
          const physical = await pdf.getPage(number), viewport = physical.getViewport({ scale: 1 });
          expect(Math.abs(viewport.width - fixture.width * 72 / 96)).toBeLessThan(1);
          expect(Math.abs(viewport.height - fixture.height * 72 / 96)).toBeLessThan(1);
          const content = await physical.getTextContent();
          for (const item of content.items.filter(item => item.str?.trim())) {
            expect(item.transform[4]).toBeGreaterThanOrEqual(-1);
            expect(item.transform[4] + item.width).toBeLessThanOrEqual(viewport.width + 1);
            expect(item.transform[5]).toBeGreaterThanOrEqual(-1);
            expect(item.transform[5]).toBeLessThanOrEqual(viewport.height + 1);
          }
          text.push(content.items.map(item => item.str || "").join(""));
        }
        const allText = text.join("");
        for (const token of ["123.45", "67.89", "10.00", "CLAIM-A"]) expect(allText.split(token)).toHaveLength(2);
      } finally { await loading.destroy(); }
    }
  });
}

test("nested table and multirow atomic content fail without leaving partial continuation output", async ({ page }) => {
  await page.goto("/index001.html");
  await page.waitForFunction(() => window.__printFormProcessed === true);
  const result = await page.evaluate(() => {
    document.body.replaceChildren();
    const form = document.createElement("section");
    form.className = "printform";
    form.innerHTML = '<table class="prowitem"><tbody><tr><td rowspan="2">Authored scope</td><td>Initial row</td></tr><tr><td><table style="height:300px"><tr><td>Indivisible nested table</td></tr></table></td></tr></tbody></table>';
    document.body.append(form);
    const source = form.firstElementChild, before = form.outerHTML;
    let clicks = 0;
    source.addEventListener("click", () => { clicks += 1; });
    let error = "";
    try { window.PrintForm.format(form, { papersizeHeight: 100, papersizeWidth: 260, insertDummyRowItemWhileFormatTable: false }); }
    catch (caught) { error = caught.name; }
    source.click();
    return { error, same: source === form.firstElementChild, intact: before === form.outerHTML, clicks, output: document.querySelectorAll(".printform_formatter,.printform_formatter_processed").length };
  });
  expect(result.error).toBe("RangeError");
  expect(result).toMatchObject({ same: true, intact: true, clicks: 1, output: 0 });
});
