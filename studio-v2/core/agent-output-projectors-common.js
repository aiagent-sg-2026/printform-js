import { COMPONENT_TYPES, FORM_SPEC_VERSION } from "./form-spec.js";
import { OPERATION_DEFINITIONS } from "./operation-schemas.js";
import { stateName } from "./transaction-state.js";
import {
  compact, projectIssue, projectMetrics, projectValidation, projectionError,
  requireArray, requireObject, safeBoolean, safeCode, safeCount, safeHash, safeNumber,
  safeRevision, safeScenario, safeTime,
} from "./agent-output-primitives.js";

const ROLES = new Set(["document-header", "document-meta", "project-info", "summary", "table-header", "table-row", "variation", "money-summary", "signature", "journey", "disclaimer", "footer"]);
const STATUSES = new Set(["draft", "previewed", "validated", "approved", "committing", "committed", "rolled_back", "expired", "conflicted", "recovery_required"]);
const AUDIT_TYPES = new Set(["transaction_started", "lease_acquired", "lease_renewed", "lease_takeover", "preview_created", "approved", "commit_started", "revision_committed", "rolled_back", "recovery_required", "conflict_detected", "lease_released", "recovered", "evidence_anchored", "during_evidence_write", "lease_expired"]);
const JOURNAL_TYPES = new Set(["BEGIN_EDIT", "LEASE_ACQUIRED", "LEASE_RENEWED", "PREVIEW", "APPROVE", "COMMIT_STARTED", "COMMIT", "REVISION_COMMIT", "ROLLBACK", "CONFLICT", "INTERRUPTED", "LEASE_RELEASED", "RECOVERED", "LEASE_EXPIRED", "LEASE_TAKEOVER", "UNDO", "REDO", "EVIDENCE_PACK", "EVIDENCE_ANCHORED"]);
const REASONS = new Set(["initial", "explicit_rollback", "conflict_resolution", "undo", "redo", "transaction commit"]);
const REPEATED_AREA_KEYS = ["header", "docinfo", "rowheader", "ptacRowheader", "footer", "footerLogo", "footerPagenum"];

function ref(context, kind, value) {
  return value == null ? null : context.references.referenceFor(kind, value);
}

function projectBinding(binding, context) {
  if (!binding || typeof binding !== "object") return null;
  return compact(Object.fromEntries(["text", "barcode", "each", "if", "href", "i18n"].map((key) => [key, binding[key] == null ? undefined : ref(context, "path", binding[key])])));
}

export function projectComponent(component, context) {
  requireObject(component, "component");
  if (!component.id || !COMPONENT_TYPES.includes(component.type)) throw projectionError("Invalid FormSpec component");
  return compact({
    id: ref(context, "component", component.id),
    type: component.type,
    role: component.role == null ? null : (ROLES.has(component.role) ? component.role : undefined),
    tableId: ref(context, "table", component.tableId),
    sourceSelector: ref(context, "selector", component.sourceSelector),
    binding: projectBinding(component.binding, context),
    keepTogether: safeBoolean(component.keepTogether, false),
    styleToken: ref(context, "style", component.styleToken),
    repeatHeader: typeof component.repeatHeader === "boolean" ? component.repeatHeader : undefined,
  });
}

function projectFormDocument(document) {
  requireObject(document, "FormSpec document");
  const papers = new Set(["A3", "A4", "A5", "Letter", "Legal"]);
  if (!papers.has(document.paper) || !["portrait", "landscape"].includes(document.orientation)) throw projectionError("Unsupported FormSpec page settings");
  return { paper: document.paper, orientation: document.orientation };
}

export function projectFormSpec(spec, context) {
  requireObject(spec, "FormSpec");
  if (spec.version !== FORM_SPEC_VERSION || !["canonical", "legacy-adapter"].includes(spec.mode)) throw projectionError("Unsupported FormSpec version");
  const sections = requireArray(spec.sections, "FormSpec sections").map((section) => {
    requireObject(section, "FormSpec section");
    return {
      id: ref(context, "section", section.id),
      componentIds: requireArray(section.componentIds, "FormSpec section componentIds").map((id) => ref(context, "component", id)),
    };
  });
  const pagination = spec.pagination && {
    repeatDocumentHeader: safeBoolean(spec.pagination.repeatDocumentHeader, false),
    repeatTableHeader: safeBoolean(spec.pagination.repeatTableHeader, false),
    footer: safeBoolean(spec.pagination.footer, false),
    pageNumbers: safeBoolean(spec.pagination.pageNumbers, false),
      keepTogether: requireArray(spec.pagination.keepTogether, "FormSpec pagination keepTogether").map((id) => ref(context, "component", id)),
  };
  return compact({
    version: FORM_SPEC_VERSION,
    mode: spec.mode,
    document: projectFormDocument(spec.document),
    sections,
    components: requireArray(spec.components, "FormSpec components").map((component) => projectComponent(component, context)),
    pagination,
  });
}

