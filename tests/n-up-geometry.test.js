import { afterEach, describe, expect, it, vi } from "vitest";
import { applyNUpGeometry } from "../src/printform/formatter/n-up-geometry.js";

const config = { papersizeWidth: 240, papersizeHeight: 120, nUp: 4 };
const rect = (width, height, left = 0, top = 0) => ({ width, height, left, top, right: left + width, bottom: top + height });

function output(count = 7, nUp = 4) {
  const root = document.createElement("div");
  root.dir = "rtl";
  root.className = "invoice-context";
  root.style.color = "red";
  for (let index = 0; index < count; index += 1) {
    if (index % nUp === 0) {
      if (index) {
        const divider = document.createElement("div");
        divider.className = "div_page_break_before";
        root.append(divider);
      }
      const wrapper = document.createElement("div");
      wrapper.className = "physical_page_wrapper";
      wrapper.style.cssText = "display:flex;flex-direction:column;width:240px";
      root.append(wrapper);
    }
    const page = document.createElement("div");
    page.className = "printform_page";
    page.style.cssText = "width:240px;direction:rtl";
    page.textContent = `Fictional Lantern page ${index + 1}`;
    root.lastElementChild.append(page);
  }
  document.body.append(root);
  return root;
}

// Unit contracts model dimensions only; real layout is asserted in three browsers.
function mockRectangles() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function measure() {
    if (this.classList.contains("physical_page_wrapper")) {
      return rect(Number.parseFloat(this.style.width), Number.parseFloat(this.style.height) || 120);
    }
    if (this.classList.contains("printform_n_up_cell")) {
      const width = Number(this.dataset.pfCellWidth), height = Number(this.dataset.pfCellHeight);
      return rect(width, height, (Number(this.style.gridColumn) - 1) * width, (Number(this.style.gridRow) - 1) * height);
    }
    if (this.classList.contains("printform_page")) {
      const scale = Number(this.dataset.pfLogicalScale) || 1;
      const cellRect = this.parentElement.classList.contains("printform_n_up_cell")
        ? this.parentElement.getBoundingClientRect() : rect(0, 0);
      return rect(240 * scale, 120 * scale, cellRect.left, cellRect.top);
    }
    return rect(0, 0);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("physical n-up imposition", () => {
  it("keeps nUp=1 host width, padding, page margins and RTL unchanged", () => {
    const root = output(2, 1);
    root.dataset.pfNUpGeometry = "spoofed-source-marker";
    const wrapper = root.firstElementChild;
    wrapper.style.cssText += ";width:300px;padding:20px";
    const page = wrapper.firstElementChild;
    page.style.marginBottom = "24px";
    const wrapperStyle = wrapper.getAttribute("style"), pageStyle = page.getAttribute("style");
    expect(applyNUpGeometry(root, { ...config, nUp: 1 })).toMatchObject({ sheets: 2, scale: 1 });
    expect(wrapper.getAttribute("style")).toBe(wrapperStyle);
    expect(page.getAttribute("style")).toBe(pageStyle);
    expect(root.querySelector("style")).toBeNull();
    expect(root.dataset.pfNUpGeometry).toBeUndefined();
    expect(page.dataset).toMatchObject({ pfLogicalPage: "1", pfPhysicalPage: "1", pfLogicalScale: "1" });
  });

  it("creates real grid cells, a uniform scale and named print paper without reordering nodes", () => {
    mockRectangles();
    const root = output();
    const pages = [...root.querySelectorAll(".printform_page")];
    const result = applyNUpGeometry(root, config);
    expect(result).toMatchObject({ sheets: 2, columns: 2, rows: 2, scale: 0.5, paper: { width: 240, height: 120 } });
    expect([...root.querySelectorAll(".printform_page")]).toEqual(pages);
    expect(root.querySelectorAll(".printform_n_up_cell")).toHaveLength(7);
    expect(root.querySelectorAll(".div_page_break_before")).toHaveLength(0);
    pages.forEach((page, index) => {
      expect(page.dataset.pfLogicalScale).toBe("0.5");
      expect(page.dataset.pfLogicalPage).toBe(String(index + 1));
      expect(page.dataset.pfPhysicalPage).toBe(String(Math.floor(index / 4) + 1));
      expect(page.style.direction).toBe("rtl");
      expect(page.style.overflow).toBe("visible");
    });
    expect(root.dir).toBe("rtl");
    expect(root.style.color).toBe("red");
  });

  it("uses CSS 96px/in for preset physical paper even when logical DPI differs", () => {
    mockRectangles();
    const result = applyNUpGeometry(output(), { ...config, paperSize: "LETTER", orientation: "landscape", dpi: 192 });
    expect(result.paper).toEqual({ width: 1056, height: 816 });
  });

  it("includes host wrapper padding in cell capacity, rather than discarding it", () => {
    mockRectangles();
    const root = output();
    root.querySelectorAll(".physical_page_wrapper").forEach((wrapper) => { wrapper.style.padding = "10px"; });
    const result = applyNUpGeometry(root, config);
    expect(result.scale).toBeLessThan(0.5);
    expect(root.firstElementChild.dataset.pfNUpStyle).toBeDefined();
    expect(root.querySelector(".printform_n_up_cell").dataset.pfCellWidth).toBe("110");
    expect(root.querySelector(".physical_page_wrapper").style.paddingTop).toBe("10px");
  });

  it("rejects logical overflow before inserting any cells or print stylesheet", () => {
    mockRectangles();
    const root = output();
    const child = document.createElement("div");
    child.getClientRects = () => [rect(300, 20)];
    root.querySelector(".printform_page").append(child);
    expect(() => applyNUpGeometry(root, config)).toThrow("logical content overflows");
    expect(root.querySelector(".printform_n_up_cell,style")).toBeNull();
    expect(child.isConnected).toBe(true);
  });

  it("rejects overfull or empty physical groups and impossible host padding", () => {
    mockRectangles();
    const malformed = output(5, 5);
    expect(() => applyNUpGeometry(malformed, config)).toThrow("physical groups");
    const empty = output(1);
    empty.firstElementChild.replaceChildren();
    expect(() => applyNUpGeometry(empty, config)).toThrow("physical groups");
    const padded = output();
    padded.querySelector(".physical_page_wrapper").style.padding = "100px";
    expect(() => applyNUpGeometry(padded, config)).toThrow("sheet content height");
  });
});

it("rejects pre-scaled pages and incompatible actual physical sheet geometry", () => {
  mockRectangles();
  const scaled = output();
  scaled.querySelector(".printform_page").style.transform = "scale(.5)";
  expect(() => applyNUpGeometry(scaled, config)).toThrow("must be unscaled");
  const incompatible = output();
  incompatible.querySelector(".physical_page_wrapper").getBoundingClientRect = () => rect(999, 120);
  expect(() => applyNUpGeometry(incompatible, config)).toThrow("host CSS prevents");
});

it("preserves authored forced-sheet boundaries with partial nonfinal groups", () => {
  mockRectangles();
  // A three-page main document followed by a deliberately separate appendix.
  const root = output(5, 3);
  const pages = [...root.querySelectorAll(".printform_page")];
  const result = applyNUpGeometry(root, config);
  expect(result.sheets).toBe(2);
  const sheets = [...root.querySelectorAll(".physical_page_wrapper")];
  expect(sheets.map((sheet) => sheet.querySelectorAll(".printform_n_up_cell").length)).toEqual([3, 2]);
  expect([...root.querySelectorAll(".printform_page")]).toEqual(pages);
  expect(pages.map((page) => page.dataset.pfPhysicalPage)).toEqual(["1", "1", "1", "2", "2"]);
  expect(pages.map((page) => page.dataset.pfLogicalPage)).toEqual(["1", "2", "3", "4", "5"]);
});
