import { describe, expect, it } from "vitest";
import { filterDesigns, uniqueValues } from "../../gallery/js/filter.js";

const designs = [
  { id: "invoice", title: { en: "Blue Invoice", zh: "蓝色发票" }, type: "Invoice", paper: "A4", tags: ["blue", "sales"] },
  { id: "po", title: { en: "Red Purchase Order", zh: "红色采购单" }, type: "Purchase Order", paper: "LETTER", tags: ["red", "supplier"] }
];

describe("gallery filtering", () => {
  it("combines type, paper and case-insensitive text filters", () => {
    expect(filterDesigns(designs, { type: "Invoice" }).map(({ id }) => id)).toEqual(["invoice"]);
    expect(filterDesigns(designs, { paper: "LETTER", query: "SUPPLIER" }).map(({ id }) => id)).toEqual(["po"]);
    expect(filterDesigns(designs, { type: "Invoice", paper: "LETTER" })).toEqual([]);
  });

  it("searches both localized titles and trims empty queries", () => {
    expect(filterDesigns(designs, { query: "蓝色" }).map(({ id }) => id)).toEqual(["invoice"]);
    expect(filterDesigns(designs, { query: "   " })).toHaveLength(2);
    expect(uniqueValues(designs, "paper")).toEqual(["A4", "LETTER"]);
  });
});
