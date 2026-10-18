import {afterEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {canonical,digest} from '../scripts/studio-v3-g8-corpus.mjs';
import {readInventory} from '../scripts/studio-v3-g8-inventory.mjs';
import {preflight} from '../scripts/studio-v3-g8-preflight.mjs';
import {readRegister,ATTEMPT_COLUMNS} from '../scripts/studio-v3-task-register.mjs';
import {readUpstreamArtifacts,readUpstreamFile} from '../scripts/studio-v3-upstream-evidence.mjs';
import {JSON_DATA_LIMITS} from '../studio-v3/json-safety.js';
import {corpus,profile as baseProfile,fixture,seal} from './support/g8-evidence-fixture.js';

// Synthetic custody/consumer inputs only; no service/model execution or formal attempts.
const temporary=[];
afterEach(()=>{vi.restoreAllMocks();for (const dir of temporary.splice(0)) fs.rmSync(dir,{recursive:true,force:true});});
function setup(change=()=>{}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'upstream-unit-'));temporary.push(dir);
  const now=Date.now(),issuedAt=now-5000,expiresAt=now+60000;
  const profile=structuredClone(baseProfile);
  profile.identity.provider_route='https://gateway.example/demo/v1/responses';
  profile.identity.model_version='unit-pinned-revision-1';
  const {evidence}=fixture();
  evidence.identity=structuredClone(profile.identity);evidence.profileDigest=digest(profile);
  evidence.startedAt=now-3000;evidence.endedAt=now-1000;
  for (const body of evidence.providerBodies) body.route=profile.identity.provider_route;
  const owner=generateKeyPairSync('ed25519');
  const ownerPublicKey=owner.publicKey.export({format:'pem',type:'spki'});
  const snapshot={route:profile.identity.provider_route,alias:profile.modelAlias,provider:'unit-provider',model:'unit-model',modelVersion:profile.identity.model_version,snapshotId:'unit-immutable-snapshot',configurationRevision:'unit-config-1',fallbackPolicy:'disabled',fallbacks:[]};
  const dispatches=evidence.providerBodies.map((body,requestIndex)=>({evidenceDigest:digest(evidence),requestIndex,runId:evidence.runId,requestId:`unit-owner-request-${requestIndex}`,requestDigest:body.digest,responseDigest:evidence.providerResponses[requestIndex].digest,dispatchedAt:now-2000,snapshotDigest:digest(snapshot),route:snapshot.route,alias:snapshot.alias,provider:snapshot.provider,model:snapshot.model,modelVersion:snapshot.modelVersion,snapshotId:snapshot.snapshotId,fallbackUsed:false}));
  const statement={schema:'studio-upstream-owner-statement-v1',issuedAt,expiresAt,snapshot,dispatches,artifacts:[]};
  const proof={schema:'studio-upstream-evidence-v1',profileDigest:digest(profile),identity:structuredClone(profile.identity),releaseIdentity:structuredClone(profile.releaseIdentity),ownerPublicKey,statement};
  const documents={
    'owner-authorization':{schema:'studio-upstream-owner-authorization-v1',ownerId:'unit-service-owner',origin:'https://gateway.example',publicKeyDigest:digest(ownerPublicKey),issuedAt,expiresAt},
    'route-snapshot':{schema:'studio-upstream-route-snapshot-v1',snapshot},
    'dispatch-attribution':{schema:'studio-upstream-dispatch-attribution-v1',dispatches}
  };
  change({profile,evidence,proof,statement,snapshot,dispatches,documents});
  for (const [kind,value] of Object.entries(documents)) {
    const file=`${kind}.json`,content=JSON.stringify(value);fs.writeFileSync(path.join(dir,file),content);
    statement.artifacts.push({kind,path:file,digest:digest(content),sourceUrl:`https://gateway.example/owner-evidence/${kind}`,capturedAt:now-500});
  }
  proof.ownerSignature=sign(null,Buffer.from(canonical(statement)),owner.privateKey).toString('base64');
  const bytes=JSON.stringify(seal(proof));fs.writeFileSync(path.join(dir,'proof.json'),bytes);
  fs.writeFileSync(path.join(dir,'request.json'),JSON.stringify(seal(evidence)));
  const index={schema:'studio-g8-preflight-index-v1',envelopes:['request.json'],prerequisites:[{id:'fixed-upstream',path:'proof.json',digest:digest(bytes)}]};
  const indexPath=path.join(dir,'index.json');fs.writeFileSync(indexPath,JSON.stringify(index));
  fs.writeFileSync(path.join(dir,'profile.json'),JSON.stringify(profile));
  const row={...Object.fromEntries(ATTEMPT_COLUMNS.map(key=>[key,''])),...profile.identity,task_id:evidence.taskId,profile:profile.profile,attempt:'1',outcome:'Pass',critical_violation:'no',oracle_result:'Synthetic unit expectation only; never a formal service/model observation',evidence_digest:digest(evidence),duration_ms:String(evidence.endedAt-evidence.startedAt),usage:String(evidence.usage)};
  const register={...readRegister(),attempts:{header:[...ATTEMPT_COLUMNS],rows:[row]}};
  const report=()=>preflight({corpus,profile,register,inventory:readInventory(indexPath)});
  const result=()=>report().prerequisites.find(item=>item.id==='fixed-upstream').verification;
  return {dir,index,indexPath,profile,report,result};
}
function rawPackage(file,content) {
  return Buffer.from(JSON.stringify({evidence:{statement:{artifacts:[{kind:'route-snapshot',path:file,digest:digest(content.toString('utf8'))}]}}}));
}

