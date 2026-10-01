import { persistZoom } from './zoom-preference.js';
export class CanvasControls {
  constructor({resize,guard}) {
    this.resize = resize; this.guard = guard; this.drawer = null; this.returnFocus = null;
    this.backdrop = document.querySelector('#drawer-backdrop');
    document.addEventListener('click',event=> {
      const button = event.target.closest('[data-layout]'); if (!button) return;
      const name = button.dataset.layout;
      if (name === 'close') this.close();
      else if (name === 'thumbnails') { document.body.classList.toggle('hide-thumbnails'); this.update(); this.resize(); }
      else if (name === 'zoom-in' || name === 'zoom-out') this.zoom(name === 'zoom-in' ? .1 : -.1);
      else this.guard(()=>this.toggle(name,button)).catch(()=>{});
    });
    this.backdrop.addEventListener('click',()=>this.close());
    document.addEventListener('keydown',event=> {
      if (!this.drawer || document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') { event.preventDefault(); this.close(); }
      else if (event.key === 'Tab') {
        const nodes = this.focusable(this.drawer), first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    this.observer = new ResizeObserver(()=>this.resize()); this.observer.observe(document.querySelector('#paper-scroll'));
    window.addEventListener('resize',()=> { if (innerWidth > 900 && this.drawer) this.close(false); this.update(); });
    this.update();
  }
  focusable(name) {
    return [...document.querySelector(name === 'structure' ? '#left-panel' : '#right-panel').querySelectorAll('button,input,select,textarea,[tabindex]')].filter(n=>!n.disabled && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
  }
  toggle(name,button) {
    if (!['structure','properties'].includes(name)) return;
    if (innerWidth <= 900) {
      if (this.drawer === name) { this.close(); return; }
      this.open(name,button);
    } else { document.body.classList.toggle(`hide-${name}`); this.update(); this.resize(); }
  }
  open(name,button = null) {
    this.drawer = name; this.returnFocus = button || document.querySelector(`[data-layout=${name}]`);
    document.body.classList.remove('drawer-structure','drawer-properties'); document.body.classList.add(`drawer-${name}`);
    this.backdrop.hidden = false; this.update(); this.focusable(name).find(n=>n.tagName === 'INPUT')?.focus();
  }
  close(restore = true) {
    document.body.classList.remove('drawer-structure','drawer-properties'); this.backdrop.hidden = true;
    const name = this.drawer;
    this.drawer = null; this.update();
    if (restore) {
      const visibleWorkbench = document.querySelector('#database-workbench:not([hidden])');
      const control = this.returnFocus?.isConnected ? this.returnFocus : visibleWorkbench?.querySelector(`[data-layout=${name}]`) || document.querySelector(`[data-layout=${name}]`);
      control?.focus();
    }
  }
  selectionMade() {
    if (innerWidth <= 900) { this.close(false); document.body.classList.remove('preview-only'); this.open('properties'); }
  }
  focusDraft(node) {
    const panel = node?.closest('.side-panel'); if (!panel) { node?.focus(); return; }
    const name = panel.id === 'left-panel' ? 'structure' : 'properties';
    if (innerWidth <= 900) this.open(name); else { document.body.classList.remove(`hide-${name}`); this.update(); this.resize(); }
    node.focus();
  }
  update() {
    for (const name of ['structure','properties']) {
      const open = innerWidth <= 900 ? this.drawer === name : !document.body.classList.contains(`hide-${name}`);
      document.querySelectorAll(`[data-layout=${name}]`).forEach(n=>n.setAttribute('aria-expanded',String(open)));
    }
    document.querySelector('[data-layout=thumbnails]').setAttribute('aria-expanded',String(!document.body.classList.contains('hide-thumbnails')));
  }
  zoom(step) {
    const select = document.querySelector('#zoom');
    const current = Number(document.querySelector('#preview-frame').dataset.zoom || 1);
    const next = Math.max(.15,Math.min(2,Math.round((current+step)*100)/100));
    let option = select.querySelector('[data-custom-zoom]');
    if (!option) { option = document.createElement('option'); option.dataset.customZoom = 'true'; select.append(option); }
    option.value = String(next); option.textContent = `${Math.round(next*100)}%`; select.value = String(next); persistZoom(select); this.resize();
  }
}
