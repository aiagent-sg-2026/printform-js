import { afterEach, expect, it, vi } from 'vitest';
import { File } from 'node:buffer';
import { newProject } from '../studio-v3/model.js';
import { createBus, editProject } from '../studio-v3/controller.js';
import { DemoDatabase } from '../studio-v3/database-controller.js';
import { readProject, saveProject } from '../studio-v3/file-io.js';
import { setupWorkspaceFileReads } from '../studio-v3/workspace-file-reads.js';
import { assertJsonBytes } from '../studio-v3/json-safety.js';
import { structuredImportView } from '../studio-v3/structured-import-view.js';
import { createImportReview } from '../studio-v3/structured-import-model.js';
import { createUpdateWork, decodeRecovery, RECOVERY_KEY } from '../studio-v3/update-work.js';
import { importReviewSnapshot } from '../studio-v3/structured-import-recovery.js';

afterEach(()=> { vi.unstubAllGlobals(); sessionStorage.clear(); document.body.innerHTML=''; });
const deferred = () => { let resolve; const promise=new Promise(done=> { resolve=done; }); return {promise,resolve}; };
function setup() {
  document.body.innerHTML='<input id="open-file" type="file"><input id="dataset-file" type="file">';
  let bus=createBus(newProject());
  const state={sample:'erp',mode:'data',dataDraft:null,fileReads:0}, status=vi.fn();
  const database=new DemoDatabase({project:()=>bus.project,state:()=>state,context:()=>bus,render:()=>{},busy:()=>{}});
  const install=project=> { bus=createBus(project); database.resetDraft(); };
  setupWorkspaceFileReads({getBus:()=>bus,state,database,status,install,readProject,queueEdit:work=>work(),queueDatabase:(name,target)=> { target.assertCurrent(); return database.action(name,target); }});
  const choose=(id,file)=> {
    const input=document.getElementById(id); Object.defineProperty(input,'files',{configurable:true,value:[file]});
    input.dispatchEvent(new Event('change',{bubbles:true}));
  };
  return {get bus(){ return bus; },state,database,status,install,choose};
}
function delayedFile(text,name) {
  const file=new File([text],name), gate=deferred(), native=file.arrayBuffer.bind(file);
  file.arrayBuffer=vi.fn(async()=> { await gate.promise; return native(); });
  return {file,release:gate.resolve};
}
const finished = fixture => vi.waitFor(()=>expect(fixture.state.fileReads).toBe(0));

