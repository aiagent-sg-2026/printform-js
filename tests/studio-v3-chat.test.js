import { describe,it,expect } from 'vitest';
import { newProject } from '../studio-v3/model.js';
import { parseChatReply,typographyAnswer,chatRequest,readOnlyRequest } from '../studio-v3/ai-chat-protocol.js';
import { Conversation,cleanMessages } from '../studio-v3/ai-conversation.js';
import { runLayoutHarness } from '../studio-v3/ai-harness.js';
const project = newProject(), color = {target:'style',property:'color',value:'#163a65'};
const reply = value=>JSON.stringify(value);
describe('closed browser chat protocol',()=> {
  it('answers current font questions from measured facts, never invented model values',()=> {
    const typography = [{id:'header',role:'title',pt:18},{id:'header-company',role:'value',pt:12},{id:'items',role:'table cell',pt:9}];
    const answer = parseChatReply(reply({kind:'answer',message:'Everything is 80 pt'}),project,{request:'What are the current font sizes?',typography});
    expect(answer.kind).toBe('answer'); expect(answer.message).toContain('title: 18 pt'); expect(answer.message).toContain('value: 12 pt'); expect(answer.message).not.toContain('80'); expect(answer.candidate).toBeUndefined();
    expect(typographyAnswer([], {mode:'whole'})).toContain('unavailable');
    expect(typographyAnswer(typography,{mode:'selected',id:'header-company'})).not.toContain('table cell');
  });
  it.each([{kind:'answer',message:'x',edits:[color]},{kind:'answer',message:''},{kind:'answer',message:'x',code:'eval(1)'},{kind:'proposal',summary:'x',edits:[color],message:'x'},{kind:'tool',message:'x'}])('rejects mixed/unsafe envelope %j',value=>expect(()=>parseChatReply(reply(value),project)).toThrow());
  it('cannot convert a read-only font question into an edit',()=>expect(()=>parseChatReply(reply({kind:'proposal',summary:'x',edits:[color]}),project,{request:'Current font size how much?'})).toThrow());
  it.each(['How should I bind an attendance field?','How many pages does this form have?','Should I add a signature field?','May I change the paper size?','Tell me how to add a field.','Please explain the binding options.','如何绑定签到人姓名？','应该如何调整表格？','请问怎么添加签名栏？'])('keeps advice question read-only: %s',request=> {
    expect(readOnlyRequest(request)).toBe(true);
    expect(()=>parseChatReply(reply({kind:'proposal',summary:'Unrequested edit',edits:[color]}),project,{request})).toThrow('UNSAFE_PROPOSAL');
  });
  it.each(['Create a visitor registration form.','Please add a signature field.','Can you create an attendance form?','Could you please bind this field?'])('retains deliberate authoring request: %s',request=> {
    expect(readOnlyRequest(request)).toBe(false);
  });
  it.each(['reply','inspection'])('rejects context changed during %s before delivering a result',async phase=> {
    let stale = false, calls = 0;
    await expect(runLayoutHarness({project,alias:'demo-fast',request:'demo',signal:new AbortController().signal,
      assertContext:()=> { if (stale) throw Object.assign(new Error('STALE_PROPOSAL'),{code:'STALE_PROPOSAL'}); },
      transport:{plan:async()=> { calls++; if (phase === 'reply') stale = true; return {text:reply(phase === 'reply' ? {kind:'answer',message:'Old context answer'} : {kind:'proposal',summary:'Navy',edits:[color]})}; }},
      inspectCandidate:async()=> { stale = true; return {report:{status:'ready'}}; }
    })).rejects.toMatchObject({code:'STALE_PROPOSAL'});
    expect(calls).toBe(1);
  });
  it('enforces selected scope locally, even if a model ignores it',()=> {
    expect(()=>parseChatReply(reply({kind:'proposal',summary:'x',edits:[color]}),project,{scope:{mode:'selected',id:'items-description'}})).toThrow('UNSAFE_SCOPE');
    const width = {target:'items-description',property:'width',value:35};
    expect(parseChatReply(reply({kind:'proposal',summary:'x',edits:[width]}),project,{scope:{mode:'selected',id:'items-description'}}).diff).toHaveLength(1);
    expect(()=>parseChatReply(reply({kind:'proposal',summary:'x',edits:[width]}),project,{scope:{mode:'selected',id:'customer'}})).toThrow('UNSAFE_SCOPE');
  });
  it('uses the actual Pi Harness for one read-only local tool; missing usage stays unavailable',async()=> {
    let calls = 0;
    const result = await runLayoutHarness({transport:{plan:async()=> { calls++; return {text:reply({kind:'answer',message:'This is a read-only answer.'})}; }},alias:'demo-fast',request:'question',project,signal:new AbortController().signal});
    expect(calls).toBe(1); expect(result.kind).toBe('answer'); expect(result.message).toContain('read-only'); expect(result.usage.total).toBeNull(); expect(result.candidate).toBeUndefined();
  });
  it('discloses the exact bounded conversation while excluding business data',()=> {
    const p = structuredClone(project); p.sampleData.company.name = 'PRIVATE_DATA'; p.manifest.studioV3.columns[0].label = 'PRIVATE_LABEL';
    const request = chatRequest(p,{request:'Question',scope:{mode:'whole'},typography:[],conversation:[{role:'user',content:'Earlier question'}]});
    expect(request).toContain('Earlier question'); expect(request).not.toContain('PRIVATE'); expect(request).not.toContain('sampleData');
  });
});
describe('bounded reviewable conversation recovery',()=> {
  it('limits retained messages, wire history and document scope',()=> {
    const c = new Conversation();
    for (let i=0;i<20;i++) c.add(i%2 ? 'assistant' : 'user','x'.repeat(4000),'answer',{documentKey:'v3-demo'});
    expect(c.messages).toHaveLength(12); expect(c.context('v3-demo')).toHaveLength(4);
    expect(c.context('v3-demo').reduce((n,m)=>n+m.content.length,0)).toBe(3000); expect(c.context('v3-other')).toEqual([]);
  });
  it('restores only inert text and diffs; excludes runtime/credentials and expires proposals',()=> {
    const c = new Conversation(); c.add('assistant','Navy','ready',{documentKey:'v3-demo',diff:[{target:'style',property:'color',before:'#1763dc',after:'#163a65'}],token:'secret',bus:{secret:'x'},candidate:{code:'x'}});
    const snapshot = c.snapshot(); expect(JSON.stringify(snapshot)).not.toMatch(/secret|candidate|token|bus/);
    const restored = new Conversation(); restored.restore(snapshot,'v3-other'); expect(restored.messages[0].status).toBe('expired'); expect(restored.context('v3-other')).toEqual([]);
  });
  it.each([{role:'system',text:'x',time:1},{role:'tool',text:'x',time:1},{role:'user',text:'x'.repeat(4001),time:1},{role:'user',text:'x',time:1e100},{role:'assistant',text:'x',time:1,diff:[{target:'data',property:'total',before:9,after:0}]},{role:'assistant',text:'x',time:1,diff:[{target:'style',property:'font',before:9,after:'#123456'}]},{role:'assistant',text:'x',time:1,diff:[{target:'style',property:'padding',before:7,after:90}]},{role:'user',text:'x',time:1,diff:[{target:'style',property:'font',before:9,after:10}]}])('rejects corrupt recovery %j',m=>expect(()=>cleanMessages([m])).toThrow());
});
