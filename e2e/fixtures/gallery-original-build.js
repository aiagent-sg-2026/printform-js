import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

// Frozen public original, NOT a new worker with a simulated legacy button.
export const legacyRevision = "53bd82bebad913553ad39d5e8c8ef63638db75f5";
const workerBlob = "b0c0b0b00d74b748503c042ac975d77a2228ec4a";
const builderBlob = "8f918a556792f569adcfebeb7a3b3ce83bcf262e";
const archiveSha256 = "bba0bbfa933b89f53c838d9df20f3acf64f881f86072d670524339a8f9429313";
const builtWorkerSha256 = "a673efc47df4c8fb1c9516da72872636f0feb874a1ad3bc35d6b0c28c337a2f1";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const gitBlob = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

function originalInputs() {
  const archive = fs.readFileSync("e2e/fixtures/gallery-original/inputs.json.gz");
  if (archive.length > 2 * 1024 * 1024 || sha256(archive) !== archiveSha256) {
    throw new Error("Original Gallery archive SHA-256 mismatch");
  }
  // JSON/base64 avoids tar, executable entries, symlinks and external extractors.
  const entries = JSON.parse(gunzipSync(archive, { maxOutputLength: 4 * 1024 * 1024 }).toString("utf8"));
  if (!Array.isArray(entries) || entries.length !== 175) throw new Error("Original Gallery archive entry count mismatch");
  const seen = new Set();
  return entries.map(([name, encoded]) => {
    if (typeof name !== "string" || !/^[a-zA-Z0-9_./-]+$/.test(name) ||
        name.split("/").some((part) => !part || part === "." || part === "..") ||
        !(name === "LICENSE" || name === "scripts/gallery-pwa-build.mjs" || name.startsWith("gallery/")) ||
        seen.has(name) || typeof encoded !== "string") throw new Error("Invalid original Gallery archive entry");
    seen.add(name);
    return [name, Buffer.from(encoded, "base64")];
  });
}

export async function buildOriginalGallery(output) {
  const entries = originalInputs(); // Verify the entire immutable payload before writing or importing it.
  if (fs.existsSync(output) && (!fs.lstatSync(output).isDirectory() || fs.readdirSync(output).length)) {
    throw new Error("Original Gallery output must be an empty directory");
  }
  fs.mkdirSync(output, { recursive: true });
  for (const [name, bytes] of entries) {
    const destination = path.join(output, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes, { flag: "wx" });
  }
  const pins = {
    "gallery/sw.js": workerBlob,
    "scripts/gallery-pwa-build.mjs": builderBlob,
    "gallery/build-identity-classic.js": "f02073337fe70023af163862ff898de8ba3e19b1",
    "gallery/require-build-identity.js": "ae7a009377e276450c7c984d8fed7b2b771cbbe1"
  };
  for (const [name, expected] of Object.entries(pins)) {
    if (gitBlob(fs.readFileSync(path.join(output, name))) !== expected) throw new Error(`Original Gallery provenance mismatch: ${name}`);
  }
  fs.mkdirSync(path.join(output, "dist"));
  // Engine source is unchanged since the original release; reuse the local build.
  fs.copyFileSync("dist/printform.js", path.join(output, "dist/printform.js"));
  const script = path.join(output, "scripts/gallery-pwa-build.mjs");
  const { finalizeGalleryPwa } = await import(pathToFileURL(script).href);
  finalizeGalleryPwa(output, legacyRevision);
  if (sha256(fs.readFileSync(path.join(output, "gallery/sw.js"))) !== builtWorkerSha256) {
    throw new Error("Original Gallery built worker SHA-256 mismatch");
  }
  return { revision: legacyRevision, workerBlob, builderBlob, archiveSha256, builtWorkerSha256 };
}
