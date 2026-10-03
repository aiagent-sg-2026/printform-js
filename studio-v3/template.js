import { PRINT_TYPOGRAPHY_CSS, setPrintTypographyBase } from '../studio-v2/core/typography.js';
import { validateDesign } from './design-validation.js';
import { tableBodyCss } from './table-style.js';
import { a4PresetTheme } from './a4-theme.js';
import { sectionOrder, usesFlowSections, fieldKind, styleCss, assetOf, pageSettings, pageDimensions, contentDimensions } from './design-authoring.js';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = (name, value) => ` ${name}="${escape(value)}"`;
const styleAttr = style => styleCss(style) ? attr('style',styleCss(style)) : '';
const component = id => `${attr('data-v3-id',id)}${attr('data-pf-component-id',id)}`;
function imageNode(d, image, id, role = 'value') {
  const asset = assetOf(d,image.assetId);
  return `<img${component(id)}${attr('data-v3-role',role)}${attr('src',asset.src)}${attr('alt',asset.alt)}${attr('width',image.width)}${attr('height',image.height)}${attr('style',`object-fit:${image.fit || 'contain'};max-width:100%`)}>`;
}
function valueNode(d, block, f) {
  const id = `${block}-${f.id}`;
  if (fieldKind(f) === 'image') return imageNode(d,f,id);
  const binding = fieldKind(f) === 'bound' ? attr('data-pf-text', f.pointer) : '';
  return `<span${component(id)} data-v3-role="value"${binding}${f.format ? attr('data-pf-format', f.format) : ''}${styleAttr(f.valueStyle)}>${escape(f.text || '')}</span>`;
}
function labelNode(block, f) {
  if (f.showLabel === false) return '';
  return `<span class="label"${attr('data-v3-id',`label-${block}-${f.id}`)} data-v3-role="label"${f.showLabel === true ? ' data-v3-label-visible="true"' : ''}${styleAttr(f.labelStyle)}>${escape(f.label)}</span>`;
}
function fields(d, block) {
  return d[block].map(f => `<div class="field" data-v3-field="${escape(block+'-'+f.id)}">${labelNode(block,f)}${valueNode(d,block,f)}</div>`).join('');
}
function sectionAttributes(d, id) {
  const b = d.blocks[id];
  return `${component(id)}${b.keepTogether && !(id === 'header' && d.repeatHeader) ? ' data-pf-keep-together="true"' : ''}`;
}
function sectionClass(d, id, legacy) {
  const flow = usesFlowSections(d) && !(id === 'header' && sectionOrder(d)[0] === 'header');
  return `${flow ? 'ptac-rowitem without_prowheader' : legacy} v3-${{header:'header',customer:'customer',totals:'totals',footer:'notes'}[id]}${d.blocks[id].layout ? ' v3-custom-layout' : ''}${flow && d.blocks[id].breakBefore ? ' tb_page_break_before' : ''}`;
}
function tableNode(d) {
  const cols = d.columns;
  const cell = (f, heading) => {
    const align = (heading ? f.labelStyle : f.valueStyle)?.align || (['number','currency'].includes(f.format) ? 'right' : 'left');
    return `<${heading ? 'th' : 'td'}${attr('style',`width:${f.width}%;text-align:${align}${heading && f.labelStyle ? ';'+styleCss(f.labelStyle) : ''}`)}>${heading ? labelNode('items',f) : valueNode(d,'items',f)}</${heading ? 'th' : 'td'}>`;
  };
  const flow = usesFlowSections(d), breakBefore = d.breakBefore || d.blocks.items.breakBefore;
  const headingFlow = (flow || breakBefore) && !d.repeatTable;
  const heading = `<table class="${headingFlow ? 'ptac-rowitem without_prowheader' : 'prowheader'} v3-grid" data-pf-table-id="${headingFlow ? 'v3-items-heading' : 'items'}"${component('items-header')} data-pf-repeat-rowheader="${d.repeatTable ? 'y' : 'n'}"><thead><tr>${cols.map(f=>cell(f,true)).join('')}</tr></thead></table>`;
  const pageBreak = breakBefore ? '<div class="ptac-rowitem tb_page_break_before without_prowheader" data-pf-table-id="v3-items-break" style="height:1px"></div>' : '';
  return `${pageBreak}${heading}<table class="prowitem v3-grid" data-pf-each="${escape(d.collection)}" data-pf-table-id="items"${sectionAttributes(d,'items')}><tbody><tr>${cols.map(f=>cell(f,false)).join('')}</tr></tbody></table>`;
}
export function compileTemplate(d) {
  validateDesign(d);
  const enabled = id => d.blocks[id].enabled, page = pageSettings(d), size = contentDimensions(d);
  const header = `<header class="${sectionClass(d,'header','pheader')}"${sectionAttributes(d,'header')}${usesFlowSections(d) && sectionOrder(d)[0] !== 'header' ? ' data-pf-table-id="v3-header"' : ''}>${d.logo ? imageNode(d,d.logo,'header-logo','logo') : '<div class="brand-mark" data-v3-id="header-logo">A</div>'}<div class="company-fields">${fields(d,'header')}</div><h1 data-v3-id="header-title"${styleAttr(d.titleStyle)}>${escape(d.title)}</h1></header>`;
  const customer = `<section class="${sectionClass(d,'customer','pdocinfo')}"${sectionAttributes(d,'customer')} data-pf-table-id="v3-customer">${fields(d,'customer')}</section>`;
  const totals = `<footer class="${sectionClass(d,'totals','pfooter')}"${sectionAttributes(d,'totals')} data-pf-table-id="v3-totals"><div class="summary">${fields(d,'totals')}</div></footer>`;
  const footer = `<footer class="${sectionClass(d,'footer','pfooter002')}"${sectionAttributes(d,'footer')} data-pf-table-id="v3-footer">${fields(d,'footer')}</footer>`;
  const nodes = {header,customer,items:tableNode(d),totals,footer};
  const manualSize = Object.values(page.margins).some(Boolean) ? `${attr('data-papersize-width',size.width)}${attr('data-papersize-height',size.height)}` : '';
  return `<section class="printform"${attr('data-paper-size',page.paper)}${attr('data-papersize',page.paper)}${attr('data-orientation',page.orientation)}${manualSize} data-repeat-header="${enabled('header') && d.repeatHeader ? 'y' : 'n'}" data-repeat-docinfo="n" data-repeat-rowheader="${d.repeatTable ? 'y' : 'n'}" data-repeat-ptac-rowheader="n" data-repeat-footer="n" data-repeat-footer002="n" data-repeat-footer-pagenum="${d.pageNumbers ? 'y' : 'n'}" data-insert-ptac-dummy-row-items="n" data-insert-dummy-row-item-while-format-table="n" data-insert-footer-spacer-while-format-table="y">${sectionOrder(d).filter(enabled).map(id=>nodes[id]).join('')}${d.pageNumbers ? `<footer class="pfooter_pagenum v3-page-number" data-v3-id="page-number"${styleAttr(d.pageNumberStyle)}>Page <span data-page-number></span> of <span data-page-total></span></footer>` : ''}</section>`;
}
export function documentTheme(d) {
  validateDesign(d);
  const color = d.color, font = d.font, padding = d.padding;
  const page = pageSettings(d), physical = pageDimensions(d), size = contentDimensions(d), m = page.margins;
  const pageMargins = Object.values(m).some(Boolean);
  const grid = Object.entries(d.blocks).filter(([,b])=>b.layout).map(([id,b])=>`#pf-mount .v3-${{header:'header',customer:'customer',totals:'totals',footer:'notes'}[id]} ${id === 'header' ? '.company-fields' : id === 'totals' ? '.summary' : ''} {display:grid;grid-template-columns:repeat(${b.layout.columns || 1},minmax(0,1fr));gap:${b.layout.gap ?? 12}px;}`).join('\n');
  return `${setPrintTypographyBase(PRINT_TYPOGRAPHY_CSS, font)}
* { box-sizing:border-box; } body { margin:0; background:#e5eaf1; }
#pf-mount { color:#1c2638; font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif; line-height:1.4; }
#pf-mount .printform, #pf-mount .printform_page { width:${size.width}px; background:white; }
#pf-mount .printform_page { margin-bottom:24px; box-shadow:0 4px 18px #0002; }
${pageMargins ? `#pf-mount .physical_page_wrapper {width:${physical.width}px!important;padding:${m.top}px ${m.right}px ${m.bottom}px ${m.left}px;background:white;margin-bottom:24px;} #pf-mount .physical_page_wrapper .printform_page {margin:0;box-shadow:none;}` : ''}
#pf-mount .v3-header { padding:32px 36px 20px; display:grid; grid-template-columns:${d.logo ? d.logo.width : 52}px 1fr auto; gap:14px; border-bottom:3px solid ${color}; }
#pf-mount .brand-mark { color:${color}; font-size:40px; font-weight:900; line-height:1; }
#pf-mount h1 { font-size:18pt; margin:0; text-align:right; letter-spacing:.025em; }
#pf-mount .company-fields { display:grid; grid-template-columns:1fr 1fr; gap:8px 18px; }
#pf-mount .field { display:flex; flex-direction:column; min-width:0; white-space:pre-line; overflow-wrap:anywhere; }
#pf-mount .label { font-size:var(--pf-font-minus-1); color:#566477; }
#pf-mount .company-fields [data-v3-field=header-company] { font-size:var(--pf-font-plus-3); font-weight:700; grid-column:1/-1; }
#pf-mount .company-fields [data-v3-field=header-company] .label { display:none; }
#pf-mount .company-fields [data-v3-field=header-company] .label[style], #pf-mount .company-fields [data-v3-field=header-company] .label[data-v3-label-visible] { display:inline; }
#pf-mount .company-fields [data-v3-field=header-address], #pf-mount .company-fields [data-v3-field=header-registration] { grid-column:1/-1; }
#pf-mount .v3-customer { padding:22px 36px; display:grid; grid-template-columns:1fr 1fr; gap:10px 28px; }
#pf-mount .v3-customer:not(.v3-custom-layout) .field:nth-child(2) { grid-column:1; grid-row:2; }
#pf-mount .v3-customer:not(.v3-custom-layout) .field:nth-child(3) { grid-column:2; grid-row:1; }
#pf-mount .v3-customer:not(.v3-custom-layout) .field:nth-child(4) { grid-column:2; grid-row:2; }
#pf-mount .v3-grid { width:calc(100% - 72px); margin:0 36px; table-layout:fixed; border-collapse:collapse; }
#pf-mount .v3-grid th { background:#e9eff8; color:#253c59; font-size:var(--pf-font-minus-1); text-align:left; }
#pf-mount .v3-grid th .label { color:inherit; font-size:inherit; }
#pf-mount .v3-grid th, #pf-mount .v3-grid td { padding:${padding}px 5px; border:${d.borders ? '1px solid #d8e1ed' : '0'}; vertical-align:top; overflow-wrap:anywhere; white-space:pre-line; }
#pf-mount .v3-grid td { font-size:var(--pf-font-default); }
${d.striped ? '#pf-mount .prowitem_processed[data-pf-row-index]:nth-child(even) { background:#f7f9fc; }' : ''}
#pf-mount .v3-totals { padding:18px 36px 0; }
#pf-mount .summary { width:min(285px,100%); margin-left:auto; }
#pf-mount .summary .field { display:flex; flex-direction:row; justify-content:space-between; padding:6px 8px; gap:12px; }
#pf-mount .summary .field:last-child { font-weight:700; border-top:2px solid ${color}; background:#eef3fa; }
#pf-mount .v3-notes { padding:20px 36px; }
#pf-mount .v3-notes .field { margin-bottom:8px; }
#pf-mount .v3-page-number { margin:0 36px; padding:10px 0 16px; border-top:1px solid #bac8da; text-align:right; color:#566477; font-size:var(--pf-font-minus-1); }
#pf-mount .v3-custom-layout .field { grid-column:auto;grid-row:auto; }
${a4PresetTheme(d)}
${grid}
${tableBodyCss(d)}
@page { size:${page.paper === 'LETTER' ? 'letter' : page.paper === 'LEGAL' ? 'legal' : page.paper} ${page.orientation}; margin:0; }
@media print { body { background:white; } #pf-mount .printform_page, #pf-mount .physical_page_wrapper {margin:0;box-shadow:none;} }`;
}
