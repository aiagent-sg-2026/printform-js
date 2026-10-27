import { currentLanguage, pageCount, text, typeName } from "./i18n.js";

export function createModal(dialog, manifest) {
  const frame = dialog.querySelector("iframe");
  const title = dialog.querySelector("#modal-title");
  const meta = dialog.querySelector("#modal-meta");
  const open = dialog.querySelector("[data-open]");
  const print = dialog.querySelector("[data-print]");
  const studio = dialog.querySelector("[data-studio]");
  let returnFocus = null;
  const close = () => dialog.close();
  const frameWrap = dialog.querySelector(".frame-wrap");
  const frameStage = document.createElement("div");
  frameStage.className = "frame-stage";
  frame.parentNode.insertBefore(frameStage, frame);
  frameStage.appendChild(frame);
  let frameContentHeight = 0;
  let framePoll = null;
  let designUrl = "";

  function fitFrame() {
    const availableWidth = frameWrap.clientWidth;
    if (!availableWidth) return;
    const scale = Math.min(1, availableWidth / 794);
    frame.style.width = "794px";
    frame.style.height = `${frameContentHeight}px`;
    frame.style.transform = `scale(${scale})`;
    frameStage.style.width = `${794 * scale}px`;
    frameStage.style.height = `${frameContentHeight * scale}px`;
  }

  function cancelFramePoll() {
    if (framePoll !== null) {
      clearTimeout(framePoll);
      framePoll = null;
    }
  }

  function readFrameHeight() {
    try {
      frameContentHeight = frame.contentDocument.documentElement.scrollHeight;
    } catch {
      frameContentHeight = 0;
    }
    fitFrame();
  }

  frame.addEventListener("load", () => {
    cancelFramePoll();
    const started = Date.now();
    const poll = () => {
      let processed = false;
      try {
        processed = frame.contentWindow.__printFormProcessed === true;
      } catch {
        // Keep polling; the timeout path still attempts to read the height.
      }
      if (processed || Date.now() - started >= 5000) {
        print.disabled = !processed;
        framePoll = null;
        readFrameHeight();
        return;
      }
      framePoll = setTimeout(poll, 100);
    };
    poll();
  });

  print.addEventListener("click", () => {
    try {
      if (!frame.contentWindow || frame.contentWindow.__printFormProcessed !== true) {
        throw new Error("Print preview is not ready");
      }
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      window.open(designUrl, "_blank");
    }
  });
  window.addEventListener("resize", fitFrame);

  function show(design, trigger) {
    print.disabled = true;
    cancelFramePoll();
    frameContentHeight = 0;
    frameStage.style.height = "0px";
    returnFocus = trigger;
    title.textContent = `${design.no} · ${design.title[currentLanguage()]}`;
    meta.textContent = `${typeName(design.type)} · ${design.style[currentLanguage()]} · ${design.paper} · ${pageCount(design.pages)}`;
    designUrl = new URL(`../${design.file}`, import.meta.url).href;
    frame.src = designUrl;
    open.href = designUrl;
    open.textContent = text("openDesign");
    const safeStudioUrl = design.studioUrl && /^\.\/studio-v3(?:\/|$)/.test(design.studioUrl);
    studio.hidden = !safeStudioUrl;
    if (safeStudioUrl) {
      studio.href = new URL(`../../${design.studioUrl.slice(2)}`, import.meta.url).href;
      studio.textContent = text("openStudio");
    }
    dialog.showModal();
    fitFrame();
    dialog.querySelector("[data-close]").focus();
  }
  dialog.querySelector("[data-close]").addEventListener("click", close);
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  dialog.addEventListener("close", () => {
    cancelFramePoll();
    frameContentHeight = 0;
    frameStage.style.height = "0px";
    frame.removeAttribute("src");
    const currentCard = [...document.querySelectorAll(".gallery-card")].find((card) => card.dataset.designId === returnFocus?.dataset.designId);
    const target = returnFocus?.isConnected ? returnFocus : currentCard || document.querySelector("#search");
    target?.focus();
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
        title.textContent = `${design.no} · ${design.title[currentLanguage()]}`;
        meta.textContent = `${typeName(design.type)} · ${design.style[currentLanguage()]} · ${design.paper} · ${pageCount(design.pages)}`;
        open.textContent = text("openDesign");
        if (!studio.hidden) studio.textContent = text("openStudio");
      }
    }
  });
  return { show };
}
