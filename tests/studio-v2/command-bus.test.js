import { describe, expect, it } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { executeAgentCommand } from "../../studio-v2/adapters/gateway.js";
import { hashRenderProject } from "../../studio-v2/core/render-provenance.js";
import { createRedactedLayoutSnapshot } from "../../studio-v2/ui/layout-snapshot.js";
import { AGENT_CONTRACT_VERSION, STUDIO_VERSION } from "../../studio-v2/core/constants.js";
import { approveAndApply } from "./transaction-test-helpers.js";

describe("PrintForm Studio v2 command bus", () => {
  it("previews atomically, makes duplicate Apply idempotent, and rejects mismatched revisions", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const operations = [{ type: "set_manifest_value", path: "/title", value: "Revised invoice" }];
    const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations });
    expect(preview.ok).toBe(true);
    expect(bus.revision).toBe(0);
    const applied = await approveAndApply(bus, preview);
    expect(applied.result.revision).toBe(1);
    expect(bus.project.manifest.title).toBe("Revised invoice");
    const duplicate = await bus.execute("apply_changes", { expectedRevision: 0, transactionId: preview.result.transactionId, expectedCandidateHash: preview.result.candidateHash });
    expect(duplicate.ok).toBe(true);
    expect(duplicate.result.already_committed).toBe(true);
    expect(duplicate.result.committed_revision).toBe(1);
    const mismatched = await bus.execute("apply_changes", { expectedRevision: 1, transactionId: preview.result.transactionId, expectedCandidateHash: preview.result.candidateHash });
    expect(mismatched.error.code).toBe("REVISION_CONFLICT");
  });

  it("surfaces a stable INVALID_OPERATION_SHAPE error during preview, leaving the draft untouched", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const result = await bus.execute("preview_changes", {
      expectedRevision: 0,
      operations: [{ type: "set_manifest_value", path: "/title", value: "x", notAField: true }]
    });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("INVALID_OPERATION_SHAPE");
    expect(bus.revision).toBe(0);
  });

  it("never exposes sample row values in summary or inspection", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const summary = await bus.execute("get_project_summary");
    const inspection = await bus.execute("inspect_document");
    expect(JSON.stringify(summary)).not.toContain("USB-C Docking Station");
    expect(JSON.stringify(inspection)).not.toContain("Example Business");
  });

  it("supports generated boundary samples and undo", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const changed = await bus.execute("set_sample_scenario", { expectedRevision: 0, scenario: "500-rows" });
    expect(changed.ok).toBe(true);
    expect(bus.project.sampleData.items).toHaveLength(500);
    await bus.execute("undo_revision", { expectedRevision: 1 });
    expect(bus.project.sampleData.items).toHaveLength(45);
    expect(bus.historyState()).toEqual({ revision: 2, canUndo: false, canRedo: true });
    const redone = await bus.execute("redo_revision", { expectedRevision: 2 });
    expect(redone.ok).toBe(true);
    expect(redone.result.revision).toBe(3);
    expect(bus.project.sampleData.items).toHaveLength(500);
  });

  it("keeps redo read-only for an untrusted project", async () => {
    const project = createSalesInvoiceProject();
    project.trust = "untrusted";
    const bus = new CommandBus(project);
    await bus.execute("set_sample_scenario", { expectedRevision: 0, scenario: "one" });
    await bus.execute("undo_revision", { expectedRevision: 1 });
    const result = await executeAgentCommand(bus, "redo_revision", { expectedRevision: 2 });
    expect(result.error.code).toBe("UNTRUSTED_READ_ONLY");
    expect(bus.revision).toBe(2);
  });

  it("builds every scenario from the immutable default sample", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    expect((await bus.execute("set_sample_scenario", { expectedRevision: 0, scenario: "empty" })).result.validation.valid).toBe(false);
    const one = await bus.execute("set_sample_scenario", { expectedRevision: 1, scenario: "one" });
    expect(one.ok).toBe(true);
    expect(bus.project.sampleData.totals).toEqual(bus.defaultSample.totals);
    expect(bus.project.sampleData.items).toHaveLength(1);
    expect(bus.project.sampleData.items[0]).toHaveProperty("unitPrice");
  });

  it("keeps agent mutations read-only for untrusted projects", async () => {
    const project = createSalesInvoiceProject();
    project.trust = "untrusted";
    const bus = new CommandBus(project);
    const result = await executeAgentCommand(bus, "apply_changes", { expectedRevision: 0, operations: [{ type: "set_manifest_value", path: "/title", value: "blocked" }] });
    expect(result.error.code).toBe("UNTRUSTED_READ_ONLY");
    expect(bus.revision).toBe(0);
  });

  it("does not bump the revision (or void a passing layout review) when re-selecting the same scenario", async () => {
    // Regression: set_sample_scenario used to commit unconditionally, so
    // re-picking the scenario already active was a no-op edit that still
    // cleared renderReport/reviewReceipt — silently burning one of the
    // three-attempt layout review budget for zero content change.
    const bus = new CommandBus(createSalesInvoiceProject());
    const first = await bus.execute("set_sample_scenario", { expectedRevision: 0, scenario: "one" });
    expect(first.result.revision).toBe(1);
    const again = await bus.execute("set_sample_scenario", { expectedRevision: 1, scenario: "one" });
    expect(again.ok).toBe(true);
    expect(again.result.revision).toBe(1);
    expect(bus.revision).toBe(1);
  });

  it("declares render, FormSpec and transaction capabilities", async () => {
    const withoutRenderer = await new CommandBus(createSalesInvoiceProject()).execute("get_capabilities");
    expect(withoutRenderer.result.contractVersion).toBe(AGENT_CONTRACT_VERSION);
    expect(withoutRenderer.result.studioVersion).toBe(STUDIO_VERSION);
    expect(withoutRenderer.result.capabilities).toEqual({ candidateHash: true, candidateRealRender: false, layoutEvidenceReceipts: false, formSpec: true, transactions: true, persistentAudit: false, durableTransactions: false, atomicRevisionCas: false, leaseRecovery: true });

    const withRenderer = await new CommandBus(createSalesInvoiceProject(), { renderCandidate: async () => ({ status: "ready", validation: { errors: [], warnings: [] }, issues: [], metrics: {} }) }).execute("get_capabilities");
    expect(withRenderer.result.capabilities).toEqual({ candidateHash: true, candidateRealRender: true, layoutEvidenceReceipts: true, formSpec: true, transactions: true, persistentAudit: false, durableTransactions: false, atomicRevisionCas: false, leaseRecovery: true });
  });

  it("falls back to static-only validation for a preview transaction when no renderCandidate is injected", async () => {
    // The default constructor path (every existing unit test, the CLI
    // validator) must behave exactly as before P0-A #12: no DOM, no real
    // render, no candidateHash — just schema/business-rule validation.
    const bus = new CommandBus(createSalesInvoiceProject());
    const operations = [{ type: "set_manifest_value", path: "/title", value: "No renderer" }];
    const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations });
    expect(preview.ok).toBe(true);
    expect(preview.result.candidateHash).toBeNull();
    const applied = await approveAndApply(bus, preview);
    expect(applied.result.candidateHash).toBeNull();
    expect(applied.result.revision).toBe(1);
  });

  it("merges a real render report into preview_changes validation via an injected renderCandidate", async () => {
    const calls = [];
    const renderCandidate = async (candidate, revision) => {
      calls.push({ title: candidate.manifest.title, revision });
      return { status: "blocked", validation: { errors: [{ code: "HORIZONTAL_OVERFLOW", path: "/", message: "row too wide" }], warnings: [] }, issues: [{ code: "HORIZONTAL_OVERFLOW", pageIndex: 0 }], metrics: { logicalPages: 9 } };
    };
    const bus = new CommandBus(createSalesInvoiceProject(), { renderCandidate });
    const operations = [{ type: "set_manifest_value", path: "/title", value: "Wide layout" }];
    const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations });
    expect(preview.ok).toBe(true);
    expect(preview.result.validation.valid).toBe(false);
    expect(preview.result.validation.errors.some((item) => item.code === "HORIZONTAL_OVERFLOW")).toBe(true);
    expect(preview.result.validation.metrics.logicalPages).toBe(9);
    expect(preview.result.validation.issues).toHaveLength(1);
    expect(preview.result.candidateHash).toEqual(expect.any(String));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ title: "Wide layout", revision: 0 });
    // The static candidate diff/validation was never committed — apply_changes
    // and the injected renderer were never invoked by preview_changes alone.
    expect(bus.revision).toBe(0);
  });

  it("reuses the cached candidate report by hash instead of re-rendering on apply_changes after an identical preview_changes", async () => {
    let renderCount = 0;
    const renderCandidate = async () => {
      renderCount += 1;
      return { status: "ready", validation: { errors: [], warnings: [] }, issues: [], metrics: { logicalPages: 3 } };
    };
    const bus = new CommandBus(createSalesInvoiceProject(), { renderCandidate });
    const operations = [{ type: "set_manifest_value", path: "/title", value: "Cached path" }];
    const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations });
    expect(renderCount).toBe(1);
    const applied = await approveAndApply(bus, preview);
    expect(applied.ok).toBe(true);
    expect(applied.result.candidateHash).toBe(preview.result.candidateHash);
    expect(applied.result.validation.metrics.logicalPages).toBe(3);
    // Same candidate content (same operations against the same base revision)
    // hashes identically, so the second call must hit the cache, not render again.
    expect(renderCount).toBe(1);
  });

  it("rejects apply_changes without a prior approved preview", async () => {
    let renderCount = 0;
    const renderCandidate = async () => { renderCount += 1; return { status: "ready", validation: { errors: [], warnings: [] }, issues: [], metrics: { logicalPages: 1 } }; };
    const bus = new CommandBus(createSalesInvoiceProject(), { renderCandidate });
    const applied = await bus.execute("apply_changes", { expectedRevision: 0, expectedCandidateHash: null });
    expect(applied.ok).toBe(false);
    expect(applied.error.code).toBe("TRANSACTION_REQUIRED");
    expect(renderCount).toBe(0);
  });

  it("turns a rejected renderCandidate into a RENDER_FAILED error instead of throwing, and still lets the caller decide whether to commit", async () => {
    const renderCandidate = async () => { throw new Error("iframe render timed out"); };
    const bus = new CommandBus(createSalesInvoiceProject(), { renderCandidate });
    const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_manifest_value", path: "/title", value: "Will fail render" }] });
    expect(preview.ok).toBe(true);
    expect(preview.result.validation.valid).toBe(false);
    expect(preview.result.validation.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "RENDER_FAILED" })]));
  });

  it("commits a no-op transaction without advancing the revision", async () => {
    let renderCount = 0;
    const renderCandidate = async () => { renderCount += 1; return { status: "ready", validation: { errors: [], warnings: [] }, issues: [], metrics: {} }; };
    const bus = new CommandBus(createSalesInvoiceProject(), { renderCandidate });
    const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_manifest_value", path: "/title", value: bus.project.manifest.title }] });
    const result = await approveAndApply(bus, preview);
    expect(result.ok).toBe(true);
    expect(result.result.diff.changed).toBe(false);
    expect(bus.revision).toBe(0);
    expect(renderCount).toBe(1);
  });

  it("requires the current browser layout report before production export", async () => {
    const report = { status: "ready", validation: { errors: [], warnings: [] }, metrics: { logicalPages: 1 }, pageGeometry: [{ width: 794, height: 1123, children: [] }] };
    const ready = { ...report, safeSnapshot: createRedactedLayoutSnapshot(report) };
    const bus = new CommandBus(createSalesInvoiceProject(), { renderCandidate: async () => ready });
    let request = await bus.execute("request_export");
    expect(request.result.ready).toBe(false);
    expect(request.result.validation.errors.some((item) => item.code === "PREVIEW_REQUIRED")).toBe(true);
    const projectHash = await hashRenderProject(bus.project);
    bus.recordRenderReport(ready, { revision: bus.revision, candidateHash: projectHash, baseProjectHash: projectHash, source: "committed" });
    const evidenceIds = [];
    for (const scenario of ["default", "long-text"]) {
      const captured = await bus.execute("capture_layout_evidence", { expectedRevision: 0, scenario });
      evidenceIds.push(captured.result.evidence.evidenceId);
    }
    await bus.execute("begin_layout_review", { expectedRevision: 0 });
    const review = await bus.execute("complete_layout_review", {
      expectedRevision: 0, reviewer: "ai-agent", evidenceIds, findings: [], summary: "No visual issues"
    });
    expect(review.ok).toBe(true);
    request = await bus.execute("request_export");
    expect(request.result.ready).toBe(true);
    expect(request.result.validation.metrics.logicalPages).toBe(1);
  });
});
