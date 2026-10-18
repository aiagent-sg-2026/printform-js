import {afterEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {digest} from '../scripts/studio-v3-g8-corpus.mjs';
import {readInventory,INVENTORY_LIMITS,createInventoryByteBudget} from '../scripts/studio-v3-g8-inventory.mjs';
import {preflight} from '../scripts/studio-v3-g8-preflight.mjs';
import {readGovernanceArtifacts,verifyGovernance} from '../scripts/studio-v3-governance-evidence.mjs';
import {readUpstreamFile,readUpstreamArtifacts} from '../scripts/studio-v3-upstream-evidence.mjs';
import {readRegister} from '../scripts/studio-v3-task-register.mjs';
import {JSON_DATA_LIMITS} from '../studio-v3/json-safety.js';
import {corpus,profile as baseProfile,seal} from './support/g8-evidence-fixture.js';

// Fictional signed dossiers test the real offline consumer, not any vendor's legal authority.
const temporary=[];
afterEach(()=>{vi.restoreAllMocks();for (const dir of temporary.splice(0)) fs.rmSync(dir,{recursive:true,force:true});});
const walk=(value,prefix='',result=[])=>{
  if (value!==null && typeof value==='object') for (const [key,next] of Object.entries(value)) walk(next,`${prefix}/${key}`,result);
  else result.push([prefix,value]);
  return result;
};
function setup(change=()=>{}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'governance-unit-'));temporary.push(dir);
  const now=Date.now(),profile=structuredClone(baseProfile);
  profile.identity.provider_route='https://gateway.example/demo/v1/responses';profile.identity.model_version='unit-model-20261001';
  const scope={operatorId:'unit-operator',operatorLegalName:'Unit Operator Ltd',tenantId:'unit-tenant',tenantLegalName:'Unit Tenant Ltd',route:profile.identity.provider_route,provider:'Unit Provider Ltd',model:'unit-model',modelVersion:profile.identity.model_version};
  const controls={dataClasses:['fictional-contact-data'],purpose:'Create a printable draft',confidentiality:'Authorized personnel under confidentiality obligations only',training:{operator:'not-used',provider:'not-used',conditions:'No voluntary training sharing enabled'},countries:{operator:['SG'],provider:['US']},retention:[],subprocessors:{mode:'listed',entries:[{id:'unit-cloud',legalName:'Unit Cloud Ltd',purpose:'Host the contracted service',countries:['US']}]}};
  for (const party of ['operator','provider']) for (const system of ['application-state','abuse-logs','backups']) controls.retention.push({party,system,policy:'Delete after the contracted service purpose ends',deletionTrigger:'Tenant termination request',deleteWithinDays:30,exceptions:'Legal hold requires documented isolation and review'});
  const contract={reference:'Unit DPA 2026-10 revision 2',parties:[scope.operatorLegalName,scope.tenantLegalName,scope.provider],effectiveOn:new Date(now-86400000).toISOString().slice(0,10),expiresOn:new Date(now+172800000).toISOString().slice(0,10),disclosureAuthority:'Unit tenant officer authorizes this named purpose and data class'};
  const review={reviewerId:'unit-privacy-officer',role:'Accountable tenant privacy reviewer',reviewedAt:now-2000,decision:'submitted-for-independent-review'};
  const statement={schema:'studio-governance-statement-v1',issuedAt:now-1000,expiresAt:now+60000,scope,controls,contract,review,artifacts:[],citations:[]};
  const evidence={schema:'studio-governance-evidence-v1',profileDigest:digest(profile),identity:structuredClone(profile.identity),releaseIdentity:structuredClone(profile.releaseIdentity),statement};
  change({profile,scope,controls,contract,review,statement,evidence,now});
  const documents=new Map(['contract','disclosure-authority','route-configuration','privacy-controls','accountable-review'].map(kind=>[kind,[]]));
  for (const [field,value] of walk({scope,controls,contract,review})) {
    const kind=field.startsWith('/scope/')?(['/scope/route','/scope/provider','/scope/model','/scope/modelVersion'].includes(field)?'route-configuration':'contract'):field==='/contract/disclosureAuthority'?'disclosure-authority':field.startsWith('/contract/')?'contract':field.startsWith('/review/')?'accountable-review':'privacy-controls';
    const quote=`${field}: ${value}.`;documents.get(kind).push(quote);statement.citations.push({field,source:kind,quote});
  }
  for (const [kind,quotes] of documents) {
    const text=`SYNTHETIC TEST SOURCE — NOT AN AGREEMENT\n${quotes.join('\n')}\n`,file=`${kind}.txt`;fs.writeFileSync(path.join(dir,file),text);
    statement.artifacts.push({id:kind,kind,path:file,digest:digest(text),sourceUrl:`https://records.example/documents/${kind}`,scopeDigest:digest(scope),capturedAt:now-3000,effectiveOn:contract.effectiveOn,expiresOn:contract.expiresOn});
  }
  const index={schema:'studio-g8-preflight-index-v1',governanceScope:structuredClone(scope),prerequisites:[{id:'data-governance',path:'proof.json',digest:''}]};
  const indexPath=path.join(dir,'index.json');
  const saveIndex=()=>fs.writeFileSync(indexPath,JSON.stringify(index));
  const save=(envelope=seal(evidence))=>{const text=JSON.stringify(envelope);fs.writeFileSync(path.join(dir,'proof.json'),text);index.prerequisites[0].digest=digest(text);saveIndex();};
  save();fs.writeFileSync(path.join(dir,'profile.json'),JSON.stringify(profile));
  const result=()=>verifyGovernance({profile,inventory:readInventory(indexPath),now});
  const report=()=>preflight({corpus,profile,register:readRegister(),inventory:readInventory(indexPath)});
  return {dir,now,profile,scope,controls,contract,review,statement,evidence,index,indexPath,saveIndex,save,result,report};
}

