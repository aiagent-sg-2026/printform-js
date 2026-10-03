import { BLOCKS, designOf, selectionField } from './model.js';
import { escape } from './template.js';
import { icon } from './icons.js';
import { inspectProject } from './validation.js';
import { sourceLabel } from './data-provenance.js';
import { applyRow, fieldBinding, collectionBinding, imageControls } from './binding-view.js';
import { sectionOrder, pageSettings, fieldKind } from './design-authoring.js';

export const SAMPLES = [['erp','Current document data','Restore original dataset'],['0','Empty','0 rows'],['1','Single item','1 row'],['45','Standard','45 rows'],['100','Multi-page','100 rows'],['500','Stress','500 rows'],['long','Long & bilingual','45 rows']];
const button = (action,text,symbol='',extra='') => `<button type="button" data-action="${action}" ${extra}>${symbol ? icon(symbol) : ''}${escape(text)}</button>`;
const input = (label,name,value,type='text',extra='') => `<label>${escape(label)}<input name="${name}" type="${type}" value="${escape(value)}" ${extra}></label>`;
const check = (label,name,checked) => `<label class="checkbox"><input name="${name}" type="checkbox" ${checked ? 'checked' : ''}>${escape(label)}</label>`;
const close = () => '<button type="button" class="drawer-close" data-layout="close" aria-label="Close panel">'+icon('close')+'</button>';
const formats = value => `<label>Display format<select name="format">${[['','Plain text'],['number','Number'],['currency','Currency'],['percent','Percent']].map(([v,l])=>`<option value="${v}" ${value === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
const select = (label,name,value,choices) => `<label>${escape(label)}<select name="${name}">${choices.map(([v,l])=>`<option value="${v}" ${String(value ?? '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
const rowFill = design => `${input('Table row background','rowBackground',design.tableStyle?.rowBackground || '','text','pattern="#[0-9a-fA-F]{6}" placeholder="Default or #rrggbb" maxlength="7"')}<p class="hint">Use #ffff00 for yellow. A fill covers all data rows. Clear it to restore the alternate-row setting.</p>`;
function typographyControls(label,prefix,style={},open=false) {
  return `<details ${open ? 'open' : ''}><summary>${label}</summary><div class="form-stack">${input(`${label} font (pt)`,`${prefix}.fontSize`,style.fontSize ?? '','number','min="6" max="72" step="0.5" placeholder="Inherit"')}
    ${select(`${label} weight`,`${prefix}.bold`,style.bold,[['','Inherit'],['false','Normal'],['true','Bold']])}${input(`${label} color`,`${prefix}.color`,style.color || '','text','pattern="#[0-9a-fA-F]{6}" placeholder="Inherit or #rrggbb" maxlength="7"')}
    ${select(`${label} alignment`,`${prefix}.align`,style.align,[['','Inherit'],['left','Left'],['center','Center'],['right','Right']])}<p class="hint">Blank or Inherit uses the template default.</p></div></details>`;
}

function sampleList(state) {
  return `<div class="sample-list">${SAMPLES.map(([id,label,detail])=>`<button type="button" class="${state.sample === id ? 'active' : ''}" data-sample="${id}"><span>${escape(label)}</span><small>${detail}</small></button>`).join('')}</div>`;
}
function styleForm(design) {
  const page = pageSettings(design);
  return `<form data-form="style" class="form-stack">
    ${input('Brand color','color',design.color,'color')}
    ${input('Font size (pt)','font',design.font,'number','min="6" max="14" step="0.5"')}
    ${input('Cell padding (px)','padding',design.padding,'number','min="2" max="16"')}
    ${rowFill(design)}
    ${check('Alternate item rows','striped',design.striped)}${check('Table borders','borders',design.borders)}${check('Page numbers','pageNumbers',design.pageNumbers)}
    ${typographyControls('Page number','pageNumberStyle',design.pageNumberStyle)}
    <details><summary>Paper & margins</summary><div class="form-stack">${select('Paper size','paper',page.paper,['A4','A5','LETTER','LEGAL'].map(p=>[p,p]))}${select('Orientation','orientation',page.orientation,[['portrait','Portrait'],['landscape','Landscape']])}${['top','right','bottom','left'].map(side=>input(`${side[0].toUpperCase()+side.slice(1)} margin (px)`,`margin-${side}`,page.margins[side],'number','min="0" max="72"')).join('')}</div></details>
    ${applyRow('Apply style')}
  </form>`;
}
function fieldProperties(design,selected,focusLabel=false) {
  const {field,block,index} = selected, count = (block === 'items' ? design.columns : design[block]).length;
  return `<form data-form="field" class="form-stack">
    ${input('Label','label',field.label,'text','maxlength="100"')}${fieldKind(field) === 'image' ? '' : formats(field.format)}
    <input type="hidden" name="showLabel-present" value="1">${check('Show label','showLabel',field.showLabel !== false)}
    ${typographyControls('Label','labelStyle',field.labelStyle,focusLabel)}${fieldKind(field) === 'image' ? '<p class="hint">Image source and dimensions are in Data binding.</p>' : typographyControls('Value','valueStyle',field.valueStyle,!focusLabel)}
    ${block === 'items' ? input('Width (%)','width',field.width,'number','min="1" max="100"') : ''}
    <p class="hint">Label and appearance. Use Data binding to choose the printed value.</p>${applyRow('Apply field')}
  </form><div class="action-row">${button('move-up','Up','up',index === 0 ? 'disabled' : '')}${button('move-down','Down','down',index === count-1 ? 'disabled' : '')}${button('remove-field','Remove','trash')}</div>`;
}
function blockProperties(design,id) {
  const block = design.blocks[id], order = sectionOrder(design);
  return `<form data-form="block" class="form-stack">
    ${input('Section name','label',block.label,'text','maxlength="100"')}${check('Show section','enabled',block.enabled)}
    ${id === 'header' ? input('Document heading','title',design.title,'text','maxlength="100"')+check('Repeat header on every page','repeatHeader',design.repeatHeader) : ''}
    ${id === 'header' ? typographyControls('Heading','titleStyle',design.titleStyle,true) : ''}
    ${id === 'items' ? check('Repeat table header','repeatTable',design.repeatTable)+check('Page break before items','breakBefore',design.breakBefore)+rowFill(design) : ''}
    ${select('Section position','sectionPosition',order.indexOf(id),order.map((_,index)=>[String(index),String(index+1)]))}
    ${id !== 'items' ? `<details><summary>Section layout</summary><div class="form-stack">${input('Layout columns','layoutColumns',block.layout?.columns ?? '','number','min="1" max="4" placeholder="Template default"')}${input('Layout gap (px)','layoutGap',block.layout?.gap ?? '','number','min="0" max="48" placeholder="Template default"')}${check('Keep section together','keepTogether',block.keepTogether)}${id !== 'header' ? check('Page break before section','sectionBreakBefore',block.breakBefore) : ''}</div></details>` : ''}
    ${applyRow('Apply section')}
  </form>${id === 'header' ? `<details><summary>Logo / embedded image</summary><form data-form="logo" class="form-stack">${imageControls(design,design.logo || {},'header-logo')}${check('Restore default brand mark','removeLogo',!design.logo)}${applyRow('Apply logo')}</form></details>` : ''}<p class="hint muted">New fields are inserted at the end of this section. Moving the header requires turning off its repeat setting first.</p>${button('add-field',id === 'items' ? 'Add column at end' : 'Add field at end','plus')}`;
}
export function leftView(project,state) {
  const design = designOf(project);
  if (state.mode !== 'design') return `<h2 class="panel-heading">${state.mode === 'validate' ? 'Validation samples' : 'Synthetic validation samples'}${close()}</h2><div class="panel-body form-stack">
    <p class="source-line">${escape(sourceLabel(project))}</p>${sampleList(state)}
    <p class="hint">Validation samples are generated demo values. Current document data restores the original dataset and its source.</p>
    ${state.mode === 'validate' ? button('validate-all',state.running ? 'Stop validation' : 'Run all synthetic samples','check') : ''}
  </div><details><summary>${icon('data')}Binding guide</summary><div class="panel-body"><p class="callout">Collection /items<br>Row field ./description<br>Document field /customer/name</p><p class="muted">Amounts and taxes are supplied values. No ERP connection is configured.</p></div></details>`;
  const query = (state.search || '').toLowerCase();
  const tree = sectionOrder(design).map(id=> {
    const block = design.blocks[id], fields = id === 'items' ? design.columns : design[id];
    const matchBlock = block.label.toLowerCase().includes(query), matches = fields.filter(f=>matchBlock || f.label.toLowerCase().includes(query));
    const collapsed = state.collapsed?.[id] && !query;
    return `<div class="tree-group ${!block.enabled ? 'tree-disabled' : ''}" data-tree-group="${id}" ${query && !matchBlock && !matches.length ? 'hidden' : ''}>
      <div class="tree-section-header"><button type="button" data-fold="${id}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${escape(block.label)}" aria-expanded="${!collapsed}" class="fold-control ${collapsed ? '' : 'expanded'}">${icon('next')}</button><button type="button" class="tree-node ${state.selected === id ? 'active' : ''}" data-select="${id}">${icon(id)}<strong>${escape(block.label)}</strong>${!block.enabled ? '<small>Hidden</small>' : ''}</button></div>
      <div class="tree-fields" ${collapsed || !block.enabled ? 'hidden' : ''}>${fields.map(field=>`<button type="button" class="tree-node ${state.selected === `${id}-${field.id}` ? 'active' : ''}" data-select="${id}-${escape(field.id)}" ${query && !matchBlock && !field.label.toLowerCase().includes(query) ? 'hidden' : ''}>${icon('field')}<span class="tree-label">${escape(field.label)}</span></button>`).join('')}</div>
    </div>`;
  }).join('');
  return `<div class="structure-toolbar"><h2 class="panel-heading">Template structure${close()}</h2><div class="structure-tools"><input id="structure-search" type="search" value="${escape(state.search || '')}" aria-label="Search structure" placeholder="Search fields">${button('go-style','Global style','style')}</div></div><nav aria-label="Form components">${tree}</nav><div class="tree-footer"><button type="button" data-ai-add="${escape(state.selected)}">${icon('sparkles')}Add selected to chat</button>${button('add-field','Add field / column at end','plus')}<p class="hint muted">Select a component to edit. Insertion appends to its section.</p></div>`;
}
function qualityView(project,state) {
  const quality = inspectProject(project,state.report);
  return `<details class="quality-panel" ${state.mode === 'validate' ? 'open' : ''}><summary>${icon('check')}Quality (${quality.errors.length} issues)</summary><div class="panel-body">
    <p class="${quality.ready ? 'quality-ok' : 'muted'}">${quality.ready ? 'Current browser layout passed.' : state.report ? 'Resolve issues and render again.' : 'Waiting for the current render.'}</p>
    ${quality.errors.slice(0,15).map(error=>`<button class="issue" type="button" data-issue="${escape(error.component || '')}"><span>${escape(error.message || error.code)}<span class="path">${escape(error.path || error.code)}</span></span></button>`).join('')}
    ${quality.warnings.map(error=>`<p class="hint muted">${escape(error.message || error.code)}</p>`).join('')}
    <p class="hint muted">Inspect native print preview. Physical printer output and supplied financial values require your review.</p>${button('rerender','Render again','check')}
  </div></details>`;
}
function localeForm(project) {
  return `<details><summary>Locale & currency</summary><div class="panel-body"><form data-form="locale" class="form-stack">
    <label>Locale<select name="locale">${['en-MY','zh-CN','ms-MY','ja-JP','vi-VN'].map(locale=>`<option ${locale === project.manifest.locale ? 'selected' : ''}>${locale}</option>`).join('')}</select></label>
    <label>Currency<select name="currency">${['MYR','USD','SGD','EUR','CNY','JPY'].map(currency=>`<option ${currency === project.manifest.currency ? 'selected' : ''}>${currency}</option>`).join('')}</select></label>${applyRow('Apply locale')}
  </form></div></details>`;
}
export function rightView(project,state) {
  const design = designOf(project), selected = selectionField(design,state.selected), quality = qualityView(project,state);
  if (state.mode === 'validate') {
    const metrics = inspectProject(project,state.report).metrics;
    return `<h2 class="panel-heading">Validate this revision${close()}</h2><div class="panel-body form-stack"><p class="source-line">${escape(sourceLabel(project))}</p><div class="metrics">${[['rows','Rows'],['logicalPages','Pages'],['overflowElements','Horizontal overflow'],['verticalOverflowPages','Vertical overflow']].map(([key,label])=>`<div class="metric"><strong>${metrics[key] ?? '—'}</strong>${label}</div>`).join('')}</div><p class="hint">Measured row heights determine page breaks. Oversized rows are reported.</p><h3>Sample matrix</h3>${SAMPLES.filter(([id])=>id !== 'erp').map(([id,label])=> {
      const result = state.matrix[id]; return `<p class="hint ${result?.ready ? 'quality-ok' : 'muted'}">${label}: ${result ? result.ready ? `${result.metrics.logicalPages} pages · passed` : `${result.errors.length} issue(s)` : 'Not checked'}</p>`;
    }).join('')}<p class="hint muted">Template edits clear these results.</p></div>${quality}`;
  }
  if (['global-style','page-number'].includes(state.selected) && state.mode === 'design') return `<h2 class="panel-heading">Global style${close()}</h2><div class="panel-body">${styleForm(design)}</div>${quality}`;
  const block = selected?.block || (state.selected.startsWith('header-') ? 'header' : BLOCKS.includes(state.selected) ? state.selected : 'items');
  const heading = state.selected === 'header-title' ? 'Document heading' : state.selected === 'header-logo' ? 'Logo / brand mark' : selected ? `${selected.field.label}${state.selected.startsWith('label-') ? ' · Label' : ''}` : design.blocks[block].label;
  const binding = selected ? fieldBinding(project,selected) : block === 'items' ? collectionBinding(project) : '<p class="callout">Select a field in the structure to bind a value. Document data is separate from layout properties.</p>';
  if (state.mode === 'data') return `<h2 class="panel-heading">Data binding${close()}</h2><div class="panel-body form-stack"><h3 class="inspector-title">${icon('field')}${escape(heading)}</h3>${binding}<p class="source-line">${escape(sourceLabel(project))}</p><button type="button" data-db-group="json">Open wide JSON editor</button></div>${localeForm(project)}${quality}`;
  return `<div class="panel-body inspector-heading"><h2 class="inspector-title">${icon(selected ? 'field' : block)}${escape(heading)}</h2>${close()}</div><div class="inspector-tabs"><button type="button" data-action="properties" aria-current="${state.tab === 'properties'}">Properties</button><button type="button" data-action="binding" aria-current="${state.tab === 'binding'}">Data binding</button></div><div class="panel-body form-stack"><button type="button" data-ai-add="${escape(state.selected)}">${icon('sparkles')}Add to chat</button>${state.tab === 'binding' ? binding : selected ? fieldProperties(design,selected,state.selected.startsWith('label-')) : blockProperties(design,block)}</div>${quality}`;
}
