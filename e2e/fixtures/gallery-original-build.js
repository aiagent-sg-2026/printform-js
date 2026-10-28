import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

// Frozen public original, NOT a new worker with a simulated legacy button.
export const legacyRevision = "53bd82bebad913553ad39d5e8c8ef63638db75f5";
const workerBlob = "b0c0b0b00d74b748503c042ac975d77a2228ec4a";

export async function buildOriginalGallery(output) {
  fs.mkdirSync(output, { recursive: true });
  // Fail clearly if a shallow checkout lacks the original public fixture commit.
  const archive = execFileSync("git", ["archive", legacyRevision, "gallery", "scripts/gallery-pwa-build.mjs"], { maxBuffer: 20 * 1024 * 1024 });
  execFileSync("tar", ["-x", "-C", output], { input: archive });
  const originalWorker = fs.readFileSync(path.join(output, "gallery/sw.js"));
  const blob = createHash("sha1").update(`blob ${originalWorker.length}\0`).update(originalWorker).digest("hex");
  if (blob !== workerBlob) throw new Error("Original Gallery worker provenance mismatch");
  fs.mkdirSync(path.join(output, "dist"));
  // Engine source is unchanged since the original release; reuse the local build.
  fs.copyFileSync("dist/printform.js", path.join(output, "dist/printform.js"));
  const script = path.join(output, "scripts/gallery-pwa-build.mjs");
  const { finalizeGalleryPwa } = await import(pathToFileURL(script).href);
  finalizeGalleryPwa(output, legacyRevision);
  return {
    revision: legacyRevision, workerBlob: blob,
    builderBlob: execFileSync("git", ["rev-parse", `${legacyRevision}:scripts/gallery-pwa-build.mjs`], { encoding: "utf8" }).trim(),
    builtWorkerSha256: createHash("sha256").update(fs.readFileSync(path.join(output, "gallery/sw.js"))).digest("hex")
  };
}
