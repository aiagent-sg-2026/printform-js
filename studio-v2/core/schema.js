import { encodePointerToken, jsonEqual, jsonUnique } from './json.js';
import { validateSchemaProfile } from './schema-profile.js';
export { validateSchemaProfile } from './schema-profile.js';

function issue(code, path, message, keyword, severity = "error") {
  return { code, path: path || "/", message, keyword, severity };
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesType(value, expected) {
  const actual = valueType(value);
  if (expected === "number") return actual === "number" || actual === "integer";
  return actual === expected;
}

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function validateFormat(value, format) {
  if (format === "date") return validDate(value);
  if (format === "date-time") {
    // This profile accepts RFC3339 offsets but deliberately excludes leap seconds.
    const match = /^(\d{4}-\d{2}-\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/.exec(value);
    return Boolean(match && validDate(match[1]) && Number(match[2]) < 24 && Number(match[3]) < 60 &&
      Number(match[4]) < 60 && (!match[5] || (Number(match[6]) < 24 && Number(match[7]) < 60)));
  }
  if (format === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (format === "uri") {
    try { return Boolean(new URL(value)); } catch { return false; }
  }
  return false;
}


function validateValue(schema, value, path, errors) {
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((type) => matchesType(value, type))) {
    errors.push(issue("TYPE_MISMATCH", path, `Expected ${types.join(" or ")}, received ${valueType(value)}`, "type"));
    return;
  }
  if ('const' in schema && !jsonEqual(value, schema.const)) errors.push(issue("CONST_MISMATCH", path, "Value does not match const", "const"));
  if (schema.enum && !schema.enum.some((item) => jsonEqual(item, value))) errors.push(issue("ENUM_MISMATCH", path, "Value is not in enum", "enum"));
  if (typeof value === "string") validateString(schema, value, path, errors);
  if (typeof value === "number") validateNumber(schema, value, path, errors);
  if (Array.isArray(value)) validateArray(schema, value, path, errors);
  if (value && typeof value === "object" && !Array.isArray(value)) validateObject(schema, value, path, errors);
}

function validateString(schema, value, path, errors) {
  let length = 0;
  for (const character of value) length += 1;
  if (schema.minLength !== undefined && length < schema.minLength) errors.push(issue("MIN_LENGTH", path, `Minimum length is ${schema.minLength}`, "minLength"));
  if (schema.maxLength !== undefined && length > schema.maxLength) errors.push(issue("MAX_LENGTH", path, `Maximum length is ${schema.maxLength}`, "maxLength"));
  if (schema.pattern) {
    try { if (!new RegExp(schema.pattern, "u").test(value)) errors.push(issue("PATTERN", path, "Value does not match pattern", "pattern")); }
    catch { errors.push(issue("INVALID_PATTERN", path, "Schema pattern is invalid", "pattern")); }
  }
  if (schema.format && !validateFormat(value, schema.format)) errors.push(issue("FORMAT", path, `Value is not a valid ${schema.format}`, "format"));
}

function validateNumber(schema, value, path, errors) {
  if (schema.minimum !== undefined && value < schema.minimum) errors.push(issue("MINIMUM", path, `Minimum is ${schema.minimum}`, "minimum"));
  if (schema.maximum !== undefined && value > schema.maximum) errors.push(issue("MAXIMUM", path, `Maximum is ${schema.maximum}`, "maximum"));
  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errors.push(issue("EXCLUSIVE_MINIMUM", path, `Must exceed ${schema.exclusiveMinimum}`, "exclusiveMinimum"));
  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) errors.push(issue("EXCLUSIVE_MAXIMUM", path, `Must be below ${schema.exclusiveMaximum}`, "exclusiveMaximum"));
  if (schema.multipleOf && Math.abs(value / schema.multipleOf - Math.round(value / schema.multipleOf)) > 1e-9) errors.push(issue("MULTIPLE_OF", path, `Must be a multiple of ${schema.multipleOf}`, "multipleOf"));
}

function validateArray(schema, value, path, errors) {
  if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(issue("MIN_ITEMS", path, `Minimum items is ${schema.minItems}`, "minItems"));
  if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(issue("MAX_ITEMS", path, `Maximum items is ${schema.maxItems}`, "maxItems"));
  if (schema.uniqueItems && !jsonUnique(value)) errors.push(issue("UNIQUE_ITEMS", path, "Items must be unique", "uniqueItems"));
  if (schema.items) value.forEach((item, index) => validateValue(schema.items, item, `${path}/${index}`, errors));
}

function validateObject(schema, value, path, errors) {
  (schema.required || []).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(issue("REQUIRED", `${path}/${encodePointerToken(key)}`, `Required property is missing: ${key}`, "required"));
  });
  Object.entries(value).forEach(([key, child]) => {
    const childPath = `${path}/${encodePointerToken(key)}`;
    if (schema.properties && Object.prototype.hasOwnProperty.call(schema.properties, key)) validateValue(schema.properties[key], child, childPath, errors);
    else if (schema.additionalProperties === false) errors.push(issue("ADDITIONAL_PROPERTY", childPath, `Unexpected property: ${key}`, "additionalProperties"));
    else if (schema.additionalProperties && typeof schema.additionalProperties === "object") validateValue(schema.additionalProperties, child, childPath, errors);
  });
}


export function validateData(schema, data) {
  const profile = validateSchemaProfile(schema);
  if (!profile.valid) return profile;
  const errors = [];
  validateValue(schema, data, "", errors);
  return { valid: errors.length === 0, errors, warnings: [] };
}
