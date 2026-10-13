import { encodePointerToken, jsonUnique } from './json.js';

const ANNOTATIONS = ['$schema', '$id', 'title', 'description', 'default', 'examples'];
const SUPPORTED = new Set([...ANNOTATIONS, 'type', 'properties', 'required', 'items', 'enum', 'const',
  'minLength', 'maxLength', 'pattern', 'format', 'minimum', 'maximum', 'exclusiveMinimum',
  'exclusiveMaximum', 'multipleOf', 'minItems', 'maxItems', 'uniqueItems', 'additionalProperties']);
const TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const unique = jsonUnique;

function inspect(schema, path, errors) {
  const issue = (code, keyword, message) => errors.push({code, path, keyword, message, severity:'error'});
  const invalid = keyword => issue('INVALID_SCHEMA', keyword, `Invalid value for ${keyword}`);
  if (!object(schema)) { issue('INVALID_SCHEMA', 'schema', 'Schema node must be an object'); return; }
  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED.has(keyword)) issue('UNSUPPORTED_SCHEMA_KEYWORD', keyword, `Unsupported keyword: ${keyword}`);
  }
  if ('type' in schema) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.length || !unique(types)) invalid('type');
    for (const type of types) if (!TYPES.has(type)) issue('UNSUPPORTED_SCHEMA_TYPE', 'type', `Unsupported type: ${type}`);
  }
  if ('properties' in schema) {
    if (!object(schema.properties)) invalid('properties');
    else for (const [key, child] of Object.entries(schema.properties)) inspect(child, `${path}/properties/${encodePointerToken(key)}`, errors);
  }
  if ('items' in schema) inspect(schema.items, `${path}/items`, errors);
  if ('additionalProperties' in schema && typeof schema.additionalProperties !== 'boolean') {
    inspect(schema.additionalProperties, `${path}/additionalProperties`, errors);
  }
  if ('required' in schema && (!Array.isArray(schema.required) || !schema.required.every(key => typeof key === 'string') || !unique(schema.required))) invalid('required');
  if ('enum' in schema && (!Array.isArray(schema.enum) || !schema.enum.length || !unique(schema.enum))) invalid('enum');
  for (const keyword of ['minLength', 'maxLength', 'minItems', 'maxItems']) {
    if (keyword in schema && (!Number.isInteger(schema[keyword]) || schema[keyword] < 0)) invalid(keyword);
  }
  for (const keyword of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf']) {
    if (keyword in schema && (!Number.isFinite(schema[keyword]) || (keyword === 'multipleOf' && schema[keyword] <= 0))) invalid(keyword);
  }
  if ('uniqueItems' in schema && typeof schema.uniqueItems !== 'boolean') invalid('uniqueItems');
  if ('pattern' in schema) {
    if (typeof schema.pattern !== 'string') invalid('pattern');
    else try { new RegExp(schema.pattern, 'u'); } catch { invalid('pattern'); }
  }
  if ('format' in schema && !['date', 'date-time', 'email', 'uri'].includes(schema.format)) {
    issue('UNSUPPORTED_SCHEMA_FORMAT', 'format', `Unsupported format: ${schema.format}`);
  }
  for (const keyword of ['$schema', '$id', 'title', 'description']) if (keyword in schema && typeof schema[keyword] !== 'string') invalid(keyword);
  if ('examples' in schema && !Array.isArray(schema.examples)) invalid('examples');
}

export function validateSchemaProfile(schema) {
  const errors = [];
  inspect(schema, '#', errors);
  return {valid:!errors.length, errors, warnings:[]};
}
