import { newProject, designOf, sampleData, newDemoProject, setupDemoTemplatePicker } from './demo-templates.js';
import { createBus, editProject, replaceData, designOperations, formDesign, alterFields, importRasterAsset } from './controller.js';
import { icon } from './icons.js';
import { leftView, rightView, SAMPLES } from './views.js';
import { PaperPreview } from './preview.js';
import { readProject, saveProject, filenameFor, download, exportProject } from './file-io.js';
import { inspectProject } from './validation.js';
import { DemoDatabase } from './database-controller.js';
import { databaseList } from './database-view.js';
import { FormDrafts } from './form-drafts.js';
import { sourceLabel } from './data-provenance.js';
import { parseSampleJSON } from './json-error.js';
import { CanvasControls } from './canvas-controls.js';
import { AIPanel } from './ai-panel.js';
import { AIElementTags } from './ai-element-tags.js';
import { restoreZoom, persistZoom } from './zoom-preference.js';
import { setupUpdates } from './update.js';
import { createUpdateWork } from './update-work.js';
import { pageDimensions, pageSettings } from './design-authoring.js';
import { syncPageControls, navigatePages } from './page-navigation.js';
const $ = selector => document.querySelector(selector); setupDemoTemplatePicker();
const state = {mode:'design',selected:'items',tab:'properties',sample:'erp',report:null,matrix:{},dirty:false,dataDraft:null,running:false,runId:0,collapsed:{},search:'',jsonError:'',fileReads:0};
let bus, displayed, zoom = 1, pageIndex = 0, editQueue = Promise.resolve();
const database = new DemoDatabase({
  project:() => bus?.project, state:() => state, context:() => bus,
  render:renderPanels, busy:syncControls, download,
  apply:async (data,reference,context,source = null,title = undefined) => {
    if (context !== bus) throw new Error('Dataset was saved, but the document changed. Load it into the intended form again.');
    state.dataDraft = null; await replaceData(bus,data,'erp',reference,source,title); await changed();
  }
});
const drafts = new FormDrafts({
  selection:() => state.selected, context:() => bus, render:renderPanels,
  externalPending:() => Boolean(database.draft), clearJSON:() => { state.dataDraft = null; },
  discardExternal:() => database.resetDraft(),
  apply:snapshot => queueEdit(() => applyForm(snapshot)),
  applyExternal:() => queueDatabase('apply-draft',{}),
  stay:() => {
    ai.suspend();
    if (drafts.focusMeta?.key === 'data:global') { database.group = 'json'; database.render(); drafts.restore(); }
    else if (drafts.focusMeta?.external && !drafts.focus?.isConnected) {
      const parts = (drafts.focusMeta.pointer || '').split('/'); database.group = parts[1] || 'items';
      if (database.group === 'items') database.rowPage = Math.floor(Number(parts[2] || 0)/25);
      database.render(); drafts.restore();
    }
    paper.send('select',{id:state.selected}); canvas.focusDraft(drafts.focus);
  }
});
const paper = new PaperPreview($('#preview-frame'), (report,view) => {
  state.report = report; resizePaper();
  if (report.status === 'ready') {
    paper.thumbnails($('#thumbnails'),view.pages,view.styles,goPage);
    goPage(Math.min(pageIndex,view.pages.length-1), false); paper.send('select',{id:state.selected});
  } else $('#thumbnails').replaceChildren();
  $('#page-count').textContent = report.status === 'ready' ? `Page ${pageIndex+1} / ${report.metrics.logicalPages}` : 'Render blocked';
  syncControls();
  if (state.mode === 'validate') renderPanels();
  else updateQuality();
  const q = inspectProject(displayed,report);
  status(q.ready ? `${q.metrics.rows} rows · ${q.metrics.logicalPages} pages · current layout passed` : q.errors[0]?.message || 'Render blocked');
}, selection => {
  drafts.guard(() => { state.selected = selection.id; goPage(Math.max(0,selection.page),false); renderPanels(); canvas.selectionMade(); }).catch(e=>status(e.message));
});
const canvas = new CanvasControls({resize:resizePaper,guard:work => drafts.guard(work),report:status,context:()=>bus,upload:(file,target)=> {const context = bus; ++state.fileReads; return queueEdit(async()=> {const design = await importRasterAsset(context.project,file,target); if (bus !== context) throw new Error('The document changed. Upload the image again.'); await mutate(designOperations(bus.project,design),'embedded image');}).finally(()=>--state.fileReads);}});
const elementTags = new AIElementTags({bus:()=>bus,selection:()=>state.selected,guard:work=>drafts.guard(work),report:status,onChange:()=>ai.contextChanged(true),open:()=> {canvas.close(false); ai.show();},highlight:id=>canvas.highlightElement(paper,id || state.selected),select:id=> {state.selected = id; state.mode = 'design'; renderPanels(); goPage(canvas.elementPage(paper,id)); canvas.highlightElement(paper,id); if (innerWidth <= 900) ai.suspend();}});
const ai = new AIPanel({bus:()=>bus,selection:()=>state.selected,elementTags,facts:()=>paper.factsFor(bus.project),guard:work=>drafts.guard(work),sync:syncControls,
  preview:async project=> { stopRun(); state.mode = 'design'; renderPanels(); return render(project); },restore:()=>render(),
  commit:(proposal,generation)=>queueEdit(async()=> { ai.assertCurrent(proposal,generation); const context = bus; await editProject(context,designOperations(context.project,proposal.design),'AI layout suggestion'); const revision = context.revision; if (bus === context) await changed(); return {bus:context,revision}; },false),
  undo:check=>queueEdit(async()=> { check(); await action('undo'); },false)
});
restoreZoom($('#zoom'));
const updateWork = createUpdateWork({getBus:()=>bus,state,database,drafts,ai,install,renderPanels,syncControls,render,settle:()=>editQueue});
function status(text) { $('#status').textContent = text; }
function syncControls() {
  if (!bus) return;
  syncPageControls(document,pageIndex,paper.pages.length,state.report?.status === 'ready');
  const q = inspectProject(bus.project,state.report);
  $('[data-action=undo]').disabled = !bus.history.canUndo;
  $('[data-action=redo]').disabled = !bus.history.canRedo;
  for (const action of ['print','export']) $(`[data-action=${action}]`).disabled = !q.ready || state.running || ai.viewing || database.busy || database.pending;
  $('#revision').textContent = `r${bus.revision}${state.dirty ? ' · unsaved template' : ''}`;
  $('#document-name').value = bus.project.manifest.title;
  $('#data-source').textContent = sourceLabel(bus.project);
  for (const name of ['new','open']) $(`[data-action=${name}]`).disabled = database.busy || database.pending;
  document.querySelectorAll('[data-template]').forEach(n => { n.disabled = database.busy || database.pending; });
}
function renderPanels() {
  elementTags.contextChanged(); ai.contextChanged();
  const leftScroll = $('#left-panel').scrollTop, rightScroll = $('#right-panel').scrollTop;
  $('#left-panel').innerHTML = (state.mode === 'data' ? databaseList(database,bus.project) : '') + leftView(bus.project,state);
  $('#right-panel').innerHTML = rightView(bus.project,state);
  document.querySelectorAll('[data-mode]').forEach(n => n.setAttribute('aria-current',n.dataset.mode === state.mode ? 'page' : 'false'));
  database.render();
  drafts.restore();
  $('#left-panel').scrollTop = leftScroll; $('#right-panel').scrollTop = rightScroll;
  elementTags.updateAddButtons();
}
function updateQuality() {
  const current = $('#right-panel details.quality-panel');
  if (!current) return;
  const open = current.open;
  const holder = document.createElement('div'); holder.innerHTML = rightView(bus.project,state);
  const next = holder.querySelector('details.quality-panel'); if (next) { next.open = open; current.replaceWith(next); }
}
function resizePaper() {
  const choice = $('#zoom').value, design = displayed?.manifest.studioV3 || bus?.project.manifest.studioV3, {width,height} = design ? pageDimensions(design) : {width:794,height:1123};
  const available = $('#paper-scroll').clientWidth - (window.innerWidth < 850 ? 24 : 48);
  zoom = choice === 'fit' ? Math.min(Math.max(.15,available/width), Math.max(.15,($('#paper-scroll').clientHeight - 48)/height)) : choice === 'width' ? Math.max(.15,available/width) : Number(choice);
  zoom = Math.max(.15,Math.min(2,Number.isFinite(zoom) ? zoom : 1));
  $('#preview-frame').style.transform = `scale(${zoom})`; $('#preview-frame').style.width = `${width}px`;
  $('#preview-frame').dataset.zoom = String(zoom); $('#paper-kind').textContent = design ? pageSettings(design).paper : 'A4'; $('#paper-dimensions').textContent = `${Math.round(width/96*25.4)} × ${Math.round(height/96*25.4)} mm`;
  $('#paper-wrap').style.width = `${width * zoom}px`;
  $('#paper-wrap').style.height = `${(paper.height || height) * zoom}px`;
  if (paper.pages[pageIndex]) $('#paper-scroll').scrollTop = paper.pages[pageIndex].top*zoom;
}
function goPage(index, scroll = true) {
  pageIndex = navigatePages(document,paper.pages,index,{zoom,scroll,ready:state.report?.status === 'ready'});
}
async function render(project = bus.project) {
  displayed = structuredClone(project); state.report = null; resizePaper(); syncControls(); status('Measuring the real HTML layout…');
  return paper.render(displayed,{committed:project === bus.project});
}
function stopRun() { state.runId += 1; state.running = false; }
async function changed() {
  ai.invalidate(); stopRun(); state.sample = bus.project.studioV3Session.sample; state.dirty = true; state.matrix = {}; renderPanels(); syncControls(); await render();
}
async function mutate(operations, reason) { await editProject(bus,operations,reason); await changed(); }
function queueEdit(work,reportOnly = true) {
  const context = bus;
  const result = editQueue.then(() => { if (bus !== context) throw new Error('A queued edit belonged to the previous document.'); return work(); });
  editQueue = result.catch(e => status(e.message));
  return reportOnly ? editQueue : result;
}
function queueDatabase(name,target) {
  if (database.pending) return;
  database.pending = true; syncControls(); database.render();
  return queueEdit(() => database.action(name,target)).finally(() => {
    database.pending = false; syncControls(); renderPanels();
  });
}
function install(project, reference = null, source = 'imported-data') {
  stopRun(); bus?.deactivate(); paper.cancel(); bus = createBus(project,reference,source); ai.invalidate(); database.resetDraft(); drafts.clear();
  Object.assign(state,{selected:'items',sample:'erp',report:null,matrix:{},dirty:false,dataDraft:null,collapsed:{},search:'',jsonError:''});
  pageIndex = 0; renderPanels(); syncControls(); render();
}
async function switchSample(id) {
  if (!database.guardDraft()) return;
  stopRun();
  const data = id === 'erp' ? bus.project.studioV3Session.erpData : sampleData(designOf(bus.project).type,id === 'long' ? 45 : Number(id),id === 'long');
  state.dataDraft = null;
  await replaceData(bus,data,id); await changed();
}
async function validateAll() {
  if (state.running) { stopRun(); paper.cancel(); renderPanels(); await render(); return; }
  ai.invalidate(); const run = ++state.runId; state.running = true; state.matrix = {}; renderPanels(); syncControls();
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
  if (name === 'undo' || name === 'redo') { if (!database.guardDraft()) return; await bus.navigateHistory(name,bus.revision); state.dataDraft = null; await changed(); }
  else if (name === 'new') { $('#new-warning').textContent = state.dirty || database.draft || state.dataDraft !== null ? 'Starting another form discards unsaved form, table and JSON edits. Save first to keep them.' : 'Choose a complete starter or a blank form.'; $('#new-dialog').showModal(); }
  else if (name === 'cancel-new') $('#new-dialog').close();
  else if (name === 'open') { if (!(state.dirty || database.draft || state.dataDraft !== null) || confirm('Open another file and discard unsaved form, table and JSON edits? Saved datasets are retained.')) $('#open-file').click(); }
  else if (name === 'save') { download(saveProject(bus.project),`${filenameFor(bus.project)}.printform.json`,'application/json'); state.dirty = false; syncControls(); status('Saved editable template file, including the active sample data.'); }
  else if (name === 'export') {
    const context = bus, revision = bus.revision, project = structuredClone(bus.project), report = state.report;
    const result = await exportProject(project,report);
    if (bus !== context || bus.revision !== revision || state.running) throw new Error('The form changed while exporting. Export the current revision again.');
    download(result.html,`${filenameFor(project)}.html`,'text/html'); status('Exported standalone HTML. Review every page in native print preview.');
  }
  else if (name === 'print') { if (inspectProject(bus.project,state.report).ready && !state.running && !ai.viewing) paper.send('print'); }
  else if (name === 'preview') { document.body.classList.toggle('preview-only'); $('[data-action=preview]').setAttribute('aria-pressed',document.body.classList.contains('preview-only')); database.render(); resizePaper(); }
  else if (name === 'previous' || name === 'next') goPage(pageIndex + (name === 'next' ? 1 : -1));
  else if (name === 'go-data') { state.mode = 'data'; renderPanels(); }
  else if (name === 'go-style') { state.mode = 'design'; state.selected = 'global-style'; state.tab = 'properties'; renderPanels(); }
  else if (name === 'properties' || name === 'binding') { state.tab = name; renderPanels(); }
  else if (name === 'rerender') { ai.invalidate(); stopRun(); await render(); }
  else if (name === 'validate-all') await validateAll();
  else if (['add-field','remove-field','move-up','move-down'].includes(name)) {
    const altered = alterFields(bus.project,state.selected,name); state.selected = altered.selected;
    await mutate(designOperations(bus.project,altered.design),name);
  }
}
document.querySelectorAll('[data-icon]').forEach(n => n.insertAdjacentHTML('afterbegin',icon(n.dataset.icon)));
document.addEventListener('click', e => {
  const path = e.target.closest('[data-tree-path]');
  if (path && !path.disabled) {
    const input = $('#right-panel').querySelector(path.dataset.treeScope === 'collection' ? '[name=collection]' : '[name=pointer]');
    if (input) { input.value = path.dataset.treePath; drafts.capture(input); canvas.focusDraft(input); }
    return;
  }
  const fold = e.target.closest('[data-fold]');
  if (fold) { state.collapsed[fold.dataset.fold] = !state.collapsed[fold.dataset.fold]; renderPanels(); return; }
  const dataset = e.target.closest('[data-db-select]');
  if (dataset) { drafts.guard(() => queueDatabase('choose',{id:dataset.dataset.dbSelect})).catch(e=>status(e.message)); return; }
  const dbGroup = e.target.closest('[data-db-group]');
  if (dbGroup && !dbGroup.disabled) { drafts.guard(() => { database.group = dbGroup.dataset.dbGroup; database.screen = 'database'; database.render(); drafts.restore(); },false).catch(e=>status(e.message)); return; }
  const dbAction = e.target.closest('[data-db-action]');
  if (dbAction && !dbAction.disabled) { drafts.guard(() => queueDatabase(dbAction.dataset.dbAction,dbAction),false).catch(e=>status(e.message)); return; }
  const select = e.target.closest('[data-select]');
  if (select) { drafts.guard(() => { state.selected = select.dataset.select; renderPanels(); paper.send('select',{id:state.selected}); canvas.selectionMade(); }).catch(e=>status(e.message)); return; }
  const mode = e.target.closest('[data-mode]');
  if (mode) { drafts.guard(() => { state.mode = mode.dataset.mode; if (state.mode === 'data') database.screen = 'database'; canvas.close(false); renderPanels(); }).catch(e=>status(e.message)); return; }
  const sample = e.target.closest('[data-sample]');
  if (sample) { drafts.guard(() => queueEdit(() => switchSample(sample.dataset.sample))).catch(e=>status(e.message)); return; }
  const template = e.target.closest('[data-template],[data-demo-template]');
  if (template && !template.disabled) { $('#new-dialog').close(); const next = database.starting(template.dataset.demoTemplate ? newDemoProject(template.dataset.demoTemplate) : newProject(template.dataset.template === 'blank' ? 'invoice' : template.dataset.template,template.dataset.template === 'blank')); install(next.project,next.reference,'builtin-demo'); return; }
  const issue = e.target.closest('[data-issue]');
  if (issue) { if (issue.dataset.issue) drafts.guard(() => { state.selected = issue.dataset.issue; state.mode = 'design'; renderPanels(); paper.send('select',{id:state.selected}); }).catch(e=>status(e.message)); return; }
  const control = e.target.closest('[data-action]');
  if (control && !control.disabled) {
    // Long validation may be stopped or superseded immediately by navigation.
    const name = control.dataset.action;
    if (name === 'cancel-draft') { drafts.discard(control.closest('[data-form]')); return; }
    const perform = () => ['validate-all','rerender','new','cancel-new','open','preview','next','previous','properties','binding','go-data','go-style'].includes(name) ? action(name).catch(e=>status(e.message)) : name === 'review-drafts' ? undefined : queueEdit(() => action(name));
    if (['new','open','properties','binding','go-data','go-style','save','export','print','undo','redo','validate-all','add-field','remove-field','move-up','move-down','review-drafts'].includes(name)) drafts.guard(perform).catch(e=>status(e.message)); else perform();
  }
});
document.addEventListener('submit', e => {
  const form = e.target.closest('[data-form]'); if (!form) return; e.preventDefault();
  drafts.submit(drafts.snapshot(form)).catch(error => status(error.message));
});
async function applyForm({kind,context,selected,form,key,values}) {
    if (bus !== context) throw new Error('The document changed. Apply the current form again.');
    if (kind === 'data') {
      const source = values['data-json'];
      if (new TextEncoder().encode(source).length > 2 * 1024 * 1024) throw new Error('Sample data exceeds the 2 MB limit.');
      let data;
      try { data = parseSampleJSON(source); state.jsonError = ''; } catch (error) { state.jsonError = error.message; throw error; }
      if (!data || typeof data !== 'object' || Array.isArray(data)) { state.jsonError = 'Sample data must be a JSON object.'; throw new Error(state.jsonError); }
      if (database.draft && !confirm('Replace unapplied table edits with this JSON? Saved database records will not change.')) return;
      database.resetDraft(); state.dataDraft = null;
      await replaceData(bus,data,'erp',null);
    } else if (kind === 'locale') {
      const values = new FormData(form);
      await editProject(bus,[{type:'set_manifest_value',path:'/locale',value:values.get('locale')},{type:'set_manifest_value',path:'/currency',value:values.get('currency')}],'locale & currency');
    } else await editProject(bus,designOperations(bus.project,formDesign(bus.project,selected,form,kind)),`edit ${kind}`);
    drafts.applied({key}); await changed();
}
document.addEventListener('input', e => {
  if (e.target.id === 'structure-search') {
    state.search = e.target.value;
    const query = state.search.toLowerCase();
    for (const group of document.querySelectorAll('[data-tree-group]')) {
      const header = group.querySelector('.tree-section-header').textContent.toLowerCase(), blockMatch = header.includes(query);
      let matched = blockMatch;
      for (const field of group.querySelectorAll('.tree-fields [data-select]')) { const visible = !query || blockMatch || field.textContent.toLowerCase().includes(query); field.hidden = !visible; matched ||= visible; }
      group.hidden = !matched; group.querySelector('.tree-fields').hidden = !query && (state.collapsed[group.dataset.treeGroup] || !designOf(bus.project).blocks[group.dataset.treeGroup].enabled);
    }
    return;
  }
  if (e.target.id === 'data-json') state.dataDraft = e.target.value; else database.input(e.target); drafts.capture(e.target);
});
document.addEventListener('change', e => {
  if (e.target.dataset.bindingPicker && e.target.value) {
    const target = e.target.closest('form').querySelector(`[name=${e.target.dataset.bindingPicker}]`); target.value = e.target.value; drafts.capture(target);
  }
  if (e.target.id === 'database-choice') { const id = e.target.value; e.target.value = bus.project.studioV3Session.database?.id || ''; drafts.guard(() => queueDatabase('choose',{id})).catch(e=>status(e.message)); }
});
$('#dataset-file').addEventListener('change', async e => {
  const file = e.target.files[0], context = bus; e.target.value = ''; if (!file) return;
  state.fileReads += 1;
  try {
    if (file.size > 2*1024*1024) throw new Error('Dataset exceeds the 2 MB limit.');
    const source = await file.text();
    if (context !== bus) throw new Error('The document changed. Import the dataset again.');
    queueDatabase('import-data',{source});
  } catch (error) { status(error.message); } finally { state.fileReads -= 1; }
});
$('#document-name').addEventListener('change', e => { const title = e.target.value.trim(); if (title) queueEdit(() => mutate([{type:'set_manifest_value',path:'/title',value:title}],'template name')); });
$('#open-file').addEventListener('change', async e => {
  const file = e.target.files[0], context = bus; e.target.value = ''; if (!file) return;
  state.fileReads += 1;
  try { const source = await file.text(); if (bus !== context || database.busy || database.pending) throw new Error('The document changed or a database save is active. Open it again.'); install(readProject(source,file.name)); status('Opened editable v3 form. Data is an unsaved draft; Save as new retains existing database records.'); } catch (error) { status(error.message); } finally { state.fileReads -= 1; }
});
$('#zoom').onchange = () => { persistZoom($('#zoom')); resizePaper(); }; window.addEventListener('resize',resizePaper);
$('#paper-scroll').addEventListener('scroll',()=> {
  const top = $('#paper-scroll').scrollTop/zoom;
  const current = paper.pages.findLastIndex(page=>page.top <= top+30);
  if (current >= 0 && current !== pageIndex) goPage(current,false);
});
window.addEventListener('beforeunload', e => { if (!updateWork.leaving() && updateWork.pending()) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.isComposing) return;
  if (e.key.toLowerCase() === 's') { e.preventDefault(); drafts.guard(() => queueEdit(() => action('save'))).catch(error=>status(error.message)); }
  if (e.key.toLowerCase() === 'z' && !e.target.closest('input,textarea')) { e.preventDefault(); drafts.guard(() => queueEdit(() => action(e.shiftKey ? 'redo' : 'undo'))).catch(error=>status(error.message)); }
});
await database.init();
const initial = database.starting(newProject()); install(initial.project,initial.reference,'builtin-demo');
await updateWork.restore(); setupUpdates(updateWork);
// Keep startup controls inactive until local dataset loading can no longer replace the document.
document.body.inert = false; document.body.setAttribute('aria-busy','false');
