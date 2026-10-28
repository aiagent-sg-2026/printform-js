// One explicit user-action activation contract. Other tabs never force a reload.
export function createUpdater({ serviceWorker, scope, running, online, busy, render, reload, fetchLatest }) {
  let registration, target, state = "checking", checking, starting, activating = false, reloaded = false, timer;
  const watched = new WeakSet();
  function publish(next = state) {
    state = next;
    render({ state, available: target?.build || "", checking: Boolean(checking), activating, blocked: busy() });
  }
  function identity(worker) {
    return new Promise((resolve, reject) => {
      if (!worker) { reject(new Error("Missing worker")); return; }
      const channel = new MessageChannel();
      const timeout = setTimeout(() => { channel.port1.close(); reject(new Error("Worker did not respond")); }, 3000);
      channel.port1.onmessage = ({ data }) => {
        clearTimeout(timeout); channel.port1.close();
        if (data?.type === "BUILD" && typeof data.build === "string" && /^[\w-]{1,80}$/.test(data.build)) resolve(data.build);
        else reject(new Error("Invalid build identity"));
      };
      worker.postMessage({ type: "GET_BUILD" }, [channel.port2]);
    });
  }
  async function offer(worker) {
    try {
      const build = await identity(worker);
      if (build !== running) { target = { build, worker }; publish("updateAvailable"); }
    } catch { publish("updateFailed"); }
  }
  function watch(worker) {
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") offer(registration.waiting || worker);
      if (worker.state === "redundant") publish("updateFailed");
    });
  }
  async function check() {
    if (checking || activating) return checking;
    if (!registration) return start();
    if (!online()) { publish("offline"); return; }
    checking = (async () => {
      publish("checking");
      try {
        const latest = await fetchLatest();
        await registration.update();
        if (registration.installing) {
          const worker = registration.installing;
          watch(worker);
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => { worker.removeEventListener("statechange", changed); reject(new Error("Install timeout")); }, 25000);
            function changed() {
              if (!["installed", "activated", "redundant"].includes(worker.state)) return;
              clearTimeout(timeout); worker.removeEventListener("statechange", changed);
              worker.state === "redundant" ? reject(new Error("Install failed")) : resolve();
            }
            worker.addEventListener("statechange", changed); changed();
          });
        }
        if (registration.waiting) await offer(registration.waiting);
        else if (registration.active && await identity(registration.active) !== running) await offer(registration.active);
        else if (latest === running) { target = null; publish("upToDate"); }
        else publish("updateFailed");
      } catch (error) { console.warn("Gallery update check failed", error); publish(online() ? "updateFailed" : "offline"); }
    })();
    publish();
    try { await checking; } finally { checking = null; publish(); }
  }
  function finish() {
    if (!activating || reloaded) return;
    clearTimeout(timer);
    reloaded = true;
    reload();
  }
  async function activate() {
    if (!target || activating) return;
    if (!online()) { publish("offline"); return; }
    if (busy()) { publish("updateDeferred"); return; }
    activating = true;
    publish("updating");
    timer = setTimeout(() => { activating = false; publish("updateFailed"); }, 10000);
    try {
      if (registration.waiting && await identity(registration.waiting) === target.build) {
        registration.waiting.postMessage({ type: "SKIP_WAITING", build: target.build });
      } else if (registration.active && await identity(registration.active) === target.build) finish();
      else throw new Error("Update no longer ready");
    } catch { clearTimeout(timer); activating = false; publish("updateFailed"); }
  }
  serviceWorker?.addEventListener("controllerchange", () => {
    if (activating) finish();
    else if (registration?.active) offer(registration.active);
  });
  async function start() {
    if (starting) return starting;
    if (!serviceWorker) { publish("unsupported"); return; }
    starting = (async () => {
      try {
        const existing = await serviceWorker.getRegistration("./");
        registration = existing && (!scope || existing.scope === scope) ? existing : await serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" });
        registration.addEventListener("updatefound", () => watch(registration.installing));
        watch(registration.installing);
        if (registration.waiting) await offer(registration.waiting);
        await check();
      } catch { publish(online() ? "updateFailed" : "offline"); }
    })();
    try { await starting; } finally { starting = null; }
  }
  return { check, activate, start, refresh: () => publish() };
}
