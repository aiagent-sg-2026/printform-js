import { text } from "./i18n.js";
import { smartScrollDecision } from "./smart-scroll.js";
import { createUpdater } from "./pwa-update.js";

const banner = document.querySelector("#update-banner");
const updateButton = document.querySelector("#update-button");
const checkButton = document.querySelector("#check-update");
const status = document.querySelector("#connection-status");
const running = document.querySelector('meta[name="printform-build"]')?.content || "local";
let lastCheck = 0;
const updater = createUpdater({
  serviceWorker: navigator.serviceWorker,
  scope: new URL("./", location.href).href,
  running,
  online: () => navigator.onLine,
  busy: () => Boolean(document.querySelector("dialog[open]")),
  reload: () => location.reload(),
  async fetchLatest() {
    const response = await fetch(`./build-info.json?check=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Build check failed");
    const value = await response.json();
    if (typeof value.build !== "string" || !/^[\w-]{1,80}$/.test(value.build)) throw new Error("Invalid build");
    return value.build;
  },
  render({ state, available, checking, activating, blocked }) {
    document.querySelector("#running-version").textContent = running === "local" ? text("localBuild") : running;
    document.querySelector("#update-state").textContent = `${text(state)}${available ? ` · ${available}` : ""}`;
    banner.hidden = !available;
    banner.querySelector("span").textContent = `${text(blocked ? "updateDeferred" : "updateAvailable")} · ${available}`;
    updateButton.textContent = text(activating ? "updating" : "updateNow");
    updateButton.disabled = activating || blocked || !navigator.onLine;
    checkButton.disabled = checking || activating;
    document.querySelector("#update-overlay").hidden = !activating;
  }
});
function languageChanged() {
  status.textContent = navigator.onLine ? text("online") : text("offline");
  status.hidden = navigator.onLine;
  document.querySelector("#scroll-top").setAttribute("aria-label", text("scrollTop"));
  updater.refresh();
}
const check = () => { lastCheck = Date.now(); return updater.check(); };
checkButton.addEventListener("click", check);
updateButton.addEventListener("click", updater.activate);
document.addEventListener("gallery-language-change", languageChanged);
document.addEventListener("gallery-dialog-change", updater.refresh);
let reconnectTimer;
// Connectivity events can precede the worker/network stack becoming usable.
// One bounded delayed check, never an activation or reload.
window.addEventListener("online", () => {
  languageChanged(); clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(check, 1000);
});
window.addEventListener("offline", () => { clearTimeout(reconnectTimer); languageChanged(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - lastCheck > 600000) check(); });
document.addEventListener("gallery-design-fetch-404", check);
navigator.serviceWorker?.addEventListener("message", (event) => {
  if (event.source !== navigator.serviceWorker.controller || event.origin !== location.origin) return;
  if (event.data?.type === "DESIGN_404") check();
  if (event.data?.type === "PWA_READY") { status.textContent = text("readyOffline"); status.hidden = false; }
});
languageChanged();
updater.start();
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
