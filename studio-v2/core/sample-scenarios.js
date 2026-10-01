import { cloneJson } from "./json.js";
import { calculateFinancialTotals } from "./business-rules.js";

function findArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;
  for (const child of Object.values(value)) {
    const found = findArray(child);
    if (found) return found;
  }
  return null;
}

export function createScenario(sampleData, scenario) {
  const data = cloneJson(sampleData);
  if (scenario === "default") return data;
  // Totals math is keyed to data.items — prefer it explicitly so a project
  // whose first depth-first array is something else (e.g. address lines)
  // doesn't get that array replaced by generated rows.
  const items = Array.isArray(data.items) ? data.items : findArray(data);
  if (!items) return data;
  const previousSubtotal = Number(data.totals?.subtotal) || 0;
  const taxRate = previousSubtotal ? (Number(data.totals?.tax) || 0) / previousSubtotal : 0;
  if (scenario === "empty") items.splice(0);
  if (["one", "45-rows", "100-rows", "500-rows"].includes(scenario)) {
    const count = scenario === "one" ? 1 : Number.parseInt(scenario, 10);
    const seed = items[0] || {};
    items.splice(0, items.length, ...Array.from({ length: count }, (_, index) => ({ ...cloneJson(seed), no: index + 1, description: seed.description ? `${seed.description} ${index + 1}` : `Generated row ${index + 1}` })));
  }
  if (scenario === "long-text") {
    items.forEach((item, index) => { item.description = `Row ${index + 1}: ${"Long multilingual description 长文本 penerangan panjang ".repeat(8)}`; });
  }
  // Text-only stress must preserve the supplied ERP totals, including forms
  // whose financial fields differ from the standard invoice fixture.
  if (data.totals && scenario !== 'long-text') {
    const subtotal = calculateFinancialTotals(data).subtotal;
    data.totals.subtotal = subtotal;
    if (typeof data.totals.tax === "number") data.totals.tax = Math.round(subtotal * taxRate * 100) / 100;
    data.totals.grandTotal = calculateFinancialTotals(data).grandTotal;
  }
  return data;
}

export const SAMPLE_SCENARIOS = Object.freeze(["default", "empty", "one", "45-rows", "100-rows", "500-rows", "long-text"]);
