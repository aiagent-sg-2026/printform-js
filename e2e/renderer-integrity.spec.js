import { expect, test } from "@playwright/test";

async function render(page, html, overrides = {}, rootStyle = "") {
  await page.goto("/index001.html");
  return page.evaluate(({ html, overrides, rootStyle }) => {
    document.querySelectorAll(".printform_formatter_processed, .div_page_break_before").forEach((node) => node.remove());
    const form = document.createElement("div");
    form.className = "printform invoice-context";
    form.style.cssText = `font:12px/12px Arial;color:rgb(180,0,0);${rootStyle}`;
    form.innerHTML = html;
    document.body.appendChild(form);
    const output = window.PrintForm.format(form, {
      papersizeWidth: 300, papersizeHeight: 150,
      insertDummyRowItemWhileFormatTable: false,
      insertDummyRowWhileFormatTable: false,
      insertFooterSpacerWhileFormatTable: false,
      insertFooterSpacerWithDummyRowItemWhileFormatTable: false,
      fillPageHeightAfterFooter: false,
      ...overrides
    });
    const pages = Array.from(output.querySelectorAll(".printform_page"));
    return {
      text: output.textContent,
      rowTexts: Array.from(output.querySelectorAll(".ptac-rowitem_processed, .paddt-rowitem_processed"), (node) => node.textContent),
      pages: pages.map((node) => ({
        height: node.getBoundingClientRect().height,
        headers: Array.from(node.querySelectorAll(".prowheader_processed"), (header) => header.dataset.pfTableId || "default"),
        dummyCount: node.querySelectorAll(".prowitem_dummy").length,
        numbers: Array.from(node.querySelectorAll("[data-page-number]"), (marker) => marker.textContent),
        totals: Array.from(node.querySelectorAll("[data-page-total]"), (marker) => marker.textContent),
        physical: Array.from(node.querySelectorAll("[data-physical-page-number]"), (marker) => marker.textContent),
        rows: Array.from(node.querySelectorAll(".prowitem_processed"), (row) => row.dataset.pfTableId)
      })),
      color: getComputedStyle(output.querySelector(".value") || output).color,
      fontSize: getComputedStyle(output.querySelector(".value") || output).fontSize,
      stillAutoProcessable: output.classList.contains("printform")
    };
  }, { html, overrides, rootStyle });
}

for (const kind of ["ptac", "paddt"]) {
  test(`${kind} conserves mixed text and uses integer API segmentation`, async ({ page }) => {
    const result = await render(page, `<table class="${kind}" style="border-spacing:0"><tr><td style="padding:0"><div>Prefix &lt;<!--note--><p style="margin:0">one <b>two three</b></p> Tail &amp;</div></td></tr></table>`, {
      paddtMaxWordsPerSegment: 1.5
    });
    expect(result.rowTexts.join("")).toBe("Prefix <one two three Tail &");
    if (kind === "paddt") expect(result.rowTexts).toHaveLength(3);
    result.pages.forEach(({ height }) => expect(height).toBeLessThanOrEqual(150.01));
  });
}

test("preserves root typography and amount strings", async ({ page }) => {
  const result = await render(page, '<div class="prowitem value">MYR 123.45</div>', {}, "font-size:28px;line-height:30px;--accent:blue");
  expect(result.text).toContain("MYR 123.45");
  expect(result.fontSize).toBe("28px");
  expect(result.color).toBe("rgb(180, 0, 0)");
  expect(result.stillAutoProcessable).toBe(false);
});

for (const [row, options] of [
  ['<div class="prowitem without_prowheader" style="height:20px">row</div>', {}],
  ['<table class="ptac"><tr><td><p>terms</p></td></tr></table>', { repeatPtacRowheader: false }],
  ['<table class="paddt"><tr><td><p>appendix</p></td></tr></table>', { repeatPaddtRowheader: false }]
]) {
  test(`does not reinsert skipped active table chrome: ${Object.keys(options)[0] || "row class"}`, async ({ page }) => {
    const result = await render(page, '<div class="prowheader" style="height:12px">columns</div>' + row, options);
    const pages = row.includes('class="paddt"') ? result.pages.slice(1) : result.pages;
    expect(pages.flatMap(({ headers }) => headers)).toEqual([]);
  });
}

test("renders second nonrepeating table header once, including inherited-property IDs", async ({ page }) => {
  let html = '<div class="prowheader" data-pf-table-id="A" style="height:12px">A columns</div><div class="prowitem" data-pf-table-id="A" style="height:30px">A row</div>';
  html += '<div class="prowheader" data-pf-table-id="__proto__" data-pf-repeat-rowheader="false" style="height:12px">B columns</div>';
  html += Array.from({ length: 8 }, (_, index) => `<div class="prowitem" data-pf-table-id="__proto__" style="height:30px">B ${index}</div>`).join("");
  const result = await render(page, html, { papersizeHeight: 100 });
  expect(result.pages.flatMap(({ headers }) => headers).filter((id) => id === "__proto__")).toHaveLength(1);
  expect(result.pages.flatMap(({ rows }) => rows).filter((id) => id === "__proto__")).toHaveLength(8);
  result.pages.forEach(({ height }) => expect(height).toBeLessThanOrEqual(100.01));
});

