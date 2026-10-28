import {parse, validate, preset, MAX_BYTES} from './model.mjs';
import {render} from './template.mjs';
const $ = id => document.getElementById(id);
const sample = JSON.parse($('sample-data').textContent);
const logo = JSON.parse($('logo-data').textContent);
let revision = 0, queued = false, running = false, importTicket = 0;
window.MERIDIAN_READY = false;
function state(value, message, error = false) {
  document.body.dataset.state = value;
  window.MERIDIAN_READY = value === 'ready';
  window.__printFormProcessed = value === 'ready';
  $('print').disabled = value !== 'ready';
  $('status').setAttribute('role', error ? 'alert' : 'status');
  $('status').textContent = message;
}
function dirty() {
  revision++;
  importTicket++;
  state('dirty', 'Preview is not current. Select Update preview to validate and format.');
}
function failure(error) {
  const message = [error.message, ...(error.errors || []).map(e => e.message)].join(': ');
  window.MERIDIAN_ERROR = message;
  state('invalid', `Unable to render: ${message} Correct the JSON or reset the sample, then update.`, true);
}
function editor(data) {
  $('editor').value = JSON.stringify(data, null, 2);
  dirty();
}
async function engine() {
  if (window.PrintForm) return;
  const script = document.createElement('script');
  script.textContent = $('engine-source').textContent;
  document.body.append(script);
}
// Acceptance only: the genuine formatter, not this check, chooses every page break.
function assertGeometry() {
  for (const page of $('preview').querySelectorAll('.printform_page')) {
    const bounds = page.getBoundingClientRect();
    for (const n of page.querySelectorAll('svg,img,.line-grid>div,.identity,.remarks')) {
      const r = n.getBoundingClientRect();
      if (r.left < bounds.left - 1 || r.right > bounds.right + 1 || r.bottom > bounds.bottom + 1 ||
          n.scrollWidth > n.clientWidth + 1)
        throw new Error('Content does not fit the A4 page. Shorten the overflowing field or atomic row.');
    }
  }
}
async function update() {
  queued = true;
  state('pending', 'Validating and measuring with PrintForm…');
  if (running) return;
  running = true;
  try {
    while (queued) {
      queued = false;
      const current = revision;
      window.MERIDIAN_ERROR = null;
      try {
        const data = parse($('editor').value);
        const {form, total} = render(data, logo);
        $('preview').replaceChildren(form);
        await document.fonts.ready;
        await Promise.all([...form.querySelectorAll('img')].map(img => img.decode()));
        await engine();
        window.MERIDIAN_FORMAT_REPORT = await window.PrintForm.formatAll({force:true});
        if (current !== revision || queued) continue;
        assertGeometry();
        const pages = $('preview').querySelectorAll('.printform_page').length;
        window.MERIDIAN_RESULT = {data, total, pages, revision:current};
        state('ready', `${data.items.length} items · ${pages} pages · A4 · 9 pt · fictional sample. Preview is current.`);
      } catch (error) {
        if (current === revision && !queued) { $('preview').replaceChildren(); failure(error); }
      }
    }
  } finally { running = false; }
}
function change(action) {
  try { editor(action(parse($('editor').value))); void update(); }
  catch (error) { dirty(); failure(error); }
}
$('editor').addEventListener('input', dirty);
$('update').addEventListener('click', () => { dirty(); void update(); });
$('preset').addEventListener('change', () => change(data => {
  data.items = preset(sample, Number($('preset').value)).items; return data;
}));
$('reset').addEventListener('click', () => { $('preset').value = '6'; editor(sample); void update(); });
$('add').addEventListener('click', () => change(data => {
  if (data.items.length >= 200) throw new Error('Maximum 200 items. Remove an item before adding another.');
  let n = data.items.length + 1;
  while (data.items.some(item => item.code === `DEMO-${String(n).padStart(3,'0')}`)) n++;
  data.items.push({...sample.items[0],code:`DEMO-${String(n).padStart(3,'0')}`,barcode:`880000${String(n).padStart(6,'0')}`});
  return data;
}));
$('remove').addEventListener('click', () => change(data => { data.items.pop(); return data; }));
$('import').addEventListener('change', async () => {
  dirty();
  const ticket = importTicket, file = $('import').files[0];
  if (!file) return;
  try {
    if (file.size > MAX_BYTES) throw new Error('JSON file must not exceed 1 MiB.');
    const text = await file.text();
    if (ticket !== importTicket) return;
    editor(parse(text)); await update();
  } catch (error) { if (ticket === importTicket) failure(error); }
  finally { $('import').value = ''; }
});
$('export').addEventListener('click', () => {
  try {
    const data = parse($('editor').value);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2) + '\n'],{type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'meridian-purchase-order.json';
    link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  } catch (error) { dirty(); failure(error); }
});
$('print').addEventListener('click', () => { if (window.MERIDIAN_READY && !running && !queued) window.print(); });
// Public bounded test/edit entry point, not an alternate pagination API.
window.Meridian = {setData(data) { editor(validate(data)); return update(); }, update};
window.addEventListener('load', () => { editor(sample); void update(); }, {once:true});
