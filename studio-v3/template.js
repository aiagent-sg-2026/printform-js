import { PRINT_TYPOGRAPHY_CSS, setPrintTypographyBase } from '../studio-v2/core/typography.js';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = (name, value) => ` ${name}="${escape(value)}"`;
function valueNode(block, f) {
  const id = `${block}-${f.id}`;
  const binding = f.pointer ? attr('data-pf-text', f.pointer) : '';
  return `<span data-v3-id="${escape(id)}" data-pf-component-id="${escape(id)}"${binding}${f.format ? attr('data-pf-format', f.format) : ''}>${escape(f.text || '')}</span>`;
}
function fields(design, block) {
  return design[block].map(f => `<div class="field" data-v3-field="${escape(block+'-'+f.id)}"><span class="label">${escape(f.label)}</span>${valueNode(block, f)}</div>`).join('');
}
export function compileTemplate(d) {
  const enabled = id => d.blocks[id].enabled;
  const header = enabled('header') ? `<header class="pheader v3-header" data-v3-id="header" data-pf-component-id="header"><div class="brand-mark">A</div><div class="company-fields">${fields(d, 'header')}</div><h1>${escape(d.title)}</h1></header>` : '<header class="pheader blank"><span>Untitled form</span></header>';
  const customer = enabled('customer') ? `<section class="pdocinfo v3-customer" data-v3-id="customer" data-pf-component-id="customer">${fields(d, 'customer')}</section>` : '';
  const cols = d.columns;
  const cell = (f, heading) => `<${heading ? 'th' : 'td'}${attr('style', `width:${f.width}%;text-align:${['number', 'currency'].includes(f.format) ? 'right' : 'left'}`)}>${heading ? escape(f.label) : valueNode('items', f)}</${heading ? 'th' : 'td'}>`;
  const table = enabled('items') ? `<table class="prowheader v3-grid" data-pf-table-id="items" data-v3-id="items-header" data-pf-component-id="items-header" data-pf-repeat-rowheader="${d.repeatTable ? 'y' : 'n'}"><thead><tr>${cols.map(f => cell(f, true)).join('')}</tr></thead></table>${d.breakBefore ? '<div class="ptac-rowitem tb_page_break_before" data-pf-table-id="items" style="height:1px"></div>' : ''}<table class="prowitem v3-grid" data-pf-each="${escape(d.collection)}" data-pf-table-id="items" data-v3-id="items" data-pf-component-id="items"><tbody><tr>${cols.map(f => cell(f, false)).join('')}</tr></tbody></table>` : '';
  const totals = enabled('totals') ? `<footer class="pfooter v3-totals" data-v3-id="totals" data-pf-component-id="totals"><div class="summary">${fields(d, 'totals')}</div></footer>` : '';
  const footer = enabled('footer') ? `<footer class="pfooter002 v3-notes" data-v3-id="footer" data-pf-component-id="footer">${fields(d, 'footer')}</footer>` : '';
  return `<section class="printform" data-paper-size="A4" data-papersize="A4" data-orientation="portrait" data-repeat-header="${d.repeatHeader ? 'y' : 'n'}" data-repeat-docinfo="n" data-repeat-rowheader="${d.repeatTable ? 'y' : 'n'}" data-repeat-footer="n" data-repeat-footer002="n" data-repeat-footer-pagenum="y" data-insert-dummy-row-item-while-format-table="n" data-insert-footer-spacer-while-format-table="y">${header}${customer}${table}${totals}${footer}<footer class="pfooter_pagenum v3-page-number">${d.pageNumbers ? 'Page <span data-page-number></span> of <span data-page-total></span>' : ''}</footer></section>`;
}
export function documentTheme(d) {
  const color = /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#1763dc';
  const font = Math.max(6, Math.min(14, Number(d.font) || 9));
  const padding = Math.max(2, Math.min(16, Number(d.padding) || 7));
  return `${setPrintTypographyBase(PRINT_TYPOGRAPHY_CSS, font)}
* { box-sizing:border-box; } body { margin:0; background:#e5eaf1; }
#pf-mount { color:#1c2638; font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif; line-height:1.4; }
#pf-mount .printform, #pf-mount .printform_page { width:793.7px; background:white; }
#pf-mount .printform_page { margin-bottom:24px; box-shadow:0 4px 18px #0002; }
#pf-mount .v3-header { padding:32px 36px 20px; display:grid; grid-template-columns:52px 1fr auto; gap:14px; border-bottom:3px solid ${color}; }
#pf-mount .brand-mark { color:${color}; font-size:40px; font-weight:900; line-height:1; }
#pf-mount h1 { font-size:18pt; margin:0; text-align:right; letter-spacing:.025em; }
#pf-mount .company-fields { display:grid; grid-template-columns:1fr 1fr; gap:8px 18px; }
#pf-mount .field { display:flex; flex-direction:column; min-width:0; white-space:pre-line; overflow-wrap:anywhere; }
#pf-mount .label { font-size:var(--pf-font-minus-1); color:#566477; }
#pf-mount .company-fields [data-v3-field=header-company] { font-size:var(--pf-font-plus-3); font-weight:700; grid-column:1/-1; }
#pf-mount .company-fields [data-v3-field=header-company] .label { display:none; }
#pf-mount .company-fields [data-v3-field=header-address], #pf-mount .company-fields [data-v3-field=header-registration] { grid-column:1/-1; }
#pf-mount .v3-customer { padding:22px 36px; display:grid; grid-template-columns:1fr 1fr; gap:10px 28px; }
#pf-mount .v3-customer .field:nth-child(2) { grid-column:1; grid-row:2; }
#pf-mount .v3-customer .field:nth-child(3) { grid-column:2; grid-row:1; }
#pf-mount .v3-customer .field:nth-child(4) { grid-column:2; grid-row:2; }
#pf-mount .v3-grid { width:calc(100% - 72px); margin:0 36px; table-layout:fixed; border-collapse:collapse; }
#pf-mount .v3-grid th { background:#e9eff8; color:#253c59; font-size:var(--pf-font-minus-1); text-align:left; }
#pf-mount .v3-grid th, #pf-mount .v3-grid td { padding:${padding}px 5px; border:${d.borders ? '1px solid #d8e1ed' : '0'}; vertical-align:top; overflow-wrap:anywhere; white-space:pre-line; }
#pf-mount .v3-grid td { font-size:var(--pf-font-default); }
${d.striped ? '#pf-mount .prowitem_processed[data-pf-row-index]:nth-child(even) { background:#f7f9fc; }' : ''}
#pf-mount .v3-totals { padding:18px 36px 0; }
#pf-mount .summary { width:285px; margin-left:auto; }
#pf-mount .summary .field { display:flex; flex-direction:row; justify-content:space-between; padding:6px 8px; gap:12px; }
#pf-mount .summary .field:last-child { font-weight:700; border-top:2px solid ${color}; background:#eef3fa; }
#pf-mount .v3-notes { padding:20px 36px; }
#pf-mount .v3-notes .field { margin-bottom:8px; }
#pf-mount .v3-page-number { margin:0 36px; padding:10px 0 16px; border-top:1px solid #bac8da; text-align:right; color:#566477; font-size:var(--pf-font-minus-1); }
#pf-mount .blank { padding:36px; min-height:120px; color:#68788c; }
@page { size:A4; margin:0; }
@media print { body { background:white; } #pf-mount .printform_page { margin:0; box-shadow:none; } }`;
}
