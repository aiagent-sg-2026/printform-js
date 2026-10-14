import { cloneJson, resolvePointer } from "./json.js";
import { listBoundTableRepeats } from "./row-limits.js";

// Layout stress is not an ERP calculation. Only the declared collection and
// descriptive row identity change; supplied monetary values and summaries do not.
export function createScenario(sampleData, scenario, collection = "/items") {
  const data = cloneJson(sampleData);
  if (scenario === "default") return data;
  const items = resolvePointer(data, collection);
  if (!Array.isArray(items)) return data;
  if (scenario === "empty") items.splice(0);
  if (["one", "45-rows", "100-rows", "500-rows"].includes(scenario)) {
    const count = scenario === "one" ? 1 : Number.parseInt(scenario, 10);
    const seeds = items.map(cloneJson);
    // An empty fixture has no authoritative row shape; do not invent fields.
    if (!seeds.length) return data;
    items.splice(0, items.length, ...Array.from({ length: count }, (_, index) => {
      const row = cloneJson(seeds[index % seeds.length]);
      if (!row || typeof row !== "object" || Array.isArray(row)) return row;
      if (typeof row.no === "string") row.no = String(index + 1);
      else if (typeof row.no === "number") row.no = index + 1;
      return row;
    }));
  }
  if (scenario === "long-text") {
    items.forEach((item, index) => {
      if (item && typeof item.description === "string") item.description = `Row ${index + 1}: ${"Long multilingual description 长文本 penerangan panjang ".repeat(8)}`;
    });
  }
  return data;
}

export function createProjectScenario(project, scenario, sampleData = project.sampleData) {
  if (scenario === "default") return cloneJson(sampleData);
  const declared = project.manifest?.sampleScenarios?.collection;
  const repeats = listBoundTableRepeats(project.templateHtml);
  const collections = [...new Set(repeats.filter(row => !row.ancestors.length).map(row => row.pointer))];
  if (!declared && collections.length > 1) throw Object.assign(new Error("Declare manifest.sampleScenarios.collection for multi-collection stress"), {code:"SCENARIO_COLLECTION_REQUIRED"});
  return createScenario(sampleData, scenario, declared || collections[0] || "/items");
}

export const SAMPLE_SCENARIOS = Object.freeze(["default", "empty", "one", "45-rows", "100-rows", "500-rows", "long-text"]);
