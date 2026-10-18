import {digest,validateCorpus} from './studio-v3-g8-corpus.mjs';
import {profileErrors,IDENTITY} from './studio-v3-g8-evaluator.mjs';
import {FAMILIES,TARGET,qualification} from './studio-v3-task-register.mjs';
import {inspectEvidence} from './studio-v3-g8-inventory.mjs';
import {verifyUpstream} from './studio-v3-upstream-evidence.mjs';
import {verifyGovernance} from './studio-v3-governance-evidence.mjs';

const REQUIREMENTS=Object.freeze([
  {id:'source-runner',scope:'original-source-slots',requirement:'Paired same-release Node24 Docker runner; immutable image digest, source lease, complete independent process/tree/build/artifact receipts.'},
  {id:'fixed-upstream',scope:'model-attribution',requirement:'Service-owner fixed upstream provider/model snapshot, route configuration, no unknown fallback and per-request dispatch proof; alias alone is insufficient.'},
  {id:'g6-g7',scope:'complete-coding-agent',requirement:'Exact-profile isolated execution, confinement/recovery and artifact gate evidence; a single source workflow is not complete G6/G7.'},
  {id:'data-governance',scope:'real-data-production-only',requirement:'Applicable operator/tenant DPA, confidentiality, training, retention/deletion, regions, subprocessors and explicit disclosure authority. Fictional offline diagnostics do not grant real-data permission.'},
  {id:'g9',scope:'production-release',requirement:'Exact deployment/tenant/authentication/isolation, route conformance, capacity/cost/audit/incident/rollback evidence and maintainer release decision.'},
  {id:'live-release',scope:'profile-reuse',requirement:'Independent live app/knowledge/contract release identity must equal the frozen profile; do not transfer old Pass to a newer build.'}
]);

function dependencies(profile,inventory,evidence,profileValidation) {
  return REQUIREMENTS.map(requirement=>{
    const refs=inventory.prerequisites.filter(item=>item.id===requirement.id);
    const supplied=refs.filter(ref=>ref.status==='supplied-for-independent-review');
    let observed='not evidenced';
    if (requirement.id==='source-runner') observed=/^sha256:[a-f0-9]{64}$/.test(profile?.identity?.runner_image || '')?'profile records immutable image; current broker availability, same-release lease and receipts still require observation':`profile runner_image=${profile?.identity?.runner_image ?? 'missing'}; source execution image unavailable`;
    if (requirement.id==='fixed-upstream') {
      const verification=verifyUpstream({profile,inventory,checked:evidence,profileValidation});
      return {...requirement,observed:verification.verified?'Owner signature, pinned source documents and every indexed request attribution verified; independent review still required':verification.errors.join('; '),status:verification.status,references:refs,verification};
    }
    if (requirement.id==='data-governance') {
      const verification=verifyGovernance({profile,inventory,profileValidation});
      return {...requirement,observed:verification.reviewable?'Signed scope, source bytes and claim citations checked; DPA applicability and disclosure authority still require independent review':verification.errors.join('; '),status:verification.status,references:refs,verification};
    }
    return {...requirement,observed,status:supplied.length?'supplied-for-independent-review':'missing',references:refs};
  });
}

function releaseComparison(profile,inventory) {
  const actual=inventory.liveRelease;
  if (!actual) return {status:'not-supplied',matches:false};
  const keys=['release','contractHash','knowledgeHash','packageHash'];
  const mismatches=keys.filter(key=>actual[key]!==profile.releaseIdentity?.[key]);
  return {status:mismatches.length?'different-release':'matches-supplied-identity',matches:mismatches.length===0,mismatches,
    actual:Object.fromEntries(keys.map(key=>[key,actual[key] ?? null]))};
}

