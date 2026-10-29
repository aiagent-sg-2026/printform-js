import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "gallery/manifest.json"), "utf8"));
const validPapers = new Set(["A4", "A5", "LETTER", "LEGAL"]);

describe("gallery manifest", () => {
  it("has complete entries with unique ids and supported paper sizes", () => {
    expect(manifest).toHaveLength(66);
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

  it("preserves the original 64 manifest entries byte-equivalently after JSON normalization", () => {
    expect(createHash('sha256').update(JSON.stringify(manifest.slice(0, 64))).digest('hex'))
      .toBe('9920ac2201223ee367e9bc9967b8e4466dbde251c091ee40c19045af0cd7eee3');
  });

  it("preserves all 65 accepted pre-Atlas records", () => {
    expect(createHash('sha256').update(JSON.stringify(manifest.slice(0, 65))).digest('hex'))
      .toBe('f5cef9b2247bac5aff220beb903d20d64013fb2f9d4057a10a4157ee7b9b6d3b');
  });

  it("registers Atlas independently as PF-066", () => {
    expect(manifest.find(({ no }) => no === "PF-066")).toMatchObject({
      id: "atlas-landed-cost-dossier", pages: 10, type: "Landed Cost Dossier", paper: "A4", width: 1123, height: 794,
      tags: expect.arrayContaining(["inventory-logistics", "allocation", "integer-cents", "offline", "landscape"])
    });
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

  it("registers the editable Meridian purchase order as PF-064", () => {
    expect(manifest.find(({ no }) => no === "PF-064")).toMatchObject({
      id: "meridian-enterprise-purchase-order", pages: 2, paper: "A4", type: "Purchase Order",
      tags: expect.arrayContaining(["purchasing", "editable", "offline", "barcode"])
    });
  });

  it("registers Aster independently as the landscape PF-065 review pack", () => {
    expect(manifest.find(({ no }) => no === "PF-065")).toMatchObject({
      id: "aster-three-way-match-review-pack", pages: 8, type: "Procurement Review", paper: "A4", width: 1123, height: 794,
      tags: expect.arrayContaining(["purchasing", "reconciliation", "editable", "offline", "landscape"])
    });
  });

  it("references existing design and thumbnail files", () => {
    for (const item of manifest) {
      expect(fs.existsSync(path.join(root, "gallery", item.file))).toBe(true);
      expect(fs.existsSync(path.join(root, "gallery", item.thumb))).toBe(true);
    }
  });
});
