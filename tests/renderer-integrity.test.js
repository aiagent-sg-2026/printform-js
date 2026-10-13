import { afterEach, describe, expect, it } from "vitest";
import { PrintFormFormatter } from "../src/printform/formatter/PrintFormFormatter.js";
import { CONFIG_DESCRIPTORS, PADDT_CONFIG_DESCRIPTORS, getPaddtConfig, getPrintformConfig } from "../src/printform/config.js";
import { splitParagraphIntoHtmlChunks } from "../src/printform/text.js";

function source(html = "") {
  const form = document.createElement("div");
  form.className = "printform invoice";
  form.innerHTML = html;
  document.body.appendChild(form);
  return form;
}

function instance(form, overrides = {}) {
  return new PrintFormFormatter(form, getPrintformConfig(form, overrides), overrides);
}

afterEach(() => document.body.replaceChildren());

describe("renderer integrity", () => {
  it.each(["ptac", "paddt"])("conserves mixed text, comments and inline markup for %s segmentation", (kind) => {
    const form = source(`<table class="${kind}"><tr><td><div>Prefix &lt;<!--note--><p>one <b>two three</b></p> Tail &amp;</div></td></tr></table>`);
    const originalText = form.textContent;
    const formatter = instance(form, { paddtMaxWordsPerSegment: 1.5 });
    if (kind === "ptac") formatter.expandPtacSegments();
    else formatter.expandPaddtSegments();
    expect(form.textContent).toBe(originalText);
    expect(form.innerHTML).toContain("<!--note-->");
    expect(form.querySelector("b")).not.toBeNull();
    expect(form.textContent).toContain("Prefix <");
    expect(form.textContent).toContain(" Tail &");
  });

  it.each([1.5, "2.9", Infinity, NaN, 0, -2])("normalizes exported splitter limits without losing content: %s", (limit) => {
    const paragraph = document.createElement("p");
    paragraph.innerHTML = "one <b>two three</b> four";
    const chunks = splitParagraphIntoHtmlChunks(paragraph, limit);
    const combined = document.createElement("div");
    combined.innerHTML = chunks.join("");
    expect(combined.textContent).toBe(paragraph.textContent);
    expect(combined.querySelector("b")).not.toBeNull();
  });

  it("normalizes every boolean API descriptor like dataset values", () => {
    const form = source();
    const main = Object.fromEntries(CONFIG_DESCRIPTORS.filter((item) => typeof item.defaultValue === "boolean").map((item) => [item.key, "false"]));
    const paddt = Object.fromEntries(PADDT_CONFIG_DESCRIPTORS.filter((item) => typeof item.defaultValue === "boolean").map((item) => [item.key, "false"]));
    const config = getPrintformConfig(form, main);
    const paddtConfig = getPaddtConfig(form, paddt);
    Object.keys(main).forEach((key) => expect(config[key]).toBe(false));
    Object.keys(paddt).forEach((key) => expect(paddtConfig[key]).toBe(false));
    expect(instance(form, { paddtMaxWordsPerSegment: 1.5, repeatPaddtRowheader: "false" }).paddtConfig)
      .toMatchObject({ paddtMaxWordsPerSegment: 1, repeatPaddtRowheader: false });
    expect(new PrintFormFormatter(form, getPrintformConfig(form)).paddtConfig.paddtMaxWordsPerSegment).toBe(200);
  });

  it("normalizes non-positive dimensions without changing valid manual precedence", () => {
    const form = source();
    expect(getPrintformConfig(form, { papersizeWidth: 0, papersizeHeight: -1 }))
      .toMatchObject({ papersizeWidth: 750, papersizeHeight: 1050 });
    expect(getPrintformConfig(form, { paperSize: "A4", papersizeWidth: 300, papersizeHeight: 400 }))
      .toMatchObject({ papersizeWidth: 300, papersizeHeight: 400 });
  });

  it("keeps source node identity and DOM intact when actual filler parsing fails", () => {
    const form = source('<div class="pheader">Header</div><table class="ptac"><tr><td><div><p>first</p><p>second</p></div></td></tr></table>');
    const header = form.firstElementChild;
    const before = form.outerHTML;
    let events = 0;
    header.addEventListener("click", () => { events += 1; });
    expect(() => instance(form, { customDummyRowItemContent: "not an element" }).format()).toThrow("must contain an element");
    expect(document.body.children).toHaveLength(1);
    expect(form.outerHTML).toBe(before);
    expect(form.firstElementChild).toBe(header);
    header.click();
    expect(events).toBe(1);
  });

  it("renders empty chrome for all-zero rows and preserves root presentation attributes", () => {
    const form = source('<div class="pheader" data-page-number>?</div><div class="pdocinfo"><span data-page-total>?</span></div><div class="prowitem" style="display:none">hidden</div><div class="pfooter" data-physical-page-number>?</div>');
    form.id = "invoice-root";
    form.style.cssText = "font-size:28px;color:red;--accent:blue";
    form.setAttribute("lang", "zh");
    const output = instance(form, { insertDummyRowItemWhileFormatTable: false, showPhysicalPageNumber: true }).format();
    expect(output.classList.contains("printform")).toBe(false);
    expect(output.classList.contains("invoice")).toBe(true);
    expect(output.id).toBe("invoice-root");
    expect(output.lang).toBe("zh");
    expect(output.style.fontSize).toBe("28px");
    expect(output.style.getPropertyValue("--accent")).toBe("blue");
    expect(output.querySelector(".pheader_processed").textContent).toBe("1");
    expect(output.querySelector("[data-page-total]").textContent).toBe("1");
    expect(output.querySelector(".pfooter_processed").textContent).toBe("1");
    expect(form.isConnected).toBe(false);
  });

  it.each(["constructor", "__proto__", "toString"])("renders first but nonrepeating active table headers with safe ID %s", (tableId) => {
    const form = source(`<div class="prowheader" data-pf-table-id="A">A</div><div class="prowheader" data-pf-table-id="${tableId}" data-pf-repeat-rowheader="false">B</div>`);
    const formatter = instance(form);
    const sections = formatter.collectSections();
    formatter.markSectionsProcessed(sections);
    const first = document.createElement("div");
    formatter.appendRepeatingSections(first, sections, null, false, "A");
    formatter.ensureActiveTableHeader(first, sections, null, tableId, true);
    expect(first.textContent).toBe("A");
    formatter.ensureActiveTableHeader(first, sections, null, tableId, false);
    expect(first.textContent).toBe("AB");
    const next = document.createElement("div");
    formatter.ensureActiveTableHeader(next, sections, null, tableId, false);
    expect(next.textContent).toBe("");
  });
});
