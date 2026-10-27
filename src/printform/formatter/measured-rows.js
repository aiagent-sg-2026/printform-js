import { fragmentMeasuredRow } from "./fragment-row.js";
import { columnFlowChildren } from "./column-flow.js";
import { DEFAULT_READABILITY_WORD_LIMIT } from "../text.js";
import { isKeepTogetherContent } from "../text-ranges.js";

let documentSequence = 0;
const RESERVED = ["data-pf-source-row", "data-pf-fragment-index", "data-pf-fragment-count"];

export function resetFragmentMetadata(form) {
  [form, ...form.querySelectorAll(RESERVED.map((name) => `[${name}]`).join(","))].forEach((node) => {
    RESERVED.forEach((name) => node.removeAttribute(name));
  });
}

export function expandMeasuredRows(formatter, sections, heights, footerState) {
  const documentId = ++documentSequence;
  const headerHeight = heights.header || 0;
  const docInfoHeight = sections.docInfos.reduce((sum, info) => sum + (heights.docInfos[info.key] || 0), 0);
  return sections.rows.flatMap((row, index) => {
    if (row.hasAttribute("data-pf-columns")) {
      columnFlowChildren(row);
      return [row]; // Its first fragment depends on the actual current-page remainder.
    }
    // Totals/subtotal combinations retain their atomic business semantics.
    if (formatter.isSubtotalRow(row) || formatter.isFooterRow(row)) return [row];
    const tableId = formatter.getRowTableId(row);
    const rowHeaderHeight = formatter.shouldSkipRowHeaderForRow(row) || !formatter.getSectionRowHeader(sections, tableId)
      ? 0 : (heights.rowHeaders?.[tableId] ?? heights.rowHeader ?? 0);
    // An indivisible group inside splittable notes needs the continuation
    // window too; the surrounding prose still uses ordinary Range splitting.
    const atomic = isKeepTogetherContent(row, true);
    const headerReservation = atomic && !formatter.config.repeatHeader ? 0 : headerHeight;
    const docInfoReservation = atomic ? sections.docInfos.reduce((sum, info) =>
      sum + (formatter.config[info.repeatFlag] ? heights.docInfos[info.key] || 0 : 0), 0) : docInfoHeight;
    const height = formatter.config.papersizeHeight - headerReservation - docInfoReservation - rowHeaderHeight - footerState.repeating;
    const fragments = fragmentMeasuredRow(row, {
      height, width: formatter.config.papersizeWidth, sourceId: `pf-${documentId}-${index}`,
      maxWords: formatter.isPaddtRow(row) ? formatter.paddtConfig.paddtMaxWordsPerSegment
        : formatter.isPtacRow(row) ? DEFAULT_READABILITY_WORD_LIMIT : Infinity
    });
    if (fragments.length > 1 || fragments[0] !== row) row.replaceWith(...fragments);
    return fragments;
  });
}
