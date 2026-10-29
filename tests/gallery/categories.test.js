import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import { categories, categoryOf } from "../../gallery/js/categories.js";
import { filterDesigns } from "../../gallery/js/filter.js";
import { normalizeFilters, readFilters, filterURL } from "../../gallery/js/filter-state.js";
import { loadManifest } from "../../gallery/js/manifest-loader.js";
const manifest = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../gallery/manifest.json")));
afterEach(() => vi.unstubAllGlobals());

describe("business categories", () => {
  it("assigns every catalogue PF number exactly once with approved group counts", () => {
    const numbers = categories.flatMap(({ numbers }) => numbers);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.length).toBe(manifest.length);
    expect(manifest.every((design) => categoryOf(design))).toBe(true);
    expect(categories.map(({ id }) => filterDesigns(manifest, { category: id }).length)).toEqual([18, 8, 11, 12, 8, 5, 4, 1]);
    expect(categoryOf(manifest.find(({ no }) => no === "PF-066"))).toBe("inventory-logistics");
    expect(categoryOf(manifest.find(({ no }) => no === "PF-067"))).toBe("education");
    expect(categoryOf(manifest.find(({ no }) => no === "PF-010"))).toBe("hr-administration");
  });
  it("combines category, exact type, paper and both-language search", () => {
    const item = manifest.find(({ no }) => no === "PF-004");
    for (const query of [item.no.toLowerCase(), item.title.en, item.title.zh]) {
      expect(filterDesigns(manifest, { category: "sales", type: item.type, paper: item.paper, query })).toContainEqual(item);
    }
    expect(filterDesigns(manifest, { category: "purchasing", query: "PF-004" })).toEqual([]);
    expect(filterDesigns(manifest, { category: "finance", query: "not-a-design" })).toEqual([]);
  });
  it("resets incompatible types and validates URL values without interpreting markup", () => {
    expect(normalizeFilters(manifest, { category: "purchasing", type: "Quotation", paper: "A4" })).toMatchObject({ category: "purchasing", type: "all", paper: "A4" });
    expect(readFilters(manifest, "?category=invalid&type=nope&paper=invalid&q=%3Cscript%3E")).toEqual({ category: "all", type: "all", paper: "all", query: "<script>" });
    const state = { category: "sales", type: "Quotation", paper: "A4", query: "a & 中文" };
    const url = filterURL("https://example.test/gallery/?keep=1#section", state);
    expect(readFilters(manifest, url.search)).toEqual(state);
    expect(filterURL(url, { ...state, query: "all" }).searchParams.get("q")).toBe("all");
    const clear = filterURL(url, normalizeFilters(manifest));
    expect(clear.search).toBe("?keep=1");
    expect(clear.hash).toBe("#section");
  });
  it("rejects failed, malformed and unsafe manifests and permits a later retry", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(loadManifest()).rejects.toThrow("503");
    for (const entries of [{}, [null], [{ ...manifest[0], file: "https://example.test/bad.html" }]]) {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => entries });
      await expect(loadManifest()).rejects.toThrow("invalid entries");
    }
    fetch.mockResolvedValueOnce({ ok: true, json: async () => manifest });
    await expect(loadManifest()).resolves.toEqual(manifest);
    expect(fetch.mock.calls.at(-1)[1].signal).toBeDefined();
  });
});
