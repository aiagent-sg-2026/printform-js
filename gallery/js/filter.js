export function filterDesigns(designs, { type = "all", paper = "all", query = "" } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  return designs.filter((design) => {
    if (type !== "all" && design.type !== type) return false;
    if (paper !== "all" && design.paper !== paper) return false;
    if (!needle) return true;
    const searchable = [design.no, design.id, design.title.en, design.title.zh, design.style?.en, design.style?.zh, design.type, design.paper, ...design.tags].join(" ").toLocaleLowerCase();
    return searchable.includes(needle);
  });
}

export function uniqueValues(designs, key) {
  return [...new Set(designs.map((design) => design[key]))].sort();
}
