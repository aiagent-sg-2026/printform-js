import { resolvePaperDimensions } from '../src/printform/helpers.js';

export const BLOCKS = Object.freeze(['header', 'customer', 'items', 'totals', 'footer']);
export const FIELD_STYLE_KEYS = Object.freeze(['fontSize', 'bold', 'color', 'align']);
export const FIELD_KINDS = Object.freeze(['bound', 'static', 'image']);
export const PAPERS = Object.freeze(['A4', 'A5', 'LETTER', 'LEGAL']);
export const ORIENTATIONS = Object.freeze(['portrait', 'landscape']);
export const ALIGNMENTS = Object.freeze(['left', 'center', 'right']);
export const FORMATS = Object.freeze(['', 'currency', 'number', 'percent']);
export const fieldKind = field => field.kind || (field.pointer ? 'bound' : 'static');
export const sectionOrder = design => design.sectionOrder || [...BLOCKS];
export const usesFlowSections = design => Boolean(design.sectionOrder || BLOCKS.some(id => design.blocks[id].breakBefore));
export function pageSettings(design) {
  return { paper: design.page?.paper || 'A4', orientation: design.page?.orientation || 'portrait',
    margins: { top: 0, right: 0, bottom: 0, left: 0, ...design.page?.margins } };
}
export function pageDimensions(design) {
  const page = pageSettings(design);
  return resolvePaperDimensions({paperSize:page.paper,orientation:page.orientation,dpi:96});
}
export function contentDimensions(design) {
  const {width,height} = pageDimensions(design), {margins:m} = pageSettings(design);
  return {width:width-m.left-m.right,height:height-m.top-m.bottom};
}
export function validPointer(pointer, relative = false) {
  if (typeof pointer !== 'string' || !pointer.startsWith(relative ? './' : '/') || pointer.length > 240) return false;
  if (pointer.includes('*') || /~(?![01])/u.test(pointer)) return false;
  const tokens = pointer.slice(relative ? 2 : 1).split('/').map(t => t.replace(/~1/g,'/').replace(/~0/g,'~'));
  return !tokens.some(t => ['__proto__', 'prototype', 'constructor'].includes(t));
}
export function styleCss(style = {}) {
  // Only validated, typed tokens enter CSS. Never interpolate arbitrary CSS.
  const rules = [];
  if (style.fontSize !== undefined) rules.push(`font-size:${style.fontSize}pt`);
  if (style.bold !== undefined) rules.push(`font-weight:${style.bold ? 700 : 400}`);
  if (style.color !== undefined) rules.push(`color:${style.color}`);
  if (style.align !== undefined) rules.push(`text-align:${style.align}`);
  return rules.join(';');
}
export function assetOf(design, id) { return design.assets?.find(asset => asset.id === id) || null; }
export function labelSelection(id) { return typeof id === 'string' && id.startsWith('label-') ? id.slice(6) : id; }
