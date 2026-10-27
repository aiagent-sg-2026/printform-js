import { categories } from "./categories.js";
import { filterDesigns, uniqueValues } from "./filter.js";

export function normalizeFilters(designs, state = {}) {
  const category = categories.some(({ id }) => id === state.category) ? state.category : "all";
  const types = uniqueValues(filterDesigns(designs, { category }), "type");
  return {
    category,
    type: types.includes(state.type) ? state.type : "all",
    paper: uniqueValues(designs, "paper").includes(state.paper) ? state.paper : "all",
    query: typeof state.query === "string" ? state.query : ""
  };
}
export function readFilters(designs, search) {
  const params = new URLSearchParams(search);
  return normalizeFilters(designs, { category: params.get("category"), type: params.get("type"), paper: params.get("paper"), query: params.get("q") });
}
export function filterURL(href, filters) {
  const url = new URL(href);
  for (const [key, value] of Object.entries(filters)) {
    const name = key === "query" ? "q" : key;
    if (value && (key === "query" || value !== "all")) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
  }
  return url;
}
