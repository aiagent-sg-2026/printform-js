import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export function buildGalleryPrecache(galleryRoot, siteRoot) {
  const data = JSON.parse(fs.readFileSync(path.join(galleryRoot, "manifest.json"), "utf8"));
  const shell = ["index.html", "gallery.css", "manifest.json", "manifest.webmanifest", "js/main.js", "js/modal.js", "js/filter.js", "js/categories.js", "js/filter-state.js", "js/filter-controls.js", "js/i18n.js", "js/manifest-loader.js", "js/smart-scroll.js", "js/pwa.js", "js/pwa-update.js", "js/order.js", "shared/dialog.js", "shared/dialog.css", "require-build-identity.js", "build-identity-classic.js", "sw.js", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon-180.png"];
  for (const entry of data) shell.push(entry.file);
  for (const dir of ["designs/shared", "designs/assets"]) {
    const absolute = path.join(galleryRoot, dir);
    if (!fs.existsSync(absolute)) continue;
    const walk = (folder) => fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((entry) => entry.isDirectory() ? walk(path.join(folder, entry.name)) : shell.push(path.relative(galleryRoot, path.join(folder, entry.name)).split(path.sep).join("/")));
    walk(absolute);
  }
  shell.push("../dist/printform.js");
  const unique = [...new Set(shell)];
  for (const file of unique) if (!fs.existsSync(path.resolve(siteRoot, "gallery", file))) throw new Error(`Gallery PWA precache file missing: ${file}`);
  return unique;
}
export function finalizeGalleryPwa(output, revision = process.env.GITHUB_SHA) {
  const build = revision && /^[a-f0-9]{40}$/i.test(revision) ? revision.slice(0, 12) : `local-${Date.now()}`;
  const gallery = path.resolve(output, "gallery");
  const files = buildGalleryPrecache(gallery, output);
  fs.writeFileSync(path.join(gallery, "build-info.json"), JSON.stringify({ build }));
  // Pin every module, stylesheet, template and runtime to the loaded page's build.
  // A different tab activating a worker cannot silently mix A's page with B's JS.
  const release = `releases/${build}`;
  const precache = ["index.html"];
  for (const file of files.filter((file) => !["index.html", "sw.js"].includes(file))) {
    const relative = path.posix.normalize(`${release}/gallery/${file}`);
    const destination = path.join(gallery, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.resolve(gallery, file), destination);
    precache.push(relative);
  }
  const index = path.join(gallery, "index.html");
  const html = fs.readFileSync(index, "utf8")
    .replace("<head>", `<head>\n  <meta name="printform-build" content="${build}">`)
    .replaceAll('href="./gallery.css"', `href="./${release}/gallery/gallery.css"`)
    .replaceAll('href="./shared/dialog.css"', `href="./${release}/gallery/shared/dialog.css"`)
    .replaceAll('src="./js/main.js"', `src="./${release}/gallery/js/main.js"`);
  fs.writeFileSync(index, html);
  // Icons remain available at the webmanifest's stable public URLs.
  for (const file of files.filter((file) => file.startsWith("icons/"))) precache.push(file);
  const hashes = Object.fromEntries(precache.map((file) => [file, createHash("sha256").update(fs.readFileSync(path.join(gallery, file))).digest("hex")]));
  const worker = path.join(gallery, "sw.js"), source = fs.readFileSync(worker, "utf8");
  if (!source.includes('const BUILD = "dev";') || !source.includes('const PRECACHE = "__PF_GALLERY_PRECACHE__";') || !source.includes('const HASHES = "__PF_GALLERY_HASHES__";')) throw new Error("Gallery service worker build placeholders missing");
  fs.writeFileSync(worker, source.replace('const BUILD = "dev";', `const BUILD = ${JSON.stringify(build)};`).replace('const PRECACHE = "__PF_GALLERY_PRECACHE__";', `const PRECACHE = ${JSON.stringify(precache)};`).replace('const HASHES = "__PF_GALLERY_HASHES__";', `const HASHES = ${JSON.stringify(hashes)};`));
  console.log(`Gallery PWA precache: ${precache.length} verified files (${build})`);
}
