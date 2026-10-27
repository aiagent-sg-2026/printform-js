import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "gallery/manifest.json"), "utf8"));
const validPapers = new Set(["A4", "A5", "LETTER", "LEGAL"]);

describe("gallery manifest", () => {
  it("has complete entries with unique ids and supported paper sizes", () => {
    expect(manifest).toHaveLength(54);
    expect(new Set(manifest.map(({ id }) => id)).size).toBe(manifest.length);
    for (const item of manifest) {
      expect(item).toEqual(expect.objectContaining({ id: expect.any(String), no: expect.stringMatching(/^PF-\d{3}$/), style: { en: expect.any(String), zh: expect.any(String) }, title: { en: expect.any(String), zh: expect.any(String) }, type: expect.any(String), paper: expect.any(String), pages: expect.any(Number), tags: expect.any(Array), file: expect.any(String), thumb: expect.any(String), width: expect.any(Number), height: expect.any(Number) }));
      expect(item.pages).toBeGreaterThan(0);
      expect(item.tags.length).toBeGreaterThan(0);
      expect(validPapers.has(item.paper)).toBe(true);
      expect(item.file).toMatch(/^designs\/[\w-]+\.html$/);
      expect(item.thumb).toMatch(/^thumbs\/[\w-]+\.png$/);
    }
    expect(manifest.filter((item) => item.pages >= 2).length).toBeGreaterThanOrEqual(2);
  });

  it("has unique PF numbers", () => {
    expect(new Set(manifest.map(({ no }) => no)).size).toBe(manifest.length);
  });

  it("keeps the green sample and the five-page navy variant as separate entries", () => {
    expect(manifest.find(({ no }) => no === "PF-053")).toMatchObject({
      id: "sanyo-green-sales-quotation", pages: 1, style: { en: "Green", zh: "绿色" }
    });
    expect(manifest.find(({ no }) => no === "PF-054")).toMatchObject({
      id: "sanyo-blue-sales-quotation", pages: 5, paper: "A4", type: "Quotation",
      file: "designs/sanyo-blue-sales-quotation.html", tags: expect.arrayContaining(["sample", "navy", "five-pages"])
    });
  });

  it("references existing design and thumbnail files", () => {
    for (const item of manifest) {
      expect(fs.existsSync(path.join(root, "gallery", item.file))).toBe(true);
      expect(fs.existsSync(path.join(root, "gallery", item.thumb))).toBe(true);
    }
  });
});
