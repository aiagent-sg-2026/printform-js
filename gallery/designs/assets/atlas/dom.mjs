import {money} from './model.mjs';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export function node(tag, cls, html = '') {
  const el = document.createElement(tag); el.className = cls; el.innerHTML = html; return el;
}
export const monetary = (value, id) => `<span data-money-id="${esc(id)}">${money(value)}</span>`;
export function block(form, html, cls, table, atomic = true) {
  const el = node('section', `prowitem ${cls}`, html);
  el.dataset.pfTableId = table;
  el.dataset.rowKey = String(form.querySelectorAll('.prowitem').length);
  if (atomic) el.dataset.pfKeepTogether = 'true';
  form.append(el); return el;
}
export function table(cells, widths, header = false) {
  const el = node('table', 'atlas-table');
  const tag = header ? 'th' : 'td';
  el.innerHTML = `<colgroup>${widths.map(w => `<col style="width:${w}%">`).join('')}</colgroup><tbody><tr>${cells.map(c => `<${tag} data-pf-cell-policy="${c.policy || 'first'}" class="${c.numeric ? 'numeric' : ''}"${c.key ? ` data-cell-key="${esc(c.key)}"` : ''}>${c.html ?? esc(c.text)}</${tag}>`).join('')}</tr></tbody>`;
  return el;
}
export function heading(form, number, title, tableId, labels = [], widths = []) {
  const el = node('section', 'prowheader section-heading', `<div class="section-title"><b>${esc(number)}</b><h2>${esc(title)}</h2></div>`);
  Object.assign(el.dataset, {pfTableId:tableId, pfKeepWithNext:'true'});
  if (labels.length) el.append(table(labels.map(text => ({text})), widths, true));
  form.append(el); return el;
}
export function row(form, cells, widths, tableId, attributes = {}) {
  const el = table(cells, widths); el.classList.add('prowitem');
  Object.assign(el.dataset, {pfTableId:tableId, rowKey:String(form.querySelectorAll('.prowitem').length), ...attributes}); form.append(el); return el;
}
export const grams = n => n === null ? 'Unknown / incomplete' : `${n.toLocaleString('en-SG')} g`;
export const feeLabel = report => report.partial ? 'Partial landed subtotal — unresolved charges excluded' : 'Landed total';
