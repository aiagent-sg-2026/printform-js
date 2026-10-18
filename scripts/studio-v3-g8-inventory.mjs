import path from 'node:path';
import {createHash} from 'node:crypto';
import {digest} from './studio-v3-g8-corpus.mjs';
import {evaluateEvidence,IDENTITY,profileErrors} from './studio-v3-g8-evaluator.mjs';
import {readUpstreamArtifacts,readUpstreamFile,parseUpstreamJson} from './studio-v3-upstream-evidence.mjs';
import {readGovernanceArtifacts} from './studio-v3-governance-evidence.mjs';
import {JSON_DATA_LIMITS} from '../studio-v3/json-safety.js';
import {FAMILIES,TARGET} from './studio-v3-task-register.mjs';

export const INVENTORY_LIMITS=Object.freeze({profiles:8,envelopes:8*FAMILIES.length*TARGET.perFamily*TARGET.repetitions,prerequisites:24,maxBytes:256*JSON_DATA_LIMITS.maxBytes});
export function createInventoryByteBudget() {
  let used=0;
  return bytes=>{
    if (!Number.isSafeInteger(bytes) || bytes<0 || bytes>INVENTORY_LIMITS.maxBytes-used) throw Object.assign(new Error('INVENTORY_BYTE_LIMIT'),{code:'INVENTORY_BYTE_LIMIT'});
    used+=bytes;
  };
}

// Explicit paths only: never scan a workspace, private evidence directory or holdout input.
export function readInventory(indexPath) {
  const inventory={profiles:[],envelopes:[],prerequisites:[],errors:[],liveRelease:null};
  if (!indexPath) return inventory;
  const base=path.dirname(path.resolve(indexPath));
  const chargeBytes=createInventoryByteBudget(),readFile=(root,file)=>readUpstreamFile(root,file,chargeBytes);
  let index;
  try { index=parseUpstreamJson(readFile(base,path.basename(indexPath))); }
  catch (error) { inventory.errors.push(`index unreadable: ${error.code || 'invalid JSON'}`); return inventory; }
  if (index?.schema!=='studio-g8-preflight-index-v1') {
    inventory.errors.push('index schema must be studio-g8-preflight-index-v1'); return inventory;
  }
  // Admit bounded collections before opening any referenced target; never truncate.
  for (const kind of ['profiles','envelopes','prerequisites']) {
    const refs=index[kind];
    if (refs===undefined) continue;
    if (!Array.isArray(refs) || refs.length>INVENTORY_LIMITS[kind]) { inventory.errors.push(`${kind}: array limit ${INVENTORY_LIMITS[kind]} exceeded or invalid collection`);continue; }
    const paths=refs.map(ref=>kind==='prerequisites'?ref?.path:ref);
    if (kind!=='prerequisites' && new Set(paths).size!==paths.length) inventory.errors.push(`${kind}: duplicate indexed path`);
    if (kind==='prerequisites' && new Set(refs.map(ref=>ref?.id)).size!==refs.length) inventory.errors.push('prerequisites: duplicate requirement ID');
  }
  if (inventory.errors.length) return inventory;
  Object.defineProperty(inventory,'governanceScope',{value:index.governanceScope});
  for (const kind of ['profiles','envelopes']) {
    for (const file of index[kind] || []) {
      if (typeof file!=='string' || !file.trim()) { inventory.errors.push(`${kind}: explicit path required`); continue; }
      try { inventory[kind].push({path:file,value:parseUpstreamJson(readFile(base,file))}); }
      catch (error) { inventory.errors.push(`${kind} ${file}: ${error.code || 'invalid JSON'}`); }
    }
  }
  if (index.liveRelease!==undefined) {
    try {
      if (typeof index.liveRelease!=='string') throw new Error();
      inventory.liveRelease=parseUpstreamJson(readFile(base,index.liveRelease));
    } catch (error) { inventory.errors.push(`live release unreadable: ${error.code || 'invalid path/JSON'}`); }
  }
  for (const ref of index.prerequisites || []) {
    const item={id:ref?.id,path:ref?.path,status:'invalid',errors:[]};
    if (typeof ref?.id!=='string' || typeof ref?.path!=='string' || !/^sha256:[a-f0-9]{64}$/.test(ref?.digest || '')) item.errors.push('id/path/exact byte digest required');
    else {
      try {
        const bytes=readFile(base,ref.path);
        if (`sha256:${createHash('sha256').update(bytes).digest('hex')}`!==ref.digest) item.errors.push('prerequisite bytes/digest mismatch');
        // These are review inputs, not a newly invented machine authority for G6/G9/DPA.
        else {
          item.status='supplied-for-independent-review'; item.digest=ref.digest;
          if (item.id==='fixed-upstream') Object.defineProperty(item,'upstream',{value:readUpstreamArtifacts(bytes,path.dirname(path.resolve(base,ref.path)),readFile)});
          if (item.id==='data-governance') Object.defineProperty(item,'governance',{value:readGovernanceArtifacts(bytes,path.dirname(path.resolve(base,ref.path)),readFile)});
        }
      } catch (error) { item.status='invalid';item.errors.push(`prerequisite unreadable: ${error.code || 'invalid JSON/read failed'}`); }
    }
    inventory.prerequisites.push(item);
  }
  return inventory;
}

