import { describe, expect, it } from "vitest";
import { installPrintFormDocument } from "../../studio-v2/core/runtime.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { calculateFinancialTotals } from "../../studio-v2/core/business-rules.js";

function installSections(project) {
  document.documentElement.lang = "en-MY";
  document.head.innerHTML = `
    <title>Runtime test</title>
    <script id="pf-manifest" type="application/json">${JSON.stringify(project.manifest)}</script>
    <script id="pf-schema" type="application/schema+json">${JSON.stringify(project.schema)}</script>
    <script id="pf-i18n" type="application/json">${JSON.stringify(project.i18n)}</script>`;
  document.body.innerHTML = `
    <main id="pf-mount"></main>
    <template id="pf-template">${project.templateHtml}</template>
    <script id="pf-sample-data" type="application/json">${JSON.stringify(project.sampleData)}</script>`;
}

// Real PrintForm.formatAll() renames every repeated section's base class to
// "<class>_processed" as it paginates (src/printform/dom.js markAsProcessed,
// called from sections.js/pagination-render.js for header/docinfo/rowheader/
// footer/rows alike) — replicate that fully here so this mock stays faithful
// to what inspectRenderedDocument's content-integrity checks expect to find.
// An earlier version of this mock only renamed .prowitem and got caught out
// by both the row-count check and the header/docinfo-missing check in turn.
const PROCESSABLE_CLASSES = ["pheader", "pdocinfo", "prowheader", "prowitem", "pfooter", "pfooter_logo", "pfooter_pagenum"];
function markAllProcessed(form) {
  PROCESSABLE_CLASSES.forEach((cls) => {
    form.querySelectorAll(`.${cls}`).forEach((node) => node.classList.replace(cls, `${cls}_processed`));
  });
  // The real formatter resolves logical page placeholders during finalization.
  // Keep this lightweight runtime mock faithful now that the deterministic
  // validator rejects unresolved page-number placeholders.
  form.querySelectorAll("[data-page-number]").forEach((node) => { node.textContent = "1"; });
  form.querySelectorAll("[data-page-total]").forEach((node) => { node.textContent = "1"; });
}

describe("PrintFormDocument runtime", () => {
  it("blocks invalid data before invoking pagination", async () => {
    const project = createSalesInvoiceProject();
    installSections(project);
    let calls = 0;
    window.PrintForm = { formatAll: async () => { calls += 1; } };
    const runtime = installPrintFormDocument(window);
    document.querySelector("#pf-mount").innerHTML = '<div class="printform_page">stale</div>';
    const event = new Promise((resolve) => window.addEventListener("printform:rendered", resolve, { once: true }));
    const result = await runtime.render({});
    expect(result.status).toBe("blocked");
    expect(calls).toBe(0);
    expect(document.querySelector("#pf-mount").children).toHaveLength(0);
    expect((await event).detail.status).toBe("blocked");
  });

  it("binds valid rows and returns a layout report", async () => {
    const project = createSalesInvoiceProject();
    project.sampleData.items = project.sampleData.items.slice(0, 1);
    Object.assign(project.sampleData.totals, calculateFinancialTotals(project.sampleData));
    project.templateHtml = project.templateHtml.replace(/<img\b[^>]*>/gi, "");
    installSections(project);
    window.PrintForm = { formatAll: async () => {
      const form = document.querySelector(".printform");
      markAllProcessed(form);
      form.className = "printform_formatter_processed";
      form.innerHTML = `<div class="printform_page">${form.innerHTML}</div>`;
    } };
    const runtime = installPrintFormDocument(window);
    const result = await runtime.render(project.sampleData);
    expect(result.status).toBe("ready");
    expect(result.metrics.logicalPages).toBe(1);
    expect(document.querySelectorAll(".prowitem_processed")).toHaveLength(1);
    expect(result.metrics).toMatchObject({ renderedRows: 1, expectedRows: 1 });
  });

  it("blocks with ROW_COUNT_MISMATCH when pagination renders a different row count than the binder produced", async () => {
    const project = createSalesInvoiceProject();
    project.sampleData.items = project.sampleData.items.slice(0, 2);
    Object.assign(project.sampleData.totals, calculateFinancialTotals(project.sampleData));
    project.templateHtml = project.templateHtml.replace(/<img\b[^>]*>/gi, "");
    installSections(project);
    window.PrintForm = { formatAll: async () => {
      const form = document.querySelector(".printform");
      // Simulate a pagination bug: only mark the FIRST bound row as
      // processed, dropping the second — this is exactly the class of bug
      // the row-count check exists to catch.
      const rows = form.querySelectorAll(".prowitem");
      rows[0]?.classList.replace("prowitem", "prowitem_processed");
      form.className = "printform_formatter_processed";
      form.innerHTML = `<div class="printform_page">${form.innerHTML}</div>`;
    } };
    const runtime = installPrintFormDocument(window);
    const result = await runtime.render(project.sampleData);
    expect(result.status).toBe("blocked");
    expect(result.validation.errors.some((item) => item.code === "ROW_COUNT_MISMATCH")).toBe(true);
  });
});
