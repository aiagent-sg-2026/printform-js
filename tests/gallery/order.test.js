import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { newestFirst } from "../../gallery/js/order.js";

describe("catalogue newest-first convention", () => {
  it("preserves all 64 canonical entries and their source order", () => {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../gallery/manifest.json")));
    const original = JSON.stringify(manifest);
    const ordered = newestFirst(manifest);
    expect(ordered.map(({ no }) => no)).toEqual(Array.from({ length: 64 }, (_, index) => `PF-${String(64 - index).padStart(3, "0")}`));
    expect(JSON.stringify(manifest)).toBe(original);
    for (const design of ordered) expect(manifest).toContain(design);
  });
  it("orders PF numbers numerically, keeps ties/legacy stable and never mutates input", () => {
    const items = ["legacy-a", "PF-9", "PF-063", "PF-1000", "PF-063", "legacy-b"].map((no, index) => Object.freeze({ no, index }));
    Object.freeze(items);
    expect(newestFirst(items).map(({ index }) => index)).toEqual([3, 2, 4, 1, 0, 5]);
    expect(items.map(({ index }) => index)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
