function valuesOf(form) {
  return Object.fromEntries([...form.elements].filter(n=>n.name || n.id).map(n=>[n.name || n.id,n.type === 'checkbox' ? n.checked : n.value]));
}
function restoreValues(form,values) {
  for (const node of form.elements) {
    const key = node.name || node.id; if (!Object.hasOwn(values,key)) continue;
    if (node.type === 'checkbox') node.checked = values[key]; else node.value = values[key];
  }
}
export function restoreDraftRecords(records,formFor,context) {
  return records.map(record=> {
    if (!['field','binding','block','style','collection','locale','data','logo'].includes(record.kind) || typeof record.selected !== 'string' || !/^[a-z0-9-]+$/.test(record.selected)) throw new Error('Invalid recovery form.');
    if (!record.values || Object.values(record.values).some(value=>!['string','boolean'].includes(typeof value))) throw new Error('Invalid recovery values.');
    const form = formFor(record), key = `${record.kind}:${['field','binding','block'].includes(record.kind) ? record.selected : 'global'}`;
    if (!form || key !== record.key) throw new Error('Unavailable recovery form.');
    const names = new Set([...form.elements].map(node=>node.name || node.id));
    if (Object.keys(record.values).some(name=>!names.has(name))) throw new Error('Unavailable recovery control.');
    restoreValues(form,record.values);
    const restored = valuesOf(form);
    if (Object.entries(record.values).some(([name,value])=>restored[name] !== value)) throw new Error('Recovery control no longer supports its saved value.');
    return {...record,form,context};
  });
}
export class FormDrafts {
  constructor(callbacks) {
    this.callbacks = callbacks; this.drafts = new Map(); this.baselines = new Map(); this.applying = new Set(); this.guarding = false;
    this.dialog = document.querySelector('#draft-dialog');
    this.dialog.addEventListener('click',event=> {
      const choice = event.target.closest('[data-draft-choice]'); if (choice) this.dialog.close(choice.dataset.draftChoice);
    });
    this.dialog.addEventListener('cancel',event=> { event.preventDefault(); this.dialog.close('stay'); });
  }
  key(form) { const kind = form.dataset.form; return `${kind}:${['field','binding','block'].includes(kind) ? this.callbacks.selection() : 'global'}`; }
  snapshot(form) {
    const values = valuesOf(form), copy = form.cloneNode(true); restoreValues(copy,values);
    return {key:this.key(form),kind:form.dataset.form,selected:this.callbacks.selection(),values,form:copy,context:this.callbacks.context()};
  }
  capture(target) {
    const form = target.closest('[data-form]'); if (!form) {
      if (target.dataset.dbPointer || target.id === 'database-name') { this.focus = target; this.focusMeta = {external:true,pointer:target.dataset.dbPointer,id:target.id}; }
      this.paint(); return;
    }
    const draft = this.snapshot(form);
    if (JSON.stringify(draft.values) === JSON.stringify(this.baselines.get(draft.key))) this.drafts.delete(draft.key); else this.drafts.set(draft.key,draft);
    this.focus = target; this.paint();
    this.focusMeta = {key:draft.key,control:target.name || target.id};
  }
  restore() {
    for (const form of document.querySelectorAll('[data-form]')) {
      const key = this.key(form); this.baselines.set(key,valuesOf(form));
      if (this.drafts.has(key)) restoreValues(form,this.drafts.get(key).values);
    }
    this.paint();
    if (this.focusMeta) {
      if (this.focusMeta.external) {
        const control = this.focusMeta.pointer ? [...document.querySelectorAll('[data-db-pointer]')].find(n=>n.dataset.dbPointer === this.focusMeta.pointer) : document.getElementById(this.focusMeta.id);
        if (control) this.focus = control;
      }
      const form = [...document.querySelectorAll('[data-form]')].find(n=>this.key(n) === this.focusMeta.key);
      const control = form && [...form.elements].find(n=>(n.name || n.id) === this.focusMeta.control);
      if (control) this.focus = control;
    }
    if (this.applying.size) document.querySelectorAll('[data-form] input,[data-form] textarea,[data-form] select,[data-form] button').forEach(n=> { n.disabled = true; });
  }
  paint() {
    const count = this.drafts.size + (this.callbacks.externalPending() ? 1 : 0);
    const status = document.querySelector('#draft-state');
    status.textContent = count ? `${count} unapplied edit${count === 1 ? '' : 's'}` : 'No unapplied edits';
    status.classList.toggle('has-drafts',Boolean(count));
  }
  applied(snapshot) { this.drafts.delete(snapshot.key); this.paint(); }
  discard(form = null, external = true) {
    if (form) {
      const kind = form.dataset.form; this.drafts.delete(this.key(form));
      if (kind === 'data') this.callbacks.clearJSON();
    } else { this.drafts.clear(); this.callbacks.clearJSON(); if (external) this.callbacks.discardExternal(); }
    this.callbacks.render();
  }
  clear() { this.drafts.clear(); this.baselines.clear(); this.focus = null; this.focusMeta = null; this.callbacks.clearJSON(); }
  restoreRecords(records,formFor) {
    for (const record of restoreDraftRecords(records,formFor,this.callbacks.context())) this.drafts.set(record.key,record);
  }
  async submit(snapshot) {
    const operation = this.callbacks.apply(snapshot); this.applying.add(operation);
    document.querySelectorAll('[data-form] input,[data-form] textarea,[data-form] select,[data-form] button').forEach(n=> { n.disabled = true; });
    try { await operation; } finally { this.applying.delete(operation); this.callbacks.render(); if (this.drafts.has(snapshot.key)) this.focus?.focus(); }
  }
  async ask(includeExternal) {
    const list = document.querySelector('#draft-list'); list.replaceChildren();
    for (const draft of this.drafts.values()) {
      const item = document.createElement('li'); item.textContent = `${draft.kind === 'data' ? 'Advanced JSON data' : `${draft.kind} · ${draft.selected || 'template'}`}`; list.append(item);
    }
    if (includeExternal && this.callbacks.externalPending()) { const item = document.createElement('li'); item.textContent = 'Sample database table draft'; list.append(item); }
    this.dialog.returnValue = 'stay';
    const result = new Promise(resolve=>this.dialog.addEventListener('close',()=>resolve(this.dialog.returnValue),{once:true}));
    this.dialog.showModal(); return result;
  }
  async guard(work, includeExternal = true) {
    if (this.guarding) return;
    this.guarding = true;
    try {
      await Promise.allSettled([...this.applying]);
      if (this.drafts.size || includeExternal && this.callbacks.externalPending()) {
        const choice = await this.ask(includeExternal);
        if (choice === 'stay') { this.focus?.focus(); this.callbacks.stay(); return; }
        if (choice === 'discard') this.discard(null,includeExternal);
        else {
          for (const snapshot of [...this.drafts.values()]) {
            await this.submit(snapshot);
            if (this.drafts.has(snapshot.key)) return;
          }
          if (includeExternal && this.callbacks.externalPending()) await this.callbacks.applyExternal();
          if (includeExternal && this.callbacks.externalPending()) return;
        }
      }
      // Once the choice is resolved, allow navigation to interrupt long validation.
      this.guarding = false; await work();
    } finally { this.guarding = false; this.paint(); }
  }
}
