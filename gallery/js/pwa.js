import { text } from "./i18n.js";
import { smartScrollDecision } from "./smart-scroll.js";

const banner = document.querySelector("#update-banner");
const updateButton = document.querySelector("#update-button");
const status = document.querySelector("#connection-status");
let registration, lastCheck = 0, reloaded = false, deferredWorker;
function languageChanged() {
  banner.querySelector("span").textContent = text("updateAvailable"); updateButton.textContent = text("updateNow");
  status.textContent = navigator.onLine ? text("online") : text("offline"); status.hidden = navigator.onLine;
  document.querySelector("#scroll-top").setAttribute("aria-label", text("scrollTop"));
}
document.addEventListener("gallery-language-change", languageChanged);
function showWaiting(worker) { deferredWorker = worker; banner.hidden = false; languageChanged(); }
function updateFlow() {
  const button = updateButton; button.disabled = true; button.textContent = text("updating");
  const overlay = document.querySelector("#update-overlay"); overlay.hidden = false;
  const timeout = setTimeout(() => { overlay.hidden = true; button.disabled = false; button.textContent = text("retry"); button.dataset.retry = "true"; }, 10000);
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; clearTimeout(timeout); location.reload(); } }, { once: true });
  deferredWorker?.postMessage({ type: "SKIP_WAITING" });
}
updateButton.addEventListener("click", () => { if (updateButton.dataset.retry) { updateButton.dataset.retry = ""; deferredWorker?.postMessage({ type: "SKIP_WAITING" }); } else updateFlow(); });
window.addEventListener("online", languageChanged); window.addEventListener("offline", languageChanged);
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", (event) => {
  if (event.data?.type === "DESIGN_404") registration?.update().catch(() => {});
  if (event.data?.type === "PWA_READY" && !sessionStorage.getItem("gallery-pwa-ready")) { sessionStorage.setItem("gallery-pwa-ready", "1"); status.textContent = text("readyOffline"); status.hidden = false; }
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { scope: "./" }).then((reg) => {
  registration = reg; if (reg.waiting) showWaiting(reg.waiting);
  reg.addEventListener("updatefound", () => { const worker = reg.installing; worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) showWaiting(worker); }); });
  const check = () => { if (Date.now() - lastCheck > 600000) { lastCheck = Date.now(); reg.update().catch(() => {}); } };
  check(); document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  document.addEventListener("gallery-design-fetch-404", () => reg.update().catch(() => {}));
}).catch(() => {});
languageChanged();
let previousY = scrollY, accumulated = 0, visible = true;
const bar = document.querySelector(".topbar");
function scroll() {
  const forced = document.querySelector("dialog[open]") || bar.contains(document.activeElement);
  const decision = smartScrollDecision({ previousY, currentY: scrollY, accumulated, forced: Boolean(forced) });
  previousY = scrollY; accumulated = decision.accumulated;
  if (decision.visible !== null && visible !== decision.visible) { visible = decision.visible; bar.classList.toggle("topbar-hidden", !visible); }
  document.querySelector("#scroll-top").hidden = scrollY <= innerHeight;
}
addEventListener("scroll", scroll, { passive: true });
document.querySelector("#scroll-top").addEventListener("click", () => scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }));
