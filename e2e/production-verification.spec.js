import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import { admitPublicGateway } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

function collectBrowserErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function persistEvidence(testInfo, name, body, contentType) {
  const outputPath = testInfo.outputPath(name);
  await fs.writeFile(outputPath, body);
  await testInfo.attach(name, { path: outputPath, contentType });
}

async function renderSyntheticRows(page, count, { width = 600, height = 780 } = {}) {
  return page.evaluate(({ count: rowCount, width: pageWidth, height: pageHeight }) => {
    document.querySelectorAll(".printform_formatter_processed, .div_page_break_before, .production-verification-form").forEach((node) => node.remove());
    if (!document.querySelector("#production-verification-style")) {
      const style = document.createElement("style");
      style.id = "production-verification-style";
      style.textContent = `
        .production-verification-form { font: 12px Arial; color: #111; }
        .production-verification-form .pheader { height: 24px; }
        .production-verification-form .prowheader { height: 28px; font-weight: 700; }
        .production-verification-form .prowitem { height: 24px; box-sizing: border-box; border-bottom: 1px solid #ddd; }
      `;
      document.head.appendChild(style);
    }
    const form = document.createElement("div");
    form.className = "paper_width printform production-verification-form";
    Object.assign(form.dataset, {
      papersizeWidth: String(pageWidth), papersizeHeight: String(pageHeight),
      repeatHeader: "n", repeatDocinfo: "n", repeatRowheader: "y",
      insertDummyRowItemWhileFormatTable: "n", insertFooterSpacerWhileFormatTable: "n",
      fillPageHeightAfterFooter: "n"
    });
    const header = document.createElement("div");
    header.className = "prowheader";
    header.dataset.pfTableId = "scale";
    header.textContent = "Scale table header";
    form.appendChild(header);
    for (let index = 0; index < rowCount; index += 1) {
      const row = document.createElement("div");
      row.className = "prowitem";
      row.dataset.pfTableId = "scale";
      row.textContent = `Scale row ${index + 1}`;
      form.appendChild(row);
    }
    document.body.appendChild(form);
    const started = performance.now();
    window.PrintForm.format(form);
    const durationMs = Math.round((performance.now() - started) * 100) / 100;
    const pages = Array.from(document.querySelectorAll(".printform_formatter_processed .printform_page"));
    const pageData = pages.map((page) => {
      const pageRect = page.getBoundingClientRect();
      const descendants = Array.from(page.querySelectorAll("*"));
      const bounds = descendants.map((node) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }).filter((rect) => rect.right > rect.left && rect.bottom > rect.top);
      return {
        width: Math.round(pageRect.width), height: Math.round(pageRect.height),
        rows: Array.from(page.querySelectorAll(".prowitem_processed"), (node) => node.textContent.trim()),
        headers: Array.from(page.querySelectorAll(".prowheader_processed"), (node) => node.textContent.trim()),
        withinPaper: bounds.every((rect) => rect.left >= pageRect.left - 1 && rect.right <= pageRect.left + pageWidth + 1 && rect.top >= pageRect.top - 1 && rect.bottom <= pageRect.top + pageHeight + 1)
      };
    });
    return {
      count: rowCount,
      durationMs,
      pageCount: pages.length,
      renderedRows: pageData.reduce((total, page) => total + page.rows.length, 0),
      pageData,
      signature: JSON.stringify(pageData),
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null
    };
  }, { count, width, height });
}

test("opens the required progress claim in Chromium with a printable isolated preview", async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== "chromium", "Production verification uses Chromium as the certified reference runtime");
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/studio-v2/?sample=progress-claim");
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await admitPublicGateway(page);
  const metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics).toMatchObject({ overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 });
  expect(metrics.logicalPages).toBeGreaterThan(0);
  await expect(page.frameLocator("#preview-frame").locator("h1").first()).toHaveText("PROGRESS CLAIM");
  await persistEvidence(testInfo, "progress-claim-preview.png", await page.screenshot(), "image/png");
  expect(browserErrors).toEqual([]);
});

test("opens a populated standalone print preview from the Print preview action", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Standalone print preview uses the Chromium reference runtime");
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/studio-v2/?sample=sales-invoice");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  const popupPromise = page.waitForEvent("popup");
  await page.locator("#print-button").click();
  const popup = await popupPromise;
  const popupErrors = collectBrowserErrors(popup);
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup).toHaveTitle(/Sales Invoice/);
  await expect(popup.locator(".printform_page").first()).toBeVisible({ timeout: 20_000 });
  expect(await popup.locator(".printform_page").count()).toBeGreaterThan(0);
  expect(await popup.locator("body").innerText()).toContain("Sales Invoice");
  expect(browserErrors).toEqual([]);
  expect(popupErrors).toEqual([]);
  await popup.close();
});

