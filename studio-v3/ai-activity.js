import { labelSelection } from './design-authoring.js';

// Plain-language activity lines for a change card. They are derived from the parsed diff (never from model text) and
// are display only; the raw target/property/before/after rows stay available under Details.
const SECTION_NAMES = {header:'header',customer:'customer details',items:'items table',totals:'totals',footer:'footer'};
const ASPECTS = {color:'color',fontSize:'text size',bold:'text weight',align:'alignment'};
const STYLE_KEY_LINES = {color:'Updated accent color',font:'Changed base text size',padding:'Adjusted cell spacing',striped:'Changed row striping',borders:'Changed table borders',
  repeatHeader:'Changed repeated headers',repeatTable:'Changed repeated table header',pageNumbers:'Changed page numbers',breakBefore:'Changed page breaks'};
const ELEMENT_NAMES = {'header-title':'title','page-number':'page number'};
const parse = value => { try { const parsed = typeof value === 'string' && value.startsWith('{') ? JSON.parse(value) : null; return parsed && typeof parsed === 'object' ? parsed : null; } catch { return null; } };
const aspect = (property,after) => {
  const keys = Object.keys(parse(after) || {}).filter(key=>ASPECTS[key]);
  return keys.length === 1 ? ASPECTS[keys[0]] : 'style';
};
const blockOf = target => String(labelSelection(target)).split('-')[0];
export function describeChange({target,property,after}) {
  const label = typeof target === 'string' && target.startsWith('label-');
  const name = labelSelection(target);
  if (target === 'style') return STYLE_KEY_LINES[property] || 'Updated page style';
  if (target === 'document') return property === 'sectionOrder' ? 'Reordered sections' : String(property).startsWith('page.') ? 'Changed page setup' : 'Updated the document';
  if (ELEMENT_NAMES[target]) return `Updated ${ELEMENT_NAMES[target]} ${ASPECTS[property] || 'style'}`;
  if (target === 'items' && property === 'rowBackground') return 'Updated table row color';
  if (property === 'width') return /^items-/.test(target) ? 'Changed column widths' : 'Resized an element';
  if (property === 'layout') return `Adjusted ${SECTION_NAMES[target] || 'section'} spacing`;
  if (property === 'labelStyle' || (label && property === 'valueStyle')) return blockOf(name) === 'items' ? `Updated table header ${aspect(property,after)}` : `Updated label ${aspect(property,after)}`;
  if (property === 'valueStyle') return blockOf(name) === 'items' ? `Updated table cell ${aspect(property,after)}` : `Updated value ${aspect(property,after)}`;
  if (property === 'showLabel') return 'Changed label visibility';
  if (SECTION_NAMES[target]) return `Updated ${SECTION_NAMES[target]} settings`;
  if (target === 'header-logo') return 'Changed the logo';
  if (property === 'add_field') return 'Added a field';
  if (property === 'remove_field') return 'Removed a field';
  if (['label','text','pointer','kind','format'].includes(property)) return 'Edited field content';
  return 'Updated a field';
}
// One line per kind of change, in first-seen order, so twelve property diffs read as two or three sentences.
export function activityLines(diff = [],limit = 5) {
  // An added or removed field logs every property it carried; the single structural line says it all.
  const structural = new Set(diff.filter(entry=>entry.property === 'add_field' || entry.property === 'remove_field').map(entry=>entry.target));
  const lines = [...new Set(diff.filter(entry=>!structural.has(entry.target) || entry.property === 'add_field' || entry.property === 'remove_field').map(describeChange))];
  return lines.length > limit ? [...lines.slice(0,limit),`and ${lines.length-limit} more`] : lines;
}