describe('untrusted upstream package file boundaries',()=>{
  it('rejects absolute/traversal/platform escape paths before opening any target',()=>{
    const {dir}=setup(),open=vi.spyOn(fs,'openSync');
    for (const file of ['/etc/passwd','../outside.json','a/../../outside.json','a/./file.json','a//file.json','C:\\\\secret.json','a\\\\secret.json']) {
      expect(readUpstreamArtifacts(rawPackage(file,Buffer.from('{}')),dir).artifacts[0].errors).toContain('artifact unreadable: ARTIFACT_PATH');
    }
    expect(open).not.toHaveBeenCalled();
  });

  it('refuses leaf and directory symlinks without reading linked contents',()=>{
    const {dir}=setup(),outside=fs.mkdtempSync(path.join(os.tmpdir(),'upstream-outside-'));temporary.push(outside);
    fs.writeFileSync(path.join(outside,'secret.json'),'{}');
    fs.symlinkSync(path.join(outside,'secret.json'),path.join(dir,'leaf.json'));
    fs.symlinkSync(outside,path.join(dir,'linked'));
    const read=vi.spyOn(fs,'readSync');
    for (const file of ['leaf.json','linked/secret.json']) {
      expect(()=>readUpstreamFile(dir,file)).toThrow('ARTIFACT_SYMLINK');
    }
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects directories and oversized proof/source files before allocating or reading',()=>{
    const input=setup();fs.mkdirSync(path.join(input.dir,'directory'));
    const huge=path.join(input.dir,'huge.json'),fd=fs.openSync(huge,'w');
    fs.ftruncateSync(fd,JSON_DATA_LIMITS.maxBytes+1);fs.closeSync(fd);
    const read=vi.spyOn(fs,'readSync');
    for (const file of ['directory','huge.json']) expect(()=>readUpstreamFile(input.dir,file)).toThrow('ARTIFACT_SIZE_OR_TYPE');
    expect(read).not.toHaveBeenCalled();read.mockRestore();
    input.index.prerequisites[0].path='huge.json';
    fs.writeFileSync(input.indexPath,JSON.stringify(input.index));
    expect(input.result().errors).toContain('prerequisite unreadable: ARTIFACT_SIZE_OR_TYPE');
  });

  it('rejects duplicate keys and non-UTF8 in both envelope and referenced JSON',()=>{
    const {dir}=setup();
    const duplicate=Buffer.from('{\"snapshot\":{},\"snapshot\":{\"model\":\"other\"}}');
    const nonUtf8=Buffer.from([123,34,120,34,58,34,255,34,125]);
    for (const [bytes,code] of [[duplicate,'INVALID_JSON'],[nonUtf8,'INVALID_UTF8']]) {
      expect(()=>readUpstreamArtifacts(bytes,dir)).toThrow(code);
      const file=path.join(dir,'untrusted.json');fs.writeFileSync(file,bytes);
      const packageBytes=Buffer.from(JSON.stringify({evidence:{statement:{artifacts:[{kind:'route-snapshot',path:'untrusted.json',digest:`sha256:${createHash('sha256').update(bytes).digest('hex')}`}]}}}));
      expect(readUpstreamArtifacts(packageBytes,dir).artifacts[0].errors).toContain(`artifact unreadable: ${code}`);
    }
  });

  it('rejects a swapped inode before reading its bytes',()=>{
    const {dir}=setup(),target=path.join(fs.realpathSync(dir),'swap.json');fs.writeFileSync(target,'{}');
    const original=fs.openSync.bind(fs);let swapped=false;
    vi.spyOn(fs,'openSync').mockImplementation((file,...args)=>{
      if (file===target && !swapped) {swapped=true;fs.renameSync(target,`${target}.old`);fs.writeFileSync(target,'{"private":"must-not-read"}');}
      return original(file,...args);
    });
    const read=vi.spyOn(fs,'readSync');
    expect(()=>readUpstreamFile(dir,'swap.json')).toThrow('ARTIFACT_CHANGED_DURING_READ');
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects bytes that grow while the descriptor is being read',()=>{
    const {dir}=setup(),target=path.join(dir,'growing.json');fs.writeFileSync(target,'{}');
    const original=fs.readSync.bind(fs);let changed=false;
    vi.spyOn(fs,'readSync').mockImplementation((...args)=>{
      const count=original(...args);
      if (!changed) {changed=true;fs.appendFileSync(target,' ');}
      return count;
    });
    expect(()=>readUpstreamFile(dir,'growing.json')).toThrow('ARTIFACT_CHANGED_DURING_READ');
  });

  it('resolves artifact paths from the envelope directory, not the inventory directory',()=>{
    const input=setup(),nested=path.join(input.dir,'package');fs.mkdirSync(nested);
    for (const file of ['proof.json','owner-authorization.json','route-snapshot.json','dispatch-attribution.json']) fs.renameSync(path.join(input.dir,file),path.join(nested,file));
    input.index.prerequisites[0].path='package/proof.json';fs.writeFileSync(input.indexPath,JSON.stringify(input.index));
    expect(input.result().verified).toBe(true);
  });
});


