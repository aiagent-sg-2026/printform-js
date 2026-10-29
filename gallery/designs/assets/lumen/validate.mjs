import schema from './schema.json' with {type:'json'};
const fail = (path, message) => { throw new TypeError(`${path}: ${message}`); };
// The approved schema uses this small, explicit subset of Draft 2020-12.
// No coercion, default injection, remote schemas or silent unknown keywords.
function check(value, rule, path) {
  if ('const' in rule && value !== rule.const) fail(path, 'unsupported schema version');
  if (rule.enum && !rule.enum.includes(value)) fail(path, 'unsupported category');
  if (rule.type) {
    const types = [].concat(rule.type);
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
    if (!types.includes(type)) fail(path, `expected ${types.join(' or ')}`);
  }
  if (typeof value === 'string') {
    const length = [...value].length;
    if (length < (rule.minLength ?? 0) || length > (rule.maxLength ?? Infinity)) fail(path, 'text length outside schema limits');
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) fail(path, 'invalid ID');
    if (rule.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-') || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) fail(path, 'invalid ISO calendar date');
  }
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < (rule.minimum ?? -Infinity) || value > (rule.maximum ?? Infinity))) fail(path, 'integer outside schema limits');
  if (Array.isArray(value)) {
    if (value.length < rule.minItems || value.length > rule.maxItems) fail(path, 'array length outside schema limits');
    value.forEach((v, i) => check(v, rule.items, `${path}[${i}]`));
  } else if (value && typeof value === 'object') {
    for (const key of rule.required || []) if (!Object.hasOwn(value, key)) fail(path, `missing ${key}`);
    for (const [key, v] of Object.entries(value)) {
      if (!Object.hasOwn(rule.properties, key)) fail(path, `unknown field ${key}`);
      check(v, rule.properties[key], `${path}.${key}`);
    }
  }
}
function unique(values, path) { if (new Set(values).size !== values.length) fail(path, 'duplicate ID/reference'); }
export function validate(d) {
  check(d, schema, 'source');
  if (![4, 8, 12].includes(d.domains.length)) fail('domains', 'choose 4, 8 or 12 domains');
  for (const key of ['domains', 'semesters', 'evidence', 'goals', 'communications']) unique(d[key].map(x => x.id), key);
  const domains = new Set(d.domains.map(x => x.id)), terms = new Map(d.semesters.map(x => [x.id, x]));
  const evidence = new Set(d.evidence.map(x => x.id));
  let previousEnd = null;
  for (const s of d.semesters) {
    if (s.start > s.end || (previousEnd !== null && s.start <= previousEnd)) fail(s.id, 'terms must be chronological and non-overlapping');
    previousEnd = s.end;
    const a = s.attendance, values = Object.values(a);
    if (values.some(v => v === null) && !values.every(v => v === null)) fail(s.id, 'attendance must be all integers or all null');
    if (a.scheduled !== null && a.present + a.absent + a.unknown !== a.scheduled) fail(s.id, 'present + absent + unknown must equal scheduled');
  }
  unique(d.reflections.map(r => `${r.domainId}/${r.semesterId}`), 'reflections');
  for (const r of d.reflections) if (!domains.has(r.domainId) || !terms.has(r.semesterId)) fail('reflections', 'unknown domain/term reference');
  function dated(x) {
    const s = terms.get(x.semesterId);
    if (!s) fail(x.id, 'unknown term reference');
    if (x.date < s.start || x.date > s.end) fail(x.id, 'date must belong to its term');
  }
  for (const e of d.evidence) {
    dated(e); unique(e.domainIds, e.id);
    if (e.domainIds.some(id => !domains.has(id))) fail(e.id, 'unknown domain reference');
  }
  for (const g of d.goals) {
    unique(g.evidenceIds, g.id);
    if (!domains.has(g.domainId) || g.evidenceIds.some(id => !evidence.has(id))) fail(g.id, 'unknown goal domain/evidence reference');
  }
  d.communications.forEach(dated);
  return d;
}
