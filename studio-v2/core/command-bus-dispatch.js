import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION, STUDIO_VERSION } from "./constants.js";
import { TOOL_CONTRACTS } from "./tool-contracts.js";
import { createProjectScenario, SAMPLE_SCENARIOS } from "./sample-scenarios.js";
import { PRINT_LOCALES } from "./i18n.js";
import { layoutReviewStatus, LAYOUT_REVIEW_CHECKLIST } from "./layout-review.js";
import { executeReviewCommand, REVIEW_COMMANDS } from "./command-bus-review.js";
import { inspectTemplate } from "./template-inspection.js";
import { getFormSpec, listComponents as listFormComponents, findComponent as findFormComponent } from "./form-spec.js";
import { inspectDesignState } from "./design-state.js";
import { getAgentOperationCatalog } from "./operation-catalog.js";
import { diffProjects, previewSourceEdit } from "./operations.js";
import { provenanceError, verifyCurrentRender } from "./render-provenance.js";
import { assertPolicyCommand, filterAgentTransactions } from "./agent-boundary.js";

function transactionHistoryForContext(bus, context) {
  const transactions = filterAgentTransactions(bus.transactionStore.listTransactions(), context);
  if (!context?.agent || context.legacy) {
    return { transactions, auditEvents: bus.transactionStore.listAuditEvents(), entries: bus.transactionJournal.list() };
  }
  const allowed = new Set(transactions.map((transaction) => transaction.transaction_id));
  const owns = (item) => !item.transaction_id || allowed.has(item.transaction_id);
  return {
    transactions,
    auditEvents: bus.transactionStore.listAuditEvents().filter(owns),
    entries: bus.transactionJournal.list().filter(owns),
  };
}

