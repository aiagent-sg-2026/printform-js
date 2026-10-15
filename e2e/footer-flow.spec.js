import { expect, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { FOOTER_OVERRIDES, flowFooterFixture, fractionalFooterFixture } from "../tests/fixtures/footer-flow.js";

async function host(page) {
  await page.route("**/footer-flow-fixture.html", route => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fictional footer pagination</title><script src="/dist/printform.js"></script></head><body></body></html>'
  }));
  await page.goto("/footer-flow-fixture.html");
  await page.waitForFunction(() => window.__printFormProcessed === true && window.__printFormProcessing === false);
}
async function render(page, fixture, overrides = {}) {
  await host(page);
  return page.evaluate(async ({ fixture, overrides, defaults }) => {
    document.body.replaceChildren();
    const style = document.createElement("style");
    style.textContent = 'body{margin:0;font:12px/16px Arial}.printform_page{margin:0;padding:0;background:white}.physical_page_wrapper{margin-bottom:12px}';
    document.head.append(style);
    const form = document.createElement("section");
    form.className = "printform";
    form.innerHTML = fixture.html;
    document.body.append(form);
    await document.fonts.ready;
    const money = root => Array.from(root.querySelectorAll('[data-pf-format="currency"]'), node => node.textContent);
    const sourceMoney = money(form), sourceText = Array.from(form.querySelectorAll(".prowitem,.ptac-rowitem"), node => node.textContent).join("");
    const sourceSignature = Array.from(form.querySelectorAll('[data-pf-component-type="signature"],.signature-block'), node => node.outerHTML);
    const sourceRows = Array.from(form.querySelectorAll(".prowitem")), repeated = sourceRows.some(node => node.hasAttribute("data-pf-row-repeat"));
    const output = window.PrintForm.format(form, { ...defaults, papersizeWidth: fixture.width, papersizeHeight: fixture.height, ...overrides });
    const rows = Array.from(output.querySelectorAll(".prowitem_processed,.ptac-rowitem_processed"));
    const pages = Array.from(output.querySelectorAll(".printform_page"));
    const { analyzeRowIntegrity } = await import("/studio-v2/core/row-integrity.js");
    const integrity = analyzeRowIntegrity(Array.from(output.querySelectorAll(".prowitem_processed")), { expectedRowCount: sourceRows.length, ...(repeated ? { expectedRowsByRepeat: { supplied: fixture.records.length } } : {}) });
    return {
      sourceMoney, money: money(output), sourceText, text: rows.map(node => node.textContent).join(""), sourceSignature,
      signatures: Array.from(output.querySelectorAll('[data-pf-component-type="signature"],.signature-block'), node => node.outerHTML),
      records: Array.from(output.querySelectorAll("[data-record]"), node => ({ id: node.dataset.record, amount: node.nextElementSibling.textContent })),
      integrity: integrity.errors,
      summaryPage: pages.indexOf(output.querySelector("[data-summary]")?.closest(".printform_page")),
      signaturePage: pages.indexOf(output.querySelector('[data-pf-component-type="signature"],.signature-block')?.closest(".printform_page")),
      pages: pages.map(page => {
        const bounds = page.getBoundingClientRect();
        return {
          height: bounds.height, scrollHeight: page.scrollHeight,
          inside: Array.from(page.querySelectorAll("*")).every(node => {
            const rect = node.getBoundingClientRect();
            return rect.top >= bounds.top - 0.01 && rect.bottom <= bounds.top + fixture.height + 0.01 && rect.left >= bounds.left - 0.01 && rect.right <= bounds.right + 0.01;
          }),
          repeatedFooters: page.querySelectorAll(".pfooter_processed").length,
          numbers: Array.from(page.querySelectorAll("[data-page-number]"), node => node.textContent),
          totals: Array.from(page.querySelectorAll("[data-page-total]"), node => node.textContent)
        };
      })
    };
  }, { fixture, overrides, defaults: FOOTER_OVERRIDES });
}
function conserved(result, fixture) {
  expect(result.money).toEqual(result.sourceMoney);
  expect(result.signatures).toEqual(result.sourceSignature);
  expect(result.records).toEqual(fixture.records);
  expect(result.text).toBe(result.sourceText);
  expect(result.integrity).toEqual([]);
  expect(result.pages.every(page => page.height <= fixture.height + 0.01 && page.scrollHeight <= Math.ceil(fixture.height) && page.inside)).toBe(true);
}

