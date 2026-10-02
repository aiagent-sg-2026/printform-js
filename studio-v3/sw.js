const BUILD = '__PRINTFORM_V3_REVISION__';
const PREFIX = 'printform-studio-v3-shell:';
const CACHE = PREFIX + BUILD;
const SHELL = "__PRINTFORM_V3_SHELL__";
const ROOT = new URL('./',self.location.href);
const DEV = BUILD === 'local' || BUILD.startsWith('__');
async function matchesHash(response,expected) {
  if (!response?.ok || response.redirected) return false;
  const bytes = await response.clone().arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  return hash === expected;
}

self.addEventListener('install',event=> {
  if (DEV || !Array.isArray(SHELL)) return;
  event.waitUntil((async()=> {
    const existing = (await caches.keys()).includes(CACHE);
    const cache = await caches.open(CACHE);
    try {
      if (existing) {
        // A rollback can reinstall a retained SHA. Never damage the shell an
        // older open tab still needs, even when the rollback download fails.
        const valid = await Promise.all(SHELL.map(async entry=>matchesHash(await cache.match(new URL(entry.url,ROOT)),entry.hash)));
        if (valid.every(Boolean)) return;
        // Repair only after all replacement bytes pass verification. Failed
        // downloads keep existing entries; valid entries have identical bytes.
      }
      // Fetch and verify the entire build before this worker can be offered.
      // A failed/partially propagated Pages upload leaves the old worker usable.
      const responses = await Promise.all(SHELL.map(async entry=> {
        const response = await fetch(new URL(entry.url,ROOT),{cache:'reload'});
        if (!await matchesHash(response,entry.hash)) throw new Error('Shell integrity mismatch');
        return response;
      }));
      for (const [index,entry] of SHELL.entries()) await cache.put(new URL(entry.url,ROOT),responses[index]);
    } catch (error) { if (!existing) await caches.delete(CACHE); throw error; }
  })());
});
self.addEventListener('activate',event=> {
  // Retain older immutable shells: other tabs may still be editing on them.
  // No IndexedDB/localStorage clearing, no automatic skipWaiting or page reload.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('message',event=> {
  if (event.data?.type === 'VERSION') event.ports[0]?.postMessage({build:BUILD,ready:!DEV});
  if (event.data?.type === 'ACTIVATE' && event.data.build === BUILD && !DEV) self.skipWaiting();
});
self.addEventListener('fetch',event=> {
  const request = event.request, url = new URL(request.url);
  if (DEV || request.method !== 'GET' || url.origin !== ROOT.origin) return;
  const relative = url.pathname.slice(ROOT.pathname.length);
  if (!url.pathname.startsWith(ROOT.pathname)) return;
  if (request.mode === 'navigate' && (relative === '' || relative === 'index.html')) {
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(new URL('index.html',ROOT))).then(response=>response || Response.error()));
    return;
  }
  const release = /^releases\/([a-f0-9]{40})\//.exec(relative);
  if (release) {
    // Never fall back to a mutable URL or another build's runtime on a miss.
    event.respondWith(caches.keys().then(keys=>keys.includes(PREFIX+release[1]) ? caches.open(PREFIX+release[1]).then(cache=>cache.match(request)) : null).then(response=>response || fetch(request)));
  } else if (relative === 'icon.svg' || relative === 'manifest.webmanifest') {
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(request,{ignoreSearch:true})).then(response=>response || fetch(request)));
  }
});
