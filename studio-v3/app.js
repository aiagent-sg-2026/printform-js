import { newProject, designOf, sampleData } from './model.js';
import { createBus, editProject, designOperations, formDesign, alterFields } from './controller.js';
import { icon } from './icons.js';
import { leftView, rightView, SAMPLES } from './views.js';
import { PaperPreview } from './preview.js';
import { readProject, saveProject, filenameFor, download, exportProject } from './file-io.js';
import { inspectProject } from './validation.js';

const $ = selector => document.querySelector(selector);
const state = {mode:'design',selected:'items',tab:'properties',sample:'erp',report:null,matrix:{},dirty:false,dataDraft:null,running:false,runId:0};
let bus, erpData, displayed, zoom = 1, pageIndex = 0, editQueue = Promise.resolve();
const paper = new PaperPreview($('#preview-frame'), (report,view) => {
  state.report = report;
  if (report.status === 'ready') {
    paper.thumbnails($('#thumbnails'),view.pages,view.styles,goPage);
    resizePaper(); goPage(Math.min(pageIndex,view.pages.length-1), false); paper.send('select',{id:state.selected});
  } else $('#thumbnails').replaceChildren();
  $('#page-count').textContent = report.status === 'ready' ? `${report.metrics.logicalPages} pages` : 'Render blocked';
  syncControls();
  if (state.mode === 'validate') renderPanels();
  else updateQuality();
  const q = inspectProject(displayed,report);
  status(q.ready ? `${q.metrics.rows} rows · ${q.metrics.logicalPages} pages · current layout passed` : q.errors[0]?.message || 'Render blocked');
}, selection => {
  state.selected = selection.id; pageIndex = Math.max(0,selection.page); renderPanels();
});

