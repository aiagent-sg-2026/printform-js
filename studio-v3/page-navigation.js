export function syncPageControls(root,index,count,ready) {
  root.querySelector('[data-action=previous]').disabled = !ready || count < 2 || index <= 0;
  root.querySelector('[data-action=next]').disabled = !ready || count < 2 || index >= count-1;
}
export function navigatePages(root,pages,index,{zoom=1,scroll=true,ready=true}={}) {
  const current = Math.max(0,Math.min(index,pages.length-1));
  if (scroll && pages[current]) root.querySelector('#paper-scroll').scrollTop = pages[current].top * zoom;
  root.querySelectorAll('[data-page]').forEach(node=>{
    const selected = Number(node.dataset.page) === current;
    node.classList.toggle('active',selected); node.setAttribute('aria-current',selected ? 'page' : 'false');
  });
  if (pages.length) {
    const label = root.querySelector('#page-count');
    label.innerHTML = `<span class="page-word">Page </span>${current+1} / ${pages.length}`; label.setAttribute('aria-label',`Page ${current+1} of ${pages.length}`);
  }
  syncPageControls(root,current,pages.length,ready);
  return current;
}
