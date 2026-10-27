import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { requireBuildIdentity } from "../../gallery/require-build-identity.js";
import { smartScrollDecision } from "../../gallery/js/smart-scroll.js";
import { buildGalleryPrecache } from "../../scripts/gallery-pwa-build.mjs";
const root = path.resolve(import.meta.dirname, "../..");

describe("gallery PWA", () => {
  it("requires matching successful build identity", async () => {
    const response = (body, ok = true) => Promise.resolve({ ok, json: async () => body });
    await expect(requireBuildIdentity("a", response({ build: "a" }))).resolves.toEqual({ build: "a" });
    await expect(requireBuildIdentity("a", response({}, false))).rejects.toThrow();
    await expect(requireBuildIdentity("a", Promise.resolve({ ok: true, json: async () => { throw Error(); } }))).rejects.toThrow();
    await expect(requireBuildIdentity("a", response({}))).rejects.toThrow();
    await expect(requireBuildIdentity("a", response({ build: "b" }))).rejects.toThrow();
    await expect(requireBuildIdentity("a", Promise.reject(Error("offline")))).rejects.toThrow("offline");
  });
  it("applies scroll thresholds, top visibility and forced visibility", () => {
    expect(smartScrollDecision({ previousY: 100, currentY: 110 }).visible).toBe(false);
    expect(smartScrollDecision({ previousY: 110, currentY: 100 }).visible).toBe(true);
    expect(smartScrollDecision({ previousY: 100, currentY: 105 }).visible).toBeNull();
    expect(smartScrollDecision({ previousY: 100, currentY: 20 }).visible).toBe(true);
    expect(smartScrollDecision({ previousY: 100, currentY: 110, forced: true }).visible).toBe(true);
  });
  it("precache includes all designs, shared/assets/runtime and excludes thumbnails", () => {
    const data = JSON.parse(fs.readFileSync(path.join(root, "gallery/manifest.json"), "utf8"));
    // dist/ is a build output and absent on a clean checkout, so check against a stub site root.
    const site = fs.mkdtempSync(path.join(os.tmpdir(), "pf-gallery-site-"));
    fs.mkdirSync(path.join(site, "dist"));
    fs.writeFileSync(path.join(site, "dist/printform.js"), "");
    fs.symlinkSync(path.join(root, "gallery"), path.join(site, "gallery"));
    const files = buildGalleryPrecache(path.join(root, "gallery"), site);
    fs.rmSync(site, { recursive: true, force: true });
    for (const item of data) expect(files).toContain(item.file);
    expect(files).toContain("../dist/printform.js");
    expect(files.some((file) => file.startsWith("designs/shared/"))).toBe(true);
    expect(files.some((file) => file.startsWith("designs/assets/"))).toBe(true);
    expect(files.some((file) => file.startsWith("thumbs/"))).toBe(false);
  });
  it("ships correct PWA manifest fields and icon sizes", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "gallery/manifest.webmanifest"), "utf8"));
    expect(manifest).toMatchObject({ scope: "./", start_url: "./index.html" });
    for (const icon of manifest.icons) expect(fs.existsSync(path.join(root, "gallery", icon.src.slice(2)))).toBe(true);
    const png = (name) => { const buffer = fs.readFileSync(path.join(root, "gallery/icons", name)); return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]; };
    expect(png("icon-192.png")).toEqual([192, 192]); expect(png("icon-512.png")).toEqual([512, 512]);
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });
});
