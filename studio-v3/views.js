import { BLOCKS, designOf, selectionField } from './model.js';
import { escape } from './template.js';
import { icon } from './icons.js';
import { inspectProject } from './validation.js';

export const SAMPLES = [['erp','ERP / current data','Your supplied dataset'],['0','Empty','0 rows'],['1','Single item','1 row'],['45','Standard','45 rows'],['100','Multi-page','100 rows'],['500','Stress','500 rows'],['long','Long & bilingual','45 rows']];
const button = (action, text, symbol = '', extra = '') => `<button type="button" data-action="${action}" ${extra}>${symbol ? icon(symbol) : ''}${escape(text)}</button>`;
const input = (label, name, value, type = 'text', extra = '') => `<label>${escape(label)}<input name="${name}" type="${type}" value="${escape(value)}" ${extra}></label>`;
const check = (label, name, checked) => `<label class="checkbox"><input name="${name}" type="checkbox" ${checked ? 'checked' : ''}>${escape(label)}</label>`;
const formats = value => `<label>Display format<select name="format">${[['','Plain text'],['number','Number'],['currency','Currency'],['percent','Percent']].map(([v,l]) => `<option value="${v}" ${value === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
const fieldButton = (id, label, state) => `<button type="button" class="tree-node ${state.selected === id ? 'active' : ''}" data-select="${escape(id)}" ${state.selected === id ? 'aria-current="true"' : ''}>${icon('field')}<span class="tree-label">${escape(label)}</span></button>`;

function samples(state) {
  return `<div class="sample-list">${SAMPLES.map(([id,label,detail]) => `<button type="button" class="${state.sample === id ? 'active' : ''}" data-sample="${id}"><span>${escape(label)}</span><small>${detail}</small></button>`).join('')}</div>`;
}
function styleForm(d) {
  return `<form data-form="style" class="form-stack">${input('Brand color','color',d.color,'color')}${input('Font size (pt)','font',d.font,'number','min="6" max="14" step="0.5"')}${input('Cell padding (px)','padding',d.padding,'number','min="2" max="16"')}${check('Alternate item rows','striped',d.striped)}${check('Table borders','borders',d.borders)}${check('Page numbers','pageNumbers',d.pageNumbers)}<button class="primary">Apply style</button></form>`;
}
export function leftView(project, state) {
  const d = designOf(project);
  if (state.mode !== 'design') {
    return `<h2 class="panel-heading">${state.mode === 'validate' ? 'Validation samples' : 'Data sources'}</h2><div class="panel-body form-stack">${samples(state)}<p class="hint">Synthetic samples are isolated from your ERP dataset. Switch back to ERP / current data to restore it.</p>${state.mode === 'validate' ? button('validate-all',state.running ? 'Stop validation' : 'Run all synthetic samples','check') : ''}</div><details open><summary>${icon('data')}Binding guide</summary><div class="panel-body"><p class="callout">Collection <strong>/items</strong><br>Each row field <strong>./description</strong><br>Document field <strong>/customer/name</strong></p><p class="muted">Studio formats supplied values. Your ERP owns amounts, tax, discounts and rounding.</p></div></details>`;
  }
  const tree = BLOCKS.map(id => {
    const block = d.blocks[id];
    const fields = id === 'items' ? d.columns : d[id];
    return `<div class="tree-group ${!block.enabled ? 'tree-disabled' : ''}"><button type="button" class="tree-node ${state.selected === id ? 'active' : ''}" data-select="${id}">${icon(id)}<strong>${escape(block.label)}</strong>${!block.enabled ? '<small>Hidden</small>' : ''}</button>${block.enabled ? `<div class="tree-fields">${fields.map(f => fieldButton(`${id}-${f.id}`,f.label,state)).join('')}</div>` : ''}</div>`;
  }).join('');
  return `<h2 class="panel-heading">Template structure</h2><nav aria-label="Form components">${tree}</nav><div class="tree-footer">${button('add-field','Add field / column','plus')}<p class="hint muted">Select a section or a field on the paper to edit it.</p></div><details><summary>${icon('data')}Data</summary><div class="panel-body"><p class="hint muted">${project.sampleData?.items?.length ?? '—'} sample rows · ${project.manifest.currency}</p>${button('go-data','Manage bindings','data')}</div></details><details><summary>${icon('style')}Style</summary><div class="panel-body">${styleForm(d)}</div></details>`;
}
function qualityView(project, state) {
  const q = inspectProject(project, state.report);
  const errorButtons = q.errors.slice(0,15).map(e => `<button class="issue" type="button" data-issue="${escape(e.component || '')}"><span>${escape(e.message || e.code)}<span class="path">${escape(e.path || e.code)}</span></span></button>`).join('');
  return `<details ${state.mode === 'validate' ? 'open' : ''}><summary>${icon('check')}Quality (${q.errors.length} issues)</summary><div class="panel-body"><p class="${q.ready ? 'quality-ok' : 'muted'}">${q.ready ? 'Current browser layout passed.' : state.report ? 'Resolve issues and render again.' : 'Waiting for the current render.'}</p>${errorButtons}${q.warnings.map(e => `<p class="hint muted">${escape(e.message || e.code)}</p>`).join('')}<p class="hint muted">Check every printed page in your browser’s print preview. Native printer output and ERP calculations require your review.</p>${button('rerender','Render again','check')}</div></details>`;
}
function fieldProperties(d, selected) {
  const {field:f, block, index} = selected;
  const count = (block === 'items' ? d.columns : d[block]).length;
  return `<form data-form="field" class="form-stack">${input('Label','label',f.label,'text','maxlength="100"')}${input(block === 'items' ? 'Row field (./field)' : 'Data field (/field)','pointer',f.pointer,'text','maxlength="240" spellcheck="false"')}${block !== 'items' ? input('Static text (clear binding to use)','text',f.text || '','text','maxlength="10000"') : ''}${formats(f.format)}${block === 'items' ? input('Width (%)','width',f.width,'number','min="1" max="100"') : ''}<p class="hint">${block === 'items' ? 'Each field repeats for every record in the collection.' : 'Bind to your data or clear the binding and use static text.'}</p><button class="primary">Apply field</button></form><div class="action-row" style="margin-top:14px">${button('move-up','Up','up',index === 0 ? 'disabled' : '')}${button('move-down','Down','down',index === count-1 ? 'disabled' : '')}${button('remove-field','Remove','trash')}</div>`;
}
function blockProperties(d, id) {
  const block = d.blocks[id];
  const props = `<form data-form="block" class="form-stack">${input('Section name','label',block.label,'text','maxlength="100"')}${check('Show section','enabled',block.enabled)}${id === 'header' ? input('Document heading','title',d.title,'text','maxlength="100"') + check('Repeat header on every page','repeatHeader',d.repeatHeader) : ''}${id === 'items' ? input('Collection','collection',d.collection,'text','maxlength="240" spellcheck="false"') + check('Repeat table header','repeatTable',d.repeatTable) + check('Page break before items','breakBefore',d.breakBefore) : ''}<button class="primary">Apply section</button></form>`;
  const fields = id === 'items' ? d.columns : d[id];
  const list = id === 'items' ? `<h3 style="margin-top:20px;font-size:13px">Columns</h3><div class="columns-list">${fields.map(f => `<div class="column-entry"><button type="button" data-select="items-${escape(f.id)}">${escape(f.label)}</button><span>${f.width}%</span></div>`).join('')}</div>` : '';
  return props + list + `<div class="action-row" style="margin-top:14px">${button('add-field',id === 'items' ? 'Add column' : 'Add field','plus')}</div>`;
}
function dataView(project, state) {
  const d = designOf(project);
  const binding = selectionField(d,state.selected);
  return `<h2 class="panel-heading">Data binding & sample</h2><div class="panel-body form-stack">${binding ? `<h3 class="inspector-title">${icon('field')}${escape(binding.field.label)}</h3>${fieldProperties(d,binding)}` : state.selected === 'items' ? blockProperties(d,'items') : `<p class="callout">Collection <strong>${escape(d.collection)}</strong><br>Select a field in Design to change its binding.</p>`}<form data-form="locale" class="form-stack"><label>Locale<select name="locale">${['en-MY','zh-CN','ms-MY','ja-JP','vi-VN'].map(l => `<option ${l === project.manifest.locale ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Currency<select name="currency">${['MYR','USD','SGD','EUR','CNY','JPY'].map(l => `<option ${l === project.manifest.currency ? 'selected' : ''}>${l}</option>`).join('')}</select></label><button>Apply locale</button></form><form data-form="data" class="form-stack"><label for="data-json">ERP sample JSON</label><textarea class="data-editor" id="data-json" spellcheck="false">${escape(state.dataDraft ?? JSON.stringify(project.sampleData,null,2))}</textarea><button class="primary">Apply JSON data</button><p class="hint">Data stays in this tab. Save and Export include the active dataset in the downloaded file.</p></form></div>`;
}
export function rightView(project, state) {
  const d = designOf(project);
  const q = inspectProject(project,state.report);
  const quality = qualityView(project,state);
  if (state.mode === 'validate') {
    const matrix = SAMPLES.filter(([id]) => id !== 'erp').map(([id,label]) => {
      const r = state.matrix[id];
      return `<p class="hint ${r?.ready ? 'quality-ok' : 'muted'}">${escape(label)}: ${r ? r.ready ? `${r.metrics.logicalPages} pages · passed` : `${r.errors.length} issue(s)` : 'Not checked'}</p>`;
    }).join('');
    return `<h2 class="panel-heading">Validate this revision</h2><div class="panel-body form-stack"><div class="metrics"><div class="metric"><strong>${q.metrics.rows ?? '—'}</strong>Rows</div><div class="metric"><strong>${q.metrics.logicalPages ?? '—'}</strong>Pages</div><div class="metric"><strong>${q.metrics.overflowElements ?? '—'}</strong>Horizontal overflow</div><div class="metric"><strong>${q.metrics.verticalOverflowPages ?? '—'}</strong>Vertical overflow</div></div><p class="hint">Measured row height determines page breaks. Rows stay intact; oversized rows are reported.</p><h3 style="font-size:13px">Sample matrix</h3>${matrix}<p class="hint muted">This matrix is tied to the current template. Any edit clears these results.</p></div>${quality}`;
  }
  if (state.mode === 'data') return dataView(project,state) + quality;
  const selected = selectionField(d,state.selected);
  const block = selected ? selected.block : BLOCKS.includes(state.selected) ? state.selected : 'items';
  const label = selected?.field.label || d.blocks[block].label;
  return `<div class="panel-body"><h2 class="inspector-title">${icon(selected ? 'field' : block)}${escape(label)}</h2></div><div class="inspector-tabs"><button type="button" data-action="properties" aria-current="${state.tab === 'properties'}">Properties</button><button type="button" data-action="binding" aria-current="${state.tab === 'binding'}">Data binding</button></div><div class="panel-body form-stack">${selected ? fieldProperties(d,selected) : blockProperties(d,block)}${state.tab === 'binding' ? '<p class="callout">Use /items for the collection and ./field for each row. No wildcard or expression syntax.</p>' : ''}</div>${quality}`;
}
