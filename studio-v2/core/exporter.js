import { LIMITS } from "./constants.js";
import { inlineProjectAssets } from "./assets.js";
import { validateProject } from "./acceptance.js";
import { serializeStandalone } from "./project-model.js";
import { assertTrustedContent } from "./content-security.js";
import { createEvidencePack, evidenceSummary } from "./evidence-pack.js";
import { sha256 } from "./json.js";

let sourceCache;

export async function loadRuntimeSources() {
  if (!sourceCache) {
    sourceCache = Promise.all([
      fetch("../dist/printform-document.js").then(requireOk).then((response) => response.text()),
      fetch("../dist/printform.js").then(requireOk).then((response) => response.text())
    ]).then(([documentRuntime, printform]) => ({ documentRuntime, printform, runtimeVersion: "2.0.0" }));
  }
  return sourceCache;
}

function requireOk(response) {
  if (!response.ok) throw new Error(`Runtime source returned HTTP ${response.status}`);
  return response;
}

function redactEmbeddedExportHash(html) {
  return String(html).replace(/("exportHtmlHash":\s*)(?:null|"sha256:[^"]*")/, "$1null");
}

export async function createStandaloneHtml(project, options = {}) {
  options.assertCurrent?.();
  const validation = options.validation || validateProject(project);
  if (options.requireTrusted !== false && !validation.productionValid) {
    const error = new Error("Project is not eligible for a trusted production export");
    error.code = "EXPORT_BLOCKED";
    error.validation = validation;
    throw error;
  }
  const assets = await inlineProjectAssets(project, options.baseUrl, { dataPolicy: options.dataPolicy || null, assertCurrent: options.assertCurrent });
  options.assertCurrent?.();
  const security = options.requireTrusted !== false
    ? assertTrustedContent(assets.project, { allowExternalHttps: assets.project.manifest.assets?.allowExternalHttps === true })
    : null;
  const sources = options.runtimeSources || await loadRuntimeSources();
  options.assertCurrent?.();
  const runtimeHash = await sha256(`\n${sources.documentRuntime}\n`);
  const printformRuntimeHash = await sha256(`\n${sources.printform}\n`);
  const draftPack = await createEvidencePack({
    project: assets.project,
    revision: options.revision ?? null,
    validation,
    previewHash: options.previewHash || null,
    runtimeVersion: sources.runtimeVersion,
    runtimeHash,
    printformRuntimeHash,
    security,
    transactionId: options.transactionId || null,
  });
  const draftHtml = await serializeStandalone(assets.project, sources, validation, {
    trusted: options.requireTrusted !== false,
    networkDisabled: options.networkDisabled,
    scriptNonce: options.scriptNonce,
    validatedAt: draftPack.timestamp,
    evidenceSummary: evidenceSummary(draftPack),
  });
  const embeddedExportHash = `sha256:${await sha256(draftHtml)}`;
  const html = await serializeStandalone(assets.project, sources, validation, {
    trusted: options.requireTrusted !== false,
    networkDisabled: options.networkDisabled,
    scriptNonce: options.scriptNonce,
    validatedAt: draftPack.timestamp,
    evidenceSummary: evidenceSummary({ ...draftPack, exportHtmlHash: embeddedExportHash }),
  });
  const bytes = new TextEncoder().encode(html).byteLength;
  if (bytes > (project.manifest.acceptance?.maxHtmlBytes || LIMITS.htmlBytes)) {
    const error = new Error(`Export is ${bytes} bytes and exceeds the configured limit`);
    error.code = "HTML_SIZE_LIMIT";
    throw error;
  }
  const evidencePack = await createEvidencePack({
    project: assets.project,
    revision: options.revision ?? null,
    validation,
    previewHash: options.previewHash || null,
    html: redactEmbeddedExportHash(html),
    runtimeVersion: sources.runtimeVersion,
    runtimeHash,
    printformRuntimeHash,
    security,
    timestamp: draftPack.timestamp,
    transactionId: options.transactionId || null,
  });
  options.assertCurrent?.();
  return { html, bytes, validation, security, evidencePack, warnings: [...validation.warnings, ...assets.warnings] };
}
