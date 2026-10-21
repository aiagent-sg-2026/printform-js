import {describe,it,expect} from 'vitest';
import {createAgentTools} from '../studio-v3/agent-tools.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {staticProject,pixelRun} from './support/pixel-observation.js';
import {Conversation} from '../studio-v3/ai-conversation.js';
import {renderConversation} from '../studio-v3/ai-chat-view.js';

function setup() {
  const project=staticProject(),draft=createDraft(project),outcome={},state={revision:4};
  const tools=createAgentTools({draft,outcome,context:()=>'',inspect:async()=>({report:{status:'ready'}}),
    baseRevision:4,identity:{release:'completion-test',verified:true},signal:new AbortController().signal,
    assertCurrent:()=> {if(state.revision!==4)throw Object.assign(new Error(),{code:'STALE_PROPOSAL'});},limits:{maxTurns:100,maxRepeatedFailures:20}});
  const execute=async(name,args={})=> {const tool=tools.find(t=>t.name===name);tool.prepareArguments(args);return tool.execute(name,args);};
  const inspect=async()=>JSON.parse((await execute('inspect_draft')).content[0].text).observation;
  return {project,draft,outcome,state,execute,inspect};
}
describe('OBS-05 latest observation at the actual completion owner',()=> {
  it('preserves exact JSON while separately rendering and recovering the latest safe receipt identity',async()=> {
    const run=setup(),old=await run.inspect(),latest=await run.inspect(),message='{"fontPt":9}';
    await run.execute('finish_answer',{message});
    expect(run.outcome.answer.observation).toEqual(latest);
    expect(run.outcome.answer.message).toBe(message);expect(JSON.parse(run.outcome.answer.message)).toEqual({fontPt:9});
    const conversation=new Conversation(),documentKey=run.project.manifest.documentId;
    const card=conversation.add('assistant',run.outcome.answer.message,'answer',{documentKey,observation:{...latest,pixels:'private pixels',sourceValues:'private values'}});
    expect(card.observation).toEqual({id:latest.id});expect(card.text).toBe(message);
    const saved=conversation.snapshot();expect(saved[0].observation).toEqual({id:latest.id});
    expect(JSON.stringify(saved)).not.toContain(old.id);expect(JSON.stringify(saved)).not.toContain('private');
    conversation.restore(saved,documentKey);
    expect(conversation.context(documentKey)).toEqual([{role:'assistant',content:message}]);
    const log=document.createElement('div'),scroll=document.createElement('div');
    renderConversation({conversation,node:selector=>selector==='[data-ai-log]'?log:selector==='.ai-conversation-scroll'?scroll:null});
    expect(log.querySelector('.ai-message-text').textContent).toBe(message);
    expect(log.querySelector('.ai-observation-receipt').textContent).toContain(latest.id);
    conversation.messages[0].observationProtected=true;
    conversation.restore(conversation.snapshot(),documentKey);expect(conversation.context(documentKey)).toEqual([]);
  });
  it.each([null,{id:'latest'},{id:'observation-'+ 'x'.repeat(4000)}])('rejects unsafe recovered receipt identity %j',observation=> {
    const conversation=new Conversation();
    expect(()=>conversation.restore([{role:'assistant',text:'Answer',time:1,observation}])).toThrow('INVALID_CHAT_RECOVERY');
  });
  it.each(['old','foreign','invented'])('rejects a %s supplied receipt and recovers with the actual latest',async kind=> {
    const run=setup(),old=await run.inspect(),latest=await run.inspect();
    const id=kind==='old'?old.id:kind==='foreign'?(await setup().inspect()).id:'observation-invented';
    await expect(run.execute('finish_answer',{message:'Compare.',observationId:id})).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    expect(run.outcome.answer).toBeUndefined();await run.execute('finish_answer',{message:'Recovered.',observationId:latest.id});
    expect(run.outcome.answer.observation).toEqual(latest);
  });
  it.each(['edit','undo','scenario','content'])('rejects %s evidence and recovers only after fresh inspection',async change=> {
    const run=setup(),old=await run.inspect();
    if(change==='edit'||change==='undo')await run.execute('apply_operations',{summary:'Navy',operations:[{type:'set_style',patch:{color:'#163a65'}}]});
    if(change==='undo')await run.execute('undo_step');
    if(change==='scenario')run.draft.project.sampleData.items.push({fictional:true});
    if(change==='content')run.draft.project.manifest.studioV3.title='Changed fictional title';
    await expect(run.execute('finish_answer',{message:'Stale comparison.'})).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    expect(run.outcome.answer).toBeUndefined();const latest=await run.inspect();
    await expect(run.execute('finish_answer',{message:'Old comparison.',observationId:old.id})).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    await run.execute('finish_answer',{message:'Fresh comparison.',observationId:latest.id});expect(run.outcome.answer.observation).toEqual(latest);
  });
  it('rejects changed host revision; a fresh run and receipt recover',async()=> {
    const run=setup(),old=await run.inspect();run.state.revision++;
    await expect(run.execute('finish_answer',{message:'Changed host.',observationId:old.id})).rejects.toMatchObject({code:'STALE_PROPOSAL'});
    const fresh=setup(),latest=await fresh.inspect();await fresh.execute('finish_answer',{message:'New run.',observationId:latest.id});
    expect(fresh.outcome.answer.observation.runId).not.toBe(old.runId);
  });
  it('keeps guide-only answers available but never accepts an invented observation',async()=> {
    const run=setup();await run.execute('read_skill',{id:'form-authoring'});
    await expect(run.execute('finish_answer',{message:'Guide.',observationId:'foreign'})).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    await run.execute('finish_answer',{message:'Guide answer.'});expect(run.outcome.answer.message).toBe('Guide answer.');
    expect(run.outcome.answer).not.toHaveProperty('observation');
  });
  it('cites the actual latest pixel receipt and rejects its older source receipt',async()=> {
    const run=await pixelRun(),old=await run.inspect(),latest=await run.retrieve(old.id);
    await expect(run.execute('finish_answer',{message:'Old page.',observationId:old.id})).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    await run.execute('finish_answer',{message:'Latest page.',observationId:latest.observation.id});
    expect(run.outcome.answer.observation).toEqual(latest.observation);
  });
  it('bounds the verbatim answer without truncation',async()=> {
    const expanded=setup();await expanded.inspect();
    await expect(expanded.execute('finish_answer',{message:'x'.repeat(4001)})).rejects.toMatchObject({code:'AGENT_ARGUMENTS_INVALID'});
    expect(expanded.outcome.answer).toBeUndefined();
    const long=setup(),latest=await long.inspect();
    await long.execute('finish_answer',{message:'x'.repeat(4000)});expect(long.outcome.answer.message).toBe('x'.repeat(4000));
    expect(long.outcome.answer.observation).toEqual(latest);
  });
});
