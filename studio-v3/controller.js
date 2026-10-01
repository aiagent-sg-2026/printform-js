import { CommandBus } from '../studio-v2/core/command-bus.js';
import { compileProject, designOf, selectionField } from './model.js';
import { validateDesign } from './file-io.js';

export function createBus(project) {
  return new CommandBus(project, {hydrateDurable:false,dataPolicy:{allowDurable:false},agentId:'studio-v3-human'});
}
export async function editProject(bus, operations, reason) {
  const revision = bus.revision;
  const preview = bus.preview(operations, revision);
  const design = designOf(preview.candidate);
  validateDesign(design);
  const next = compileProject(preview.candidate, design);
  return bus.commit(next, reason, {expectedRevision:revision});
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
    for (const key of ['label','pointer','format']) selection.field[key] = text(key);
    if (selection.block === 'items') selection.field.width = Number(values.get('width'));
    else selection.field.text = text('text');
  } else if (kind === 'block') {
    const id = d.blocks[selected] ? selected : 'items';
    d.blocks[id].label = text('label'); d.blocks[id].enabled = checked('enabled');
    if (id === 'header') { d.title = text('title'); d.repeatHeader = checked('repeatHeader'); }
    if (id === 'items') { d.collection = text('collection'); d.repeatTable = checked('repeatTable'); d.breakBefore = checked('breakBefore'); }
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
