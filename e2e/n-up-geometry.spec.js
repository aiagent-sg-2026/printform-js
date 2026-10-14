import { expect, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { fictionalNUpConfig, fictionalNUpHtml, fictionalNUpRows } from "../tests/fixtures/n-up-fictional.js";

async function render(page, options) {
  await page.goto("/index001.html");
  await page.evaluate(({ html, config, options }) => {
    // Isolated authored fixture; reproduce external wrapper geometry without Studio edits.
    document.head.querySelectorAll('style,link[rel="stylesheet"]').forEach((node) => node.remove());
    document.body.replaceChildren();
    const style = document.createElement("style");
    style.textContent = `* {box-sizing:border-box} body {margin:0}
      #fixture {font:10px/16px Arial;color:rgb(23,45,67)}
      #fixture .printform_page {margin-bottom:24px;background:white}
      #fixture .physical_page_wrapper {padding:${options.padding}px;width:999px!important;margin-bottom:24px}
      ${options.config.nUp === 1 ? "#fixture .physical_page_wrapper .printform_page {margin:0}" : ""}
      @media print {#fixture .physical_page_wrapper {margin:0}}`;
    document.head.append(style);
    const mount = document.createElement("main");
    mount.id = "fixture";
    const form = document.createElement("section");
    form.className = "printform fictional-lantern-context";
    form.dir = options.rtl ? "rtl" : "ltr";
    form.style.setProperty("--fictional-ink", "#172d43");
    form.innerHTML = html;
    mount.append(form);
    document.body.append(mount);
    window.PrintForm.format(form, { ...config, ...options.config });
  }, { html: fictionalNUpHtml, config: fictionalNUpConfig, options });
}

async function geometry(page) {
  return page.evaluate(() => {
    const rectangle = (node) => {
      const r = node.getBoundingClientRect();
      return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
    };
    const output = document.querySelector(".printform_formatter_processed");
    return {
      root: { dir:output.dir, ink:output.style.getPropertyValue("--fictional-ink"), context:output.classList.contains("fictional-lantern-context") },
      rows: [...output.querySelectorAll(".prowitem_processed")].map((node) => node.textContent),
      sheets: [...output.querySelectorAll(".physical_page_wrapper")].map((sheet) => ({
        rect: rectangle(sheet), number: Number(sheet.dataset.pfPhysicalPage),
        cells: [...sheet.querySelectorAll(".printform_n_up_cell")].map((cell) => {
          const logical = cell.firstElementChild;
          return {
            rect:rectangle(cell), page:rectangle(logical),
            logical:Number(logical.dataset.pfLogicalPage), physical:Number(logical.dataset.pfPhysicalPage),
            scale:Number(logical.dataset.pfLogicalScale),
            logicalWidth:Number(logical.dataset.pfLogicalWidth), logicalHeight:Number(logical.dataset.pfLogicalHeight),
            direction:getComputedStyle(logical).direction,
            clipping:[sheet,cell,logical].some((node) => ["hidden","clip"].includes(getComputedStyle(node).overflow)),
            pageNumbers:[...logical.querySelectorAll("[data-page-number]")].map((node) => node.textContent),
            totals:[...logical.querySelectorAll("[data-page-total]")].map((node) => node.textContent),
            sheetNumbers:[...logical.querySelectorAll("[data-physical-page-number]")].map((node) => node.textContent)
          };
        })
      }))
    };
  });
}

function contained(inner, outer) {
  expect(inner.left).toBeGreaterThanOrEqual(outer.left - 1);
  expect(inner.top).toBeGreaterThanOrEqual(outer.top - 1);
  expect(inner.right).toBeLessThanOrEqual(outer.right + 1);
  expect(inner.bottom).toBeLessThanOrEqual(outer.bottom + 1);
}

function checkGeometry(result, options) {
  expect(result.root).toEqual({ dir: options.rtl ? "rtl" : "ltr", ink:"#172d43", context:true });
  expect(result.rows).toEqual(fictionalNUpRows.map(([id, amount]) => `${id} ${amount}`));
  expect(result.sheets).toHaveLength(Math.ceil(7 / options.config.nUp));
  const all = result.sheets.flatMap((sheet) => sheet.cells);
  expect(all.map((cell) => cell.logical)).toEqual([1,2,3,4,5,6,7]);
  expect(new Set(all.map((cell) => cell.scale)).size).toBe(1);
  result.sheets.forEach((sheet, index) => {
    expect(sheet.number).toBe(index + 1);
    expect(sheet.rect.width).toBeCloseTo(options.paper[0], 0);
    expect(sheet.rect.height).toBeCloseTo(options.paper[1], 0);
    sheet.cells.forEach((cell, cellIndex) => {
      contained(cell.rect, sheet.rect);
      contained(cell.page, cell.rect);
      expect(cell.page.width).toBeCloseTo(cell.logicalWidth * cell.scale, 1);
      expect(cell.page.height).toBeCloseTo(cell.logicalHeight * cell.scale, 1);
      expect(cell.physical).toBe(index + 1);
      expect(cell.direction).toBe(options.rtl ? "rtl" : "ltr");
      expect(cell.clipping).toBe(false);
      expect(cell.pageNumbers).toEqual([String(cell.logical)]);
      expect(cell.totals).toEqual(["7"]);
      expect(cell.sheetNumbers).toEqual([String(index + 1)]);
      for (const other of sheet.cells.slice(cellIndex + 1)) {
        const overlapX = Math.min(cell.rect.right, other.rect.right) - Math.max(cell.rect.left, other.rect.left);
        const overlapY = Math.min(cell.rect.bottom, other.rect.bottom) - Math.max(cell.rect.top, other.rect.top);
        expect(overlapX <= 1 || overlapY <= 1).toBe(true);
        const pageOverlapX = Math.min(cell.page.right, other.page.right) - Math.max(cell.page.left, other.page.left);
        const pageOverlapY = Math.min(cell.page.bottom, other.page.bottom) - Math.max(cell.page.top, other.page.top);
        expect(pageOverlapX <= 1 || pageOverlapY <= 1).toBe(true);
      }
    });
  });
}

const cases = [
  { name:"four-up RTL custom paper", config:{nUp:4}, paper:[240,120], padding:0, rtl:true },
  { name:"two-up Letter with external padding and non96 logical DPI", config:{nUp:2,paperSize:"LETTER",dpi:192}, paper:[816,1056], padding:12, rtl:false },
  { name:"three-up partial final grid", config:{nUp:3}, paper:[240,120], padding:5, rtl:false }
];

for (const options of cases) {
  test(`${options.name}: contained nonoverlapping cells and real print sheets`, async ({ page, browserName }, info) => {
    await render(page, options);
    checkGeometry(await geometry(page), options);
    await page.emulateMedia({ media:"print" });
    checkGeometry(await geometry(page), options);
    if (browserName !== "chromium") return;
    const bytes = await page.pdf({ preferCSSPageSize:true, printBackground:true });
    await info.attach("fictional-physical-sheets.pdf", { body:bytes, contentType:"application/pdf" });
    const loading = getDocument({ data:new Uint8Array(bytes), isEvalSupported:false });
    const pdf = await loading.promise;
    try {
      expect(pdf.numPages).toBe(Math.ceil(7 / options.config.nUp));
      const text = [];
      for (let index = 1; index <= pdf.numPages; index += 1) {
        const physical = await pdf.getPage(index);
        const viewport = physical.getViewport({ scale:1 });
        expect(Math.abs(viewport.width - options.paper[0] * 72 / 96)).toBeLessThan(1);
        expect(Math.abs(viewport.height - options.paper[1] * 72 / 96)).toBeLessThan(1);
        const pageText = (await physical.getTextContent()).items.map((item) => item.str).join(" ");
        text.push(pageText);
        fictionalNUpRows.forEach(([id, amount], rowIndex) => {
          const occurrences = Math.floor(rowIndex / options.config.nUp) + 1 === index ? 1 : 0;
          expect(pageText.split(id)).toHaveLength(occurrences + 1);
          expect(pageText.split(amount)).toHaveLength(occurrences + 1);
        });
      }
      for (const [id, amount] of fictionalNUpRows) {
        expect(text.join(" ")).toContain(id);
        expect(text.join(" ")).toContain(amount);
      }
    } finally { await loading.destroy(); }
  });
}

test("nUp=1 retains external host padding and does not inject print paper rules", async ({ page }) => {
  const options = { config:{nUp:1}, padding:12, rtl:true };
  await render(page, options);
  const result = await page.evaluate(() => {
    const wrapper = document.querySelector(".physical_page_wrapper");
    return { width:wrapper.getBoundingClientRect().width, padding:getComputedStyle(wrapper).paddingLeft,
      display:getComputedStyle(wrapper).display, cells:document.querySelectorAll(".printform_n_up_cell").length,
      rules:document.querySelectorAll("[data-pf-n-up-style]").length };
  });
  expect(result).toEqual({ width:999, padding:"12px", display:"flex", cells:0, rules:0 });
});

test("oversized horizontal content fails without consuming the original source", async ({ page }) => {
  await page.goto("/index001.html");
  const result = await page.evaluate(() => {
    document.body.replaceChildren();
    const source = document.createElement("section");
    source.className = "printform";
    source.innerHTML = '<div class="prowitem" style="height:20px;width:400px">Fictional unsplittable width</div>';
    document.body.append(source);
    const original = source.outerHTML, row = source.firstElementChild;
    let error = "";
    try { window.PrintForm.format(source, {nUp:4,papersizeWidth:240,papersizeHeight:120,fillPageHeightAfterFooter:false,insertDummyRowItemWhileFormatTable:false}); }
    catch (caught) { error = caught.message; }
    return { error, intact:source.outerHTML === original, sameRow:source.firstElementChild === row,
      connected:source.isConnected, outputs:document.querySelectorAll(".printform_formatter,.printform_formatter_processed").length };
  });
  expect(result.error).toContain("logical content overflows");
  expect(result).toMatchObject({ intact:true, sameRow:true, connected:true, outputs:0 });
});

test("named print pages keep mixed physical paper sizes isolated", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "PDF emission is Chromium-only; screen cases run in all three browsers");
  await render(page, cases[0]);
  await page.evaluate(({ html, config }) => {
    const source = document.createElement("section");
    source.className = "printform fictional-lantern-context";
    source.innerHTML = html;
    document.querySelector("#fixture").append(source);
    window.PrintForm.format(source, { ...config, nUp:4, paperSize:"LETTER" });
  }, { html:fictionalNUpHtml, config:fictionalNUpConfig });
  const bytes = await page.pdf({ preferCSSPageSize:true, printBackground:true });
  const loading = getDocument({ data:new Uint8Array(bytes), isEvalSupported:false });
  const pdf = await loading.promise;
  try {
    expect(pdf.numPages).toBe(4);
    const dimensions = [[180,90],[180,90],[612,792],[612,792]];
    for (let index = 1; index <= 4; index += 1) {
      const viewport = (await pdf.getPage(index)).getViewport({ scale:1 });
      expect(Math.abs(viewport.width - dimensions[index - 1][0])).toBeLessThan(1);
      expect(Math.abs(viewport.height - dimensions[index - 1][1])).toBeLessThan(1);
      const pageText = (await (await pdf.getPage(index)).getTextContent()).items.map((item) => item.str).join(" ");
      fictionalNUpRows.forEach(([id, amount], rowIndex) => {
        const occurrences = Math.floor(rowIndex / 4) === (index - 1) % 2 ? 1 : 0;
        expect(pageText.split(id)).toHaveLength(occurrences + 1);
        expect(pageText.split(amount)).toHaveLength(occurrences + 1);
      });
    }
  } finally { await loading.destroy(); }
});

