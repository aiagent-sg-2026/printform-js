import {describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {stableStringify} from '../studio-v2/core/json.js';
import {classifySyntheticDocument,classifyRealDocument} from '../studio-v2/core/data-policy.js';
import {revokeObservationAuthorization,OBSERVATION_AUTHORIZATION_MS,pixelDisclosure} from '../studio-v3/observation-policy.js';
import {validatePixelImage} from '../studio-v3/observation-pixels.js';
import {pixelRun,unitImage,UNIT_PNG} from './support/pixel-observation.js';
const hash=value=>createHash('sha256').update(stableStringify(value,0)).digest('hex');
const error=code=>expect.objectContaining({code});

describe('OBS-02 receipt-bound page/crop custody',()=> {
  it('captures page and crop with exact byte/content hashes and replaces the latest receipt',async()=> {
    const run=await pixelRun(), first=await run.inspect(), page=await run.retrieve(first.id);
    const {observation,...content}=page;
    expect(observation).toMatchObject({kind:'page-pixels',runId:run.state.runId,documentId:run.state.project.manifest.documentId,baseRevision:7,candidateVersion:0,
      candidateDigest:hash(run.state.project),scenarioDigest:hash({id:'active',data:run.state.project.sampleData}),contentDigest:hash(content),evidenceRefs:[page.evidence.id]});
    expect(page.sourceObservationId).toBe(first.id);
    expect(page.evidence.selectionDigest).toBe(hash(run.state.selectedTargets));
    expect(page.evidence.contentDigest).toBe(createHash('sha256').update(Buffer.from(UNIT_PNG,'base64')).digest('hex'));
    const png=Buffer.from(UNIT_PNG,'base64'), chunks=[];
    for(let offset=8;offset<png.length;){const size=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(png.subarray(offset+8,offset+8+size));offset+=size+12;}
    expect([...inflateSync(Buffer.concat(chunks))].slice(-4)).toEqual([17,103,187,255]);
    expect(run.memory.latestVisual().data).toBe(UNIT_PNG); expect(JSON.stringify(page)).not.toContain(UNIT_PNG);
    await expect(run.retrieve(first.id)).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    const crop=await run.retrieve(observation.id,{pageIndex:0,crop:{x:0,y:0,width:1,height:1}});
    expect(crop.observation.id).not.toBe(observation.id); expect(crop.sourceObservationId).toBe(observation.id);
    expect(crop.evidence.id).not.toBe(page.evidence.id); expect(run.memory.latestVisual().observation.id).toBe(crop.observation.id);
  });
  it.each([{text:true,pixels:false},{text:false,pixels:true},{text:false,pixels:false}])('rejects independent missing consent %o and recovers with a fresh grant',async options=> {
    const run=await pixelRun(options), receipt=await run.inspect();
    await expect(run.retrieve(receipt.id)).rejects.toMatchObject({code:'OBSERVATION_PIXELS_REQUIRED'});
    expect(run.memory.latestVisual()).toBeNull();
    const fresh=await pixelRun(); expect((await fresh.retrieve((await fresh.inspect()).id)).observation.kind).toBe('page-pixels');
  });
  it('rejects forged grants and cross-run receipts without leaking bytes',async()=> {
    const run=await pixelRun(), receipt=await run.inspect();
    expect(()=>pixelDisclosure({...run.authorization},run.state)).toThrow(error('OBSERVATION_AUTHORIZATION_STALE'));
    const foreign=await pixelRun(); await foreign.inspect(); await expect(foreign.retrieve(receipt.id)).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    expect(foreign.memory.latestVisual()).toBeNull(); expect((await run.retrieve(receipt.id)).sourceObservationId).toBe(receipt.id);
  });
  it('preserves explicit host pixel denial despite run consent and recovers only under a freshly permitted policy',async()=> {
    const denied=await pixelRun({policy:{allowPixelEvidence:false}});
    await expect(denied.retrieve((await denied.inspect()).id)).rejects.toMatchObject({code:'OBSERVATION_PIXELS_POLICY_DENIED'});
    const recovered=await pixelRun({policy:{allowPixelEvidence:true}}); expect((await recovered.retrieve((await recovered.inspect()).id)).observation.kind).toBe('page-pixels');
  });
  it('retains the latest pixels after a rejected unchanged operation and invalidates them only after an accepted edit',async()=> {
    const run=await pixelRun(), current=await run.retrieve((await run.inspect()).id);
    await expect(run.execute('apply_operations',{summary:'Unchanged',operations:[{type:'set_style',patch:{color:'#1167bb'}}]})).rejects.toMatchObject({code:'NO_CHANGES'});
    expect(run.memory.latestVisual().observation.id).toBe(current.observation.id);
    await run.execute('apply_operations',{summary:'Navy',operations:[{type:'set_style',patch:{color:'#163a65'}}]});
    expect(run.memory.latestVisual()).toBeNull();await expect(run.retrieve(current.observation.id)).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'});
  });
  it.each(['revoke','expire','document','revision','content','selection','policy','candidate','undo'])('rejects %s then recovers with fresh host consent/receipt',async change=> {
    let time=1; const run=await pixelRun({now:()=>time}), receipt=await run.inspect(); await run.retrieve(receipt.id);
    if (change==='revoke') revokeObservationAuthorization(run.authorization);
    if (change==='expire') time+=OBSERVATION_AUTHORIZATION_MS;
    if (change==='document') run.state.project.manifest.documentId='replacement';
    if (change==='revision') run.state.baseRevision++;
    if (change==='content') run.state.project.sampleData.extra='changed';
    if (change==='selection') run.state.selectedTargets=['footer'];
    if (change==='policy') run.state.dataPolicy={classification:'unknown'};
    if (change==='candidate' || change==='undo') { run.draft.apply('Navy',[{type:'set_style',patch:{color:'#163a65'}}]); if (change==='undo') run.draft.undo(); }
    expect(()=>run.memory.latestVisual()).toThrow(error('OBSERVATION_AUTHORIZATION_STALE'));
    const fresh=await pixelRun({now:()=>time}); expect((await fresh.retrieve((await fresh.inspect()).id)).observation.id).not.toBe(receipt.id);
  });
  it.each(['unknown','real','synthetic'])('keeps %s value permission independent from explicit pixel consent',async classification=> {
    const run=await pixelRun({policy:id=>classification==='synthetic' ? classifySyntheticDocument(id) : {classification},mutate:project=> {
      project.manifest.studioV3.header[0]={id:'note',label:'Value',pointer:'/value',format:''}; project.sampleData.value='FICTIONAL_BOUND_VALUE';
    }});
    if (classification==='synthetic') expect(pixelDisclosure(run.authorization,run.state).authorization.values).toBe(true);
    else await expect(run.retrieve((await run.inspect()).id,{pageIndex:0,crop:{x:0,y:0,width:1,height:1}})).rejects.toMatchObject({code:classification==='real' ? 'OBSERVATION_PIXELS_SENSITIVE' : 'OBSERVATION_PIXELS_VALUES_DENIED'});
  });
  it.each(['raster','signature','real'])('blocks %s even with fictional surrounding text and synthetic value permission',async fixture=> {
    const run=await pixelRun({policy:fixture==='real' ? classifyRealDocument : classifySyntheticDocument,mutate:project=> {
      if (fixture==='raster') project.manifest.studioV3.assets=[{id:'raster',alt:'Fictional surrounding label',src:`data:image/png;base64,${UNIT_PNG}`}];
      if (fixture==='signature') project.sampleData.signaturePixels=`data:image/png;base64,${UNIT_PNG}`;
    }});
    await expect(run.retrieve((await run.inspect()).id)).rejects.toMatchObject({code:'OBSERVATION_PIXELS_SENSITIVE'}); expect(run.memory.latestVisual()).toBeNull();
  });
  it('rejects capture-time changes and failed captures without reviving old evidence; fresh inspection recovers',async()=> {
    let fail=true; const run=await pixelRun({capture:async()=> { if(fail) throw Object.assign(new Error(),{code:'OBSERVATION_PIXELS_UNSUPPORTED'}); return unitImage(); }});
    const old=await run.inspect(); await expect(run.retrieve(old.id)).rejects.toMatchObject({code:'OBSERVATION_PIXELS_UNSUPPORTED'});
    fail=false; await expect(run.retrieve(old.id)).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    expect((await run.retrieve((await run.inspect()).id)).evidence.bytes).toBeGreaterThan(0);
    const race=await pixelRun({capture:async()=> { race.state.project.sampleData.changed=true; return unitImage(); }});
    await expect(race.retrieve((await race.inspect()).id)).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'}); expect(race.memory.latestVisual()).toBeNull();
  });
  it('rejects cancellation during receipt hashing before publishing any pixel evidence',async()=> {
    const run=await pixelRun(), source=await run.inspect(), digest=crypto.subtle.digest.bind(crypto.subtle); let release,blocked=false;
    const wait=new Promise(resolve=> { release=resolve; }), candidate=stableStringify(run.draft.project,0);
    const spy=vi.spyOn(crypto.subtle,'digest').mockImplementation(async(...args)=> {
      if(new TextDecoder().decode(args[1])===candidate) { blocked=true;await wait; } return digest(...args);
    });
    try {const pending=run.retrieve(source.id);await vi.waitFor(()=>expect(blocked).toBe(true));run.controller.abort();release();
      await expect(pending).rejects.toMatchObject({name:'AbortError'});expect(run.memory.latestVisual()).toBeNull();
    } finally {release();spy.mockRestore();}
    const recovered=await pixelRun();expect((await recovered.retrieve((await recovered.inspect()).id)).observation.kind).toBe('page-pixels');
  });
  it('rejects malformed PNG/byte limits, mismatched crop and raw coerced arguments, then recovers',async()=> {
    const corrupt=Buffer.from(UNIT_PNG,'base64');corrupt[41]^=1;
    for (const image of [{...unitImage(),dataUrl:`data:image/png;base64,${corrupt.toString('base64')}`},{...unitImage(),dataUrl:'data:image/png;base64,AAAA'},{...unitImage(),width:2000},{...unitImage(),dataUrl:'data:image/png;base64,'+'A'.repeat(1_500_000)}]) await expect(validatePixelImage(image)).rejects.toMatchObject({code:'OBSERVATION_PIXELS_LIMIT'});
    const run=await pixelRun(), receipt=await run.inspect();
    await expect(run.execute('retrieve_page',{observationId:receipt.id,pageIndex:'0'})).rejects.toMatchObject({code:'AGENT_ARGUMENTS_INVALID'});
    await expect(run.retrieve(receipt.id,{pageIndex:0,crop:{x:1,y:0,width:0,height:1}})).rejects.toMatchObject({code:'AGENT_ARGUMENTS_INVALID'});
    expect((await run.retrieve(receipt.id)).evidence.mediaType).toBe('image/png');
    const wrong=await pixelRun({capture:async()=>({...unitImage(),crop:{x:1,y:0,width:1,height:1}})});
    await expect(wrong.retrieve((await wrong.inspect()).id,{pageIndex:0,crop:{x:0,y:0,width:1,height:1}})).rejects.toMatchObject({code:'OBSERVATION_PIXELS_BOUNDS'});
  });
});
