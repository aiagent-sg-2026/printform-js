import { DATA_GROUPS, dataValue, groupFields, itemColumns, sameData } from './database-model.js';
import { escape } from './template.js';
import { icon } from './icons.js';
import { designOf } from './model.js';
import { sourceLabel } from './data-provenance.js';
import { applyRow } from './binding-view.js';

const action = (name,label,symbol='',extra='') => `<button type="button" data-db-action="${name}" ${extra}>${symbol ? icon(symbol) : ''}${escape(label)}</button>`;
export function databaseList(database,project) {
  const type = designOf(project).type, reference = project.studioV3Session.database;
  const records = database.records.filter(r => r.type === type);
  return `<h2 class="panel-heading">Local sample database</h2><div class="panel-body form-stack"><p class="hint">${database.store?.persistent ? 'IndexedDB · saved in this browser' : 'Tab only · storage unavailable'}<br>Synthetic client demo data. No remote database connection.</p>${records.map(r=>`<button type="button" class="dataset-choice ${reference?.id === r.id ? 'active' : ''}" data-db-select="${escape(r.id)}"><span>${escape(r.title)}</span><small>${r.data.items.length} rows · v${r.revision}</small></button>`).join('')}${action('refresh','Refresh saved datasets','data')}${action('import','Import dataset JSON','open')}${action('reset','Restore starter datasets','undo')}</div>`;
}
function editor(field,pointer = field.pointer) {
  const value = field.value ?? '', type = field.type || 'text';
  const attributes = `data-db-pointer="${escape(pointer)}" data-db-type="${type}" aria-label="${escape(pointer)}"`;
  if (type === 'boolean') return `<input type="checkbox" ${attributes} ${value ? 'checked' : ''}>`;
  if (typeof value === 'string' && (value.includes('\n') || value.length > 100)) return `<textarea ${attributes} rows="3">${escape(value)}</textarea>`;
  return `<input ${attributes} type="${type === 'number' ? 'number' : 'text'}" ${type === 'number' ? 'step="any"' : ''} value="${escape(value)}">`;
}
function fieldTable(data,group) {
  const fields = groupFields(data,group);
  return fields.length ? `<table class="database-table field-table"><thead><tr><th>Data path</th><th>Type</th><th>Value</th></tr></thead><tbody>${fields.map(f=>`<tr><th><code>${escape(f.pointer)}</code></th><td>${f.type}</td><td>${editor(f)}</td></tr>`).join('')}</tbody></table>` : '<p class="callout">No fields in this group. Use the advanced JSON editor to add custom fields.</p>';
}
function itemTable(database,data,design) {
  const columns = itemColumns(data,design), start = database.rowPage*25, rows = data.items || [];
  const visible = rows.slice(start,start+25);
  return `<div class="database-row-tools"><strong>Collection /items · ${rows.length} records</strong>${action('add-row','Add item','plus',rows.length >= 500 ? 'disabled' : '')}<span>${rows.length ? `${start+1}–${Math.min(start+25,rows.length)}` : '0'} of ${rows.length}</span>${action('previous-rows','Previous','previous',database.rowPage === 0 ? 'disabled' : '')}${action('next-rows','Next','next',start+25 >= rows.length ? 'disabled' : '')}</div><div class="database-table-scroll"><table class="database-table items-editor"><thead><tr>${columns.map(c=>`<th>${escape(c.label)}<code>.${escape(c.pointer)}</code><small>${c.type}</small></th>`).join('')}<th>Record</th></tr></thead><tbody>${visible.map((row,index)=>`<tr>${columns.map(c=>`<td>${editor({...c,value:dataValue(row,c.pointer)},`/items/${start+index}${c.pointer}`)}</td>`).join('')}<td>${action('delete-row',`Delete ${start+index+1}`,'trash',`data-row="${start+index}"`)}</td></tr>`).join('')}</tbody></table></div><p class="hint muted">Amounts, tax and totals are independent supplied values. Editing quantity or price does not calculate a new amount.</p>`;
}
export function databaseView(database,project,state) {
  const design = designOf(project), reference = project.studioV3Session.database;
  const saved = database.records.find(r=>r.id === reference?.id), data = database.draft?.data || project.sampleData;
  const title = database.draft?.title ?? saved?.title ?? `${project.manifest.title} · dataset`;
  const dirty = database.draft ? 'Table draft · not applied' : saved && sameData(project.sampleData,saved.data) ? 'Form matches saved dataset' : 'Current form draft · not saved to database';
  const source = `${sourceLabel(project)}${reference ? ` · loaded database v${reference.revision}` : ''}`;
  const stale = saved && saved.revision !== reference?.revision;
  const options = database.records.filter(r=>r.type === design.type).map(r=>`<option value="${escape(r.id)}" ${reference?.id === r.id ? 'selected' : ''}>${escape(r.title)}</option>`).join('');
  return `<div class="database-toolbar"><h2>${icon('data')}Sample database</h2><button type="button" data-layout="structure" aria-label="Toggle structure panel">${icon('header')}</button><button type="button" data-layout="properties" aria-label="Toggle properties panel">${icon('style')}</button>${action('preview','Print preview','eye')}</div><div class="database-content"><p class="database-storage ${database.store?.persistent ? '' : 'storage-warning'}">${database.store?.persistent ? 'IndexedDB · browser-local demo database' : 'Storage unavailable · this tab only'}<br><small>${database.store?.reason || 'Saved datasets survive reload. This browser is not connected to your ERP database.'}</small></p><div class="database-source"><strong>Source: ${escape(source)}</strong><span id="db-draft-status">${dirty}</span>${stale ? '<p class="callout">Saved dataset has a newer revision. Your form is unchanged. Reload saved data or save as new; stale overwrites are blocked.</p>' : ''}</div><p id="database-notice" class="database-notice" role="status">${escape(database.error || database.message || '')}</p><div class="database-identity"><label>Saved dataset<select id="database-choice"><option value="">Current form draft</option>${options}</select></label><label>Dataset name<input id="database-name" maxlength="100" value="${escape(title)}"></label></div><div class="database-actions">${action('save','Save & apply','save',!reference || state.sample !== 'erp' ? 'disabled' : '')}${action('copy','Save as new & apply','plus')}${action('reload','Reload saved','data',!saved ? 'disabled' : '')}${action('export','Export dataset JSON','download')}${action('import','Import dataset JSON','open')}${action('delete','Delete saved dataset','trash',!saved || state.sample !== 'erp' ? 'disabled' : '')}</div><nav class="database-groups" aria-label="Database tables">${DATA_GROUPS.map(([id,label])=>`<button type="button" data-db-group="${id}" aria-current="${database.group === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav><div class="database-editor">${database.group === 'json' ? `<form data-form="data" class="form-stack"><label for="data-json">Current data JSON</label><p class="hint">Apply changes the current form draft. Database persistence requires Save & apply or Save as new.</p><textarea class="data-editor wide-json" id="data-json" spellcheck="false">${escape(JSON.stringify(project.sampleData,null,2))}</textarea><p class="binding-error json-error" role="alert">${escape(state.jsonError || '')}</p>${applyRow('Apply JSON data')}</form>` : database.group === 'items' ? itemTable(database,data,design) : fieldTable(data,database.group)}</div><p class="hint muted">Save & apply writes the selected database record and updates the real print form. Undo/Redo changes the form draft only; it never rewrites saved database records. Existing form imports stay drafts until you save a new dataset. Save form and Export HTML include the active data, after Apply.</p></div>`;
}
