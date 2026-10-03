// Range geometry detects broken monetary tokens even when their enclosing
// element itself remains inside the logical page. Text/data are never changed.
export function inspectMonetaryTokens(doc) {
  const failures = [];
  for (const node of doc.querySelectorAll('.printform_page [data-pf-format="currency"]')) {
    if (!node.textContent.trim()) continue;
    const range = doc.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects?.() || []).filter(r=>r.width > 0 && r.height > 0);
    if (!rects.length) continue; // DOM-only validation has no layout engine.
    const lines = new Set(rects.map(r=>Math.round(r.top)));
    const owner = node.closest('td,th,.field') || node.parentElement;
    const bounds = owner.getBoundingClientRect();
    const style = doc.defaultView.getComputedStyle(owner);
    const left = bounds.left + (parseFloat(style.paddingLeft) || 0);
    const right = bounds.right - (parseFloat(style.paddingRight) || 0);
    const escaped = rects.some(r=>r.left < left - 1 || r.right > right + 1 || r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1);
    const valueStyle = doc.defaultView.getComputedStyle(node), valueBounds = node.getBoundingClientRect();
    const clipped = ['hidden','clip'].includes(valueStyle.overflowX) && rects.some(r=>r.left < valueBounds.left - 1 || r.right > valueBounds.right + 1);
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
