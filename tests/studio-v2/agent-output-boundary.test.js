import { describe, expect, it } from "vitest";
import { createAgentContext } from "../../studio-v2/core/agent-context.js";
import { sanitizeAgentResponse, sanitizeAgentResult } from "../../studio-v2/core/agent-sanitize.js";
import { inspectTemplate } from "../../studio-v2/core/template-inspection.js";

const CANARY = "BUSINESS LABEL CANARY";
const NOW = "2026-09-08T00:00:00.000Z";
const HASH = "sha256:0123456789abcdef0123456789abcdef";

function context() {
  return createAgentContext({ sessionId: "projection-boundary" });
}

function transaction() {
  return {
    transaction_id: "transaction-1",
    form_id: "form-1",
    base_revision: 0,
    working_revision: 1,
    owner: "owner-1",
    agent_id: "agent-1",
    status: "approved",
    state: "approved",
    patches: [{ type: "set_manifest_value", path: "/title", value: CANARY }],
    changes: [{ type: "set_manifest_value", path: "/title", value: CANARY }],
    preview_hash: HASH,
    candidate_content_hash: HASH,
    candidate_form_spec_hash: HASH,
    validation_result: { valid: true, productionValid: true, errors: [], warnings: [] },
    approval: { actor: "owner-1", approved_at: NOW, preview_hash: HASH },
    lease: null,
    created_at: NOW,
    updated_at: NOW,
    previewed_at: NOW,
    approved_at: NOW,
    committed_at: null,
    rolled_back_at: null,
    expired_at: null,
    commit_result: null,
    evidence_pack_ref: null,
    conflict: null,
    supersedes_transaction_id: null,
    project: { secret: CANARY },
    candidate_report: { secret: CANARY },
  };
}