export function projectInspection(result, context) {
  requireObject(result, "inspection");
  return {
    blocks: safeCount(result.blocks, true),
    bindings: requireArray(result.bindings, "inspection bindings").map((binding) => {
      requireObject(binding, "inspection binding");
      return compact({
      tag: /^[a-z][a-z0-9-]{0,30}$/.test(String(binding.tag || "")) ? String(binding.tag).toLowerCase() : undefined,
      id: ref(context, "element", binding.id),
      className: ref(context, "class", binding.className),
      text: ref(context, "path", binding.text),
      barcode: ref(context, "path", binding.barcode),
      each: ref(context, "path", binding.each),
      condition: ref(context, "path", binding.condition),
      href: ref(context, "path", binding.href),
      i18nKey: ref(context, "i18n", binding.i18nKey),
      assetSlot: ref(context, "slot", binding.assetSlot),
      });
    }),
  };
}

function width(value) {
  if (value === "" || value === "auto") return value;
  return /^\d+(?:\.\d+)?(?:%|px|mm|pt)$/.test(String(value || "")) ? String(value) : "";
}

export function projectDesignState(result, context, supportedOperations) {
  requireObject(result, "design state");
  const tables = requireArray(result.tables, "design tables").map((table) => {
    requireObject(table, "design table");
    return {
    tableSelector: ref(context, "table", table.tableSelector),
    columns: requireArray(table.columns, "design table columns").map((column, index) => {
      requireObject(column, "design column");
      return { label: `Column ${index + 1}`, width: width(column.width) };
    }),
    };
  });
  const repeatedAreas = result.repeatedAreas && typeof result.repeatedAreas === "object"
    ? Object.fromEntries(REPEATED_AREA_KEYS
      .filter((key) => typeof result.repeatedAreas[key] === "boolean")
      .map((key) => [key, result.repeatedAreas[key]]))
    : undefined;
  const assets = requireArray(result.assets, "design assets").map((asset) => {
    requireObject(asset, "design asset");
    return { slot: ref(context, "slot", asset.slot), configured: safeBoolean(asset.configured) };
  });
  const page = result.page && { width: safeNumber(result.page.width, { positive: true }), height: safeNumber(result.page.height, { positive: true }) };
  if (page && (page.width === undefined || page.height === undefined)) throw projectionError("Invalid page dimensions");
  const basePt = safeNumber(result.typography?.basePt, { positive: true });
  if (basePt === undefined) throw projectionError("Invalid typography metrics");
  const color = result.branding?.primaryColor;
  return compact({
    revision: safeRevision(result.revision),
    page: page || null,
    typography: { basePt },
    branding: { primaryColor: color == null ? null : (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color) ? color.toLowerCase() : null) },
    tables,
    repeatedAreas,
    assets,
    supportedOperations: [...supportedOperations],
  });
}

export function projectOperationSummary(operation, context) {
  requireObject(operation, "operation");
  if (!OPERATION_DEFINITIONS[operation.type]) throw projectionError("Unknown operation in Agent output");
  return compact({
    type: operation.type,
    path: ref(context, "path", operation.path),
    selector: ref(context, "selector", operation.selector),
    slot: ref(context, "slot", operation.slot),
    tableSelector: ref(context, "table", operation.tableSelector),
    componentId: ref(context, "component", operation.componentId),
    bindingType: ["text", "each", "if", "href", "i18n"].includes(operation.bindingType) ? operation.bindingType : undefined,
  });
}

function projectApproval(approval, context) {
  if (!approval || typeof approval !== "object") return approval === null ? null : undefined;
  return compact({ actor: ref(context, "identity", approval.actor), approved_at: safeTime(approval.approved_at, true), preview_hash: safeHash(approval.preview_hash, false) });
}

