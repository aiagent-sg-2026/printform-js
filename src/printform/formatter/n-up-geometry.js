import { resolvePaperDimensions } from "../helpers.js";

const EPSILON = 1;
let geometrySequence = 0;
const PHYSICAL_MARKERS = [
  "n-up-geometry", "n-up", "n-up-style", "n-up-columns", "n-up-rows", "n-up-cell",
  "physical-page", "physical-last", "physical-width", "physical-height",
  "logical-page", "logical-scale", "logical-width", "logical-height", "cell-width", "cell-height"
];

function fail(message) {
  throw new RangeError(`Printform n-up geometry: ${message}`);
}

function positive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) fail(`${label} must be positive`);
  return number;
}

function important(node, properties) {
  for (const [property, value] of Object.entries(properties)) {
    node.style.setProperty(property, String(value), "important");
  }
}

function inBounds(rect, bounds) {
  return rect.left >= bounds.left - EPSILON && rect.top >= bounds.top - EPSILON &&
    rect.right <= bounds.right + EPSILON && rect.bottom <= bounds.bottom + EPSILON;
}

function measureLogicalPage(page, config, view) {
  const style = view.getComputedStyle(page);
  if ((style.transform && style.transform !== "none") || Number.parseFloat(style.zoom || "1") !== 1) {
    fail("logical pages must be unscaled before imposition");
  }
  const rect = page.getBoundingClientRect();
  const width = positive(config.papersizeWidth, "logical width");
  const height = positive(config.papersizeHeight, "logical height");
  if (rect.width > width + EPSILON || rect.height > height + EPSILON) {
    fail("logical page exceeds configured dimensions");
  }
  if (rect.width < width - EPSILON) fail("host CSS narrows the configured logical width; imposition cannot reflow finalized pages");
  const bounds = { left: rect.left, top: rect.top, right: rect.left + width, bottom: rect.top + height };
  for (const child of page.querySelectorAll("*")) {
    for (const childRect of child.getClientRects()) {
      if ((childRect.width || childRect.height) && !inBounds(childRect, bounds)) {
        fail(`logical content overflows its page: ${child.localName} at ${childRect.left - rect.left},${childRect.top - rect.top} size ${childRect.width}x${childRect.height} exceeds ${width}x${height}; reflow or fragment it before imposition`);
      }
    }
  }
  const walker = page.ownerDocument.createTreeWalker(page, 4);
  const range = page.ownerDocument.createRange();
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent.trim()) continue;
    range.selectNodeContents(walker.currentNode);
    if (typeof range.getClientRects !== "function") continue;
    for (const textRect of range.getClientRects()) {
      if ((textRect.width || textRect.height) && !inBounds(textRect, bounds)) {
        fail("logical text overflows its page; no text was clipped");
      }
    }
  }
  return { page, width, height, direction: style.direction || "ltr" };
}

function sheetInsets(wrapper, view) {
  const style = view.getComputedStyle(wrapper);
  const px = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0;
  const padding = ["top", "right", "bottom", "left"].map((side) => px(`padding-${side}`));
  return {
    padding,
    x: padding[1] + padding[3] + px("border-left-width") + px("border-right-width"),
    y: padding[0] + padding[2] + px("border-top-width") + px("border-bottom-width")
  };
}

function gridFor(nUp, width, height, logicalWidth, logicalHeight) {
  let best;
  for (let columns = 1; columns <= nUp; columns += 1) {
    const rows = Math.ceil(nUp / columns);
    const scale = Math.min(width / columns / logicalWidth, height / rows / logicalHeight, 1);
    const unused = columns * rows - nUp;
    if (!best || scale > best.scale + 1e-9 ||
        (Math.abs(scale - best.scale) < 1e-9 && unused < best.unused)) {
      best = { columns, rows, scale, unused };
    }
  }
  return best;
}

function markPages(wrappers) {
  let logicalNumber = 0;
  wrappers.forEach((wrapper, sheetIndex) => {
    wrapper.dataset.pfPhysicalPage = String(sheetIndex + 1);
    for (const page of wrapper.querySelectorAll(".printform_page")) {
      page.dataset.pfLogicalPage = String(++logicalNumber);
      page.dataset.pfPhysicalPage = String(sheetIndex + 1);
      page.dataset.pfLogicalScale = "1";
    }
  });
}

/**
 * Impose finalized, unscaled logical pages. Call after ALL finalizePageHeight calls,
 * inside the formatter's rollback boundary. nUp=1 deliberately keeps host geometry.
 * Paper presets use 96 CSS px/in, independent of the logical pagination DPI.
 */
