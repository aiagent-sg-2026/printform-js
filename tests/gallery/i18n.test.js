import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { translations } from "../../gallery/js/i18n.js";

const root = path.resolve(import.meta.dirname, "../..");
const html = fs.readFileSync(path.join(root, "gallery/index.html"), "utf8");
const document = new JSDOM(html).window.document;

describe("gallery translations", () => {
  it("provides matching English and Chinese text for every UI key", () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.zh).sort());
    const keys = [
      ...[...document.querySelectorAll("[data-i18n]")].map((element) => element.dataset.i18n),
      ...[...document.querySelectorAll("[data-i18n-placeholder]")].map((element) => element.dataset.i18nPlaceholder)
    ];
    for (const key of new Set(keys)) {
      expect(translations.en[key], `${key} English`).toBeTruthy();
      expect(translations.zh[key], `${key} Chinese`).toBeTruthy();
    }
  });
});
