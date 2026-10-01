import { CommandBus } from '../studio-v2/core/command-bus.js';
import { compileProject, designOf, selectionField } from './model.js';
import { validateDesign } from './file-io.js';
import { dataSource } from './data-provenance.js';

export function createBus(project, database = null, source = 'builtin-demo') {
  const initial = structuredClone(project);
  // Session data follows the same undo/redo snapshots as the active dataset.
  // It is excluded from the explicit save format and standalone serializer.
  const origin = dataSource(database?.origin || source);
  initial.studioV3Session = {sample:'erp',erpData:structuredClone(initial.sampleData),database,source:origin,erpSource:origin};
  return new CommandBus(initial, {hydrateDurable:false,dataPolicy:{allowDurable:false},agentId:'studio-v3-human'});
}
export async function editProject(bus, operations, reason, dataSession = null) {
  const revision = bus.revision;
  const preview = bus.preview(operations, revision);
  const design = designOf(preview.candidate);
  validateDesign(design);
  const next = compileProject(preview.candidate, design);
  if (dataSession) next.studioV3Session = structuredClone(dataSession);
  return bus.commit(next, reason, {expectedRevision:revision});
}
export async function replaceData(bus, data, sample = 'erp', database = undefined, sourceOverride = null) {
  const session = bus.project.studioV3Session;
  const names = {'0':'Empty','1':'Single item','45':'Standard','100':'Multi-page','500':'Stress',long:'Long & bilingual'};
  const source = sourceOverride || (sample !== 'erp' ? dataSource('validation-sample',names[sample] || sample) : database === undefined ? session.erpSource : dataSource(database?.origin || 'imported-data'));
  return editProject(bus,[{type:'replace_sample_data',value:data}],`data: ${sample}`,{
    sample,erpData:sample === 'erp' ? data : session.erpData,
    database:database === undefined ? session.database : database,
    source,erpSource:sample === 'erp' ? source : session.erpSource
  });
}
export function designOperations(project, design) {
  validateDesign(design);
  const next = compileProject(project,design);
  return [{type:'replace_manifest',value:next.manifest},{type:'replace_template',value:next.templateHtml},{type:'replace_theme',value:next.themeCss}];
}
export function formDesign(project, selected, form, kind) {
  const d = designOf(project);
  const values = new FormData(form);
  const text = name => String(values.get(name) || '');
  const checked = name => values.has(name);
  const selection = selectionField(d,selected);
  if (kind === 'style') {
    for (const key of ['color']) d[key] = text(key);
    for (const key of ['font','padding']) d[key] = Number(values.get(key));
    for (const key of ['striped','borders','pageNumbers']) d[key] = checked(key);
  } else if (kind === 'field' && selection) {
    for (const key of ['label','format']) if (values.has(key)) selection.field[key] = text(key);
    if (selection.block === 'items' && values.has('width')) selection.field.width = Number(values.get('width'));
  } else if (kind === 'binding' && selection) {
    selection.field.lastPointer = text('pointer');
    selection.field.pointer = text('bindingMode') === 'static' ? '' : text('pointer');
    selection.field.text = text('text');
  } else if (kind === 'collection') {
    d.collection = text('collection');
  } else if (kind === 'block') {
    const id = d.blocks[selected] ? selected : 'items';
    d.blocks[id].label = text('label'); d.blocks[id].enabled = checked('enabled');
    if (id === 'header') { d.title = text('title'); d.repeatHeader = checked('repeatHeader'); }
    if (id === 'items') { d.repeatTable = checked('repeatTable'); d.breakBefore = checked('breakBefore'); }
  }
  return d;
}
export function alterFields(project, selected, action) {
  const d = designOf(project);
  const selection = selectionField(d,selected);
  const block = selection?.block || (d.blocks[selected] ? selected : 'items');
  const list = block === 'items' ? d.columns : d[block];
  let nextSelection = selected;
  if (action === 'add-field') {
    if (list.length >= 30) throw new Error('A section supports at most 30 fields.');
    const id = `field-${crypto.randomUUID().slice(0,8)}`;
    const f = {id,label:'New field',pointer:block === 'items' ? './description' : '',format:'',text:'New text'};
    if (block === 'items') {
      list.forEach(c => { c.width = Math.round(c.width * .9 * 100) / 100; });
      f.width = 10;
    }
    list.push(f); d.blocks[block].enabled = true; nextSelection = `${block}-${id}`;
  } else if (selection) {
    if (action === 'remove-field') { list.splice(selection.index,1); nextSelection = block; }
    else {
      const target = selection.index + (action === 'move-up' ? -1 : 1);
      if (target >= 0 && target < list.length) [list[selection.index],list[target]] = [list[target],list[selection.index]];
    }
  }
  return {design:d,selected:nextSelection};
}