for (const [height, pageCount] of [[148, 1], [146.25, 1], [146.125, 2]]) {
  test(`real final-footer boundary at ${height}px leaves no avoidable signature-only page`, async ({ page }, info) => {
    const fixture = fractionalFooterFixture(height), result = await render(page, fixture);
    conserved(result, fixture);
    expect(result.pages).toHaveLength(pageCount);
    await info.attach("final-footer.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });
}

for (const repeat of [false, true]) {
  test(`summary and signature reserve their actual shared final page with repeat footer=${repeat}`, async ({ page, browserName }, info) => {
    const fixture = flowFooterFixture({ repeat }), result = await render(page, fixture, { repeatFooter: repeat });
    conserved(result, fixture);
    expect(result.pages).toHaveLength(2);
    expect(result.summaryPage).toBe(result.signaturePage);
    expect(result.pages.flatMap(page => page.numbers)).toEqual(result.pages.map((_page, index) => String(index + 1)));
    expect(result.pages.every(page => page.totals.every(total => total === String(result.pages.length)))).toBe(true);
    if (repeat) expect(result.pages.every(page => page.repeatedFooters === 1)).toBe(true);
    await page.emulateMedia({ media: "print" });
    expect(await page.locator(".printform_page").evaluateAll((pages, height) => pages.every(page => page.getBoundingClientRect().height <= height + 0.01), fixture.height)).toBe(true);
    await info.attach("summary-signature.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    if (browserName === "chromium" && repeat) {
      await page.addStyleTag({ content: `@page{size:${fixture.width}px ${fixture.height}px;margin:0}@media print{.physical_page_wrapper{margin:0!important;break-inside:avoid}}` });
      const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
      await info.attach("summary-signature.pdf", { body: bytes, contentType: "application/pdf" });
      const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
      try {
        const pdf = await loading.promise, amounts = [];
        expect(pdf.numPages).toBe(result.pages.length);
        for (let number = 1; number <= pdf.numPages; number += 1) {
          const pdfPage = await pdf.getPage(number), viewport = pdfPage.getViewport({ scale: 1 });
          const text = await pdfPage.getTextContent();
          for (const item of text.items.filter(item => item.str?.trim())) {
            expect(item.transform[4]).toBeGreaterThanOrEqual(-1);
            expect(item.transform[4] + item.width).toBeLessThanOrEqual(viewport.width + 1);
            expect(item.transform[5]).toBeGreaterThanOrEqual(-1);
            expect(item.transform[5]).toBeLessThanOrEqual(viewport.height + 1);
          }
          amounts.push(text.items.map(item => item.str || "").join(""));
        }
        for (const record of fixture.records) expect(amounts.join("").split(record.amount)).toHaveLength(2);
      } finally { await loading.destroy(); }
    }
  });
}

for (const options of [{ explicitBreak: true }, { oversized: true }]) {
  test(`explicit page breaks and an oversized advisory chain retain complete signoff: ${JSON.stringify(options)}`, async ({ page }) => {
    const fixture = flowFooterFixture(options), result = await render(page, fixture);
    conserved(result, fixture);
    expect(result.summaryPage).not.toBe(result.signaturePage);
    expect(result.pages).toHaveLength(2);
  });
}

test("long footer prose fragments but its signature label, value and monetary token remain atomic", async ({ page }, info) => {
  const prose = Array.from({ length: 70 }, (_value, index) => `Fictional clause ${index}.`).join(" ");
  const fixture = {
    width: 260, height: 140, records: [],
    html: `<div class="ptac-rowitem without_prowheader"><p style="margin:0">${prose}</p><section class="signature-block" style="margin:0;padding:8px 0"><small style="display:block">Authorised by</small><b>Fictional Reviewer</b><span data-pf-format="currency">MYR 10.25</span></section><p style="margin:0">Final supplied note.</p></div>`
  };
  const result = await render(page, fixture);
  conserved(result, fixture);
  expect(result.pages.length).toBeGreaterThan(1);
  expect(result.signatures).toHaveLength(result.sourceSignature.length);
  await info.attach("fragmented-notes-atomic-signature.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("an intact signature uses the larger continuation budget without first-only chrome", async ({ page }) => {
  const fixture = {
    width: 260, height: 150, records: [],
    html: '<header class="pheader" style="height:60px">First-only document information</header><div class="ptac-rowitem without_prowheader" data-pf-keep-together="true" style="height:110px"><section data-pf-component-type="signature">Authorised by Fictional Reviewer</section></div>'
  };
  const result = await render(page, fixture);
  conserved(result, fixture);
  expect(result.pages).toHaveLength(2);
  expect(result.signaturePage).toBe(result.pages.length - 1);
});

test("an oversized signature rejects atomically and preserves source listeners", async ({ page }) => {
  await host(page);
  const result = await page.evaluate(defaults => {
    const form = document.createElement("section");
    form.className = "printform";
    form.innerHTML = '<div class="ptac-rowitem signature-block" style="height:200px">Fictional authorised signature</div>';
    document.body.replaceChildren(form);
    const row = form.firstElementChild, original = form.outerHTML;
    let clicks = 0, error = "";
    row.addEventListener("click", () => { clicks += 1; });
    try { window.PrintForm.format(form, { ...defaults, papersizeHeight: 150, papersizeWidth: 260 }); }
    catch (caught) { error = caught.name; }
    row.click();
    return { error, intact: form.outerHTML === original, sameRow: form.firstElementChild === row, clicks, output: document.querySelectorAll(".printform_formatter,.printform_formatter_processed").length };
  }, FOOTER_OVERRIDES);
  expect(result).toEqual({ error: "RangeError", intact: true, sameRow: true, clicks: 1, output: 0 });
});

for (const supplied of ["(1,234.5600)", "123.450 kg"]) {
  test(`compiled raw financial binding ${supplied} reaches real clipping inspection without coercion`, async ({ page }, info) => {
    await host(page);
    const result = await page.evaluate(async supplied => {
      const { newProject, designOf, compileProject } = await import("/studio-v3/model.js");
      const { bindTemplate } = await import("/studio-v2/core/binding.js");
      const { inspectMonetaryTokens } = await import("/studio-v2/core/monetary-inspection.js");
      const { inspectRenderedDocument } = await import("/studio-v2/core/acceptance.js");
      const project = newProject(), design = designOf(project);
      design.columns = design.columns.filter(field => ["description", "amount"].includes(field.id))
        .map(field => ({ ...field, width: 50, format: "" }));
      for (const id of ["header", "customer", "totals", "footer"]) design.blocks[id].enabled = false;
      project.sampleData.items = [{ description: "Fictional source reference", amount: supplied }];
      const compiled = compileProject(project, design), template = document.createElement("template");
      template.innerHTML = compiled.templateHtml;
      const style = document.createElement("style"); style.textContent = compiled.themeCss;
      document.head.append(style);
      const mount = document.createElement("main"); mount.id = "pf-mount";
      const shell = document.createElement("div"); shell.className = "printform_page";
      shell.append(bindTemplate(template, compiled.sampleData, compiled.manifest).fragment);
      mount.append(shell); document.body.replaceChildren(mount);
      await document.fonts.ready;
      const node = mount.querySelector('[data-v3-id="items-amount"]'), original = node.getAttribute("style");
      const inspect = () => ({
        unreadable: inspectMonetaryTokens(document).includes(node),
        rejected: inspectRenderedDocument(document, compiled.manifest).errors.some(error => error.code === "MONETARY_TOKEN_UNREADABLE"),
        value: node.textContent
      });
      const baseline = inspect();
      node.style.cssText = "display:block;height:5px;overflow-y:hidden;white-space:nowrap";
      const clipped = inspect();
      if (original === null) node.removeAttribute("style"); else node.setAttribute("style", original);
      return { baseline, clipped, recovered: inspect(), source: compiled.sampleData.items[0].amount };
    }, supplied);
    expect(result).toEqual({
      baseline: { unreadable: false, rejected: false, value: supplied },
      clipped: { unreadable: true, rejected: true, value: supplied },
      recovered: { unreadable: false, rejected: false, value: supplied }, source: supplied
    });
    await info.attach("raw-financial-geometry.json", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
  });
}

test("nested indivisible signoff receives the actual continuation budget without first-only chrome", async ({ page }) => {
  const signature = `<section class="signature-block">${Array.from({ length: 7 }, (_value, index) => `<span style="display:block">Fictional signer line ${index}</span>`).join("")}</section>`;
  const fixture = {
    width: 260, height: 150, records: [],
    html: `<header class="pheader" style="height:60px">First-only header</header><div class="ptac-rowitem without_prowheader"><p style="margin:0">Before signature.</p>${signature}<p style="margin:0">After signature.</p></div>`
  };
  const result = await render(page, fixture);
  conserved(result, fixture);
  expect(result.pages).toHaveLength(2);
  expect(result.signaturePage).toBe(1);
  expect(result.signatures).toEqual([signature]);
});

test("an oversized keep-next chain counts its unconsumed once-only table header before moving", async ({ page }) => {
  const fixture = {
    width: 260, height: 150, records: [],
    html: '<header class="pheader" style="height:20px">First-only header</header><div class="prowheader" data-pf-table-id="items" style="height:75px">Once-only table heading</div><div class="prowitem" data-pf-table-id="items" data-pf-keep-with-next="true" style="height:45px">Business row NORTH</div><div class="prowitem" data-pf-table-id="items" style="height:45px">Business row SOUTH</div>'
  };
  const result = await render(page, fixture);
  conserved(result, fixture);
  expect(result.pages).toHaveLength(2);
  await expect(page.locator(".printform_page").nth(0)).toContainText("Business row NORTH");
  await expect(page.locator(".printform_page").nth(1)).toContainText("Business row SOUTH");
  await expect(page.locator(".prowheader_processed")).toHaveCount(1);
});
