/* eslint-disable no-console */

import { DomHelpers, applyDummyRowItemsStep, applyDummyRowStep, applyFooterSpacerWithDummyStep, applyFooterSpacerStep } from "../dom.js";
import { shouldCarryOneTimeTableHeader } from "./row-header-policy.js";

export function attachPaginationSpacingMethods(FormatterClass) {
  FormatterClass.prototype.prepareNextPage = function prepareNextPage(
    outputContainer,
    sections,
    logFn,
    pageLimit,
    currentHeight,
    footerState,
    spacerTemplate,
    skipRowHeader,
    skipDummyRowItems,
    repeatingHeight,
    tableId = "default"
  ) {
    const container = this.getCurrentPageContainer(outputContainer);
    // Keep a nonrepeating table's first header with its first business row,
    // including explicit page breaks and rows that overflow after header insert.
    if (shouldCarryOneTimeTableHeader(this, container, sections, tableId)) {
      Array.from(container.querySelectorAll(".prowheader_processed"))
        .filter((header) => this.getRowTableId(header) === tableId)
        .forEach((header) => header.remove());
      this.seenTableHeaders?.delete(tableId);
    }
    const filledHeight = this.applyRemainderSpacing(
      container,
      pageLimit,
      currentHeight,
      footerState,
      spacerTemplate,
      {
        skipDummyRowItems,
        repeatingHeight
      }
    );
    this.appendRepeatingFooters(container, sections, logFn);
    this.currentPage += 1;
    this.currentPageContainer = null;
    this.createNewLogicalPage(outputContainer);
    const nextContainer = this.getCurrentPageContainer(outputContainer);
    this.appendRepeatingSections(nextContainer, sections, logFn, skipRowHeader, tableId);
    this.ensureActiveTableHeader(nextContainer, sections, logFn, tableId, skipRowHeader);
    return filledHeight;
  };

  FormatterClass.prototype.applyRemainderSpacing = function applyRemainderSpacing(container, heightPerPage, currentHeight, footerState, spacerTemplate, options) {
    // Footer text and page totals can wrap at output width. Cosmetic filler must
    // not consume a source-measured reservation before that real layout exists.
    this.pendingRemainderSpacing ||= new Map();
    this.pendingRemainderSpacing.set(container, { spacerTemplate, skipDummyRowItems: Boolean(options?.skipDummyRowItems) });
    return currentHeight;
  };

  FormatterClass.prototype.applyDeferredRemainderSpacing = function applyDeferredRemainderSpacing() {
    for (const [container, { spacerTemplate, skipDummyRowItems }] of this.pendingRemainderSpacing || []) {
      const limit = this.config.papersizeHeight;
      const before = Array.from(container.children).find(node =>
        /(?:^|\s)pfooter(?:00[2-5]|_logo|_pagenum)?_processed(?:\s|$)/.test(node.className));
      let currentHeight = DomHelpers.measureHeightRaw(container);
      if (!skipDummyRowItems) {
        applyDummyRowItemsStep(this.config, container, limit, currentHeight, this.debug, before || null);
      }
      currentHeight = DomHelpers.measureHeightRaw(container);
      applyDummyRowStep(this.config, container, limit, currentHeight, this.debug, before || null);
      currentHeight = DomHelpers.measureHeightRaw(container);
      const state = applyFooterSpacerWithDummyStep(
        this.config, container, limit, currentHeight, skipDummyRowItems, this.debug, before || null
      );
      if (!state.skipFooterSpacer) {
        applyFooterSpacerStep(
          this.config, container, limit, DomHelpers.measureHeightRaw(container),
          { nonRepeating: 0 }, spacerTemplate, this.debug, before || null
        );
      }
    }
    this.pendingRemainderSpacing?.clear();
  };
}
