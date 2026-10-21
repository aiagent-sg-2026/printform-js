import { icon } from './icons.js';
export function setupMobileShell() {
  const media = matchMedia('(max-width:680px)'), more = document.querySelector('#mobile-more'), menu = document.querySelector('#mobile-actions');
  const primary = menu.querySelector('[data-mobile-primary]'), footer = menu.querySelector('[data-mobile-footer]');
  const backdrop = document.createElement('div'); backdrop.id = 'mobile-menu-backdrop'; backdrop.hidden = true; backdrop.setAttribute('aria-hidden','true'); menu.before(backdrop);
  const selectors = ['.header-actions [data-action=new]','.header-actions [data-action=open]','.header-actions [data-action=save]','.header-actions [data-action=export]','.header-actions [data-action=share]','.workspace-bar [data-action=preview]','#update-button','#app-version','#data-source','.status-bar > a','#recovery-download','#recovery-discard','#update-status'];
  const entries = selectors.map(selector=> { const node = document.querySelector(selector), marker = document.createComment('desktop position'); node.before(marker); return {node,marker}; });
  let mobileThumbs = false, desktopThumbs = !document.body.classList.contains('hide-thumbnails');
  try { mobileThumbs = sessionStorage.getItem('printform-studio-v3:mobile-thumbnails') === '1'; } catch { /* Tab storage may be unavailable. */ }
  const close = (focus = true) => { menu.hidden = true; backdrop.hidden = true; more.setAttribute('aria-expanded','false'); if (focus) more.focus(); };
  const thumbnails = visible => { document.body.classList.toggle('hide-thumbnails',!visible); document.querySelector('[data-layout=thumbnails]').setAttribute('aria-expanded',String(visible)); };
  const change = () => {
    close(false);
    for (const [value,label,compact] of [['fit','Fit page','Page'],['width','Fit width','Width']]) {
      const option = document.querySelector(`#zoom option[value="${value}"]`); option.textContent = media.matches ? compact : label; option.setAttribute('aria-label',label);
    }
    for (const [index,{node,marker}] of entries.entries()) {
      if (media.matches) (index < 6 ? primary : footer).append(node); else marker.after(node);
    }
    thumbnails(media.matches ? mobileThumbs : desktopThumbs);
    window.dispatchEvent(new Event('resize'));
  };
  document.addEventListener('click',event=> { if (!menu.hidden && menu.contains(event.target) && event.target.closest('button,a')) close(); },true);
  more.innerHTML = icon('more');
  backdrop.addEventListener('pointerdown',event=> { event.preventDefault(); close(); });
  backdrop.addEventListener('click',()=>close());
  more.addEventListener('click',()=> { if (!menu.hidden) { close(); return; } menu.hidden = false; backdrop.hidden = false; more.setAttribute('aria-expanded','true'); menu.querySelector('button:not(:disabled)')?.focus(); });
  document.addEventListener('click',event=> {
    if (!menu.hidden && !more.contains(event.target)) {
      if (!menu.contains(event.target) || event.target.closest('button,a')) close();
    }
    if (event.target.closest('[data-layout=thumbnails]')) {
      const visible = !document.body.classList.contains('hide-thumbnails');
      if (media.matches) { mobileThumbs = visible; try { sessionStorage.setItem('printform-studio-v3:mobile-thumbnails',visible ? '1' : '0'); } catch { /* Keep the in-memory preference. */ } } else desktopThumbs = visible;
    }
  });
  document.addEventListener('keydown',event=> {
    if (menu.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const nodes = [more,...menu.querySelectorAll('button:not(:disabled),a[href]')].filter(node=>node.getClientRects().length), first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.querySelector('#update-dialog').addEventListener('close',()=> { if (media.matches) { menu.hidden = false; backdrop.hidden = false; more.setAttribute('aria-expanded','true'); document.querySelector('#update-button').focus(); } });
  media.addEventListener('change',change); change();
}
