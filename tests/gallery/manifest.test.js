import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "gallery/manifest.json"), "utf8"));
const validPapers = new Set(["A4", "A5", "LETTER", "LEGAL"]);

describe("gallery manifest", () => {
  it("has complete entries with unique ids and supported paper sizes", () => {
    expect(manifest.length).toBeGreaterThan(0);
    expect(new Set(manifest.map(({ id }) => id)).size).toBe(manifest.length);
    for (const item of manifest) {
      expect(item).toEqual(expect.objectContaining({ id: expect.any(String), title: { en: expect.any(String), zh: expect.any(String) }, type: expect.any(String), paper: expect.any(String), pages: expect.any(Number), tags: expect.any(Array), file: expect.any(String), thumb: expect.any(String), width: expect.any(Number), height: expect.any(Number) }));
      expect(item.pages).toBeGreaterThan(0);
      expect(item.tags.length).toBeGreaterThan(0);
      expect(validPapers.has(item.paper)).toBe(true);
      expect(item.file).toMatch(/^designs\/[\w-]+\.html$/);
      expect(item.thumb).toMatch(/^thumbs\/[\w-]+\.png$/);
    }
    expect(manifest.filter((item) => item.pages >= 2).length).toBeGreaterThanOrEqual(2);
  });

  it("references existing design and thumbnail files", () => {
    for (const item of manifest) {
      expect(fs.existsSync(path.join(root, "gallery", item.file))).toBe(true);
      expect(fs.existsSync(path.join(root, "gallery", item.thumb))).toBe(true);
    }
  });
});
