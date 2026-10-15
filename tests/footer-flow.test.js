import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrintFormFormatter } from "../src/printform/formatter/PrintFormFormatter.js";
import { getPrintformConfig } from "../src/printform/config.js";
import { FOOTER_OVERRIDES, SIGNATURE_TEXT, flowFooterFixture, fractionalFooterFixture } from "./fixtures/footer-flow.js";

// jsdom has no layout: use only each fixture root's authored block height.
// The browser specification consumes these same fixtures with native geometry.
function declaredHeight(node) {
  return Number.parseFloat(node.style.height) || Array.from(node.children).reduce((sum, child) => sum + declaredHeight(child), 0);
}
function render(fixture, overrides = {}) {
  const form = document.createElement("section");
  form.className = "printform";
  form.innerHTML = fixture.html;
  document.body.append(form);
  const config = { ...FOOTER_OVERRIDES, papersizeWidth: fixture.width, papersizeHeight: fixture.height, ...overrides };
  const formatter = new PrintFormFormatter(form, getPrintformConfig(form, config), config);
  return formatter.format();
}
function records(output) {
  return Array.from(output.querySelectorAll("[data-record]"), node => ({ id: node.dataset.record, amount: node.nextElementSibling.textContent }));
}
function pages(output) { return Array.from(output.querySelectorAll(".printform_page")); }

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const height = declaredHeight(this);
    return { x: 0, y: 0, left: 0, right: 260, top: 0, bottom: height, width: 260, height };
  });
});
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

describe("consumer-visible final-page and signature boundaries", () => {
  it.each([[148, 1], [146.25, 1], [146.125, 2]])("places fractional final footers at the real %spx boundary", (height, pageCount) => {
    const fixture = fractionalFooterFixture(height), output = render(fixture);
    expect(pages(output)).toHaveLength(pageCount);
    expect(records(output)).toEqual(fixture.records);
    expect(Array.from(output.querySelectorAll('[data-pf-component-type="signature"]'), node => node.textContent)).toEqual([SIGNATURE_TEXT]);
    expect(pages(output).every(page => declaredHeight(page) <= height)).toBe(true);
  });

  it.each([false, true])("keeps a measured summary/signoff tail on one legal page with repeat footer=%s", repeat => {
    const fixture = flowFooterFixture({ repeat }), output = render(fixture, { repeatFooter: repeat });
    const summary = output.querySelector("[data-summary]"), signature = output.querySelector('[data-pf-component-type="signature"]');
    expect(summary.closest(".printform_page")).toBe(signature.closest(".printform_page"));
    expect(signature.textContent).toBe(SIGNATURE_TEXT);
    expect(records(output)).toEqual(fixture.records);
    expect(pages(output)).toHaveLength(2);
    expect(pages(output).every(page => declaredHeight(page) <= fixture.height)).toBe(true);
    expect(Array.from(output.querySelectorAll("[data-page-number]"), node => node.textContent)).toEqual(pages(output).map((_page, index) => String(index + 1)));
    expect(Array.from(output.querySelectorAll("[data-page-total]"), node => node.textContent)).toEqual(pages(output).map(() => String(pages(output).length)));
    if (repeat) expect(pages(output).every(page => page.querySelectorAll(".pfooter_processed").length === 1)).toBe(true);
  });

  it.each([{ explicitBreak: true }, { oversized: true }])("preserves explicit breaks and degrades an oversized advisory chain without splitting signoff: %j", options => {
    const fixture = flowFooterFixture(options), output = render(fixture);
    const summary = output.querySelector("[data-summary]"), signature = output.querySelector('[data-pf-component-type="signature"]');
    expect(summary.closest(".printform_page")).not.toBe(signature.closest(".printform_page"));
    expect(signature.textContent).toBe(SIGNATURE_TEXT);
    expect(records(output)).toEqual(fixture.records);
    expect(pages(output)).toHaveLength(2);
    expect(pages(output).every(page => declaredHeight(page) <= fixture.height)).toBe(true);
  });

  it("places a signoff on a continuation when only first-page chrome prevents the fit", () => {
    const fixture = { width: 260, height: 150, records: [], html: `<header class="pheader" style="height:60px">First-only document information</header><div class="ptac-rowitem without_prowheader" data-pf-keep-together="true" style="height:110px"><section data-pf-component-type="signature">${SIGNATURE_TEXT}</section></div>` };
    const output = render(fixture);
    expect(pages(output)).toHaveLength(2);
    expect(output.querySelector('[data-pf-component-type="signature"]').closest(".printform_page")).toBe(pages(output).at(-1));
    expect(pages(output).every(page => declaredHeight(page) <= fixture.height)).toBe(true);
  });

  it("rejects an indivisible signature larger than the paper and restores the original DOM/listener", () => {
    const form = document.createElement("section");
    form.className = "printform";
    form.innerHTML = `<div class="ptac-rowitem signature-block" style="height:200px">${SIGNATURE_TEXT}</div>`;
    document.body.append(form);
    const source = form.firstElementChild, original = form.outerHTML, listener = vi.fn();
    source.addEventListener("click", listener);
    const formatter = new PrintFormFormatter(form, getPrintformConfig(form, { ...FOOTER_OVERRIDES, papersizeHeight: 150 }));
    expect(() => formatter.format()).toThrow(RangeError);
    source.click();
    expect(form.outerHTML).toBe(original);
    expect(form.firstElementChild).toBe(source);
    expect(listener).toHaveBeenCalledOnce();
    expect(document.querySelector(".printform_formatter,.printform_formatter_processed")).toBeNull();
  });
});
