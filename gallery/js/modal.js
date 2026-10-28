import { currentLanguage, pageCount, text, typeName } from "./i18n.js";
import { createDialog } from "../shared/dialog.js";

export function createModal(dialog, manifest) {
  const frame = dialog.querySelector("iframe");
  const title = dialog.querySelector("#modal-title");
  const meta = dialog.querySelector("#modal-meta");
  const open = dialog.querySelector("[data-open]");
  const print = dialog.querySelector("[data-print]");
  const studio = dialog.querySelector("[data-studio]");
  const status = dialog.querySelector(".preview-status");
  let returnFocus, currentDesign, framePoll, designUrl = "", state = "previewLoading";
  const primitive = createDialog(dialog, () => {
    const card = [...document.querySelectorAll(".gallery-card")].find((node) => node.dataset.designId === returnFocus?.dataset.designId);
    return returnFocus?.isConnected ? returnFocus : card || document.querySelector("#search");
  });
  function cancelPoll() { clearTimeout(framePoll); framePoll = null; }
  function showStatus(next) {
    state = next;
    status.hidden = !next;
    status.textContent = next ? text(next) : "";
  }
  function localize() {
    if (!currentDesign) return;
    title.textContent = `${currentDesign.no} · ${currentDesign.title[currentLanguage()]}`;
    meta.textContent = `${typeName(currentDesign.type)} · ${currentDesign.style[currentLanguage()]} · ${currentDesign.paper} · ${pageCount(currentDesign.pages)}`;
    open.textContent = text("openDesign");
    studio.textContent = text("openStudio");
    showStatus(state);
  }
  frame.addEventListener("load", () => {
    cancelPoll();
    if (!dialog.open) return;
    try { if (frame.contentWindow.location.href === "about:blank") return; }
    catch { showStatus("previewError"); return; }
    const started = Date.now();
    const poll = () => {
      if (!dialog.open) return;
      try {
        primitive.bindFrame(frame.contentDocument);
        if (frame.contentWindow.__printFormProcessed === true) {
          print.disabled = false;
          showStatus("");
          return;
        }
      } catch { /* A failed/cross-origin load keeps the recoverable action. */ }
      if (Date.now() - started >= 10000) { showStatus("previewError"); return; }
      framePoll = setTimeout(poll, 100);
    };
    poll();
  });
  frame.addEventListener("error", () => { cancelPoll(); showStatus("previewError"); });
  print.addEventListener("click", () => {
    try {
      if (frame.contentWindow.__printFormProcessed !== true) throw new Error("Preview not ready");
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch { window.open(designUrl, "_blank", "noopener"); }
  });
  dialog.addEventListener("close", () => {
    cancelPoll();
    print.disabled = true;
    frame.contentWindow.location.replace("about:blank");
    currentDesign = null;
  });
  document.addEventListener("gallery-language-change", localize);
  return {
    show(design, trigger) {
      cancelPoll();
      print.disabled = true;
      returnFocus = trigger;
      currentDesign = design;
      designUrl = new URL(`../${design.file}`, import.meta.url).href;
      open.href = designUrl;
      const safeStudio = design.studioUrl && /^\.\/studio-v3(?:\/|$)/.test(design.studioUrl);
      studio.hidden = !safeStudio;
      if (safeStudio) studio.href = new URL(`../${design.studioUrl.slice(2)}`, document.baseURI).href;
      showStatus("previewLoading");
      localize();
      primitive.open();
      // replace avoids adding iframe entries to Gallery's filter history.
      frame.contentWindow.location.replace(designUrl);
      framePoll = setTimeout(() => showStatus("previewError"), 12000);
    }
  };
}
