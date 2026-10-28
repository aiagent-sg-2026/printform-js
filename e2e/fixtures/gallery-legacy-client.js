// Synthetic old-client fixture preserving the pre-fix Gallery update contract:
// wait for an installed worker, user chooses Update now, send the original
// {type: SKIP_WAITING} message, reload once on controllerchange.
const button = document.querySelector("button");
let waiting, reloaded = false;
function offer(worker) { waiting = worker; button.disabled = false; }
navigator.serviceWorker.register("./sw.js", { scope: "./" }).then((reg) => {
  if (reg.waiting) offer(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const worker = reg.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) offer(worker);
    });
  });
  reg.update();
});
button.addEventListener("click", () => {
  button.disabled = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloaded) { reloaded = true; location.reload(); }
  }, { once: true });
  waiting.postMessage({ type: "SKIP_WAITING" });
});
