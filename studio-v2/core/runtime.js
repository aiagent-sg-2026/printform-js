import { bindTemplate } from "./binding.js";
import { SECTION_IDS } from "./constants.js";
import { inspectRenderedDocument } from "./acceptance.js";
import { parseJson } from "./json.js";
import { validateData, validateSchemaProfile } from "./schema.js";
import { measureBoundRows, resolveRowLimits, rowLimitErrors } from "./row-limits.js";
import { validateBusinessRules } from "./business-rules.js";
import { inspectTemplateFormats } from "./binding-format.js";

function readJson(doc, id) {
  const element = doc.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return parseJson(element.textContent, id);
}

function waitForAssets(doc, timeoutMs = 5000) {
  const fonts = doc.fonts?.ready || Promise.resolve();
  const images = Array.from(doc.images).map((image) => {
    if (image.complete) return image.naturalWidth ? Promise.resolve() : Promise.reject(new Error(`Image failed: ${image.src}`));
    return new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", () => reject(new Error(`Image failed: ${image.src}`)), { once: true });
    });
  });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Asset readiness timed out")), timeoutMs));
  return Promise.race([Promise.all([fonts, ...images]), timeout]);
}

export function installPrintFormDocument(globalScope = globalThis) {
  const doc = globalScope.document;
  let generation = 0;
  let explicitRenderRequested = false;

  function finish(result, mount, clear = false, current = generation) {
    if (current !== generation) return {status:"superseded", validation:result.validation};
    if (clear) mount?.replaceChildren();
    doc.documentElement.dataset.printformStatus = result.status;
    globalScope.dispatchEvent(new CustomEvent("printform:rendered", { detail: result }));
    return result;
  }

  function validate(data) {
    try {
      const manifest = readJson(doc, SECTION_IDS.manifest);
      const schema = readJson(doc, SECTION_IDS.schema);
      const template = doc.getElementById(SECTION_IDS.template);
      const profile = validateSchemaProfile(schema);
      if (!profile.valid) return profile;
      const report = validateData(schema, data);
      if (report.valid) report.errors.push(...validateBusinessRules(data, manifest).errors);
      report.errors.push(...inspectTemplateFormats(template, manifest));
      const rowReport = measureBoundRows(data, template);
      const rows = rowReport.total;
      report.errors.push(...rowLimitErrors(rowReport, resolveRowLimits(manifest), "/"));
      report.valid = report.errors.length === 0;
      report.metrics = { rows };
      return report;
    } catch (error) {
      return { valid: false, errors: [{ code: error.code || "RUNTIME_CONFIG", path: "/", message: error.message }], warnings: [] };
    }
  }

  async function render(data, options = {}) {
    if (options.source !== "auto") explicitRenderRequested = true;
    const current = ++generation;
    const startedAt = performance.now();
    const mount = doc.getElementById("pf-mount");
    let manifest, i18n, actualData;
    try {
      manifest = readJson(doc, SECTION_IDS.manifest);
      i18n = doc.getElementById(SECTION_IDS.i18n) ? readJson(doc, SECTION_IDS.i18n) : {};
      actualData = data === undefined ? readJson(doc, SECTION_IDS.sampleData) : data;
    } catch (error) {
      return finish({status:"blocked",validation:{valid:false,errors:[{code:error.code || "RUNTIME_CONFIG",path:"/",message:error.message}],warnings:[]}}, mount, true, current);
    }
    const template = doc.getElementById(SECTION_IDS.template);
    const validation = validate(actualData);
    if (!validation.valid) {
      return finish({ status: "blocked", validation, metrics: { durationMs: performance.now() - startedAt } }, mount, true, current);
    }
    if (!template || !mount) return finish({ status: "blocked", validation: { valid: false, errors: [{ code: "RUNTIME_MOUNT", path: "/", message: "Template or mount is missing" }], warnings: [] } }, mount, true, current);
    const locale = options.locale || manifest.locale || "en-MY";
    if (manifest.i18n?.supportedLocales?.length && !manifest.i18n.supportedLocales.includes(locale)) {
      return finish({ status: "blocked", validation: { valid: false, errors: [{ code: "LOCALE_UNSUPPORTED", path: "/options/locale", message: `Locale ${locale} is not supported by this document` }], warnings: [] } }, mount, true, current);
    }
    doc.documentElement.lang = locale;
    const bound = bindTemplate(template, actualData, manifest, { i18n, locale });
    validation.errors.push(...bound.report.errors);
    validation.warnings.push(...bound.report.warnings);
    if (validation.errors.length) return finish({ status: "blocked", validation: { ...validation, valid: false }, binding: bound.report }, mount, true, current);
    mount.replaceChildren(bound.fragment);
    try { await waitForAssets(doc, options.assetTimeoutMs || 5000); }
    catch (error) {
      if (current !== generation) return {status:"superseded",validation};
      return finish({ status: "blocked", validation: { valid: false, errors: [{ code: "ASSET_FAILURE", path: "/", message: error.message }], warnings: validation.warnings } }, mount, true, current);
    }
    if (current !== generation) return { status: "superseded", validation };
    if (!globalScope.PrintForm?.formatAll) return finish({ status: "blocked", validation: { valid: false, errors: [{ code: "PRINTFORM_RUNTIME_MISSING", path: "/", message: "PrintForm runtime is unavailable" }], warnings: [] } }, mount, true, current);
    try { await globalScope.PrintForm.formatAll({ force: true }); }
    catch (error) {
      if (current !== generation) return {status:"superseded",validation};
      const failures = error.errors || [error];
      const errors = Array.from(failures, failure => ({code:failure.code || "FORMAT_FAILURE",path:"/template",message:failure.message,component:failure.componentId || null}));
      return finish({status:"blocked",validation:{valid:false,errors,warnings:validation.warnings}},mount,true,current);
    }
    if (current !== generation) return {status:"superseded",validation};
    const boundRowReport = { total: bound.report.tableRows, byTable: bound.report.tableRowsByTable };
    validation.errors.push(...rowLimitErrors(boundRowReport, resolveRowLimits(manifest), "/"));
    if (validation.errors.length) return finish({ status: "blocked", validation: { ...validation, valid: false }, binding: bound.report }, mount, true, current);
    const layout = inspectRenderedDocument(doc, manifest, { expectedRowCount: bound.report.tableRows, expectedRowsByRepeat: bound.report.expectedRowsByRepeat });
    const combined = { valid: layout.valid, errors: [...validation.errors, ...layout.errors], warnings: [...validation.warnings, ...layout.warnings] };
    const result = { status: combined.valid ? "ready" : "blocked", validation: combined, binding: bound.report, issues: layout.issues || [], pageGeometry: layout.pageGeometry || [], metrics: { ...layout.metrics, rows: bound.report.tableRows, durationMs: performance.now() - startedAt } };
    return finish(result, mount, false, current);
  }

  const api = { version: "2.0.0", validate, render };
  globalScope.PrintFormDocument = Object.freeze(api);
  const autoRender = () => queueMicrotask(() => { if (!explicitRenderRequested) render(undefined, { source: "auto" }); });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", autoRender, { once: true });
  else autoRender();
  return api;
}
