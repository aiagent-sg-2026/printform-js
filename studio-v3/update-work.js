import { readProject, saveProject } from './file-io.js';
import { rightView } from './views.js';
import { parseProposal } from './ai-edits.js';
import { restoreDraftRecords } from './form-drafts.js';

export const RECOVERY_KEY = 'printform-studio-v3:update-recovery';
const LIMIT = 4 * 1024 * 1024;
const projectRecord = project => ({file:saveProject(project),id:project.manifest.documentId,session:project.studioV3Session});
function recoveryForm(project,ui,record) {
  const holder = document.createElement('div');
  holder.innerHTML = record.kind === 'data' ? '<form data-form="data"><textarea id="data-json"></textarea></form>' : rightView(project,{...ui,mode:record.kind === 'locale' ? 'data' : 'design',selected:record.selected,tab:['binding','collection'].includes(record.kind) ? 'binding' : 'properties'});
  return holder.querySelector(`[data-form="${record.kind}"]`);
}
function restoreProject(record) {
  const project = readProject(record.file);
  if (typeof record.id !== 'string' || !/^v3-[a-z0-9-]{1,100}$/i.test(record.id)) throw new Error('Invalid recovery document.');
  project.manifest.documentId = record.id;
  if (!record.session || !['erp','0','1','45','100','500','long'].includes(record.session.sample)) throw new Error('Invalid recovery data source.');
  project.studioV3Session = structuredClone(record.session);
  return project;
}
export function verifiedWrite(storage, value) {
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).length > LIMIT) throw new Error('Work is too large for update recovery. Save/export it first, or stay on this version.');
  storage.setItem(RECOVERY_KEY,text);
  if (storage.getItem(RECOVERY_KEY) !== text) throw new Error('Recovery verification failed. Stay on this version and save/export your work.');
  return text;
}
export function decodeRecovery(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > LIMIT) throw new Error('Invalid recovery size.');
  const saved = JSON.parse(text);
  if (saved.version !== 1 || !saved.history || !Array.isArray(saved.history.entries) || saved.history.entries.length > 50 || !saved.history.entries.length) throw new Error('Unsupported recovery format.');
  saved.project = restoreProject(saved.project);
  saved.history.entries = saved.history.entries.map(entry=>({...entry,project:restoreProject(entry.project)}));
  if (!Number.isInteger(saved.history.cursor) || saved.history.cursor < 0 || saved.history.cursor >= saved.history.entries.length) throw new Error('Invalid recovery history.');
  if (!saved.ui || !['design','data','validate'].includes(saved.ui.mode) || !Array.isArray(saved.forms) || saved.forms.length > 50) throw new Error('Invalid recovery workspace.');
  restoreDraftRecords(saved.forms,record=>recoveryForm(saved.project,saved.ui,record),null);
  if (saved.ai?.proposal) saved.ai.parsed = parseProposal(JSON.stringify(saved.ai.proposal),saved.project);
  return saved;
}
export function createUpdateWork({getBus,state,database,drafts,ai,install,renderPanels,syncControls,render,settle}) {
  let recoveryFailed = false, updating = false;
  const pending = () => recoveryFailed || state.dirty || database.draft || state.dataDraft !== null || drafts.drafts.size || ai.busy || ai.proposal || document.querySelector('#ai-prompt').value || document.querySelector('#document-name').value !== getBus()?.project.manifest.title;
  function capture() {
    const bus = getBus(), draft = database.draft;
    return {version:1,project:projectRecord(bus.project),history:{cursor:bus.history.cursor,entries:bus.history.entries.map(entry=>({...entry,project:projectRecord(entry.project)}))},
      ui:{mode:state.mode,selected:state.selected,tab:state.tab,sample:state.sample,dirty:state.dirty,dataDraft:state.dataDraft,jsonError:state.jsonError},
      title:document.querySelector('#document-name').value,forms:[...drafts.drafts.values()].map(({key,kind,selected,values})=>({key,kind,selected,values})),
      database:{group:database.group,screen:database.screen,rowPage:database.rowPage,draft:draft ? {...draft,numberPaths:[...draft.numberPaths],columnTypes:[...draft.columnTypes]} : null},
      ai:{open:ai.open,prompt:ai.node('#ai-prompt').value,alias:ai.node('#ai-model').value,proposal:ai.proposal ? {summary:ai.proposal.summary,edits:ai.proposal.diff.map(({target,property,after})=>({target,property,value:after}))} : null}};
  }
  async function restore() {
    let text;
    try {
      text = sessionStorage.getItem(RECOVERY_KEY); if (!text) return false;
      const saved = decodeRecovery(text);
      install(saved.project,saved.project.studioV3Session.database,saved.project.studioV3Session.source?.kind);
      const bus = getBus(); bus.history.currentProject = saved.project; bus.history.entries = saved.history.entries; bus.history.cursor = saved.history.cursor;
      Object.assign(state,saved.ui); Object.assign(database,saved.database);
      if (database.draft) { database.draft.numberPaths = new Set(database.draft.numberPaths); database.draft.columnTypes = new Map(database.draft.columnTypes); database.draftErrors(); }
      drafts.restoreRecords(saved.forms,record=>recoveryForm(bus.project,state,record));
      renderPanels(); syncControls(); await render();
      if (saved.ai) {
        ai.node('#ai-prompt').value = saved.ai.prompt; ai.node('#ai-model').value = ['demo-fast','demo-auto'].includes(saved.ai.alias) ? saved.ai.alias : 'demo-fast';
        if (saved.ai.open) ai.show(); else ai.share();
        if (saved.ai.parsed) { ai.proposal = {...saved.ai.parsed,alias:ai.node('#ai-model').value,bus,revision:bus.revision,baseDesign:JSON.stringify(bus.project.manifest.studioV3)}; ai.present(); ai.update(); }
        ai.message('Recovered work after update. Requests were cancelled; preview any recovered suggestion again before Apply.');
      }
      document.querySelector('#document-name').value = saved.title;
      sessionStorage.removeItem(RECOVERY_KEY); return true;
    } catch {
      recoveryFailed = true;
      document.querySelector('#update-status').textContent = 'Work recovery failed. The backup is retained in this tab; download it before leaving.';
      document.querySelector('#recovery-download').hidden = false;
      document.querySelector('#recovery-discard').hidden = false;
      return false;
    }
  }
  document.querySelector('#recovery-download').onclick = () => {
    const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob([sessionStorage.getItem(RECOVERY_KEY)],{type:'application/json'}));
    anchor.download = 'printform-update-recovery.json'; anchor.click(); setTimeout(()=>URL.revokeObjectURL(anchor.href),3000);
  };
  document.querySelector('#recovery-discard').onclick = () => {
    if (!confirm('Discard the retained update recovery backup? Download it first if you need its work. This permanently removes that backup; the current form and saved datasets stay unchanged.')) return;
    try {
      sessionStorage.removeItem(RECOVERY_KEY); if (sessionStorage.getItem(RECOVERY_KEY) !== null) throw new Error('Recovery backup could not be removed.');
      recoveryFailed = false;
      for (const id of ['recovery-download','recovery-discard']) document.getElementById(id).hidden = true;
      document.querySelector('#update-status').textContent = 'Recovery backup explicitly discarded. Current work remains; Update is available again.';
    } catch (error) { document.querySelector('#update-status').textContent = error.message; }
  };
  async function prepare() {
    await settle();
    if (recoveryFailed) throw new Error('Protect the retained recovery backup: download it if needed, then explicitly discard that backup to enable Update.');
    const checkBusy = ()=> { if (state.fileReads || database.busy || database.pending || drafts.applying.size || ai.applying) throw new Error('A file read, edit or database save is active. Wait, then retry.'); };
    checkBusy();
    if (!database.store.persistent) throw new Error('Database storage is tab-only. Export your datasets before leaving; update is blocked to protect them.');
    const dialog = document.querySelector('#update-dialog');
    dialog.querySelector('[data-update-summary]').textContent = pending() ? 'This tab has unsaved work. Keep preserves the template, history, field/data drafts and AI input/proposal locally for this tab’s reload.' : 'Keep preserves this tab’s current template and active data for the reload.';
    dialog.returnValue = 'stay';
    const choice = await new Promise(resolve=> { dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}); dialog.showModal(); });
    if (choice === 'stay') return false;
    document.body.inert = true;
    try {
      await settle();
      checkBusy();
      if (choice === 'keep') { const snapshot = capture(); decodeRecovery(verifiedWrite(sessionStorage,snapshot)); }
      else if (choice === 'discard') sessionStorage.removeItem(RECOVERY_KEY);
      else return false;
      // Cancel only after the user's choice and successful persistence.
      ai.cancel('Update requested. Network request cancelled.'); updating = true; return true;
    } finally { if (!updating) document.body.inert = false; }
  }
  const dialog = document.querySelector('#update-dialog');
  dialog.addEventListener('click',event=> { const button = event.target.closest('[data-update-choice]'); if (button) dialog.close(button.dataset.updateChoice); });
  dialog.addEventListener('cancel',event=> { event.preventDefault(); dialog.close('stay'); });
  return {restore,prepare,pending,leaving:()=>updating,failed:()=> { updating = false; document.body.inert = false; }};
}
