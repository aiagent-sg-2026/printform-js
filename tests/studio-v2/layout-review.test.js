import { describe, expect, it } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { hashRenderProject } from "../../studio-v2/core/render-provenance.js";
import { createRedactedLayoutSnapshot } from "../../studio-v2/ui/layout-snapshot.js";
import { approveAndApply } from "./transaction-test-helpers.js";

const readyMetrics = { logicalPages: 1, overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 };
const readyReport = { status: "ready", validation: { errors: [], warnings: [] }, metrics: readyMetrics };
const review = { expectedRevision: 0, reviewer: "ai-agent", findings: [], summary: "Hierarchy, pagination, logos and totals reviewed" };

// Stands in for the real preview iframe: returns a ready report whose
// geometry differs per scenario, so receipts for default vs long-text get
// genuinely different fingerprints.
function renderCandidateStub(project) {
  const rows = project.sampleData.items?.length || 0;
  const report = {
    ...readyReport,
    pageGeometry: [{ pageIndex: 0, width: 794, height: 1123, children: [{ className: "pheader_processed", x: 0, y: 0, width: 794, height: 80 + rows }] }]
  };
  return Promise.resolve({ ...report, safeSnapshot: createRedactedLayoutSnapshot(report) });
}

function busWithEvidence() {
  return new CommandBus(createSalesInvoiceProject(), { renderCandidate: renderCandidateStub });
}

async function recordCommitted(bus) {
  const projectHash = await hashRenderProject(bus.project);
  bus.recordRenderReport(readyReport, { revision: bus.revision, candidateHash: projectHash, baseProjectHash: projectHash, source: "committed" });
}

async function captureBoth(bus) {
  const receipts = [];
  for (const scenario of ["default", "long-text"]) {
    const result = await bus.execute("capture_layout_evidence", { expectedRevision: bus.revision, scenario });
    receipts.push(result.result.evidence);
  }
  return receipts.map((receipt) => receipt.evidenceId);
}

