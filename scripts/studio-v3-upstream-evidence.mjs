import fs from 'node:fs';
import path from 'node:path';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {canonical,digest} from './studio-v3-g8-corpus.mjs';
import {parseLosslessRecords} from '../studio-v3/structured-import-parser.js';
import {JSON_DATA_LIMITS} from '../studio-v3/json-safety.js';

const same=(a,b)=>canonical(a)===canonical(b);
const sha=bytes=>`sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const known=value=>typeof value==='string' && !!value.trim() && !/^(unknown|unavailable|auto|latest|default|none|null|unspecified)(?:$|[-_ :])/i.test(value.trim());
const signed=(value,signature,key)=>{
  try { return createPublicKey(key).asymmetricKeyType==='ed25519' && verify(null,Buffer.from(canonical(value)),key,Buffer.from(signature || '','base64')); }
  catch { return false; }
};
const https=value=>{
  try { const url=new URL(value);return url.protocol==='https:' && !url.username && !url.password && !url.search && !url.hash?url:null; }
  catch { return null; }
};

const fail=code=>{throw Object.assign(new Error(code),{code});};
const identity=(a,b)=>a.dev===b.dev && a.ino===b.ino;
const unchanged=(a,b)=>identity(a,b) && a.size===b.size && a.mtimeNs===b.mtimeNs && a.ctimeNs===b.ctimeNs;

// Bound before allocating/reading. Check every component and the opened inode before
// consuming bytes, then recheck custody after reading; never follow the leaf symlink.
export function readUpstreamFile(base,relative,chargeBytes) {
  if (typeof relative!=='string' || relative.length>240 || !relative.split('/').every(part=>/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part) && part!=='.' && part!=='..')) fail('ARTIFACT_PATH');
  const baseStat=fs.lstatSync(base,{bigint:true});
  if (baseStat.isSymbolicLink()) fail('ARTIFACT_SYMLINK');
  const root=fs.realpathSync(base),parts=relative.split('/'),chain=[];
  if (!identity(baseStat,fs.lstatSync(root,{bigint:true}))) fail('ARTIFACT_PATH_CHANGED');
  let file=root;
  for (const part of ['',...parts]) {
    if (part) file=path.join(file,part);
    const stat=fs.lstatSync(file,{bigint:true});
    if (stat.isSymbolicLink()) fail('ARTIFACT_SYMLINK');
    if (file!==path.join(root,...parts) && !stat.isDirectory()) fail('ARTIFACT_TYPE');
    chain.push({file,stat});
  }
  const expected=chain.at(-1).stat;
  if (!expected.isFile() || expected.nlink!==1n || expected.size<1n || expected.size>BigInt(JSON_DATA_LIMITS.maxBytes)) fail('ARTIFACT_SIZE_OR_TYPE');
  const checkChain=()=>{
    for (const entry of chain) {
      const stat=fs.lstatSync(entry.file,{bigint:true});
      if (stat.isSymbolicLink() || !identity(entry.stat,stat)) fail('ARTIFACT_PATH_CHANGED');
    }
  };
  if (chargeBytes) chargeBytes(Number(expected.size));
  const fd=fs.openSync(file,fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before=fs.fstatSync(fd,{bigint:true});
    if (!before.isFile() || !unchanged(expected,before)) fail('ARTIFACT_CHANGED_DURING_READ');
    checkChain();
    const bytes=Buffer.allocUnsafe(Number(before.size)+1);
    let count=0,read;
    while (count<bytes.length && (read=fs.readSync(fd,bytes,count,bytes.length-count,null))>0) count+=read;
    if (BigInt(count)!==before.size || !unchanged(before,fs.fstatSync(fd,{bigint:true}))) fail('ARTIFACT_CHANGED_DURING_READ');
    checkChain();
    return bytes.subarray(0,count);
  } finally { fs.closeSync(fd); }
}
function parseUpstreamJson(bytes) {
  if (bytes.length>JSON_DATA_LIMITS.maxBytes) fail('JSON_SIZE_LIMIT');
  let source;
  try { source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes); }
  catch { fail('INVALID_UTF8'); }
  try { parseLosslessRecords(source);return JSON.parse(source); }
  catch (error) { fail(error.code || 'INVALID_JSON'); }
}

// Explicit indexed paths only; neither files nor embedded contents are returned in reports.
export function readUpstreamArtifacts(bytes,base,readFile=readUpstreamFile) {
  const envelope=parseUpstreamJson(bytes),artifacts=[];
  if ((envelope?.evidence?.statement?.artifacts?.length || 0)>3) fail('ARTIFACT_COUNT_LIMIT');
  for (const ref of Array.isArray(envelope?.evidence?.statement?.artifacts)?envelope.evidence.statement.artifacts:[]) {
    const item={kind:ref?.kind,errors:[]};
    if (typeof ref?.path!=='string' || !ref.path.trim() || !/^sha256:[a-f0-9]{64}$/.test(ref?.digest || '')) item.errors.push('explicit artifact path/byte digest required');
    else {
      try {
        const content=readFile(base,ref.path);
        if (sha(content)!==ref.digest) item.errors.push('artifact bytes/digest mismatch');
        else item.value=parseUpstreamJson(content);
      } catch (error) { item.errors.push(`artifact unreadable: ${error.code || 'invalid JSON'}`); }
    }
    artifacts.push(item);
  }
  return {envelope,artifacts};
}

// Collector custody authenticates the service-owner key binding; an arbitrary owner key
// in an unsigned JSON cannot become a trust root. This never grants production approval.
export function verifyUpstream({profile,inventory,checked,profileValidation=[],now=Date.now()}) {
  const refs=inventory.prerequisites.filter(item=>item.id==='fixed-upstream');
  const errors=profileValidation.map(error=>`invalid frozen profile: ${error}`);
  for (const error of checked.errors) errors.push(`invalid evidence inventory: ${error}`);
  if (refs.length!==1) errors.push('exactly one indexed fixed-upstream owner proof required');
  const loaded=refs[0]?.upstream;
  for (const ref of refs) errors.push(...(ref.errors || []));
  if (!loaded) errors.push('signed service-owner snapshot, owner-key source artifact and dispatch attribution artifacts missing');
  if (!known(profile?.identity?.model_version)) errors.push('frozen profile model_version unavailable; route-level evidence only');
  const summary={status:loaded?'invalid':'missing',verified:false,productionQualified:false,errors,requests:0,attributedRequests:0};
  if (!loaded) return summary;
  const {envelope,artifacts}=loaded,e=envelope?.evidence,s=e?.statement,snapshot=s?.snapshot;
  if (!signed(e,envelope?.signature,profile.collectorPublicKey)) errors.push('independent collector signature invalid/missing');
  if (e?.schema!=='studio-upstream-evidence-v1' || s?.schema!=='studio-upstream-owner-statement-v1') errors.push('upstream evidence/owner statement schema mismatch');
  if (e?.profileDigest!==digest(profile) || !same(e?.identity,profile.identity) || !same(e?.releaseIdentity,profile.releaseIdentity)) errors.push('exact frozen profile/release identity mismatch');
  if (!e || !s || !snapshot || typeof snapshot!=='object' || !Array.isArray(s.artifacts) || s.artifacts.some(ref=>!ref || typeof ref!=='object') || !Array.isArray(s.dispatches) || s.dispatches.some(item=>!item || typeof item!=='object')) {
    errors.push('malformed owner evidence/snapshot/artifact/dispatch structure');return summary;
  }
  if (!signed(s,e?.ownerSignature,e?.ownerPublicKey)) errors.push('service-owner signature invalid/missing');
  const route=https(profile?.identity?.provider_route);
  if (!route || snapshot?.route!==profile.identity.provider_route || snapshot?.alias!==profile.modelAlias || snapshot?.modelVersion!==profile.identity.model_version) errors.push('owner route/alias/model differs from frozen profile');
  for (const field of ['provider','model','modelVersion','snapshotId','configurationRevision']) if (!known(snapshot?.[field])) errors.push(`owner snapshot ${field} unknown/missing`);
  if (snapshot?.fallbackPolicy!=='disabled' || !Array.isArray(snapshot?.fallbacks) || snapshot.fallbacks.length) errors.push('fallback must be explicitly disabled with no alternate dispatch');
  const issued=s?.issuedAt,expires=s?.expiresAt;
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(issued) || !Number.isSafeInteger(expires) || issued>now || expires<=now || expires<=issued) errors.push('owner proof expired/future/invalid validity window');
  const refsByKind=new Map();
  for (const ref of Array.isArray(s?.artifacts)?s.artifacts:[]) {
    if (refsByKind.has(ref.kind)) errors.push('duplicate source artifact kind');
    refsByKind.set(ref.kind,ref);
    const source=https(ref.sourceUrl);
    if (!source || source.origin!==route?.origin || source.pathname==='/') errors.push('source artifact must identify an exact service-owner HTTPS document');
    if (!Number.isSafeInteger(ref.capturedAt) || ref.capturedAt<issued || ref.capturedAt>now || ref.capturedAt>=expires) errors.push('source artifact capture outside owner validity window');
  }
  const documents=new Map();
  for (const item of artifacts) {
    for (const error of item.errors) errors.push(`${item.kind || 'unknown'}: ${error}`);
    documents.set(item.kind,item.value);
  }
  for (const kind of ['owner-authorization','route-snapshot','dispatch-attribution']) if (!refsByKind.has(kind) || !documents.get(kind)) errors.push(`substantive ${kind} source artifact missing`);
  const authorization=documents.get('owner-authorization');
  if (authorization?.schema!=='studio-upstream-owner-authorization-v1' || !known(authorization?.ownerId) || authorization?.origin!==route?.origin || authorization?.publicKeyDigest!==digest(e?.ownerPublicKey ?? null) || authorization?.issuedAt!==issued || authorization?.expiresAt!==expires) errors.push('service-owner authorization/key/source binding mismatch');
  const config=documents.get('route-snapshot');
  if (config?.schema!=='studio-upstream-route-snapshot-v1' || !same(config?.snapshot,snapshot)) errors.push('route source artifact does not contain the exact pinned configuration');
  const ledger=documents.get('dispatch-attribution');
  if (ledger?.schema!=='studio-upstream-dispatch-attribution-v1' || !same(ledger?.dispatches,s?.dispatches)) errors.push('dispatch source artifact does not contain exact request attribution');
  const dispatches=Array.isArray(s?.dispatches)?s.dispatches:[];
  const selected=inventory.envelopes.filter(item=>item.value?.evidence?.profileDigest===digest(profile));
  if (!selected.length) errors.push('selected profile has no independently checked request envelopes');
  const expected=new Map();
  for (const item of selected) {
    const evidence=item.value.evidence;
    const result=checked.results.find(result=>result.path===item.path);
    if (!result?.evaluation || result.errors.length || !signed(evidence,item.value.signature,profile.collectorPublicKey)) errors.push('request envelope lacks independent signature/register custody');
    const bodies=Array.isArray(evidence.providerBodies)?evidence.providerBodies:[];
    if (!bodies.length) errors.push('request envelope has no dispatched request custody');
    for (const [index,body] of bodies.entries()) {
      if (!body || typeof body.body!=='string' || typeof body.digest!=='string') {
        errors.push('malformed dispatched request custody');continue;
      }
      const response=Array.isArray(evidence.providerResponses)?evidence.providerResponses.find(response=>response?.requestDigest===body.digest && typeof response.body==='string'):null;
      const key=`${digest(evidence)}|${index}`;
      expected.set(key,{evidence,body,response});
    }
  }
  summary.requests=expected.size;
  const seen=new Set(),requestIds=new Set();
  for (const dispatch of dispatches) {
    const key=`${dispatch?.evidenceDigest}|${dispatch?.requestIndex}`,entry=expected.get(key);
    if (!entry || seen.has(key)) { errors.push('foreign/duplicate request attribution');continue; }
    seen.add(key);
    if (!known(dispatch.requestId) || requestIds.has(dispatch.requestId)) errors.push('unique service-owner request ID missing/reused');
    requestIds.add(dispatch.requestId);
    const {evidence,body,response}=entry;
    if (dispatch.runId!==evidence.runId || dispatch.requestDigest!==body.digest || body.digest!==digest(body.body) || body.route!==snapshot?.route || !response || dispatch.responseDigest!==response.digest || response.digest!==digest(response.body)) errors.push('request/response/run custody mismatch');
    if (!Number.isSafeInteger(dispatch.dispatchedAt) || dispatch.dispatchedAt<evidence.startedAt || dispatch.dispatchedAt>evidence.endedAt || dispatch.dispatchedAt<issued || dispatch.dispatchedAt>=expires || dispatch.dispatchedAt>now) errors.push('request attribution outside execution/owner validity window');
    if (dispatch.snapshotDigest!==digest(snapshot) || dispatch.route!==snapshot?.route || dispatch.alias!==snapshot?.alias || dispatch.provider!==snapshot?.provider || dispatch.model!==snapshot?.model || dispatch.modelVersion!==snapshot?.modelVersion || dispatch.snapshotId!==snapshot?.snapshotId || dispatch.fallbackUsed!==false) errors.push('request dispatched to unpinned/unknown upstream or fallback');
  }
  if (seen.size!==expected.size || !expected.size) errors.push('per-request service-owner attribution missing');
  summary.attributedRequests=seen.size;
  summary.verified=errors.length===0;
  summary.status=summary.verified?'verified-for-independent-review':'invalid';
  return summary;
}

// Shared offline custody primitives; callers retain their own evidence schema and authority.
export {parseUpstreamJson,signed as verifyUpstreamSignature};
