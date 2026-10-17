import { escape } from './template.js';
import { importTargets, targetScopes } from './structured-import-model.js';
import { importValue } from './structured-import-values.js';

const button = (action,label,disabled=false) => `<button type="button" data-db-action="${action}" ${disabled ? 'disabled' : ''}>${escape(label)}</button>`;
const sample = value => { const text = JSON.stringify(value); return text === undefined ? '(missing)' : text.length > 160 ? `${text.slice(0,160)}…` : text; };
const options = (entries,value) => entries.map(entry=>`<option value="${escape(entry.pointer)}" ${entry.pointer === value ? 'selected' : ''}>${escape(entry.label || entry.pointer)}</option>`).join('');
function mappingTable(review,targets,scope) {
  const conversions = [['preserve','Keep exact source (no conversion)'],['text','Explicit text conversion'],['number','Explicit number conversion'],['boolean','Explicit boolean conversion']];
  return `<div class="database-table-scroll"><table class="database-table structured-import-table"><thead><tr><th>Existing form target</th><th>Source field · first record example</th><th>Explicit conversion</th></tr></thead><tbody>${targets.map(target=> {
    const mapping = review.mappings[target.pointer] || {source:'',conversion:'preserve'};
    return `<tr><th>${escape(target.label)}${target.required ? ' · required' : ''}<code>${escape(target.pointer)}</code><small>${escape(target.type)}</small></th><td><select aria-label="Source for ${escape(target.pointer)}" data-db-import-control="field" data-db-import-field="${escape(target.pointer)}"><option value="">Do not map</option>${scope.fields.map(field=>`<option value="${escape(field.pointer)}" ${mapping.source === field.pointer ? 'selected' : ''}>${escape(field.pointer)} · ${escape(sample(importValue(scope.rows[0],field.pointer)))}</option>`).join('')}</select></td><td><select aria-label="Conversion for ${escape(target.pointer)}" data-db-import-control="conversion" data-db-import-field="${escape(target.pointer)}">${conversions.map(([value,label])=>`<option value="${value}" ${mapping.conversion === value ? 'selected' : ''}>${label}</option>`).join('')}</select></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function previewTable(review) {
  const preview = review.preview;
  if (!preview) return '<p class="callout">No valid preview yet. Every record and the unchanged current source schema must pass before Apply is enabled.</p>';
  const rows = preview.rows.slice(0,10);
  return `<section aria-label="Reviewed import preview"><h3>Validated preview · ${preview.rows.length} records · first ${rows.length} shown</h3><p class="hint">${review.targetPointer ? `Replace ${escape(review.targetPointer)} only, in the original source order. No old row defaults are copied.` : 'Only mapped form fields change.'} All other form data remains unchanged. This is a data preview; the printed form changes only after Apply.</p><div class="database-table-scroll"><table class="database-table structured-import-preview"><thead><tr><th>Source order</th>${preview.mappings.map(mapping=>`<th>${escape(mapping.target)}<small>${escape(mapping.conversion)}</small></th>`).join('')}</tr></thead><tbody>${rows.map((row,index)=>`<tr><th>${index+1}</th>${preview.mappings.map(mapping=>`<td><small>Source: ${escape(sample(importValue(preview.sourceRows[index],mapping.source)))}</small><br>Result: ${escape(sample(importValue(row,mapping.target)))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="hint">No tax, currency, amount, UOM, approval, posting, stock or payroll facts are inferred or calculated. Explicit numeric conversion uses JavaScript numbers and may remove decimal spelling; the exact original file remains in the local import receipt.</p></section>`;
}
export function structuredImportView(database,project) {
  const review = database.importReview, scope = review.source.scopes.find(entry=>entry.pointer === review.sourcePointer);
  const targets = importTargets(project,review.targetPointer);
  return `<div class="database-toolbar"><h2>Review local CSV / JSON import</h2>${button('import-cancel','Cancel import')}</div>
    <div class="database-content"><p class="database-source"><strong>${escape(review.source.filename)} · ${review.source.format.toUpperCase()} · local file (unverified provenance)</strong><br>Nothing has changed in the form or saved database. This importer does not upload source values.</p>
    <p id="database-notice" class="database-notice" role="status">${escape(database.error || database.message || '')}</p>
    <div class="database-identity"><label>Source record / collection<select id="database-import-source" data-db-import-control="source">${options(review.source.scopes,review.sourcePointer)}</select></label><label>Existing form target<select id="database-import-target" data-db-import-control="target">${options(targetScopes(project),review.targetPointer)}</select></label></div>
    <p class="hint">Map the fields below. Conversions are explicit; every source record must validate before Apply.</p>
    <details><summary>Import rules and data safety</summary><p class="hint">Select the exact parent scope for nested JSON arrays; arrays are never flattened together. Form-field mapping requires one source record. CSV values and JSON numeric tokens stay text, including leading zeros and decimal precision. Choose a conversion when a target requires a number or boolean. Protected source/status/approval/signature fields cannot be mapped.</p></details>
    ${mappingTable(review,targets,scope)}${previewTable(review)}
    <p class="callout"><strong>Review before saving or sharing:</strong> Apply keeps the complete original file, filename and mapping locally. Saved forms, dataset exports and exported HTML include it, including unselected source columns. Use fictional or authorized files only. Unmapped form fields and supplied totals stay unchanged; nothing is calculated. Undo restores previous data and receipt; Cancel changes nothing.</p>
    <div class="database-actions">${button('import-preview','Preview mapped data')}${button('import-apply','Apply reviewed import',!review.preview)}${button('import','Replace import file')}${button('import-cancel','Cancel import')}</div></div>`;
}