describe("revision-bound AI layout review", () => {
  it("passes with Studio-issued evidence and becomes stale after a change", async () => {
    const bus = busWithEvidence();
    await recordCommitted(bus);
    expect((await bus.execute("request_export")).result.ready).toBe(false);
    const evidenceIds = await captureBoth(bus);
    await bus.execute("begin_layout_review", { expectedRevision: 0 });
    expect((await bus.execute("complete_layout_review", { ...review, evidenceIds })).ok).toBe(true);
    expect((await bus.execute("request_export")).result.ready).toBe(true);
    const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_manifest_value", path: "/title", value: "Changed" }] });
    await approveAndApply(bus, preview);
    expect((await bus.execute("request_export")).result.validation.errors).toContainEqual(expect.objectContaining({ code: "LAYOUT_REVIEW_REQUIRED" }));
  });

  it("rejects open major findings", async () => {
    const bus = busWithEvidence();
    await recordCommitted(bus);
    const evidenceIds = await captureBoth(bus);
    await bus.execute("begin_layout_review", { expectedRevision: 0 });
    const result = await bus.execute("complete_layout_review", { ...review, evidenceIds, findings: [{ code: "SPARSE_PAGE", severity: "major", status: "open", message: "Totals are isolated" }] });
    expect(result.error.code).toBe("REVIEW_ISSUES_OPEN");
  });

  it("rejects a self-declared fixed major finding without fresh clean evidence", async () => {
    const bus = busWithEvidence();
    await recordCommitted(bus);
    const evidenceIds = await captureBoth(bus);
    await bus.execute("begin_layout_review", { expectedRevision: 0 });
    const result = await bus.execute("complete_layout_review", {
      ...review, evidenceIds,
      findings: [{ code: "SPARSE_PAGE", severity: "major", status: "fixed", message: "Claimed fixed" }]
    });
    expect(result.error.code).toBe("REVIEW_ISSUES_OPEN");
  });

  it("rejects the Agent Contract 1.x self-declared evidence labels outright", async () => {
    // The whole point of #18: an agent must not be able to assert it looked
    // at screenshots. Accepting these alongside receipts would leave the
    // bypass open, so they are refused even when valid receipts also exist.
    const bus = busWithEvidence();
    await recordCommitted(bus);
    const evidenceIds = await captureBoth(bus);
    await bus.execute("begin_layout_review", { expectedRevision: 0 });
    const result = await bus.execute("complete_layout_review", {
      ...review, evidenceIds,
      browser: "Chromium 150", scenarios: ["default", "long-text"], evidence: ["full-page-screenshot", "layout-metrics"]
    });
    expect(result.error.code).toBe("EVIDENCE_RECEIPT_REQUIRED");
  });

  it("rejects an evidenceId this Studio session never issued", async () => {
    const bus = busWithEvidence();
    await recordCommitted(bus);
    const evidenceIds = await captureBoth(bus);
    await bus.execute("begin_layout_review", { expectedRevision: 0 });
    const result = await bus.execute("complete_layout_review", { ...review, evidenceIds: [...evidenceIds, "forged-evidence-id"] });
    expect(result.error.code).toBe("EVIDENCE_UNKNOWN");
  });

  it("requires evidence for both default and long-text", async () => {
    const bus = busWithEvidence();
    await recordCommitted(bus);
    const only = await bus.execute("capture_layout_evidence", { expectedRevision: 0, scenario: "default" });
    await bus.execute("begin_layout_review", { expectedRevision: 0 });
    const result = await bus.execute("complete_layout_review", { ...review, evidenceIds: [only.result.evidence.evidenceId] });
    expect(result.error.code).toBe("REVIEW_SCENARIOS_REQUIRED");
    expect(result.error.message).toContain("long-text");
  });

  it("invalidates issued receipts as soon as the draft mutates", async () => {
    const bus = busWithEvidence();
    await recordCommitted(bus);
    const evidenceIds = await captureBoth(bus);
    const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_manifest_value", path: "/title", value: "Changed" }] });
    await approveAndApply(bus, preview);
    await recordCommitted(bus);
    await bus.execute("begin_layout_review", { expectedRevision: 1 });
    const result = await bus.execute("complete_layout_review", { ...review, expectedRevision: 1, evidenceIds });
    // Cleared by commit, so the old ids no longer resolve at all.
    expect(result.error.code).toBe("EVIDENCE_UNKNOWN");
  });

  it("signs distinct fingerprints per scenario and reports which scenarios are covered", async () => {
    const bus = busWithEvidence();
    const first = await bus.execute("capture_layout_evidence", { expectedRevision: 0, scenario: "default" });
    const second = await bus.execute("capture_layout_evidence", { expectedRevision: 0, scenario: "long-text" });
    expect(first.result.evidence.layoutFingerprint).toEqual(expect.any(String));
    expect(first.result.evidence.renderReportHash).toEqual(expect.any(String));
    expect(first.result.evidence.revision).toBe(0);
    expect(first.result.evidence.browser).toHaveProperty("name");
    expect(second.result.capturedScenarios.sort()).toEqual(["default", "long-text"]);
    expect(second.result.requiredScenarios).toEqual(["default", "long-text"]);
  });

  it("issues no receipt when the scenario does not render cleanly, but returns why", async () => {
    const blocked = { status: "blocked", validation: { valid: false, errors: [{ code: "VERTICAL_OVERFLOW", path: "/", message: "page 2 overflows" }], warnings: [] }, metrics: readyMetrics, pageGeometry: [] };
    const bus = new CommandBus(createSalesInvoiceProject(), { renderCandidate: async () => blocked });
    const result = await bus.execute("capture_layout_evidence", { expectedRevision: 0, scenario: "long-text" });
    expect(result.ok).toBe(true);
    expect(result.result.evidence).toBeNull();
    expect(result.result.validation).toMatchObject({ valid: false, productionValid: false });
    expect(result.result.validation.errors).toContainEqual(expect.objectContaining({ code: "VERTICAL_OVERFLOW" }));
    expect(bus.evidenceReceipts.size).toBe(0);
  });

  it("fails closed with EVIDENCE_UNAVAILABLE when the session cannot render at all", async () => {
    // CLI validator / unit-test context: no DOM, so no honest evidence can
    // exist. Never fabricate a receipt — that would forge the very proof the
    // export gate depends on.
    const bus = new CommandBus(createSalesInvoiceProject());
    const result = await bus.execute("capture_layout_evidence", { expectedRevision: 0, scenario: "default" });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("EVIDENCE_UNAVAILABLE");
  });

  it("does not advance the revision while capturing scenario evidence", async () => {
    // long-text evidence must not be captured by committing a scenario
    // switch: that would bump the revision and void the default receipt.
    const bus = busWithEvidence();
    await captureBoth(bus);
    expect(bus.revision).toBe(0);
    expect(bus.project.sampleData.items).toHaveLength(45);
  });

  it("builds default and long-text evidence from the current draft sample", async () => {
    const project = createSalesInvoiceProject();
    project.sampleData.items = project.sampleData.items.slice(0, 1);
    const observed = [];
    const bus = new CommandBus(project, { renderCandidate: async (candidate) => {
      observed.push(candidate.sampleData.items.length);
      return renderCandidateStub(candidate);
    } });
    const defaultEvidence = await bus.execute("capture_layout_evidence", { expectedRevision: 0, scenario: "default" });
    const longEvidence = await bus.execute("capture_layout_evidence", { expectedRevision: 0, scenario: "long-text" });
    expect(observed).toEqual([1, 1]);
    expect(defaultEvidence.result.evidence.candidateHash).toBe(defaultEvidence.result.evidence.baseProjectHash);
    expect(longEvidence.result.evidence.baseProjectHash).toBe(defaultEvidence.result.evidence.baseProjectHash);
  });

  it("fails closed when the committed render provenance no longer matches the draft", async () => {
    const bus = busWithEvidence();
    await recordCommitted(bus);
    bus.project.sampleData.items = bus.project.sampleData.items.slice(0, 1);
    const result = await bus.execute("request_export");
    expect(result.ok).toBe(true);
    expect(result.result.ready).toBe(false);
    expect(result.result.validation.errors).toContainEqual(expect.objectContaining({ code: "RENDER_PROVENANCE_STALE" }));
    expect(bus.revision).toBe(0);
  });
});
