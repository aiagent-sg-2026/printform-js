const RULES = [
  ["pheader", "DocumentHeader", "document-header"],
  ["pdocinfo pdocinfo002", "DocumentMeta", "document-meta"],
  ["pinfo project-info", "ProjectInfo", "project-info"],
  ["psummary summary-panel", "SummaryPanel", "summary"],
  ["prowheader", "DataTable", "table-header"],
  ["prowitem ptac-rowitem paddt-rowitem", "DataTable", "table-row"],
  ["pvariation variation-table", "VariationTable", "variation"],
  ["pmoneysummary money-summary", "MoneySummary", "money-summary"],
  ["pfsign signature-block", "SignatureBlock", "signature"],
  ["pjourney journey-block", "JourneyBlock", "journey"],
  ["pdisclaimer disclaimer", "Disclaimer", "disclaimer"],
  ["pfooter pfooter_logo pfooter_pagenum", "PageFooter", "footer"],
];

function attribute(attrs, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(attrs).match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? match[1] : "";
}

function slug(value) {
  return String(value || "default").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default";
}

function componentId(attrs, type, role, tableId, ordinal) {
  const declared = attribute(attrs, "data-pf-component-id");
  if (declared) return declared;
  if (role === "table-header") return `table-${slug(tableId)}-header${ordinal > 1 ? `-${ordinal}` : ""}`;
  if (role === "table-row") return `table-${slug(tableId)}-rows${ordinal > 1 ? `-${ordinal}` : ""}`;
  const base = type.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, "");
  return `${base}-${ordinal}`;
}

function binding(attrs) {
  const result = {};
  for (const name of ["text", "barcode", "each", "if", "href", "i18n"]) {
    const value = attribute(attrs, `data-pf-${name}`);
    if (value) result[name] = value;
  }
  return Object.keys(result).length ? result : null;
}

function repeatHeaderOverride(attrs, role) {
  if (role !== "table-header" || !/data-pf-repeat-rowheader\s*=\s*["']/i.test(attrs)) return undefined;
  return !["false", "n", "no", "0"].includes(attribute(attrs, "data-pf-repeat-rowheader").trim().toLowerCase());
}

function repeatFlagOn(value) {
  return !["false", "n", "no", "0"].includes(String(value ?? "").trim().toLowerCase());
}

function matches(classes, rule) {
  const tokens = new Set(String(classes).split(/\s+/).filter(Boolean));
  return rule.split(" ").find((token) => tokens.has(token)) || "";
}

/**
 * Minimal no-DOM adapter used by Node build/validation. It intentionally
 * extracts only the semantic class/data attributes that the browser adapter
 * extracts; it never tries to execute or normalize HTML.
 */
export function inspectLegacyMarkup(markup) {
  const components = [];
  const ordinals = new Map();
  const elements = String(markup || "").matchAll(/<([A-Za-z][\w:-]*)\b([^>]*?)>/g);
  let paper = "A4";
  let orientation = "portrait";
  let rootAttributes = "";
  for (const match of elements) {
    const [, , attrs] = match;
    const classes = attribute(attrs, "class");
    if (classes.split(/\s+/).includes("printform")) {
      rootAttributes = attrs;
      paper = attribute(attrs, "data-papersize") || paper;
      orientation = attribute(attrs, "data-orientation") || orientation;
    }
    for (const [rule, type, role] of RULES) {
      const classToken = matches(classes, rule);
      if (!classToken) continue;
      const tableId = role.startsWith("table-") ? (attribute(attrs, "data-pf-table-id") || attribute(attrs, "data-pf-table") || "default") : null;
      const key = `${type}:${role}:${tableId || ""}`;
      const ordinal = (ordinals.get(key) || 0) + 1;
      ordinals.set(key, ordinal);
      const component = {
        id: componentId(attrs, type, role, tableId, ordinal),
        type,
        role,
        tableId,
        sourceSelector: `.${classToken}:nth-of-type(${ordinal})`,
        binding: binding(attrs),
        keepTogether: attribute(attrs, "data-pf-keep-together") === "true",
        styleToken: attribute(attrs, "data-pf-style-token") || null,
      };
      const repeatHeader = repeatHeaderOverride(attrs, role);
      if (repeatHeader !== undefined) component.repeatHeader = repeatHeader;
      components.push(component);
      break;
    }
  }
  return {
    components,
    paper,
    orientation,
    repeatTableHeader: repeatFlagOn(attribute(rootAttributes, "data-repeat-rowheader")),
    repeatDocumentHeader: repeatFlagOn(attribute(rootAttributes, "data-repeat-header")),
  };
}
