import {describe,it,expect} from 'vitest';
import {createDraft} from '../studio-v3/agent-draft.js';
import {createAgentTools} from '../studio-v3/agent-tools.js';
import {newProject} from '../studio-v3/model.js';

const colour = color => ({summary:'Accent',operations:[{type:'set_style',patch:{color}}]});
function setup({project = newProject(),baseRevision = 7,assertCurrent = () => {}} = {}) {
  const draft = createDraft(project), outcome = {};
  let render = async()=>({report:{status:'ready',metrics:{logicalPages:1},secret:'private-render-text'}});
  const tools = createAgentTools({draft,outcome,context:()=>'',inspect:proposal=>render(proposal),signal:new AbortController().signal,
    limits:{maxTurns:100,maxRepeatedFailures:10},identity:{release:'test',verified:true},baseRevision,assertCurrent});
  const execute = (name,args = {})=>tools.find(tool=>tool.name === name).execute(name,args);
  const inspect = async()=>JSON.parse((await execute('inspect_draft')).content[0].text);
  return {draft,outcome,execute,inspect,setRender:value=> { render = value; }};
}

describe('OBS-02 slice 1: real inspection and finish handlers',()=> {
  it('returns numeric-only receipt evidence and retains the actual latest receipt in the proposal',async()=> {
    const run = setup(); await run.execute('apply_operations',colour('#163a65'));
    const first = await run.inspect(), latest = await run.inspect();
    expect(latest.observation.baseRevision).toBe(7); expect(latest.observation.id).not.toBe(first.observation.id);
    expect(latest).not.toHaveProperty('secret'); expect(latest.observation.evidenceRefs).toEqual([]);
    await run.execute('finish',{summary:'Done'}); expect(run.outcome.proposal.inspection).toEqual(latest);
  });
  it.each(['edit','undo-to-same-content','in-place-data','in-place-design'])('rejects %s then recovers after reinspection',async mode=> {
    const run = setup(); await run.execute('apply_operations',colour('#163a65')); const old = await run.inspect();
    if (mode === 'edit' || mode === 'undo-to-same-content') await run.execute('apply_operations',colour('#a82938'));
    if (mode === 'undo-to-same-content') await run.execute('undo_step');
    if (mode === 'in-place-data') run.draft.project.sampleData.extra = 'New scenario';
    if (mode === 'in-place-design') run.draft.project.manifest.studioV3.heading = 'New heading';
    await expect(run.execute('finish',{summary:'Done'})).rejects.toMatchObject({code:'AGENT_INSPECTION_REQUIRED'});
    expect(run.outcome.proposal).toBeUndefined(); const fresh = await run.inspect();
    if (mode === 'undo-to-same-content') expect(fresh.observation.candidateDigest).toBe(old.observation.candidateDigest);
    expect(fresh.observation.id).not.toBe(old.observation.id); await run.execute('finish',{summary:'Done'});
    expect(run.outcome.proposal.inspection.observation).toEqual(fresh.observation);
  });
  it('rejects a changed host revision and recovers in a new run on the actual revision',async()=> {
    let revision = 7;
    const run = setup({assertCurrent:()=> { if (revision !== 7) throw Object.assign(new Error('changed'),{code:'STALE_PROPOSAL'}); }});
    await run.execute('apply_operations',colour('#163a65')); const old = await run.inspect(); revision = 8;
    await expect(run.execute('finish',{summary:'Done'})).rejects.toMatchObject({code:'STALE_PROPOSAL'});
    await expect(run.inspect()).rejects.toMatchObject({code:'STALE_PROPOSAL'}); expect(run.outcome.proposal).toBeUndefined();
    const next = setup({baseRevision:revision}); const fresh = await next.inspect();
    expect(fresh.observation.baseRevision).toBe(8); expect(fresh.observation.runId).not.toBe(old.observation.runId);
  });
  it('rejects late render evidence after a concurrent draft edit and recovers',async()=> {
    const run = setup(); await run.execute('apply_operations',colour('#163a65'));
    run.setRender(async()=> { run.draft.apply('Concurrent edit',colour('#a82938').operations); return {report:{status:'ready'}}; });
    await expect(run.inspect()).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    await expect(run.execute('finish',{summary:'Done'})).rejects.toMatchObject({code:'AGENT_INSPECTION_REQUIRED'});
    run.setRender(async()=>({report:{status:'ready'}})); const fresh = await run.inspect(); await run.execute('finish',{summary:'Done'});
    expect(run.outcome.proposal.inspection.observation).toEqual(fresh.observation);
  });
});
