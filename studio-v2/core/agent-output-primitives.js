import { LIMITS } from "./constants.js";

const HASH = /^(?:sha256:)?[a-f0-9]{32,128}$/i;
const SCENARIOS = new Set(["default", "empty", "one", "45-rows", "100-rows", "500-rows", "long-text"]);
const METRIC_KEYS = new Set(["rows", "logicalPages", "htmlBytes", "pageCount", "width", "height", "maxPageHeight", "overflowPages", "totalHeight", "overflowElements", "verticalOverflowPages", "contrastFailures", "renderedRows", "expectedRows", "durationMs"]);
const DIAGNOSTIC_CODES = new Set([
  "MONETARY_TOKEN_UNREADABLE", "FORMAT_CONFIG", "FORMAT_FAILURE",
  "AI_REVIEW_REQUIRED", "AGENT_BUSY", "AGENT_OPERATION_NOT_ALLOWED", "AGENT_RAW_SOURCE_BLOCKED", "ASSET_FETCH_POLICY_BLOCKED", "ASSET_SLOT_CARDINALITY", "AUTO_APPLY_NOT_ALLOWED", "CANDIDATE_CONTENT_MISMATCH", "CANDIDATE_HASH_MISMATCH", "CANDIDATE_INVALID", "CLIENT_ADMISSION_INVALID", "CLIENT_ADMISSION_UNAVAILABLE", "CLIENT_NOT_ADMITTED", "COLUMN_WIDTHS_COUNT_MISMATCH", "COLUMN_WIDTHS_NO_ROWS", "COLUMN_WIDTHS_TARGET_INVALID", "COMMAND_FAILED", "COMPONENT_NOT_FOUND", "COMPONENT_TYPE_UNSUPPORTED", "CONFLICT", "CONTRAST_FAILURE", "EVIDENCE_ANCHOR_INVALID", "EVIDENCE_ANCHOR_CONFLICT", "EVIDENCE_COVERAGE_INCOMPLETE", "EVIDENCE_PROVENANCE_MISMATCH", "EVIDENCE_RECEIPT_REQUIRED", "EVIDENCE_RENDER_NOT_READY", "EVIDENCE_REVISION_MISMATCH", "EVIDENCE_UNKNOWN", "EVIDENCE_UNAVAILABLE", "EXECUTABLE_MARKUP_PRESENT", "FORMSPEC_COMPONENTS_MISSING", "FORMSPEC_DOCUMENT_MISSING", "FORMSPEC_LEGACY_ADAPTER", "FORMSPEC_VERSION_UNSUPPORTED", "HUMAN_APPROVAL_REQUIRED", "HTML_SIZE_LIMIT", "IMAGE_ALT_MISSING", "INVALID_INPUT_JSON", "INVALID_OPERATION", "INVALID_OPERATION_SET", "INVALID_OPERATION_SHAPE", "LANG_MISSING", "LAYOUT_METRICS_FAILED", "LAYOUT_PREVIEW_NOT_READY", "LAYOUT_REVIEW_REQUIRED", "LEASE_EXPIRED", "LEASE_ID_MISMATCH", "LEASE_OWNER_MISMATCH", "LOCALE_UNSUPPORTED", "PIXEL_CAPTURE_UNAVAILABLE", "PIXEL_EVIDENCE_SYNTHETIC_ONLY", "PREVIEW_REQUIRED", "PRINTFORM_ROOT_MISSING", "PROTOCOL_MAJOR_UNSUPPORTED", "REFERENCE_NOT_FOUND", "RECOVERY_REQUIRED", "RENDER_FAILED", "RENDER_PROVENANCE_REQUIRED", "REVIEW_ATTEMPT_LIMIT", "REVIEW_ISSUES_OPEN", "REVIEW_METRICS_FAILED", "REVIEW_NOT_STARTED", "REVIEW_SCENARIOS_REQUIRED", "REVISION_CONFLICT", "REVISION_NOT_AVAILABLE", "ROW_COUNT_MISMATCH", "ROW_LIMIT", "ROW_MISSING_INDEX", "ROW_ORDER_MISMATCH", "SCHEMA_PROFILE_INVALID", "SCOPE_CHANGED", "SCOPE_VIOLATION", "STALE_POLICY_CONTEXT", "STORE_CONFLICT", "SYNTHETIC_SCENARIO_REQUIRED", "TABLE_HEADER_MISSING", "TERMINAL_ACTION_REQUIRED", "TRANSACTION_ALREADY_COMMITTED", "TRANSACTION_NOT_APPROVED", "TRANSACTION_NOT_FOUND", "TRANSACTION_RECORD_CONFLICT", "TRANSACTION_REQUIRED", "UNSUPPORTED_OPERATION", "UNTRUSTED_READ_ONLY", "UNKNOWN_TOOL", "VERTICAL_OVERFLOW"
]);
const PHASES = new Set(["before_preview", "after_approval", "during_commit", "after_revision_write", "before_commit", "after_commit"]);

