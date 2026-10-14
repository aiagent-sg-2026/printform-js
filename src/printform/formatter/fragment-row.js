import { DomHelpers } from "../dom.js";
import { cloneContentRange, contentBoundaries, hasGeneratedContent } from "../text-ranges.js";
import { wordCeilingEnd } from "../text.js";

const POLICIES = new Set(["split", "first", "last", "repeat"]);

function fail(row, reason) {
  throw new RangeError(`Printform row exceeds configured height; unsplittable content or chrome does not fit (${row.dataset.pfSourceRow || row.id || "row"}: ${reason})`);
}

function rowCells(row) {
  if (row.tagName !== "TABLE") return [row];
  if (row.rows.length !== 1 || Array.from(row.rows[0].cells).some((cell) => cell.rowSpan !== 1)) {
    fail(row, "measured continuations require a single table row without rowspan");
  }
  return Array.from(row.rows[0].cells);
}

function pinColumns(source, clone, paperWidth) {
  if (source.tagName !== "TABLE") return;
  const view = source.ownerDocument.defaultView;
  const tableStyle = view.getComputedStyle(source);
  const px = (style, name) => Number.parseFloat(style[name]) || 0;
  const measuredWidth = source.getBoundingClientRect().width;
  const targetWidth = Math.min(measuredWidth || paperWidth, paperWidth);
  const sources = rowCells(source);
  const styles = sources.map((cell) => view.getComputedStyle(cell));
  const gap = tableStyle.borderCollapse === "collapse" ? 0
    : px(tableStyle, "borderSpacing") * (sources.length + 1);
  const chrome = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"]
    .reduce((sum, name) => sum + px(tableStyle, name), 0);
  const available = targetWidth - gap - chrome;
  if (!(available > 0)) fail(source, "table border/padding/spacing consumes the target paper width");
  // Used CSS widths and border-box widths are not interchangeable for td.
  // Normalize measured outer cell proportions into the target table's actual
  // content budget, rather than preserving an intrinsically oversized table.
  const widths = sources.map((cell) => cell.getBoundingClientRect().width);
  const total = widths.reduce((sum, value) => sum + value, 0);
  clone.style.width = `${targetWidth}px`;
  clone.style.boxSizing = "border-box";
  clone.style.tableLayout = "fixed";
  rowCells(clone).forEach((cell, index) => {
    const outer = available * (total ? widths[index] / total : 1 / sources.length);
    const cellChrome = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"]
      .reduce((sum, name) => sum + px(styles[index], name), 0);
    cell.style.width = `${Math.max(0, outer - (styles[index].boxSizing === "border-box" ? 0 : cellChrome))}px`;
  });
}

function fits(row, height, width) {
  if (DomHelpers.measureHeightRaw(row) > height + 0.01) return false;
  const rect = row.getBoundingClientRect();
  if (rect.width > width + 0.01 || row.scrollWidth > rect.width + 1) return false;
  const contained = Array.from(row.querySelectorAll("td,th,img,svg,canvas")).every((node) => {
    const child = node.getBoundingClientRect();
    return child.left >= rect.left - 0.01 && child.right <= rect.right + 0.01 &&
      node.scrollWidth <= node.clientWidth + 1;
  });
  if (!contained) return false;
  const walker = row.ownerDocument.createTreeWalker(row, 4);
  const range = row.ownerDocument.createRange();
  if (typeof range.getClientRects !== "function") return true;
  while (walker.nextNode()) {
    range.selectNodeContents(walker.currentNode);
    const owner = walker.currentNode.parentElement.closest("td,th") || row;
    const bounds = owner.getBoundingClientRect();
    if (Array.from(range.getClientRects()).some((text) => text.width > 0 &&
      (text.left < bounds.left - 0.01 || text.right > bounds.right + 0.01))) return false;
  }
  return true;
}

// Each cell is a parallel flow. Short cells finish once; amounts are never copied
// merely because an independent description needs another physical continuation.
export function fragmentMeasuredRow(row, { height, width, sourceId, maxWords = Infinity }) {
  const readabilitySplit = Number.isFinite(maxWords) && (row.textContent.match(/\S+/g) || []).length > maxWords;
  if (DomHelpers.measureHeightRaw(row) <= height + 0.01 && !readabilitySplit) return [row];
  if (!(height > 0) || row.dataset.pfKeepTogether === "true") fail(row, "atomic row or no body budget");
  const sources = rowCells(row);
  if ([row, ...sources].some(hasGeneratedContent)) fail(row, "generated row/cell chrome cannot be duplicated across continuations");
  const template = row.cloneNode(true);
  pinColumns(row, template, width);
  const probe = template.cloneNode(true);
  probe.style.visibility = "hidden";
  row.parentNode.insertBefore(probe, row);
  const probeCells = rowCells(probe);
  const chunks = [];
  const policies = [];
  try {
    sources.forEach((source, cellIndex) => {
      let policy = source.dataset.pfCellPolicy || "split";
      if (!POLICIES.has(policy)) fail(row, `unknown cell policy ${policy}`);
      if (policy === "split" && (source.dataset.pfKeepTogether === "true" || source.dataset.pfFormat === "currency")) policy = "first";
      policies.push(policy);
      probeCells.forEach((cell) => cell.replaceChildren());
      const target = probeCells[cellIndex];
      if (policy !== "split") {
        target.replaceChildren(...Array.from(source.childNodes, (node) => node.cloneNode(true)));
        if (!fits(probe, height, width)) fail(row, `${policy} cell ${cellIndex} cannot fit intact`);
        chunks.push([Array.from(source.childNodes, (node) => node.cloneNode(true))]);
        return;
      }
      const points = contentBoundaries(source);
      const cellChunks = [];
      let start = 0;
      while (start < points.length - 1) {
        let low = start + 1;
        let high = wordCeilingEnd(points, start, maxWords);
        let end = start;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          target.replaceChildren(cloneContentRange(source, points, start, middle));
          if (fits(probe, height, width)) { end = middle; low = middle + 1; }
          else high = middle - 1;
        }
        if (end === start) fail(row, `cell ${cellIndex} has an atomic element, grapheme or fixed chrome larger than its budget`);
        cellChunks.push(cloneContentRange(source, points, start, end));
        start = end;
      }
      chunks.push(cellChunks);
    });
    const count = Math.max(...chunks.map((cell) => cell.length));
    const fragments = Array.from({ length: count }, (_, index) => {
      const fragment = template.cloneNode(true);
      rowCells(fragment).forEach((cell, cellIndex) => {
        const policy = policies[cellIndex];
        const selected = policy === "repeat" ? 0 : policy === "last" ? (index === count - 1 ? 0 : -1) : index;
        const chunk = chunks[cellIndex][selected];
        cell.replaceChildren();
        if (chunk) {
          if (Array.isArray(chunk)) cell.append(...chunk.map((node) => node.cloneNode(true)));
          else cell.append(chunk.cloneNode(true));
        }
      });
      fragment.dataset.pfSourceRow = sourceId;
      fragment.dataset.pfFragmentIndex = String(index);
      fragment.dataset.pfFragmentCount = String(count);
      if (index > 0) {
        fragment.classList.remove("tb_page_break_before");
      }
      return fragment;
    });
    fragments.forEach((fragment) => {
      probe.replaceWith(fragment);
      if (!fits(fragment, height, width)) { fragment.remove(); fail(row, "combined cell continuations exceed the measured budget"); }
      fragment.replaceWith(probe);
    });
    return fragments;
  } finally { probe.remove(); }
}
