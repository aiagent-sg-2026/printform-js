/* eslint-disable no-console */

import { FOOTER_LOGO_VARIANT, FOOTER_PAGENUM_VARIANT, FOOTER_VARIANTS } from "../config.js";
import { DomHelpers } from "../dom.js";

function buildDummySpacer(config, remaining, debug) {
  if (config.customDummySpacerContent) {
    const template = document.createElement("template");
    template.innerHTML = config.customDummySpacerContent.trim();
    const elements = Array.from(template.content.childNodes)
      .filter((node) => node.nodeType === Node.ELEMENT_NODE);
    if (elements.length === 1) {
      const spacer = elements[0];
      spacer.classList.add("dummy_spacer");
      spacer.setAttribute("aria-hidden", "true");
      if (spacer.tagName !== "TABLE") {
        spacer.style.display = "block";
      }
      spacer.style.width = "100%";
      spacer.style.height = `${remaining}px`;
      spacer.style.margin = "0";
      spacer.style.padding = "0";
      return spacer;
    }
    if (debug) {
      console.log("[printform] customDummySpacerContent ignored: template must have exactly 1 root element.");
    }
  }
  const spacer = document.createElement("div");
  spacer.classList.add("dummy_spacer");
  spacer.setAttribute("aria-hidden", "true");
  if (spacer.tagName !== "TABLE") {
    spacer.style.display = "block";
  }
  spacer.style.width = "100%";
  spacer.style.height = `${remaining}px`;
  spacer.style.margin = "0";
  spacer.style.padding = "0";
  return spacer;
}

