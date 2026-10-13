/* eslint-disable no-console */

export function attachRowTypeMethods(FormatterClass) {
  FormatterClass.prototype.isPaddtRow = function isPaddtRow(row) {
    if (!row) {
      return false;
    }
    return (
      row.classList.contains("paddt_segment") ||
      row.classList.contains("paddt") ||
      row.classList.contains("paddt-rowitem") ||
      row.classList.contains("paddt-rowitem_processed")
    );
  };

  FormatterClass.prototype.isPtacRow = function isPtacRow(row) {
    if (!row) {
      return false;
    }
    return (
      row.classList.contains("ptac_segment") ||
      row.classList.contains("ptac") ||
      row.classList.contains("ptac-rowitem") ||
      row.classList.contains("ptac-rowitem_processed")
    );
  };

  FormatterClass.prototype.isSubtotalRow = function isSubtotalRow(row) {
    if (!row) {
      return false;
    }
    return row.classList.contains("prowitem_subtotal");
  };

  FormatterClass.prototype.isFooterRow = function isFooterRow(row) {
    if (!row) {
      return false;
    }
    return row.classList.contains("prowitem_footer");
  };

  FormatterClass.prototype.getRowBaseClass = function getRowBaseClass(row) {
    if (!row) {
      return "prowitem";
    }
    if (this.isPaddtRow(row)) return "paddt-rowitem";
    return this.isPtacRow(row) ? "ptac-rowitem" : "prowitem";
  };

  FormatterClass.prototype.getRowTableId = function getRowTableId(row) {
    return row?.getAttribute?.("data-pf-table-id") || row?.getAttribute?.("data-pf-table") || "default";
  };

  FormatterClass.prototype.shouldSkipRowHeaderForRow = function shouldSkipRowHeaderForRow(row) {
    if (!row) {
      return false;
    }

    // prowitem: allow per-page opt-out via row class (override PTAC/PADDT defaults).
    if (row.classList.contains("without_prowheader") || row.classList.contains("tb_without_rowheader")) {
      return true;
    }

    // PTAC
    if (this.isPtacRow(row)) {
      if (this.config.repeatPtacRowheader) return false;
      return true;
    }
    // PADDT
    if (this.isPaddtRow(row)) {
      if (this.paddtConfig && this.paddtConfig.repeatPaddtRowheader) return false;
      return true;
    }
    return false;
  };

  FormatterClass.prototype.shouldSkipDummyRowItemsForContext = function shouldSkipDummyRowItemsForContext(pageContext) {
    return Boolean(
      pageContext &&
      (
        (pageContext.isPtacPage && !this.config.insertPtacDummyRowItems) ||
        (pageContext.isPaddtPage && !(this.paddtConfig && this.paddtConfig.insertPaddtDummyRowItems))
      )
    );
  };
}

