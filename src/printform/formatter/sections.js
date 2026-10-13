/* eslint-disable no-console */

import { DOCINFO_VARIANTS, FOOTER_VARIANTS, FOOTER_LOGO_VARIANT, FOOTER_PAGENUM_VARIANT } from "../config.js";
import { DomHelpers } from "../dom.js";
import { ROW_SELECTOR } from "../text.js";

export function attachSectionMethods(FormatterClass) {
  FormatterClass.prototype.collectSections = function collectSections() {
    // paddt 段落扩展先执行，确保 .paddt 转换为 .paddt-rowitem (中文解释: 先展开 paddt)
    this.expandPaddtSegments();
    this.expandPtacSegments();
    const docInfos = DOCINFO_VARIANTS.map((variant) => {
      const element = this.formEl.querySelector(`.${variant.className}`);
      if (!element) return null;
      return {
        key: variant.key,
        className: variant.className,
        repeatFlag: variant.repeatFlag,
        element
      };
    }).filter(Boolean);

    const footerVariants = FOOTER_VARIANTS.map((variant) => {
      const element = this.formEl.querySelector(`.${variant.className}`);
      if (!element) return null;
      return {
        key: variant.key,
        className: variant.className,
        repeatFlag: variant.repeatFlag,
        element
      };
    }).filter(Boolean);

    // 分离 paddt 行，主流程不渲染 paddt（paddt 将在页脚之后另起分页渲染）
    const allRows = Array.from(this.formEl.querySelectorAll(ROW_SELECTOR));
    const paddtRows = allRows.filter((row) => this.isPaddtRow(row));
    const mainRows = allRows.filter((row) => !this.isPaddtRow(row));
    const rowHeaders = Array.from(this.formEl.querySelectorAll(".prowheader"));
    const rowHeadersById = Object.create(null);
    rowHeaders.forEach((header) => {
      const tableId = this.getRowTableId(header);
      if (!rowHeadersById[tableId]) rowHeadersById[tableId] = header;
    });
    this.paddtRows = paddtRows;

    return {
      header: this.formEl.querySelector(".pheader"),
      docInfos,
      rowHeader: rowHeaders[0] || null,
      rowHeaders,
      rowHeadersById,
      footerVariants,
      footerLogo: this.formEl.querySelector(`.${FOOTER_LOGO_VARIANT.className}`),
      footerPagenum: this.formEl.querySelector(`.${FOOTER_PAGENUM_VARIANT.className}`),
      rows: mainRows
    };
  };

  FormatterClass.prototype.measureSections = function measureSections(sections) {
    const heights = {
      header: DomHelpers.measureHeight(sections.header),
      docInfos: {},
      rowHeader: DomHelpers.measureHeight(sections.rowHeader),
      rowHeaders: Object.assign(Object.create(null), Object.fromEntries(
        Object.entries(sections.rowHeadersById).map(([tableId, header]) => [tableId, DomHelpers.measureHeight(header)])
      )),
      footerVariants: {},
      footerLogo: DomHelpers.measureHeight(sections.footerLogo),
      footerPagenum: DomHelpers.measureHeight(sections.footerPagenum)
    };
    sections.docInfos.forEach((docInfo) => {
      heights.docInfos[docInfo.key] = DomHelpers.measureHeight(docInfo.element);
    });
    sections.footerVariants.forEach((footer) => {
      heights.footerVariants[footer.key] = DomHelpers.measureHeight(footer.element);
    });
    return heights;
  };

  FormatterClass.prototype.markSectionsProcessed = function markSectionsProcessed(sections) {
    DomHelpers.markAsProcessed(sections.header, "pheader");
    sections.docInfos.forEach((docInfo) => {
      DomHelpers.markAsProcessed(docInfo.element, docInfo.className);
    });
    (sections.rowHeaders || [sections.rowHeader]).forEach((header) => DomHelpers.markAsProcessed(header, "prowheader"));
    sections.footerVariants.forEach((footer) => {
      DomHelpers.markAsProcessed(footer.element, footer.className);
    });
    DomHelpers.markAsProcessed(sections.footerLogo, FOOTER_LOGO_VARIANT.className);
    DomHelpers.markAsProcessed(sections.footerPagenum, FOOTER_PAGENUM_VARIANT.className);
  };

  FormatterClass.prototype.createFooterSpacerTemplate = function createFooterSpacerTemplate() {
    const spacer = document.createElement("div");
    spacer.classList.add("pfooter_spacer", "paper_width");
    spacer.style.height = "0px";
    return spacer;
  };
}