export function applyNUpGeometry(outputContainer, config) {
  const nUp = Math.max(1, Math.floor(Number(config.nUp) || 1));
  const wrappers = Array.from(outputContainer.children)
    .filter((node) => node.classList.contains("physical_page_wrapper"));
  for (const node of [outputContainer, ...outputContainer.querySelectorAll("*")]) {
    for (const marker of PHYSICAL_MARKERS) node.removeAttribute(`data-pf-${marker}`);
  }
  outputContainer.dataset.pfNUp = String(nUp);
  if (nUp === 1) {
    markPages(wrappers);
    return { nUp, sheets: wrappers.length, columns: 1, rows: 1, scale: 1 };
  }
  if (!Number.isFinite(nUp)) fail("nUp must be finite");
  wrappers[wrappers.length - 1]?.setAttribute("data-pf-physical-last", "true");
  const view = outputContainer.ownerDocument.defaultView;
  const paper = resolvePaperDimensions({ ...config, dpi: 96 }) || {
    width: positive(config.papersizeWidth, "paper width"),
    height: positive(config.papersizeHeight, "paper height")
  };
  const measurements = wrappers.map((wrapper) => {
    const pages = Array.from(wrapper.children).filter((node) => node.classList.contains("printform_page"));
    if (!pages.length || pages.length > nUp) {
      fail("physical groups must contain between one and nUp contiguous logical pages");
    }
    return { wrapper, inset: sheetInsets(wrapper, view), pages: pages.map((page) => measureLogicalPage(page, config, view)) };
  });
  if (!measurements.length) fail("no physical sheets were produced");
  const availableWidth = Math.min(...measurements.map(({ inset }) => paper.width - inset.x));
  const availableHeight = Math.min(...measurements.map(({ inset }) => paper.height - inset.y));
  positive(availableWidth, "sheet content width after padding/borders");
  positive(availableHeight, "sheet content height after padding/borders");
  const grid = gridFor(nUp, availableWidth, availableHeight,
    positive(config.papersizeWidth, "logical width"), positive(config.papersizeHeight, "logical height"));
  const name = `pf_nup_${++geometrySequence}`;
  const style = outputContainer.ownerDocument.createElement("style");
  style.dataset.pfNUpStyle = name;
  style.textContent = `@page ${name} { size: ${paper.width / 96}in ${paper.height / 96}in; margin: 0; }
@media print {
  [data-pf-n-up-geometry="${name}"] { margin:0!important; padding:0!important; border:0!important; width:${paper.width}px!important; }
  [data-pf-n-up-geometry="${name}"] > .physical_page_wrapper { page:${name}; margin:0!important; box-shadow:none!important; break-inside:avoid; break-after:page; }
  [data-pf-n-up-geometry="${name}"] > [data-pf-physical-last="true"] { break-after:auto; }
}`;
  outputContainer.prepend(style);
  outputContainer.dataset.pfNUpGeometry = name;
  outputContainer.dataset.pfNUp = String(nUp);
  for (const divider of Array.from(outputContainer.children)) {
    if (divider.classList.contains("div_page_break_before")) divider.remove();
  }
  markPages(wrappers);
  for (const { wrapper, inset, pages } of measurements) {
    important(wrapper, {
      display: "grid", "grid-template-columns": `repeat(${grid.columns}, minmax(0, 1fr))`,
      "grid-template-rows": `repeat(${grid.rows}, minmax(0, 1fr))`, gap: "0",
      width: `${paper.width}px`, height: `${paper.height}px`, "box-sizing": "border-box",
      padding: inset.padding.map((value) => `${value}px`).join(" "),
      "align-items": "stretch", "justify-items": "stretch", direction: "ltr", overflow: "visible",
      "min-width": "0", "min-height": "0", "max-width": "none", "max-height": "none"
    });
    wrapper.dataset.pfPhysicalWidth = String(paper.width);
    wrapper.dataset.pfPhysicalHeight = String(paper.height);
    wrapper.dataset.pfNUpColumns = String(grid.columns);
    wrapper.dataset.pfNUpRows = String(grid.rows);
    pages.forEach(({ page, width, height, direction }, index) => {
      const cell = outputContainer.ownerDocument.createElement("div");
      cell.className = "printform_n_up_cell";
      cell.dataset.pfPhysicalPage = wrapper.dataset.pfPhysicalPage;
      cell.dataset.pfLogicalPage = page.dataset.pfLogicalPage;
      cell.dataset.pfCellWidth = String((paper.width - inset.x) / grid.columns);
      cell.dataset.pfCellHeight = String((paper.height - inset.y) / grid.rows);
      cell.dataset.pfNUpCell = String(index);
      important(cell, {
        position: "relative", "min-width": "0", "min-height": "0", overflow: "visible",
        "grid-column": String(index % grid.columns + 1), "grid-row": String(Math.floor(index / grid.columns) + 1),
        margin: "0", padding: "0", border: "0", direction
      });
      wrapper.insertBefore(cell, page);
      cell.appendChild(page);
      // Transform-only scaling leaves unscaled print fragmentation geometry:
      // footer text can spill onto an extra PDF page despite correct screen bounds.
      important(page, {
        position: "absolute", left: "0", top: "0", width: `${width}px`, height: `${height}px`,
        "box-sizing": "border-box", margin: "0", "max-width": "none", "max-height": "none",
        "min-width": "0", "min-height": "0", transform: "none", zoom: String(grid.scale),
        overflow: "visible", "box-shadow": "none", direction
      });
      page.dataset.pfLogicalScale = String(grid.scale);
      page.dataset.pfLogicalWidth = String(width);
      page.dataset.pfLogicalHeight = String(height);
    });
  }
  for (const { wrapper } of measurements) {
    const sheetRect = wrapper.getBoundingClientRect();
    if (Math.abs(sheetRect.width - paper.width) > EPSILON || Math.abs(sheetRect.height - paper.height) > EPSILON) {
      fail("host CSS prevents the configured physical sheet dimensions");
    }
    for (const cell of wrapper.children) {
      const cellRect = cell.getBoundingClientRect();
      const pageRect = cell.firstElementChild.getBoundingClientRect();
      if (!inBounds(cellRect, sheetRect) || !inBounds(pageRect, cellRect)) {
        fail("physical cell/page overflow; host geometry is incompatible");
      }
    }
  }
  return { nUp, sheets: wrappers.length, columns: grid.columns, rows: grid.rows, scale: grid.scale, paper };
}