function projectLease(lease, context) {
  if (!lease || typeof lease !== "object") return lease === null ? null : undefined;
  return compact({ owner: ref(context, "identity", lease.owner), lease_id: ref(context, "lease", lease.lease_id), lease_expires_at: safeTime(lease.lease_expires_at, true), heartbeat: safeTime(lease.heartbeat, true) });
}

function projectCommitResult(result) {
  if (!result || typeof result !== "object") return result === null ? null : undefined;
  return compact({
    status: ["committing", "committed", "rolled_back"].includes(result.status) ? result.status : undefined,
    no_op: safeBoolean(result.no_op, false),
    revision: safeRevision(result.revision, false),
    expected_revision: safeRevision(result.expected_revision, false),
    candidate_content_hash: safeHash(result.candidate_content_hash, false),
    started_at: safeTime(result.started_at, false),
    committed_at: safeTime(result.committed_at, false),
    recovered_at: safeTime(result.recovered_at, false),
  });
}

function projectConflict(conflict) {
  if (!conflict || typeof conflict !== "object") return conflict === null ? null : undefined;
  return compact({ code: safeCode(conflict.code), expected_revision: safeRevision(conflict.expected_revision, true), actual_revision: safeRevision(conflict.actual_revision, true), detected_at: safeTime(conflict.detected_at, false), resolved_at: safeTime(conflict.resolved_at, false), resolution: conflict.resolution === "rollback" ? "rollback" : undefined });
}

export function projectTransaction(transaction, context) {
  requireObject(transaction, "transaction");
  if (!STATUSES.has(transaction.status)) throw projectionError("Unknown transaction status");
  return compact({
    transaction_id: ref(context, "transaction", transaction.transaction_id),
    form_id: ref(context, "form", transaction.form_id),
    base_revision: safeRevision(transaction.base_revision, true),
    working_revision: safeRevision(transaction.working_revision, true),
    owner: ref(context, "identity", transaction.owner),
    agent_id: ref(context, "identity", transaction.agent_id),
    status: transaction.status,
    state: stateName(transaction.status),
    patches: Array.isArray(transaction.patches) ? transaction.patches.map((item) => projectOperationSummary(item, context)) : undefined,
    changes: Array.isArray(transaction.changes) ? transaction.changes.map((item) => projectOperationSummary(item, context)) : undefined,
    preview_hash: safeHash(transaction.preview_hash, false),
    candidate_content_hash: safeHash(transaction.candidate_content_hash, false),
    candidate_form_spec_hash: safeHash(transaction.candidate_form_spec_hash, false),
    validation_result: transaction.validation_result === null ? null : projectValidation(transaction.validation_result, context, false),
    approval: projectApproval(transaction.approval, context),
    lease: projectLease(transaction.lease, context),
    created_at: safeTime(transaction.created_at, true),
    updated_at: safeTime(transaction.updated_at, true),
    previewed_at: safeTime(transaction.previewed_at, false),
    approved_at: safeTime(transaction.approved_at, false),
    committed_at: safeTime(transaction.committed_at, false),
    rolled_back_at: safeTime(transaction.rolled_back_at, false),
    expired_at: safeTime(transaction.expired_at, false),
    commit_result: projectCommitResult(transaction.commit_result),
    evidence_pack_ref: transaction.evidence_pack_ref === null ? null : projectAnchor(transaction.evidence_pack_ref, context),
    conflict: projectConflict(transaction.conflict),
    supersedes_transaction_id: ref(context, "transaction", transaction.supersedes_transaction_id),
  });
}

function projectAuditValidation(validation) {
  if (!validation || typeof validation !== "object") return undefined;
  return compact({ valid: safeBoolean(validation.valid), error_count: safeCount(validation.error_count, true), warning_count: safeCount(validation.warning_count, true) });
}

