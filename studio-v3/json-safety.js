const forbiddenKeys = new Set(['__proto__','prototype','constructor']);
export const unsafeJsonKey = key => forbiddenKeys.has(key);
export const JSON_DATA_LIMITS = Object.freeze({maxBytes:2*1024*1024,maxDepth:16,maxNodes:50000,label:'Dataset'});
export const JSON_PROJECT_LIMITS = Object.freeze({maxBytes:10*1024*1024,maxDepth:18,maxNodes:50000,label:'Project'});
const fail = (message,code) => { throw Object.assign(new Error(message),{code}); };

export function assertJsonBytes(source, options = JSON_DATA_LIMITS) {
  if (typeof source !== 'string') fail('JSON source must be text.','INVALID_JSON_VALUE');
  const {maxBytes,label} = {...JSON_DATA_LIMITS,...options};
  if (new TextEncoder().encode(source).length > maxBytes) fail(`${label} exceeds the ${maxBytes/(1024*1024)} MB limit.`,'JSON_SIZE_LIMIT');
}
export function assertJsonStructure(data, options = JSON_DATA_LIMITS) {
  const {maxDepth,maxNodes,label} = {...JSON_DATA_LIMITS,...options};
  let nodes = 0;
  const visit = (value,depth) => {
    if (++nodes > maxNodes || depth > maxDepth) fail(`${label} structure is too large or deeply nested.`,'JSON_STRUCTURE_LIMIT');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('Numbers must be finite.','INVALID_JSON_VALUE');
      return;
    }
    if (typeof value !== 'object') fail('Only JSON values are supported.','INVALID_JSON_VALUE');
    if (!Array.isArray(value) && ![Object.prototype,null].includes(Object.getPrototypeOf(value))) fail('Only JSON objects are supported.','INVALID_JSON_VALUE');
    for (const [key,next] of Object.entries(value)) {
      if (unsafeJsonKey(key)) fail('Prototype and constructor fields are not supported.','UNSAFE_JSON_KEY');
      visit(next,depth+1);
    }
  };
  visit(data,0);
  return data;
}
export function assertBoundedJson(data, options = JSON_DATA_LIMITS) {
  assertJsonStructure(data,options);
  assertJsonBytes(JSON.stringify(data),options);
  return data;
}
export function parseBoundedJson(source, options = JSON_DATA_LIMITS) {
  assertJsonBytes(source,options);
  return assertJsonStructure(JSON.parse(source),options);
}
