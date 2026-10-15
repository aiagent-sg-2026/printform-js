import { validateToolArguments } from '@earendil-works/pi-ai';

const probes = new WeakMap();
const same = (left,right) => JSON.stringify(left) === JSON.stringify(right);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value,key) => Object.hasOwn(value,key);
const MAX_HINTS = 4, MAX_NODES = 256, MAX_DEPTH = 8, MAX_ARRAY = 32, MAX_CHARS = 2400;

// Probe with the installed SDK, not another validator. Wrapping preserves primitive conversion detection.
// This runs only after the real tool validation has already rejected the entire call.
function conforms(schema,value) {
  let definition = probes.get(schema);
  if (!definition) {
    definition = {name:'schema-repair',parameters:{type:'object',properties:{value:schema},required:['value'],additionalProperties:false}};
    probes.set(schema,definition);
  }
  try {
    const raw = {value}, checked = validateToolArguments(definition,{name:definition.name,id:'repair',arguments:raw});
    return same(raw,checked);
  } catch { return false; } // SDK exceptions contain received arguments: never read or forward them.
}

const branches = schema => schema.anyOf || schema.oneOf;
const discriminator = members => members?.length && members.every(member=>typeof member.properties?.type?.const === 'string')
  ? members.map(member=>member.properties.type.const) : null;

// Only declarative constraints and names are copied; descriptions, exceptions and received values are not.
function expected(schema,depth = 0) {
  const members = branches(schema), types = discriminator(members);
  if (types) return {type:'object',discriminator:{type:{enum:types.slice(0,24)}}};
  if (members?.every(member=>own(member,'const'))) return {enum:members.slice(0,24).map(member=>member.const)};
  if (members) return depth < 2 ? {anyOf:members.slice(0,4).map(member=>expected(member,depth + 1))} : {};
  const result = {};
  for (const key of ['type','const','minimum','maximum','minLength','maxLength','pattern','minItems','maxItems','uniqueItems']) {
    if (own(schema,key)) result[key] = schema[key];
  }
  if (schema.type === 'object') {
    const keys = Object.keys(schema.properties || {}).slice(0,24);
    result.allowedProperties = keys;
    result.required = (schema.required || []).filter(key=>keys.includes(key));
  }
  if (schema.type === 'array' && schema.items && depth < 2) result.items = expected(schema.items,depth + 1);
  return result;
}

export function argumentRepairHint(definition,args) {
  try {
    const hints = [];
    let nodes = 0;
    const add = (path,schema,operation) => {
      if (hints.length >= MAX_HINTS || path.length > 240) return;
      const hint = {path,...(operation ? {operation} : {}),expected:expected(schema)};
      if (JSON.stringify([...hints,hint]).length <= MAX_CHARS - 100) hints.push(hint);
    };
    const visit = (schema,value,path,depth,operation) => {
      if (++nodes > MAX_NODES || hints.length >= MAX_HINTS || depth > MAX_DEPTH) return;
      if (schema.type === 'array' && Array.isArray(value) && value.length > MAX_ARRAY) { add(path,schema,operation); return; }
      if (depth > 0 && conforms(schema,value)) return;
      const before = hints.length, members = branches(schema);
      if (discriminator(members) && object(value) && own(value,'type')) {
        const member = members.find(candidate=>candidate.properties.type.const === value.type);
        if (member) { visit(member,value,path,depth + 1,member.properties.type.const); return; }
        // The invalid discriminator itself is never reflected, even when it resembles a known operation.
        add(`${path}.type`,{anyOf:members.map(candidate=>candidate.properties.type)},operation); return;
      }
      if (schema.type === 'object' && object(value)) {
        const properties = schema.properties || {};
        if (schema.additionalProperties === false && Object.keys(value).some(key=>!own(properties,key))) add(path,schema,operation);
        for (const key of (schema.required || [])) {
          if (own(properties,key) && !own(value,key)) add(`${path}.${key}`,properties[key],operation);
        }
        for (const [key,child] of Object.entries(properties)) {
          if (own(value,key)) visit(child,value[key],`${path}.${key}`,depth + 1,operation);
          if (nodes >= MAX_NODES || hints.length >= MAX_HINTS) break;
        }
      } else if (schema.type === 'array' && Array.isArray(value) && schema.items && !Array.isArray(schema.items)) {
        for (let index = 0; index < Math.min(value.length,MAX_ARRAY); index++) {
          visit(schema.items,value[index],`${path}[${index}]`,depth + 1,operation);
          if (nodes >= MAX_NODES || hints.length >= MAX_HINTS) break;
        }
      }
      if (hints.length === before) add(path,schema,operation);
    };
    visit(definition.parameters,args,'arguments',0);
    return hints.length ? ` Schema repair hints (raw types required): ${JSON.stringify(hints)}` : '';
  } catch { return ''; } // A diagnostic failure cannot change rejection, effects or repeat accounting.
}