test("a separately paginated appendix retains a partial nonfinal physical sheet", async ({ page }) => {
  await render(page, cases[0]);
  const groups = await page.evaluate(({ html, config }) => {
    document.querySelector(".printform_formatter_processed").remove();
    const source = document.createElement("section");
    source.className = "printform fictional-lantern-context";
    source.innerHTML = html;
    // Keep three authored main rows, then introduce an explicitly separate appendix.
    [...source.querySelectorAll(".prowitem")].slice(3).forEach((row) => row.remove());
    const appendix = document.createElement("table");
    appendix.className = "paddt";
    appendix.style.borderSpacing = "0";
    appendix.innerHTML = '<tr><td style="padding:0"><p style="height:80px;margin:0">Fictional appendix A</p><p style="height:80px;margin:0">Fictional appendix B</p></td></tr>';
    source.append(appendix);
    document.querySelector("#fixture").append(source);
    const output = window.PrintForm.format(source, { ...config, nUp:4 });
    return [...output.querySelectorAll(".physical_page_wrapper")].map((sheet) =>
      [...sheet.querySelectorAll(".printform_page")].map((logical) => ({
        logical:logical.dataset.pfLogicalPage, physical:logical.dataset.pfPhysicalPage
      })));
  }, { html:fictionalNUpHtml, config:fictionalNUpConfig });
  expect(groups).toEqual([
    [{logical:"1",physical:"1"},{logical:"2",physical:"1"},{logical:"3",physical:"1"}],
    [{logical:"4",physical:"2"},{logical:"5",physical:"2"}]
  ]);
});
