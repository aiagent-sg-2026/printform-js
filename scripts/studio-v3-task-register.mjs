// CA-09 real-task register: structure validation and G8 qualification thresholds.
// Pure functions; the register files live in docs/studio-v3-task-register/.
import fs from 'node:fs';

export const FAMILIES = Object.freeze(['qa','authoring','layout','bindings','data','references','files','source-repair','source-implement','source-artifact']);
export const ESSENTIAL = Object.freeze(['ESS-QA','ESS-BLANK','ESS-SOURCE-EDIT','ESS-TEST-REPAIR','ESS-BUILD','ESS-ARTIFACT-IMPORT']);
export const ORACLE_TYPES = Object.freeze(['deterministic','reviewer','visual-blinded','runner-receipt']);
export const TASK_STATUS = Object.freeze(['draft','frozen','retired']);
export const OUTCOMES = Object.freeze(['Pass','Fail','Not run','Blocked','Invalid environment']);
export const TASK_COLUMNS = Object.freeze(['id','family','title','essential','holdout','capabilities','preconditions','actions','expected','failure_oracle','oracle_type','oracle_owner','input_digest','status']);
export const ATTEMPT_COLUMNS = Object.freeze(['task_id','profile','attempt','outcome','critical_violation','source_commit','app_digest','knowledge_digest','runner_image','provider_route','model_version','browser_os','budgets_digest','oracle_result','evidence_digest','duration_ms','usage','note']);
export const TARGET = Object.freeze({perFamily:6,repetitions:3,holdoutRatio:0.2,minPass:162,minFamilyPass:16});

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SELF_JUDGES = new Set(['model','agent','self']);
const present = value => typeof value === 'string' && value.trim().length > 0;
const EXECUTION_FIELDS = ['source_commit','runner_image','provider_route','model_version','browser_os'];
const EXECUTION_DIGESTS = ['app_digest','knowledge_digest','budgets_digest'];
const PROFILE_IDENTITY = [...EXECUTION_FIELDS,...EXECUTION_DIGESTS];

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header = [],...body] = rows;
  return {header,rows:body.map(values => Object.fromEntries(header.map((name,i) => [name,values[i] ?? ''])))};
}

export function readRegister(dir = 'docs/studio-v3-task-register') {
  const load = name => parseCsv(fs.readFileSync(`${dir}/${name}`,'utf8'));
  return {tasks:load('tasks.csv'),attempts:load('attempts.csv')};
}

function checkHeader(errors,label,header,columns) {
  if (header.join(',') !== columns.join(',')) errors.push(`${label}: header must be ${columns.join(',')}`);
}

export function validateRegister({tasks,attempts},{capabilityIds} = {}) {
  const errors = [];
  checkHeader(errors,'tasks.csv',tasks.header,TASK_COLUMNS);
  checkHeader(errors,'attempts.csv',attempts.header,ATTEMPT_COLUMNS);
  const byId = new Map(), essentials = new Map();
  for (const t of tasks.rows) {
    const at = `task ${t.id || '(no id)'}`;
    if (!/^T-[a-z-]+-\d{2}$/.test(t.id) || !t.id.startsWith(`T-${t.family}-`)) errors.push(`${at}: id must be T-<family>-NN`);
    if (byId.has(t.id)) errors.push(`${at}: duplicate id`);
    byId.set(t.id,t);
    if (!FAMILIES.includes(t.family)) errors.push(`${at}: unknown family ${t.family}`);
    if (!TASK_STATUS.includes(t.status)) errors.push(`${at}: unknown status ${t.status}`);
    if (!['yes','no'].includes(t.holdout)) errors.push(`${at}: holdout must be yes or no`);
    if (t.essential) {
      if (!ESSENTIAL.includes(t.essential)) errors.push(`${at}: unknown essential slot ${t.essential}`);
      else if (essentials.has(t.essential)) errors.push(`${at}: essential slot ${t.essential} already used`);
      essentials.set(t.essential,t.id);
    }
    if (capabilityIds) for (const id of t.capabilities.split(';').filter(Boolean)) if (!capabilityIds.has(id)) errors.push(`${at}: unknown capability ${id}`);
    if (t.status === 'frozen') {
      for (const key of ['title','capabilities','preconditions','actions','expected','failure_oracle','oracle_owner']) if (!t[key]) errors.push(`${at}: frozen task needs ${key}`);
      if (!ORACLE_TYPES.includes(t.oracle_type)) errors.push(`${at}: frozen task needs oracle_type`);
      if (!DIGEST.test(t.input_digest)) errors.push(`${at}: frozen task needs sha256 input_digest`);
    }
    if (SELF_JUDGES.has(String(t.oracle_owner || '').trim().toLowerCase())) errors.push(`${at}: the model cannot own its own oracle`);
  }
  const seen = new Set(), identities = new Map();
  for (const a of attempts.rows) {
    const at = `attempt ${a.task_id}/${a.profile}/${a.attempt}`, task = byId.get(a.task_id);
    if (!task) errors.push(`${at}: unknown task`);
    else if (task.status !== 'frozen') errors.push(`${at}: task is not frozen`);
    if (!present(a.profile)) errors.push(`${at}: profile required`);
    if (!/^[1-9]\d*$/.test(a.attempt)) errors.push(`${at}: attempt must be a positive integer`);
    const key = `${a.task_id}|${a.profile}|${a.attempt}`;
    if (seen.has(key)) errors.push(`${at}: duplicate attempt`);
    seen.add(key);
    if (!OUTCOMES.includes(a.outcome)) errors.push(`${at}: unknown outcome ${a.outcome}`);
    if (!['yes','no'].includes(a.critical_violation)) errors.push(`${at}: critical_violation must be yes or no`);
    if (a.outcome === 'Pass' && (!present(a.oracle_result) || !DIGEST.test(a.evidence_digest))) errors.push(`${at}: Pass needs oracle_result and sha256 evidence_digest`);
    if (a.outcome === 'Pass' && a.critical_violation === 'yes') errors.push(`${at}: an attempt with a critical violation cannot Pass`);
    if (a.outcome === 'Invalid environment' && !a.note) errors.push(`${at}: Invalid environment needs a documented external cause`);
    if (a.usage !== 'unavailable' && !/^\d+$/.test(a.usage)) errors.push(`${at}: usage must be a token count or unavailable, never blank`);
    // Unexecuted/externally blocked rows may truthfully lack execution metadata.
    if (['Pass','Fail'].includes(a.outcome)) {
      for (const key of EXECUTION_FIELDS) if (!present(a[key])) errors.push(`${at}: executed attempt needs ${key}`);
      for (const key of EXECUTION_DIGESTS) if (!DIGEST.test(a[key])) errors.push(`${at}: executed attempt needs sha256 ${key}`);
      if (!/^\d+$/.test(a.duration_ms)) errors.push(`${at}: executed attempt needs non-negative integer duration_ms`);
      if (present(a.profile)) {
        const identity = identities.get(a.profile);
        if (!identity) identities.set(a.profile,a);
        else for (const key of PROFILE_IDENTITY) if (a[key] !== identity[key]) errors.push(`${at}: profile ${a.profile} mixes ${key} execution identity`);
      }
    }
  }
  return errors;
}

