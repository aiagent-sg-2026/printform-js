import { cloneJson } from "./json.js";
import { inspectLegacyMarkup } from "./form-spec-markup.js";

export const FORM_SPEC_VERSION = "1.0.0";

export const COMPONENT_TYPES = Object.freeze([
  "DocumentHeader",
  "DocumentMeta",
  "ProjectInfo",
  "SummaryPanel",
  "DataTable",
  "VariationTable",
  "MoneySummary",
  "SignatureBlock",
  "JourneyBlock",
  "Disclaimer",
  "PageFooter",
]);

const DEFAULT_TABLE_ID = "default";

function slug(value) {
  return String(value || DEFAULT_TABLE_ID)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || DEFAULT_TABLE_ID;
}

function tableIdFor(node) {
  return (
    node?.getAttribute?.("data-pf-table-id") ||
    node?.getAttribute?.("data-pf-table") ||
    DEFAULT_TABLE_ID
  );
}

function bindingFor(node) {
  if (!node?.getAttribute) return null;
  const binding = {};
  for (const name of ["text", "barcode", "each", "if", "href", "i18n"]) {
    const value = node.getAttribute(`data-pf-${name}`);
    if (value) binding[name] = value;
  }
  return Object.keys(binding).length ? binding : null;
}

function repeatHeaderOverride(node, role) {
  if (role !== "table-header" || !node?.hasAttribute?.("data-pf-repeat-rowheader")) return undefined;
  return !["false", "n", "no", "0"].includes(String(node.getAttribute("data-pf-repeat-rowheader")).trim().toLowerCase());
}

function sourceSelector(node, root) {
  if (!node || !root) return null;
  const parts = [];
  let current = node;
  while (current && current !== root) {
    const tag = String(current.tagName || "div").toLowerCase();
    const siblings = Array.from(current.parentElement?.children || []).filter(
      (item) => String(item.tagName || "").toLowerCase() === tag,
    );
    const index = Math.max(0, siblings.indexOf(current));
    parts.unshift(`${tag}:nth-of-type(${index + 1})`);
    current = current.parentElement;
  }
  return parts.length ? `.${root.classList?.[0] || "printform"} > ${parts.join(" > ")}` : null;
}

function componentId(node, type, role, ordinal) {
  const declared = node?.getAttribute?.("data-pf-component-id");
  if (declared) return declared;
  const table = tableIdFor(node);
  if (role === "table-header") return `table-${slug(table)}-header${ordinal > 1 ? `-${ordinal}` : ""}`;
  if (role === "table-row") return `table-${slug(table)}-rows${ordinal > 1 ? `-${ordinal}` : ""}`;
  const base = type.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, "");
  return `${base}-${ordinal}`;
}

function addComponent(components, node, root, type, role, ordinal) {
  if (!node) return;
  const tableId = role?.startsWith("table-") ? tableIdFor(node) : null;
  const component = {
    id: componentId(node, type, role, ordinal),
    type,
    role: role || null,
    tableId,
    sourceSelector: sourceSelector(node, root),
    binding: bindingFor(node),
    keepTogether: node.getAttribute?.("data-pf-keep-together") === "true",
    styleToken: node.getAttribute?.("data-pf-style-token") || null,
  };
  const repeatHeader = repeatHeaderOverride(node, role);
  if (repeatHeader !== undefined) component.repeatHeader = repeatHeader;
  components.push(component);
}

function addAll(components, root, selector, type, role) {
  Array.from(root.querySelectorAll(selector)).forEach((node, index) =>
    addComponent(components, node, root, type, role, index + 1),
  );
}

function repeatFlagOn(value) {
  return !["false", "n", "no", "0"].includes(String(value ?? "").trim().toLowerCase());
}

export function createEmptyFormSpec(documentType = "printform") {
  return {
    version: FORM_SPEC_VERSION,
    mode: "canonical",
    document: {
      type: documentType,
      paper: "A4",
      orientation: "portrait",
      margins: {},
    },
    tokens: {},
    sections: [],
    components: [],
    bindings: {},
    pagination: {
      repeatDocumentHeader: true,
      repeatTableHeader: true,
      footer: true,
      pageNumbers: true,
      keepTogether: [],
    },
  };
}

/**
 * Builds a stable semantic view over a legacy template. The template remains
 * executable for compatibility, while new agent operations can address this
 * registry instead of receiving arbitrary DOM selectors.
 */
