import { describe, expect, it } from "vitest";
import { validateData, validateSchemaProfile } from "../../studio-v2/core/schema.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

describe("PrintForm v2 JSON Schema profile", () => {
  it("accepts the production invoice fixture", () => {
    const project = createSalesInvoiceProject();
    expect(validateSchemaProfile(project.schema).valid).toBe(true);
    expect(validateData(project.schema, project.sampleData).valid).toBe(true);
  });

  it("rejects unsupported keywords instead of ignoring them", () => {
    const report = validateSchemaProfile({ type: "string", allOf: [] });
    expect(report.valid).toBe(false);
    expect(report.errors[0].code).toBe("UNSUPPORTED_SCHEMA_KEYWORD");
  });

  it("reports required, type and additional property errors", () => {
    const schema = { type: "object", required: ["count"], properties: { count: { type: "integer" } }, additionalProperties: false };
    expect(validateData(schema, { extra: true }).errors.map((item) => item.code)).toEqual(["REQUIRED", "ADDITIONAL_PROPERTY"]);
    expect(validateData(schema, { count: 1.5 }).errors[0].code).toBe("TYPE_MISMATCH");
  });
});

describe("ERP schema profile boundaries", () => {
  it("fails closed in every executable child schema", () => {
    const report = validateData({type:"object",additionalProperties:{allOf:[{type:"integer"}]}},{unexpected:"bad"});
    expect(report.valid).toBe(false);
    expect(report.errors[0]).toMatchObject({code:"UNSUPPORTED_SCHEMA_KEYWORD",path:"#/additionalProperties",keyword:"allOf"});
  });

  it.each([
    {required:"id"}, {required:[1]}, {required:["id","id"]}, {enum:[]}, {enum:"x"},
    {required:undefined},
    {properties:[]}, {items:[]}, {additionalProperties:null}, {multipleOf:0},
    {multipleOf:-1}, {minimum:"1"}, {maxItems:1.5}, {minLength:-1}, {uniqueItems:1},
    {pattern:"["}, {type:[]}, {type:["string","string"]}, {format:"unknown"}
  ])("returns diagnostics instead of throwing for malformed schema %j", schema => {
    const report = validateData(schema,{});
    expect(report.valid).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it("uses structural JSON equality for const, enum and uniqueness", () => {
    expect(validateData({const:{a:1,b:[2]}},{b:[2],a:1}).valid).toBe(true);
    expect(validateData({enum:[[1,2]]},[1,2]).valid).toBe(true);
    expect(validateData({enum:[[1,2]]},[2,1]).valid).toBe(false);
    expect(validateData({uniqueItems:true},[{a:1,b:2},{b:2,a:1}]).errors[0].code).toBe("UNIQUE_ITEMS");
    expect(validateData({uniqueItems:true},[{a:1},{a:2}]).valid).toBe(true);
  });

  it("counts Unicode code points, including supplementary-plane text", () => {
    expect(validateData({minLength:1,maxLength:1},"😀").valid).toBe(true);
    expect(validateData({minLength:2},"😀").valid).toBe(false);
    expect(validateData({maxLength:1},"😀a").valid).toBe(false);
  });

  it.each(["2026-02-30","1900-02-29","2026-00-01","2026-13-01","2026-01-00"])("rejects invalid Gregorian date %s", value => {
    expect(validateData({format:"date"},value).valid).toBe(false);
  });
  it.each(["2000-02-29","2024-02-29","2026-10-13"])("accepts Gregorian date %s", value => {
    expect(validateData({format:"date"},value).valid).toBe(true);
  });
  it.each(["2026-10-13","October 13, 2026","2026-02-30T12:00:00Z","2026-10-13T24:00:00Z","2026-10-13T12:60:00Z","2026-10-13T12:00:60Z","2026-10-13T12:00:00","2026-10-13T12:00:00+24:00"])("rejects non-profile date-time %s", value => {
    expect(validateData({format:"date-time"},value).valid).toBe(false);
  });
  it.each(["2026-10-13T12:00:00Z","2026-10-13t12:00:00.123z","2026-10-13T12:00:00+08:00"])("accepts RFC3339 date-time %s", value => {
    expect(validateData({format:"date-time"},value).valid).toBe(true);
  });
});