export function attachPageMethods(FormatterClass) {
  FormatterClass.prototype.initializeOutputContainer = function initializeOutputContainer() {
    const container = this.formEl.cloneNode(false);
    container.classList.remove("printform");
    container.classList.add("printform_formatter");
    // iOS/Android (WebKit) may auto-adjust text sizes, which breaks fixed-height pagination.
    // Keep it scoped to the formatter output to avoid unexpected global side effects.
    container.style.webkitTextSizeAdjust = "100%";
    container.style.textSizeAdjust = "100%";
    this.formEl.parentNode.insertBefore(container, this.formEl);
    return container;
  };

  FormatterClass.prototype.initializePhysicalWrapper = function initializePhysicalWrapper(outputContainer) {
    if (this.currentPhysicalWrapper) {
      outputContainer.appendChild(DomHelpers.createPageBreakDivider());
      this.currentPhysicalPage += 1;
    } else {
      this.currentPhysicalPage = 1;
    }

    const wrapper = document.createElement("div");
    wrapper.classList.add("physical_page_wrapper");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "flex-start";
    wrapper.style.width = `${this.config.papersizeWidth}px`;
    outputContainer.appendChild(wrapper);
    this.currentPhysicalWrapper = wrapper;
    this.pagesInCurrentPhysical = 0;
    return wrapper;
  };

  FormatterClass.prototype.ensureCurrentPageContainer = function ensureCurrentPageContainer(outputContainer) {
    if (!this.currentPhysicalWrapper) {
      this.initializePhysicalWrapper(outputContainer);
    }
    if (!this.currentPageContainer) {
      this.createNewLogicalPage(outputContainer);
    }
    return this.currentPageContainer;
  };

  FormatterClass.prototype.createNewLogicalPage = function createNewLogicalPage(outputContainer) {
    if (!this.currentPhysicalWrapper || this.pagesInCurrentPhysical >= this.nUp) {
      this.initializePhysicalWrapper(outputContainer);
    }

    const page = document.createElement("div");
    page.classList.add("printform_page");
    page.style.width = `${this.config.papersizeWidth}px`;
    // Preview gaps are not logical content; leave nUp=1 host geometry untouched.
    if (this.nUp > 1) page.style.setProperty("margin", "0", "important");
    // Note: min-height removed - height will be calculated precisely by JavaScript
    this.currentPhysicalWrapper.appendChild(page);
    this.currentPageContainer = page;
    this.pagesInCurrentPhysical += 1;
    this.logicalPageToPhysicalPage[this.currentPage] = this.currentPhysicalPage;
    return page;
  };

  FormatterClass.prototype.getCurrentPageContainer = function getCurrentPageContainer(outputContainer) {
    return this.ensureCurrentPageContainer(outputContainer);
  };

  /**
   * Finalize the height of a page by calculating its actual content height
   * and setting it precisely instead of relying on min-height.
   * This ensures accurate page dimensions for printing.
   */
  FormatterClass.prototype.finalizePageHeight = function finalizePageHeight(pageContainer) {
    if (!pageContainer) return;

    const configuredHeight = this.config.papersizeHeight;
    const fillPageHeightAfterFooter = this.config.fillPageHeightAfterFooter !== false;
    let appendedSpacerHeight = 0;
    const formatPx = (value) => {
      if (!Number.isFinite(value)) return "0";
      return String(Math.round(value * 100) / 100);
    };

    if (fillPageHeightAfterFooter) {
      const currentHeight = DomHelpers.measureHeightRaw(pageContainer);
      const remaining = Math.max(0, configuredHeight - currentHeight);
      if (remaining > 0.01) {
        const spacer = buildDummySpacer(this.config, remaining, this.debug);
        const footerSelectors = FOOTER_VARIANTS
          .map((variant) => `.${variant.className}_processed`)
          .concat([
            `.${FOOTER_LOGO_VARIANT.className}_processed`,
            `.${FOOTER_PAGENUM_VARIANT.className}_processed`
          ]);
        const firstFooter = pageContainer.querySelector(footerSelectors.join(", "));
        if (firstFooter && firstFooter.parentNode === pageContainer) {
          pageContainer.insertBefore(spacer, firstFooter);
        } else {
          pageContainer.appendChild(spacer);
        }
        appendedSpacerHeight = remaining;
      }
    }
    const actualHeight = DomHelpers.measureHeightRaw(pageContainer);
    if (actualHeight > configuredHeight + 0.01) {
      throw new RangeError(`Printform logical page exceeds configured height (${actualHeight}px > ${configuredHeight}px); unsplittable content or chrome does not fit`);
    }

    if (this.debug) {
      console.log(`\n[printform] ========== PAGE HEIGHT CALCULATION ==========`);
      console.log(`[printform] Configured page height: ${configuredHeight}px`);
      console.log(`[printform] -------------------------------------------`);

      // Show each child element's height with chain reasoning
      const children = Array.from(pageContainer.children);
      let cumulativeHeight = 0;

      console.log(`[printform] Elements breakdown (${children.length} elements):`);
      children.forEach((child, index) => {
        const childHeight = DomHelpers.measureHeightRaw(child);
        cumulativeHeight += childHeight;
        const className = child.className || '(no class)';
        const tagName = child.tagName.toLowerCase();

        console.log(`[printform]   ${index + 1}. <${tagName}.${className}>`);
        console.log(`[printform]      Height: ${formatPx(childHeight)}px`);
        console.log(`[printform]      Cumulative: ${formatPx(cumulativeHeight)}px`);
        console.log(`[printform]      Remaining: ${formatPx(Math.max(0, configuredHeight - cumulativeHeight))}px`);

        // Show warning if element is unexpectedly tall
        if (childHeight > configuredHeight * 0.5) {
          console.log(`[printform]      ⚠️  WARNING: Element height is > 50% of page height`);
        }
      });

      console.log(`[printform] -------------------------------------------`);
      console.log(`[printform] Total content height: ${formatPx(cumulativeHeight)}px`);

      if (cumulativeHeight < configuredHeight) {
        const shortfall = configuredHeight - cumulativeHeight;
        console.log(`[printform] ✓ Content fits (${formatPx(shortfall)}px under limit)`);
      } else if (cumulativeHeight > configuredHeight) {
        const overflow = cumulativeHeight - configuredHeight;
        console.log(`[printform] ⚠️  Content overflow (${formatPx(overflow)}px over limit)`);
      } else {
        console.log(`[printform] ✓ Perfect fit (exactly matches configured height)`);
      }
      if (appendedSpacerHeight > 0) {
        console.log(`[printform] ✓ Final spacer appended: ${formatPx(appendedSpacerHeight)}px`);
      }
    }

    // Note: We do NOT set height here - let the content determine natural height
    // pageContainer.style.height is intentionally not set

    if (this.debug) {
      const actualHeight = DomHelpers.measureHeightRaw(pageContainer);
      console.log(`[printform] -------------------------------------------`);
      console.log(`[printform] Actual measured height: ${formatPx(actualHeight)}px`);
      console.log(`[printform] ℹ️  Height NOT set - using natural content height`);
      console.log(`[printform] ===============================================\n`);
    }
  };
}
