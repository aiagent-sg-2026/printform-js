/* eslint-disable no-console */

import { normalizeHeight } from "../helpers.js";
import { DomHelpers } from "../dom.js";

export function attachPaginationContextMethods(FormatterClass) {
  FormatterClass.prototype.initializePageContext = function initializePageContext(heightPerPage) {
    return {
      baseLimit: heightPerPage,
      limit: heightPerPage,
      skipRowHeader: false,
      tableId: "default",
      rowHeaderHeight: 0,
      isPtacPage: false,
      isPaddtPage: false,
      repeatingHeight: 0
    };
  };

  FormatterClass.prototype.refreshPageContextForRow = function refreshPageContextForRow(pageContext, row, heights, sections) {
    if (!pageContext) {
      return pageContext;
    }
    const skipRowHeader = this.shouldSkipRowHeaderForRow(row);
    const tableId = this.getRowTableId(row);
    const rowHeaderHeight = this.getSectionRowHeader(sections, tableId)
      ? (heights.rowHeaders?.[tableId] ?? heights.rowHeader ?? 0) : 0;
    pageContext.skipRowHeader = skipRowHeader;
    pageContext.tableId = tableId;
    pageContext.rowHeaderHeight = rowHeaderHeight;
    pageContext.isPtacPage = this.isPtacRow(row);
    pageContext.isPaddtPage = this.isPaddtRow(row);
    const reservedHeader = this.maxRepeatingRowHeaderHeight(sections, heights);
    const activeRepeatedHeader = !skipRowHeader && this.isRowHeaderRepeated(sections, tableId) ? rowHeaderHeight : 0;
    pageContext.limit = pageContext.baseLimit + reservedHeader - activeRepeatedHeader;
    return pageContext;
  };

  FormatterClass.prototype.computeRepeatingHeightForPage = function computeRepeatingHeightForPage(sections, heights, skipRowHeader, tableId = "default") {
    let total = 0;
    if (this.config.repeatHeader && sections.header) {
      total += heights.header || 0;
    }
    sections.docInfos.forEach((docInfo) => {
      if (this.config[docInfo.repeatFlag]) {
        total += heights.docInfos[docInfo.key] || 0;
      }
    });
    const rowHeader = this.getSectionRowHeader(sections, tableId);
    if (this.isRowHeaderRepeated(sections, tableId) && rowHeader && !skipRowHeader) {
      total += heights.rowHeaders?.[tableId] ?? heights.rowHeader ?? 0;
    }
    return normalizeHeight(total);
  };

  FormatterClass.prototype.measureContentHeight = function measureContentHeight(container, repeatingHeight) {
    // Use the "raw" measurement here. `measureHeight()` may temporarily mutate styles
    // when it sees a 0 height (for hidden nodes). That behavior can destabilize layout
    // on mobile Safari/Chrome during tight pagination loops, causing 0-height reads and
    // repeated section appends.
    const total = DomHelpers.measureHeightRaw(container);
    return Math.max(0, total - (repeatingHeight || 0));
  };
}
