import { LIMITS } from "./constants.js";
import { resolvePointer } from "./json.js";

const TABLE_ROW_CLASSES = Object.freeze(["prowitem"]);

function attribute(source, name) {
  if (source?.getAttribute) return source.getAttribute(name);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`\\b${escaped}\\s*=\\s*(['"])(.*?)\\1`, "i").exec(String(source || ""));
  return match?.[2] || null;
}

function classes(source) {
  return String(source?.className || attribute(source, "class") || "").split(/\s+/).filter(Boolean);
}

export function tableRepeatDescriptor(source) {
  const pointer = attribute(source, "data-pf-each");
  if (!pointer) return null;
  const tableId = attribute(source, "data-pf-table-id") || attribute(source, "data-pf-table");
  const isTable = Boolean(tableId) || TABLE_ROW_CLASSES.some((name) => classes(source).includes(name));
  return isTable ? { pointer, tableId: tableId || "default" } : null;
}

export function listBoundTableRepeats(template) {
  const nodes = template?.content?.querySelectorAll?.("[data-pf-each]") || template?.querySelectorAll?.("[data-pf-each]");
  if (nodes) return Array.from(nodes).flatMap(node => {
    const descriptor = tableRepeatDescriptor(node);
    if (!descriptor) return [];
    const ancestors = [];
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      if (parent.hasAttribute("data-pf-each")) ancestors.unshift(parent.getAttribute("data-pf-each"));
    }
    return [{...descriptor, ancestors}];
  });
  const source = typeof template === "string" ? template : template?.innerHTML || "";
  const stack = [], repeats = [];
  // Preserve repeat ancestry even in the Node CLI, where DOMParser is unavailable.
  const tags = /<!--[\s\S]*?-->|<\/?([A-Za-z][\w:-]*)(?:[^"'<>]|"[^"]*"|'[^']*')*>/g;
  const voidTags = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
  for (const match of source.matchAll(tags)) {
    if (!match[1]) continue;
    const tag = match[1].toLowerCase();
    if (match[0].startsWith("</")) {
      const index = stack.findLastIndex(node => node.tag === tag);
      if (index >= 0) stack.length = index;
      continue;
    }
    const pointer = attribute(match[0], "data-pf-each");
    const descriptor = tableRepeatDescriptor(match[0]);
    if (descriptor) repeats.push({...descriptor, ancestors:stack.filter(node => node.pointer).map(node => node.pointer)});
    if (!voidTags.has(tag) && !match[0].endsWith("/>")) stack.push({tag, pointer});
  }
  return repeats;
}

export function measureBoundRows(data, template, descriptors = listBoundTableRepeats(template)) {
  const byTable = new Map(), paths = new Map();
  for (const descriptor of descriptors) {
    const pointers = [...(descriptor.ancestors || []), descriptor.pointer];
    let count = 0;
    const visit = (scope, depth) => {
      const values = resolvePointer(data, pointers[depth], scope);
      if (!Array.isArray(values)) return;
      if (depth === pointers.length - 1) count += values.length;
      else for (const value of values) visit(value, depth + 1);
    };
    visit(data, 0);
    byTable.set(descriptor.tableId, (byTable.get(descriptor.tableId) || 0) + count);
    if (!paths.has(descriptor.tableId)) paths.set(descriptor.tableId, descriptor.pointer);
  }
  return {
    total: Array.from(byTable.values()).reduce((sum, count) => sum + count, 0),
    byTable: Object.fromEntries(byTable),
    paths: Object.fromEntries(paths),
  };
}

export function countBoundRows(data, template) {
  return measureBoundRows(data, template).total;
}

function positiveLimit(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export function resolveRowLimits(manifestOrAcceptance = {}) {
  const acceptance = manifestOrAcceptance.acceptance || manifestOrAcceptance;
  return {
    perTable: positiveLimit(acceptance.maxRowsPerTable, LIMITS.rowsPerTable || LIMITS.rows),
    total: positiveLimit(acceptance.maxRows, LIMITS.rows),
  };
}

export function rowLimitErrors(rowReport, limits, path = "/") {
  const errors = [];
  for (const count of Object.values(rowReport.byTable || {})) {
    if (count > limits.perTable) errors.push({ code: "ROW_LIMIT", message: `A bound table contains ${count} rows; per-table limit is ${limits.perTable}`, path, severity: "error" });
  }
  if (rowReport.total > limits.total) errors.push({ code: "ROW_LIMIT", message: `Bound tables contain ${rowReport.total} rows; aggregate limit is ${limits.total}`, path, severity: "error" });
  return errors;
}
