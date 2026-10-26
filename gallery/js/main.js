import { loadManifest } from "./manifest-loader.js";
import { filterDesigns, uniqueValues } from "./filter.js";
import { createModal } from "./modal.js";
import { currentLanguage, pageCount, setLanguage, text, typeName } from "./i18n.js";

const manifest = await loadManifest();
const grid = document.querySelector("#gallery-grid");
const search = document.querySelector("#search");
const empty = document.querySelector("#empty-state");
const count = document.querySelector("#result-count");
const modal = createModal(document.querySelector("#design-modal"), manifest);
const filters = { type: "all", paper: "all", query: "" };

function buildChips(container, key, values, label) {
  const choices = ["all", ...values];
  container.replaceChildren(...choices.map((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.filterValue = value;
    button.textContent = value === "all" ? text("all") : label(value);
    button.classList.toggle("selected", filters[key] === value);
    button.setAttribute("aria-pressed", String(filters[key] === value));
    button.addEventListener("click", () => { filters[key] = value; render(); });
    return button;
  }));
}

function render() {
  buildChips(document.querySelector("#type-filters"), "type", uniqueValues(manifest, "type"), typeName);
  buildChips(document.querySelector("#paper-filters"), "paper", uniqueValues(manifest, "paper"), (value) => value);
  const designs = filterDesigns(manifest, filters);
  grid.replaceChildren(...designs.map((design) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "gallery-card";
    card.dataset.designId = design.id;
    const image = document.createElement("img");
    image.src = design.thumb;
    image.alt = design.title[currentLanguage()];
    image.width = design.width;
    image.height = design.height;
    image.loading = "lazy";
    const info = document.createElement("div");
    info.className = "card-info";
    const labels = document.createElement("div");
    const heading = document.createElement("h2");
    heading.textContent = design.title[currentLanguage()];
    const details = document.createElement("p");
    details.textContent = `${design.paper} · ${pageCount(design.pages)}`;
    labels.append(heading, details);
    const type = document.createElement("span");
    type.className = "type-tag";
    type.textContent = typeName(design.type);
    info.append(labels, type);
    card.append(image, info);
    card.addEventListener("click", () => modal.show(design, card));
    return card;
  }));
  empty.hidden = designs.length !== 0;
  const noun = designs.length === 1 ? text("resultOne") : text("resultMany");
  count.textContent = `${designs.length} ${noun}`;
}

search.addEventListener("input", () => { filters.query = search.value; render(); });
document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => { setLanguage(button.dataset.language); render(); });
});
setLanguage(localStorage.getItem("printform_lang") || "en");
render();
