import { describe, it, expect } from "vitest";
import { createScenario } from "../../studio-v2/core/sample-scenarios.js";

describe("createScenario array targeting", () => {
  it("regenerates data.items even when another array appears first in key order", () => {
    // Regression: findArray() walked object keys depth-first and used
    // whichever array it hit first. A project shaped like this — an array
    // of address lines before the items array — used to have addressLines
    // replaced by 500 generated rows while items (and totals) were left
    // untouched, producing spurious SUBTOTAL_MISMATCH errors with no
    // explanation. data.items must always win when present.
    const sampleData = {
      customer: { addressLines: ["Line 1", "Line 2", "Line 3"] },
      items: [{ no: 1, description: "Widget", qty: 1, unitPrice: 10, lineTotal: 10 }],
      totals: { subtotal: 10, tax: 0.6, grandTotal: 10.6 }
    };

    const result = createScenario(sampleData, "45-rows");

    expect(result.items).toHaveLength(45);
    expect(result.customer.addressLines).toEqual(["Line 1", "Line 2", "Line 3"]);
  });

  it("falls back to the first discoverable array when there is no top-level items", () => {
    const sampleData = { rows: [{ no: 1, description: "A" }] };
    const result = createScenario(sampleData, "one");
    expect(result.rows).toHaveLength(1);
  });

  it("returns the data unchanged when no array exists anywhere", () => {
    const sampleData = { title: "No rows here" };
    expect(createScenario(sampleData, "45-rows")).toEqual(sampleData);
  });

  it("recomputes totals proportionally to the previous tax rate after regenerating rows", () => {
    const sampleData = {
      items: [{ no: 1, description: "A", qty: 1, unitPrice: 100, lineTotal: 100 }],
      totals: { subtotal: 100, tax: 6, grandTotal: 106 }
    };
    const result = createScenario(sampleData, "one");
    expect(result.totals.subtotal).toBeCloseTo(100);
    expect(result.totals.tax).toBeCloseTo(6);
  });
  it('preserves supplied ERP totals when only descriptive text changes', () => {
    const data = {items:[{description:'Claim stage',amountCertified:999}],totals:{subtotal:999,tax:17,grandTotal:1016}};
    const long = createScenario(data,'long-text');
    expect(long.totals).toEqual(data.totals);
    expect(long.items[0].amountCertified).toBe(999);
    expect(long.items[0].description).not.toBe(data.items[0].description);
    expect(data.items[0].description).toBe('Claim stage');
  });
});
