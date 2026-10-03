export const TABLE_STYLE_KEYS = ['rowBackground'];
export const isHexColor = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value);

// An explicit body fill wins over zebra striping, including paginated row clones.
// Clearing the override restores the template's existing stripe preference.
export function tableBodyCss(design) {
  const background = design.tableStyle?.rowBackground;
  const body = '#pf-mount .v3-grid[data-v3-id="items"][data-pf-table-id="items"]';
  return background ? `${body}, ${body} tr, ${body} td {background:${background};print-color-adjust:exact;-webkit-print-color-adjust:exact;}` : '';
}
