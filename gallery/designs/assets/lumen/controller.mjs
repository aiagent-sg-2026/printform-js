import {fixture, defaults} from './fixtures.mjs';
import {summarize} from './model.mjs';
import {render} from './template.mjs';
const $ = id => document.getElementById(id);
const artwork = JSON.parse($('artwork-data').textContent);
let revision = 0, queued = false, running = false;
function status(kind, message) {
  document.body.dataset.state = kind;
  window.LUMEN_READY = window.__printFormProcessed = kind === 'ready';
  $('print').disabled = kind !== 'ready';
  $('status').setAttribute('role', kind === 'error' ? 'alert' : 'status');
  $('status').textContent = message;
}
function state() { return Object.fromEntries(Object.keys(defaults).map(k => [k, ['domains', 'terms'].includes(k) ? Number($(k).value) : $(k).value])); }
function geometry() {
  const pages = [...$('preview').querySelectorAll('.printform_page')];
  if (!pages.length) throw new Error('No pages were produced');
  for (const p of pages) {
    const b = p.getBoundingClientRect();
    for (const n of [p, ...p.querySelectorAll('table,td,th,img,svg')]) {
      const r = n.getBoundingClientRect();
      if (r.left < b.left - 1 || r.right > b.right + 1 || r.bottom > b.bottom + 1 || n.scrollWidth > n.clientWidth + 1) throw new Error('Source exceeds A4 portrait; correct the oversized source element');
    }
  }
  return pages.length;
}
function engine() {
  if (window.PrintForm) return;
  const script = document.createElement('script'); script.textContent = $('engine-source').textContent; document.body.append(script);
}
async function update() {
  revision++; queued = true; window.LUMEN_RESULT = null;
  status('pending', 'Measuring the latest fictional source with PrintForm…');
  if (running) return;
  running = true;
  try {
    while (queued) {
      queued = false;
      const current = revision, selected = state();
      try {
        // Existing Gallery JSON binding convention. Always re-read, never mutate the source.
        const data = fixture(JSON.parse($('sample-data').textContent), selected), summary = summarize(data);
        const form = render(data, summary, selected, artwork);
        $('preview').replaceChildren(form);
        await Promise.all([document.fonts.load('14px LumenSans'), document.fonts.load('600 14px LumenSans'), document.fonts.load('14px LumenCJK')]);
        await document.fonts.ready;
        await Promise.all([...form.querySelectorAll('img')].map(img => img.decode()));
        engine(); window.LUMEN_FORMAT_REPORT = await PrintForm.formatAll({force:true});
        if (current !== revision || queued) continue;
        const pages = geometry();
        window.LUMEN_RESULT = {state:selected, summary, pages, revision:current}; window.LUMEN_ERROR = null;
        status('ready', `${summary.observedRecordCount} observed · ${summary.plannedRecordCount} planned · ${summary.evidenceCoverage.numerator}/${summary.evidenceCoverage.denominator} documented cells · ${pages} A4 portrait pages · Preview is current.`);
      } catch (error) {
        if (current !== revision || queued) continue;
        $('preview').replaceChildren(); window.LUMEN_RESULT = null;
        window.LUMEN_ERROR = [error.message, ...(error.errors || []).map(e => e.message)].join(': ');
        status('error', `Cannot format: ${window.LUMEN_ERROR}. Correct the bound JSON or reset valid source. Printing is disabled.`);
      }
    }
  } finally { running = false; }
}
for (const key of Object.keys(defaults)) $(key).addEventListener('change', () => void update());
$('reset').addEventListener('click', () => { for (const [key, value] of Object.entries(defaults)) $(key).value = String(value); void update(); });
$('print').addEventListener('click', () => { if (window.LUMEN_READY && !running && !queued) window.print(); });
window.addEventListener('load', () => void update(), {once:true});
