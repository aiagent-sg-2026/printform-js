import { cloneJson, encodePointerToken, pointerTokens } from "./json.js";

// Read-only walker over a project's JSON Schema + sample data, for the P1
// Data contract panel. Deliberately scoped to "view structure, edit existing
// leaf constraints and sample values" — NOT "add or remove fields", because
// a new/removed field also has to be threaded through the template's
// data-pf-text/data-pf-each bindings and the i18n catalog, which is a
// separate, larger design question left for a future round. Array `items`
// schemas are left opaque for the same reason set_column_widths didn't try
// to reach into row content: a generated form over N repeating rows has no
// usability, so arrays stay editable only via the raw JSON editor.
function extractConstraints(propSchema) {
  const constraints = {};
  if (propSchema.minLength !== undefined) constraints.minLength = propSchema.minLength;
  if (propSchema.maxLength !== undefined) constraints.maxLength = propSchema.maxLength;
  if (propSchema.minimum !== undefined) constraints.minimum = propSchema.minimum;
  if (propSchema.maximum !== undefined) constraints.maximum = propSchema.maximum;
  if (propSchema.enum !== undefined) constraints.enum = propSchema.enum;
  if (propSchema.format !== undefined) constraints.format = propSchema.format;
  return constraints;
}

function walkObjectSchema(schema, sampleValue, pathPrefix) {
  const required = new Set(schema.required || []);
  const properties = schema.properties || {};
  return Object.keys(properties).map((key) => {
    const propSchema = properties[key];
    const path = `${pathPrefix}/${encodePointerToken(key)}`;
    const isRequired = required.has(key);
    const value = sampleValue && typeof sampleValue === "object" ? sampleValue[key] : undefined;
    if (propSchema.type === "object") {
      return { key, path, type: "object", required: isRequired, fields: propSchema.properties ? walkObjectSchema(propSchema, value, path) : [] };
    }
    if (propSchema.type === "array") {
      return { key, path, type: "array", required: isRequired };
    }
    return { key, path, type: propSchema.type, required: isRequired, constraints: extractConstraints(propSchema), sampleValue: value };
  });
}

export function inspectDataContract(schema, sampleData) {
  if (!schema || schema.type !== "object" || !schema.properties) return [];
  return walkObjectSchema(schema, sampleData || {}, "");
}

function splitPath(path) {
  return pointerTokens(path);
}

function schemaParentAndKey(schema, path) {
  const segments = splitPath(path);
  const key = segments.pop();
  let node = schema;
  for (const segment of segments) node = node.properties[segment];
  return { parent: node, key };
}

function dataParentAndKey(sampleData, path) {
  const segments = splitPath(path);
  const key = segments.pop();
  let node = sampleData;
  for (const segment of segments) {
    if (node[segment] === undefined || node[segment] === null) node[segment] = {};
    node = node[segment];
  }
  return { parent: node, key };
}

// Applies a batch of leaf-field edits to CLONES of schema/sampleData and
// returns the two new objects — never mutates the inputs, matching every
// other operation in this codebase. `edits` is keyed by the field's JSON
// Pointer path; each entry may set `sampleValue` and/or `required` and/or
// any of the constraint keys extractConstraints() reads. Omitted keys are
// left untouched; a constraint key present with value `undefined` removes it
// (e.g. clearing a maxLength back to "no limit").
export function applyDataContractEdits(schema, sampleData, edits) {
  const nextSchema = cloneJson(schema);
  const nextSampleData = cloneJson(sampleData) || {};
  const CONSTRAINT_KEYS = ["minLength", "maxLength", "minimum", "maximum", "enum", "format"];

  for (const [path, edit] of Object.entries(edits)) {
    const { parent: schemaParent, key } = schemaParentAndKey(nextSchema, path);
    const propSchema = schemaParent.properties[key];

    if (edit.required !== undefined) {
      const required = new Set(schemaParent.required || []);
      if (edit.required) required.add(key); else required.delete(key);
      schemaParent.required = Array.from(required);
    }

    for (const constraintKey of CONSTRAINT_KEYS) {
      if (!(constraintKey in edit)) continue;
      if (edit[constraintKey] === undefined) delete propSchema[constraintKey];
      else propSchema[constraintKey] = edit[constraintKey];
    }

    if ("sampleValue" in edit) {
      const { parent: dataParent, key: dataKey } = dataParentAndKey(nextSampleData, path);
      dataParent[dataKey] = edit.sampleValue;
    }
  }

  return { schema: nextSchema, sampleData: nextSampleData };
}
