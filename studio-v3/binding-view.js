import { resolvePointer } from '../studio-v2/core/json.js';
import { escape } from './template.js';
import { scalarFields } from './database-model.js';
import { fieldKind } from './design-authoring.js';

const input = (label,name,value,extra='') => `<label>${escape(label)}<input name="${name}" value="${escape(value ?? '')}" ${extra}></label>`;
export const applyRow = (label='Apply field') => `<div class="apply-row"><button class="primary">${label}</button><button type="button" data-action="cancel-draft">Cancel</button></div>`;
export function boundValue(project,pointer,relative=false) {
  const rows = resolvePointer(project.sampleData,project.manifest.studioV3.collection);
  return resolvePointer(project.sampleData,pointer,relative ? rows?.[0] : undefined);
}
function valueText(value) {
  if (value === undefined) return 'Missing value';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `Array · ${value.length} records`;
  if (typeof value === 'object') return 'Object';
  return String(value).slice(0,150);
}
function pickerOptions(project,relative=false) {
  const rows = resolvePointer(project.sampleData,project.manifest.studioV3.collection);
  let fields = relative ? scalarFields(rows?.[0] || {}).filter(f=>f.pointer.startsWith('/')).map(f=>({...f,pointer:`.${f.pointer}`})) : scalarFields(project.sampleData);
  if (relative && !fields.length) fields = project.manifest.studioV3.columns.filter(f=>f.pointer).map(f=>({pointer:f.pointer,type:['number','currency','percent'].includes(f.format) ? 'number' : 'text',value:undefined}));
  return fields.map(f=>`<option value="${escape(f.pointer)}">${escape(f.pointer)} · ${f.type} · ${escape(valueText(f.value))}</option>`).join('');
}
export function fieldBinding(project,selected) {
  const {field,block} = selected, relative = block === 'items', mode = fieldKind(field), pointer = field.pointer || field.lastPointer || (relative ? './description' : '/customer/name');
  const value = field.pointer ? boundValue(project,field.pointer,relative) : field.text || '';
  return `<form data-form="binding" class="form-stack">
    <label>Value source<select name="bindingMode" aria-label="Value source"><option value="bound" ${mode === 'bound' ? 'selected' : ''}>Bound value</option><option value="static" ${mode === 'static' ? 'selected' : ''}>Static text</option>${!relative ? `<option value="image" ${mode === 'image' ? 'selected' : ''}>Embedded image</option>` : ''}</select></label>
    ${input(relative ? 'Row field (./field)' : 'Data field (/field)','pointer',pointer,'maxlength="240" spellcheck="false"')}
    <label>Pick a data field<select data-binding-picker="pointer" aria-label="Pick a data field"><option value="">Path · type · sample value</option>${pickerOptions(project,relative)}</select></label>
    ${input('Static text','text',field.text || '','maxlength="10000"')}
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
export function collectionBinding(project) {
  const design = project.manifest.studioV3, value = resolvePointer(project.sampleData,design.collection);
  const options = [];
  const visit = (data,path='',depth=0) => {
    if (depth > 10 || options.length >= 50 || !data || typeof data !== 'object') return;
    for (const [key,next] of Object.entries(data)) {
      if (['__proto__','constructor','prototype'].includes(key)) continue;
      const pointer = `${path}/${key.replaceAll('~','~0').replaceAll('/','~1')}`;
      if (Array.isArray(next)) options.push(`<option value="${escape(pointer)}">${escape(pointer)} · array · ${next.length} records</option>`);
      else visit(next,pointer,depth+1);
    }
  };
  visit(project.sampleData);
  return `<form data-form="collection" class="form-stack">${input('Collection','collection',design.collection,'maxlength="240" spellcheck="false"')}<label>Pick a collection<select data-binding-picker="collection" aria-label="Pick a collection"><option value="">Path · type · sample</option>${options.join('')}</select></label><p class="${Array.isArray(value) ? 'callout' : 'binding-error'}">${escape(valueText(value))}<br>Each row uses ./field. Wildcards and expressions are not supported.</p>${applyRow('Apply collection')}</form>`;
}
