import { describe, expect, it } from "vitest";
import { applyDataContractEdits, inspectDataContract } from "../../studio-v2/core/data-contract-inspection.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

describe("inspectDataContract", () => {
  it("walks the sales invoice schema into a field tree with real sample values", () => {
    const project = createSalesInvoiceProject();
    const fields = inspectDataContract(project.schema, project.sampleData);
    const byKey = Object.fromEntries(fields.map((field) => [field.key, field]));

    expect(byKey.invoiceNumber).toEqual({
      key: "invoiceNumber", path: "/invoiceNumber", type: "string", required: true,
      constraints: { minLength: 1, maxLength: 60 }, sampleValue: "INV-2026-001234"
    });
    expect(byKey.invoiceDate.constraints).toEqual({ format: "date" });
    expect(byKey.items).toEqual({ key: "items", path: "/items", type: "array", required: true });
    expect(byKey.reference.required).toBe(false);
  });

  it("recurses into nested object fields with their own required set and sample values", () => {
    const project = createSalesInvoiceProject();
    const fields = inspectDataContract(project.schema, project.sampleData);
    const seller = fields.find((field) => field.key === "seller");
    expect(seller.type).toBe("object");
    const sellerName = seller.fields.find((field) => field.key === "name");
    expect(sellerName).toEqual({ key: "name", path: "/seller/name", type: "string", required: true, constraints: { minLength: 1 }, sampleValue: "PrintForm Technology Sdn. Bhd." });
  });

  it("returns an empty list for a schema with no object properties", () => {
    expect(inspectDataContract({ type: "string" }, {})).toEqual([]);
  });

  it("represents opaque object maps without making the editor recurse into undefined fields", () => {
    const fields = inspectDataContract({ type: "object", properties: {
      totals: { type: "object", additionalProperties: { type: "string" } }
    } }, { totals: { gross: "10.00" } });
    expect(fields[0]).toEqual({ key: "totals", path: "/totals", type: "object", required: false, fields: [] });
  });
});

describe("applyDataContractEdits", () => {
  it("edits a top-level scalar's sample value and constraints without touching the inputs", () => {
    const project = createSalesInvoiceProject();
    const { schema, sampleData } = applyDataContractEdits(project.schema, project.sampleData, {
      "/invoiceNumber": { sampleValue: "INV-2026-999999", maxLength: 80 }
    });
    expect(sampleData.invoiceNumber).toBe("INV-2026-999999");
    expect(schema.properties.invoiceNumber.maxLength).toBe(80);
    expect(schema.properties.invoiceNumber.minLength).toBe(1);
    // Inputs are untouched (cloned, not mutated).
    expect(project.sampleData.invoiceNumber).toBe("INV-2026-001234");
    expect(project.schema.properties.invoiceNumber.maxLength).toBe(60);
  });

  it("toggles required by adding/removing the key from the parent's required array", () => {
    const project = createSalesInvoiceProject();
    const { schema } = applyDataContractEdits(project.schema, project.sampleData, {
      "/reference": { required: true }
    });
    expect(schema.required).toContain("reference");
    const { schema: reverted } = applyDataContractEdits(schema, project.sampleData, {
      "/invoiceNumber": { required: false }
    });
    expect(reverted.required).not.toContain("invoiceNumber");
  });

  it("edits a nested object field's sample value by path", () => {
    const project = createSalesInvoiceProject();
    const { sampleData } = applyDataContractEdits(project.schema, project.sampleData, {
      "/seller/name": { sampleValue: "Renamed Seller Sdn. Bhd." }
    });
    expect(sampleData.seller.name).toBe("Renamed Seller Sdn. Bhd.");
    expect(sampleData.seller.address).toBe(project.sampleData.seller.address);
  });

  it("clears a constraint when the edit sets it to undefined", () => {
    const project = createSalesInvoiceProject();
    const { schema } = applyDataContractEdits(project.schema, project.sampleData, {
      "/invoiceNumber": { maxLength: undefined }
    });
    expect("maxLength" in schema.properties.invoiceNumber).toBe(false);
  });
});

it("round-trips RFC6901 slash, tilde and empty property tokens through inspection and editing", () => {
  const schema = {type:"object",properties:{"a/b":{type:"object",properties:{"a~b":{type:"object",properties:{"":{type:"string"}}}}}}};
  const data = {"a/b":{"a~b":{"":"before"}}};
  const leaf = inspectDataContract(schema,data)[0].fields[0].fields[0];
  expect(leaf.path).toBe("/a~1b/a~0b/");
  const next = applyDataContractEdits(schema,data,{[leaf.path]:{sampleValue:"after",maxLength:10,required:true}});
  expect(next.sampleData["a/b"]["a~b"][""]).toBe("after");
  expect(next.schema.properties["a/b"].properties["a~b"].properties[""].maxLength).toBe(10);
  expect(next.schema.properties["a/b"].properties["a~b"].required).toEqual([""]);
  expect(data["a/b"]["a~b"][""]).toBe("before");
});
