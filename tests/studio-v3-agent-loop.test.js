import {describe,it,expect} from 'vitest';
import {createModels,fauxProvider,fauxAssistantMessage,fauxToolCall} from '@earendil-works/pi-ai';
import {newProject,designOf} from '../studio-v3/model.js';
import {runAgentLoop,AGENT_PROMPT} from '../studio-v3/agent-loop.js';
import {createAgentMemory} from '../studio-v3/agent-memory.js';

const note = {type:'add_field',section:'footer',field:{id:'note-two',label:'Extra note',kind:'static',text:'Authored note'}};
const badStep = {type:'set_field',target:'nowhere',patch:{width:10}};
const call = (name,args,id) => fauxAssistantMessage([fauxToolCall(name,args,{id:id || `${name}-${Math.random()}`})],{stopReason:'toolUse'});
const ready = {report:{status:'ready',metrics:{logicalPages:1}}};
function setup(responses) {
  const faux = fauxProvider({provider:'agent-faux',models:[{id:'agent-faux'}],tokenSize:{min:3,max:3}});
  faux.setResponses(responses);
  const models = createModels(); models.setProvider(faux.provider);
  return {models,model:faux.getModel(),faux};
}
const run = (responses,over = {}) => {
  const {models,model,faux} = setup(responses), steps = [], project = over.project || newProject();
  const promise = runAgentLoop({models,model,project,request:'Tidy the footer of this form.',scope:{mode:'whole'},context:()=>'{"context":true}',inspect:async()=>ready,
    signal:over.signal || new AbortController().signal,onStep:step=>{steps.push(step); over.onStep?.(step);},limits:over.limits,...over.options});
  return {promise,steps,faux,project};
};
const reason = async promise => { try { await promise; } catch (error) { return error; } return null; };