describe('source-backed governance dossier consumer',()=>{
  it('checks real local source bytes and each claim while retaining the original production blocker',()=>{
    const input=setup(),before=JSON.stringify(input.evidence),report=input.report();
    const governance=report.prerequisites.find(item=>item.id==='data-governance');
    expect(governance.status).toBe('structured-for-independent-review');
    expect(governance.verification).toMatchObject({reviewable:true,productionQualified:false,authorityVerified:false,errors:[],sourceCount:5});
    expect(governance.verification.checkedClaims).toBe(walk({scope:input.scope,controls:input.controls,contract:input.contract,review:input.review}).length);
    expect(report.qualified).toBe(false);expect(report.readyForFullQualification).toBe(false);
    expect(report.blockers.some(item=>item.code==='prerequisite-data-governance')).toBe(true);
    expect(JSON.stringify(input.evidence)).toBe(before);
    for (const secret of ['unit-privacy-officer','Unit Tenant Ltd','Legal hold','BEGIN PUBLIC KEY','SYNTHETIC TEST SOURCE']) expect(JSON.stringify(report)).not.toContain(secret);
  });

  it('distinguishes missing evidence from opaque, malformed and duplicate indexed inputs',()=>{
    const input=setup();input.index.prerequisites=[];input.saveIndex();expect(input.result()).toMatchObject({status:'missing',reviewable:false});
    const opaque=setup();opaque.save({title:'DPA approved',qualified:true});expect(opaque.result().status).toBe('invalid');
    for (const value of [null,{}, {evidence:{statement:{artifacts:[null]}}}]) { opaque.save(value);expect(opaque.result().reviewable).toBe(false); }
    const duplicate=setup();duplicate.index.prerequisites.push({...duplicate.index.prerequisites[0]});duplicate.saveIndex();expect(duplicate.result().status).toBe('invalid');
  });

  it('refuses source tampering, missing sources, title-only sources and invented quotations',()=>{
    const tamper=setup();fs.appendFileSync(path.join(tamper.dir,'contract.txt'),'changed');expect(tamper.result().errors).toContain('source: source bytes/digest mismatch');
    const missing=setup();fs.rmSync(path.join(missing.dir,'disclosure-authority.txt'));expect(missing.result().errors).toContain('source: source unreadable: ENOENT');
    const empty=setup();fs.writeFileSync(path.join(empty.dir,'contract.txt'),'Approved DPA');empty.statement.artifacts[0].digest=digest('Approved DPA');empty.save();expect(empty.result().reviewable).toBe(false);
    const quote=setup();quote.statement.citations[0].quote='This quotation is not in the actual source';quote.save();expect(quote.result().reviewable).toBe(false);
    const foreign=setup();foreign.scope.tenantId='other-tenant';foreign.index.governanceScope.tenantId='other-tenant';
    for (const ref of foreign.statement.artifacts) ref.scopeDigest=digest(foreign.scope);
    foreign.save();expect(foreign.result().reviewable).toBe(false);
    const value=setup();value.controls.retention[0].deleteWithinDays=3;value.save();
    expect(value.result().reviewable).toBe(false); // Original source says 30, not the substring 3.
  });

  it('requires every scalar citation, applicable source type and substantive use of each artifact',()=>{
    for (const change of [input=>input.statement.citations.pop(),input=>input.statement.citations.push(input.statement.citations[0]),input=>{input.statement.citations[0].source='privacy-controls';},input=>{input.statement.artifacts[0].kind='marketing';}]) {
      const input=setup();change(input);input.save();expect(input.result().reviewable).toBe(false);
    }
    const invalid=setup();invalid.statement.citations[0]=null;invalid.save();expect(invalid.result().status).toBe('invalid');
  });

  it('rejects operator/tenant/provider/model/route and frozen identity substitutions',()=>{
    for (const field of ['operatorId','tenantId','provider','model','modelVersion','route']) {
      const input=setup();input.index.governanceScope[field]='other';input.saveIndex();expect(input.result().errors).toContain('explicit operator/tenant/route governanceScope absent or mismatched');
    }
    const missing=setup();delete missing.index.governanceScope;missing.saveIndex();expect(missing.result().reviewable).toBe(false);
    for (const change of [({evidence})=>{evidence.profileDigest=digest('other');},({evidence})=>{evidence.releaseIdentity.packageHash='f'.repeat(64);},({scope})=>{scope.modelVersion='unavailable';},({scope})=>{scope.route='https://gateway.example/other';},({scope})=>{scope.provider='demo-auto';}]) {
      expect(setup(change).result().reviewable).toBe(false);
    }
  });

  it('requires an applicable contract, accountable review and consistent effective/expiry/capture dates',()=>{
    for (const change of [({statement,now})=>{statement.expiresAt=now;},({statement,now})=>{statement.issuedAt=now+10000;},({contract})=>{contract.effectiveOn='2099-01-01';},({contract})=>{contract.expiresOn='2020-01-01';},({contract})=>{contract.effectiveOn='2026-02-30';},({contract})=>{contract.parties.pop();},({review,now})=>{review.reviewedAt=now+1000;},({review})=>{review.reviewerId='unknown';},({review})=>{review.decision='approved';}]) expect(setup(change).result().reviewable).toBe(false);
    for (const change of [input=>{input.statement.artifacts[0].capturedAt=input.now;},input=>{input.statement.artifacts[0].expiresOn='2020-01-01';},input=>{input.statement.artifacts[0].scopeDigest=digest('foreign scope');}]) {const input=setup();change(input);input.save();expect(input.result().reviewable).toBe(false);}
  });

  it('rejects omitted privacy controls, backups/logs, regional placeholders and unknown subprocessors',()=>{
    for (const change of [({controls})=>{delete controls.training;},({controls})=>{controls.purpose='';},({controls})=>{controls.dataClasses=[];},({controls})=>{controls.retention.pop();},({controls})=>{controls.retention[0].deleteWithinDays=-1;},({controls})=>{controls.retention[0].deletionTrigger='unknown';},({controls})=>{controls.countries.provider=['EU'];},({controls})=>{controls.subprocessors.entries[0].countries=['global'];},({controls})=>{controls.subprocessors.entries[0].legalName='unknown';}]) expect(setup(change).result().reviewable).toBe(false);
    expect(setup(({controls})=>{controls.subprocessors={mode:'none',noneReason:'Direct self-hosted processing without delegated processors',entries:[]};}).result().reviewable).toBe(true);
    // A stated period is reviewed, not an invented legal max-days threshold.
    expect(setup(({controls})=>{controls.retention[0].deleteWithinDays=4000;}).result().reviewable).toBe(true);
    expect(setup(({controls})=>{controls.training.provider='used';}).result()).toMatchObject({reviewable:true,productionQualified:false,authorityVerified:false});
    expect(setup(({controls})=>{controls.dataClasses=['all data'];}).result().reviewable).toBe(false);
  });

  it('rejects untrusted signatures and cannot turn an author self-signature into DPA authority',()=>{
    const input=setup();input.save({evidence:input.evidence,signature:'invalid'});expect(input.result().errors).toContain('independent collector signature invalid/missing');
    const authored=setup();authored.evidence.ownerPublicKey='self-authored-key';authored.evidence.qualified=true;authored.save();
    expect(authored.result()).toMatchObject({reviewable:true,productionQualified:false,authorityVerified:false});
  });
});

