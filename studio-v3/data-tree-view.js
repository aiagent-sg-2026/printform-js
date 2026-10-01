import { escape } from './template.js';
import { icon } from './icons.js';
import { designOf, selectionField } from './model.js';
import { encodeKey, scalarFields } from './database-model.js';
import { resolvePointer } from '../studio-v2/core/json.js';

export function dataTree(project,state) {
  const design = designOf(project), selection = selectionField(design,state.selected);
  const rowField = selection?.block === 'items', collection = !selection && state.selected === 'items';
  let count = 0;
  const leaf = (pointer,value,scope,type = typeof value) => {
    const enabled = scope === 'collection' ? collection : Boolean(selection) && (scope === 'row') === rowField;
    const sample = Array.isArray(value) ? `${value.length} records` : value === undefined ? 'Missing sample' : value === null ? 'null' : String(value).slice(0,150);
    return `<div class="schema-leaf"><div><code>${escape(pointer)}</code><small>${escape(type)} · ${escape(sample)}</small></div><button type="button" data-tree-path="${escape(pointer)}" data-tree-scope="${scope}" ${enabled ? '' : 'disabled'}>Use ${escape(pointer)}</button></div>`;
  };
  const walk = (value,prefix = '',depth = 0) => {
    if (depth > 12 || count >= 250) return '';
    return Object.entries(value || {}).map(([key,next])=> {
      if (['__proto__','prototype','constructor'].includes(key) || ++count > 250) return '';
      const pointer = `${prefix}/${encodeKey(key)}`;
      if (Array.isArray(next)) return leaf(pointer,next,'collection','array');
      if (next && typeof next === 'object') return `<details class="schema-branch" ${depth < 1 ? 'open' : ''}><summary>${icon('next')}${escape(key)}</summary>${walk(next,pointer,depth+1)}</details>`;
      return leaf(pointer,next,'document',next === null ? 'null' : typeof next);
    }).join('');
  };
  const rows = resolvePointer(project.sampleData,design.collection);
  let fields = scalarFields(rows?.[0] || {}).map(f=>({...f,pointer:`.${f.pointer}`}));
  if (!fields.length) fields = design.columns.filter(f=>f.pointer).map(f=>({pointer:f.pointer,value:undefined,type:['number','currency','percent'].includes(f.format) ? 'number' : 'text'}));
  return `<div class="data-schema-tree"><h3>Document field tree</h3><p class="hint">Choose a form field in Design, then use a matching path here. Use changes the pending binding; Apply binding commits it.</p>${walk(project.sampleData)}<h3>Row fields · Collection ${escape(design.collection)}</h3><p class="hint">${rows?.length ? 'Values from the first record.' : 'Empty collection: paths from the template columns.'} Row paths use ./field, without a wildcard.</p>${fields.map(f=>leaf(f.pointer,f.value,'row',f.type)).join('')}<p class="hint muted">The tree shows up to 250 entries and 12 levels. Arrays are collection paths; row samples use the first record. Advanced JSON retains the complete data.</p></div>`;
}
