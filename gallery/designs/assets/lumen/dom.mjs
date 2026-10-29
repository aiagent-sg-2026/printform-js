export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export function node(tag, cls, html = '') { const el = document.createElement(tag); el.className = cls; el.innerHTML = html; return el; }
export const field = (key, value) => `<span data-source-key="${esc(key)}">${esc(value)}</span>`;
export function block(form, html, cls = '', tableId = 'overview') {
  const el = node('section', `prowitem ${cls}`, html);
  Object.assign(el.dataset, {pfTableId:tableId, pfKeepTogether:'true'}); form.append(el); return el;
}
export function row(form, html, tableId, cls = '') {
  const cells = Array.isArray(html) ? html : [html];
  const el = node('table', `prowitem prose ${cls}`, `<colgroup>${cells.map(() => `<col style="width:${100 / cells.length}%">`).join('')}</colgroup><tbody><tr>${cells.map(cell => `<td data-pf-cell-policy="split">${cell}</td>`).join('')}</tr></tbody>`);
  Object.assign(el.dataset, {pfTableId:tableId, rowKey:String(form.querySelectorAll('[data-row-key]').length)});
  form.append(el); return el;
}
export function heading(form, number, title, tableId) {
  const el = node('section', 'prowheader section-heading', `<div class="section-title"><b>${esc(number)}</b><h2>${esc(title)}</h2></div>`);
  Object.assign(el.dataset, {pfTableId:tableId, pfKeepWithNext:'true'}); form.append(el); return el;
}
export const label = (state, en, zh) => state.language === 'bilingual' ? `${en} / ${zh}` : en;
export const list = (key, values) => values.map((v, i) => `<p class="list-item">${field(`${key}.${i}`, v)}</p>`).join('');
export const refs = (key, values) => values.map((v, i) => field(`${key}.${i}`, v)).join(' · ');