it.each([['open-file',10],['dataset-file',2]])('rejects an oversized native File before either byte-reading method: %s',async(id,megabytes)=> {
  const fixture=setup(), before=structuredClone(fixture.bus.project), revision=fixture.bus.revision;
  const file=new File(['x'.repeat(megabytes*1024*1024+1)],'oversized.json');
  const bytes=vi.spyOn(file,'arrayBuffer'), text=vi.spyOn(file,'text');
  fixture.choose(id,file); await finished(fixture);
  expect(bytes).not.toHaveBeenCalled(); expect(text).not.toHaveBeenCalled();
  expect(fixture.status).toHaveBeenLastCalledWith(expect.stringContaining(`${megabytes} MB`));
  expect(fixture.bus.project).toEqual(before); expect(fixture.bus.revision).toBe(revision);
});
it('keeps a newer import review and mappings after an older native File read finally resolves',async()=> {
  const fixture=setup(), old=delayedFile('client\nOLD\n','old.csv');
  fixture.choose('dataset-file',old.file);
  fixture.choose('dataset-file',new File(['client\nNEW\n'],'new.csv'));
  await vi.waitFor(()=>expect(fixture.database.importReview?.source.filename).toBe('new.csv'));
  fixture.database.importReview.mappings={'/customer/name':{source:'/client',conversion:'preserve'}};
  const review=fixture.database.importReview, before=structuredClone(fixture.bus.project);
  old.release(); await finished(fixture);
  expect(fixture.database.importReview).toBe(review); expect(fixture.database.importReview.mappings['/customer/name'].source).toBe('/client');
  expect(fixture.bus.project).toEqual(before);
});
it('does not replace a review that was edited or cancelled during a replacement read',async()=> {
  const fixture=setup();
  fixture.choose('dataset-file',new File(['client\nFIRST\n'],'first.csv')); await finished(fixture);
  const old=delayedFile('client\nOLD\n','old.csv'); fixture.choose('dataset-file',old.file);
  fixture.database.input({dataset:{dbImportControl:'target'},value:''});
  old.release(); await finished(fixture);
  expect(fixture.database.importReview.source.filename).toBe('first.csv');
  const replacement=delayedFile('client\nREPLACEMENT\n','replacement.csv'); fixture.choose('dataset-file',replacement.file);
  await fixture.database.action('import-cancel',{}); replacement.release(); await finished(fixture);
  expect(fixture.database.importReview).toBeNull();
});
it('cannot overwrite same-document edits or a switched project with a delayed Open',async()=> {
  const fixture=setup(), source=saveProject(fixture.bus.project), old=delayedFile(source,'old.printform.json');
  fixture.choose('open-file',old.file);
  await editProject(fixture.bus,[{type:'set_manifest_value',path:'/title',value:'Newer human edit'}],'human title');
  const edited=structuredClone(fixture.bus.project), revision=fixture.bus.revision;
  old.release(); await finished(fixture);
  expect(fixture.bus.project).toEqual(edited); expect(fixture.bus.revision).toBe(revision);
  const next=delayedFile(source,'switch.printform.json'); fixture.choose('open-file',next.file);
  fixture.install(newProject('purchase')); const switched=fixture.bus;
  next.release(); await finished(fixture); expect(fixture.bus).toBe(switched);
});
it('preserves in-place table draft edits and an uncommitted title typed after Open started',async()=> {
  const fixture=setup(); fixture.database.ensureDraft();
  const before=structuredClone(fixture.bus.project), delayed=delayedFile(saveProject(fixture.bus.project),'table-draft.json');
  fixture.choose('open-file',delayed.file);
  fixture.database.input({dataset:{dbPointer:'/customer/name',dbType:'string'},value:'New unapplied table value'});
  delayed.release(); await finished(fixture);
  expect(fixture.database.draft.data.customer.name).toBe('New unapplied table value'); expect(fixture.bus.project).toEqual(before);
  document.body.insertAdjacentHTML('beforeend','<input id="document-name">');
  document.getElementById('document-name').value=fixture.bus.project.manifest.title;
  const title=delayedFile(saveProject(fixture.bus.project),'title-draft.json'); fixture.choose('open-file',title.file);
  document.getElementById('document-name').value='Still typing, not submitted';
  title.release(); await finished(fixture);
  expect(document.getElementById('document-name').value).toBe('Still typing, not submitted'); expect(fixture.bus.project).toEqual(before);
});
it('rejects malformed, unreadable and invalid UTF-8 files without losing state, then opens a valid retry',async()=> {
  const fixture=setup(), source=saveProject(fixture.bus.project), before=structuredClone(fixture.bus.project);
  const unreadable=new File(['unused'],'read-error.json'); unreadable.arrayBuffer=async()=> { throw new Error('device removed'); };
  const invalid=JSON.parse(source); invalid.project.manifest.title='UTF8_BYTE';
  const text=JSON.stringify(invalid), bytes=new TextEncoder().encode(text); bytes[text.indexOf('UTF8_BYTE')]=255;
  for (const file of [new File(['{broken'],'malformed.json'),unreadable,new File([bytes],'utf8.json')]) {
    fixture.choose('open-file',file); await finished(fixture); expect(fixture.bus.project).toEqual(before);
  }
  fixture.choose('open-file',new File(['\uFEFF'+source],'retry.printform.json')); await finished(fixture);
  expect(fixture.bus.project.sampleData).toEqual(before.sampleData); expect(fixture.bus.project.schema).toEqual(before.schema);
  expect(fixture.status).toHaveBeenLastCalledWith(expect.stringContaining('Opened editable'));
});
it('retains the existing review and committed schema/data after malformed replacement import, then allows retry',async()=> {
  const fixture=setup(); fixture.choose('dataset-file',new File(['client\n00007\n'],'first.csv')); await finished(fixture);
  const review=fixture.database.importReview, before=structuredClone(fixture.bus.project), revision=fixture.bus.revision;
  fixture.choose('dataset-file',new File(['a,a\n1,2\n'],'bad.csv')); await finished(fixture);
  expect(fixture.database.importReview).toBe(review); expect(fixture.bus.project).toEqual(before); expect(fixture.bus.revision).toBe(revision);
  fixture.choose('dataset-file',new File(['client\n00009\n'],'retry.csv')); await finished(fixture);
  expect(fixture.database.importReview.source.filename).toBe('retry.csv'); expect(fixture.bus.project).toEqual(before);
});
it('keeps Unicode byte limits identical to native UTF-8 encoding at exact boundaries',()=> {
  for (const source of ['ASCII','界界','😀😀','\ud800','é😀界']) {
    const bytes=new TextEncoder().encode(source).length;
    expect(()=>assertJsonBytes(source,{maxBytes:bytes})).not.toThrow();
    expect(()=>assertJsonBytes(source,{maxBytes:bytes-1})).toThrow('limit');
  }
});
it('paginates real mapping selectors while retaining hidden-page mappings and validating all records',async()=> {
  const fixture=setup(), keys=Array.from({length:40},(_,index)=>`field${index}`);
  fixture.bus.project.sampleData.custom=Object.fromEntries(keys.map(key=>[key,'old']));
  const source=`${keys.join(',')}\n${keys.map(()=> '0007.500').join(',')}\n`;
  fixture.database.importReview=createImportReview(fixture.bus.project,source,'wide.csv');
  const review=fixture.database.importReview; review.targetPointer=''; review.mappings={'/custom/field39':{source:'/field39',conversion:'preserve'}};
  const holder=document.createElement('div'); holder.innerHTML=structuredImportView(fixture.database,fixture.bus.project);
  expect(holder.querySelectorAll('[data-db-import-control="field"]').length).toBeLessThanOrEqual(10);
  await fixture.database.action('import-next-fields',{}); expect(review.mappingPage).toBe(1);
  expect(review.mappings['/custom/field39'].source).toBe('/field39');
  await fixture.database.action('import-preview',{}); expect(review.preview.data.custom.field39).toBe('0007.500');
  expect(fixture.bus.project.sampleData.custom.field39).toBe('old');
});
it('treats an unapplied import review as unsaved update work and recovers original text/mappings without auto-Apply',async()=> {
  const fixture=setup(), bus=fixture.bus, source='client,private\n00007,keep exact original\n';
  document.body.insertAdjacentHTML('beforeend','<textarea id="ai-prompt"></textarea><input id="document-name"><p id="update-status"></p><button id="recovery-download"></button><button id="recovery-discard"></button><dialog id="update-dialog"><p data-update-summary></p></dialog>');
  document.getElementById('document-name').value=bus.project.manifest.title;
  fixture.database.importReview=createImportReview(bus.project,source,'review.csv'); fixture.database.importReview.targetPointer='';
  fixture.database.importReview.mappings={'/customer/name':{source:'/client',conversion:'preserve'}};
  fixture.database.store={persistent:true};
  const drafts={drafts:new Map(),applying:new Set(),restoreRecords:()=>{}}, ai={snapshot:()=>null,cancel:()=>{}};
  const dialog=document.getElementById('update-dialog'); dialog.showModal=()=> { dialog.returnValue='keep'; dialog.dispatchEvent(new Event('close')); };
  const deps={getBus:()=>fixture.bus,state:{...fixture.state,dirty:false,selected:'items',tab:'properties'},database:fixture.database,drafts,ai,install:fixture.install,renderPanels:()=>{},syncControls:()=>{},render:async()=>{},settle:async()=>{}};
  const work=createUpdateWork(deps); expect(work.pending()).toBeTruthy(); expect(await work.prepare()).toBe(true);
  const text=sessionStorage.getItem(RECOVERY_KEY), saved=decodeRecovery(text);
  expect(saved.database.importReview).toEqual(importReviewSnapshot(fixture.database.importReview));
  fixture.database.resetDraft(); expect(await work.restore()).toBe(true);
  expect(fixture.database.importReview.source.text).toBe(source); expect(fixture.database.importReview.preview).toBeNull();
  expect(fixture.database.importReview.baseProject).toBe(fixture.bus.project); expect(fixture.bus.project.sampleData).toEqual(bus.project.sampleData);
});