export function projectAudit(event, context, projectPack) {
  requireObject(event, "audit event");
  if (!AUDIT_TYPES.has(event.type)) throw projectionError("Unknown audit event type");
  return compact({
    event_id: ref(context, "event", event.event_id), type: event.type, timestamp: safeTime(event.timestamp, true),
    actor: ref(context, "identity", event.actor), agent_id: ref(context, "identity", event.agent_id), form_id: ref(context, "form", event.form_id), transaction_id: ref(context, "transaction", event.transaction_id),
    revision: safeRevision(event.revision, false), base_revision: safeRevision(event.base_revision, false),
    base_project_hash: safeHash(event.base_project_hash, false), preview_hash: safeHash(event.preview_hash, false), candidate_content_hash: safeHash(event.candidate_content_hash, false), candidate_form_spec_hash: safeHash(event.candidate_form_spec_hash, false), form_spec_hash: safeHash(event.form_spec_hash, false), evidence_pack_hash: safeHash(event.evidence_pack_hash, false), artifact_hash: safeHash(event.artifact_hash, false),
    changes: Array.isArray(event.changes) ? event.changes.map((item) => projectOperationSummary(item, context)) : undefined,
    validation: projectAuditValidation(event.validation), approval: projectApproval(event.approval, context), lease_id: ref(context, "lease", event.lease_id), supersedes_transaction_id: ref(context, "transaction", event.supersedes_transaction_id), lease_expires_at: safeTime(event.lease_expires_at, false),
    no_op: safeBoolean(event.no_op, false), takeover: safeBoolean(event.takeover, false), expected_revision: safeRevision(event.expected_revision, false), actual_revision: safeRevision(event.actual_revision, false), code: event.code ? safeCode(event.code) : undefined, phase: event.phase && /^[a-z_]{1,40}$/.test(event.phase) ? event.phase : undefined, reason: REASONS.has(event.reason) ? event.reason : undefined, outcome: ["committed", "rolled_back", "recovery_required"].includes(event.outcome) ? event.outcome : undefined,
  });
}

export function projectJournal(event, context, projectPack) {
  requireObject(event, "journal entry");
  if (!JOURNAL_TYPES.has(event.type)) throw projectionError("Unknown journal entry type");
  return compact({
    type: event.type, timestamp: safeTime(event.timestamp || event.created_at, true), transaction_id: ref(context, "transaction", event.transaction_id), agent_id: ref(context, "identity", event.agent_id), lease_id: ref(context, "lease", event.lease_id), supersedes_transaction_id: ref(context, "transaction", event.supersedes_transaction_id), revision: safeRevision(event.revision, false), expected_revision: safeRevision(event.expected_revision, false), actual_revision: safeRevision(event.actual_revision, false), changes: Array.isArray(event.changes) ? event.changes.map((item) => projectOperationSummary(item, context)) : undefined, preview_hash: safeHash(event.preview_hash, false), candidate_content_hash: safeHash(event.candidate_content_hash, false), evidence_pack_hash: safeHash(event.evidence_pack_hash, false), artifact_hash: safeHash(event.artifact_hash, false), validation: projectAuditValidation(event.validation), approval: projectApproval(event.approval, context), lease_expires_at: safeTime(event.lease_expires_at, false), no_op: safeBoolean(event.no_op, false), code: event.code ? safeCode(event.code) : undefined, phase: event.phase && /^[a-z_]{1,40}$/.test(event.phase) ? event.phase : undefined, reason: REASONS.has(event.reason) ? event.reason : undefined, outcome: ["committed", "rolled_back", "recovery_required"].includes(event.outcome) ? event.outcome : undefined, pack: event.pack ? projectPack(event.pack, context) : undefined,
  });
}

export function projectAnchor(anchor, context) {
  if (!anchor || typeof anchor !== "object") return anchor === null ? null : undefined;
  return compact({ artifact_hash: safeHash(anchor.artifact_hash, false), evidence_pack_hash: safeHash(anchor.evidence_pack_hash, true), committed_revision: safeRevision(anchor.committed_revision, true), transaction_id: ref(context, "transaction", anchor.transaction_id), form_spec_hash: safeHash(anchor.form_spec_hash, false), preview_hash: safeHash(anchor.preview_hash, false), runtime_hash: safeHash(anchor.runtime_hash, false), validation: anchor.validation && projectPackValidation(anchor.validation), security: anchor.security && projectSecurity(anchor.security), anchored_at: safeTime(anchor.anchored_at, true) });
}

export function projectPackValidation(validation) {
  if (!validation || typeof validation !== "object") throw projectionError("Invalid evidence validation");
  return { status: ["PASS", "FAIL"].includes(validation.status) ? validation.status : "FAIL", pageCount: safeCount(validation.pageCount, true), errorCount: safeCount(validation.errorCount, true) };
}

export function projectSecurity(security) {
  if (!security || typeof security !== "object") throw projectionError("Invalid evidence security");
  return { externalNetwork: safeBoolean(security.externalNetwork), arbitraryJavascript: safeBoolean(security.arbitraryJavascript), status: ["PASS", "FAIL"].includes(security.status) ? security.status : "FAIL" };
}