describe("Studio v2 Agent output boundary", () => {
  it("projects direct transactions and all history arrays without internal payloads", () => {
    const tx = transaction();
    const direct = sanitizeAgentResult("approve_transaction", tx, { context: context() });
    expect(direct.transaction_id).toMatch(/^ref:transaction:/);
    expect(direct).not.toHaveProperty("project");
    expect(direct).not.toHaveProperty("candidate_report");

    const history = sanitizeAgentResult("get_transaction_history", {
      revision: 1,
      entries: [{
        type: "COMMIT",
        timestamp: NOW,
        transaction_id: tx.transaction_id,
        changes: tx.changes,
        details: { secret: CANARY },
        unknownBoolean: true,
      }],
      transactions: [tx],
      auditEvents: [{
        event_id: "event-1",
        type: "revision_committed",
        timestamp: NOW,
        transaction_id: tx.transaction_id,
        changes: tx.changes,
        details: { secret: CANARY },
      }],
    }, { context: context() });

    expect(history.entries).toHaveLength(1);
    expect(history.transactions).toHaveLength(1);
    expect(history.auditEvents).toHaveLength(1);
    expect(JSON.stringify(history)).not.toContain(CANARY);
    expect(JSON.stringify(history)).not.toContain("unknownBoolean");
    expect(JSON.stringify(history)).not.toContain("candidate_report");
  });

  it("keeps undo metadata-only, preserves FormSpec structure, and neutralizes labels", () => {
    const undo = sanitizeAgentResult("undo_revision", { changed: true, revision: 2, project: { secret: CANARY } }, { context: context() });
    expect(undo).toEqual({ changed: true, revision: 2 });

    const formSpec = sanitizeAgentResult("get_form_spec", {
      revision: 0,
      spec: {
        version: "1.0.0",
        mode: "canonical",
        document: { type: CANARY, paper: "A4", orientation: "portrait", extension: { secret: CANARY } },
        sections: [{ id: "section-1", componentIds: ["component-1"], title: CANARY, extension: { secret: CANARY } }],
        components: [{ id: "component-1", type: "DataTable", role: "table-header", tableId: "table-1", sourceSelector: ".secret", label: CANARY, extension: { secret: CANARY } }],
        pagination: { repeatDocumentHeader: true, repeatTableHeader: true, footer: true, pageNumbers: true, keepTogether: ["component-1"], extension: { secret: CANARY } },
        tokens: { secret: CANARY },
        extensions: { secret: CANARY },
      },
    }, { context: context() });
    expect(formSpec.spec.document).toEqual({ paper: "A4", orientation: "portrait" });
    expect(formSpec.spec.components[0]).not.toHaveProperty("label");
    expect(JSON.stringify(formSpec)).not.toContain(CANARY);

    const design = sanitizeAgentResult("inspect_design_state", {
      revision: 0,
      page: { width: 794, height: 1123 },
      typography: { basePt: 10 },
      branding: { primaryColor: "#123456", label: CANARY },
      tables: [{ tableSelector: ".secret", columns: [{ label: CANARY, width: "10%" }] }],
      repeatedAreas: { header: true, unexpected: true },
      assets: [{ slot: "logo", configured: false }],
    }, { context: context() });
    expect(design.tables[0].columns[0].label).toBe("Column 1");
    expect(design.repeatedAreas).not.toHaveProperty("unexpected");
    expect(JSON.stringify(design)).not.toContain(CANARY);
  });

  it.each(["/identifiers/private-code", "./private-code"])("projects barcode paths as stable opaque refs: %s", (pointer) => {
    const ctx = context();
    const rawValue = "00012345-PRIVATE-BARCODE";
    const component = {
      id: "barcode-component", type: "DocumentMeta",
      binding: { barcode: pointer, barcodeValue: rawValue, privateSource: CANARY },
      value: rawValue, sampleData: { privateSource: CANARY },
    };
    const single = sanitizeAgentResult("get_component", { revision: 0, component }, { context: ctx });
    const listed = sanitizeAgentResult("list_components", { revision: 0, components: [component] }, { context: ctx });
    const form = sanitizeAgentResult("get_form_spec", {
      revision: 0, spec: {
        version: "1.0.0", mode: "canonical", document: { paper: "A4", orientation: "portrait" },
        sections: [{ id: "section-1", componentIds: [component.id] }], components: [component],
      },
    }, { context: ctx });
    const inspection = sanitizeAgentResult("inspect_document", {
      revision: 0,
      ...inspectTemplate(`<span data-pf-barcode="${pointer}">${rawValue}</span>`),
      sampleData: { privateSource: CANARY },
    }, { context: ctx });
    const opaque = single.component.binding.barcode;
    expect(opaque).toMatch(/^ref:path:/);
    expect(ctx.references.resolve("path", opaque)).toBe(pointer);
    expect(single.component.binding).toEqual({ barcode: opaque });
    expect(listed.components[0].binding).toEqual({ barcode: opaque });
    expect(form.spec.components[0].binding).toEqual({ barcode: opaque });
    expect(inspection.bindings[0].barcode).toBe(opaque);
    const serialized = JSON.stringify([single, listed, form, inspection]);
    for (const secret of [pointer, rawValue, CANARY, "barcodeValue", "privateSource", "sampleData"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("does not fabricate reviewedRevision and rejects malformed envelopes safely", () => {
    const validation = sanitizeAgentResult("validate_project", {
      revision: 4,
      validation: { valid: true, productionValid: true, errors: [], warnings: [], reviewReceipt: { status: "pass", revision: 9 } },
    }, { context: context() });
    expect(validation.validation.reviewReceipt.reviewedRevision).toBeNull();

    const summary = sanitizeAgentResult("get_project_summary", {
      revision: 4,
      locale: "en-MY",
      trust: "trusted",
      protocolVersion: "2.0.0",
      review: { status: "pass", revision: 9 },
      validation: { valid: true, productionValid: true, errors: [], warnings: [] },
    }, { context: context() });
    expect(summary.review.reviewedRevision).toBeNull();

    expect(sanitizeAgentResponse("get_revision", { ok: "true", result: {} })).toMatchObject({ ok: false, error: { code: "AGENT_OUTPUT_INVALID" } });
    expect(sanitizeAgentResponse("get_revision", { ok: false, error: null })).toMatchObject({ ok: false, error: { code: "COMMAND_FAILED", message: "Command failed" } });
  });

  it("preserves the current readiness diagnostics through the public projection", () => {
    const exportResult = sanitizeAgentResult("request_export", {
      revision: 0,
      ready: false,
      requiresUserConfirmation: true,
      validation: {
        valid: false,
        productionValid: false,
        errors: [
          { code: "PREVIEW_REQUIRED", path: "/", severity: "error" },
          { code: "LAYOUT_REVIEW_REQUIRED", path: "/review", severity: "error" },
        ],
        warnings: [],
      },
    }, { context: context() });

    expect(exportResult.validation.errors.map((item) => item.code)).toEqual([
      "PREVIEW_REQUIRED", "LAYOUT_REVIEW_REQUIRED"
    ]);
  });

  it("fails closed when required output arrays have the wrong type", () => {
    expect(sanitizeAgentResponse("get_form_spec", { ok: true, result: {
      revision: 0,
      spec: { version: "1.0.0", mode: "canonical", document: { paper: "A4", orientation: "portrait" }, sections: {}, components: [] }
    }, context: context() })).toMatchObject({ ok: false, error: { code: "AGENT_OUTPUT_INVALID" } });
    expect(sanitizeAgentResponse("list_components", { ok: true, result: { revision: 0, components: {} } }, { context: context() })).toMatchObject({ ok: false, error: { code: "AGENT_OUTPUT_INVALID" } });
    expect(sanitizeAgentResponse("get_transaction_history", { ok: true, result: { revision: 0, entries: [], transactions: [], auditEvents: {} } }, { context: context() })).toMatchObject({ ok: false, error: { code: "AGENT_OUTPUT_INVALID" } });
  });
});
