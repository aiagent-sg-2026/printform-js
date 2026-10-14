// Range geometry detects broken monetary tokens even when their enclosing
// element itself remains inside the logical page. data-pf-monetary marks supplied
// display strings without Intl coercion; text/data are never parsed or changed.
export function inspectMonetaryTokens(doc) {
  const failures = [];
  const styles = new WeakMap(), clips = new WeakMap();
  const styleOf = node => {
    if (!styles.has(node)) styles.set(node,doc.defaultView.getComputedStyle(node));
    return styles.get(node);
  };
  const clipOf = node => {
    if (clips.has(node)) return clips.get(node);
    const style = styleOf(node), modes = ['hidden','clip','auto','scroll'];
    const x = modes.includes(style.overflowX), y = modes.includes(style.overflowY);
    let clip = null;
    // Overflow does not establish a clipping box on a non-replaced inline.
    if ((x || y) && style.display !== 'inline') {
      const rect = node.getBoundingClientRect();
      const sx = node.offsetWidth > 0 ? rect.width / node.offsetWidth : 1;
      const sy = node.offsetHeight > 0 ? rect.height / node.offsetHeight : 1;
      const left = rect.left + (node.offsetWidth > 0 ? node.clientLeft * sx : parseFloat(style.borderLeftWidth) || 0);
      const top = rect.top + (node.offsetHeight > 0 ? node.clientTop * sy : parseFloat(style.borderTopWidth) || 0);
      const right = node.offsetWidth > 0 ? left + node.clientWidth * sx : rect.right - (parseFloat(style.borderRightWidth) || 0);
      const bottom = node.offsetHeight > 0 ? top + node.clientHeight * sy : rect.bottom - (parseFloat(style.borderBottomWidth) || 0);
      clip = {x,y,left,top,right,bottom};
    }
    clips.set(node,clip);return clip;
  };
  for (const node of doc.querySelectorAll('.printform_page [data-pf-format="currency"],.printform_page [data-pf-monetary="currency"]')) {
    if (!node.textContent.trim()) continue;
    const range = doc.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects?.() || []).filter(r=>r.width > 0 && r.height > 0);
    if (!rects.length) continue; // DOM-only validation has no layout engine.
    const lines = new Set(rects.map(r=>Math.round(r.top)));
    const owner = node.closest('td,th,.field') || node.parentElement;
    const bounds = owner.getBoundingClientRect();
    const style = styleOf(owner);
    const ownerScale = owner.offsetWidth > 0 ? bounds.width / owner.offsetWidth : 1;
    const left = bounds.left + (parseFloat(style.paddingLeft) || 0) * ownerScale;
    const right = bounds.right - (parseFloat(style.paddingRight) || 0) * ownerScale;
    const escaped = rects.some(r=>r.left < left - 1 || r.right > right + 1 || r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1);
    let clipped = false;
    for (let ancestor=node;ancestor;ancestor=ancestor.parentElement) {
      const clip = clipOf(ancestor);
      if (clip && rects.some(r=>(clip.x && (r.left < clip.left - 1 || r.right > clip.right + 1)) ||
        (clip.y && (r.top < clip.top - 1 || r.bottom > clip.bottom + 1)))) {clipped=true;break;}
      if (ancestor.classList.contains('printform_page')) break;
    }
    const label = owner.querySelector('[data-v3-role="label"]');
    let overlaps = false;
    if (label) {
      const labels = doc.createRange();labels.selectNodeContents(label);
      overlaps = Array.from(labels.getClientRects?.() || []).some(a=>rects.some(b=>
        Math.min(a.right,b.right) > Math.max(a.left,b.left) + 1 &&
        Math.min(a.bottom,b.bottom) > Math.max(a.top,b.top) + 1));
    }
    if (lines.size > 1 || escaped || clipped || overlaps) failures.push(node);
  }
  return failures;
}
