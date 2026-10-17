import { resolvePointer } from './json.js';
import { renderBarcode } from './barcode.js';

function numericAttribute(element, name) {
  if (!element.hasAttribute(name)) return undefined;
  const raw = element.getAttribute(name);
  return /^[0-9]+$/.test(raw) ? Number(raw) : NaN;
}

export function bindBarcodeElement(element, rootData, scope, report) {
  const pointer = element.getAttribute('data-pf-barcode');
  report.bindings++;
  try {
    if (['data-pf-text','data-pf-href','data-pf-format','data-pf-format-options','data-pf-monetary'].some(name => element.hasAttribute(name))) {
      const error = new Error('Barcode binding cannot also format, replace text, or bind a URL');
      error.code = 'BARCODE_CONFIG';
      throw error;
    }
    const value = resolvePointer(rootData, pointer, scope);
    if (value === undefined) {
      const error = new Error(`No value found for ${pointer}`);
      error.code = 'MISSING_BINDING';
      throw error;
    }
    const options = {};
    if (element.hasAttribute('data-pf-barcode-format')) options.format = element.getAttribute('data-pf-barcode-format');
    const moduleWidth = numericAttribute(element, 'data-pf-barcode-module-width');
    const height = numericAttribute(element, 'data-pf-barcode-height');
    if (moduleWidth !== undefined) options.moduleWidth = moduleWidth;
    if (height !== undefined) options.height = height;
    if (element.hasAttribute('data-pf-barcode-display-value')) {
      const raw = element.getAttribute('data-pf-barcode-display-value');
      options.displayValue = raw === 'true' ? true : raw === 'false' ? false : raw;
    }
    element.replaceChildren(renderBarcode(element.ownerDocument, value, options));
    element.setAttribute('data-pf-component-type', 'barcode');
    element.style.breakInside = 'avoid';
  } catch (error) {
    // Never leave an old barcode, author-supplied placeholder or partial symbol.
    element.replaceChildren();
    report.errors.push({code:error.code || 'BARCODE_ENCODING', path:pointer || '/template',
      component:element.getAttribute('data-pf-component-id') || null, message:error.message || 'Barcode encoding failed'});
  }
}
