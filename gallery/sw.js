importScripts("./build-identity-classic.js");
const BUILD = "dev";
const SHELL_CACHE = `pf-gallery-shell-${BUILD}`;
const THUMB_CACHE = "pf-gallery-thumbs-v1";
const PRECACHE = "__PF_GALLERY_PRECACHE__";
const canon = (url) => { const value = new URL(url); value.search = ""; value.hash = ""; return value.href; };

self.addEventListener("install", (event) => event.waitUntil((async () => {
  try {
    await self.requireBuildIdentity(BUILD, fetch(`./build-info.json?v=${BUILD}`, { cache: "reload" }));
    const cache = await caches.open(SHELL_CACHE);
    for (const path of PRECACHE) {
      const url = new URL(path, self.registration.scope);
      url.searchParams.set("v", BUILD);
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error(`Precache failed: ${path}`);
      await cache.put(canon(url), response);
    }
  } catch (error) {
    await caches.delete(SHELL_CACHE);
    throw error;
  }
})())); 
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith("pf-gallery-") && name !== SHELL_CACHE && name !== THUMB_CACHE) await caches.delete(name);
  await self.clients.matchAll({ type: "window" }).then((clients) => clients.forEach((client) => client.postMessage({ type: "PWA_READY" })));
})()));
self.addEventListener("message", (event) => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  const key = canon(url);
  if (url.pathname.includes("/thumbs/")) {
    event.respondWith((async () => {
      const cache = await caches.open(THUMB_CACHE), saved = await cache.match(key);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(key, response.clone());
        const keys = await cache.keys();
        for (const old of keys.slice(0, Math.max(0, keys.length - 120))) await cache.delete(old);
      }
      return response;
    })()); return;
  }
  if (request.mode === "navigate" || /\.html$/i.test(url.pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.status === 404 && url.pathname.includes("/designs/")) {
          const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
          clients.forEach((client) => client.postMessage({ type: "DESIGN_404" }));
        }
        if (response.ok) { const cache = await caches.open(SHELL_CACHE); await cache.put(key, response.clone()); }
        return response;
      }
      catch { return await (await caches.open(SHELL_CACHE)).match(key) || await (await caches.open(SHELL_CACHE)).match(new URL("./index.html", self.registration.scope).href); }
    })()); return;
  }
  event.respondWith((async () => (await (await caches.open(SHELL_CACHE)).match(key)) || fetch(request))());
});
