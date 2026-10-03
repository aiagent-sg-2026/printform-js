import { bindHorizontalWheel } from "./preview-wheel.js";
import { bindInspectorResize } from "./inspector-resize.js";
import { focusInspectorElement } from "./inspector-focus.js";

function bindLocaleMenu($, onLocaleChange) {
  const trigger = $("#ui-locale-button");
  const panel = $("#ui-locale-menu");
  const select = $("#ui-locale-select");
  const options = Array.from(panel?.querySelectorAll("[data-locale]") || []);
  if (!trigger || !panel || !select || !options.length) return;
  const isOpen = () => !panel.hidden;
  const place = () => {
    const rect = trigger.getBoundingClientRect();
    const width = panel.offsetWidth || 170;
    const left = Math.max(8, Math.min(Math.round(rect.left), window.innerWidth - width - 8));
    panel.style.top = `${Math.round(rect.bottom + 6)}px`;
    panel.style.left = `${left}px`;
  };
  const focusOption = (index) => options[(index + options.length) % options.length]?.focus();
  const close = (focusTrigger = false) => {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", place, { capture: true });
    if (focusTrigger) trigger.focus();
  };
  const open = () => {
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    place();
    focusOption(Math.max(0, options.findIndex((option) => option.dataset.locale === select.value)));
    window.addEventListener("resize", place, { passive: true });
    window.addEventListener("scroll", place, { passive: true, capture: true });
  };
  options.forEach((option, index) => {
    option.addEventListener("click", () => {
      select.value = option.dataset.locale;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      close(true);
    });
    option.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") { event.preventDefault(); focusOption(index + 1); }
      if (event.key === "ArrowUp") { event.preventDefault(); focusOption(index - 1); }
      if (event.key === "Home") { event.preventDefault(); focusOption(0); }
      if (event.key === "End") { event.preventDefault(); focusOption(options.length - 1); }
      if (event.key === "Escape") { event.preventDefault(); close(true); }
    });
  });
  trigger.addEventListener("click", () => (isOpen() ? close() : open()));
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && !isOpen()) { event.preventDefault(); open(); }
  });
  document.addEventListener("click", (event) => { if (isOpen() && !panel.contains(event.target) && !trigger.contains(event.target)) close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && isOpen()) { close(true); } });
}

function bindTopbarMenu(trigger, panel) {
  if (!trigger || !panel) return;
  const supported = typeof panel.showPopover === "function" && "popover" in HTMLElement.prototype;
  const isOpen = () => (supported ? panel.matches(":popover-open") : !panel.hidden);
  function place() {
    const rect = trigger.getBoundingClientRect();
    const width = panel.offsetWidth || 200;
    const left = Math.max(8, Math.min(Math.round(rect.right - width), window.innerWidth - width - 8));
    panel.style.position = "fixed"; panel.style.top = `${Math.round(rect.bottom + 6)}px`; panel.style.left = `${left}px`;
  }
  function close() {
    if (supported) { if (panel.matches(":popover-open")) panel.hidePopover(); }
    else panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    window.removeEventListener("resize", close); window.removeEventListener("scroll", close, { capture: true });
  }
  function open() {
    if (supported) { if (!panel.matches(":popover-open")) panel.showPopover(); }
    else panel.hidden = false;
    place(); trigger.setAttribute("aria-expanded", "true");
    (panel.querySelector('[role="menuitem"], button, [tabindex]') || panel).focus?.();
    window.addEventListener("resize", close, { passive: true }); window.addEventListener("scroll", close, { passive: true, capture: true });
  }
  if (supported) panel.addEventListener("toggle", (event) => event.newState === "open" ? open() : close());
  else { trigger.removeAttribute("popovertarget"); panel.hidden = true; trigger.addEventListener("click", () => (isOpen() ? close() : open())); document.addEventListener("click", (event) => { if (isOpen() && !panel.contains(event.target) && !trigger.contains(event.target)) close(); }); }
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && isOpen()) { close(); trigger.focus(); } });
  panel.addEventListener("click", (event) => { if (event.target.closest('[role="menuitem"]')) close(); });
}