test("does not consume a different table footer as a subtotal combination", async ({ page }) => {
  const result = await render(page, '<div class="prowheader" data-pf-table-id="A" style="height:12px">A</div><div class="prowitem prowitem_subtotal" data-pf-table-id="A" style="height:20px">subtotal 1.00</div><div class="prowheader" data-pf-table-id="B" style="height:12px">B</div><div class="prowitem prowitem_footer" data-pf-table-id="B" style="height:20px">footer 2.00</div>');
  expect(result.pages.flatMap(({ headers }) => headers)).toEqual(["A", "B"]);
  expect(result.text).toContain("subtotal 1.00");
  expect(result.text).toContain("footer 2.00");
});

test("custom dummy uses actual height and reserves the special row safely", async ({ page }) => {
  const html = '<div class="prowitem" style="height:20px">item</div><div class="prowitem prowitem_footer" style="height:10px;font-size:8px;line-height:10px">total</div>';
  const options = {
    papersizeHeight: 100, insertDummyRowItemWhileFormatTable: true,
    heightOfDummyRowItem: 10,
    customDummyRowItemContent: '<table class="custom-filler" style="height:30px;border-spacing:0"><tr><td style="padding:0"></td></tr></table>'
  };
  const enabled = await render(page, html, options);
  expect(enabled.pages[0].dummyCount).toBe(2);
  expect(enabled.pages[0].height).toBeLessThanOrEqual(100.01);
  const disabled = await render(page, html, { ...options, insertDummyRowItemWhileFormatTable: "false" });
  expect(disabled.pages[0].dummyCount).toBe(0);
});

test("all-zero rows still render chrome; root and descendant page markers cover all chrome", async ({ page }) => {
  const result = await render(page, '<div class="pheader" style="height:12px" data-page-number>?</div><div class="pdocinfo" style="height:12px"><span data-page-total>?</span></div><div class="prowitem" style="height:0;overflow:hidden"></div><div class="pfooter" style="height:12px" data-physical-page-number>?</div><div class="pfooter_pagenum" style="height:12px" data-page-number>?</div>', { showPhysicalPageNumber: true });
  expect(result.pages[0].numbers).toEqual(["1", "1"]);
  expect(result.pages[0].totals).toEqual(["1"]);
  expect(result.pages[0].physical).toEqual(["1"]);
});

test("string boolean overrides disable continuation header but retain all page-number totals", async ({ page }) => {
  const rows = Array.from({ length: 6 }, (_, index) => `<div class="prowitem" style="height:50px">row ${index}</div>`).join("");
  const result = await render(page, '<div class="pheader" style="height:12px" data-page-number>?</div>' + rows + '<div class="pfooter" style="height:12px"><span data-page-total>?</span></div>', { repeatHeader: "false", repeatFooter: "true", papersizeHeight: 100 });
  expect(result.pages.length).toBeGreaterThan(1);
  expect(result.pages.flatMap(({ numbers }) => numbers)).toEqual(["1"]);
  expect(result.pages.flatMap(({ totals }) => totals).every((value) => value === String(result.pages.length))).toBe(true);
});

test("unsplittable oversized content reports layout failure and leaves source untouched", async ({ page }) => {
  await page.goto("/index001.html");
  const result = await page.evaluate(() => {
    document.querySelectorAll(".printform_formatter_processed, .div_page_break_before").forEach((node) => node.remove());
    const form = document.createElement("div");
    form.className = "printform";
    form.innerHTML = '<div class="pheader" style="height:10px">header</div><div class="prowitem" style="height:500px">oversized</div>';
    document.body.appendChild(form);
    const before = form.outerHTML;
    const row = form.lastElementChild;
    let error = "";
    try { window.PrintForm.format(form, { papersizeHeight: 100, insertDummyRowItemWhileFormatTable: false, fillPageHeightAfterFooter: false }); }
    catch (caught) { error = caught.message; }
    return { error, intact: form.outerHTML === before, sameRow: form.lastElementChild === row, connected: form.isConnected, partialOutputs: document.querySelectorAll(".printform_formatter, .printform_formatter_processed").length };
  });
  expect(result.error).toContain("exceeds configured height");
  expect(result).toMatchObject({ intact: true, sameRow: true, connected: true, partialOutputs: 0 });
});

test("keeps a nonrepeating table's first header with an explicit page-break row", async ({ page }) => {
  const result = await render(page, '<div class="prowheader" data-pf-table-id="A" style="height:12px">A</div><div class="prowitem" data-pf-table-id="A" style="height:20px">A row</div><div class="prowheader" data-pf-table-id="B" data-pf-repeat-rowheader="false" style="height:12px">B</div><div class="prowitem tb_page_break_before" data-pf-table-id="B" style="height:20px">B row</div>');
  const firstBPage = result.pages.find(({ rows }) => rows.includes("B"));
  expect(firstBPage.headers).toContain("B");
  expect(result.pages.flatMap(({ headers }) => headers).filter((id) => id === "B")).toHaveLength(1);
});
