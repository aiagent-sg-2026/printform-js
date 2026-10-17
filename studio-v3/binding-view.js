import { resolvePointer } from '../studio-v2/core/json.js';
import { escape } from './template.js';
import { collectionFields, projectDescriptor } from './dataset-schema.js';
import { fieldKind } from './design-authoring.js';
import { tableOf } from './additional-tables.js';

const input = (label,name,value,extra='') => `<label>${escape(label)}<input name="${name}" value="${escape(value ?? '')}" ${extra}></label>`;
export const applyRow = (label='Apply field') => `<div class="apply-row"><button class="primary">${label}</button><button type="button" data-action="cancel-draft">Cancel</button></div>`;
export function boundValue(project,pointer,relative=false,collection=project.manifest.studioV3.collection) {
  const rows = resolvePointer(project.sampleData,collection);
  return resolvePointer(project.sampleData,pointer,relative ? rows?.[0] : undefined);
}
function valueText(value) {
  if (value === undefined) return 'Missing value';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `Array · ${value.length} records`;
  if (typeof value === 'object') return 'Object';
  return String(value).slice(0,150);
}
function pickerOptions(project,relative=false,collection=project.manifest.studioV3.collection) {
  const fields = relative ? collectionFields(project,collection) : projectDescriptor(project).fields;
  return fields.map(f=>`<option value="${escape(f.pointer)}">${escape(f.pointer)} · ${escape(f.type)} · ${f.origin}</option>`).join('');
}
export function fieldBinding(project,selected) {
  const {field,block} = selected, table = tableOf(project.manifest.studioV3,block), relative = Boolean(table), mode = fieldKind(field), pointer = field.pointer || field.lastPointer || (relative ? './description' : '/customer/name');
  const value = field.pointer ? boundValue(project,field.pointer,relative,table?.collection) : field.text || '';
  return `<form data-form="binding" class="form-stack">
    <label>Value source<select name="bindingMode" aria-label="Value source"><option value="bound" ${mode === 'bound' ? 'selected' : ''}>Bound value</option><option value="static" ${mode === 'static' ? 'selected' : ''}>Static text</option><option value="barcode" ${mode === 'barcode' ? 'selected' : ''}>Printable barcode</option>${!relative ? `<option value="image" ${mode === 'image' ? 'selected' : ''}>Embedded image</option>` : ''}</select></label>
    ${input(relative ? 'Row field (./field)' : 'Data field (/field)','pointer',pointer,'maxlength="240" spellcheck="false"')}
    <label>Pick a data field<select data-binding-picker="pointer" aria-label="Pick a data field"><option value="">Path · type · sample value</option>${pickerOptions(project,relative,table?.collection)}</select></label>
    ${input('Static text','text',field.text || '','maxlength="10000"')}
    <details ${mode === 'barcode' ? 'open' : ''}><summary>Offline barcode</summary><label>Barcode format<select name="barcodeFormat">${['CODE128','EAN13'].map(format=>`<option ${field.barcode?.format === format ? 'selected' : ''}>${format}</option>`).join('')}</select></label>${input('Bar module width (px)','barcodeModuleWidth',field.barcode?.moduleWidth ?? 2,'type="number" min="1" max="4" step="1"')}${input('Bar height (px)','barcodeHeight',field.barcode?.height ?? 48,'type="number" min="20" max="160" step="1"')}<label><input type="checkbox" name="barcodeDisplayValue" ${field.barcode?.displayValue !== false ? 'checked' : ''}>Print exact supplied text</label><p class="hint">Requires an existing string. EAN13 requires all 13 supplied digits and a valid check digit. No GS1 ownership or scanner/printer qualification is implied. Financial and canonical supplied facts cannot be replaced with bars.</p></details>
    ${!relative ? `<details ${mode === 'image' ? 'open' : ''}><summary>Embedded image source</summary>${imageControls(project.manifest.studioV3,field,`${block}-${field.id}`)}</details>` : ''}
    <p class="${field.pointer && value === undefined ? 'binding-error' : 'callout'}"><strong>${field.pointer ? 'Current bound value' : 'Current static text'}:</strong><br>${escape(valueText(value))}${relative ? '<br><small>Sample from the first collection record.</small>' : ''}</p>
    <p class="hint">Bound value reads the data path. Static text prints the literal text; the manual path is retained for switching back.</p>
    ${applyRow('Apply binding')}
  </form>`;
}
export function imageControls(design,image={},target='header-logo') {
  const options = (design.assets || []).map(asset=>`<option value="${escape(asset.id)}" ${image.assetId === asset.id ? 'selected' : ''}>${escape(asset.id)}</option>`).join('');
  return `<div class="form-stack"><label>Embedded asset<select name="assetId"><option value="">Choose an embedded image</option>${options}</select></label>
    ${input('Image width (px)','imageWidth',image.width || 80,'type="number" min="8" max="400"')}${input('Image height (px)','imageHeight',image.height || 60,'type="number" min="8" max="200"')}
    <label>Image fit<select name="imageFit"><option value="contain" ${image.fit !== 'cover' ? 'selected' : ''}>Contain</option><option value="cover" ${image.fit === 'cover' ? 'selected' : ''}>Cover</option></select></label>
    <label>Upload embedded image<input type="file" data-image-target="${escape(target)}" accept="image/png,image/jpeg,image/gif,image/webp"></label>
    <p class="hint">PNG, JPEG, GIF or WebP under 1 MB. Choosing a file commits it locally to this element. Images are excluded from AI context.</p></div>`;
}
export function collectionBinding(project,tableId='items') {
  const design = tableOf(project.manifest.studioV3,tableId), value = resolvePointer(project.sampleData,design.collection);
  const options = projectDescriptor(project).collections.map(collection=>`<option value="${escape(collection.pointer)}">${escape(collection.pointer)} · ${collection.rows} records · ${collection.origin}${collection.parentScope ? ` · parent ${escape(collection.parentScope)}` : ''}</option>`);
  return `<form data-form="collection" class="form-stack">${input('Collection','collection',design.collection,'maxlength="240" spellcheck="false"')}<label>Pick a collection<select data-binding-picker="collection" aria-label="Pick a collection"><option value="">Path · type · sample</option>${options.join('')}</select></label><p class="${Array.isArray(value) ? 'callout' : 'binding-error'}">${escape(valueText(value))}<br>Each row uses ./field. Wildcards and expressions are not supported.</p>${applyRow('Apply collection')}</form>`;
}