function bindEditorToggle($, t) {
  const panel = $("#editor-panel"); const toggle = $("#editor-toggle"); const label = $("#editor-toggle-label"); const close = $("#editor-panel-close");
  if (!panel || !toggle) return null;
  let open = false;
  function update(next, { moveFocus = false, restoreFocus = false, focusTarget = toggle } = {}) {
    open = Boolean(next); const key = open ? "editor.toggle.hide" : "editor.toggle.show";
    panel.classList.toggle("is-closed", !open); document.body.classList.toggle("editor-closed", !open); panel.setAttribute("aria-hidden", String(!open));
    if ("inert" in panel) panel.inert = !open; toggle.setAttribute("aria-expanded", String(open)); toggle.setAttribute("aria-label", t(key)); toggle.setAttribute("title", t(key)); if (label) label.textContent = t(key);
    if (close) { close.textContent = t("editor.toggle.hide"); close.setAttribute("aria-label", t("editor.toggle.hide")); close.setAttribute("title", t("editor.toggle.hide")); }
    // The editor toggles display synchronously; delayed focus can steal a newer selection.
    if (open && moveFocus) close?.focus(); if (!open && restoreFocus) focusTarget?.focus();
  }
  function flip() { update(!open, { moveFocus: !open, restoreFocus: open }); }
  toggle.addEventListener("click", flip); close?.addEventListener("click", flip); update(false);
  return { refresh: () => update(open) };
}

function bindTabs($) {
  const tabs = Array.from(document.querySelectorAll(".inspector-tabs [role=tab]")); const panel = $(".inspector-panel"); const header = $(".inspector-header"); const toggle = $("#inspector-toggle"); const close = $("#inspector-close"); const launchers = [toggle].filter(Boolean); let restoreTarget = toggle;
  let cancelFocus = () => {};
  [toggle, close].filter(Boolean).forEach((item) => item.addEventListener("mousedown", (event) => event.preventDefault()));
  function setOpen(open, { restoreFocus = false, moveFocus = false, focusTarget = restoreTarget } = {}) {
    cancelFocus();
    const next = Boolean(open); panel.classList.toggle("is-open", next); panel.classList.toggle("is-closed", !next); document.body.classList.toggle("inspector-closed", !next); panel.setAttribute("aria-hidden", String(!next)); if ("inert" in panel) panel.inert = !next; launchers.forEach((item) => item.setAttribute("aria-expanded", String(next)));
    if (next && moveFocus) { close?.focus(); cancelFocus = focusInspectorElement(panel, close, true); }
    if (!next && restoreFocus) { focusTarget?.focus(); cancelFocus = focusInspectorElement(panel, focusTarget, false); }
  }
  function select(tab) { if (!tab) return; tabs.forEach((item) => { const selected = item === tab; item.setAttribute("aria-selected", String(selected)); $(`#${item.getAttribute("aria-controls")}`).hidden = !selected; }); header?.setAttribute("data-active-tab", tab.id); setOpen(true); }
  tabs.forEach((tab, index) => { tab.addEventListener("click", () => select(tab)); tab.addEventListener("keydown", (event) => { if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault(); select(tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]); }); });
  function openAiDesigner(source) { const next = !panel.classList.contains("is-open"); if (next) { restoreTarget = source || toggle; select(tabs.find((item) => item.id === "ai-designer-tab") || tabs[0]); setOpen(true, { moveFocus: true }); } else setOpen(false, { restoreFocus: true, focusTarget: source }); }
  toggle?.addEventListener("click", (event) => { event.preventDefault(); openAiDesigner(toggle); }); close?.addEventListener("click", (event) => { event.preventDefault(); setOpen(false, { restoreFocus: true }); }); document.addEventListener("keydown", (event) => { if (event.key === "Escape" && panel.classList.contains("is-open")) setOpen(false, { restoreFocus: true }); }); setOpen(false);
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || window.innerWidth > 1080 || !panel.classList.contains("is-open")) return;
    const activePanel = panel.querySelector('[role="tabpanel"]:not([hidden])');
    const focusable = [...panel.querySelectorAll(".inspector-header button:not([disabled])"), ...(activePanel?.querySelectorAll(`button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])`) || [])].filter((element) => element.offsetParent !== null || element === document.activeElement);
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}