const REQUIRED_EVIDENCE=Object.freeze({
  answer:['signed UI/wire before-after custody','paired grounded read and finish_answer responses'],
  candidate:['signed UI/wire before-after custody','private candidate','independent DOM geometry/rows/cells'],
  source:['signed UI/wire before-after custody','private candidate and DOM geometry','full initial/input/final trees','actual test/build process receipts','generated artifact bytes/lineage and import event'],
  denial:['signed UI/wire before-after custody','actual report_blocked tool receipt','unchanged committed state'],
  roundtrip:['signed UI/wire before-after custody','human Save/Open events','exact downloaded bytes and reopened state'],
  history:['signed UI/wire before-after custody','private candidate and DOM geometry','human Apply/Undo/Redo events and actual states']
});

// Offline consumer only. This function never schedules calls, acquires grants, writes attempts,
// treats signatures as truth, or interprets review documents as newly invented gate authority.
export function preflight({corpus,register,profile,inventory={profiles:[],envelopes:[],prerequisites:[],errors:[]}}) {
  const validation={corpus:validateCorpus(corpus,register),profile:profileErrors(profile,corpus),
    prerequisites:inventory.prerequisites.flatMap(item=>[
      ...(!REQUIREMENTS.some(required=>required.id===item.id)?[`unknown prerequisite ${item.id ?? '(missing id)'}`]:[]),
      ...(item.errors || []).map(error=>`${item.id ?? '(missing id)'}: ${error}`)
    ])};
  const evidence=inspectEvidence({corpus,register,profile,inventory});
  const recorded=qualification(register,profile.profile);
  const verified=qualification({...register,attempts:{...register.attempts,rows:evidence.verifiedRows}},profile.profile);
  const mine=register.attempts.rows.filter(row=>row.profile===profile.profile);
  const unsupported=corpus.filter(c=>c.oracle.kind==='denial').map(c=>({taskId:c.id,family:c.family,holdout:!!c.holdout,inputDigest:digest(c.input),reason:'frozen denial matches Blocked, never Pass'}));
  const ceiling=(corpus.length-unsupported.length)*TARGET.repetitions;
  const families=Object.fromEntries(FAMILIES.map(family=>{
    const cases=corpus.filter(c=>c.family===family),blocked=unsupported.filter(c=>c.family===family).length;
    return [family,{...recorded.families[family],required:TARGET.perFamily*TARGET.repetitions,minPass:TARGET.minFamilyPass,verifiedPass:verified.families[family].pass,unsupportedTasks:blocked,maxPass:(cases.length-blocked)*TARGET.repetitions}];
  }));
  const slots=corpus.flatMap(c=>Array.from({length:TARGET.repetitions},(_,i)=>{
    const attempt=i+1,rows=mine.filter(row=>row.task_id===c.id && Number(row.attempt)===attempt);
    const v=evidence.bySlot.get(`${c.id}|${attempt}`);
    return {taskId:c.id,family:c.family,essential:c.essential || null,holdout:!!c.holdout,inputDigest:digest(c.input),attempt,
      expectedDisposition:c.oracle.kind==='denial'?'Blocked':'positive-task',requiredEvidence:REQUIRED_EVIDENCE[c.oracle.kind] || [],registeredRows:rows.length,
      recordedOutcome:rows.length===1?rows[0].outcome:null,evidenceDigest:rows.length===1?rows[0].evidence_digest || null:null,
      evidenceStatus:v?'checked-against-independent-oracle':'missing-or-invalid',evaluatedOutcome:v?.evaluation.outcome ?? null};
  }));
  const names=[...new Set(register.attempts.rows.map(row=>row.profile))];
  const actualProfiles=names.map(name=>{
    const q=qualification(register,name),rows=register.attempts.rows.filter(row=>row.profile===name);
    const identities=[...new Set(rows.map(row=>digest(Object.fromEntries(IDENTITY.map(key=>[key,row[key]])))))];
    const recordedSlots=new Set(rows.filter(row=>/^[1-3]$/.test(row.attempt) && corpus.some(c=>c.id===row.task_id)).map(row=>`${row.task_id}|${row.attempt}`)).size;
    const checked=evidence.results.filter(result=>result.profile===name && result.evaluation && result.errors.length===0);
    return {profile:name,selected:name===profile.profile,registered:rows.length,required:q.required,recordedSlots,missingSlots:q.required-recordedSlots,pass:q.pass,critical:q.critical,extraAttempts:q.extraAttempts,recordedQualified:q.qualified,checkedEnvelopes:checked.length,checkedPass:checked.filter(result=>result.evaluation.outcome==='Pass').length,identityVariants:identities.length};
  });
  const prerequisites=dependencies(profile,inventory,evidence,validation.profile);
  const liveRelease=releaseComparison(profile,inventory);
  const blockers=[];
  for (const [type,errors] of Object.entries(validation)) for (const error of errors) blockers.push({code:`invalid-${type}`,detail:error});
  if (ceiling<TARGET.minPass) blockers.push({code:'immutable-pass-ceiling',detail:`Frozen denial semantics cap Pass at ${ceiling}/${recorded.required}; original minimum remains ${TARGET.minPass}.`});
  for (const [family,counts] of Object.entries(families)) if (counts.maxPass<TARGET.minFamilyPass) blockers.push({code:'immutable-family-ceiling',family,detail:`Maximum ${counts.maxPass}/${counts.required}; original minimum remains ${TARGET.minFamilyPass}.`});
  for (const reason of recorded.reasons) blockers.push({code:'recorded-qualification',detail:reason});
  for (const item of prerequisites) blockers.push({code:`prerequisite-${item.id}`,detail:`${item.status}: ${item.requirement}`});
  for (const error of evidence.errors) blockers.push({code:'invalid-evidence-index',detail:error});
  for (const result of evidence.results) for (const error of result.errors) blockers.push({code:'invalid-evidence',path:result.path,detail:error});
  for (const row of evidence.missing) blockers.push({code:'missing-registered-evidence',...row});
  if (liveRelease.status==='different-release') blockers.push({code:'live-release-mismatch',detail:'Supplied live release differs from frozen evidence profile; historical attempts cannot transfer.',mismatches:liveRelease.mismatches});
  const checked=evidence.verifiedRows.length;
  const qualified=recorded.qualified && verified.qualified && blockers.length===0;
  const executionBlockers=blockers.filter(item=>!['recorded-qualification','missing-registered-evidence'].includes(item.code));
  const readyForFullQualification=executionBlockers.length===0;
  return {schema:'studio-g8-preflight-v1',offline:true,modelCalls:0,attemptsWritten:0,qualified,
    readyForFullQualification,executionDecision:readyForFullQualification?'eligible-for-independent-execution-review':'refuse-full-qualification-before-model-dispatch',
    profile:profile.profile,profileDigest:digest(profile),identity:profile.identity,releaseIdentity:profile.releaseIdentity,
    corpus:{tasks:corpus.length,holdout:corpus.filter(c=>c.holdout).length,digest:digest(corpus),unsupportedTasks:unsupported.length,maxPass:ceiling,minPass:TARGET.minPass},
    counts:{required:recorded.required,registeredTotal:register.attempts.rows.length,registeredSelected:mine.length,recordedSlots:slots.filter(s=>s.registeredRows>0).length,missingSlots:slots.filter(s=>s.registeredRows===0).length,recordedPass:recorded.pass,verifiedSelected:checked,verifiedPass:verified.pass,missingRegisteredEvidence:evidence.missing.length,providedEnvelopes:inventory.envelopes.length,knownEvidenceProfiles:evidence.profiles},
    actualProfiles,families,essential:recorded.essential.map(item=>({...item,required:TARGET.repetitions,verifiedPass:verified.essential.find(v=>v.slot===item.slot).pass})),
    unsupported,slots,prerequisites,liveRelease,evidence:{results:evidence.results,missing:evidence.missing,errors:evidence.errors},validation,blockers,
    limitations:['Preflight is not 180 model executions or a production approval.','Prerequisite documents are byte-checked review inputs, never automatic G6/G7/G9/DPA qualification.','Recorded Pass is separate from signed evidence re-evaluated against its exact frozen profile.','Current broker availability/source lease is unobserved offline; historical runner evidence is not a current lease.']};
}
