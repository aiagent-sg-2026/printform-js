import { MAX_AUTHORING_OPERATIONS, GLOBAL_STYLE_KEYS, AUTHORING_CONTRACT, contractError, assertOperationContract } from './ai-authoring-contract.js';
import { DEMO_BINDING_PATHS } from './demo-binding-paths.js';
import { BLOCKS, selectionField, defaultDesign } from './model.js';
import { validateDesign } from './file-io.js';
import { resolvePointer } from '../studio-v2/core/json.js';
import { validPointer } from './design-authoring.js';
import { TABLE_STYLE_KEYS, isHexColor } from './table-style.js';

const unsafe = () => { throw Object.assign(new Error('UNSAFE_PROPOSAL'),{code:'UNSAFE_PROPOSAL'}); };
const fieldKeys = ['label','pointer','format','kind','text','showLabel','labelStyle','valueStyle','width','assetId','height','fit'];
const sectionKeys = ['enabled','label','layout','breakBefore','keepTogether'];
const object = (value,keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>!keys.includes(k))) unsafe();
};
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const display = value => value === undefined ? '(unset)' : typeof value === 'object' ? JSON.stringify(value) : value;
const fieldList = (d,id) => id === 'items' ? d.columns : d[id];
function reorder(list,order,ids) {
  if (!Array.isArray(order) || order.length !== list.length || new Set(order).size !== list.length || order.some(id=>!ids.includes(id))) unsafe();
  return order.map(id=>list[ids.indexOf(id)]);
}
export const AUTHORING_TYPES = ['set_element_style','set_style','set_table_style','set_field','add_field','remove_field','reorder_fields','set_section','reorder_sections','set_page','set_logo','set_collection','set_heading'];
export function applyAuthoring(design,operations,project,explicitPointers=[]) {
  if (!Array.isArray(operations) || !operations.length) unsafe();
  if (operations.length > MAX_AUTHORING_OPERATIONS) throw contractError('AUTHORING_OPERATION_LIMIT',{operationCount:operations.length,maxOperations:MAX_AUTHORING_OPERATIONS});
  assertOperationContract(operations,design);
  const diff = [], targets = [], seen = new Set();
  const record = (target,property,before,after) => {
    const key = `${target.replace(/^label-/,'')}:${property}`; if (seen.has(key)) unsafe(); seen.add(key);
    if (!same(before,after)) diff.push({target,property,before:display(before),after:display(after)});
    targets.push(target);
  };
  for (const op of operations) {
    object(op,['type','target','patch','section','field','order','value']);
    if (!AUTHORING_TYPES.includes(op.type)) unsafe();
    if (op.type === 'set_element_style') {
      object(op,['type','target','patch']); object(op.patch,['fontSize','bold','color','align']);
      const key = {'header-title':'titleStyle','page-number':'pageNumberStyle'}[op.target]; if (!key) unsafe();
      record(op.target,'typography',design[key],op.patch); design[key] = structuredClone(op.patch);
    } else if (op.type === 'set_style') {
      object(op,['type','patch']);
      object(op.patch,GLOBAL_STYLE_KEYS);
      for (const [key,value] of Object.entries(op.patch)) { record('style',key,design[key],value); design[key] = structuredClone(value); }
    } else if (op.type === 'set_table_style') {
      object(op,['type','target','patch']); object(op.patch,TABLE_STYLE_KEYS);
      if (op.target !== 'items') unsafe();
      for (const [key,value] of Object.entries(op.patch)) {
        if (value !== null && !isHexColor(value)) unsafe();
        record('items',`tableStyle.${key}`,design.tableStyle?.[key],value === null ? undefined : value);
        if (value === null) { if (design.tableStyle) delete design.tableStyle[key]; }
        else design.tableStyle = {...design.tableStyle,[key]:value};
      }
      if (design.tableStyle && !Object.keys(design.tableStyle).length) delete design.tableStyle;
    } else if (op.type === 'set_field') {
      object(op,['type','target','patch']); object(op.patch,fieldKeys);
      const selected = selectionField(design,op.target); if (!selected) unsafe();
      if (op.target.startsWith('label-') && Object.keys(op.patch).some(key=>!['label','showLabel','labelStyle'].includes(key))) unsafe();
      const financial = selected.field.pointer && (selected.field.format === 'currency' || /(?:^|[-/_])(amount|total|subtotal|tax|rate|price|balance|discount)(?:[-/_]|$)/i.test(`${selected.field.id}/${selected.field.pointer}`));
      const suppliedNumber = selected.field.pointer && (['currency','number','percent'].includes(selected.field.format) || financial);
      if (suppliedNumber && (Object.hasOwn(op.patch,'text') || (op.patch.kind !== undefined && op.patch.kind !== 'bound') || (financial && op.patch.pointer !== undefined && op.patch.pointer !== selected.field.pointer) || (op.patch.format !== undefined && op.patch.format !== selected.field.format))) unsafe();
      for (const [key,value] of Object.entries(op.patch)) {
        record(op.target,key,selected.field[key],value); selected.field[key] = structuredClone(value);
      }
      // Explicit mode transitions cannot retain hidden bound data.
      if ((op.patch.kind === 'static' || op.patch.kind === 'image') && selected.field.pointer) { record(op.target,'pointer',selected.field.pointer,''); selected.field.pointer = ''; }
      if (op.patch.kind && op.patch.kind !== 'image') for (const key of ['assetId','height','fit',...(selected.block === 'items' ? [] : ['width'])]) {
        if (selected.field[key] !== undefined) { record(op.target,key,selected.field[key],undefined); delete selected.field[key]; }
      }
    } else if (op.type === 'add_field') {
      object(op,['type','section','field']); object(op.field,['id',...fieldKeys]);
      if (!BLOCKS.includes(op.section)) unsafe();
      const list = fieldList(design,op.section), f = structuredClone(op.field);
      if (list.some(item=>item.id === f.id)) unsafe();
      if (!Object.hasOwn(f,'format')) f.format = '';
      if (!Object.hasOwn(f,'label')) f.label = '';
      if (!Object.hasOwn(f,'pointer')) f.pointer = '';
      if (!f.pointer && (['currency','number','percent'].includes(f.format) || /(?:^|-)(amount|total|subtotal|tax|rate|price|balance|discount)(?:-|$)/i.test(f.id))) unsafe();
      if (op.section === 'items' && !Object.hasOwn(f,'width')) unsafe();
      list.push(f); record(`${op.section}-${f.id}`,'add_field',null,`${op.section}-${f.id}`);
      for (const [key,value] of Object.entries(f)) record(`${op.section}-${f.id}`,key,undefined,value);
    } else if (op.type === 'remove_field') {
      object(op,['type','target']); if (typeof op.target !== 'string' || op.target.startsWith('label-')) unsafe(); const selected = selectionField(design,op.target); if (!selected) unsafe();
      for (const [key,value] of Object.entries(selected.field)) record(op.target,key,value,undefined);
      fieldList(design,selected.block).splice(selected.index,1); record(op.target,'remove_field',op.target,null);
    } else if (op.type === 'reorder_fields') {
      object(op,['type','section','order']); if (!BLOCKS.includes(op.section)) unsafe();
      const list = fieldList(design,op.section), ids = list.map(f=>`${op.section}-${f.id}`);
      const next = reorder(list,op.order,ids); record(op.section,'field_order',ids,op.order);
      if (op.section === 'items') design.columns = next; else design[op.section] = next;
    } else if (op.type === 'set_section') {
      object(op,['type','target','patch']); object(op.patch,sectionKeys); if (!BLOCKS.includes(op.target)) unsafe();
      for (const [key,value] of Object.entries(op.patch)) { record(op.target,key,design.blocks[op.target][key],value); design.blocks[op.target][key] = structuredClone(value); }
    } else if (op.type === 'reorder_sections') {
      object(op,['type','order']); const next = reorder(BLOCKS,op.order,BLOCKS);
      record('document','sectionOrder',design.sectionOrder || BLOCKS,next); design.sectionOrder = next;
    } else if (op.type === 'set_page') {
      object(op,['type','patch']); object(op.patch,['paper','orientation','margins']);
      for (const [key,value] of Object.entries(op.patch)) { record('document',`page.${key}`,design.page?.[key],value); design.page = {...design.page,[key]:structuredClone(value)}; }
    } else if (op.type === 'set_logo') {
      object(op,['type','value']); if (op.value !== null) object(op.value,['assetId','width','height','fit']);
      record('header-logo','logo',design.logo,op.value); if (op.value === null) delete design.logo; else design.logo = structuredClone(op.value);
    } else if (op.type === 'set_collection') {
      object(op,['type','value']); record('items','collection',design.collection,op.value); design.collection = op.value;
    } else if (op.type === 'set_heading') {
      object(op,['type','value']); record('header-title','title',design.title,op.value); design.title = op.value;
    }
  }
  if (design.columns.reduce((sum,c)=>sum+c.width,0) > 100.01) throw Object.assign(new Error('COLUMN_WIDTH_LIMIT'),{code:'COLUMN_WIDTH_LIMIT'});
  try { validateDesign(design); } catch { unsafe(); }
  // Binding edits select current local paths; they never create/recalculate ERP values.
  for (const block of BLOCKS) for (const f of fieldList(design,block)) {
    const old = selectionField(project.manifest.studioV3,`${block}-${f.id}`)?.field;
    if (f.pointer && (f.pointer !== old?.pointer || (block === 'items' && design.collection !== project.manifest.studioV3.collection)) && !availableBindings(project,explicitPointers,design.collection).some(b=>b.pointer === f.pointer && b.relative === (block === 'items') && (!b.relative || b.collection === design.collection) && b.type !== 'array')) unsafe();
  }
  if (design.collection !== project.manifest.studioV3.collection && !availableBindings(project,explicitPointers).some(b=>b.pointer === design.collection && b.type === 'array')) unsafe();
  return {diff,targets};
}

