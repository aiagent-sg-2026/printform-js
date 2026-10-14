// A continuation is a window of the original HTML table grid, not flattened text.
export function measuredCellLayout(source, width, fail) {
  if (source.tagName !== "TABLE") return {
    rows: [source], cells: [{ source, start: 0, end: 1, column: 0, span: 1 }],
    slice: () => ({ fragment: source.cloneNode(false), targets: new Map() })
  };
  const rows = Array.from(source.rows), cells = [], occupied = [];
  let columns = 0;
  rows.forEach((row, start) => {
    let column = 0;
    Array.from(row.cells).forEach((cell) => {
      while (occupied[start]?.[column]) column += 1;
      let groupEnd = start + 1;
      while (groupEnd < rows.length && rows[groupEnd].parentNode === row.parentNode) groupEnd += 1;
      const end = Math.min(groupEnd, cell.rowSpan === 0 ? groupEnd : start + cell.rowSpan);
      const span = cell.colSpan;
      for (let y = start; y < end; y += 1) {
        occupied[y] ||= [];
        for (let x = column; x < column + span; x += 1) {
          if (occupied[y][x]) fail(source, "overlapping table cell spans");
          occupied[y][x] = true;
        }
      }
      cells.push({ source: cell, start, end, column, span });
      columns = Math.max(columns, column + span);
      column += span;
    });
  });
  if (!rows.length || !columns) fail(source, "table has no measurable cell grid");
  const view = source.ownerDocument.defaultView, tableStyle = view.getComputedStyle(source);
  const px = (style, name) => Number.parseFloat(style[name]) || 0;
  const measuredWidth = source.getBoundingClientRect().width;
  const targetWidth = Math.min(measuredWidth || width, width);
  const spacing = tableStyle.borderCollapse === "collapse" ? 0 : px(tableStyle, "borderSpacing");
  const chrome = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"]
    .reduce((sum, name) => sum + px(tableStyle, name), 0);
  const available = targetWidth - spacing * (columns + 1) - chrome;
  if (!(available > 0)) fail(source, "table border/padding/spacing consumes the target paper width");
  const rtl = tableStyle.direction === "rtl", edges = new Map();
  cells.forEach(({ source: cell, column, span }) => {
    const rect = cell.getBoundingClientRect();
    edges.set(column, rtl ? -rect.right : rect.left);
    edges.set(column + span, rtl ? -rect.left : rect.right);
  });
  const weights = Array.from({ length: columns }, (_, column) => {
    let left = column, right = column + 1;
    while (!edges.has(left) && left > 0) left -= 1;
    while (!edges.has(right) && right < columns) right += 1;
    return Math.max(0, ((edges.get(right) || 0) - (edges.get(left) || 0)) / (right - left));
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  const widths = weights.map(value => available * (total ? value / total : 1 / columns));
  return {
    rows, cells,
    slice(start, end, first = true) {
      const fragment = source.cloneNode(false), targets = new Map(), groups = new Map();
      fragment.style.width = `${targetWidth}px`;
      fragment.style.boxSizing = "border-box";
      fragment.style.tableLayout = "fixed";
      if (first && source.caption) fragment.append(source.caption.cloneNode(true));
      const colgroup = source.ownerDocument.createElement("colgroup");
      widths.forEach(value => {
        const col = source.ownerDocument.createElement("col");
        col.style.width = `${value}px`;
        colgroup.append(col);
      });
      fragment.append(colgroup);
      for (let index = start; index < end; index += 1) {
        const original = rows[index], parent = original.parentNode;
        let group = fragment;
        if (parent !== source) {
          if (!groups.has(parent)) {
            groups.set(parent, parent.cloneNode(false));
            fragment.append(groups.get(parent));
          }
          group = groups.get(parent);
        }
        const row = original.cloneNode(false);
        group.append(row);
        cells.filter(cell => Math.max(start, cell.start) === index && cell.end > start)
          .sort((a, b) => a.column - b.column).forEach((cell) => {
            const target = cell.source.cloneNode(false), style = view.getComputedStyle(cell.source);
            target.rowSpan = Math.min(end, cell.end) - index;
            const outer = widths.slice(cell.column, cell.column + cell.span).reduce((sum, value) => sum + value, 0) + spacing * (cell.span - 1);
            const cellChrome = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"]
              .reduce((sum, name) => sum + px(style, name), 0);
            target.style.width = `${Math.max(0, outer - (style.boxSizing === "border-box" ? 0 : cellChrome))}px`;
            row.append(target);
            targets.set(cell, target);
          });
      }
      return { fragment, targets };
    }
  };
}
