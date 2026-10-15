import {describe,it,expect} from 'vitest';
import {FAMILIES,ESSENTIAL,TASK_COLUMNS,ATTEMPT_COLUMNS,validateRegister,qualification,parseCsv} from '../scripts/studio-v3-task-register.mjs';

const digest = n => `sha256:${String(n).padStart(64,'0')}`;
const ESSENTIAL_FAMILY = {'ESS-QA':'qa','ESS-BLANK':'authoring','ESS-SOURCE-EDIT':'source-implement','ESS-TEST-REPAIR':'source-repair','ESS-BUILD':'source-artifact','ESS-ARTIFACT-IMPORT':'source-artifact'};

// Synthetic register: 10 families x 6 frozen tasks, 2 holdout per family, 3 passing attempts each.
function synthetic() {
  const pending = [...ESSENTIAL];
  const tasks = FAMILIES.flatMap(family => Array.from({length:6},(_,i) => {
    const slot = pending.find(s => ESSENTIAL_FAMILY[s] === family);
    if (slot) pending.splice(pending.indexOf(slot),1);
    return {id:`T-${family}-${String(i + 1).padStart(2,'0')}`,family,title:'Synthetic task',essential:slot || '',holdout:i < 2 ? 'yes' : 'no',
      capabilities:'printform.style.global',preconditions:'Fixture loaded',actions:'Ask the agent',expected:'Fixture matches',failure_oracle:'Diff differs',
      oracle_type:'deterministic',oracle_owner:'independent reviewer',input_digest:digest(i + 1),status:'frozen'};
  }));
  const attempts = tasks.flatMap(t => [1,2,3].map(n => ({task_id:t.id,profile:'p1',attempt:String(n),outcome:'Pass',critical_violation:'no',source_commit:'abc',
    app_digest:digest(1),knowledge_digest:digest(2),runner_image:'img',provider_route:'route',model_version:'m',browser_os:'chromium/mac',budgets_digest:digest(3),
    oracle_result:'match',evidence_digest:digest(4),duration_ms:'1000',usage:'1200',note:''})));
  return {tasks:{header:[...TASK_COLUMNS],rows:tasks},attempts:{header:[...ATTEMPT_COLUMNS],rows:attempts}};
}
const failAttempts = (register,predicate,count) => {
  for (const a of register.attempts.rows.filter(predicate).slice(0,count)) { a.outcome = 'Fail'; a.oracle_result = 'mismatch'; }
  return register;
};
const capabilityIds = new Set(['printform.style.global']);

