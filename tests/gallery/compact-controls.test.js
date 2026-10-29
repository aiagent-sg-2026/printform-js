import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFilters } from "../../gallery/js/filter-controls.js";
const html = fs.readFileSync(path.resolve(import.meta.dirname, "../../gallery/index.html"), "utf8");

describe("compact Gallery filters", () => {
  it("keeps essential controls outside a default-collapsed, labelled panel", () => {
    document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)[1];
    const toggle = document.querySelector("#advanced-toggle");
    expect(toggle).not.toBeNull();
    const panel = document.getElementById(toggle.getAttribute("aria-controls"));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);
    for (const id of ["search", "result-count", "active-filters", "clear-filters"]) expect(panel.contains(document.getElementById(id))).toBe(false);
    expect(toggle.disabled).toBe(true);
    const changes = [];
    createFilters([], value => changes.push(value));
    expect(toggle.disabled).toBe(false);
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hidden).toBe(false);
    const select = panel.querySelector("select");
    select.disabled = false;
    select.focus();
    toggle.click();
    expect(document.activeElement).toBe(toggle);
    expect(panel.hidden).toBe(true);
    expect(changes).toEqual([]);
  });
});
