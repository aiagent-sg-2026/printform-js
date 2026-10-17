import { download, exportProject, filenameFor, saveProject } from './file-io.js';

export function syncShareControls(root,ready) {
  const html = root.querySelector('[data-action="export-share"]');
  if (html) html.disabled = !ready;
}

export async function projectFileAction(name,{bus,state,installStatus,syncControls,getBus,root=document}) {
  if (name === 'share') { root.querySelector('#share-dialog').showModal(); return true; }
  if (name === 'close-share') { root.querySelector('#share-dialog').close(); return true; }
  if (!['save','save-share','export','export-share'].includes(name)) return false;
  const sharing = name.endsWith('-share'), project = bus.project;
  if (name === 'save' || name === 'save-share') {
    const content = saveProject(project,{omitSource:sharing});
    download(content,sharing ? 'printform-share.printform.json' : `${filenameFor(project)}.printform.json`,'application/json');
    if (!sharing) { state.dirty = false; syncControls(); }
    installStatus(sharing
      ? 'Downloaded a share copy without the original import receipt. All live form data and printed values remain; this is not anonymization. Your source form is unchanged.'
      : 'Saved portable editable form with active data and complete original local import source, when present.');
  } else {
    const revision = bus.revision, snapshot = structuredClone(project), report = state.report;
    const result = await exportProject(snapshot,report,{omitSource:sharing});
    if (getBus() !== bus || bus.revision !== revision || state.running) throw new Error('The form changed while exporting. Export the current revision again.');
    download(result.html,sharing ? 'printform-share.html' : `${filenameFor(project)}.html`,'text/html');
    installStatus(sharing
      ? 'Exported standalone share HTML without the original import receipt. Live data, embedded assets and printed values remain. Review the file before sharing; anonymity is not guaranteed.'
      : 'Exported standalone HTML, including active data and complete original local import source when present. Review every page and the embedded data before sharing.');
  }
  if (sharing) root.querySelector('#share-dialog').close();
  return true;
}
