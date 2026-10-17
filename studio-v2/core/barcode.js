import JsBarcode from '../vendor/jsbarcode-3.12.1.js';

export const BARCODE_FORMATS = Object.freeze(['CODE128', 'EAN13']);
export const DEFAULT_BARCODE = Object.freeze({format:'CODE128', moduleWidth:2, height:48, displayValue:true});
const SVG_NS = 'http://www.w3.org/2000/svg';
const OPTION_KEYS = new Set(Object.keys(DEFAULT_BARCODE));

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

export function barcodeOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) fail('BARCODE_CONFIG', 'Barcode settings must be an object');
  if (Object.keys(options).some(key => !OPTION_KEYS.has(key))) fail('BARCODE_CONFIG', 'Unsupported barcode setting');
  const config = {...DEFAULT_BARCODE, ...options};
  if (!BARCODE_FORMATS.includes(config.format)) fail('BARCODE_FORMAT', 'Barcode format must be CODE128 or EAN13');
  if (!Number.isInteger(config.moduleWidth) || config.moduleWidth < 1 || config.moduleWidth > 4) fail('BARCODE_CONFIG', 'Barcode module width must be an integer from 1 to 4 CSS px');
  if (!Number.isInteger(config.height) || config.height < 16 || config.height > 200) fail('BARCODE_CONFIG', 'Barcode bar height must be an integer from 16 to 200 CSS px');
  if (typeof config.displayValue !== 'boolean') fail('BARCODE_CONFIG', 'Barcode displayValue must be boolean');
  return config;
}

// Do not trim, coerce, pad, uppercase, or synthesize a missing check digit.
export function validateBarcode(value, options = {}) {
  const config = barcodeOptions(options);
  if (typeof value !== 'string' || !value.length) fail('BARCODE_VALUE', 'Barcode source must be a nonempty string');
  if (config.format === 'CODE128') {
    if (value.length > 128) fail('BARCODE_VALUE', 'CODE128 supports at most 128 supplied printable ASCII characters');
    if (!/^[\x20-\x7e]+$/.test(value)) fail('BARCODE_VALUE', 'CODE128 supports printable ASCII strings only');
  } else {
    if (!/^[0-9]{13}$/.test(value)) fail('BARCODE_VALUE', 'EAN13 requires exactly 13 supplied ASCII digits');
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(value[i]) * (i % 2 ? 3 : 1);
    if (Number(value[12]) !== (10 - sum % 10) % 10) fail('BARCODE_CHECKSUM', 'EAN13 supplied check digit is invalid');
  }
  return config;
}

export function encodeBarcode(value, format = 'CODE128') {
  return encodeValidatedBarcode(value,validateBarcode(value,{format}).format);
}

function encodeValidatedBarcode(value,format) {
  const target = {};
  // ObjectRenderer writes encodings only: no canvas, DOM, image, or fetch.
  // flat avoids JsBarcode's optional human-text/EAN guard layout normalization.
  JsBarcode(target, value, {format, flat:true, displayValue:false, margin:0});
  const bits = target.encodings.map(encoding => encoding.data).join('');
  return {value, format, bits, quietLeft:format === 'EAN13' ? 11 : 10,
    quietRight:format === 'EAN13' ? 7 : 10};
}

function svgNode(doc, name, attributes) {
  const node = doc.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

export function renderBarcode(doc, value, options = {}) {
  const config = validateBarcode(value, options);
  const encoded = encodeValidatedBarcode(value, config.format);
  const {bits, quietLeft, quietRight} = encoded;
  const symbolWidth = (bits.length + quietLeft + quietRight) * config.moduleWidth;
  const textWidth = value.length * 8.4;
  const width = Math.max(symbolWidth, config.displayValue ? Math.ceil(textWidth) + 20 : 0);
  const height = config.height + (config.displayValue ? 20 : 0) + 20;
  const svg = svgNode(doc, 'svg', {xmlns:SVG_NS, width, height, viewBox:`0 0 ${width} ${height}`,
    role:'img', 'aria-label':`${config.format}: ${value}`, 'data-pf-barcode-svg':config.format,
    'data-pf-barcode-source':value, 'shape-rendering':'crispEdges'});
  // Fixed physical dimensions preserve module widths; oversize must fail the
  // existing layout acceptance gate, never silently shrink bars or quiet zones.
  svg.style.cssText = `display:inline-block;vertical-align:top;width:${width}px;min-width:${width}px;max-width:none;height:${height}px;flex-shrink:0;overflow:visible`;
  const title = svgNode(doc, 'title', {});
  title.textContent = `${config.format}: ${value}`;
  svg.append(title, svgNode(doc, 'rect', {x:0,y:0,width,height,fill:'#fff'}));
  const bars = svgNode(doc, 'g', {fill:'#000','data-pf-barcode-bars':''});
  for (let index = 0; index < bits.length;) {
    if (bits[index] !== '1') { index++; continue; }
    const start = index;
    while (bits[index] === '1') index++;
    bars.append(svgNode(doc, 'rect', {x:(quietLeft + start) * config.moduleWidth, y:10,
      width:(index - start) * config.moduleWidth, height:config.height}));
  }
  svg.append(bars);
  if (config.displayValue) {
    const text = svgNode(doc, 'text', {x:width / 2,y:config.height + 26,fill:'#000',
      'text-anchor':'middle','font-family':'monospace','font-size':14,'xml:space':'preserve',
      textLength:textWidth,lengthAdjust:'spacingAndGlyphs'});
    text.style.whiteSpace = 'pre';
    text.textContent = value;
    svg.append(text);
  }
  return svg;
}
