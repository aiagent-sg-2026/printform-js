import { CommandBus } from '../studio-v2/core/command-bus.js';
import { compileProject, designOf, selectionField } from './model.js';
import { validateDesign } from './file-io.js';
import { datasetName, datasetTitleFor } from './database-model.js';
import { dataSource } from './data-provenance.js';
import { sectionOrder, fieldKind } from './design-authoring.js';
import { tableStyleChange } from './table-style.js';
import { elementStyleChange } from './element-style.js';
import { assertProjectSchema, assertCollectionBinding, validateSourceSchema } from './dataset-schema.js';
import { pageFromForm } from './paper-controls.js';
import { validateImportReceipt } from './structured-import-receipt.js';
import { tableDefinitions, tableOf, fieldRows, isTable } from './additional-tables.js';
import { editAdditionalTable } from './additional-table-controls.js';
import { isSupportedCurrency, projectCurrencyIssue, suppliedPrimaryCurrency } from './currency-catalog.js';
import { validateBarcode } from '../studio-v2/core/barcode.js';
import { resolvePointer } from '../studio-v2/core/json.js';
import { protectedBindings } from './agent-binding-invariants.js';

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
  if (!isSupportedCurrency(preview.candidate.manifest.currency)) throw new Error('Unsupported currency. Select a catalog currency.');
  const currencyIssue = projectCurrencyIssue(preview.candidate);
  if (currencyIssue && (!projectCurrencyIssue(bus.project) || preview.candidate.manifest.currency !== bus.project.manifest.currency)) {
    throw Object.assign(new Error(currencyIssue.message),{code:currencyIssue.code});
  }
  assertProjectSchema(preview.candidate);
  if (operations.some(op=>op.type === 'replace_sample_data' || op.type === 'replace_manifest' || op.type === 'set_manifest_value' && op.path === '/localImport')) {
    validateImportReceipt(preview.candidate.manifest.localImport,preview.candidate.sampleData);
  }
  const beforeTables = tableDefinitions(designOf(bus.project));
  for (const table of tableDefinitions(design).filter(table=>table.enabled)) {
    const before = beforeTables.find(entry=>entry.id === table.id);
    const changed = !before?.enabled || before.collection !== table.collection || before.columns.length !== table.columns.length ||
      table.columns.some(column=> {
        const previous = before.columns.find(entry=>entry.id === column.id);
        return !previous || previous.pointer !== column.pointer || fieldKind(previous) !== fieldKind(column);
      });
    // Human primary text bindings can remain invalid until repaired; validation
    // still locks print/export. Actual array rebinding must retain empty schemas.
    const strict = table.id !== 'items' || table.columns.some(column=>fieldKind(column) === 'barcode');
    if (strict || changed && Array.isArray(resolvePointer(preview.candidate.sampleData,table.collection))) {
      assertCollectionBinding(preview.candidate,table.collection,table.columns,changed);
    }
  }
  for (const block of ['header','customer','totals','footer',...tableDefinitions(design).filter(table=>table.enabled).map(table=>table.id)]) {
    if (design.blocks[block] && !design.blocks[block].enabled) continue;
    const table = tableOf(design,block), scopes = table ? resolvePointer(preview.candidate.sampleData,table.collection) : [undefined];
    for (const field of fieldRows(design,block).filter(field=>field.kind === 'barcode')) for (const scope of scopes || []) validateBarcode(resolvePointer(preview.candidate.sampleData,field.pointer,scope),field.barcode);
  }
  const next = compileProject(preview.candidate, design);
  if (dataSession) next.studioV3Session = structuredClone(dataSession);
  return bus.commit(next, reason, {expectedRevision:revision});
}
export async function replaceData(bus, data, sample = 'erp', database = undefined, sourceOverride = null, title = undefined, sourceSchema = undefined, localImport = null) {
  const session = bus.project.studioV3Session;
  const names = {'0':'Empty','1':'Single item','45':'Standard','100':'Multi-page','500':'Stress',long:'Long & bilingual'};
  const source = sourceOverride || (sample !== 'erp' ? dataSource('validation-sample',names[sample] || sample) : database === undefined ? session.erpSource : dataSource(database?.origin || 'imported-data'));
  const name = title !== undefined ? datasetName(title) : database?.title ? datasetName(database.title) : datasetTitleFor(bus.project);
  const currency = suppliedPrimaryCurrency(data);
  const contract = sourceSchema === undefined ? null : validateSourceSchema(sourceSchema,data,database?.id);
  const schemaOperations = sourceSchema === undefined ? [] : [
    {type:'replace_schema',value:contract?.schema || {type:'object',additionalProperties:true}},
    {type:'set_manifest_value',path:'/datasetSchema',value:contract ? {sourceId:contract.sourceId,datasetId:contract.datasetId,version:contract.version} : null}
  ];
  schemaOperations.push({type:'set_manifest_value',path:'/localImport',value:localImport});
  return editProject(bus,[...schemaOperations,{type:'replace_sample_data',value:data},{type:'set_manifest_value',path:'/sampleDataTitle',value:name},...(currency ? [{type:'set_manifest_value',path:'/currency',value:currency}] : [])],`data: ${sample}`,{
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
  let d = designOf(project);
  selected = tableDefinitions(d).find(table=>`${table.id}-header` === selected)?.id || selected;
  const values = new FormData(form);
  const text = name => String(values.get(name) || '');
  const checked = name => values.has(name);
  const tableStyle = () => {
    if (!values.has('rowBackground')) return;
    const color = text('rowBackground').trim();
    d = tableStyleChange(d,'items',{rowBackground:color || null}).design;
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
    if (values.has('pageNumberStyle.fontSize')) d = elementStyleChange(d,'page-number',fieldStyle('pageNumberStyle')).design;
    if (values.has('paper')) d.page = pageFromForm(values);
  } else if (kind === 'field' && selection) {
    for (const key of ['label','format']) if (values.has(key)) selection.field[key] = text(key);
    if (isTable(d,selection.block) && values.has('width')) selection.field.width = Number(values.get('width'));
    if (values.has('showLabel-present')) selection.field.showLabel = checked('showLabel');
    for (const prefix of ['labelStyle','valueStyle']) if (values.has(`${prefix}.fontSize`)) {
      const style = fieldStyle(prefix); if (Object.keys(style).length) selection.field[prefix] = style; else delete selection.field[prefix];
    }
  } else if (kind === 'binding' && selection) {
    const mode = text('bindingMode'), f = selection.field;
    if (mode === 'barcode' && protectedBindings(project.manifest.studioV3).some(binding=>binding.block === selection.block && binding.id === f.id && binding.kind !== 'barcode')) throw new Error('Protected financial or canonical supplied facts cannot be replaced by a barcode. Add a separate barcode field.');
    const relative = isTable(d,selection.block);
    f.lastPointer = text('pointer'); f.pointer = ['bound','barcode'].includes(mode) ? text('pointer') : ''; f.kind = mode;
    if (mode === 'image') { f.assetId = text('assetId'); f.width = Number(values.get('imageWidth')); f.height = Number(values.get('imageHeight')); f.fit = text('imageFit'); f.text = ''; f.format = ''; delete f.barcode; }
    else {
      f.text = mode === 'barcode' ? '' : text('text');
      for (const key of ['assetId','height','fit']) delete f[key]; if (!relative) delete f.width;
      if (mode === 'barcode') { f.format = ''; f.barcode = {format:text('barcodeFormat'),moduleWidth:Number(values.get('barcodeModuleWidth')),height:Number(values.get('barcodeHeight')),displayValue:checked('barcodeDisplayValue')}; }
      else delete f.barcode;
    }
  } else if (kind === 'collection') {
    const table = tableOf(d,selected);
    if (table && table.id !== 'items') table.collection = text('collection'); else d.collection = text('collection');
  } else if (kind === 'additional-table') {
    d = editAdditionalTable(d,selected,values);
  } else if (kind === 'block') {
    const id = selected.startsWith('header-') && !selection ? 'header' : selected === 'items-header' ? 'items' : selected;
    if (!d.blocks[id]) throw new Error('Select an existing section before Apply.');
    d.blocks[id].label = text('label'); d.blocks[id].enabled = checked('enabled');
    if (id === 'header') { d.title = text('title'); d.repeatHeader = checked('repeatHeader'); }
    if (id === 'header' && values.has('titleStyle.fontSize')) d = elementStyleChange(d,'header-title',fieldStyle('titleStyle')).design;
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
    if (checked('removeLogo')) d.logo = null;
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
    if (!selected || isTable(d,selected.block)) throw new Error('Select a non-table field for an image.');
    const f = selected.field; f.lastPointer = f.pointer || f.lastPointer || ''; Object.assign(f,{kind:'image',pointer:'',text:'',format:'',assetId:id,width:80,height:60,fit:'contain'}); delete f.barcode;
  }
  validateDesign(d); return d;
}
export function alterFields(project, selected, action) {
  const d = designOf(project);
  selected = tableDefinitions(d).find(table=>`${table.id}-header` === selected)?.id || selected;
  const selection = selectionField(d,selected);
  const block = selection?.block || (d.blocks[selected] || tableOf(d,selected) ? selected : 'items');
  const list = fieldRows(d,block), relative = isTable(d,block);
  let nextSelection = selected;
  if (action === 'add-field') {
    if (list.length >= 30) throw new Error('A section supports at most 30 fields.');
    const id = `field-${crypto.randomUUID().slice(0,8)}`;
    const f = {id,label:'New field',pointer:relative ? list.find(field=>field.pointer)?.pointer || '' : '',format:'',text:relative ? '' : 'New text'};
    if (relative) {
      list.forEach(c => { c.width = Math.round(c.width * .9 * 100) / 100; });
      f.width = 10;
    }
    list.push(f); if (d.blocks[block]) d.blocks[block].enabled = true; else tableOf(d,block).enabled = true; nextSelection = `${block}-${id}`;
  } else if (selection) {
    if (action === 'remove-field') { list.splice(selection.index,1); nextSelection = block; }
    else {
      const target = selection.index + (action === 'move-up' ? -1 : 1);
      if (target >= 0 && target < list.length) [list[selection.index],list[target]] = [list[target],list[selection.index]];
    }
  }
  return {design:d,selected:nextSelection};
}