// G8 thresholds for one profile; every number is computed from recorded attempts only.
export function qualification({tasks,attempts},profile,options = {}) {
  const validationErrors = validateRegister({tasks,attempts},options);
  const frozen = tasks.rows.filter(t => t.status === 'frozen');
  const families = Object.fromEntries(FAMILIES.map(f => [f,{tasks:0,attempts:0,pass:0}]));
  for (const t of frozen) if (Object.hasOwn(families,t.family)) families[t.family].tasks++;
  // Only attempts 1..3 count; a later rerun stays recorded but cannot replace the denominator.
  const forProfile = attempts.rows.filter(a => a.profile === profile);
  const taskOf = new Map(frozen.map(t => [t.id,t])), counted = new Set();
  const mine = forProfile.filter(a => {
    if (!/^[1-9]\d*$/.test(a.attempt) || Number(a.attempt) > TARGET.repetitions || !Object.hasOwn(families,taskOf.get(a.task_id)?.family)) return false;
    const key = `${a.task_id}|${a.attempt}`;
    if (counted.has(key)) return false;
    counted.add(key); return true;
  });
  let pass = 0;
  const critical = forProfile.filter(a => a.critical_violation === 'yes').length;
  for (const a of mine) {
    const t = taskOf.get(a.task_id); if (!t) continue;
    families[t.family].attempts++;
    if (a.outcome === 'Pass') { pass++; families[t.family].pass++; }
  }
  const required = FAMILIES.length * TARGET.perFamily * TARGET.repetitions;
  const holdout = frozen.filter(t => t.holdout === 'yes').length;
  const essentialPass = ESSENTIAL.map(slot => {
    const t = frozen.find(task => task.essential === slot);
    return {slot,task:t?.id || null,pass:t ? mine.filter(a => a.task_id === t.id && a.outcome === 'Pass').length : 0};
  });
  const reasons = validationErrors.map(error => `invalid register: ${error}`);
  if (frozen.length !== FAMILIES.length * TARGET.perFamily) reasons.push(`frozen tasks ${frozen.length}/${FAMILIES.length * TARGET.perFamily}`);
  for (const [f,v] of Object.entries(families)) {
    if (v.tasks !== TARGET.perFamily) reasons.push(`family ${f} has ${v.tasks}/${TARGET.perFamily} tasks`);
    if (v.pass < TARGET.minFamilyPass) reasons.push(`family ${f} passed ${v.pass}/${TARGET.perFamily * TARGET.repetitions}`);
  }
  if (holdout < Math.ceil(frozen.length * TARGET.holdoutRatio) || !frozen.length) reasons.push(`holdout tasks ${holdout}`);
  if (mine.length !== required) reasons.push(`attempts ${mine.length}/${required}`);
  if (pass < TARGET.minPass) reasons.push(`passed ${pass}/${required}, needs ${TARGET.minPass}`);
  for (const e of essentialPass) if (e.pass < TARGET.repetitions) reasons.push(`essential ${e.slot} passed ${e.pass}/${TARGET.repetitions}`);
  if (critical) reasons.push(`critical violations ${critical}`);
  return {profile,qualified:reasons.length === 0,pass,required,critical,extraAttempts:forProfile.length - mine.length,holdout,families,essential:essentialPass,reasons};
}
