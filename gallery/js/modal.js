import { currentLanguage, pageCount, text, typeName } from "./i18n.js";

export function createModal(dialog, manifest) {
  const frame = dialog.querySelector("iframe");
  const title = dialog.querySelector("#modal-title");
  const meta = dialog.querySelector("#modal-meta");
  const open = dialog.querySelector("[data-open]");
  const studio = dialog.querySelector("[data-studio]");
  let returnFocus = null;
  const close = () => dialog.close();

  function show(design, trigger) {
    returnFocus = trigger;
    title.textContent = design.title[currentLanguage()];
    meta.textContent = `${typeName(design.type)} · ${design.paper} · ${pageCount(design.pages)}`;
    frame.src = new URL(`../${design.file}`, import.meta.url).href;
    open.href = new URL(`../${design.file}`, import.meta.url).href;
    open.textContent = text("openDesign");
    const safeStudioUrl = design.studioUrl && /^\.\/studio-v3(?:\/|$)/.test(design.studioUrl);
    studio.hidden = !safeStudioUrl;
    if (safeStudioUrl) {
      studio.href = new URL(`../../${design.studioUrl.slice(2)}`, import.meta.url).href;
      studio.textContent = text("openStudio");
    }
    dialog.showModal();
    dialog.querySelector("[data-close]").focus();
  }

  dialog.querySelector("[data-close]").addEventListener("click", close);
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  dialog.addEventListener("close", () => {
    frame.removeAttribute("src");
    returnFocus?.focus();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll("a[href],button:not([disabled]):not([hidden])")];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.addEventListener("gallery-language-change", () => {
    if (dialog.open && returnFocus?.dataset.designId) {
      const design = manifest.find((item) => item.id === returnFocus.dataset.designId);
      if (design) {
        title.textContent = design.title[currentLanguage()];
        meta.textContent = `${typeName(design.type)} · ${design.paper} · ${pageCount(design.pages)}`;
        open.textContent = text("openDesign");
        if (!studio.hidden) studio.textContent = text("openStudio");
      }
    }
  });
  return { show };
}
