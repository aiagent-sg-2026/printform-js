import { DomHelpers } from "../dom.js";
import { fitsWithinHeight } from "./pagination-fit.js";
import { shouldCarryOneTimeTableHeader } from "./row-header-policy.js";

// An advisory flow chain moves only when it fits intact on a continuation page.
// Explicit breaks win; an oversized chain falls back to normal measured rows.
export function shouldMoveKeepWithNextGroup(formatter, container, sections, index) {
  const first = sections.rows[index];
  if (first.dataset.pfKeepWithNext !== "true" || first.classList.contains("tb_page_break_before")) return false;
  let end = index;
  while (end + 1 < sections.rows.length && sections.rows[end].dataset.pfKeepWithNext === "true" &&
    !sections.rows[end + 1].classList.contains("tb_page_break_before")) end += 1;
  if (end === index) return false;

  function probe(page, continuation) {
    const previousEnd = page.lastChild;
    const logicalCount = formatter.logicalPageNumberClones.length;
    const physicalCount = formatter.physicalPageNumberClones.length;
    const seen = formatter.seenTableHeaders;
    const pageNumber = formatter.currentPage;
    formatter.seenTableHeaders = new Set(seen);
    try {
      if (continuation) {
        const tableId = formatter.getRowTableId(first);
        if (shouldCarryOneTimeTableHeader(formatter, container, sections, tableId)) formatter.seenTableHeaders.delete(tableId);
        formatter.currentPage += 1;
        formatter.appendRepeatingSections(page, sections, null,
          formatter.shouldSkipRowHeaderForRow(first), formatter.getRowTableId(first));
      }
      for (let cursor = index; cursor <= end; cursor += 1) {
        const row = sections.rows[cursor];
        formatter.ensureActiveTableHeader(page, sections, null,
          formatter.getRowTableId(row), formatter.shouldSkipRowHeaderForRow(row));
        const clone = row.cloneNode(true);
        DomHelpers.markAsProcessed(clone, formatter.getRowBaseClass(row));
        page.appendChild(clone);
      }
      if (end === sections.rows.length - 1) formatter.appendFinalFooters(page, sections, null);
      else formatter.appendRepeatingFooters(page, sections, null);
      return fitsWithinHeight(DomHelpers.measureHeightRaw(page), formatter.config.papersizeHeight);
    } finally {
      while (page.lastChild !== previousEnd) page.lastChild.remove();
      formatter.logicalPageNumberClones.length = logicalCount;
      formatter.physicalPageNumberClones.length = physicalCount;
      formatter.seenTableHeaders = seen;
      formatter.currentPage = pageNumber;
    }
  }

  if (probe(container, false)) return false;
  const next = container.cloneNode(false);
  next.style.visibility = "hidden";
  container.parentNode.appendChild(next);
  try {
    return probe(next, true);
  } finally {
    next.remove();
  }
}
