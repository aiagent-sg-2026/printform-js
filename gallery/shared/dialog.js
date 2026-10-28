// Native modal semantics own inertness and cross-document Tab traversal.
// This controller owns background locking and the iframe Escape boundary.
export function createDialog(dialog, resolveFocus) {
  let saved, frameDocument;
  function controls(root) {
    return [...root.querySelectorAll('a[href],button,input,select,textarea,[tabindex],iframe')]
      .filter((node) => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length)
      .flatMap((node) => {
        if (node.tagName !== "IFRAME") return [node];
        try { const inner = controls(node.contentDocument); return inner.length ? inner : [node]; }
        catch { return [node]; }
      });
  }
  const escape = (event) => {
    if (event.key === "Escape") { event.preventDefault(); dialog.close(); }
    if (event.key !== "Tab") return;
    const items = controls(dialog);
    if (!items.length) return;
    const active = document.activeElement?.tagName === "IFRAME" ? frameDocument?.activeElement : document.activeElement;
    const found = items.indexOf(active);
    const index = found < 0 && event.shiftKey ? 0 : found;
    event.preventDefault();
    items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length].focus();
  };
  dialog.addEventListener("keydown", escape);
  function detachFrame() {
    frameDocument?.removeEventListener("keydown", escape);
    frameDocument = null;
  }
  function bindFrame(doc) {
    detachFrame();
    if (!dialog.open || !doc) return;
    frameDocument = doc;
    doc.addEventListener("keydown", escape);
  }
  dialog.addEventListener("close", () => {
    detachFrame();
    if (!saved) return;
    const { x, y, style } = saved;
    saved = null;
    document.body.style.cssText = style;
    window.scrollTo(x, y);
    resolveFocus()?.focus({ preventScroll: true });
    document.dispatchEvent(new Event("gallery-dialog-change"));
  });
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  return {
    bindFrame,
    open() {
      if (dialog.open) return;
      saved = { x: scrollX, y: scrollY, style: document.body.style.cssText };
      Object.assign(document.body.style, { position: "fixed", top: `${-saved.y}px`, left: `${-saved.x}px`, width: "100%", overflow: "hidden" });
      dialog.showModal();
      dialog.querySelector("[data-close]").focus({ preventScroll: true });
      document.dispatchEvent(new Event("gallery-dialog-change"));
    }
  };
}