function status(text) { $('#status').textContent = text; }
function syncControls() {
  const q = inspectProject(bus.project,state.report);
  $('[data-action=undo]').disabled = !bus.history.canUndo;
  $('[data-action=redo]').disabled = !bus.history.canRedo;
  for (const action of ['print','export']) $(`[data-action=${action}]`).disabled = !q.ready || state.running;
  $('#revision').textContent = `r${bus.revision}${state.dirty ? ' · unsaved' : ''}`;
  $('#document-name').value = bus.project.manifest.title;
}
function renderPanels() {
  $('#left-panel').innerHTML = leftView(bus.project,state);
  $('#right-panel').innerHTML = rightView(bus.project,state);
  document.querySelectorAll('[data-mode]').forEach(n => n.setAttribute('aria-current',n.dataset.mode === state.mode ? 'page' : 'false'));
}
function updateQuality() {
  const current = $('#right-panel details');
  if (!current) return;
  const open = current.open;
  const holder = document.createElement('div'); holder.innerHTML = rightView(bus.project,state);
  const next = holder.querySelector('details'); if (next) { next.open = open; current.replaceWith(next); }
}
function resizePaper() {
  const choice = $('#zoom').value;
  const available = $('#paper-scroll').clientWidth - (window.innerWidth < 850 ? 24 : 48);
  zoom = choice === 'fit' ? Math.min(1, Math.max(.15,available/794), Math.max(.15,($('#paper-scroll').clientHeight - 48)/1123)) : Number(choice);
  $('#preview-frame').style.transform = `scale(${zoom})`;
  $('#paper-wrap').style.width = `${794 * zoom}px`;
  $('#paper-wrap').style.height = `${(paper.height || 1123) * zoom}px`;
}
function goPage(index, scroll = true) {
  pageIndex = Math.max(0,Math.min(index,paper.pages.length-1));
  if (scroll && paper.pages[pageIndex]) $('#paper-scroll').scrollTop = paper.pages[pageIndex].top * zoom;
  document.querySelectorAll('[data-page]').forEach(n => { n.classList.toggle('active',Number(n.dataset.page) === pageIndex); n.setAttribute('aria-current',Number(n.dataset.page) === pageIndex ? 'page' : 'false'); });
}
async function render(project = bus.project) {
  displayed = structuredClone(project); state.report = null; syncControls(); status('Measuring the real HTML layout…');
  return paper.render(displayed);
}
function stopRun() { state.runId += 1; state.running = false; }
async function changed() {
  stopRun(); state.dirty = true; state.matrix = {}; renderPanels(); syncControls(); await render();
}
async function mutate(operations, reason) { await editProject(bus,operations,reason); await changed(); }
function queueEdit(work) {
  const context = bus;
  editQueue = editQueue.then(() => { if (bus !== context) throw new Error('A queued edit belonged to the previous document.'); return work(); }).catch(e => status(e.message));
  return editQueue;
}
function install(project) {
  stopRun(); bus?.deactivate(); paper.cancel(); bus = createBus(project); erpData = structuredClone(project.sampleData);
  Object.assign(state,{selected:'items',sample:'erp',report:null,matrix:{},dirty:false,dataDraft:null});
  pageIndex = 0; renderPanels(); syncControls(); render();
}
async function switchSample(id) {
  stopRun();
  const data = id === 'erp' ? erpData : sampleData(designOf(bus.project).type,id === 'long' ? 45 : Number(id),id === 'long');
  state.sample = id; state.dataDraft = null;
  await mutate([{type:'replace_sample_data',value:data}],`sample: ${id}`);
}
async function validateAll() {
  if (state.running) { stopRun(); paper.cancel(); renderPanels(); await render(); return; }
  const run = ++state.runId; state.running = true; state.matrix = {}; renderPanels(); syncControls();
  const base = structuredClone(bus.project);
  for (const [id] of SAMPLES.filter(([id]) => id !== 'erp')) {
    const candidate = {...base,sampleData:sampleData(designOf(base).type,id === 'long' ? 45 : Number(id),id === 'long')};
    const report = await render(candidate);
    if (run !== state.runId) return;
    state.matrix[id] = inspectProject(candidate,report); renderPanels();
  }
  if (run !== state.runId) return;
  state.running = false; renderPanels(); await render();
}
async function action(name) {
  if (name === 'undo' || name === 'redo') { await bus.navigateHistory(name,bus.revision); state.dataDraft = null; await changed(); }
  else if (name === 'new') { $('#new-warning').textContent = state.dirty ? 'Starting another form discards unsaved changes. Save first if you want to keep them.' : 'Choose a complete starter or a blank form.'; $('#new-dialog').showModal(); }
  else if (name === 'cancel-new') $('#new-dialog').close();
  else if (name === 'open') { if (!state.dirty || confirm('Open another file and discard unsaved changes?')) $('#open-file').click(); }
  else if (name === 'save') { download(saveProject(bus.project),`${filenameFor(bus.project)}.printform.json`,'application/json'); state.dirty = false; syncControls(); status('Saved editable template file, including the active sample data.'); }
  else if (name === 'export') {
    const context = bus, revision = bus.revision, project = structuredClone(bus.project), report = state.report;
    const result = await exportProject(project,report);
    if (bus !== context || bus.revision !== revision || state.running) throw new Error('The form changed while exporting. Export the current revision again.');
    download(result.html,`${filenameFor(project)}.html`,'text/html'); status('Exported standalone HTML. Review every page in native print preview.');
  }
  else if (name === 'print') { if (inspectProject(bus.project,state.report).ready && !state.running) paper.send('print'); }
  else if (name === 'preview') { document.body.classList.toggle('preview-only'); $('[data-action=preview]').setAttribute('aria-pressed',document.body.classList.contains('preview-only')); resizePaper(); }
  else if (name === 'previous' || name === 'next') goPage(pageIndex + (name === 'next' ? 1 : -1));
  else if (name === 'go-data') { state.mode = 'data'; renderPanels(); }
  else if (name === 'properties' || name === 'binding') { state.tab = name; renderPanels(); }
  else if (name === 'rerender') { stopRun(); await render(); }
  else if (name === 'validate-all') await validateAll();
  else if (['add-field','remove-field','move-up','move-down'].includes(name)) {
    const altered = alterFields(bus.project,state.selected,name); state.selected = altered.selected;
    await mutate(designOperations(bus.project,altered.design),name);
  }
}
document.querySelectorAll('[data-icon]').forEach(n => n.insertAdjacentHTML('afterbegin',icon(n.dataset.icon)));
document.addEventListener('click', e => {
  const select = e.target.closest('[data-select]');
  if (select) { state.selected = select.dataset.select; renderPanels(); paper.send('select',{id:state.selected}); return; }
  const mode = e.target.closest('[data-mode]');
  if (mode) { state.mode = mode.dataset.mode; renderPanels(); return; }
  const sample = e.target.closest('[data-sample]');
  if (sample) { queueEdit(() => switchSample(sample.dataset.sample)); return; }
  const template = e.target.closest('[data-template]');
  if (template) { $('#new-dialog').close(); install(newProject(template.dataset.template === 'blank' ? 'invoice' : template.dataset.template,template.dataset.template === 'blank')); return; }
  const issue = e.target.closest('[data-issue]');
  if (issue) { if (issue.dataset.issue) { state.selected = issue.dataset.issue; state.mode = 'design'; renderPanels(); paper.send('select',{id:state.selected}); } return; }
  const control = e.target.closest('[data-action]');
  if (control && !control.disabled) {
    // Long validation may be stopped or superseded immediately by navigation.
    const name = control.dataset.action;
    if (['validate-all','rerender','new','cancel-new','open','preview','next','previous','properties','binding','go-data'].includes(name)) action(name).catch(e => status(e.message));
    else queueEdit(() => action(name));
  }
});
document.addEventListener('submit', e => {
  const form = e.target.closest('[data-form]'); if (!form) return; e.preventDefault();
  const kind = form.dataset.form, context = bus, selected = state.selected;
  const dataSource = kind === 'data' ? (state.dataDraft ?? $('#data-json').value) : null;
  queueEdit(async () => {
    if (bus !== context) throw new Error('The document changed. Apply the current form again.');
    if (kind === 'data') {
      const source = dataSource;
      if (new TextEncoder().encode(source).length > 2 * 1024 * 1024) throw new Error('Sample data exceeds the 2 MB limit.');
      const data = JSON.parse(source);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Sample data must be a JSON object.');
      erpData = structuredClone(data); state.sample = 'erp'; state.dataDraft = null;
      await mutate([{type:'replace_sample_data',value:data}],'ERP sample data');
    } else if (kind === 'locale') {
      const values = new FormData(form);
      await mutate([{type:'set_manifest_value',path:'/locale',value:values.get('locale')},{type:'set_manifest_value',path:'/currency',value:values.get('currency')}],'locale & currency');
    } else await mutate(designOperations(bus.project,formDesign(bus.project,selected,form,kind)),`edit ${kind}`);
  });
});
document.addEventListener('input', e => { if (e.target.id === 'data-json') state.dataDraft = e.target.value; });
$('#document-name').addEventListener('change', e => { const title = e.target.value.trim(); if (title) queueEdit(() => mutate([{type:'set_manifest_value',path:'/title',value:title}],'template name')); });
$('#open-file').addEventListener('change', async e => {
  const file = e.target.files[0], context = bus; e.target.value = ''; if (!file) return;
  try { const source = await file.text(); if (bus !== context) throw new Error('The document changed before the file was read. Open it again.'); install(readProject(source,file.name)); status('Opened editable v3 form.'); } catch (error) { status(error.message); }
});
$('#zoom').onchange = resizePaper; window.addEventListener('resize',resizePaper);
window.addEventListener('beforeunload', e => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.isComposing) return;
  if (e.key.toLowerCase() === 's') { e.preventDefault(); queueEdit(() => action('save')); }
  if (e.key.toLowerCase() === 'z' && !e.target.closest('input,textarea')) { e.preventDefault(); queueEdit(() => action(e.shiftKey ? 'redo' : 'undo')); }
});
install(newProject());