export async function dispatchCommand(bus, name, input = {}, context = null) {
  try {
    bus.assertCurrent?.();
    assertPolicyCommand(name, input, context, bus);
    if (name === "get_capabilities") {
      const capabilities = {
        candidateHash: true,
        candidateRealRender: Boolean(bus.renderCandidate),
        layoutEvidenceReceipts: Boolean(bus.renderCandidate),
        formSpec: true,
        transactions: true,
        persistentAudit: bus.transactionStore.persistent,
        durableTransactions: bus.transactionStore.persistent,
        atomicRevisionCas: bus.hasAtomicRevisionCas(),
        leaseRecovery: true,
      };
      return bus.success({ protocolVersion: PROTOCOL_VERSION, contractVersion: AGENT_CONTRACT_VERSION, studioVersion: STUDIO_VERSION, capabilities, tools: TOOL_CONTRACTS, sampleScenarios: SAMPLE_SCENARIOS, locales: PRINT_LOCALES, humanExportRequired: true, completionPolicy: "AI layout review must pass for the current revision before request_export can be ready" });
    }
    if (name === "get_project_summary") return bus.success({ revision: bus.revision, title: bus.project.manifest.title, locale: bus.project.manifest.locale, trust: bus.project.trust, protocolVersion: bus.project.manifest.protocolVersion, review: layoutReviewStatus(bus.reviewReceipt, bus.revision), validation: bus.validation() });
    if (name === "inspect_document") return bus.success({ revision: bus.revision, ...inspectTemplate(bus.project.templateHtml) });
    if (name === "get_form_spec") return bus.success({ revision: bus.revision, spec: getFormSpec(bus.project) });
    if (name === "list_components") return bus.success({ revision: bus.revision, components: listFormComponents(bus.project) });
    if (name === "get_component") return bus.success({ revision: bus.revision, component: findFormComponent(bus.project, input.componentId) });
    if (name === "inspect_design_state") return bus.success(inspectDesignState({ ...bus.project, revision: bus.revision }));
    if (name === "get_operation_catalog") return bus.success({ revision: bus.revision, operations: getAgentOperationCatalog() });
    if (name === "validate_project") return bus.success({ revision: bus.revision, validation: bus.validation() });
    if (name === "get_layout_review_status") return bus.success({ revision: bus.revision, review: layoutReviewStatus(bus.reviewReceipt, bus.revision), checklist: LAYOUT_REVIEW_CHECKLIST });
    if (REVIEW_COMMANDS.has(name)) return bus.success(await executeReviewCommand(bus, name, input, context));
    if (name === "begin_transaction") return bus.success(bus.beginTransaction(input.baseRevision ?? bus.revision, input.agentId, input.owner, context));
    if (name === "get_transaction") return bus.success({ transaction: bus.getTransaction(input.transactionId, context) });
    if (name === "list_active_transactions") return bus.success({ transactions: bus.listActiveTransactions(context) });
    if (name === "renew_lease") return bus.success(bus.renewLease(input, context));
    if (name === "release_lease") return bus.success(bus.releaseLease(input, context));
    if (name === "takeover_transaction") return bus.success(bus.takeoverTransaction(input, context));
    if (name === "recover_transaction") return bus.success(bus.recoverTransaction(input, context));
    if (name === "resolve_conflict") return bus.success(bus.resolveConflict(input, context));
    if (name === "get_revision") return bus.success(bus.transactionStore.getRevision());
    if (name === "get_audit_events") return bus.success({ events: transactionHistoryForContext(bus, context).auditEvents });
    if (name === "preview_changes") {
      const result = await bus.previewTransaction(input.operations, input.expectedRevision, input.transactionId, context);
      return bus.success({ revision: result.preview.revision, transactionId: result.transaction.transaction_id, diff: result.preview.diff, validation: result.validation, candidateHash: result.transaction.preview_hash });
    }
    if (name === "approve_transaction") {
      return bus.success(bus.approveTransaction(input, context));
    }
    if (name === "apply_changes") {
      if (!input.transactionId) throw Object.assign(new Error("apply_changes requires an approved transaction"), { code: "TRANSACTION_REQUIRED" });
      return bus.success(await bus.applyApprovedTransaction(input, context));
    }
    if (name === "rollback_transaction") {
      return bus.success(bus.rollbackTransaction(input.transactionId, context));
    }
    if (name === "compare_revision") {
      return bus.success(bus.revisionComparison(input.fromRevision, input.toRevision));
    }
    if (name === "get_transaction_history") {
      const history = transactionHistoryForContext(bus, context);
      return bus.success({ revision: bus.revision, entries: history.entries, transactions: history.transactions, auditEvents: history.auditEvents });
    }
    if (name === "get_evidence_pack") return bus.success({ revision: bus.revision, evidencePack: structuredClone(bus.transactionStore.getEvidencePack(bus.revision) || bus.evidencePack), anchor: bus.transactionStore.getEvidenceAnchor(bus.revision) });
    if (name === "preview_source_edit") {
      bus.ensureRevision(input.expectedRevision);
      const candidate = previewSourceEdit(bus.project, input.section, input.content);
      return bus.success({ revision: bus.revision, diff: diffProjects(bus.project, candidate), validation: bus.validation(candidate) });
    }
    if (name === "set_sample_scenario") {
      const result = await bus.commitConvenienceTransaction(
        [{ type: "replace_sample_data", value: createProjectScenario(bus.project, input.scenario, bus.defaultSample) }],
        input.expectedRevision,
        `sample scenario: ${input.scenario}`,
        context,
      );
      return bus.success(result);
    }
    if (name === "set_locale") {
      if (!PRINT_LOCALES.includes(input.locale)) throw Object.assign(new Error(`Unsupported locale: ${input.locale}`), { code: "LOCALE_UNSUPPORTED" });
      const result = await bus.commitConvenienceTransaction(
        [{ type: "set_manifest_value", path: "/locale", value: input.locale }],
        input.expectedRevision,
        `locale: ${input.locale}`,
        context,
      );
      return bus.success({ ...result, locale: input.locale });
    }
    if (name === "set_asset_source") {
      const result = await bus.commitConvenienceTransaction(
        [{ type: "set_asset_slot", slot: input.slot, source: input.source }],
        input.expectedRevision,
        `asset slot: ${input.slot}`,
        context,
      );
      return bus.success({ ...result, slot: input.slot });
    }
    if (name === "undo_revision") {
      return bus.success(await bus.navigateHistory("undo", input.expectedRevision, context));
    }
    if (name === "redo_revision") {
      return bus.success(await bus.navigateHistory("redo", input.expectedRevision, context));
    }
    if (name === "request_export") {
      const validation = bus.readiness();
      if (bus.renderReport?.status === "ready") {
        const currentRender = await verifyCurrentRender(bus.renderReport, bus.project, bus.revision);
        if (!currentRender.ok && !validation.errors.some((item) => item.code === currentRender.code)) {
          validation.valid = false; validation.productionValid = false; validation.errors.push(provenanceError(currentRender));
        }
      }
      return bus.success({ revision: bus.revision, ready: validation.productionValid, validation, requiresUserConfirmation: true });
    }
    throw Object.assign(new Error(`Unknown tool: ${name}`), { code: "UNKNOWN_TOOL" });
  } catch (error) {
    return { ok: false, error: { code: error.code || "COMMAND_FAILED", message: error.message, expectedRevision: error.expectedRevision, actualRevision: error.actualRevision, expectedCandidateHash: error.expectedCandidateHash, actualCandidateHash: error.actualCandidateHash, transactionId: error.transactionId, owner: error.owner, leaseId: error.leaseId, phase: error.phase, validation: error.validation } };
  }
}
