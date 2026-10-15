function flag(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "y"].includes(String(value).trim().toLowerCase());
}

function hasTableMap(sections) {
  return Object.keys(sections?.rowHeadersById || {}).length > 0;
}

export function shouldCarryOneTimeTableHeader(formatter, container, sections, tableId) {
  if (formatter.isRowHeaderRepeated(sections, tableId)) return false;
  return !Array.from(container.querySelectorAll(".prowitem_processed, .ptac-rowitem_processed, .paddt-rowitem_processed"))
    .some((row) => formatter.getRowTableId(row) === tableId);
}

export function attachRowHeaderPolicyMethods(FormatterClass) {
  FormatterClass.prototype.getSectionRowHeader = function getSectionRowHeader(sections, tableId = "default") {
    const rowHeadersById = sections?.rowHeadersById || {};
    if (Object.prototype.hasOwnProperty.call(rowHeadersById, tableId)) return rowHeadersById[tableId];
    if (hasTableMap(sections)) return null;
    return sections?.rowHeader || null;
  };

  FormatterClass.prototype.isRowHeaderRepeated = function isRowHeaderRepeated(sections, tableId = "default") {
    const header = this.getSectionRowHeader(sections, tableId);
    if (!header) return false;
    const localValue = typeof header.getAttribute === "function"
      ? header.getAttribute("data-pf-repeat-rowheader")
      : undefined;
    return flag(localValue, Boolean(this.config.repeatRowheader));
  };

  FormatterClass.prototype.maxRepeatingRowHeaderHeight = function maxRepeatingRowHeaderHeight(sections, heights) {
    const headers = sections?.rowHeaders?.length ? sections.rowHeaders : [sections?.rowHeader].filter(Boolean);
    const values = headers
      .filter((header) => this.isRowHeaderRepeated(sections, this.getRowTableId?.(header) || "default"))
      .map((header) => {
        const tableId = this.getRowTableId?.(header) || "default";
        return heights?.rowHeaders?.[tableId] ?? heights?.rowHeader ?? 0;
      });
    return values.length ? Math.max(...values) : 0;
  };
}
