import { categories } from "./categories.js";
import { filterDesigns, uniqueValues } from "./filter.js";
import { currentLanguage, text, typeName } from "./i18n.js";

export function createFilters(manifest, onChange) {
  const container = document.querySelector("#category-filters");
  const type = document.querySelector("#type-filter");
  const paper = document.querySelector("#paper-filter");
  const clear = document.querySelector("#clear-filters");
  const choices = [{ id: "all" }, ...categories];
  const buttons = choices.map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.filterValue = category.id;
    button.addEventListener("click", () => onChange({ category: category.id }));
    container.append(button);
    return button;
  });
  type.addEventListener("change", () => onChange({ type: type.value }));
  paper.addEventListener("change", () => onChange({ paper: paper.value }));
  clear.addEventListener("click", () => onChange({ category: "all", type: "all", paper: "all", query: "" }));
  let optionsKey;
  const fill = (select, values, label) => select.replaceChildren(...["all", ...values].map((value) => new Option(value === "all" ? text("all") : label(value), value)));
  return (filters) => {
    const language = currentLanguage();
    const label = (id) => id === "all" ? text("all") : categories.find((category) => category.id === id)[language];
    buttons.forEach((button, index) => {
      const id = choices[index].id;
      button.textContent = `${label(id)} (${filterDesigns(manifest, { category: id }).length})`;
      button.classList.toggle("selected", filters.category === id);
      button.setAttribute("aria-pressed", String(filters.category === id));
    });
    const nextKey = `${filters.category}:${language}`;
    if (optionsKey !== nextKey) {
      fill(type, uniqueValues(filterDesigns(manifest, { category: filters.category }), "type"), typeName);
      fill(paper, uniqueValues(manifest, "paper"), (value) => value);
      optionsKey = nextKey;
    }
    type.value = filters.type;
    paper.value = filters.paper;
    const active = [
      filters.category !== "all" && label(filters.category),
      filters.type !== "all" && typeName(filters.type),
      filters.paper !== "all" && filters.paper,
      filters.query && `“${filters.query}”`
    ].filter(Boolean);
    document.querySelector("#active-filters").textContent = `${text("activeFilters")}: ${active.join(" · ") || text("all")}`;
    clear.disabled = active.length === 0;
    document.querySelector("#category-label").textContent = text("categoryLabel");
  };
}
