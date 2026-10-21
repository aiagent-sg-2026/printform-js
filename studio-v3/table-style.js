export const TABLE_STYLE_KEYS = ['rowBackground','headerBackground','headerColor'];
export const isHexColor = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value);

const colorError = 'Table style colors must be six-digit hex colors.';
export function validateTableStyle(style) {
  if (!style || typeof style !== 'object' || Array.isArray(style) || Object.keys(style).some(key=>!TABLE_STYLE_KEYS.includes(key))) throw new Error('Unsupported table style property.');
  if (TABLE_STYLE_KEYS.some(key=>style[key] !== undefined && style[key] !== null && !isHexColor(style[key]))) throw new Error(colorError);
}

// Adapters own scope and commits. This service only validates and transforms a private design.
export function tableStyleChange(design, target, patch) {
  const reject = message => { throw Object.assign(new Error(`UNSAFE_PROPOSAL: ${message}`),{code:'UNSAFE_PROPOSAL'}); };
  if (target !== 'items') reject('Table style requires the items table.');
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key=>!TABLE_STYLE_KEYS.includes(key))) reject('Unsupported table style property.');
  if (TABLE_STYLE_KEYS.some(key=>Object.hasOwn(patch,key) && patch[key] !== null && !isHexColor(patch[key]))) reject(colorError);
  const next = structuredClone(design), changes = [];
  for (const key of TABLE_STYLE_KEYS) if (Object.hasOwn(patch,key)) {
    const after = patch[key] === null ? undefined : patch[key];
    changes.push({target:'items',property:`tableStyle.${key}`,before:design.tableStyle?.[key],after});
    if (after !== undefined) next.tableStyle = {...next.tableStyle,[key]:after};
    else if (next.tableStyle) delete next.tableStyle[key];
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
  const {rowBackground,headerBackground,headerColor} = design.tableStyle || {};
  const body = '#pf-mount .v3-grid[data-v3-id="items"][data-pf-table-id="items"]';
  const header = '#pf-mount .v3-grid[data-v3-id="items-header"]';
  return [
    rowBackground ? `${body}, ${body} tr, ${body} td {background:${rowBackground};print-color-adjust:exact;-webkit-print-color-adjust:exact;}` : '',
    headerBackground ? `${header} th {background:${headerBackground};print-color-adjust:exact;-webkit-print-color-adjust:exact;}` : '',
    headerColor ? `${header} th, ${header} th .label {color:${headerColor};}` : ''
  ].join('');
}
