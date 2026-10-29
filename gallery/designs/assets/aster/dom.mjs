import {money} from './reconcile.mjs';
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export function node(tag, cls, html = '') {
  const el = document.createElement(tag); el.className = cls; el.innerHTML = html; return el;
}
export const monetary = (value, id) => `<span data-money-id="${esc(id)}">${money(value)}</span>`;
export function block(form, html, cls = '', table = 'context', atomic = true) {
  const el = node('section', `prowitem ${cls}`, html);
  el.dataset.pfTableId = table;
  if (atomic) el.dataset.pfKeepTogether = 'true';
  form.append(el); return el;
}
export function heading(form, title, kicker, table, labels = [], widths = []) {
  const el = node('section', 'prowheader section-heading', `<div class="section-title"><span>${esc(kicker)}</span><h2>${esc(title)}</h2></div>`);
  el.dataset.pfTableId = table; el.dataset.pfKeepWithNext = 'true';
  if (labels.length) el.append(tableNode('column-labels', labels.map(label => ({text:label})), widths, true));
  form.append(el);
}
export function tableNode(cls, cells, widths, header = false) {
  const el = node('table', `aster-table ${cls}`);
  const cols = widths.map(w => `<col style="width:${w}%">`).join('');
  const tag = header ? 'th' : 'td';
  el.innerHTML = `<colgroup>${cols}</colgroup><tbody><tr>${cells.map(cell => `<${tag} data-pf-cell-policy="${cell.policy || 'first'}" class="${cell.numeric ? 'numeric' : ''}"${cell.key ? ` data-cell-key="${esc(cell.key)}"` : ''}>${cell.html ?? esc(cell.text)}</${tag}>`).join('')}</tr></tbody>`;
  return el;
}
export function row(form, cells, widths, table, attributes = {}) {
  const el = tableNode('prowitem', cells, widths);
  Object.assign(el.dataset, {pfTableId:table, ...attributes}); form.append(el); return el;
}