export function bindAppUi({ $, actions, getBus, renderer, renderQuality, toast, t, onLocaleChange, refreshLocalizedUi, onDataPolicyChange, onSample, onHistoryAction, getLastValidation, isDirty, versions }) {
  $("#apply-source-button").addEventListener("click", actions.applySource); $("#import-file").addEventListener("change", (event) => actions.importFile(event.target.files[0])); $("#validate-button").addEventListener("click", () => { renderQuality(getBus().readiness()); toast(t("toast.validationDone")); }); $("#export-button").addEventListener("click", () => actions.exportDocument(true)); $("#export-untrusted-button").addEventListener("click", () => actions.exportDocument(false)); $("#print-button").addEventListener("click", actions.openPrintPreview); $("#retry-preview-button")?.addEventListener("click", () => renderer.schedulePreview(0));
  $("#undo-button").addEventListener("click", () => onHistoryAction("undo_revision")); $("#redo-button").addEventListener("click", () => onHistoryAction("redo_revision")); $("#scenario-select").addEventListener("change", async (event) => { const bus = getBus(); renderer.markPending(); const result = await bus.execute("set_sample_scenario", { expectedRevision: bus.revision, scenario: event.target.value }); if (!result.ok) { toast(result.error.message); renderer.restoreCommitted(); } else if (result.result?.diff?.changed === false) renderer.restoreCommitted(); }); $("#locale-select").addEventListener("change", async (event) => { const bus = getBus(); renderer.markPending(); const result = await bus.execute("set_locale", { expectedRevision: bus.revision, locale: event.target.value }); if (!result.ok) { toast(result.error.message); renderer.restoreCommitted(); } else if (result.result?.diff?.changed === false) renderer.restoreCommitted(); });
  $("#apply-logo-button").addEventListener("click", actions.applyLogoSources); $("#apply-font-scale-button").addEventListener("click", actions.applyFontScale); $("#apply-brand-color-button").addEventListener("click", actions.applyBrandColor); $("#brand-color-input").addEventListener("input", (event) => { $("#brand-color-text").value = event.target.value; }); $("#apply-page-settings-button").addEventListener("click", actions.applyPageSettings); $("#apply-repeat-flags-button").addEventListener("click", actions.applyRepeatFlags); $("#apply-data-contract-button").addEventListener("click", actions.applyDataContract);
  $("#document-select").addEventListener("change", (event) => onSample(event.target.value)); $("#diagnostics-button").addEventListener("click", () => actions.downloadDiagnostics(getLastValidation(), versions.studio, versions.agent)); $("#reset-trust-button").addEventListener("click", actions.resetTrust); $("#ui-locale-select").addEventListener("change", onLocaleChange); bindLocaleMenu($, onLocaleChange); $("#real-data-mode").addEventListener("change", async (event) => onDataPolicyChange(Boolean(event.target.checked))); $("#overlay-toggle").addEventListener("change", (event) => renderer.toggleOverlay(event.target.checked));
  window.addEventListener("printform:ui-locale", refreshLocalizedUi); window.addEventListener("beforeunload", (event) => { if (isDirty()) { event.preventDefault(); event.returnValue = ""; } });
  const editorToggle = bindEditorToggle($, t); bindTabs($); bindInspectorResize(); bindHorizontalWheel($(".actions")); bindTopbarMenu($("#more-menu-button"), $("#more-menu")); bindTopbarMenu($("#export-menu-button"), $("#export-menu")); $("#import-file-item")?.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); $("#import-file").click(); } });
  return editorToggle;
}