test("renders 100, 500 and 1000 rows deterministically in the browser", async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== "chromium", "Large dataset budgets use the Chromium reference environment");
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/index001.html");
  for (const count of [100, 500, 1000]) {
    const first = await renderSyntheticRows(page, count);
    const second = await renderSyntheticRows(page, count);
    expect(first.renderedRows).toBe(count);
    expect(second.renderedRows).toBe(count);
    expect(first.pageCount).toBeGreaterThan(0);
    expect(second.pageCount).toBe(first.pageCount);
    expect(second.signature).toBe(first.signature);
    if (first.memory) expect(first.memory.usedJSHeapSize).toBeLessThan(first.memory.jsHeapSizeLimit);
    await persistEvidence(testInfo, `dataset-${count}.json`, JSON.stringify({ first, second, browserErrors }, null, 2), "application/json");
  }
  expect(browserErrors).toEqual([]);
});

test("keeps A4 portrait and landscape pages inside paper bounds", async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== "chromium", "Paper certification uses the Chromium reference environment");
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/index001.html");
  const results = {};
  for (const [mode, dimensions] of Object.entries({ portrait: { width: 794, height: 1122 }, landscape: { width: 1122, height: 794 } })) {
    results[mode] = await renderSyntheticRows(page, 100, dimensions);
    expect(results[mode].pageCount).toBeGreaterThan(1);
    expect(results[mode].pageData.every((item) => item.withinPaper)).toBe(true);
    expect(results[mode].pageData.every((item) => item.headers.includes("Scale table header"))).toBe(true);
  }
  await persistEvidence(testInfo, "paper-modes.json", JSON.stringify({ results, browserErrors }, null, 2), "application/json");
  expect(browserErrors).toEqual([]);
});

test("reports pagination diagnostics with page and component context in Chromium", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Diagnostic contract uses the Chromium reference environment");
  await page.goto("/studio-v2/?sample=progress-claim");
  const result = await page.evaluate(async () => {
    const { collectPaginationDiagnostics } = await import("/studio-v2/core/render-diagnostics.js");
    const { inspectRenderedDocument } = await import("/studio-v2/core/acceptance.js");
    const rect = (node, values) => Object.defineProperty(node, "getBoundingClientRect", { configurable: true, value: () => ({ x: values.left || 0, y: values.top || 0, left: values.left || 0, top: values.top || 0, right: values.right ?? ((values.left || 0) + values.width), bottom: values.bottom ?? ((values.top || 0) + values.height), width: values.width, height: values.height }) });
    const template = document.createElement("template");
    template.id = "pf-template";
    template.innerHTML = '<div class="printform" data-papersize-width="750" data-papersize-height="822" data-repeat-footer="y" data-repeat-footer-pagenum="y"></div>';
    document.body.appendChild(template);
    const makePage = (id) => { const node = document.createElement("div"); node.className = "printform_page"; node.id = id; rect(node, { width: 750, height: 822, right: 750, bottom: 822 }); document.body.appendChild(node); return node; };
    const page1 = makePage("diagnostic-page-1");
    const header = document.createElement("div"); header.className = "prowheader_processed"; header.dataset.pfTableId = "valuation"; header.textContent = "Valuation"; page1.appendChild(header); rect(header, { width: 750, height: 28, right: 750, bottom: 28 });
    const activeRow = document.createElement("div"); activeRow.className = "prowitem_processed"; activeRow.dataset.pfTableId = "variation"; activeRow.dataset.pfComponentId = "variation-row-1"; activeRow.textContent = "Variation"; page1.appendChild(activeRow); rect(activeRow, { width: 750, height: 30, right: 750, bottom: 58 });
    const overflowingTable = document.createElement("table"); page1.appendChild(overflowingTable); rect(overflowingTable, { width: 900, height: 20, right: 900, bottom: 78 });
    const page2 = makePage("diagnostic-page-2");
    const tallRow = document.createElement("div"); tallRow.className = "prowitem_processed"; tallRow.dataset.pfTableId = "materials"; tallRow.dataset.pfComponentId = "materials-row-23"; tallRow.textContent = "Materials"; page2.appendChild(tallRow); rect(tallRow, { width: 750, height: 986, right: 750, bottom: 986 });
    for (const [className, componentId, type] of [["signature-block", "signature-1", "signature"], ["pf-total-block", "total-1", "total"], ["keep-block", "keep-1", ""]]) {
      const node = document.createElement("div"); node.className = className; node.dataset.pfComponentId = componentId; node.dataset.pfKeepTogether = "true"; if (type) node.dataset.pfComponentType = type; if (type === "total") node.dataset.pfOrphanTotal = "true"; page2.appendChild(node); rect(node, { width: 700, height: 120, top: 800, bottom: 920 });
    }
    const page3 = makePage("diagnostic-blank-page");
    const page4 = makePage("diagnostic-page-4");
    const footer = document.createElement("div"); footer.className = "pfooter_processed"; footer.textContent = "Footer"; page1.appendChild(footer); page4.appendChild(footer.cloneNode(true));
    const pageNumber = document.createElement("div"); pageNumber.className = "pfooter_pagenum_processed"; pageNumber.dataset.pageNumber = ""; page4.appendChild(pageNumber); rect(pageNumber, { width: 100, height: 16, right: 100, bottom: 16 });
    Object.defineProperty(page4, "scrollHeight", { configurable: true, value: 900 });
    const diagnostics = collectPaginationDiagnostics(document);
    const inspection = inspectRenderedDocument(document, { acceptance: { maxLogicalPages: 20 } });
    const details = [...diagnostics.issues, ...inspection.issues];
    return { codes: [...new Set([...diagnostics.errors, ...inspection.errors].map((entry) => entry.code))], details };
  });
  for (const code of ["ROW_TOO_TALL", "HORIZONTAL_OVERFLOW", "VERTICAL_OVERFLOW", "BLANK_PAGE", "ACTIVE_TABLE_HEADER_INCORRECT", "ACTIVE_TABLE_HEADER_MISSING", "ORPHAN_TOTAL", "SIGNATURE_SPLIT", "TOTAL_BLOCK_SPLIT", "KEEP_TOGETHER_FAILURE", "FOOTER_MISSING", "PAGE_NUMBER_MISSING", "PAGE_NUMBER_INVALID"]) expect(result.codes).toContain(code);
  expect(result.details.length).toBeGreaterThan(0);
  result.details.forEach((item) => {
    expect(item).toMatchObject({ code: expect.any(String), page: expect.any(Number), measured_size: expect.any(Object), available_size: expect.any(Object), reason: expect.any(String) });
  });
});