describe('the agent loop',()=> {
  it('works in several steps, repairs a rejected step, inspects, and finishes with one proposal',async()=> {
    let seenError = '';
    const {promise,steps,faux,project} = run([
      call('get_context',{}),
      call('apply_operations',{summary:'Add a note',operations:[note]}),
      call('apply_operations',{summary:'Fix the heading',operations:[badStep]}),
      (context)=> {
        const last = context.messages.at(-1); seenError = JSON.stringify(last);
        return call('apply_operations',{summary:'Recolour',operations:[{type:'set_style',patch:{color:'#163a65'}}]});
      },
      call('inspect_draft',{}),
      call('finish',{summary:'Added a footer note and recoloured the form'})
    ]);
    const before = structuredClone(project), result = await promise;
    expect(result.kind).toBe('proposal'); expect(result.summary).toBe('Added a footer note and recoloured the form');
    expect(result.diff.length).toBeGreaterThan(0); expect(result.turns).toBe(6); expect(faux.state.callCount).toBe(6);
    expect(seenError).toContain('UNSAFE_PROPOSAL'); expect(seenError).toMatch(/isError|"isError":true/);
    expect(steps.map(step=>[step.name,step.ok])).toEqual([['get_context',true],['apply_operations',true],['apply_operations',false],['apply_operations',true],['inspect_draft',true],['finish',true]]);
    expect(project).toEqual(before); expect(designOf(result.candidate).footer.some(field=>field.id === 'note-two')).toBe(true);
  });

  it('uses the same harness to build a general equipment handover candidate from a cleared draft',async()=> {
    const fields = [['employee','Employee'],['department','Department'],['handover-date','Date'],['equipment','Equipment'],['asset-tag','Asset tag'],['condition','Condition'],['handed-from','From'],['handed-to','To']];
    const operations = [
      {type:'set_heading',value:'EQUIPMENT HANDOVER'},
      {type:'set_section',target:'header',patch:{enabled:true,label:'Equipment handover'}},
      {type:'set_section',target:'customer',patch:{enabled:true,label:'Handover details',layout:{columns:2,gap:16}}},
      {type:'set_section',target:'footer',patch:{enabled:true,label:'Signatures'}},
      ...fields.map(([id,label])=>({type:'add_field',section:'customer',field:{id,label,kind:'static',text:'________________________',format:''}})),
      {type:'add_field',section:'footer',field:{id:'recipient-signature',label:'Recipient signature',kind:'static',text:'________________________',format:''}}
    ];
    const project = newProject(), original = structuredClone(project);
    const design = designOf(project), clearStructure = [
      ...['header','customer','items','totals','footer'].flatMap(section=>(section === 'items' ? design.columns : design[section]).map(field=>({type:'remove_field',target:`${section}-${field.id}`}))),
      {type:'set_section',target:'items',patch:{enabled:false}},{type:'set_section',target:'totals',patch:{enabled:false}}
    ];
    const {promise,steps} = run([call('get_capabilities',{}),call('read_skill',{id:'form-authoring'}),
      call('apply_operations',{summary:'Remove unused invoice structure',operations:clearStructure}),
      call('apply_operations',{summary:'Create handover fields',operations}),call('inspect_draft',{}),call('finish',{summary:'Equipment handover ready for review'})],
      {project,options:{request:'Create a blank equipment handover with employee, department, date, equipment, asset tag, condition, from, to and signature lines.'}});
    const result = await promise;
    expect(result.kind).toBe('proposal'); expect(result.inspection.ready).toBe(true);
    expect(result.design.customer.map(field=>field.id)).toEqual(fields.map(([id])=>id));
    expect(result.design.footer.map(field=>field.id)).toEqual(['recipient-signature']);
    expect(result.design.columns).toEqual([]); expect(result.design.totals).toEqual([]);
    expect(result.design.blocks.items.enabled).toBe(false); expect(result.design.blocks.totals.enabled).toBe(false);
    expect(result.candidate.sampleData).toEqual(original.sampleData); expect(project).toEqual(original);
    expect(result.candidate.manifest.documentId).toBe(original.manifest.documentId);
    expect(steps.every(step=>step.ok)).toBe(true);
  });

  it('rejects a terminal result if host context changes after the finishing tool',async()=> {
    let stale = false;
    const {promise,project} = run([call('apply_operations',{summary:'Add a note',operations:[note]}),call('inspect_draft',{}),call('finish',{summary:'Done'})],
      {onStep:step=> { if (step.name === 'finish') stale = true; },options:{assertCurrent:()=> { if (stale) throw Object.assign(new Error('STALE_PROPOSAL'),{code:'STALE_PROPOSAL'}); }}});
    const original = structuredClone(project);
    expect((await reason(promise)).code).toBe('STALE_PROPOSAL'); expect(project).toEqual(original);
  });

  it('stops when the turn budget is used up',async()=> {
    const {promise} = run(Array.from({length:10},()=>call('get_context',{})),{limits:{maxTurns:3,maxRepeatedFailures:5,maxRunMs:60000}});
    expect((await reason(promise)).code).toBe('AGENT_BUDGET');
  });

  it('stops when the same failure keeps coming back',async()=> {
    const {promise} = run(Array.from({length:10},()=>call('apply_operations',{summary:'Again',operations:[badStep]})),{limits:{maxTurns:100,maxRepeatedFailures:3,maxRunMs:60000}});
    expect((await reason(promise)).code).toBe('AGENT_STALLED');
  });

  it('stops at once when the caller stops it',async()=> {
    const controller = new AbortController();
    const {promise,faux,steps} = run(Array.from({length:10},()=>call("get_context",{})),{signal:controller.signal,onStep:()=>controller.abort()});
    expect((await reason(promise)).name).toBe('AbortError'); expect(faux.state.callCount).toBeLessThan(10); expect(steps).toHaveLength(1);
  });

  it('stops a run that takes too long, even while a slow inspection is under way',async()=> {
    const slow = () => new Promise(resolve=>setTimeout(()=>resolve(ready),300));
    const {promise} = run([call('inspect_draft',{}),call('get_context',{})],{limits:{maxTurns:100,maxRepeatedFailures:5,maxRunMs:40},options:{inspect:slow}});
    expect((await reason(promise)).code).toBe('AGENT_TIMEOUT');
  });

  it('refuses to finish without any change, and reports a block when the request cannot be met',async()=> {
    const {promise,steps} = run([call('finish',{summary:'Nothing'}),call('report_blocked',{reason:'The form has no such section.'})]);
    const error = await reason(promise);
    expect(error.code).toBe('AGENT_BLOCKED'); expect(error.reason).toBe('The form has no such section.');
    expect(steps[0]).toMatchObject({name:'finish',ok:false,code:'NO_CHANGES'});
  });

  it('fails when the model ends without a result',async()=> {
    const {promise} = run([fauxAssistantMessage('I am done.',{stopReason:'stop'})]);
    expect((await reason(promise)).code).toBe('AI_RUN_FAILED');
  });
});

