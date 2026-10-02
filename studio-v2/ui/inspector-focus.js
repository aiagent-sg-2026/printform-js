export function focusInspectorElement(panel, target, shouldBeOpen) {
  if (!target) return () => {};
  const owner = panel.ownerDocument;
  const timers = [];
  let cancelled = false;
  function cancel() {
    if (cancelled) return;
    cancelled = true;
    timers.forEach(clearTimeout);
    owner.removeEventListener("focusin", onFocus);
  }
  function onFocus(event) {
    // Transition retries must yield as soon as the user chooses another control.
    if (event.target !== target) cancel();
  }
  function focus() {
    if (cancelled) return;
    if (panel.classList.contains("is-open") !== shouldBeOpen) { cancel(); return; }
    const visible = getComputedStyle(target).visibility !== "hidden" && target.getClientRects().length > 0;
    if (visible) target.focus();
  }
  owner.addEventListener("focusin", onFocus);
  for (const delay of [50, 200, 400]) timers.push(setTimeout(() => {
    focus();
    if (delay === 400) cancel();
  }, delay));
  return cancel;
}
