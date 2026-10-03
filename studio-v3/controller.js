import { CommandBus } from '../studio-v2/core/command-bus.js';
import { compileProject, designOf, selectionField } from './model.js';
import { validateDesign } from './file-io.js';
import { datasetName, datasetTitleFor } from './database-model.js';
import { dataSource } from './data-provenance.js';
import { sectionOrder } from './design-authoring.js';

export function createBus(project, database = null, source = 'builtin-demo') {
  const initial = structuredClone(project);
  // Session data follows the same undo/redo snapshots as the active dataset.
  // It is excluded from the explicit save format and standalone serializer.
  initial.manifest.sampleDataTitle = database?.title ? datasetName(database.title) : datasetTitleFor(initial);
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
export async function replaceData(bus, data, sample = 'erp', database = undefined, sourceOverride = null, title = undefined) {
  const session = bus.project.studioV3Session;
  const names = {'0':'Empty','1':'Single item','45':'Standard','100':'Multi-page','500':'Stress',long:'Long & bilingual'};
  const source = sourceOverride || (sample !== 'erp' ? dataSource('validation-sample',names[sample] || sample) : database === undefined ? session.erpSource : dataSource(database?.origin || 'imported-data'));
  const name = title !== undefined ? datasetName(title) : database?.title ? datasetName(database.title) : datasetTitleFor(bus.project);
  const currency = data.document?.currency;
  if (currency !== undefined && !['MYR','USD','SGD','EUR','CNY','JPY'].includes(currency)) throw new Error('Dataset currency is unsupported. Choose a supported dataset currency.');
  return editProject(bus,[{type:'replace_sample_data',value:data},{type:'set_manifest_value',path:'/sampleDataTitle',value:name},...(currency ? [{type:'set_manifest_value',path:'/currency',value:currency}] : [])],`data: ${sample}`,{
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
  const tableStyle = () => {
    if (!values.has('rowBackground')) return;
    const color = text('rowBackground').trim();
    if (color) d.tableStyle = {...d.tableStyle,rowBackground:color};
    else { if (d.tableStyle) delete d.tableStyle.rowBackground; if (d.tableStyle && !Object.keys(d.tableStyle).length) delete d.tableStyle; }
  };
  const selection = selectionField(d,selected);
  const fieldStyle = prefix => {
    const style = {};
    for (const property of ['fontSize','bold','color','align']) {
      const value = text(`${prefix}.${property}`);
      if (value) style[property] = property === 'fontSize' ? Number(value) : property === 'bold' ? value === 'true' : value;
    }
    return style;
  };
  if (kind === 'style') {
    tableStyle();
    for (const key of ['color']) d[key] = text(key);
    for (const key of ['font','padding']) d[key] = Number(values.get(key));
    for (const key of ['striped','borders','pageNumbers']) d[key] = checked(key);
    if (values.has('pageNumberStyle.fontSize')) { const style = fieldStyle('pageNumberStyle'); if (Object.keys(style).length) d.pageNumberStyle = style; else delete d.pageNumberStyle; }
    if (values.has('paper')) d.page = {paper:text('paper'),orientation:text('orientation'),margins:Object.fromEntries(['top','right','bottom','left'].map(side=>[side,Number(values.get(`margin-${side}`))]))};
  } else if (kind === 'field' && selection) {
    for (const key of ['label','format']) if (values.has(key)) selection.field[key] = text(key);
    if (selection.block === 'items' && values.has('width')) selection.field.width = Number(values.get('width'));
    if (values.has('showLabel-present')) selection.field.showLabel = checked('showLabel');
    for (const prefix of ['labelStyle','valueStyle']) if (values.has(`${prefix}.fontSize`)) {
      const style = fieldStyle(prefix); if (Object.keys(style).length) selection.field[prefix] = style; else delete selection.field[prefix];
    }
  } else if (kind === 'binding' && selection) {
    const mode = text('bindingMode'), f = selection.field;
    f.lastPointer = text('pointer'); f.pointer = mode === 'bound' ? text('pointer') : ''; f.kind = mode;
    if (mode === 'image') { f.assetId = text('assetId'); f.width = Number(values.get('imageWidth')); f.height = Number(values.get('imageHeight')); f.fit = text('imageFit'); f.text = ''; f.format = ''; }
    else { f.text = text('text'); for (const key of ['assetId','height','fit']) delete f[key]; if (selection.block !== 'items') delete f.width; }
  } else if (kind === 'collection') {
    d.collection = text('collection');
  } else if (kind === 'block') {
    const id = selected.startsWith('header-') && !selection ? 'header' : selected === 'items-header' ? 'items' : selected;
    if (!d.blocks[id]) throw new Error('Select an existing section before Apply.');
    d.blocks[id].label = text('label'); d.blocks[id].enabled = checked('enabled');
    if (id === 'header') { d.title = text('title'); d.repeatHeader = checked('repeatHeader'); }
    if (id === 'header' && values.has('titleStyle.fontSize')) { const style = fieldStyle('titleStyle'); if (Object.keys(style).length) d.titleStyle = style; else delete d.titleStyle; }
    if (id === 'items') { d.repeatTable = checked('repeatTable'); d.breakBefore = checked('breakBefore'); tableStyle(); }
    else if (values.has('layoutColumns')) {
      if (text('layoutColumns') || text('layoutGap')) d.blocks[id].layout = {columns:Number(values.get('layoutColumns') || 1),gap:Number(values.get('layoutGap') || 0)}; else delete d.blocks[id].layout;
      d.blocks[id].keepTogether = checked('keepTogether'); if (id !== 'header') d.blocks[id].breakBefore = checked('sectionBreakBefore');
    }
    if (values.has('sectionPosition')) {
      const order = sectionOrder(d), position = Number(values.get('sectionPosition'));
      if (!Number.isInteger(position) || position < 0 || position >= order.length) throw new Error('Invalid section position.');
      if (order.indexOf(id) !== position) { d.sectionOrder = order.filter(block=>block !== id); d.sectionOrder.splice(position,0,id); }
    }
  } else if (kind === 'logo') {
    if (checked('removeLogo')) delete d.logo;
    else d.logo = {assetId:text('assetId'),width:Number(values.get('imageWidth')),height:Number(values.get('imageHeight')),fit:text('imageFit')};
  }
  return d;
}
export async function importRasterAsset(project,file,target) {
  if (!file || !['image/png','image/jpeg','image/gif','image/webp'].includes(file.type) || file.size > 1024*1024) throw new Error('Choose a PNG, JPEG, GIF or WebP image under 1 MB.');
  const source = await new Promise((resolve,reject)=> { const reader = new FileReader(); reader.onload = ()=>resolve(reader.result); reader.onerror = ()=>reject(new Error('Image file could not be read.')); reader.readAsDataURL(file); });
  const d = designOf(project), assets = d.assets || [];
  if (assets.length >= 10) throw new Error('Use at most ten embedded images.');
  const id = `asset-${crypto.randomUUID().slice(0,8)}`; d.assets = [...assets,{id,src:source,alt:''}];
  if (target === 'header-logo') d.logo = {assetId:id,width:52,height:52,fit:'contain'};
  else {
    const selected = selectionField(d,target);
    if (!selected || selected.block === 'items') throw new Error('Select a non-table field for an image.');
    const f = selected.field; f.lastPointer = f.pointer || f.lastPointer || ''; Object.assign(f,{kind:'image',pointer:'',text:'',format:'',assetId:id,width:80,height:60,fit:'contain'});
  }
  validateDesign(d); return d;
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