describe('governance bounded input and CLI conventions',()=>{
  it('rejects oversized reference collections and duplicates before opening any target',()=>{
    const input=setup();
    fs.writeFileSync(path.join(input.dir,'ref-0.json'),'{}');
    for (const kind of ['profiles','envelopes','prerequisites']) {
      const refs=Array.from({length:INVENTORY_LIMITS[kind]+1},(_,i)=>kind==='prerequisites'?{id:`unit-${i}`,path:`ref-${i}.json`,digest:digest('{}')}:`ref-${i}.json`);
      for (const values of [refs,[refs[0],refs[0]]]) {
        fs.writeFileSync(input.indexPath,JSON.stringify({schema:'studio-g8-preflight-index-v1',[kind]:values}));
        const open=vi.spyOn(fs,'openSync'),got=readInventory(input.indexPath);
        expect(verifyGovernance({profile:input.profile,inventory:got}).status).toBe('invalid');
        expect(open.mock.calls.some(([file])=>file===fs.realpathSync(path.join(input.dir,'ref-0.json')))).toBe(false);open.mockRestore();
        expect(got.profiles).toEqual([]);expect(got.envelopes).toEqual([]);expect(got.prerequisites).toEqual([]);
      }
    }
    fs.writeFileSync(input.indexPath,JSON.stringify({schema:'studio-g8-preflight-index-v1',prerequisites:[{id:'g9',path:'first.json'},{id:'g9',path:'second.json'}]}));
    expect(readInventory(input.indexPath).errors).toContain('prerequisites: duplicate requirement ID');
  });

  it('admits eight complete 180-slot suite references without truncation',()=>{
    const input=setup(),envelopes=Array.from({length:8*180},(_,i)=>`missing-${i}.json`);
    fs.writeFileSync(input.indexPath,JSON.stringify({schema:'studio-g8-preflight-index-v1',envelopes}));
    const got=readInventory(input.indexPath);
    expect(INVENTORY_LIMITS.envelopes).toBe(8*180);
    expect(got.errors).toHaveLength(envelopes.length);
    expect(got.errors.every(error=>error.endsWith(': ENOENT'))).toBe(true);
  });

  it('charges aggregate bytes before allocation/read and propagates the same budget into nested sources',()=>{
    const input=setup(),charge=createInventoryByteBudget();charge(INVENTORY_LIMITS.maxBytes-1);
    fs.writeFileSync(path.join(input.dir,'tiny.json'),'{}');
    const read=vi.spyOn(fs,'readSync'),open=vi.spyOn(fs,'openSync');
    expect(()=>readUpstreamFile(input.dir,'tiny.json',charge)).toThrow('INVENTORY_BYTE_LIMIT');
    expect(read).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    const reader=(root,file)=>readUpstreamFile(root,file,charge);
    const governance=readGovernanceArtifacts(Buffer.from(JSON.stringify(seal(input.evidence))),input.dir,reader);
    expect(governance.artifacts.every(item=>item.errors.includes('source unreadable: INVENTORY_BYTE_LIMIT'))).toBe(true);
    const upstream=readUpstreamArtifacts(Buffer.from(JSON.stringify({evidence:{statement:{artifacts:[{kind:'route-snapshot',path:'tiny.json',digest:digest('{}')}]}}})),input.dir,reader);
    expect(upstream.artifacts[0].errors).toContain('artifact unreadable: INVENTORY_BYTE_LIMIT');
    expect(read).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('cuts every inventory reference kind over to bounded in-base reads',()=>{
    const input=setup(),base=path.join(input.dir,'bounded');fs.mkdirSync(base);
    const outside=path.join(input.dir,'outside.json'),text='{"fictional":"never read through traversal"}';fs.writeFileSync(outside,text);
    for (const kind of ['profiles','envelopes','liveRelease','prerequisites']) {
      const index={schema:'studio-g8-preflight-index-v1'};
      index[kind]=kind==='liveRelease'?'../outside.json':kind==='prerequisites'?[{id:'g9',path:'../outside.json',digest:digest(text)}]:['../outside.json'];
      const file=path.join(base,'index.json');fs.writeFileSync(file,JSON.stringify(index));
      const open=vi.spyOn(fs,'openSync'),got=readInventory(file);
      expect(kind==='prerequisites'?got.prerequisites[0].errors[0]:got.errors[0]).toContain('ARTIFACT_PATH');
      expect(open.mock.calls.some(([target])=>target===outside)).toBe(false);open.mockRestore();
      expect(got.profiles).toEqual([]);expect(got.envelopes).toEqual([]);expect(got.liveRelease).toBeNull();
    }
  });

  it('rejects traversal, absolute, symlink and oversized source inputs before reading',()=>{
    for (const file of ['../outside.txt','/etc/passwd','a//file.txt','C:\\secret.txt']) {
      const input=setup(),ref={...input.statement.artifacts[0],path:file},open=vi.spyOn(fs,'openSync');
      const loaded=readGovernanceArtifacts(Buffer.from(JSON.stringify({evidence:{statement:{artifacts:[ref]}}})),input.dir);
      expect(loaded.artifacts[0].errors).toContain('source unreadable: ARTIFACT_PATH');
      expect(open).not.toHaveBeenCalled();open.mockRestore();
    }
    const linked=setup();fs.symlinkSync(path.join(linked.dir,'contract.txt'),path.join(linked.dir,'linked.txt'));linked.statement.artifacts[0].path='linked.txt';linked.save();expect(linked.result().errors).toContain('source: source unreadable: ARTIFACT_SYMLINK');
    const huge=setup(),fd=fs.openSync(path.join(huge.dir,'huge.txt'),'w');fs.ftruncateSync(fd,JSON_DATA_LIMITS.maxBytes+1);fs.closeSync(fd);huge.statement.artifacts[0].path='huge.txt';huge.save();expect(huge.result().errors).toContain('source: source unreadable: ARTIFACT_SIZE_OR_TYPE');
  });

  it('rejects unsafe index/profile/envelope references and invalid JSON without consulting unrelated paths',()=>{
    const input=setup();input.index.profiles=['../outside.json'];input.index.envelopes=['/etc/passwd'];input.index.liveRelease='../release.json';input.saveIndex();
    const inventory=readInventory(input.indexPath);expect(inventory.errors).toHaveLength(3);expect(inventory.errors.every(error=>error.includes('ARTIFACT_PATH'))).toBe(true);expect(input.result().reviewable).toBe(false);
    for (const bytes of [Buffer.from('{"evidence":{},"evidence":{}}'),Buffer.from([123,34,120,34,58,34,255,34,125]),Buffer.from('{"__proto__":{}}')]) expect(()=>readGovernanceArtifacts(bytes,input.dir)).toThrow();
    fs.writeFileSync(input.indexPath,'{"schema":"studio-g8-preflight-index-v1","schema":"other"}');expect(readInventory(input.indexPath).errors[0]).toContain('index unreadable');
    expect(input.result().status).toBe('invalid');
  });

  it('refuses oversized source counts and non-UTF8 source bytes',()=>{
    const input=setup();input.statement.artifacts=Array.from({length:9},()=>input.statement.artifacts[0]);input.save();expect(input.result().errors).toContain('prerequisite unreadable: GOVERNANCE_ARTIFACT_COUNT');
    const invalid=setup(),bytes=Buffer.from([255,0,128]);fs.writeFileSync(path.join(invalid.dir,'contract.txt'),bytes);
    invalid.statement.artifacts[0].digest=`sha256:${createHash('sha256').update(bytes).digest('hex')}`;invalid.save();
    expect(invalid.result().errors).toContain('source: source unreadable: INVALID_UTF8');
  });

  it('resolves sources relative to the proof, not the index directory',()=>{
    const input=setup(),nested=path.join(input.dir,'package');fs.mkdirSync(nested);
    for (const file of ['proof.json',...input.statement.artifacts.map(ref=>ref.path)]) fs.renameSync(path.join(input.dir,file),path.join(nested,file));
    input.index.prerequisites[0].path='package/proof.json';input.saveIndex();expect(input.result().reviewable).toBe(true);
  });

  it('exposes read-only missing/refusal and reviewable CLI outcomes without approval or register writes',()=>{
    const input=setup(),file=path.join(input.dir,'profile.json'),register='docs/studio-v3-task-register/attempts.csv',before=fs.readFileSync(register,'utf8');
    const missing=spawnSync(process.execPath,['scripts/studio-v3-g8.mjs','governance',file],{encoding:'utf8'});expect(missing.status).toBe(1);
    expect(JSON.parse(missing.stdout)).toMatchObject({schema:'studio-governance-check-v1',offline:true,modelCalls:0,attemptsWritten:0,status:'missing',verification:{reviewable:false,productionQualified:false,authorityVerified:false}});
    const complete=spawnSync(process.execPath,['scripts/studio-v3-g8.mjs','governance',file,input.indexPath],{encoding:'utf8'});expect(complete.status).toBe(0);
    expect(JSON.parse(complete.stdout)).toMatchObject({status:'structured-for-independent-review',verification:{reviewable:true,productionQualified:false,authorityVerified:false}});
    expect(fs.readFileSync(register,'utf8')).toBe(before);
  });
});