const sensitiveKey = /password|passwd|secret|token|credential|api.?key|authorization|cookie|session|ssn|credit.?card/i;
const safeKey = key => /^[a-zA-Z_][a-zA-Z0-9_-]{0,59}$/.test(key) && !sensitiveKey.test(key) && !/\d{4,}/.test(key);
export function explicitBindingPointers(request='',references=[]) {
  return [...new Set([request,...references.map(r=>r.comment || '')].join(' ').match(/(?:\.\/|\/)[a-zA-Z0-9_~/-]{1,238}/g) || [])].slice(0,20);
}
export function availableBindings(project,explicitPointers=[],effectiveCollection=project.manifest.studioV3.collection) {
  const result = [], seen = new Set(), collection = project.manifest.studioV3.collection;
  const collections = [...new Set([collection,effectiveCollection,...explicitPointers.filter(pointer=>pointer.startsWith('/') && Array.isArray(resolvePointer(project.sampleData,pointer)))])];
  const add = (pointer,owner=collection) => {
    const relative = pointer.startsWith('./'), key = relative ? `${owner}:${pointer}` : pointer; if (seen.has(key) || result.length >= 80 || !validPointer(pointer,relative)) return;
    const value = resolvePointer(project.sampleData,pointer,relative ? resolvePointer(project.sampleData,owner)?.[0] : undefined);
    const type = Array.isArray(value) ? 'array' : typeof value;
    if (!['array','string','number','boolean'].includes(type)) return;
    seen.add(key); result.push({pointer,type,relative,...(relative ? {collection:owner} : {})});
  };
  // A closed framework contract supplies known paths. Never enumerate raw
  // dataset object keys, which may be private names or record identifiers.
  for (const type of ['invoice','purchase','delivery']) {
    const d=defaultDesign(type); add(d.collection);
    for (const id of BLOCKS) for (const f of fieldList(d,id)) if (f.pointer.startsWith('./')) for (const owner of collections) add(f.pointer,owner); else add(f.pointer);
  }
  for (const pointer of DEMO_BINDING_PATHS) if (pointer.startsWith('./')) for (const owner of collections) add(pointer,owner); else add(pointer);
  const walkSchema = (schema,path='',depth=0,owner=collection)=> {
    if (depth > 4 || !schema || typeof schema !== 'object') return;
    if (schema.type === 'array') { add(path); if (collections.includes(path)) walkSchema(schema.items,'.',depth+1,path); }
    else for (const [key,child] of Object.entries(schema.properties || {})) if (safeKey(key)) walkSchema(child,`${path}/${key}`,depth+1,owner);
    if (['string','number','boolean'].includes(schema.type)) add(path,owner);
  };
  walkSchema(project.schema); for (const pointer of explicitPointers) if (pointer.startsWith('./')) for (const owner of collections) add(pointer,owner); else add(pointer); return result;
}
export function shareAuthoring(project,context={}) {
  const d = project.manifest.studioV3;
  return {
    contract:AUTHORING_CONTRACT,
    sections:BLOCKS.map(id=>({id,enabled:d.blocks[id].enabled,layout:d.blocks[id].layout || {},breakBefore:Boolean(d.blocks[id].breakBefore),keepTogether:Boolean(d.blocks[id].keepTogether),fields:fieldList(d,id).map(f=>({id:`${id}-${f.id}`,kind:f.kind || (f.pointer ? 'bound' : 'static'),format:f.format,width:f.width,labelStyle:f.labelStyle || {},valueStyle:f.valueStyle || {},showLabel:f.showLabel !== false}))})),
    elements:[{id:'header-title',style:d.titleStyle || {}},{id:'page-number',style:d.pageNumberStyle || {}},{id:'header-logo',assetId:d.logo?.assetId || null},{id:'items',style:d.tableStyle || {},styleOperation:'set_table_style'}],sectionOrder:d.sectionOrder || BLOCKS,page:d.page || {paper:'A4',orientation:'portrait'},
    assets:(d.assets || []).map(({id})=>({id})),bindings:availableBindings(project,explicitBindingPointers(context.request,context.references))
  };
}
