import { describe, expect, it } from "vitest";
import { validateData } from "../../studio-v2/core/schema.js";
import { getOperationCatalog } from "../../studio-v2/core/operation-catalog.js";
import { inspectDesignState } from "../../studio-v2/core/design-state.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { executeAgentCommand } from "../../studio-v2/adapters/gateway.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { VAULT_POLICY } from "../../studio-v2/ui/agent-vault.js";
import { inspectColumnGroups } from "../../studio-v2/core/column-inspection.js";
import { buildRuntimeBudget, validateProviderProfile } from "../../studio-v2/ui/agent-provider.js";
import { TOOL_CONTRACTS } from "../../studio-v2/core/tool-contracts.js";
import { approveAndApply } from "./transaction-test-helpers.js";

describe("AI Designer contract and safety boundary", () => {
  it("publishes the safe semantic operation schemas and examples from one validator SSOT", () => {
    const catalog = getOperationCatalog();
    expect(catalog).toHaveLength(7);
    catalog.forEach((entry) => expect(validateData(entry.inputSchema, entry.example).valid, entry.type).toBe(true));
    expect(new Set(catalog.map((entry) => entry.type)).size).toBe(7);
    const preview = TOOL_CONTRACTS.find((tool) => tool.name === "preview_changes");
    const schemas = preview.inputSchema.properties.operations.items.oneOf;
    expect(schemas).toHaveLength(7);
    expect(new Set(schemas.map((schema) => schema.properties.type.const)).size).toBe(7);
    expect(TOOL_CONTRACTS.find((tool) => tool.name === "apply_changes").inputSchema.properties.operations).toBeUndefined();
  });

  it("accepts optional binding patches and still rejects unknown component binding properties", () => {
    const {inputSchema}=getOperationCatalog().find(entry=>entry.type==="update_component");
    const operation={type:"update_component",componentId:"document-header",patch:{binding:{text:"/title"}}};
    expect(validateData(inputSchema,operation).valid).toBe(true);
    expect(validateData(inputSchema,{...operation,patch:{binding:{unexpected:"/title"}}}).errors).toContainEqual(expect.objectContaining({code:"ADDITIONAL_PROPERTY",path:"/patch/binding/unexpected"}));
  });

  it("returns safe design state without sample values or asset sources", () => {
    const project = createSalesInvoiceProject();
    const state = inspectDesignState({ ...project, revision: 4 });
    const serialized = JSON.stringify(state);
    expect(state.revision).toBe(4);
    expect(state.supportedOperations).toHaveLength(7);
    expect(serialized).not.toContain("USB-C Docking Station");
    expect(serialized).not.toContain("data:image/");
    expect(serialized).not.toContain("Example Business");
    expect(state.assets).toEqual(expect.arrayContaining([expect.objectContaining({ slot: "letterhead-logo", configured: true })]));
  });

  it("redacts business values, rendered text and raw validation messages at the agent gateway", async () => {
    const project = createSalesInvoiceProject();
    project.sampleData.items[0].lineTotal = 987654.32;
    const response = await executeAgentCommand(new CommandBus(project), "validate_project", {});
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("987654.32");
    expect(serialized).not.toContain("Line total must equal");
    expect(response.result.validation.errors[0]).not.toHaveProperty("message");
  });

  it("pins approved candidates and rejects invalid candidates without changing revision", async () => {
    const renderer = async () => ({ status: "ready", validation: { errors: [], warnings: [] }, issues: [], metrics: {} });
    const bus = new CommandBus(createSalesInvoiceProject(), { renderCandidate: renderer });
    const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#123456" }] });
    const mismatch = await bus.execute("approve_transaction", { expectedRevision: 0, transactionId: preview.result.transactionId, expectedCandidateHash: "sha256:not-the-preview", requireValid: true });
    expect(mismatch.error.code).toBe("CANDIDATE_HASH_MISMATCH");
    expect(bus.revision).toBe(0);
    const invalidPreview = await bus.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "replace_template", value: "<div></div>" }] });
    const invalid = await bus.execute("approve_transaction", { expectedRevision: 0, transactionId: invalidPreview.result.transactionId, expectedCandidateHash: invalidPreview.result.candidateHash, requireValid: true });
    expect(invalid.error.code).toBe("CANDIDATE_INVALID");
    expect(bus.revision).toBe(0);
  });

  it("rejects direct apply when the preview transaction is missing", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const result = await bus.execute("apply_changes", { expectedRevision: 0, expectedCandidateHash: null });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("TRANSACTION_REQUIRED");
    expect(bus.revision).toBe(0);
  });

  it("previews and applies every catalog operation through the real command bus", async () => {
    const project = createSalesInvoiceProject();
    const template = document.createElement("template");
    template.innerHTML = project.templateHtml;
    const logo = template.content.querySelector('[data-pf-asset-slot="letterhead-logo"]');
    const columns = inspectColumnGroups(project.templateHtml, project)[0];
    const bus = new CommandBus(project);
    const components = (await bus.execute("list_components")).result.components;
    const header = components.find((component) => component.type === "DocumentHeader") || components[0];
    const tableHeader = components.find((component) => component.role === "table-header") || header;
    const operations = [
      { type: "set_asset_slot", slot: "letterhead-logo", source: logo.getAttribute("src") },
      { type: "set_column_widths", tableSelector: columns.tableSelector, widths: columns.columns.map((column) => column.width || "auto") },
      { type: "set_font_scale", basePt: 9.5 },
      { type: "set_brand_color", hex: "#123456" },
      { type: "update_component", componentId: header.id, patch: { keepTogether: true } },
      { type: "bind_field", componentId: header.id, bindingType: "text", pointer: "/title" },
      { type: "set_pagination_rule", componentId: tableHeader.id, rule: "repeatHeader", value: true }
    ];
    for (const operation of operations) {
      const expectedRevision = bus.revision;
      const preview = await bus.execute("preview_changes", { expectedRevision, operations: [operation] });
      expect(preview.ok, operation.type).toBe(true);
      const applied = await approveAndApply(bus, preview);
      expect(applied.ok, operation.type).toBe(true);
    }
  });

  it("publishes the browser vault policy without exposing a credential field", () => {
    expect(VAULT_POLICY).toMatchObject({ pbkdf2Iterations: 600000, saltBytes: 16, ivBytes: 12, minPassphraseLength: 12 });
    expect(JSON.stringify(VAULT_POLICY)).not.toContain("apiKey");
  });

  it("enables the USD cap only when both model prices are supplied", () => {
    const base = { provider: "openai", model: "gpt-smoke", apiKey: "memory-only" };
    expect(buildRuntimeBudget(base)).toMatchObject({ priced: false, maxCostUsd: undefined });
    const priced = { ...base, inputPricePer1M: "0.15", outputPricePer1M: "0.60", maxCostUsd: "2" };
    expect(buildRuntimeBudget(priced)).toMatchObject({ priced: true, maxCostUsd: 2, costPricing: { "openai:gpt-smoke": { input: 0.15, output: 0.6, per: 1000000, currency: "USD" } } });
    expect(validateProviderProfile({ ...base, inputPricePer1M: "0.15" })).toContain("both input and output");
    expect(validateProviderProfile({ ...priced, maxCostUsd: "0" })).toContain("greater than zero");
  });
});
