import { BLOCKS, selectionField } from './model.js';

export const MAX_ELEMENT_TAGS = 8;
export const MAX_ELEMENT_COMMENT = 500;
const keys = ['documentId','revision','id','kind','block','role','comment'];
const error = message => Object.assign(new Error(message),{code:'INVALID_ELEMENT_REFERENCE'});
const node = (tag,className,text) => { const n = document.createElement(tag); n.className = className; if (text !== undefined) n.textContent = text; return n; };

// Semantic IDs are stable across reordering. Never resolve an array position.
// Captions, literal text, bindings and sample values are deliberately absent.
export function elementMetadata(project,id) {
  const design = project?.manifest?.studioV3;
  if (!design || typeof id !== 'string') return null;
  if (BLOCKS.includes(id)) return {id,kind:'section',block:id,role:id === 'items' ? 'table' : id};
  if (id === 'items-header') return {id,kind:'table-header',block:'items',role:'table-header'};
  if (id === 'header-title') return {id,kind:'heading',block:'header',role:'heading'};
  if (id === 'header-logo') return {id,kind:'image',block:'header',role:'logo'};
  if (id === 'page-number') return {id,kind:'page-number',block:'footer',role:'page-number'};
  const selected = selectionField(design,id);
  return selected ? {id,kind:id.startsWith('label-') ? 'label' : selected.block === 'items' ? 'column' : 'field',block:selected.block,role:id.startsWith('label-') ? 'label' : 'value'} : null;
}
function cleanReference(reference) {
  if (!reference || typeof reference !== 'object' || Array.isArray(reference) || Object.keys(reference).some(key=>!keys.includes(key)) || keys.some(key=>!(key in reference))) throw error('Invalid element reference. Remove it and add the element again.');
  if (typeof reference.documentId !== 'string' || !/^[a-z0-9-]{1,104}$/i.test(reference.documentId) || !Number.isInteger(reference.revision) || reference.revision < 0 || typeof reference.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(reference.id) || !BLOCKS.includes(reference.block) || !['section','table-header','heading','image','page-number','column','field','label'].includes(reference.kind) || ![...BLOCKS,'table','table-header','heading','logo','page-number','value','label'].includes(reference.role) || typeof reference.comment !== 'string' || reference.comment.length > MAX_ELEMENT_COMMENT) throw error('Invalid element reference. Remove it and add the element again.');
  return Object.fromEntries(keys.map(key=>[key,reference[key]]));
}
export function validateElementReferences(project,references=[],revision=project?.revision) {
  if (!Array.isArray(references) || references.length > MAX_ELEMENT_TAGS) throw error(`Use at most ${MAX_ELEMENT_TAGS} element references.`);
  const seen = new Set();
  return references.map(value=> {
    const reference = cleanReference(value), meta = elementMetadata(project,reference.id);
    if (reference.documentId !== project?.manifest?.documentId) throw error('Element references belong to another document. Remove them before Send.');
    if (!meta) throw error('A referenced element was deleted. Remove it before Send.');
    if (reference.revision !== revision) throw error('Element references belong to an older revision. Remove and add them again before Send.');
    if (seen.has(reference.id) || Object.entries(meta).some(([key,value])=>reference[key] !== value)) throw error('Invalid element reference. Remove it and add the element again.');
    seen.add(reference.id); return {...reference,comment:reference.comment.trim()};
  });
}
function caption(project,id) {
  const design = project?.manifest?.studioV3, selected = design && selectionField(design,id);
  return selected ? `${selected.field.label}${id.startsWith('label-') ? ' · label' : ''}` : design?.blocks?.[id]?.label || ({'items-header':'Table header','header-title':'Document heading','header-logo':'Logo / brand mark','page-number':'Page number'}[id] || id);
}