describe('fixed upstream signed source and per-request custody consumer',()=>{
  it('verifies actual artifact content and every request without promoting production qualification',()=>{
    const input=setup(),report=input.report(),upstream=report.prerequisites.find(item=>item.id==='fixed-upstream');
    expect(report.validation.corpus).toEqual([]);
    expect(report.evidence.results[0].errors).toEqual([]);
    expect(report.evidence.results[0].evaluation.errors).toEqual([]);
    expect(upstream.verification).toMatchObject({verified:true,productionQualified:false,requests:2,attributedRequests:2,errors:[]});
    expect(upstream.status).toBe('verified-for-independent-review');
    expect(report.qualified).toBe(false);
    expect(report.blockers.some(item=>item.code==='prerequisite-fixed-upstream')).toBe(true);
    const text=JSON.stringify(report);
    expect(text).not.toContain('unit-service-owner');
    expect(text).not.toContain('unit-owner-request-0');
    expect(text).not.toContain('BEGIN PUBLIC KEY');
  });

  it('rejects source byte tampering even if envelope itself remains authentic',()=>{
    const input=setup();fs.writeFileSync(path.join(input.dir,'route-snapshot.json'),'{}');
    expect(input.result().verified).toBe(false);
    expect(input.result().errors).toContain('route-snapshot: artifact bytes/digest mismatch');
  });

  it('does not accept title/status documents or self-asserted qualification in place of substantive sources',()=>{
    const input=setup(({documents})=>{documents['route-snapshot']={title:'Pinned upstream',status:'approved',qualified:true};});
    expect(input.result().verified).toBe(false);
    expect(input.result().errors).toContain('route source artifact does not contain the exact pinned configuration');
  });
  it('refuses missing source files and incomplete indexed request custody',()=>{
    const input=setup();fs.rmSync(path.join(input.dir,'dispatch-attribution.json'));
    expect(input.result().verified).toBe(false);
    expect(input.result().errors).toContain('dispatch-attribution: artifact unreadable: ENOENT');
    const incomplete=setup();incomplete.index.envelopes.push('missing-request.json');
    fs.writeFileSync(incomplete.indexPath,JSON.stringify(incomplete.index));
    expect(incomplete.result().verified).toBe(false);
    expect(incomplete.result().errors).toContain('invalid evidence inventory: envelopes missing-request.json: ENOENT');
  });


  it('rejects wrong profile/release and unavailable model without migrating historical identities',()=>{
    for (const change of [({proof})=>{proof.profileDigest=digest('other');},({proof})=>{proof.releaseIdentity.packageHash='f'.repeat(64);},({snapshot})=>{snapshot.modelVersion='unavailable';}]) {
      expect(setup(change).result().verified).toBe(false);
    }
    const input=setup();input.profile.identity.model_version='unavailable';
    expect(input.result().errors).toContain('frozen profile model_version unavailable; route-level evidence only');
  });

  it('rejects expired/future owner proof and stale source capture',()=>{
    for (const change of [({statement})=>{statement.expiresAt=Date.now()-1;},({statement})=>{statement.issuedAt=Date.now()+60000;}]) expect(setup(change).result().verified).toBe(false);
    const input=setup(({statement})=>{statement.issuedAt=Date.now()-100;});
    expect(input.result().errors).toContain('source artifact capture outside owner validity window');
  });

  it('requires all per-request owner attributions, exact response custody and no fallback',()=>{
    const missing=setup(({dispatches})=>dispatches.pop());
    expect(missing.result().errors).toContain('per-request service-owner attribution missing');
    for (const change of [({dispatches})=>{dispatches[0].responseDigest=digest('wrong');},({dispatches})=>{dispatches[0].provider='unknown';},({dispatches})=>{dispatches[0].fallbackUsed=true;},({snapshot})=>{snapshot.fallbacks=['other'];},({dispatches})=>{dispatches[1].requestId=dispatches[0].requestId;}]) expect(setup(change).result().verified).toBe(false);
  });

  it('requires both trusted collector custody and the bound service-owner signature',()=>{
    const input=setup(),file=path.join(input.dir,'proof.json'),envelope=JSON.parse(fs.readFileSync(file,'utf8'));
    envelope.evidence.ownerSignature='not-an-owner-signature';
    const content=JSON.stringify(seal(envelope.evidence));fs.writeFileSync(file,content);
    input.index.prerequisites[0].digest=digest(content);fs.writeFileSync(input.indexPath,JSON.stringify(input.index));
    expect(input.result().errors).toContain('service-owner signature invalid/missing');
    envelope.signature='not-a-collector-signature';
    const unsigned=JSON.stringify(envelope);fs.writeFileSync(file,unsigned);
    input.index.prerequisites[0].digest=digest(unsigned);fs.writeFileSync(input.indexPath,JSON.stringify(input.index));
    expect(input.result().errors).toContain('independent collector signature invalid/missing');
  });

  it('reports missing or malformed proof as unqualified rather than crashing',()=>{
    const input=setup();
    for (const value of [{qualified:true},null,{evidence:{statement:{snapshot:{},artifacts:[null],dispatches:[]}}}]) {
      const content=JSON.stringify(value);fs.writeFileSync(path.join(input.dir,'proof.json'),content);
      input.index.prerequisites[0].digest=digest(content);fs.writeFileSync(input.indexPath,JSON.stringify(input.index));
      expect(input.result().verified).toBe(false);
    }
    input.index.prerequisites=[];fs.writeFileSync(input.indexPath,JSON.stringify(input.index));
    expect(input.result()).toMatchObject({status:'missing',verified:false});
  });

  it('exposes a read-only CLI with missing-proof refusal and no model dispatch',()=>{
    const input=setup();
    const result=spawnSync(process.execPath,['scripts/studio-v3-g8.mjs','upstream',path.join(input.dir,'profile.json')],{encoding:'utf8'});
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({offline:true,modelCalls:0,attemptsWritten:0,status:'missing',verification:{verified:false,productionQualified:false}});
  });
});
