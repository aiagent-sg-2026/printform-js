import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {authorizeObservation,assertObservationAuthorization,observationDisclosure,OBSERVATION_AUTHORIZATION_MS} from '../studio-v3/observation-policy.js';
import {createObservationRecords} from '../studio-v3/observation-records.js';
import {classifySyntheticDocument,classifyImportedDocument,classifyRealDocument} from '../studio-v2/core/data-policy.js';
import {stableStringify} from '../studio-v2/core/json.js';

const hash = value=>createHash('sha256').update(stableStringify(value,0)).digest('hex');
import {semanticRun} from './support/semantic-observation.js';

describe('OBS-01 semantic observation custody and disclosure',()=> {
  it('denies default disclosure and forged authorization, then recovers with explicit host consent',async()=> {
    const denied = await semanticRun(); await expect(denied.observe()).rejects.toMatchObject({code:'OBSERVATION_DISCLOSURE_REQUIRED'});
    expect(()=>assertObservationAuthorization({...denied.authorization,text:true},denied.state)).toThrow();
    const allowed = await semanticRun({text:true}), result = await allowed.observe();
    expect(result.fields.find(f=>f.id==='header-company')).toMatchObject({label:'AUTHORIZED_LABEL_CANARY',pointer:'/company/name'});
    expect(result.fields.find(f=>f.id==='footer-semantic-note').text).toBe('AUTHORIZED_STATIC_CANARY');
    expect(result.collection).toBe('/items'); expect(result.selectedTargets.map(t=>t.id)).toEqual(['label-header-company','items']);
    expect(result.scenario).toEqual({id:'active',rowCount:45}); expect(result.diagnostics.pages[0]).toEqual({pageIndex:0,width:794,height:1123});
    const {observation,...content} = result;
    expect(observation).toMatchObject({kind:'semantic-context',baseRevision:7,candidateVersion:0,contentDigest:hash(content),candidateDigest:hash(allowed.state.project)});
    expect(observation.policyDigest).toBe(hash({projection:'semantic-context/v1',authorization:allowed.authorization,host:null}));
    expect(JSON.stringify(result)).not.toMatch(/BOUND_VALUE_CANARY|UNASSIGNED_SECRET_CANARY|PIXEL_CANARY/);
  });
  it.each(['unknown','real','synthetic'])('keeps %s value policy independent from text and pixels',async classification=> {
    const policy = documentId=>({...({unknown:classifyImportedDocument,real:classifyRealDocument,synthetic:classifySyntheticDocument})[classification](documentId),allowProviderDocumentContext:true,allowPixelEvidence:true});
    const run = await semanticRun({text:true,policy}), result = await run.observe();
    expect(result.disclosure).toEqual({text:true,values:classification==='synthetic',pixels:false});
    expect(JSON.stringify(result).includes('BOUND_VALUE_CANARY')).toBe(classification==='synthetic');
    expect(JSON.stringify(result)).not.toMatch(/UNASSIGNED_SECRET_CANARY|PIXEL_CANARY/);
  });
  it('permits host-authorized synthetic values without authorizing labels or pixels',async()=> {
    const run = await semanticRun({policy:classifySyntheticDocument}), result = await run.observe();
    expect(result.disclosure).toEqual({text:false,values:true,pixels:false});
    expect(JSON.stringify(result)).toContain('BOUND_VALUE_CANARY'); expect(JSON.stringify(result)).not.toMatch(/AUTHORIZED_LABEL_CANARY|AUTHORIZED_STATIC_CANARY|PIXEL_CANARY/);
  });
  it('denies foreign-document or pixel-only policy authority over values',async()=> {
    const foreign = await semanticRun({policy:()=>classifySyntheticDocument('another-document')});
    await expect(foreign.observe()).rejects.toMatchObject({code:'OBSERVATION_DISCLOSURE_REQUIRED'});
    const pixels = await semanticRun({text:true,policy:id=>({...classifySyntheticDocument(id),allowProviderDocumentContext:false})});
    expect((await pixels.observe()).disclosure).toEqual({text:true,values:false,pixels:false});
  });
  it('expires a grant at the run deadline and recovers only with a fresh host grant',async()=> {
    const run = await semanticRun({text:true}); let time = 1;
    const old = await authorizeObservation(run.state,{text:true,now:()=>time}); time += OBSERVATION_AUTHORIZATION_MS;
    expect(()=>assertObservationAuthorization(old,run.state)).toThrow(expect.objectContaining({code:'OBSERVATION_AUTHORIZATION_STALE'}));
    const fresh = await authorizeObservation(run.state,{text:true,now:()=>time});
    expect(()=>assertObservationAuthorization(fresh,run.state)).not.toThrow(); expect(fresh.id).not.toBe(old.id);
  });
  it('revokes old semantic receipt/authorization after policy change even when old policy bytes are restored',async()=> {
    const run=await semanticRun({text:true}), original=run.state.dataPolicy;
    const records=createObservationRecords({readState:()=>({...run.state,documentId:run.state.project.manifest.documentId,
      releaseIdentity:{release:'test'},candidateVersion:0,scenario:{id:'active',data:run.state.project.sampleData},kind:'semantic-context',
      policy:observationDisclosure(run.authorization,run.state,0)})});
    const old=await records.capture(async()=>({safe:true})); run.state.dataPolicy=classifyImportedDocument(run.state.project.manifest.documentId);
    expect(()=>records.requireLatest(old.receipt.id)).toThrow(expect.objectContaining({code:'OBSERVATION_AUTHORIZATION_STALE'}));
    run.state.dataPolicy=original;
    await expect(run.observe()).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'});
    expect((await (await semanticRun({text:true})).observe()).observation.id).not.toBe(old.receipt.id);
  });
  it.each(['document','revision','run','content','policy','selection'])('expires authorization and receipt after %s changes, then recovers in a new run',async change=> {
    const run = await semanticRun({text:true}); const old = await run.observe();
    if (change==='document') run.state.project.manifest.documentId = 'replacement';
    if (change==='revision') run.state.baseRevision += 1;
    if (change==='run') run.state.runId = 'replacement';
    if (change==='content') run.state.project.sampleData.company.name = 'CHANGED_VALUE';
    if (change==='policy') run.state.dataPolicy = classifyImportedDocument();
    if (change==='selection') run.state.selectedTargets = ['items'];
    expect(()=>assertObservationAuthorization(run.authorization,run.state)).toThrow(expect.objectContaining({code:'OBSERVATION_AUTHORIZATION_STALE'}));
    await expect(run.observe()).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'});
    const fresh = await semanticRun({text:true}); expect((await fresh.observe()).observation.id).not.toBe(old.observation.id);
  });
  it('does not revive text authorization after edit and undo; numeric inspection can recover',async()=> {
    const run = await semanticRun({text:true}); await run.observe();
    await run.execute('apply_operations',{summary:'Navy',operations:[{type:'set_style',patch:{color:'#163a65'}}]});
    await run.execute('undo_step'); await expect(run.observe()).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'});
    expect(JSON.parse((await run.execute('inspect_draft')).content[0].text).observation.kind).toBe('print-diagnostics');
  });
  it('rejects render-time changes and oversized/encoded pixel content without silently dropping it',async()=> {
    const race = await semanticRun({text:true}); race.setRender(async()=> { race.state.project.sampleData.extra = 'changed'; return {report:{status:'ready'}}; });
    await expect(race.observe()).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'});
    for (const text of ['data:image/png;base64,PIXEL_CANARY','word '.repeat(7000)]) {
      const run = await semanticRun({text:true}); run.state.project.manifest.studioV3.footer.at(-1).text = text;
      const grant = await authorizeObservation(run.state,{text:true});
      // The projection oracle is separate from tool custody; the new host grant names this exact changed content.
      const {semanticObservation} = await import('../studio-v3/observation-context.js');
      expect(()=>semanticObservation(run.state.project,{},grant)).toThrow(expect.objectContaining({code:text.startsWith('data:') ? 'OBSERVATION_CONTENT_UNSUPPORTED' : 'OBSERVATION_CONTEXT_LIMIT'}));
    }
    expect((await (await semanticRun({text:true})).observe()).observation.kind).toBe('semantic-context');
  });
});
