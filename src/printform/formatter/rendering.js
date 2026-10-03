/* eslint-disable no-console */

import { updatePageNumberContent, updatePhysicalPageNumberContent } from "../helpers.js";
import { FOOTER_LOGO_VARIANT, FOOTER_PAGENUM_VARIANT } from "../config.js";
import { DomHelpers } from "../dom.js";
import { appendPageChromeOnce } from "./page-chrome.js";
import { attachRowHeaderPolicyMethods } from "./row-header-policy.js";

export function attachRenderingMethods(FormatterClass) {
  if (!FormatterClass.prototype.getSectionRowHeader) attachRowHeaderPolicyMethods(FormatterClass);

  FormatterClass.prototype.ensureFirstPageSections = function ensureFirstPageSections(container, sections, heights, logFn, skipRowHeader, tableId = "default") {
    let consumedHeight = 0;
    if (sections.header) {
      const clone = appendPageChromeOnce(container, sections.header, logFn, "pheader");
      if (clone && !this.config.repeatHeader) {
        consumedHeight += heights.header;
      }
    }
    sections.docInfos.forEach((docInfo) => {
      const clone = appendPageChromeOnce(container, docInfo.element, logFn, docInfo.className);
      this.registerPageNumberClone(clone);
      if (clone && !this.config[docInfo.repeatFlag]) {
        consumedHeight += heights.docInfos[docInfo.key] || 0;
      }
    });
    const rowHeader = this.getSectionRowHeader(sections, tableId);
    if (rowHeader && !skipRowHeader) {
      const clone = appendPageChromeOnce(container, rowHeader, logFn, "prowheader");
      if (clone && !this.isRowHeaderRepeated(sections, tableId)) {
        consumedHeight += heights.rowHeaders?.[tableId] ?? heights.rowHeader ?? 0;
      }
    }
    return consumedHeight;
  };

  FormatterClass.prototype.appendRepeatingSections = function appendRepeatingSections(container, sections, logFn, skipRowHeader, tableId = "default") {
    if (this.config.repeatHeader) {
      appendPageChromeOnce(container, sections.header, logFn, "pheader");
    }
    sections.docInfos.forEach((docInfo) => {
      if (this.config[docInfo.repeatFlag]) {
        const clone = appendPageChromeOnce(container, docInfo.element, logFn, docInfo.className);
        this.registerPageNumberClone(clone);
      }
    });
    const rowHeader = this.getSectionRowHeader(sections, tableId);
    if (this.isRowHeaderRepeated(sections, tableId) && rowHeader && !skipRowHeader) {
      appendPageChromeOnce(container, rowHeader, logFn, "prowheader");
    }
  };

  FormatterClass.prototype.ensureActiveTableHeader = function ensureActiveTableHeader(container, sections, logFn, tableId) {
    if (!this.isRowHeaderRepeated(sections, tableId)) return null;
    const rowHeader = this.getSectionRowHeader(sections, tableId);
    if (!rowHeader) return null;
    const hasHeader = Array.from(container.querySelectorAll(".prowheader_processed")).some(
      (node) => this.getRowTableId(node) === tableId,
    );
    if (hasHeader) return null;
    return appendPageChromeOnce(container, rowHeader, logFn, "prowheader");
  };

  FormatterClass.prototype.registerPageNumberClone = function registerPageNumberClone(node) {
    if (!node) {
      return false;
    }
    let registered = false;

    if (this.showLogicalPageNumber) {
      if (node.querySelector("[data-page-number], [data-page-total], [data-page-number-container]")) {
        updatePageNumberContent(node, this.currentPage, null);
        this.logicalPageNumberClones.push({ node, pageNumber: this.currentPage });
        registered = true;
      }
    }

    if (this.showPhysicalPageNumber) {
      if (node.querySelector("[data-physical-page-number], [data-physical-page-total], [data-physical-page-number-container]")) {
        const physicalPage = this.logicalPageToPhysicalPage[this.currentPage] || this.currentPhysicalPage || 1;
        updatePhysicalPageNumberContent(node, physicalPage, null);
        this.physicalPageNumberClones.push({ node, pageNumber: physicalPage });
        registered = true;
      }
    }

    return registered;
  };

  FormatterClass.prototype.appendRepeatingFooters = function appendRepeatingFooters(container, sections, logFn) {
    sections.footerVariants.forEach((footer) => {
      if (this.config[footer.repeatFlag]) {
        DomHelpers.appendClone(container, footer.element, logFn, footer.className);
      }
    });
    if (this.config.repeatFooterLogo) {
      DomHelpers.appendClone(container, sections.footerLogo, logFn, FOOTER_LOGO_VARIANT.className);
    }
    if (this.config.repeatFooterPagenum) {
      this.appendFooterPageNumber(container, sections, logFn);
    }
  };

  FormatterClass.prototype.appendFinalFooters = function appendFinalFooters(container, sections, logFn) {
    sections.footerVariants.forEach((footer) => {
      DomHelpers.appendClone(container, footer.element, logFn, footer.className);
    });
    DomHelpers.appendClone(container, sections.footerLogo, logFn, FOOTER_LOGO_VARIANT.className);
    this.appendFooterPageNumber(container, sections, logFn);
  };

  FormatterClass.prototype.appendFooterPageNumber = function appendFooterPageNumber(container, sections, logFn) {
    if (!sections.footerPagenum) {
      return;
    }
    const clone = sections.footerPagenum.cloneNode(true);
    container.appendChild(clone);
    this.registerPageNumberClone(clone);
    if (logFn) {
      logFn(`append ${FOOTER_PAGENUM_VARIANT.className} page ${this.currentPage}`);
    }
  };

  FormatterClass.prototype.updatePageNumberTotals = function updatePageNumberTotals() {
    if (!this.logicalPageNumberClones.length && !this.physicalPageNumberClones.length) {
      return;
    }
    const totalLogicalPages = this.currentPage;
    const totalPhysicalPages = this.currentPhysicalPage || 1;
    this.logicalPageNumberClones.forEach((entry) => {
      updatePageNumberContent(entry.node, entry.pageNumber, totalLogicalPages);
    });
    this.physicalPageNumberClones.forEach((entry) => {
      updatePhysicalPageNumberContent(entry.node, entry.pageNumber, totalPhysicalPages);
    });
  };
}

