import { FIELD_STYLE_KEYS, ALIGNMENTS } from './design-authoring.js';
import { isHexColor } from './table-style.js';

export function validateFieldStyle(style) {
  if (!style || typeof style !== 'object' || Array.isArray(style) || Object.keys(style).some(key=>!FIELD_STYLE_KEYS.includes(key))) throw new Error('Unsupported field style property.');
  if (style.fontSize !== undefined && (typeof style.fontSize !== 'number' || !Number.isFinite(style.fontSize) || style.fontSize < 6 || style.fontSize > 72)) throw new Error('Field font size must be between 6 and 72pt.');
  if (style.bold !== undefined && typeof style.bold !== 'boolean') throw new Error('Field bold must be a boolean.');
  if (style.color !== undefined && !isHexColor(style.color)) throw new Error('Field color must be a six-digit hex color.');
  if (style.align !== undefined && !ALIGNMENTS.includes(style.align)) throw new Error('Unsupported field alignment.');
  return style;
}

// Typography replaces an override. Empty controls/patches restore inherited styling.
// Scope, private-draft publication and human commits belong to the adapters.
export function elementStyleChange(design,target,patch) {
  const reject = message => { throw Object.assign(new Error(`UNSAFE_PROPOSAL: ${message}`),{code:'UNSAFE_PROPOSAL'}); };
  const key = target === 'header-title' ? 'titleStyle' : target === 'page-number' ? 'pageNumberStyle' : null;
  if (!key) reject('Element typography requires the heading or page number.');
  try { validateFieldStyle(patch); } catch (error) { reject(error.message); }
  const next = structuredClone(design), style = Object.fromEntries(Object.entries(patch).filter(([,value])=>value !== undefined));
  const unchanged = Object.keys(design[key] || {}).length === Object.keys(style).length && Object.entries(style).every(([property,value])=>design[key]?.[property] === value);
  // Key order alone cannot manufacture a typography edit in the proposal diff.
  if (Object.keys(style).length) next[key] = structuredClone(unchanged ? design[key] : style);
  else delete next[key];
  return {design:next,key,changes:[{target,property:'typography',before:design[key],after:next[key]}]};
}