export function projectionError(message = "Agent output could not be projected safely") {
  return Object.assign(new Error(message), { code: "AGENT_OUTPUT_INVALID" });
}

export function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw projectionError(`${name} is not a valid object`);
  return value;
}

export function requireArray(value, name) {
  if (!Array.isArray(value)) throw projectionError(`${name} is not a valid array`);
  return value;
}

export function compact(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

export function safeRevision(value, required = true) {
  if (Number.isSafeInteger(value) && value >= 0) return value;
  if (!required && value == null) return undefined;
  throw projectionError("Invalid revision in Agent output");
}

export function safeCount(value, required = false) {
  if (Number.isSafeInteger(value) && value >= 0) return value;
  if (!required && value == null) return undefined;
  throw projectionError("Invalid count in Agent output");
}

export function safeNumber(value, { positive = false } = {}) {
  if (!Number.isFinite(value) || (positive && value <= 0)) return undefined;
  return value;
}

export function safeBoolean(value, required = true) {
  if (typeof value === "boolean") return value;
  if (!required && value == null) return undefined;
  throw projectionError("Invalid boolean in Agent output");
}

export function safeHash(value, required = false) {
  if (value == null && !required) return value === null ? null : undefined;
  if (typeof value === "string" && HASH.test(value)) return value;
  throw projectionError("Invalid hash in Agent output");
}

export function safeTime(value, required = false) {
  if (value == null && !required) return value === null ? null : undefined;
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  throw projectionError("Invalid timestamp in Agent output");
}

export function safeCode(value) {
  const prefix = String(value || "COMMAND_FAILED").split(":", 1)[0];
  return DIAGNOSTIC_CODES.has(prefix) ? prefix : "AGENT_DIAGNOSTIC";
}

export function safePhase(value) { return PHASES.has(value) ? value : undefined; }
export function safeScenario(value) { return SCENARIOS.has(value) ? value : undefined; }

export function projectMetrics(metrics) {
  if (!metrics || typeof metrics !== "object") return undefined;
  const result = {};
  for (const key of METRIC_KEYS) {
    const value = metrics[key];
    if (!Number.isFinite(value) || value < 0) continue;
    result[key] = ["durationMs", "width", "height", "maxPageHeight", "totalHeight"].includes(key) ? value : Math.trunc(value);
  }
  return Object.keys(result).length ? result : undefined;
}

export function projectRect(rect) {
  if (!rect || typeof rect !== "object") return undefined;
  const result = {};
  for (const key of ["x", "y", "width", "height", "top", "left", "right", "bottom"]) {
    const value = safeNumber(rect[key]);
    if (value !== undefined && (!['width', 'height'].includes(key) || value >= 0)) result[key] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

export function projectIssue(issue, context) {
  if (!issue || typeof issue !== "object") return null;
  const result = compact({
    code: safeCode(issue.code),
    severity: ["error", "warning"].includes(issue.severity) ? issue.severity : undefined,
    path: typeof issue.path === "string" ? context.references.referenceFor("path", issue.path) : undefined,
    selector: typeof issue.selector === "string" ? context.references.referenceFor("selector", issue.selector) : undefined,
    pageIndex: safeCount(issue.pageIndex),
    keyword: typeof issue.keyword === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(issue.keyword) ? issue.keyword : undefined,
    rect: projectRect(issue.rect || issue.measured_size),
  });
  return result;
}

export function projectValidation(validation, context, required = false) {
  if (!validation || typeof validation !== "object") {
    if (!required && validation == null) return undefined;
    throw projectionError("Invalid validation in Agent output");
  }
  const issues = (value, name) => {
    if (value === undefined) return [];
    return requireArray(value, name).map((item) => projectIssue(item, context)).filter(Boolean);
  };
  const result = compact({
    valid: safeBoolean(validation.valid),
    productionValid: safeBoolean(validation.productionValid),
    errors: issues(validation.errors, "validation errors"),
    warnings: issues(validation.warnings, "validation warnings"),
    issues: issues(validation.issues, "validation issues"),
    metrics: projectMetrics(validation.metrics),
  });
  if (validation.reviewReceipt) result.reviewReceipt = projectReviewStatus(validation.reviewReceipt, context);
  return result;
}

export function projectDiff(diff) {
  requireObject(diff, "diff");
  const sections = new Set(["manifest", "schema", "i18n", "themeCss", "templateHtml", "sampleData", "trust"]);
  return {
    changed: safeBoolean(diff.changed),
    changedSections: Array.isArray(diff.changedSections) ? diff.changedSections.filter((item) => sections.has(item)) : [],
    operationCount: safeCount(diff.operationCount, true),
  };
}

export function projectReviewStatus(review, context) {
  if (!review || typeof review !== "object") return { status: "required", reviewedRevision: null };
  const statuses = new Set(["required", "stale", "pass"]);
  if (!statuses.has(review.status)) throw projectionError("Invalid review status in Agent output");
  return compact({
    status: review.status,
    reviewedRevision: safeRevision(review.reviewedRevision, false) ?? null,
    browsers: Array.isArray(review.browsers) ? review.browsers.map(projectBrowser).filter(Boolean) : undefined,
    reviewedAt: safeTime(review.reviewedAt, false),
  });
}

export function projectBrowser(browser) {
  if (!browser || typeof browser !== "object") return null;
  const allowed = new Set(["Chrome", "Chromium", "Edge", "Firefox", "Safari", "unknown"]);
  return compact({ name: allowed.has(browser.name) ? browser.name : "unknown", version: /^\d{1,6}(?:\.\d{1,6}){0,3}$/.test(String(browser.version || "")) ? String(browser.version) : "" });
}

function validDataUrl(dataUrl, pattern, maxLength) {
  return typeof dataUrl === "string" && dataUrl.length <= maxLength && pattern.test(dataUrl)
    && !/(?:%3c|<)\s*(?:script|foreignObject)\b|on[a-z]+\s*=|javascript:/i.test(dataUrl);
}

export function projectGeometry(snapshot) {
  if (!snapshot || snapshot.source !== "geometry-only" || snapshot.redacted !== true || snapshot.mimeType !== "image/svg+xml") return undefined;
  if (!validDataUrl(snapshot.dataUrl, /^data:image\/svg\+xml(?:;base64,|;charset=utf-8,)/, 4_000_000)) return undefined;
  return compact({ source: "geometry-only", redacted: true, mimeType: "image/svg+xml", dataUrl: snapshot.dataUrl, width: safeNumber(snapshot.width, { positive: true }), height: safeNumber(snapshot.height, { positive: true }), pageCount: safeCount(snapshot.pageCount) });
}

export function projectPixels(snapshot, context) {
  if (!context.dataPolicy?.allowPixelEvidence || !snapshot || snapshot.source !== "sandbox-pixel" || snapshot.syntheticData !== true || snapshot.redacted !== false) return undefined;
  if (!validDataUrl(snapshot.dataUrl, /^data:image\/(?:png|jpeg|webp);base64,/, 5_000_000)) return undefined;
  return compact({ source: "sandbox-pixel", syntheticData: true, redacted: false, mimeType: snapshot.mimeType, dataUrl: snapshot.dataUrl, width: safeNumber(snapshot.width, { positive: true }), height: safeNumber(snapshot.height, { positive: true }), pageCount: safeCount(snapshot.pageCount) });
}

export function projectCoverage(coverage, required = false) {
  if (!coverage || typeof coverage !== "object") {
    if (!required && coverage == null) return undefined;
    throw projectionError("Invalid coverage in Agent output");
  }
  return compact({ capturedPages: safeCount(coverage.capturedPages), totalPages: safeCount(coverage.totalPages), complete: safeBoolean(coverage.complete) });
}
