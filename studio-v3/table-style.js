export const TABLE_STYLE_KEYS = ['rowBackground'];
export const isHexColor = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value);

const colorError = 'Table row background must be a six-digit hex color.';
export function validateTableStyle(style) {
  if (!style || typeof style !== 'object' || Array.isArray(style) || Object.keys(style).some(key=>!TABLE_STYLE_KEYS.includes(key))) throw new Error('Unsupported table style property.');
  if (style.rowBackground !== undefined && !isHexColor(style.rowBackground)) throw new Error(colorError);
}

// Adapters own scope and commits. This service only validates and transforms a private design.
export function tableStyleChange(design, target, patch) {
  const reject = message => { throw Object.assign(new Error(`UNSAFE_PROPOSAL: ${message}`),{code:'UNSAFE_PROPOSAL'}); };
  if (target !== 'items') reject('Table row background requires the items table.');
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key=>!TABLE_STYLE_KEYS.includes(key))) reject('Unsupported table style property.');
  if (Object.hasOwn(patch,'rowBackground') && patch.rowBackground !== null && !isHexColor(patch.rowBackground)) reject(colorError);
  const next = structuredClone(design), changes = [];
  if (Object.hasOwn(patch,'rowBackground')) {
    const after = patch.rowBackground === null ? undefined : patch.rowBackground;
    changes.push({target:'items',property:'tableStyle.rowBackground',before:design.tableStyle?.rowBackground,after});
    if (after !== undefined) next.tableStyle = {...next.tableStyle,rowBackground:after};
    else if (next.tableStyle) delete next.tableStyle.rowBackground;
  }
  if (next.tableStyle && !Object.keys(next.tableStyle).length) delete next.tableStyle;
  if (next.tableStyle !== undefined) {
    try { validateTableStyle(next.tableStyle); } catch (error) { reject(error.message); }
  }
  return {design:next,changes,diagnostics:[]};
}

// An explicit body fill wins over zebra striping, including paginated row clones.
// Clearing the override restores the template's existing stripe preference.
export function tableBodyCss(design) {
  const background = design.tableStyle?.rowBackground;
  const body = '#pf-mount .v3-grid[data-v3-id="items"][data-pf-table-id="items"]';
  return background ? `${body}, ${body} tr, ${body} td {background:${background};print-color-adjust:exact;-webkit-print-color-adjust:exact;}` : '';
}
