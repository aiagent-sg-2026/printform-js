import {describe,it,expect,afterEach} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {preflight} from '../scripts/studio-v3-g8-preflight.mjs';
import {readInventory} from '../scripts/studio-v3-g8-inventory.mjs';
import {readRegister,ATTEMPT_COLUMNS} from '../scripts/studio-v3-task-register.mjs';
import {digest} from '../scripts/studio-v3-g8-corpus.mjs';
import {corpus,profile,fixture,seal} from './support/g8-evidence-fixture.js';

// Isolated synthetic consumer inputs only. No provider calls or formal records are made.
const inventory=()=>({profiles:[],envelopes:[],prerequisites:[],errors:[]});
const emptyRegister=()=>({...readRegister(),attempts:{header:[...ATTEMPT_COLUMNS],rows:[]}});
function row(e,outcome='Pass') {
  return {...Object.fromEntries(ATTEMPT_COLUMNS.map(key=>[key,''])),...profile.identity,
    task_id:e.taskId,profile:profile.profile,attempt:String(e.attempt),outcome,critical_violation:'no',
    oracle_result:'Synthetic unit expectation only; never a formal observation',evidence_digest:digest(e),duration_ms:String(e.endedAt-e.startedAt),usage:String(e.usage)};
}
function runWith(envelopes,rows) {
  return preflight({corpus,profile,register:{...emptyRegister(),attempts:{header:[...ATTEMPT_COLUMNS],rows}},
    inventory:{...inventory(),envelopes:envelopes.map((value,i)=>({path:`synthetic-${i}.json`,value}))}});
}
const temporary=[];
afterEach(()=>{for (const dir of temporary.splice(0)) fs.rmSync(dir,{recursive:true,force:true});});
function temp() { const dir=fs.mkdtempSync(path.join(os.tmpdir(),'g8-preflight-unit-'));temporary.push(dir);return dir; }