export class AIElementTags {
  constructor({bus,selection,onChange=()=>{},open=()=>{},select=()=>{},highlight=()=>{},guard=work=>work(),report=()=>{}}) {
    Object.assign(this,{getBus:bus,getSelection:selection,onChange,open,select,highlight,guard,report});
    this.references = []; this.busy = false; this.root = document.querySelector('[data-ai-element-tags]');
    document.addEventListener('click',event=> {
      if (!this.root?.isConnected) return;
      const add = event.target.closest('[data-ai-add]');
      if (!add || add.disabled || this.busy) return;
      const context = this.getBus(), id = add.dataset.aiAdd || this.getSelection();
      void Promise.resolve().then(()=>this.guard(()=> {
        if (context !== this.getBus()) throw error('The document changed. Add the intended element again.');
        this.add(id); this.open(); this.focusComment(id);
      })).catch(failure=>this.report(failure.message));
    });
    this.root?.addEventListener('click',event=> {
      const target = event.target.closest('[data-ai-tag-action]');
      if (!target || target.disabled || this.busy) return;
      const id = target.closest('[data-ai-tag-id]')?.dataset.aiTagId;
      if (target.dataset.aiTagAction === 'remove') this.remove(id);
      else if (target.dataset.aiTagAction === 'clear') this.clear();
      else if (target.dataset.aiTagAction === 'locate') void Promise.resolve().then(()=>this.guard(()=> {
        const invalid = this.invalid(this.references.find(r=>r.value.id === id));
        if (invalid) throw error(invalid); this.select(id);
      })).catch(failure=>this.report(failure.message));
    });
    this.root?.addEventListener('input',event=> {
      if (!event.target.matches('[data-ai-tag-comment]') || this.busy) return;
      const reference = this.references.find(r=>r.value.id === event.target.dataset.aiTagComment);
      if (reference) { reference.value.comment = event.target.value.slice(0,MAX_ELEMENT_COMMENT); this.onChange(); }
    });
    for (const [enter,leave] of [['mouseover','mouseout'],['focusin','focusout']]) {
      this.root?.addEventListener(enter,event=> {
        const chip = event.target.closest('[data-ai-tag-id]');
        if (chip && !this.invalid(this.references.find(r=>r.value.id === chip.dataset.aiTagId))) this.highlight(chip.dataset.aiTagId);
      });
      this.root?.addEventListener(leave,event=> {
        const chip = event.target.closest('[data-ai-tag-id]');
        if (chip && !chip.contains(event.relatedTarget)) this.highlight(null);
      });
    }
    this.render();
  }
  invalid(reference) {
    if (!reference) return 'Missing reference';
    if (reference.expired) return reference.expired;
    const bus = this.getBus(), value = reference.value;
    if (!bus?.active || bus !== reference.context || value.documentId !== bus.project.manifest.documentId) return 'Another document · remove this reference';
    if (!elementMetadata(bus.project,value.id)) return 'Deleted element · remove this reference';
    if (value.revision !== bus.revision) return `Older revision r${value.revision} · remove and add again`;
    return '';
  }
  add(id) {
    if (this.busy) throw error('Wait for the active AI request before adding an element.');
    const bus = this.getBus(), meta = elementMetadata(bus?.project,id);
    if (!bus?.active || !meta) throw error('Select an existing canvas or structure element before Add to chat.');
    const existing = this.references.find(r=>r.value.id === id);
    if (existing) {
      if (this.invalid(existing)) throw error('Remove the outdated reference first, then Add to chat again.');
      return;
    }
    if (this.references.length >= MAX_ELEMENT_TAGS) throw error(`Use at most ${MAX_ELEMENT_TAGS} element references. Remove one first.`);
    this.references.push({context:bus,value:{documentId:bus.project.manifest.documentId,revision:bus.revision,...meta,comment:''},caption:caption(bus.project,id),expired:''});
    this.render(); this.onChange();
  }
  remove(id) { if (this.busy) return; this.references = this.references.filter(r=>r.value.id !== id); this.highlight(null); this.render(); this.onChange(); }
  clear(notify=true) { this.references = []; this.highlight(null); this.render(); if (notify) this.onChange(); }
  consume() { this.clear(false); }
  payload() {
    const invalid = this.references.find(reference=>this.invalid(reference));
    if (invalid) throw error(`Cannot send: ${this.invalid(invalid)}.`);
    const bus = this.getBus();
    return validateElementReferences(bus?.project,this.references.map(r=>r.value),bus?.revision);
  }
  contextChanged() {
    let changed = false;
    for (const reference of this.references) {
      const invalid = this.invalid(reference);
      if (invalid && !reference.expired) { reference.expired = invalid; changed = true; }
    }
    if (changed) { this.highlight(null); this.render(); }
    this.updateAddButtons();
  }
  setBusy(busy) { this.busy = Boolean(busy); this.updateAddButtons(); this.root?.querySelectorAll('button,textarea').forEach(n=>n.disabled = this.busy || (n.dataset.aiTagAction === 'locate' && Boolean(n.closest('[data-invalid]')))); }
  updateAddButtons() {
    const bus = this.getBus();
    document.querySelectorAll('[data-ai-add]').forEach(n=>n.disabled = this.busy || !bus?.active || !elementMetadata(bus.project,n.dataset.aiAdd || this.getSelection()));
  }
  snapshot() { return this.references.map(r=>cleanReference(r.value)); }
  static validateSnapshot(saved=[]) {
    if (!Array.isArray(saved) || saved.length > MAX_ELEMENT_TAGS) throw error('Invalid recovered element references.');
    const seen = new Set();
    for (const value of saved) { const reference = cleanReference(value); if (seen.has(reference.id)) throw error('Duplicate recovered element reference.'); seen.add(reference.id); }
  }
  restoreSnapshot(saved=[]) {
    AIElementTags.validateSnapshot(saved);
    this.references = saved.map(value=>({value:cleanReference(value),context:null,caption:value.id,expired:'Recovered reference · remove and add again'}));
    this.render();
  }
  focusComment(id) { [...this.root?.querySelectorAll('[data-ai-tag-comment]') || []].find(n=>n.dataset.aiTagComment === id)?.focus(); }
  render() {
    if (!this.root) return;
    this.root.replaceChildren(); this.root.hidden = !this.references.length;
    if (!this.references.length) return;
    const heading = node('div','ai-tag-heading'); heading.append(node('strong','','Referenced elements'));
    const clear = node('button','','Remove all'); clear.type = 'button'; clear.dataset.aiTagAction = 'clear'; heading.append(clear); this.root.append(heading);
    for (const reference of this.references) {
      const {id,revision,comment} = reference.value, invalid = this.invalid(reference);
      const chip = node('section','ai-element-tag'); chip.dataset.aiTagId = id; if (invalid) chip.dataset.invalid = '';
      const row = node('div','ai-tag-row'), locate = node('button','ai-tag-locate',reference.caption);
      locate.type = 'button'; locate.dataset.aiTagAction = 'locate'; locate.title = `Highlight ${id}`; locate.setAttribute('aria-label',`Locate ${reference.caption} (${id})`);
      const remove = node('button','ai-tag-remove','×'); remove.type = 'button'; remove.dataset.aiTagAction = 'remove'; remove.setAttribute('aria-label',`Remove reference ${id}`);
      row.append(locate,remove); chip.append(row,node('small','ai-tag-meta',`${id} · r${revision}`));
      const label = node('label','ai-tag-comment','Comment for this element'), input = node('textarea','');
      input.dataset.aiTagComment = id; input.maxLength = MAX_ELEMENT_COMMENT; input.rows = 1; input.value = comment; input.placeholder = 'e.g. Make this heading larger and blue'; input.setAttribute('aria-label',`Comment for ${id}`);
      label.append(input); chip.append(label); if (invalid) chip.append(node('p','ai-tag-error',invalid)); this.root.append(chip);
    }
    if (this.references.some(r=>this.invalid(r))) this.root.append(node('p','ai-tag-error','Send is blocked until outdated references are removed.'));
    this.setBusy(this.busy);
  }
}