describe('Studio v3 CA-09 task register', () => {
  it('qualifies a complete synthetic profile that meets every G8 threshold', () => {
    const register = synthetic();
    expect(validateRegister(register,{capabilityIds})).toEqual([]);
    const result = qualification(register,'p1');
    expect(result).toMatchObject({qualified:true,pass:180,required:180,critical:0,holdout:20});
    expect(result.essential.every(e => e.pass === 3)).toBe(true);
  });
  it('does not count repeated task/profile/attempt rows as three executions', () => {
    const register = synthetic();
    for (const attempt of register.attempts.rows) attempt.attempt = '1';
    const result = qualification(register,'p1');
    expect(result).toMatchObject({qualified:false,pass:60});
    expect(result.reasons.some(reason => reason.includes('duplicate attempt'))).toBe(true);
    expect(result.families.qa).toEqual({tasks:6,attempts:6,pass:6});
    expect(result.essential.every(slot => slot.pass === 1)).toBe(true);
  });
  it.each([
    ['header drift',register => { register.attempts.header.pop(); }],
    ['duplicate task',register => { register.tasks.rows.push({...register.tasks.rows[0]}); }],
    ['unfrozen task',register => { register.tasks.rows[0].status = 'draft'; }],
    ['unknown family',register => { register.tasks.rows[0].family = 'unknown'; }],
    ['model-owned oracle',register => { register.tasks.rows[0].oracle_owner = 'model'; }],
    ['invalid evidence',register => { register.attempts.rows[0].evidence_digest = ''; }],
    ['invalid outcome',register => { register.attempts.rows[0].outcome = 'claimed-success'; }],
    ['invalid attempt index',register => { register.attempts.rows[0].attempt = '0'; }]
  ])('fails closed on %s without a separate validation call',(_name,mutate) => {
    const register = synthetic(); mutate(register);
    const result = qualification(register,'p1');
    expect(result.qualified).toBe(false);
    expect(result.reasons.some(reason => reason.startsWith('invalid register:'))).toBe(true);
  });
  it('passes the optional capability ledger through to qualification validation', () => {
    expect(qualification(synthetic(),'p1',{capabilityIds}).qualified).toBe(true);
    const result = qualification(synthetic(),'p1',{capabilityIds:new Set()});
    expect(result.qualified).toBe(false);
    expect(result.reasons.some(reason => reason.includes('unknown capability'))).toBe(true);
  });
  it.each(['source_commit','app_digest','knowledge_digest','runner_image','provider_route','model_version','browser_os','budgets_digest','duration_ms'])(
    'cannot qualify an executed attempt missing %s',key => {
      const register = synthetic(); register.attempts.rows[0][key] = '';
      expect(validateRegister(register).some(error => error.includes(key))).toBe(true);
      const result = qualification(register,'p1');
      expect(result.qualified).toBe(false);
      expect(result.reasons.some(reason => reason.includes(key))).toBe(true);
    });
  it.each([
    ['source_commit','  '],['app_digest','not-a-digest'],['knowledge_digest','unavailable'],
    ['budgets_digest','sha256:123'],['duration_ms','-1'],['duration_ms','1.5']
  ])('rejects malformed execution metadata %s=%s',(key,value) => {
    const register = synthetic(); register.attempts.rows[0][key] = value;
    expect(qualification(register,'p1').qualified).toBe(false);
  });
  it('also requires execution identity for actual failures', () => {
    const register = synthetic(), attempt = register.attempts.rows[0];
    Object.assign(attempt,{outcome:'Fail',source_commit:'',app_digest:'',duration_ms:''});
    const errors = validateRegister(register);
    for (const key of ['source_commit','app_digest','duration_ms']) expect(errors.some(error => error.includes(key))).toBe(true);
  });
  it('allows truthful unavailable usage and upstream identity in a route-level profile', () => {
    const register = synthetic();
    for (const attempt of register.attempts.rows) Object.assign(attempt,{usage:'unavailable',model_version:'unavailable'});
    expect(validateRegister(register)).toEqual([]);
    expect(qualification(register,'p1').qualified).toBe(true);
  });
  it.each(['Not run','Blocked','Invalid environment'])('preserves an unexecuted %s row without invented execution metadata',outcome => {
    const register = synthetic(), attempt = register.attempts.rows[0];
    for (const key of ['source_commit','app_digest','knowledge_digest','runner_image','provider_route','model_version','browser_os','budgets_digest','duration_ms','oracle_result','evidence_digest']) attempt[key] = '';
    Object.assign(attempt,{outcome,usage:'unavailable',note:outcome === 'Invalid environment' ? 'External runner unavailable before dispatch' : ''});
    expect(validateRegister(register)).toEqual([]);
    const result = qualification(register,'p1');
    expect(result).toMatchObject({qualified:false,pass:179});
    expect(result.reasons.some(reason => reason.startsWith('invalid register:'))).toBe(false);
  });
  it('counts a critical violation in a later rerun even when the first 180 passed', () => {
    const register = synthetic();
    register.attempts.rows.push({...register.attempts.rows[0],attempt:'4',outcome:'Fail',critical_violation:'yes'});
    const result = qualification(register,'p1');
    expect(result).toMatchObject({qualified:false,pass:180,extraAttempts:1,critical:1});
    expect(result.reasons).toContain('critical violations 1');
  });
  it('rejects prototype-named families without changing inherited counters', () => {
    const register = synthetic(); register.tasks.rows[0].family = '__proto__';
    expect(qualification(register,'p1').qualified).toBe(false);
    expect(Object.hasOwn(Object.prototype,'tasks')).toBe(false);
    expect(Object.hasOwn(Object.prototype,'attempts')).toBe(false);
  });
  it('accepts exactly 162/180 overall and 16/18 per family', () => {
    const register = synthetic();
    for (const family of FAMILIES.slice(0,9)) failAttempts(register,a => a.task_id.startsWith(`T-${family}-`) && !a.task_id.endsWith('-01'),2);
    expect(qualification(register,'p1')).toMatchObject({qualified:true,pass:162});
  });
  it('rejects 161/180 overall', () => {
    const register = synthetic();
    for (const family of FAMILIES.slice(0,9)) failAttempts(register,a => a.task_id.startsWith(`T-${family}-`) && !a.task_id.endsWith('-01'),2);
    failAttempts(register,a => a.task_id === 'T-source-artifact-04' && a.outcome === 'Pass',1);
    const result = qualification(register,'p1');
    expect(result.qualified).toBe(false);
    expect(result.reasons).toContain('passed 161/180, needs 162');
  });
  it('rejects a family below 16/18, an essential task below 3/3 and any critical violation', () => {
    const family = failAttempts(synthetic(),a => a.task_id.startsWith('T-layout-'),3);
    expect(qualification(family,'p1').reasons).toContain('family layout passed 15/18');
    const essential = synthetic(), slot = essential.tasks.rows.find(t => t.essential === 'ESS-BUILD');
    failAttempts(essential,a => a.task_id === slot.id,1);
    expect(qualification(essential,'p1').reasons).toContain('essential ESS-BUILD passed 2/3');
    const critical = synthetic(); critical.attempts.rows[0].critical_violation = 'yes'; critical.attempts.rows[0].outcome = 'Fail';
    expect(qualification(critical,'p1').reasons).toContain('critical violations 1');
  });
  it('does not let a whole-attempt rerun replace a failed attempt', () => {
    const register = failAttempts(synthetic(),a => a.task_id === 'T-qa-02',3);
    register.attempts.rows.push(...[4,5,6].map(n => ({...register.attempts.rows[0],task_id:'T-qa-02',attempt:String(n),outcome:'Pass',oracle_result:'match'})));
    const result = qualification(register,'p1');
    expect(result).toMatchObject({pass:177,extraAttempts:3});
    expect(result.reasons).toContain('family qa passed 15/18');
  });
  it('rejects structural and evidence violations', () => {
    const register = synthetic(), [task] = register.tasks.rows, [attempt,second] = register.attempts.rows;
    task.oracle_owner = 'model';
    register.tasks.rows[1].input_digest = '';
    register.tasks.rows.push({...register.tasks.rows[2],essential:'ESS-QA'});
    attempt.evidence_digest = '';
    second.usage = '';
    register.attempts.rows.push({...attempt,outcome:'Invalid environment',evidence_digest:digest(4),note:'',attempt:'9'});
    register.attempts.rows.push({...register.attempts.rows[3]});
    register.attempts.rows.push({...register.attempts.rows[4],task_id:'T-qa-99'});
    const errors = validateRegister(register,{capabilityIds:new Set()});
    const has = text => expect(errors.some(e => e.includes(text)),text).toBe(true);
    has('the model cannot own its own oracle');
    has('frozen task needs sha256 input_digest');
    has('duplicate id');
    has('already used');
    has('Pass needs oracle_result and sha256 evidence_digest');
    has('never blank');
    has('Invalid environment needs a documented external cause');
    has('duplicate attempt');
    has('unknown task');
    has('unknown capability printform.style.global');
  });
  it('rejects a header drift and attempts on unfrozen tasks', () => {
    const register = synthetic();
    register.tasks.header = register.tasks.header.slice(1);
    register.tasks.rows[0].status = 'draft';
    const errors = validateRegister(register);
    expect(errors.some(e => e.startsWith('tasks.csv: header'))).toBe(true);
    expect(errors.some(e => e.includes('task is not frozen'))).toBe(true);
  });
  it('parses quoted CSV cells with commas, quotes and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, ""y""",z\r\n').rows).toEqual([{a:'x, "y"',b:'z'}]);
  });
});