describe('G8 read-only full-suite preflight',()=>{
  it('enumerates original 180 slots and mathematical/family impossibility without exposing held-out inputs',()=>{
    const report=preflight({corpus,profile,register:emptyRegister()});
    expect(report.qualified).toBe(false);
    expect(report.readyForFullQualification).toBe(false);
    expect(report.modelCalls).toBe(0);
    expect(report.attemptsWritten).toBe(0);
    expect(report.slots).toHaveLength(180);
    expect(new Set(report.slots.map(s=>`${s.taskId}|${s.attempt}`)).size).toBe(180);
    expect(report.corpus).toMatchObject({tasks:60,holdout:20,unsupportedTasks:12,maxPass:144,minPass:162});
    expect(report.counts).toMatchObject({required:180,registeredTotal:0,missingSlots:180,verifiedPass:0});
    expect(report.families.data).toMatchObject({required:18,minPass:16,unsupportedTasks:6,maxPass:0});
    expect(report.families.bindings.maxPass).toBe(12);
    expect(report.essential).toHaveLength(6);
    expect(report.essential.every(e=>e.required===3 && e.verifiedPass===0)).toBe(true);
    expect(report.blockers.some(b=>b.code==='immutable-pass-ceiling')).toBe(true);
    expect(report.slots.filter(s=>s.holdout)).toHaveLength(60);
    for (const slot of report.slots) for (const key of ['input','prompt','state','oracle','answer','files']) expect(slot).not.toHaveProperty(key);
    expect(report.slots.find(s=>s.family==='source-repair').requiredEvidence).toContain('actual test/build process receipts');
  });

  it('re-evaluates a signed synthetic envelope rather than trusting a recorded Pass',()=>{
    const {evidence}=fixture(),saved=structuredClone(evidence);
    const report=runWith([seal(evidence)],[row(evidence)]);
    expect(report.counts).toMatchObject({registeredSelected:1,recordedPass:1,verifiedSelected:1,verifiedPass:1,missingRegisteredEvidence:0});
    expect(report.evidence.results[0].evaluation.outcome).toBe('Pass');
    expect(evidence).toEqual(saved);
    expect(report.qualified).toBe(false);
    const wrong=structuredClone(evidence);wrong.answer='{"fontPt":123}';
    const dishonest=runWith([seal(wrong)],[row(wrong)]);
    expect(dishonest.counts.recordedPass).toBe(1);
    expect(dishonest.counts.verifiedPass).toBe(0);
    expect(dishonest.evidence.results[0].evaluation.outcome).toBe('Fail');
    expect(dishonest.evidence.results[0].errors).toContain('registered digest/outcome/critical/duration/usage differs from evaluated evidence');
  });

  it('preserves truthful failing evidence as an observed failure, never a Pass',()=>{
    const {evidence}=fixture();evidence.answer='wrong';
    const report=runWith([seal(evidence)],[row(evidence,'Fail')]);
    expect(report.counts).toMatchObject({verifiedSelected:1,verifiedPass:0,recordedPass:0,missingRegisteredEvidence:0});
    expect(report.evidence.results[0].evaluation.errors).toContain('wrong delivered numeric/boolean answer');
  });

  it('rejects signature tampering and altered register metadata',()=>{
    const {evidence}=fixture(),envelope=seal(evidence);envelope.evidence.answer='tampered';
    const rejected=runWith([envelope],[row(evidence)]);
    expect(rejected.counts.verifiedSelected).toBe(0);
    expect(rejected.evidence.results[0].evaluation.errors).toContain('independent collector signature invalid/missing');
    for (const change of [{usage:'99'},{duration_ms:'999'},{app_digest:digest('other-app')},{evidence_digest:digest('other-evidence')},{critical_violation:'yes'}]) {
      const report=runWith([seal(evidence)],[{...row(evidence),...change}]);
      expect(report.counts.verifiedSelected).toBe(0);
    }
  });

  it('does not count duplicate envelopes or reuse one actual run as repetitions',()=>{
    const {evidence}=fixture(),other=structuredClone(evidence);other.attempt=2;
    const repeated=runWith([seal(evidence),seal(other)],[row(evidence),row(other)]);
    expect(repeated.counts.verifiedSelected).toBe(0);
    expect(repeated.evidence.results.every(r=>r.errors.some(e=>e.includes('runId reused')))).toBe(true);
    const duplicated=runWith([seal(evidence),seal(evidence)],[row(evidence)]);
    expect(duplicated.counts.verifiedSelected).toBe(0);
    expect(duplicated.evidence.results[1].errors).toContain('duplicate evidence envelope; not a new execution');
    other.runId='unit-independent-second-run';
    const staleCompletion=runWith([seal(other)],[row(other)]);
    expect(staleCompletion.evidence.results[0].evaluation.errors).toContain('missing completed UI run');
    other.events.find(event=>event.type==='ui-complete').runId=other.runId;
    const separate=runWith([seal(evidence),seal(other)],[row(evidence),row(other)]);
    expect(separate.counts.verifiedSelected).toBe(2);
    expect(separate.counts.verifiedPass).toBe(2);
  });

  it('does not accept an unknown profile, unregistered execution or malformed envelope',()=>{
    const {evidence}=fixture(),foreign=structuredClone(evidence);foreign.profileDigest=digest('unknown-profile');
    expect(runWith([seal(foreign)],[row(foreign)]).counts.verifiedSelected).toBe(0);
    expect(runWith([seal(evidence)],[]).evidence.results[0].errors).toContain('evidence must match exactly one registered attempt');
    const malformed=runWith([{evidence:null,signature:''}],[]);
    expect(malformed.evidence.results[0].errors).toContain('unknown evidence task');
    const bad=structuredClone(evidence);bad.events=[null];
    expect(runWith([seal(bad)],[row(bad)]).evidence.results[0].errors).toContain('malformed evidence cannot be evaluated');
  });

  it('reports absent source image/upstream and never promotes supplied gate documents into authority',()=>{
    const unknown=structuredClone(profile);unknown.identity.runner_image='unavailable';unknown.identity.model_version='unavailable';
    const input={...inventory(),prerequisites:[{id:'g9',path:'unit-only.json',status:'supplied-for-independent-review',digest:digest('unit bytes')}]};
    const report=preflight({corpus,profile:unknown,register:emptyRegister(),inventory:input});
    expect(report.prerequisites.find(p=>p.id==='source-runner').observed).toContain('source execution image unavailable');
    expect(report.prerequisites.find(p=>p.id==='fixed-upstream').observed).toContain('route-level evidence only');
    expect(report.prerequisites.find(p=>p.id==='g9').status).toBe('supplied-for-independent-review');
    expect(report.blockers.some(b=>b.code==='prerequisite-g9')).toBe(true);
  });

  it('reports changed live release without transferring historical evidence',()=>{
    const liveRelease={...profile.releaseIdentity,packageHash:'f'.repeat(64)};
    const report=preflight({corpus,profile,register:emptyRegister(),inventory:{...inventory(),liveRelease}});
    expect(report.liveRelease).toMatchObject({matches:false,status:'different-release',mismatches:['packageHash']});
    expect(report.blockers.some(b=>b.code==='live-release-mismatch')).toBe(true);
    const matched=preflight({corpus,profile,register:emptyRegister(),inventory:{...inventory(),liveRelease:profile.releaseIdentity}});
    expect(matched.liveRelease.matches).toBe(true);
    expect(matched.qualified).toBe(false);
  });

  it('invalidates corpus/profile drift without modifying the frozen inputs',()=>{
    const bad=structuredClone(profile);bad.corpusDigest=digest('wrong corpus');
    const report=preflight({corpus,profile:bad,register:emptyRegister()});
    expect(report.validation.profile).toContain('profile corpus digest mismatch');
    const register=emptyRegister();register.tasks.rows[0].input_digest=digest('wrong input');
    expect(preflight({corpus,profile,register}).validation.corpus.some(e=>e.includes('frozen register/input mismatch'))).toBe(true);
  });
});

