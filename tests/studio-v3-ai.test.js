import { describe,it,expect } from 'vitest';
import { newProject,designOf } from '../studio-v3/model.js';
import { parseProposal,shareLayout,assertProposalCurrent,assertPendingProposal } from '../studio-v3/ai-edits.js';
import { createBus,editProject,designOperations } from '../studio-v3/controller.js';
import { runLayoutHarness } from '../studio-v3/ai-harness.js';
import { validZoom,restoreZoom,persistZoom,ZOOM_KEY } from '../studio-v3/zoom-preference.js';

const envelope = edits => JSON.stringify({summary:'Navy and compact',edits});
const color = {target:'style',property:'color',value:'#163a65'};
describe('bounded v3 AI design',()=> {
  it('shares only style and column identity/width, excluding custom business values and bindings',()=> {
    const p = newProject(); p.manifest.studioV3.title = 'PRIVATE'; p.manifest.studioV3.columns[0].label = 'PRIVATE'; p.sampleData.company.name = 'PRIVATE';
    const shared = JSON.stringify(shareLayout(p));
    expect(shared).not.toContain('PRIVATE'); expect(shared).not.toContain('/summary'); expect(shared).not.toContain('/items'); expect(shared).not.toContain('125');
  });
  it('compiles a candidate without touching data, canonical bindings or revision; one commit supports undo',async()=> {
    const bus = createBus(newProject()), before = structuredClone(bus.project);
    const result = parseProposal(envelope([color,{target:'style',property:'padding',value:5},{target:'items-description',property:'width',value:35}]),bus.project);
    expect(bus.project).toEqual(before); expect(result.candidate.sampleData).toEqual(before.sampleData);
    expect(result.candidate.spec.components.map(({id,type,binding})=>({id,type,binding}))).toEqual(before.spec.components.map(({id,type,binding})=>({id,type,binding})));
    expect(result.candidate.spec.components.find(c=>c.id === 'items-description').width).toBe(35);
    await editProject(bus,designOperations(bus.project,result.design),'AI layout'); expect(bus.revision).toBe(1);
    expect(bus.project.sampleData).toEqual(before.sampleData);
    await bus.navigateHistory('undo',bus.revision); expect(designOf(bus.project)).toEqual(designOf(before));
  });
  it.each([
    {target:'style',property:'font',value:20}, {target:'style',property:'color',value:'red'},
    {target:'style',property:'padding',value:'5'}, {target:'style',property:'title',value:'changed'},
    {target:'totals-total',property:'width',value:20}, {target:'items-amount',property:'pointer',value:'./total'},
    {target:'data',property:'amount',value:0}, {target:'style',property:'__proto__',value:{}},
    {...color,code:'eval(1)'}, {target:'style',property:'repeatHeader',value:null}
  ])('rejects unsafe edit %j',edit=>expect(()=>parseProposal(envelope([edit]),newProject())).toThrow());
  it.each(['not json','```json\n{}\n```','{}',envelope([]),JSON.stringify({summary:'x',edits:[color],script:'x'})])('rejects malformed/empty envelope %s',text=>expect(()=>parseProposal(text,newProject())).toThrow());
  it('rejects duplicates, over-budget edits and width overflow',()=> {
    expect(()=>parseProposal(envelope([color,color]),newProject())).toThrow('UNSAFE_PROPOSAL');
    expect(()=>parseProposal(envelope(Array(13).fill(color)),newProject())).toThrow('MALFORMED_PROPOSAL');
    expect(()=>parseProposal(envelope([{target:'items-description',property:'width',value:100}]),newProject())).toThrow('COLUMN_WIDTH_LIMIT');
  });
  it('rejects changed revision, replaced document and altered base design',async()=> {
    const bus = createBus(newProject()), p = {bus,revision:bus.revision,baseDesign:JSON.stringify(designOf(bus.project))};
    assertProposalCurrent(bus,p);
    expect(()=>assertProposalCurrent(createBus(newProject()),p)).toThrow('STALE_PROPOSAL');
    await editProject(bus,[{type:'set_manifest_value',path:'/title',value:'changed'}],'name');
    expect(()=>assertProposalCurrent(bus,p)).toThrow('STALE_PROPOSAL');
    bus.deactivate(); expect(()=>assertProposalCurrent(bus,p)).toThrow('STALE_PROPOSAL');
  });
  it('rechecks identity and generation after a delayed Apply queue',async()=> {
    const bus = createBus(newProject()), proposal = {bus,revision:bus.revision,baseDesign:JSON.stringify(designOf(bus.project))};
    const panel = {proposal,generation:3}; let release;
    const queued = new Promise(r=>release=r).then(()=>assertPendingProposal(bus,proposal,panel,3));
    panel.proposal = null; panel.generation++; release();
    await expect(queued).rejects.toThrow('STALE_PROPOSAL'); expect(bus.revision).toBe(0);
    panel.proposal = proposal; expect(()=>assertPendingProposal(bus,proposal,panel,3)).toThrow('STALE_PROPOSAL');
  });
  it('runs actual Pi Harness and one local tool with a single model request',async()=> {
    let calls = 0; const phases = [], project = newProject();
    const result = await runLayoutHarness({transport:{plan:async()=> { calls++; return {text:envelope([color]),usage:{prompt_tokens:11,completion_tokens:7,total_tokens:18}}; }},alias:'demo-fast',request:'navy',project,signal:new AbortController().signal,onPhase:p=>phases.push(p)});
    expect(calls).toBe(1); expect(result.design.color).toBe('#163a65'); expect(result.usage.total).toBe(18); expect(phases).toContain('Validating local proposal');
    expect(designOf(project).color).toBe('#1763dc');
  });
  it('propagates provider failures and malformed results through the real Harness',async()=> {
    for (const text of ['oops',envelope([{target:'data',property:'total',value:0}])]) {
      await expect(runLayoutHarness({transport:{plan:async()=>({text})},alias:'demo-fast',request:'test',project:newProject(),signal:new AbortController().signal})).rejects.toThrow();
    }
  });
  it('cancels an active Harness request and discards a response that arrives after abort',async()=> {
    const controller = new AbortController(); let started, resolve;
    const ready = new Promise(r=>started=r), reply = new Promise(r=>resolve=r);
    const running = runLayoutHarness({transport:{plan:async()=> { started(); return reply; }},alias:'demo-fast',request:'test',project:newProject(),signal:controller.signal});
    await ready; controller.abort(); resolve({text:envelope([color])});
    await expect(running).rejects.toMatchObject({name:'AbortError'});
  });
});
describe('view zoom preference',()=> {
  it.each([null,'','-1','NaN','Infinity','3','0.01','0.151','width<script>','1e0',' 1 '])('rejects invalid restored %s',value=>expect(validZoom(value)).toBe('fit'));
  it.each(['fit','width','0.15','0.63','1','1.25','2'])('accepts bounded zoom %s',value=>expect(validZoom(value)).toBe(value));
  it('restores custom increments and tolerates inaccessible storage',()=> {
    const select = document.createElement('select'); select.innerHTML = '<option value="fit">Fit</option>';
    const storage = {getItem:()=> '0.63',setItem:(key,value)=> { expect(key).toBe(ZOOM_KEY); expect(value).toBe('0.63'); }};
    restoreZoom(select,storage); expect(select.value).toBe('0.63'); persistZoom(select,storage);
    restoreZoom(select,{getItem:()=> { throw new Error('denied'); }}); expect(select.value).toBe('fit');
    expect(()=>persistZoom(select,{setItem:()=> { throw new Error('quota'); }})).not.toThrow();
  });
});
