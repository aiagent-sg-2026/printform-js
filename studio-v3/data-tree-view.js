import { escape } from './template.js';
import { icon } from './icons.js';
import { designOf, selectionField } from './model.js';
import { encodeKey } from './database-model.js';
import { collectionFields, projectDescriptor } from './dataset-schema.js';
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
      if (Array.isArray(next)) return '';
      if (next && typeof next === 'object') return `<details class="schema-branch" ${depth < 1 ? 'open' : ''}><summary>${icon('next')}${escape(key)}</summary>${walk(next,pointer,depth+1)}</details>`;
      return leaf(pointer,next,'document',next === null ? 'null' : typeof next);
    }).join('');
  };
  const rows = resolvePointer(project.sampleData,design.collection);
  const fields = collectionFields(project), descriptor = projectDescriptor(project);
  return `<div class="data-schema-tree"><h3>Document field tree</h3><p class="hint">Choose a form field in Design, then use a matching path here. Use changes the pending binding; Apply binding commits it.</p>${walk(project.sampleData)}<h3>Collections · exact parent scope</h3>${descriptor.collections.map(entry=>leaf(entry.pointer,resolvePointer(project.sampleData,entry.pointer),'collection',`${entry.origin}${entry.parentScope ? ` · parent ${entry.parentScope}` : ''}`)).join('')}<h3>Row fields · Collection ${escape(design.collection)}</h3><p class="hint">${rows?.length ? 'Fields observed across every row; declared fields retain their source schema.' : 'Empty collection: only explicit schema fields are available.'} Row paths use ./field, without a wildcard.</p>${fields.map(f=>leaf(f.pointer,undefined,'row',`${f.type} · ${f.origin}${f.required ? '' : ' · optional'}`)).join('')}<p class="hint muted">Observed fields are not an authoritative schema. Advanced JSON retains complete data; nested collections retain their exact parent pointer.</p></div>`;
}