export function createLegacyFormSpec(project) {
  const root = typeof document === "undefined" ? null : document.createElement("div");
  if (!root) {
    const inspected = inspectLegacyMarkup(project?.templateHtml || "");
    const legacy = createEmptyFormSpec(project?.manifest?.documentType || "printform");
    return {
      ...legacy,
      mode: "legacy-adapter",
      document: { ...legacy.document, paper: inspected.paper, orientation: inspected.orientation },
      sections: inspected.components.map((component) => ({ id: component.id, componentIds: [component.id] })),
      components: inspected.components,
      pagination: {
        ...legacy.pagination,
        repeatTableHeader: inspected.repeatTableHeader,
        repeatDocumentHeader: inspected.repeatDocumentHeader,
      },
    };
  }
  root.innerHTML = String(project?.templateHtml || "");
  const form = root.querySelector(".printform") || root;
  const components = [];
  addAll(components, form, ".pheader", "DocumentHeader", "document-header");
  addAll(components, form, ".pdocinfo, .pdocinfo002", "DocumentMeta", "document-meta");
  addAll(components, form, ".pinfo, .project-info", "ProjectInfo", "project-info");
  addAll(components, form, ".psummary, .summary-panel", "SummaryPanel", "summary");
  addAll(components, form, ".prowheader", "DataTable", "table-header");
  addAll(components, form, ".prowitem, .ptac-rowitem, .paddt-rowitem", "DataTable", "table-row");
  addAll(components, form, ".pvariation, .variation-table", "VariationTable", "variation");
  addAll(components, form, ".pmoneysummary, .money-summary", "MoneySummary", "money-summary");
  addAll(components, form, ".pfsign, .signature-block, [data-pf-component-type='signature']", "SignatureBlock", "signature");
  addAll(components, form, ".pjourney, .journey-block", "JourneyBlock", "journey");
  addAll(components, form, ".pdisclaimer, .disclaimer", "Disclaimer", "disclaimer");
  addAll(components, form, ".pfooter, .pfooter_logo, .pfooter_pagenum", "PageFooter", "footer");

  const paper = form.getAttribute("data-papersize") || "A4";
  const orientation = form.getAttribute("data-orientation") || "portrait";
  const legacy = createEmptyFormSpec(project?.manifest?.documentType || "printform");
  return {
    ...legacy,
    mode: "legacy-adapter",
    document: { ...legacy.document, paper, orientation },
    sections: components.map((component) => ({ id: component.id, componentIds: [component.id] })),
    components,
    pagination: {
      ...legacy.pagination,
      repeatTableHeader: repeatFlagOn(form.getAttribute("data-repeat-rowheader")),
      repeatDocumentHeader: repeatFlagOn(form.getAttribute("data-repeat-header")),
    },
  };
}

export function getFormSpec(project) {
  const explicit = project?.spec;
  // A newly-created project carries an empty canonical shell before its
  // legacy template has been registered. Expose the semantic registry to
  // callers immediately, while preserving an explicit populated FormSpec.
  if (explicit?.components?.length || !project?.templateHtml) return cloneJson(explicit || createEmptyFormSpec(project?.manifest?.documentType || "printform"));
  return cloneJson(createLegacyFormSpec(project));
}

export function validateFormSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== "object") return { valid: false, errors: ["FORMSPEC_MISSING"] };
  if (String(spec.version || "").split(".")[0] !== "1") errors.push("FORMSPEC_VERSION_UNSUPPORTED");
  if (!spec.document || typeof spec.document !== "object") errors.push("FORMSPEC_DOCUMENT_MISSING");
  if (!Array.isArray(spec.components)) errors.push("FORMSPEC_COMPONENTS_MISSING");
  if (!Array.isArray(spec.sections)) errors.push("FORMSPEC_SECTIONS_MISSING");
  const ids = new Set();
  for (const component of spec.components || []) {
    if (!component || typeof component !== "object" || !component.id) {
      errors.push("COMPONENT_ID_MISSING");
      continue;
    }
    if (ids.has(component.id)) errors.push(`DUPLICATE_COMPONENT_ID:${component.id}`);
    ids.add(component.id);
    if (!COMPONENT_TYPES.includes(component.type)) errors.push(`COMPONENT_TYPE_UNSUPPORTED:${component.type}`);
  }
  return { valid: errors.length === 0, errors, componentCount: ids.size };
}

export function listComponents(projectOrSpec) {
  const spec = projectOrSpec?.components ? projectOrSpec : getFormSpec(projectOrSpec);
  return cloneJson(spec.components || []);
}

export function findComponent(projectOrSpec, componentId) {
  return listComponents(projectOrSpec).find((component) => component.id === componentId) || null;
}

export function findComponentNode(template, component) {
  if (!template || !component?.sourceSelector) return null;
  try {
    return template.content.querySelector(component.sourceSelector);
  } catch {
    return null;
  }
}

export function updateComponentSpec(spec, componentId, patch) {
  const next = cloneJson(spec);
  const component = next.components?.find((item) => item.id === componentId);
  if (!component) throw Object.assign(new Error(`Unknown FormSpec component: ${componentId}`), { code: "COMPONENT_NOT_FOUND" });
  for (const key of ["label", "tableId", "keepTogether", "styleToken", "binding"]) {
    if (patch && Object.prototype.hasOwnProperty.call(patch, key)) component[key] = cloneJson(patch[key]);
  }
  return next;
}

export function tableIdFromNode(node) {
  return tableIdFor(node);
}