describe('explicit-path inventory and existing CLI',()=>{
  it('loads relative paths, checks exact binary bytes and reports missing files without scanning',()=>{
    const dir=temp(),bytes=Buffer.from([255,0,128]);
    fs.writeFileSync(path.join(dir,'review.bin'),bytes);
    fs.writeFileSync(path.join(dir,'profile.json'),JSON.stringify(profile));
    fs.writeFileSync(path.join(dir,'release.json'),JSON.stringify(profile.releaseIdentity));
    fs.writeFileSync(path.join(dir,'index.json'),JSON.stringify({schema:'studio-g8-preflight-index-v1',profiles:['profile.json'],envelopes:['missing.json'],liveRelease:'release.json',
      prerequisites:[{id:'g9',path:'review.bin',digest:`sha256:${createHash('sha256').update(bytes).digest('hex')}`},{id:'g6-g7',path:'review.bin',digest:digest('wrong bytes')}]}));
    const got=readInventory(path.join(dir,'index.json'));
    expect(got.profiles[0].value.profile).toBe(profile.profile);
    expect(got.liveRelease).toEqual(profile.releaseIdentity);
    expect(got.errors).toContain('envelopes missing.json: ENOENT');
    expect(got.prerequisites[0].status).toBe('supplied-for-independent-review');
    expect(got.prerequisites[1].errors).toContain('prerequisite bytes/digest mismatch');
    expect(readInventory().errors).toEqual([]);
    expect(readInventory(path.join(dir,'absent.json')).errors[0]).toContain('index unreadable');
  });

  it('rejects malformed index collections as errors, not fake empty evidence',()=>{
    const dir=temp(),file=path.join(dir,'index.json');
    for (const value of [{schema:'wrong'},{schema:'studio-g8-preflight-index-v1',profiles:{}},{schema:'studio-g8-preflight-index-v1',prerequisites:{}}]) {
      fs.writeFileSync(file,JSON.stringify(value));expect(readInventory(file).errors.length).toBeGreaterThan(0);
    }
  });

  it('executes real preflight against the six actual registered rows without writing anything',()=>{
    const files=['docs/studio-v3-task-register/attempts.csv','docs/studio-v3-task-register/tasks.csv','docs/acceptance/STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json'];
    const before=files.map(file=>fs.readFileSync(file,'utf8'));
    const result=spawnSync(process.execPath,['scripts/studio-v3-g8.mjs','preflight',files[2]],{encoding:'utf8'});
    expect(result.status).toBe(1);
    const report=JSON.parse(result.stdout);
    expect(report.counts).toMatchObject({required:180,registeredTotal:6,registeredSelected:3,recordedSlots:3,missingSlots:177,recordedPass:3,verifiedPass:0,missingRegisteredEvidence:3});
    expect(report.actualProfiles).toHaveLength(2);
    expect(report.actualProfiles.map(p=>p.recordedSlots)).toEqual([3,3]);
    expect(report.actualProfiles.map(p=>p.pass)).toEqual([0,3]);
    expect(report.qualified).toBe(false);
    expect(files.map(file=>fs.readFileSync(file,'utf8'))).toEqual(before);
  });
});
