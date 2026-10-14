import { DomHelpers } from "../dom.js";
import { cloneContentRange, contentBoundaries, hasGeneratedContent } from "../text-ranges.js";
import { wordCeilingEnd } from "../text.js";
import { measuredCellLayout } from "./fragment-table.js";

const POLICIES = new Set(["split", "first", "last", "repeat"]);

function fail(row, reason) {
  throw new RangeError(`Printform row exceeds configured height; unsplittable content or chrome does not fit (${row.dataset.pfSourceRow || row.id || "row"}: ${reason})`);
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

// Cells advance through the same DOM Range flow, including cells whose table
// grid rectangle intersects several logical rows or physical continuations.
export function fragmentMeasuredRow(row, { height, width, sourceId, maxWords = Infinity }) {
  const readabilitySplit = Number.isFinite(maxWords) && (row.textContent.match(/\S+/g) || []).length > maxWords;
  if (DomHelpers.measureHeightRaw(row) <= height + 0.01 && !readabilitySplit) return [row];
  if (!(height > 0) || row.dataset.pfKeepTogether === "true") fail(row, "atomic row or no body budget");
  const layout = measuredCellLayout(row, width, fail);
  if ([row, ...layout.rows, ...layout.cells.map(cell => cell.source)].some(hasGeneratedContent)) {
    fail(row, "generated row/cell chrome cannot be duplicated across continuations");
  }
  const flows = new Map(layout.cells.map((cell) => {
    const source = cell.source;
    let policy = source.dataset.pfCellPolicy || "split";
    if (!POLICIES.has(policy)) fail(row, `unknown cell policy ${policy}`);
    if (policy === "split" && (source.dataset.pfKeepTogether === "true" ||
      source.dataset.pfFormat === "currency" || source.dataset.pfMonetary === "currency")) policy = "first";
    return [cell, { policy, points: policy === "split" ? contentBoundaries(source) : null, cursor: 0, emitted: false }];
  }));
  const fragments = [];
  let startRow = 0;
  while (startRow < layout.rows.length) {
    let best = null;
    for (let endRow = startRow + 1; endRow <= layout.rows.length; endRow += 1) {
      const candidate = layout.slice(startRow, endRow, fragments.length === 0);
      const { fragment, targets } = candidate;
      if (row.tagName !== "TABLE") targets.set(layout.cells[0], fragment);
      const visibility = fragment.style.visibility;
      fragment.style.visibility = "hidden";
      row.parentNode.insertBefore(fragment, row);
      let viable = false;
      try {
        // Reserve indivisible content before measuring any text. In particular,
        // a last-policy amount cannot be displaced by a greedy description.
        targets.forEach((target, cell) => {
          const flow = flows.get(cell);
          if (flow.policy === "split") {
            const selected = best?.ends.get(cell) ?? flow.cursor;
            target.append(cloneContentRange(cell.source, flow.points, flow.cursor, selected));
          } else if (flow.policy === "repeat" || (flow.policy === "first" && !flow.emitted) ||
            (flow.policy === "last" && cell.end <= endRow)) {
            target.append(...Array.from(cell.source.childNodes, node => node.cloneNode(true)));
          }
        });
        if (!fits(fragment, height, width)) {
          if (!best) fail(row, "atomic cell, row or table chrome cannot fit intact");
          break;
        }
        const ends = new Map();
        targets.forEach((target, cell) => {
          const flow = flows.get(cell);
          if (flow.policy !== "split") return;
          let end = best?.ends.get(cell) ?? flow.cursor;
          let low = end + 1;
          let high = wordCeilingEnd(flow.points, flow.cursor, maxWords);
          while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            target.replaceChildren(cloneContentRange(cell.source, flow.points, flow.cursor, middle));
            if (fits(fragment, height, width)) { end = middle; low = middle + 1; }
            else high = middle - 1;
          }
          target.replaceChildren(cloneContentRange(cell.source, flow.points, flow.cursor, end));
          ends.set(cell, end);
        });
        const complete = Array.from(targets.keys()).every((cell) => {
          const flow = flows.get(cell);
          return cell.end > endRow || flow.policy !== "split" || ends.get(cell) === flow.points.length - 1;
        });
        targets.forEach((target, cell) => {
          if (flows.get(cell).policy === "last" && (cell.end > endRow || (!complete && cell.end === endRow))) target.replaceChildren();
        });
        const progress = complete || Array.from(ends).some(([cell, end]) => end > flows.get(cell).cursor);
        if (!progress) fail(row, "cell has an atomic element, grapheme or fixed chrome larger than its budget");
        fragment.style.visibility = visibility;
        best = { fragment, ends, targets, endRow, complete };
        viable = true;
        if (!complete) break;
      } finally {
        fragment.remove();
        if (!viable) fragment.style.visibility = visibility;
      }
    }
    if (!best) fail(row, "table continuation made no progress");
    best.ends.forEach((end, cell) => { flows.get(cell).cursor = end; });
    best.targets.forEach((_target, cell) => {
      if (flows.get(cell).policy === "first") flows.get(cell).emitted = true;
    });
    fragments.push(best.fragment);
    startRow = best.complete ? best.endRow : best.endRow - 1;
  }
  fragments.forEach((fragment, index) => {
    fragment.dataset.pfSourceRow = sourceId;
    fragment.dataset.pfFragmentIndex = String(index);
    fragment.dataset.pfFragmentCount = String(fragments.length);
    if (index > 0) fragment.classList.remove("tb_page_break_before");
  });
  return fragments;
}
