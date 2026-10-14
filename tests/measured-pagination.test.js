import { describe, expect, it } from "vitest";
import { PrintFormFormatter } from "../src/printform/formatter/PrintFormFormatter.js";
import { getPrintformConfig } from "../src/printform/config.js";
import { resetFragmentMetadata } from "../src/printform/formatter/measured-rows.js";

function budgetFixture() {
  const form = document.createElement("section");
  form.className = "printform";
  form.innerHTML = '<div class="pheader">Header</div><div class="prowheader" data-pf-table-id="A">A columns</div><div class="prowheader" data-pf-table-id="B">B columns</div><div class="prowitem" data-pf-table-id="B">B scope</div>';
  const formatter = new PrintFormFormatter(form, getPrintformConfig(form, { papersizeHeight: 200 }));
  const sections = formatter.collectSections();
  const heights = { header: 10, docInfos: {}, rowHeader: 80, rowHeaders: { A: 80, B: 20 }, footerVariants: {}, footerLogo: 0, footerPagenum: 0 };
  return { form, formatter, sections, heights, row: sections.rows[0] };
}

describe("measured continuation budgets and reserved identity", () => {
  it("uses the active repeated table header rather than the largest other table header", () => {
    const { formatter, sections, heights, row } = budgetFixture();
    const context = formatter.initializePageContext(formatter.computeHeightPerPage(sections, heights));
    formatter.refreshPageContextForRow(context, row, heights, sections);
    expect(context.limit).toBe(170);
    expect(formatter.computeRepeatingHeightForPage(sections, heights, false, "B")).toBe(30);
    row.classList.add("without_prowheader");
    formatter.refreshPageContextForRow(context, row, heights, sections);
    expect(context.limit).toBe(190);
  });

  it("does not reserve a repeated height for a first-only active table header", () => {
    const { formatter, sections, heights, row } = budgetFixture();
    sections.rowHeadersById.B.dataset.pfRepeatRowheader = "false";
    const context = formatter.initializePageContext(formatter.computeHeightPerPage(sections, heights));
    formatter.refreshPageContextForRow(context, row, heights, sections);
    expect(context.limit).toBe(190);
    expect(formatter.computeRepeatingHeightForPage(sections, heights, false, "B")).toBe(10);
  });

  it("strips source-forged continuation metadata only from the working clone", () => {
    const form = document.createElement("section");
    form.innerHTML = '<div data-pf-source-row="forged" data-pf-fragment-index="0" data-pf-fragment-count="2" data-pf-row-repeat="invoice" data-pf-row-index="0"><span data-pf-source-row="nested">MYR 10.00</span></div>';
    const original = form.innerHTML;
    const clone = form.cloneNode(true);
    resetFragmentMetadata(clone);
    expect(clone.querySelectorAll("[data-pf-source-row],[data-pf-fragment-index],[data-pf-fragment-count]")).toHaveLength(0);
    expect(clone.firstElementChild.dataset.pfRowRepeat).toBe("invoice");
    expect(clone.firstElementChild.dataset.pfRowIndex).toBe("0");
    expect(clone.textContent).toBe("MYR 10.00");
    expect(form.innerHTML).toBe(original);
  });
});
