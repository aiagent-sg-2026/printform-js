import { assertJsonBytes, JSON_DATA_LIMITS, JSON_PROJECT_LIMITS } from './json-safety.js';

export async function readTextFile(file, limits = JSON_DATA_LIMITS) {
  const {maxBytes,label} = limits;
  if (!Number.isFinite(file?.size) || file.size < 0) throw new Error('Choose a readable local file.');
  // Native File.size is available without materializing any file bytes.
  if (file.size > maxBytes) throw new Error(`${label} exceeds the ${maxBytes/(1024*1024)} MB limit.`);
  let bytes;
  try { bytes = await file.arrayBuffer(); }
  catch { throw new Error('The local file could not be read. Choose it again; current work is unchanged.'); }
  let source;
  try { source = new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes); }
  catch { throw new Error('Choose valid UTF-8 text. Current form data and import review are unchanged.'); }
  assertJsonBytes(source,limits);
  return source;
}

export function createFileReadGuard(snapshot) {
  let generation = 0;
  const current = ticket => {
    const now = snapshot();
    return ticket.generation === generation && Object.entries(ticket.snapshot).every(([key,value])=>Object.is(now[key],value));
  };
  return {
    begin:() => ({generation:++generation,snapshot:snapshot()}),
    current,
    assertCurrent(ticket) {
      if (!current(ticket)) throw new Error('This file read was superseded by newer work. Choose the file again.');
    }
  };
}

export function setupWorkspaceFileReads({getBus,state,database,queueDatabase,queueEdit,install,readProject,status,draftState=()=>'',root=document}) {
  const guard = createFileReadGuard(()=>({
    bus:getBus(),project:getBus()?.project,review:database.importReview,preview:database.importReview?.preview,
    mappings:JSON.stringify(database.importReview?.mappings),source:database.importReview?.sourcePointer,
    target:database.importReview?.targetPointer,page:database.importReview?.mappingPage,draft:database.draft,
    draftVersion:database.draftVersion,dataDraft:state.dataDraft,forms:draftState(),title:root.querySelector('#document-name')?.value
  }));
  async function choose(event,kind) {
    const input = event.target, file = input.files[0]; input.value = ''; if (!file) return;
    const ticket = guard.begin(); state.fileReads += 1;
    try {
      const source = await readTextFile(file,kind === 'project' ? JSON_PROJECT_LIMITS : JSON_DATA_LIMITS);
      guard.assertCurrent(ticket);
      if (database.busy || database.pending) throw new Error('A database action is active. Choose the file again when it finishes.');
      if (kind === 'project') {
        const project = readProject(source,file.name);
        await queueEdit(()=> {
          guard.assertCurrent(ticket);
          if (database.busy || database.pending) throw new Error('A database action is active. Open the file again.');
          install(project); status('Opened editable v3 form. Data is an unsaved draft; Save as new retains existing database records.');
        },false);
      } else await queueDatabase('import-file',{source,filename:file.name,assertCurrent:()=>guard.assertCurrent(ticket),isCurrent:()=>guard.current(ticket)});
    } catch (error) { if (guard.current(ticket)) status(error.message); }
    finally { state.fileReads -= 1; }
  }
  const dataset = root.querySelector('#dataset-file'); dataset.accept = '.csv,.json,text/csv,application/json';
  dataset.addEventListener('change',event=>choose(event,'dataset'));
  root.querySelector('#open-file').addEventListener('change',event=>choose(event,'project'));
  return guard;
}
