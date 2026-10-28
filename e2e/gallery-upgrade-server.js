import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { finalizeGalleryPwa } from "../scripts/gallery-pwa-build.mjs";
import { buildOriginalGallery } from "./fixtures/gallery-original-build.js";

// Bounded local A/B builds from public code and a real built engine, no production.
export async function galleryServer({ legacy = false } = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "pf-gallery-upgrade-"));
  const builds = { a: "a".repeat(40), b: "b".repeat(40) };
  let provenance;
  for (const [name, revision] of Object.entries(builds)) {
    const output = path.join(folder, name);
    if (legacy && name === "a") { provenance = await buildOriginalGallery(output); continue; }
    fs.cpSync("gallery", path.join(output, "gallery"), { recursive: true });
    fs.mkdirSync(path.join(output, "dist"));
    fs.copyFileSync("dist/printform.js", path.join(output, "dist/printform.js"));
    finalizeGalleryPwa(output, revision);
  }
  let selected = "a", broken = false, corrupted = false;
  const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/gallery/legacy-client.js") {
      response.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "no-store" });
      response.end(fs.readFileSync("e2e/fixtures/gallery-legacy-client.js")); return;
    }
    if (url.pathname === "/gallery/legacy.html" && selected === "a") {
      response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
      response.end('<!doctype html><title>Legacy Gallery update contract</title><button disabled>Update now</button><script type="module" src="./legacy-client.js"></script>'); return;
    }
    if (url.pathname === "/gallery/legacy.html") url.pathname = "/gallery/index.html";
    const file = path.resolve(folder, selected, `.${decodeURIComponent(url.pathname)}`);
    const relative = url.pathname.endsWith("/") ? path.join(file, "index.html") : file;
    if (!relative.startsWith(path.join(folder, selected) + path.sep)) { response.writeHead(403).end(); return; }
    if (broken && url.pathname.includes("releases/bbbbbbbbbbbb/gallery/js/modal.js")) { response.writeHead(503).end("synthetic failed asset"); return; }
    if (!fs.existsSync(relative) || !fs.statSync(relative).isFile()) { response.writeHead(404).end("Not found"); return; }
    response.writeHead(200, { "Content-Type": types[path.extname(relative)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(corrupted && url.pathname.includes("releases/bbbbbbbbbbbb/gallery/js/modal.js") ? "// synthetic corrupt asset" : fs.readFileSync(relative));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/gallery/index.html`,
    provenance,
    switchBuild(value, fail = false, corrupt = false) { selected = value; broken = fail; corrupted = corrupt; },
    async close() { await new Promise((resolve) => server.close(resolve)); fs.rmSync(folder, { recursive: true, force: true }); }
  };
}