test("persists an approved revision-bound Evidence Pack after trusted export", async ({ page, context, browserName }, testInfo) => {
  test.skip(browserName !== "chromium", "Trusted export evidence uses the Chromium reference environment");
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await admitPublicGateway(page);
  const flow = await page.evaluate(async () => {
    const run = (name, input) => window.PrintFormStudioAgent.execute(name, input);
    const revision = (await run("get_project_summary", {})).result.revision;
    const captured = {};
    for (const scenario of ["default", "long-text"]) {
      captured[scenario] = await run("capture_layout_evidence", { expectedRevision: revision, scenario });
      if (!captured[scenario].ok || !captured[scenario].result?.evidence) throw new Error(`Evidence capture failed for ${scenario}: ${JSON.stringify(captured[scenario])}`);
    }
    await run("begin_layout_review", { expectedRevision: revision });
    const evidenceIds = Object.values(captured).map((entry) => entry.result.evidence.evidenceId);
    const review = await run("complete_layout_review", { expectedRevision: revision, reviewer: "ai-agent", findings: [], summary: "real Chromium evidence", evidenceIds });
    const readiness = await run("request_export", {});
    return { revision, captured, review, readiness };
  });
  expect(flow.review.ok).toBe(true);
  expect(flow.readiness.result.ready).toBe(true);
  const dialogs = [];
  page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); if (/Save As|另存为/.test(dialog.message())) await dialog.dismiss(); else await dialog.accept(); });
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export-button").click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  let html = "";
  for await (const chunk of stream) html += chunk.toString();
  const pack = await page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_evidence_pack", {})).result.evidencePack);
  const evidence = { pack, browser: { name: browserName, version: await context.browser()?.version(), userAgent: await page.evaluate(() => navigator.userAgent) }, dialogCount: dialogs.length, htmlBytes: new TextEncoder().encode(html).byteLength, captured: flow.captured };
  await persistEvidence(testInfo, "evidence-pack.json", JSON.stringify(evidence, null, 2), "application/json");
  await persistEvidence(testInfo, "approved-invoice.png", await page.screenshot(), "image/png");
  expect(pack).toMatchObject({ revision: flow.revision, formSpecHash: expect.stringMatching(/^sha256:/), previewHash: expect.any(String), exportHtmlHash: expect.stringMatching(/^sha256:/), runtimeHash: expect.stringMatching(/^sha256:/), printformRuntimeHash: expect.stringMatching(/^sha256:/), pageCount: expect.any(Number), timestamp: expect.any(String), hash: expect.stringMatching(/^sha256:/), validation: { status: "PASS" }, security: { status: "PASS", externalNetwork: false, arbitraryJavascript: false } });
  expect(evidence.browser.userAgent).toContain("Chrome");
  expect(html).toContain('id="pf-manifest"');
});

test('keeps the legacy progress-claim long-text overflow unsigned and export blocked',async({page,browserName})=>{
  test.skip(browserName !== 'chromium','Legacy overflow regression uses the Chromium reference environment');
  await page.goto('/studio-v2/?sample=progress-claim');
  await expect(page.locator('#render-status')).toHaveText('Printable',{timeout:20000});
  await admitPublicGateway(page);
  const result=await page.evaluate(async()=>{
    const agent=window.PrintFormStudioAgent, revision=(await agent.execute('get_project_summary')).result.revision;
    return {capture:await agent.execute('capture_layout_evidence',{expectedRevision:revision,scenario:'long-text'}),export:await agent.execute('request_export')};
  });
  expect(result.capture.ok).toBe(true);
  expect(result.capture.result).toMatchObject({evidence:null,validation:{valid:false,productionValid:false}});
  expect(result.capture.result.metrics.verticalOverflowPages).toBeGreaterThan(0);
  expect(result.export.result.ready).toBe(false);
});
