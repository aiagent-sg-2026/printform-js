import { createLocalDatasetSource } from './data-source-adapter.js';
import { createDatabase, storageMessage, DATABASE_NAME } from './database-store.js';
import { datasetRecord, datasetMatchesProject, datasetName, datasetTitleFor, dataValue, exportDataset, importDataset, itemColumns, newItem, numericPaths, removeRowPaths, sameData, setDataValue, starterRecords } from './database-model.js';
import { designOf } from './model.js';
import { databaseView } from './database-view.js';
import { assertCollectionBinding, assertProjectSchema, projectSourceSchema, validateSourceSchema } from './dataset-schema.js';
import { editImportReview, importReviewAction, reviewImportFile } from './structured-import-controller.js';
import { validateImportReceipt } from './structured-import-receipt.js';
import { assertLegacyDataset } from './database-compatibility.js';
import { bindingValidation } from './validation.js';

const referenceFor = record => ({id:record.id,title:record.title,type:record.type,revision:record.revision,origin:record.origin || 'local-demo'});
function withRecordContract(project,record) {
  const contract = validateSourceSchema(record.sourceSchema,record.data,record.id) || projectSourceSchema({...project,sampleData:record.data});
  const localImport = validateImportReceipt(record.localImport,record.data);
  return {...record,...(contract ? {sourceSchema:{...contract,datasetId:record.id}} : {}),...(localImport ? {localImport} : {})};
}
export class DemoDatabase {
  constructor(callbacks) {
    this.callbacks = callbacks; this.records = []; this.selected = {}; this.store = null;
    this.draft = null; this.group = 'items'; this.rowPage = 0; this.screen = 'database';
    this.error = ''; this.message = ''; this.errors = new Set(); this.busy = false;
  }
  get project() { return this.callbacks.project(); }
  get state() { return this.callbacks.state(); }
  async init() {
    this.store = await createDatabase(); this.source = createLocalDatasetSource(this.store); await this.refresh();
    for (const type of ['invoice','purchase','delivery']) this.selected[type] = await this.store.selected(type);
    if (globalThis.BroadcastChannel && this.store.persistent) {
      this.channel = new BroadcastChannel(DATABASE_NAME);
      this.channel.onmessage = () => {
        this.message = 'Saved datasets changed in another tab. Refresh the list; your form and table draft are unchanged.';
        const notice = document.querySelector('#database-notice'); if (notice) notice.textContent = this.message;
      };
    }
  }
  starting(project) {
    const type = designOf(project).type, kind = project.sampleData.document?.kind;
    const compatible=this.records.filter(record=>datasetMatchesProject(record,project));
    const selected=compatible.find(record=>record.id===this.selected[type]) || (kind ? compatible[0] : compatible.find(record=>record.id===`starter:${type}`));
    if (!selected) return {project,reference:null};
    const record = withRecordContract(project,selected), sourceSchema = record.sourceSchema;
    const next = {...project,manifest:{...project.manifest,datasetSchema:sourceSchema ? {sourceId:sourceSchema.sourceId,datasetId:sourceSchema.datasetId,version:sourceSchema.version} : null,...(record.data.document?.currency ? {currency:record.data.document.currency} : {})},schema:sourceSchema?.schema || project.schema,sampleData:structuredClone(record.data)};
    next.manifest.localImport = validateImportReceipt(record.localImport,record.data);
    assertProjectSchema(next);
    return {project:next,reference:referenceFor(record)};
  }
  resetDraft() { this.draft = null; this.importReview = null; this.errors.clear(); this.rowPage = 0; this.error = ''; }
  guardDraft() {
    if ((this.draft || this.importReview || this.state.dataDraft !== null) && !confirm('Discard unapplied table, JSON or import review edits? Saved database records will not change.')) return false;
    this.resetDraft(); this.state.dataDraft = null; return true;
  }
  ensureDraft() {
    if (!this.draft) {
      const reference = this.state.sample === 'erp' ? this.project.studioV3Session.database : null;
      const data = structuredClone(this.project.sampleData);
      this.draft = {data,title:datasetTitleFor(this.project),reference:structuredClone(reference || null),numberPaths:numericPaths(data),columnTypes:new Map(itemColumns(data,designOf(this.project),this.project.schema).map(c=>[c.pointer,c.type]))};
    }
    return this.draft;
  }
  input(target) {
    if (target.dataset.dbImportControl) {
      try { editImportReview(this,target); } catch (error) { this.error = error.message; this.render(); }
      return;
    }
    if (target.id === 'database-name') this.ensureDraft().title = target.value;
    else if (target.dataset.dbPointer) {
      const draft = this.ensureDraft(), pointer = target.dataset.dbPointer;
      const type = target.dataset.dbType;
      const value = type === 'boolean' ? target.checked : type === 'number' && target.value !== '' ? Number(target.value) : target.value;
      if (type === 'number') draft.numberPaths.add(pointer);
      if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) this.errors.add(pointer); else this.errors.delete(pointer);
      setDataValue(draft.data,pointer,value);
    } else return;
    this.error = '';
    const status = document.querySelector('#db-draft-status'); if (status) status.textContent = 'Table draft · not applied';
    const notice = document.querySelector('#database-notice'); if (notice) notice.textContent = '';
  }
  draftErrors() {
    this.errors = new Set([...this.draft?.numberPaths || []].filter(pointer=> {
      const value = dataValue(this.draft.data,pointer); return typeof value !== 'number' || !Number.isFinite(value);
    }));
  }
  validateDraft() {
    const draft = this.ensureDraft(); this.draftErrors();
    if (this.errors.size) throw new Error(`Enter a finite number for ${[...this.errors][0]}.`);
    const title = datasetName(draft.title);
    const validation = bindingValidation({...this.project,sampleData:draft.data});
    if (!validation.valid) throw new Error(validation.errors[0].message);
    draft.title = title; return draft;
  }
  render() {
    const target = document.querySelector('#database-workbench'); if (!target || !this.project) return;
    target.hidden = this.state.mode !== 'data' || this.screen !== 'database' || document.body.classList.contains('preview-only');
    const focus = document.activeElement, pointer = focus?.dataset.dbPointer, id = focus?.id;
    const selection = typeof focus?.selectionStart === 'number' ? [focus.selectionStart,focus.selectionEnd] : null;
    target.innerHTML = databaseView(this,this.project,this.state);
    target.querySelectorAll('button,input,select,textarea').forEach(n => { if (this.busy || this.pending) n.disabled = true; });
    if (pointer || id?.startsWith('database-')) {
      const next = pointer ? [...target.querySelectorAll('[data-db-pointer]')].find(n=>n.dataset.dbPointer === pointer) : document.getElementById(id);
      next?.focus(); if (selection && next?.setSelectionRange && next.type !== 'number') next.setSelectionRange(...selection);
    }
    document.querySelector('#show-database').hidden = this.state.mode !== 'data' || this.screen === 'database';
  }
  async refresh() { this.records = (await this.store.list()).sort((a,b)=>a.title.localeCompare(b.title)); }
  async apply(record, data = record.data) {
    await this.callbacks.apply(data,record ? referenceFor(record) : null,this.context,null,undefined,record?.sourceSchema,record?.localImport || null);
    this.resetDraft(); this.message = this.store.persistent ? 'Dataset saved locally and applied to the print form.' : 'Applied in this tab only. Export before leaving; storage is unavailable.';
  }
  async choose(id) {
    if (!id) return;
    const record = withRecordContract(this.project,await this.source.read(id));
    if (!datasetMatchesProject(record,this.project)) throw new Error('Choose a dataset for the current document type.');
    const candidate = {...this.project,sampleData:record.data,schema:record.sourceSchema?.schema || this.project.schema,manifest:{...this.project.manifest,datasetSchema:record.sourceSchema ? {sourceId:record.sourceSchema.sourceId,datasetId:record.sourceSchema.datasetId,version:record.sourceSchema.version} : null}};
    assertProjectSchema(candidate); assertCollectionBinding(candidate,designOf(candidate).collection,undefined,false);
    if (!this.guardDraft()) return;
    await this.store.select(record.type,record.id); this.selected[record.type] = record.id;
    await this.apply(record); this.message = 'Loaded saved dataset into the form. Your template layout is retained.';
  }
  async save(copy) {
    if (this.state.dataDraft !== null) throw new Error('Apply your advanced JSON edits before saving the dataset.');
    assertLegacyDataset(this.draft?.data || this.project.sampleData);
    const draft = this.validateDraft();
    const reference = copy ? null : draft.reference;
    if (!copy && !reference) throw new Error('Save this form draft as a new dataset.');
    let title = draft.title;
    if (copy && this.records.some(r=>r.title === title)) {
      const base = title.slice(0,78); let index = 1;
      while (this.records.some(r=>r.title === `${base} · copy ${index}`)) index++;
      title = `${base} · copy ${index}`;
    }
    const record = datasetRecord(designOf(this.project).type,draft.data,title,reference?.id);
    const sourceSchema = projectSourceSchema({...this.project,sampleData:draft.data});
    if (sourceSchema) record.sourceSchema = {...sourceSchema,datasetId:record.id};
    const receipt = sameData(draft.data,this.project.sampleData) ? validateImportReceipt(this.project.manifest.localImport,draft.data) : null;
    if (receipt) record.localImport = receipt;
    if (receipt) exportDataset(record);
    if (this.project.studioV3Session.source?.kind === 'imported-data') record.origin = 'imported-data';
    const [saved] = await this.store.write([{id:record.id,record,expectedRevision:reference?.revision ?? null}],{key:`active:${record.type}`,value:record.id});
    await this.refresh(); this.selected[record.type] = record.id;
    this.channel?.postMessage({changed:true});
    await this.apply(saved);
  }
  async import(source) {
    const record = withRecordContract(this.project,importDataset(source,designOf(this.project).type));
    if (!datasetMatchesProject(record,this.project)) throw new Error('Imported dataset must match the selected business document kind.');
    const candidate = {...this.project,sampleData:record.data,schema:record.sourceSchema?.schema || this.project.schema,manifest:{...this.project.manifest,datasetSchema:record.sourceSchema ? {sourceId:record.sourceSchema.sourceId,datasetId:record.sourceSchema.datasetId,version:record.sourceSchema.version} : null}};
    assertProjectSchema(candidate); assertCollectionBinding(candidate,designOf(candidate).collection,undefined,false);
    if (!this.guardDraft()) return;
    const [saved] = await this.store.write([{id:record.id,record,expectedRevision:null}],{key:`active:${record.type}`,value:record.id});
    await this.refresh(); this.selected[record.type] = record.id; this.channel?.postMessage({changed:true});
    await this.apply(saved);
  }
  async remove() {
    const reference = this.project.studioV3Session.database;
    if (!reference || !confirm('Delete this saved dataset from the Studio v3 local demo database? The current form remains as an unsaved draft. Other datasets and browser storage are retained.')) return;
    if (!this.guardDraft()) return;
    await this.store.write([{id:reference.id,remove:true,expectedRevision:reference.revision}]);
    await this.refresh(); this.channel?.postMessage({changed:true});
    await this.callbacks.apply(this.project.sampleData,null,this.context,this.project.studioV3Session.source);
    this.message = 'Deleted the saved record. The current form data is retained; save as new to keep it.';
  }
  async restore() {
    if (!confirm('Restore the three built-in invoice, purchase order and delivery note datasets? This replaces only starter records. Saved copies, the current form draft and all other browser storage are retained.')) return;
    await this.refresh();
    const restored = starterRecords().filter(record => ['starter:invoice','starter:purchase','starter:delivery'].includes(record.id));
    await this.store.write(restored.map(record=>({id:record.id,record,expectedRevision:this.records.find(r=>r.id === record.id)?.revision ?? null})));
    await this.refresh(); this.channel?.postMessage({changed:true});
    this.message = 'Starter records restored. Current form data is unchanged; load a saved dataset when ready.';
  }
  async action(name, target) {
    if (name === 'preview' || name === 'database') { this.screen = name; this.render(); return; }
    if (name === 'import') { document.querySelector('#dataset-file').click(); return; }
    if (name === 'previous-rows' || name === 'next-rows') { this.rowPage += name === 'previous-rows' ? -1 : 1; this.render(); return; }
    if (name === 'add-row' || name === 'delete-row') {
      const draft = this.ensureDraft(), collection = designOf(this.project).collection, rows = dataValue(draft.data,collection);
      if (!Array.isArray(rows)) throw new Error('Selected collection must be an array.');
      if (name === 'add-row') {
        if (rows.length >= 500) throw new Error('At most 500 item records are supported.');
        rows.push(newItem(draft.data,designOf(this.project),draft.columnTypes));
        for (const pointer of numericPaths(draft.data)) draft.numberPaths.add(pointer); this.rowPage = Math.floor((rows.length-1)/25);
      } else {
        const index = Number(target.dataset.row); rows.splice(index,1);
        draft.numberPaths = removeRowPaths(draft.numberPaths,index,collection);
        this.rowPage = Math.min(this.rowPage,Math.max(0,Math.ceil(rows.length/25)-1)); this.draftErrors();
      }
      this.error = this.errors.size ? `Enter a finite number for ${[...this.errors][0]}.` : ''; this.render(); return;
    }
    this.context = this.callbacks.context();
    this.busy = true; this.error = ''; this.callbacks.busy(); this.render();
    try {
      if (name === 'apply-draft') {
        const draft = this.draft; if (draft) {
          this.validateDraft(); await this.callbacks.apply(draft.data,draft.reference,this.context,null,draft.title); this.resetDraft();
          this.message = 'Table edits applied to the form draft. Save the database record explicitly to persist them.';
        }
      } else if (name === 'save' || name === 'copy') await this.save(name === 'copy');
      else if (name === 'choose') await this.choose(target.id);
      else if (name === 'import-data') await this.import(target.source);
      else if (name === 'import-file') await reviewImportFile(this,target.source,target.filename);
      else if (['import-preview','import-apply','import-cancel'].includes(name)) await importReviewAction(this,name);
      else if (name === 'reload') await this.choose(this.project.studioV3Session.database?.id);
      else if (name === 'delete') await this.remove();
      else if (name === 'reset') await this.restore();
      else if (name === 'refresh') { await this.refresh(); this.message = 'Saved dataset list refreshed. Your form and draft are unchanged.'; }
      else if (name === 'export') {
        const draft = this.draft;
        assertLegacyDataset(draft?.data || this.project.sampleData);
        const record = datasetRecord(designOf(this.project).type,draft?.data || this.project.sampleData,draft?.title || datasetTitleFor(this.project));
        const sourceSchema = projectSourceSchema({...this.project,sampleData:record.data});
        if (sourceSchema) record.sourceSchema = {...sourceSchema,datasetId:record.id};
        const receipt = sameData(record.data,this.project.sampleData) ? validateImportReceipt(this.project.manifest.localImport,record.data) : null;
        if (receipt) record.localImport = receipt;
        this.callbacks.download(exportDataset(record),'studio-v3-dataset.json','application/json');
      }
    } catch (error) { this.error = error.code === 'DATASET_CONFLICT' || error instanceof DOMException ? storageMessage(error) : error.message; throw error; }
    finally { this.busy = false; this.callbacks.busy(); this.callbacks.render(); }
  }
}
