import {fixture} from './fixtures.mjs';
import {reconcile} from './reconcile.mjs';
import {render} from './template.mjs';
const $ = id => document.getElementById(id);
const sample = JSON.parse($('sample-data').textContent), logo = JSON.parse($('logo-data').textContent);
let revision = 0, queued = false, running = false;
function status(kind, message) {
  document.body.dataset.state = kind;
  window.ASTER_READY = window.__printFormProcessed = kind === 'ready';
  $('print').disabled = kind !== 'ready';
  $('status').setAttribute('role', kind === 'error' ? 'alert' : 'status');
  $('status').textContent = message;
}
function state() {
  return {count:Number($('count').value), matched:$('scenario').value === 'matched', detail:$('detail').value, notes:$('notes').value};
}
function geometry() {
  const pages = [...$('preview').querySelectorAll('.printform_page')];
  if (!pages.length) throw new Error('No output pages were produced');
  for (const p of pages) {
    const b = p.getBoundingClientRect();
    for (const n of [p, ...p.querySelectorAll('table,td,th,img,.opening,.final-record')]) {
      const r = n.getBoundingClientRect();
      if (r.left < b.left - 1 || r.right > b.right + 1 || r.bottom > b.bottom + 1 || n.scrollWidth > n.clientWidth + 1) throw new Error('Content exceeds the A4 landscape page. Reduce the oversized atomic asset or correct its source layout.');
    }
  }
  return pages.length;
}
async function engine() {
  if (window.PrintForm) return;
  const script = document.createElement('script'); script.textContent = $('engine-source').textContent; document.body.append(script);
}
async function update() {
  revision++; queued = true;
  status('pending', 'Measuring the latest selection with PrintForm…');
  if (running) return;
  running = true;
  try {
    while (queued) {
      queued = false;
      const current = revision, selected = state();
      try {
        const report = reconcile(fixture(sample, selected.count, selected.matched));
        const {form, display} = render(report, selected, logo);
        // Only our owned surface is replaced. Processed clones are never edited.
        $('preview').replaceChildren(form);
        await Promise.all([document.fonts.load('14px AsterSans'), document.fonts.load('600 14px AsterSans'), document.fonts.load('14px AsterCJK')]);
        await document.fonts.ready;
        await Promise.all([...form.querySelectorAll('img')].map(img => img.decode()));
        await engine();
        window.ASTER_FORMAT_REPORT = await PrintForm.formatAll({force:true});
        if (current !== revision || queued) continue;
        const pages = geometry();
        window.ASTER_RESULT = {state:selected, totals:report.totals, pages, display, revision:current};
        window.ASTER_ERROR = null;
        status('ready', `${report.cases.length} review cases · Showing ${display.shown} of ${selected.count} PO lines, plus ${display.unmatched} unmatched invoice lines · Full document totals · ${pages} A4 landscape pages · Preview is current.`);
      } catch (error) {
        if (current !== revision || queued) continue;
        $('preview').replaceChildren();
        window.ASTER_ERROR = [error.message, ...(error.errors || []).map(e => e.message)].join(': ');
        status('error', `Cannot format: ${window.ASTER_ERROR} Reset the sample or correct the local authoring source and rebuild. Printing is disabled.`);
      }
    }
  } finally { running = false; }
}
for (const id of ['count', 'scenario', 'detail', 'notes']) $(id).addEventListener('change', () => void update());
$('reset').addEventListener('click', () => {
  $('count').value = '24'; $('scenario').value = 'review'; $('detail').value = 'all'; $('notes').value = 'standard'; void update();
});
$('print').addEventListener('click', () => { if (window.ASTER_READY && !running && !queued) window.print(); });
window.addEventListener('load', () => void update(), {once:true});