describe('what a finished run reports',()=> {
  it('requires another inspection when an edit or undo makes the last one stale',async()=> {
    const inspected = await run([call('apply_operations',{summary:'Add a note',operations:[note]}),call('inspect_draft',{}),call('finish',{summary:'Added a note'})]).promise;
    expect(inspected.inspection).toMatchObject({ready:true}); expect(inspected.iterations).toBe(3);
    const stale = run([call('inspect_draft',{}),call('apply_operations',{summary:'Add a note',operations:[note]}),call('finish',{summary:'Added a note'}),call('inspect_draft',{}),call('finish',{summary:'Added a note'})]);
    expect((await stale.promise).inspection.ready).toBe(true);
    expect(stale.steps[2]).toMatchObject({name:'finish',ok:false,code:'AGENT_INSPECTION_REQUIRED'});
    const undone = run([call('apply_operations',{summary:'Add a note',operations:[note]}),call('inspect_draft',{}),call('undo_step',{}),call('apply_operations',{summary:'Add it again',operations:[note]}),call('finish',{summary:'Added a note'}),call('inspect_draft',{}),call('finish',{summary:'Added a note'})]);
    expect((await undone.promise).inspection.ready).toBe(true);
    expect(undone.steps[4]).toMatchObject({name:'finish',ok:false,code:'AGENT_INSPECTION_REQUIRED'});
  });

  it('tells each step what it did, so a timeline can show it',async()=> {
    const {promise,steps} = run([call('get_context',{}),call('apply_operations',{summary:'Add a note',operations:[note]}),call('inspect_draft',{}),call('finish',{summary:'Added a note'})]);
    await promise;
    expect(steps.map(step=>step.detail)).toEqual([undefined,expect.stringMatching(/^\d+ changes?$/),'ready',undefined]);
  });
});

describe('a run with reference images',()=> {
  const media = [{type:'input_image',image_url:'data:image/png;base64,AAAA'}];
  it('gives the images to the model with the request',async()=> {
    let first;
    const {promise} = run([context=> { first = context.messages[0]; return call('report_blocked',{reason:'seen'}); }],{options:{media}});
    await reason(promise);
    expect(first.content).toEqual([{type:'text',text:'Tidy the footer of this form.'},{type:'image',data:'AAAA',mimeType:'image/png'}]);
  });
  it('refuses images that break the sharing rules, before anything is sent',async()=> {
    const {promise,faux} = run([call('get_context',{})],{options:{media:[{type:'input_image',image_url:'https://example.com/a.png'}]}});
    expect((await reason(promise)).code).toBe('UNSAFE_PROPOSAL'); expect(faux.state.callCount).toBe(0);
  });
});

describe('what the run remembers',()=> {
  it('keeps the latest notes and the steps still in the draft',async()=> {
    const memory = createAgentMemory();
    await run([call('take_notes',{notes:'Footer needs a note.'}),call('apply_operations',{summary:'Add a note',operations:[note]}),call('apply_operations',{summary:'Recolour',operations:[{type:'set_style',patch:{color:'#163a65'}}]}),call('undo_step',{}),call('inspect_draft',{}),call('finish',{summary:'Added a note'})],{options:{memory}}).promise;
    expect(memory.notes).toBe('Footer needs a note.'); expect(memory.steps).toEqual([{summary:'Add a note',changes:expect.any(Number)}]);
  });
});

describe('the agent prompt',()=> {
  it('keeps the printform.js authoring rules, and no longer asks for a JSON envelope',()=> {
    for (const needle of ['get_capabilities','read_skill','operation schemas','actual run limits']) expect(AGENT_PROMPT).toContain(needle);
    expect(AGENT_PROMPT).not.toContain('Return ONE JSON object');
    for (const tool of ['get_context','apply_operations','inspect_draft','undo_step','take_notes','finish','report_blocked']) expect(AGENT_PROMPT).toContain(tool);
  });
});
