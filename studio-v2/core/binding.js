import { resolvePointer } from "./json.js";
import { SAFE_URL_PROTOCOLS } from "./constants.js";
import { translateFragment } from "./i18n.js";
import { tableRepeatDescriptor, measureBoundRows, resolveRowLimits, rowLimitErrors } from "./row-limits.js";
import { formatBindingValue, formatIssue } from "./binding-format.js";


export function safeUrl(value, baseUrl = "https://printform.invalid/") {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, baseUrl);
    return SAFE_URL_PROTOCOLS.includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

function bindElement(element, rootData, scope, manifest, report, scopeChain) {
  if (element.hasAttribute("data-pf-if")) {
    const value = resolvePointer(rootData, element.getAttribute("data-pf-if"), scope);
    if (!value) { element.remove(); return; }
  }
  if (element.hasAttribute("data-pf-text")) {
    const pointer = element.getAttribute("data-pf-text");
    const value = resolvePointer(rootData, pointer, scope);
    try { element.textContent = formatBindingValue(element, value, manifest); }
    catch (error) { report.errors.push(formatIssue(element, error)); }
    report.bindings += 1;
    if (value === undefined) report.errors.push({ code: "MISSING_BINDING", path: pointer, message: `No value found for ${pointer}` });
  }
  if (element.hasAttribute("data-pf-href")) {
    const pointer = element.getAttribute("data-pf-href");
    const value = resolvePointer(rootData, pointer, scope);
    const href = safeUrl(value);
    if (href) element.setAttribute("href", href);
    else {
      element.removeAttribute("href");
      report.errors.push({ code: "UNSAFE_URL", path: pointer, message: `Unsafe or invalid URL at ${pointer}` });
    }
  }
  bindChildren(element, rootData, scope, manifest, report, scopeChain);
}

function expandRepeat(element, rootData, scope, manifest, report, scopeChain) {
  const pointer = element.getAttribute("data-pf-each");
  const tableRepeat = tableRepeatDescriptor(element);
  const items = resolvePointer(rootData, pointer, scope);
  const fragment = element.ownerDocument.createDocumentFragment();
  if (!Array.isArray(items)) {
    report.errors.push({ code: "REPEAT_NOT_ARRAY", path: pointer, message: `${pointer} must resolve to an array` });
    element.replaceWith(fragment);
    return;
  }
  const repeatId = element.getAttribute("data-pf-repeat-id");
  const rowGroup = JSON.stringify([tableRepeat?.tableId || "", repeatId, scopeChain]);
  if (tableRepeat) report.expectedRowsByRepeat[rowGroup] = items.length;
  items.forEach((item, index) => {
    const clone = element.cloneNode(true);
    clone.removeAttribute("data-pf-each");
    clone.setAttribute("data-pf-row-index", String(index));
    clone.setAttribute("data-pf-row-repeat", rowGroup);
    bindElement(clone, rootData, item, manifest, report, [...scopeChain, [repeatId, index]]);
    fragment.appendChild(clone);
  });
  report.rows += items.length;
  if (tableRepeat) {
    report.tableRows += items.length;
    report.tableRowsByTable[tableRepeat.tableId] = (report.tableRowsByTable[tableRepeat.tableId] || 0) + items.length;
  }
  element.replaceWith(fragment);
}

function bindChildren(parent, rootData, scope, manifest, report, scopeChain) {
  Array.from(parent.children).forEach((child) => {
    if (child.hasAttribute("data-pf-each")) expandRepeat(child, rootData, scope, manifest, report, scopeChain);
    else bindElement(child, rootData, scope, manifest, report, scopeChain);
  });
}

export function bindTemplate(template, data, manifest = {}, options = {}) {
  const fragment = template.content.cloneNode(true);
  const locale = options.locale || manifest.locale || "en-MY";
  const effectiveManifest = { ...manifest, locale };
  const translation = translateFragment(fragment, options.i18n || {}, locale, manifest.i18n?.fallbackLocale || "en-MY");
  const report = { bindings: 0, rows: 0, tableRows: 0, tableRowsByTable: Object.create(null), expectedRowsByRepeat: {}, errors: [...translation.errors], warnings: [], translations: translation.translated, locale };
  report.errors.push(...rowLimitErrors(measureBoundRows(data, fragment), resolveRowLimits(manifest)));
  if (report.errors.length) return { fragment: template.ownerDocument.createDocumentFragment(), report };
  fragment.querySelectorAll("[data-pf-each]").forEach((node, index) => node.setAttribute("data-pf-repeat-id", String(index)));
  bindChildren(fragment, data, data, effectiveManifest, report, []);
  return { fragment, report };
}
