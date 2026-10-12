import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {createObservationRecords,DIAGNOSTIC_POLICY} from '../studio-v3/observation-records.js';
import {stableStringify} from '../studio-v2/core/json.js';
import {newProject} from '../studio-v3/model.js';

const hash = value => createHash('sha256').update(stableStringify(value,0)).digest('hex');
const diagnostics = {ready:true,errors:[],issues:[],metrics:{logicalPages:1},pages:[{width:794,height:1123}]};
function setup() {
  const project = newProject();
  const state = {runId:'run-1',releaseIdentity:{release:'test',packageHash:'a'.repeat(64),verified:true},documentId:project.manifest.documentId,
    baseRevision:7,candidateVersion:0,project,scenario:{id:'active',data:project.sampleData},policy:{...DIAGNOSTIC_POLICY}};
  const records = createObservationRecords({readState:()=>state,now:()=>1234});
  return {state,records,capture:()=>records.capture(async()=>diagnostics)};
}

describe('OBS-02 slice 1: receipt custody and freshness',()=> {
  it('binds host identity, candidate, scenario, policy and exact returned content with SHA-256',async()=> {
    const {state,records,capture} = setup(), {receipt,content} = await capture();
    expect(receipt).toMatchObject({runId:'run-1',releaseIdentity:state.releaseIdentity,documentId:state.documentId,baseRevision:7,
      candidateVersion:0,kind:'print-diagnostics',capturedAt:1234,evidenceRefs:[],candidateDigest:hash(state.project),
      scenarioDigest:hash(state.scenario),policyDigest:hash(state.policy),contentDigest:hash(diagnostics)});
    expect(records.requireLatest(receipt.id)).toEqual({receipt,content});
    expect(Object.isFrozen(receipt.releaseIdentity)).toBe(true); expect(Object.isFrozen(content.pages[0])).toBe(true);
    expect(JSON.stringify(receipt)).not.toContain('sampleData'); expect(JSON.stringify(receipt)).not.toContain('Invoice');
  });
  it.each(['runId','releaseIdentity','documentId','baseRevision','candidateVersion','candidate','scenario','data','policy'])('rejects changed %s and recovers only with a new receipt',async field=> {
    const {state,records,capture} = setup(), old = await capture();
    if (field === 'runId') state.runId = 'run-2';
    if (field === 'releaseIdentity') state.releaseIdentity.packageHash = 'b'.repeat(64);
    if (field === 'documentId') { state.documentId = 'replacement'; state.project.manifest.documentId = state.documentId; }
    if (field === 'baseRevision') state.baseRevision += 1;
    if (field === 'candidateVersion') state.candidateVersion += 1;
    if (field === 'candidate') state.project.manifest.studioV3.heading = 'Changed';
    if (field === 'scenario') state.scenario.id = '45';
    if (field === 'data') state.project.sampleData.extra = 'Changed data';
    if (field === 'policy') state.policy.projection = 'numeric-print-diagnostics/v2';
    expect(()=>records.requireLatest(old.receipt.id)).toThrow(expect.objectContaining({code:'EVIDENCE_STALE'}));
    const fresh = await capture(); expect(fresh.receipt.id).not.toBe(old.receipt.id);
    expect(()=>records.requireLatest(old.receipt.id)).toThrow(); expect(records.requireLatest(fresh.receipt.id).content).toEqual(diagnostics);
  });
  it('rejects unknown and cross-run IDs without losing the real latest receipt',async()=> {
    const a = setup(), b = setup(), first = await a.capture(), second = await b.capture();
    expect(()=>a.records.requireLatest(second.receipt.id)).toThrow(); expect(()=>a.records.requireLatest('forged')).toThrow();
    expect(a.records.requireLatest(first.receipt.id).receipt).toEqual(first.receipt);
  });
  it('replaces a prior observation even when the candidate is unchanged',async()=> {
    const {records,capture} = setup(), old = await capture(), fresh = await capture();
    expect(fresh.receipt.candidateDigest).toBe(old.receipt.candidateDigest);
    expect(()=>records.requireLatest(old.receipt.id)).toThrow(); expect(records.requireLatest(fresh.receipt.id)).toEqual(fresh);
  });
  it('rejects state changed during render; a fresh render recovers',async()=> {
    const {state,records,capture} = setup();
    await expect(records.capture(async()=> { state.baseRevision += 1; return diagnostics; })).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    const fresh = await capture(); expect(records.requireLatest(fresh.receipt.id)).toEqual(fresh);
  });
  it('does not revive old evidence after a failed or explicitly invalidated capture',async()=> {
    const {records,capture} = setup(), old = await capture();
    await expect(records.capture(async()=> { throw new Error('render failed'); })).rejects.toThrow('render failed');
    expect(()=>records.requireLatest(old.receipt.id)).toThrow();
    const fresh = await capture(); records.invalidate(); expect(()=>records.requireLatest(fresh.receipt.id)).toThrow();
    expect((await capture()).content.ready).toBe(true);
  });
});