const slotKey=e=>`${e.taskId}|${e.attempt}`;
export function inspectEvidence({corpus,register,profile,inventory}) {
  const selectedDigest=digest(profile), errors=[...inventory.errors],profiles=new Map([[selectedDigest,profile]]);
  for (const item of inventory.profiles) {
    const invalid=profileErrors(item.value,corpus);
    if (invalid.length) errors.push(`profile ${item.path}: ${invalid.join('; ')}`);
    else profiles.set(digest(item.value),item.value);
  }
  const seen=new Set(),runs=new Map(),results=[],verifiedRows=[],bySlot=new Map(),evidenceOf=new Map();
  for (const item of inventory.envelopes) {
    const envelope=item.value,e=envelope?.evidence,owner=profiles.get(e?.profileDigest);
    const result={path:item.path,taskId:e?.taskId ?? null,attempt:e?.attempt ?? null,profile:owner?.profile ?? null,errors:[]};
    evidenceOf.set(result,e);
    const c=corpus.find(task=>task.id===e?.taskId);
    if (!owner) result.errors.push('missing exact frozen profile for signed evidence');
    if (!c) result.errors.push('unknown evidence task');
    const evidenceDigest=e?digest(e):null;
    if (evidenceDigest && seen.has(evidenceDigest)) result.errors.push('duplicate evidence envelope; not a new execution');
    if (evidenceDigest) seen.add(evidenceDigest);
    if (owner && c) {
      try {
        result.evaluation=evaluateEvidence(c,envelope,owner,{corpus,register});
        if (c.holdout) {
          const oracleErrors=result.evaluation.errors;
          result.evaluation={...result.evaluation,errorCount:oracleErrors.length,errorsDigest:digest(oracleErrors),
            errors:oracleErrors.length?['Held-out oracle diagnostics withheld; review original evidence in independent custody.']:[]};
        }
        result.evidenceDigest=evidenceDigest;
      } catch { result.errors.push('malformed evidence cannot be evaluated'); }
      const rows=register.attempts.rows.filter(a=>a.profile===owner.profile && a.task_id===e.taskId && Number(a.attempt)===e.attempt);
      if (rows.length!==1) result.errors.push('evidence must match exactly one registered attempt');
      else if (result.evaluation) {
        const row=rows[0],v=result.evaluation;
        for (const key of IDENTITY) if (row[key]!==owner.identity[key]) result.errors.push(`registered ${key} differs from evidence profile`);
        if (row.evidence_digest!==evidenceDigest || row.outcome!==v.outcome || row.critical_violation!==v.critical_violation || Number(row.duration_ms)!==v.duration_ms || String(row.usage)!==String(e.usage)) result.errors.push('registered digest/outcome/critical/duration/usage differs from evaluated evidence');
      }
      const runKey=`${digest(owner)}|${e.runId}`;
      if (runs.has(runKey)) {
        result.errors.push('runId reused across evidence; repetitions require separate executions');
        runs.get(runKey).errors.push('runId reused across evidence; repetitions require separate executions');
      } else runs.set(runKey,result);
    }
    results.push(result);
  }
  // Build the trusted subset only after duplicate-run detection has examined every envelope.
  for (const result of results) {
    if (result.errors.length || !result.evaluation) continue;
    const e=evidenceOf.get(result);
    if (e?.profileDigest!==selectedDigest) continue;
    const key=slotKey(e);
    if (bySlot.has(key)) { errors.push(`multiple evidence records for ${key}`); continue; }
    bySlot.set(key,result);
    verifiedRows.push(register.attempts.rows.find(a=>a.profile===profile.profile && a.task_id===e.taskId && Number(a.attempt)===e.attempt));
  }
  const requiredRows=register.attempts.rows.filter(a=>a.profile===profile.profile);
  const missing=requiredRows.filter(row=>!bySlot.has(`${row.task_id}|${Number(row.attempt)}`)).map(row=>({taskId:row.task_id,attempt:Number(row.attempt),outcome:row.outcome,evidenceDigest:row.evidence_digest || null}));
  return {profiles:profiles.size,results,verifiedRows,bySlot,missing,errors};
}
