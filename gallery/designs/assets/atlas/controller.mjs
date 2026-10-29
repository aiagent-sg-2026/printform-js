import {fixture, defaults} from './fixtures.mjs';
import {model} from './model.mjs';
import {render} from './template.mjs';
const $ = id => document.getElementById(id);
const sample = JSON.parse($('sample-data').textContent), artwork = JSON.parse($('artwork-data').textContent);
let revision = 0, queued = false, running = false;
function status(kind, message) {
  document.body.dataset.state = kind;
  window.ATLAS_READY = window.__printFormProcessed = kind === 'ready';
  $('print').disabled = kind !== 'ready';
  $('status').setAttribute('role', kind === 'error' ? 'alert' : 'status');
  $('status').textContent = message;
}
function state() {
  return Object.fromEntries(Object.keys(defaults).map(key => [key, ['containers', 'count'].includes(key) ? Number($(key).value) : $(key).value]));
}
function geometry() {
  const pages = [...$('preview').querySelectorAll('.printform_page')];
  if (!pages.length) throw new Error('No output pages were produced');
  for (const p of pages) {
    const b = p.getBoundingClientRect();
    for (const n of [p, ...p.querySelectorAll('table,td,th,img,.masthead,.final-record')]) {
      const r = n.getBoundingClientRect();
      if (r.left < b.left - 1 || r.right > b.right + 1 || r.bottom > b.bottom + 1 || n.scrollWidth > n.clientWidth + 1) throw new Error('Content exceeds A4 landscape. Correct the oversized source layout and rebuild.');
    }
  }
  return pages.length;
}
function engine() {
  if (window.PrintForm) return;
  const script = document.createElement('script'); script.textContent = $('engine-source').textContent; document.body.append(script);
}
async function update() {
  revision++; queued = true; window.ATLAS_RESULT = null;
  status('pending', 'Measuring the latest local selection with PrintForm…');
  if (running) return;
  running = true;
  try {
    while (queued) {
      queued = false;
      const current = revision, selected = state();
      try {
        const report = model(fixture(sample, selected), selected.basis, selected.mode);
        const form = render(report, selected, artwork);
        // Clean source only: never paginate or patch processed clones.
        $('preview').replaceChildren(form);
        await Promise.all([document.fonts.load('14px AtlasSans'), document.fonts.load('600 14px AtlasSans'), document.fonts.load('14px AtlasCJK')]);
        await document.fonts.ready;
        await Promise.all([...form.querySelectorAll('img')].map(img => img.decode()));
        engine();
        window.ATLAS_FORMAT_REPORT = await PrintForm.formatAll({force:true});
        if (current !== revision || queued) continue;
        const pages = geometry();
        window.ATLAS_RESULT = {state:selected, totals:report.totals, partial:report.partial, weightGrams:report.weightGrams, pages, revision:current};
        window.ATLAS_ERROR = null;
        status('ready', `${report.containers.length} containers · ${report.data.lines.length} lines · ${selected.mode} / ${selected.basis} · ${report.partial ? 'Partial landed subtotal; unresolved charges excluded' : 'Allocation complete'}${report.weightGrams === null ? ' · Weight incomplete' : ''} · ${pages} A4 landscape pages · Preview is current.`);
      } catch (error) {
        if (current !== revision || queued) continue;
        $('preview').replaceChildren(); window.ATLAS_RESULT = null;
        window.ATLAS_ERROR = [error.message, ...(error.errors || []).map(e => e.message)].join(': ');
        status('error', `Cannot format: ${window.ATLAS_ERROR} Reset the sample or correct the local source and rebuild. Printing is disabled.`);
      }
    }
  } finally { running = false; }
}
for (const key of Object.keys(defaults)) $(key).addEventListener('change', () => void update());
$('reset').addEventListener('click', () => { for (const [key, value] of Object.entries(defaults)) $(key).value = String(value); void update(); });
$('print').addEventListener('click', () => { if (window.ATLAS_READY && !running && !queued) window.print(); });
window.addEventListener('load', () => void update(), {once:true});
