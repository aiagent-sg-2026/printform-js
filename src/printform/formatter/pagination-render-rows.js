/* eslint-disable no-console */

import { DomHelpers } from "../dom.js";
import { renderSpecialRow } from "./pagination-render-special.js";

const ROW_HEIGHT_PREDICTION_SAFETY_MARGIN_PX = 50;

export function renderRows(outputContainer, sections, heights, footerState, heightPerPage, footerSpacerTemplate, logFn) {
  let currentHeight = 0;
  let firstPageInitialized = false;
  const pageContext = this.initializePageContext(heightPerPage);
  if (this.debug) {
    console.log(`[printform] ===== renderRows START =====`);
    console.log(`[printform] Total rows: ${sections.rows.length}, heightPerPage: ${heightPerPage}px`);
  }

  // Read all standalone row heights before the loop starts. Reads interleaved
  // with appends force layout recalculation and defeat the arithmetic fast path.
  const rowHeightCache = sections.rows.map((row) => DomHelpers.measureHeight(row));

  for (let index = 0; index < sections.rows.length; index++) {
    const row = sections.rows[index];
    const nextRow = sections.rows[index + 1];
    const rowHeight = rowHeightCache[index];
    const baseClass = this.getRowBaseClass(row);
    const isPtacRow = this.isPtacRow(row);
    const isPaddtRow = this.isPaddtRow(row);
    const isSubtotal = this.isSubtotalRow(row);
    const isFooter = this.isFooterRow(row);
    const hasFooterCombo = isSubtotal && nextRow && this.isFooterRow(nextRow);
    const footerRow = hasFooterCombo ? nextRow : null;
    const footerBaseClass = footerRow ? this.getRowBaseClass(footerRow) : null;
    const footerHeight = footerRow ? rowHeightCache[index + 1] : 0;
    const comboHeight = rowHeight + footerHeight;

    if (!rowHeight && (!hasFooterCombo || !footerHeight)) {
      DomHelpers.markAsProcessed(row, baseClass);
      if (hasFooterCombo) {
        DomHelpers.markAsProcessed(footerRow, footerBaseClass);
        index += 1;
      }
      continue;
    }

    // Body height may clamp to zero after chrome subtraction. It is not
    // lifecycle state: continuation pages already receive chrome in prepareNextPage.
    if (!firstPageInitialized) {
      firstPageInitialized = true;
      this.refreshPageContextForRow(pageContext, row, heights, sections);
      const container = this.getCurrentPageContainer(outputContainer);
      this.ensureFirstPageSections(container, sections, heights, logFn, pageContext.skipRowHeader, pageContext.tableId);
      pageContext.repeatingHeight = this.computeRepeatingHeightForPage(
        sections, heights, pageContext.skipRowHeader, pageContext.tableId
      );
      currentHeight = this.measureContentHeight(container, pageContext.repeatingHeight);
      if (this.debug) {
        console.log(`[printform] Page ${this.currentPage} start: firstSectionHeight=${currentHeight}px, pageLimit=${pageContext.limit}px`);
      }
    }

    const activeTableId = this.getRowTableId(row);
    const activeHeader = this.ensureActiveTableHeader(
      this.getCurrentPageContainer(outputContainer), sections, logFn, activeTableId
    );
    if (activeHeader) {
      const activeContainer = this.getCurrentPageContainer(outputContainer);
      currentHeight = this.measureContentHeight(activeContainer, pageContext.repeatingHeight);
      const hasPriorRows = activeContainer.querySelector(".prowitem_processed, .ptac-rowitem_processed, .paddt-rowitem_processed");
      if (currentHeight > pageContext.limit && hasPriorRows) {
        activeContainer.removeChild(activeHeader);
        currentHeight = this.prepareNextPage(
          outputContainer, sections, logFn, pageContext.limit, currentHeight, footerState,
          footerSpacerTemplate, this.shouldSkipRowHeaderForRow(row),
          this.shouldSkipDummyRowItemsForContext(pageContext), pageContext.repeatingHeight, activeTableId
        );
        this.refreshPageContextForRow(pageContext, row, heights, sections);
        const nextContainer = this.getCurrentPageContainer(outputContainer);
        pageContext.repeatingHeight = this.computeRepeatingHeightForPage(
          sections, heights, pageContext.skipRowHeader, pageContext.tableId
        );
        currentHeight = this.measureContentHeight(nextContainer, pageContext.repeatingHeight);
      }
    }

    DomHelpers.markAsProcessed(row, baseClass);
    if (footerRow) DomHelpers.markAsProcessed(footerRow, footerBaseClass);

    if (hasFooterCombo || isSubtotal || isFooter) {
      const result = renderSpecialRow(this, {
        outputContainer, sections, heights, footerState, footerSpacerTemplate, logFn,
        pageContext, row, nextRow, index, rowHeight, footerHeight, comboHeight,
        currentHeight, hasFooterCombo, isPtacRow, isPaddtRow, baseClass, footerBaseClass
      });
      currentHeight = result.currentHeight;
      if (result.consumedNextRow) index += 1;
      continue;
    }

    if (row.classList.contains("tb_page_break_before")) {
      if (this.debug) console.log(`[printform]   >> PAGE BREAK (tb_page_break_before) at row[${index}]`);
      currentHeight = this.prepareNextPage(
        outputContainer, sections, logFn, pageContext.limit, currentHeight, footerState,
        footerSpacerTemplate, this.shouldSkipRowHeaderForRow(row),
        this.shouldSkipDummyRowItemsForContext(pageContext), pageContext.repeatingHeight,
        this.getRowTableId(row)
      );
      this.refreshPageContextForRow(pageContext, row, heights, sections);
      const container = this.getCurrentPageContainer(outputContainer);
      pageContext.repeatingHeight = this.computeRepeatingHeightForPage(
        sections, heights, pageContext.skipRowHeader, pageContext.tableId
      );
      currentHeight = this.measureContentHeight(container, pageContext.repeatingHeight);
      DomHelpers.appendRowItem(container, row, null, index, baseClass);
      if (logFn) logFn(`append ${baseClass || "prowitem"} ${index}`);
      currentHeight = this.measureContentHeight(container, pageContext.repeatingHeight);
      if (this.debug) console.log(`[printform] Page ${this.currentPage} start: currentHeight=${currentHeight}px, limit=${pageContext.limit}px`);
      if (!isPtacRow) pageContext.isPtacPage = false;
      if (!isPaddtRow) pageContext.isPaddtPage = false;
      continue;
    }

    const container = this.getCurrentPageContainer(outputContainer);
    const priorHeight = currentHeight;
    const predictedHeight = currentHeight + rowHeight;
    if (predictedHeight + ROW_HEIGHT_PREDICTION_SAFETY_MARGIN_PX <= pageContext.limit) {
      DomHelpers.appendRowItem(container, row, null, index, baseClass);
      if (this.debug) console.log(`[printform]   row[${index}] height=${rowHeight}px, predictedHeight=${predictedHeight}px, limit=${pageContext.limit}px (fast path, no reflow)`);
      if (logFn) logFn(`append ${baseClass || "prowitem"} ${index}`);
      currentHeight = predictedHeight;
      if (!isPtacRow) pageContext.isPtacPage = false;
      if (!isPaddtRow) pageContext.isPaddtPage = false;
      continue;
    }

    const clone = DomHelpers.appendRowItem(container, row, null, index, baseClass);
    const measuredHeight = this.measureContentHeight(container, pageContext.repeatingHeight);
    if (this.debug) console.log(`[printform]   row[${index}] height=${rowHeight}px, currentHeight=${measuredHeight}px, limit=${pageContext.limit}px`);
    if (measuredHeight <= pageContext.limit) {
      if (logFn) logFn(`append ${baseClass || "prowitem"} ${index}`);
      currentHeight = measuredHeight;
      if (!isPtacRow) pageContext.isPtacPage = false;
      if (!isPaddtRow) pageContext.isPaddtPage = false;
      continue;
    }

    if (clone && clone.parentNode === container) container.removeChild(clone);
    if (this.debug) console.log(`[printform]   >> PAGE BREAK (overflow) at row[${index}]`);
    currentHeight = this.prepareNextPage(
      outputContainer, sections, logFn, pageContext.limit, priorHeight, footerState,
      footerSpacerTemplate, this.shouldSkipRowHeaderForRow(row),
      this.shouldSkipDummyRowItemsForContext(pageContext), pageContext.repeatingHeight,
      this.getRowTableId(row)
    );
    this.refreshPageContextForRow(pageContext, row, heights, sections);
    const nextContainer = this.getCurrentPageContainer(outputContainer);
    pageContext.repeatingHeight = this.computeRepeatingHeightForPage(
      sections, heights, pageContext.skipRowHeader, pageContext.tableId
    );
    currentHeight = this.measureContentHeight(nextContainer, pageContext.repeatingHeight);
    DomHelpers.appendRowItem(nextContainer, row, null, index, baseClass);
    if (logFn) logFn(`append ${baseClass || "prowitem"} ${index}`);
    currentHeight = this.measureContentHeight(nextContainer, pageContext.repeatingHeight);
    if (this.debug) console.log(`[printform] Page ${this.currentPage} start: currentHeight=${currentHeight}px, limit=${pageContext.limit}px`);
    if (!isPtacRow) pageContext.isPtacPage = false;
    if (!isPaddtRow) pageContext.isPaddtPage = false;
  }

  if (this.debug) console.log(`[printform] ===== renderRows END (page ${this.currentPage}, finalHeight=${currentHeight}px) =====`);
  return {
    currentHeight,
    pageLimit: pageContext.limit,
    isPtacPage: pageContext.isPtacPage,
    isPaddtPage: pageContext.isPaddtPage,
    repeatingHeight: pageContext.repeatingHeight
  };
}

export function renderEmptyDocument(outputContainer, sections, heights, heightPerPage, logFn) {
  const container = this.getCurrentPageContainer(outputContainer);
  if (this.debug) console.log(`[printform] ===== renderEmptyDocument START =====`);
  this.ensureFirstPageSections(container, sections, heights, logFn, false);
  const repeatingHeight = this.computeRepeatingHeightForPage(sections, heights, false);
  const currentHeight = this.measureContentHeight(container, repeatingHeight);
  if (this.debug) {
    console.log(`[printform] Empty document currentHeight=${currentHeight}px, pageLimit=${heightPerPage}px`);
    console.log(`[printform] ===== renderEmptyDocument END =====`);
  }
  return { currentHeight, pageLimit: heightPerPage, isPtacPage: false, isPaddtPage: false, repeatingHeight };
}
