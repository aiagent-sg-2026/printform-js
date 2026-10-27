import { describe, expect, it } from "vitest";
import { attachRenderingMethods } from "../src/printform/formatter/rendering.js";
import { shouldCarryOneTimeTableHeader } from "../src/printform/formatter/row-header-policy.js";

class HeaderFormatter {
  constructor() {
    this.config = { repeatHeader: false, repeatRowheader: true };
    this.currentPage = 1;
    this.showLogicalPageNumber = false;
    this.showPhysicalPageNumber = false;
    this.logicalPageNumberClones = [];
    this.physicalPageNumberClones = [];
    this.logicalPageToPhysicalPage = [];
  }

  getRowTableId(node) {
    return node?.getAttribute("data-pf-table-id") || "default";
  }

  registerPageNumberClone() {}
}

attachRenderingMethods(HeaderFormatter);

function makeSections() {
  const source = document.createElement("div");
  source.innerHTML = `
    <div class="prowheader_processed" data-pf-table-id="valuation">Valuation header</div>
    <div class="prowheader_processed" data-pf-table-id="variation">Variation header</div>
  `;
  const [valuation, variation] = source.querySelectorAll(".prowheader_processed");
  return {
    header: null,
    docInfos: [],
    rowHeader: valuation,
    rowHeaders: [valuation, variation],
    rowHeadersById: { valuation, variation },
    footerVariants: [],
    footerLogo: null,
    footerPagenum: null,
  };
}

describe("active table context", () => {
  it("keeps repeated headers with a row only when explicitly opted in", () => {
    const formatter = new HeaderFormatter();
    const sections = makeSections();
    const container = document.createElement("div");
    expect(shouldCarryOneTimeTableHeader(formatter, container, sections, "variation")).toBe(false);
    sections.rowHeadersById.variation.dataset.pfKeepWithNext = "true";
    expect(shouldCarryOneTimeTableHeader(formatter, container, sections, "variation")).toBe(true);
    container.innerHTML = '<div class="prowitem_processed" data-pf-table-id="valuation"></div>';
    expect(shouldCarryOneTimeTableHeader(formatter, container, sections, "variation")).toBe(true);
    container.insertAdjacentHTML("beforeend", '<div class="prowitem_processed" data-pf-table-id="variation"></div>');
    expect(shouldCarryOneTimeTableHeader(formatter, container, sections, "variation")).toBe(false);
  });
  it("repeats the header belonging to the table that owns the next row", () => {
    const formatter = new HeaderFormatter();
    const container = document.createElement("div");
    formatter.appendRepeatingSections(container, makeSections(), null, false, "variation");

    expect(container.querySelectorAll(".prowheader_processed")).toHaveLength(1);
    expect(container.querySelector(".prowheader_processed").dataset.pfTableId).toBe("variation");
  });

  it("does not add a completed table header when the active table is different", () => {
    const formatter = new HeaderFormatter();
    const container = document.createElement("div");
    const sections = makeSections();
    formatter.appendRepeatingSections(container, sections, null, false, "valuation");
    formatter.ensureActiveTableHeader(container, sections, null, "variation");

    expect(Array.from(container.querySelectorAll(".prowheader_processed"), (node) => node.dataset.pfTableId)).toEqual([
      "valuation",
      "variation",
    ]);
  });
});
