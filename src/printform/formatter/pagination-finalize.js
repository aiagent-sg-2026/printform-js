/* eslint-disable no-console */

import { attachRowHeaderPolicyMethods } from "./row-header-policy.js";
import { fitsWithinHeight } from "./pagination-fit.js";
import { DomHelpers } from "../dom.js";

export function attachPaginationFinalizeMethods(FormatterClass) {
  if (!FormatterClass.prototype.maxRepeatingRowHeaderHeight) attachRowHeaderPolicyMethods(FormatterClass);

  FormatterClass.prototype.computeHeightPerPage = function computeHeightPerPage(sections, heights) {
    let available = this.config.papersizeHeight;
    if (this.debug) {
      console.log(`[printform] ===== computeHeightPerPage =====`);
      console.log(`[printform] papersizeHeight (config): ${this.config.papersizeHeight}px`);
      console.log(`[printform] papersizeWidth (config): ${this.config.papersizeWidth}px`);
    }
    if (this.config.repeatHeader && sections.header) {
      if (this.debug) {
        console.log(`[printform]   - repeatHeader: ${heights.header}px`);
      }
      available -= heights.header;
    }
    sections.docInfos.forEach((docInfo) => {
      if (this.config[docInfo.repeatFlag]) {
        const h = heights.docInfos[docInfo.key] || 0;
        if (this.debug) {
          console.log(`[printform]   - repeat ${docInfo.className}: ${h}px`);
        }
        available -= h;
      }
    });
    const maxRowHeaderHeight = this.maxRepeatingRowHeaderHeight(sections, heights);
    if (maxRowHeaderHeight > 0) {
      if (this.debug) {
        console.log(`[printform]   - repeatRowheader (max active table): ${maxRowHeaderHeight}px`);
      }
      available -= maxRowHeaderHeight;
    }
    sections.footerVariants.forEach((footer) => {
      if (this.config[footer.repeatFlag]) {
        const h = heights.footerVariants[footer.key] || 0;
        if (this.debug) {
          console.log(`[printform]   - repeat ${footer.className}: ${h}px`);
        }
        available -= h;
      }
    });
    if (this.config.repeatFooterLogo && sections.footerLogo) {
      if (this.debug) {
        console.log(`[printform]   - repeatFooterLogo: ${heights.footerLogo}px`);
      }
      available -= heights.footerLogo;
    }
    if (this.config.repeatFooterPagenum && sections.footerPagenum) {
      const h = heights.footerPagenum || 0;
      if (this.debug) {
        console.log(`[printform]   - repeatFooterPagenum: ${h}px`);
      }
      available -= h;
    }
    if (this.debug) {
      console.log(`[printform] heightPerPage (available for content): ${Math.max(0, available)}px`);
      console.log(`[printform] ================================`);
    }
    return Math.max(0, available);
  };

  FormatterClass.prototype.computeFooterState = function computeFooterState(sections, heights) {
    const footerLogoHeight = heights.footerLogo || 0;
    const footerPagenumHeight = heights.footerPagenum || 0;
    const totalFooterHeight = sections.footerVariants.reduce((sum, footer) => {
      const height = heights.footerVariants[footer.key] || 0;
      return sum + height;
    }, 0);
    const totalFinal = totalFooterHeight + footerLogoHeight + footerPagenumHeight;
    const repeatingFooterHeight = sections.footerVariants.reduce((sum, footer) => {
      const height = heights.footerVariants[footer.key] || 0;
      return this.config[footer.repeatFlag] ? sum + height : sum;
    }, 0);
    let repeating = repeatingFooterHeight;
    if (this.config.repeatFooterLogo) {
      repeating += footerLogoHeight;
    }
    if (this.config.repeatFooterPagenum) {
      repeating += footerPagenumHeight;
    }
    const nonRepeating = Math.max(0, totalFinal - repeating);
    return {
      totalFinal,
      repeating,
      nonRepeating
    };
  };

  FormatterClass.prototype.finalizeDocument = function finalizeDocument(
    outputContainer,
    sections,
    heights,
    footerState,
    defaultHeightPerPage,
    renderState,
    spacerTemplate,
    logFn
  ) {
    const baseHeight = renderState ? renderState.currentHeight : 0;
    const lastPageLimit = renderState && renderState.pageLimit
      ? renderState.pageLimit
      : defaultHeightPerPage;
    const repeatingHeight = renderState && Number.isFinite(renderState.repeatingHeight)
      ? renderState.repeatingHeight
      : 0;
    const skipDummyRowItems = Boolean(
      renderState &&
      (
        (renderState.isPtacPage && !this.config.insertPtacDummyRowItems) ||
        (renderState.isPaddtPage && !(this.paddtConfig && this.paddtConfig.insertPaddtDummyRowItems))
      )
    );
    const container = this.getCurrentPageContainer(outputContainer);
    const previousEnd = container.lastChild;
    const logicalCount = this.logicalPageNumberClones.length;
    const physicalCount = this.physicalPageNumberClones.length;
    // Source heights and the arithmetic row fast path are reservations, not a
    // verdict. Decide using final footer clones at the actual output width.
    this.appendFinalFooters(container, sections, logFn);
    this.updatePageNumberTotals();
    const heightWithFinalFooters = DomHelpers.measureHeightRaw(container);
    if (fitsWithinHeight(heightWithFinalFooters, this.config.papersizeHeight)) {
      this.applyRemainderSpacing(
        container,
        this.config.papersizeHeight,
        heightWithFinalFooters,
        footerState,
        spacerTemplate,
        {
          skipDummyRowItems,
          repeatingHeight,
          useCurrentHeight: true
        }
      );
      return;
    }
    while (container.lastChild !== previousEnd) container.lastChild.remove();
    this.logicalPageNumberClones.length = logicalCount;
    this.physicalPageNumberClones.length = physicalCount;

    this.prepareNextPage(
      outputContainer,
      sections,
      logFn,
      lastPageLimit,
      baseHeight,
      footerState,
      spacerTemplate,
      true,
      skipDummyRowItems,
      repeatingHeight,
      "default"
    );

    const nextContainer = this.getCurrentPageContainer(outputContainer);
    this.appendFinalFooters(nextContainer, sections, logFn);
    this.updatePageNumberTotals();
    const nextRepeatingHeight = this.computeRepeatingHeightForPage(sections, heights, true, "default");
    this.applyRemainderSpacing(
      nextContainer,
      this.config.papersizeHeight,
      DomHelpers.measureHeightRaw(nextContainer),
      footerState,
      spacerTemplate,
      {
        repeatingHeight: nextRepeatingHeight,
        useCurrentHeight: true
      }
    );
  };
}
