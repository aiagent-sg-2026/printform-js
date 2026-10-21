import { describe, expect, it } from 'vitest';
import { createModels, fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { runAgentLoop } from '../studio-v3/agent-loop.js';
import { createAgentTools } from '../studio-v3/agent-tools.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { newProject, designOf, compileProject } from '../studio-v3/model.js';
import { pageSettings } from '../studio-v3/paper-settings.js';
import { parseChatReply } from '../studio-v3/ai-chat-protocol.js';

const previewRequest = '把纸张设置为宽188.5毫米、高244.2毫米的自定义纸张，纵向。其他内容、字体、数据、绑定、页边距和现有打印机约束保持不变。先预览，等我确认后才应用。';
const resize = { type:'set_page', patch:{paper:'CUSTOM',customSizeMm:{width:188.5,height:244.2},orientation:'portrait'} };
const call = (name,args={}) => fauxAssistantMessage([fauxToolCall(name,args,{id:crypto.randomUUID()})],{stopReason:'toolUse'});
const ready = async () => ({report:{status:'ready',metrics:{logicalPages:1}}});
function run(responses,{request=previewRequest,project=newProject(),...options}={}) {
  const provider = fauxProvider({provider:'draft-outcome',models:[{id:'draft-outcome'}]}); provider.setResponses(responses);
  const models = createModels(); models.setProvider(provider.provider);
  return runAgentLoop({models,model:provider.getModel(),request,project,context:()=>'{"fictional":true}',inspect:ready,
    signal:new AbortController().signal,verifyRelease:async()=>({release:'consumer-fixture',verified:true}),...options});
}
function toolsFor(request=previewRequest,scope={mode:'whole'}) {
  const project = newProject(), draft = createDraft(project,{request,scope}), outcome = {};
  const tools = createAgentTools({draft,outcome,context:()=> '{}',inspect:ready,signal:new AbortController().signal,
    limits:{maxTurns:100,maxRepeatedFailures:5}});
  return {project,draft,outcome,execute:(name,args={})=>tools.find(tool=>tool.name===name).execute(name,args)};
}

describe('host draft outcome, not model prose',()=> {
  it('accepts an exact answer without delivering or committing a draft',async()=> {
    const project = newProject(), before = structuredClone(project), message = '{"draftReady":true,"note":"Preview first"}';
    const result = await run([call('get_context'),call('finish_answer',{message})],{project});
    expect(result).toMatchObject({kind:'answer',taskOutcome:'answered',message});
    expect(result).not.toHaveProperty('candidate'); expect(project).toEqual(before);
  });
  it('does not hand off private edits when the agent chooses finish_answer',async()=> {
    const project = newProject(), before = structuredClone(project);
    const result = await run([call('apply_operations',{summary:'Resize draft',operations:[resize]}),call('inspect_draft'),call('finish_answer',{message:'Ready to review.'})],{project});
    expect(result).toMatchObject({kind:'answer',taskOutcome:'answered',message:'Ready to review.'});
    expect(result).not.toHaveProperty('candidate'); expect(project).toEqual(before);
  });
  it('retains single-step answer bytes as answered',()=> {
    const message = '{"width":188.5,"height":244.2}', result = parseChatReply(JSON.stringify({kind:'answer',message}),newProject(),{request:previewRequest});
    expect(result).toEqual({kind:'answer',message,taskOutcome:'answered'});
  });
  it.each(['How can I change the paper size?','Please explain how to create a private draft.','Please prepare an explanation of how to change the paper.','只读：请解释如何修改纸张，不要修改任何内容。'])('keeps a real explanation request available: %s',async request=> {
    const message = '{"answer":"Use the paper settings controls."}';
    const result = await run([call('get_context'),call('finish_answer',{message})],{request});
    expect(result).toMatchObject({kind:'answer',taskOutcome:'answered',message});
    expect(result).not.toHaveProperty('candidate');
  });
  it('preserves an explicit blocked path without making a draft or claiming an answer completed it',async()=> {
    await expect(run([call('report_blocked',{reason:'The requested device capabilities are unavailable.'})])).rejects.toMatchObject({code:'AGENT_BLOCKED',reason:'The requested device capabilities are unavailable.'});
  });
  it('hands over only a current inspected exact-size candidate; every untouched design property/data stays unchanged',async()=> {
    const base = newProject(), design = designOf(base);
    design.page = {...pageSettings(design),margins:{top:12,right:13,bottom:14,left:15},printerProfile:{version:1,source:'user-supplied',name:'Fictional device',maxWidthMm:220,maxHeightMm:300,orientations:['portrait'],dpi:203,cutter:false}};
    const project = compileProject(base,design), before = structuredClone(project), beforeDesign = designOf(project);
    let inspected;
    const result = await run([call('apply_operations',{summary:'Private custom paper draft',operations:[resize]}),call('inspect_draft'),call('finish',{summary:'Custom paper candidate for human review'})],
      {project,inspect:async({candidate})=> { inspected = structuredClone(candidate); return ready(); }});
    expect(result).toMatchObject({kind:'proposal',taskOutcome:'draft-ready',steps:1,inspection:{ready:true}});
    expect(result.candidate).toEqual(inspected);
    expect(result.design).toEqual({...beforeDesign,page:{...beforeDesign.page,paper:'CUSTOM',customSizeMm:{width:188.5,height:244.2},orientation:'portrait'}});
    expect(result.candidate.sampleData).toEqual(before.sampleData);
    expect(project).toEqual(before); // No host mutation path exists here: only the person's later Apply can commit.
    expect(result.diff.every(entry=>entry.target==='document' && ['page.paper','page.customSizeMm'].includes(entry.property))).toBe(true);
  });
  it.each(['missing','altered','undone'])('rejects a %s final inspection for the explicitly requested draft',async mode=> {
    const state = toolsFor(), before = structuredClone(state.project);
    await state.execute('apply_operations',{summary:'Private resize',operations:[resize]});
    if (mode!=='missing') await state.execute('inspect_draft');
    if (mode==='altered') await state.execute('apply_operations',{summary:'Another draft edit',operations:[{type:'set_heading',value:'Changed after inspection'}]});
    if (mode==='undone') await state.execute('undo_step');
    await expect(state.execute('finish',{summary:'Finished'})).rejects.toMatchObject({code:mode==='undone' ? 'NO_CHANGES' : 'AGENT_INSPECTION_REQUIRED'});
    expect(state.outcome.proposal).toBeUndefined(); expect(state.project).toEqual(before);
  });
  it('does not enlarge a selection to satisfy a global paper request',async()=> {
    const state = toolsFor(previewRequest,{mode:'selected',id:'customer'});
    await expect(state.execute('apply_operations',{summary:'Resize',operations:[resize]})).rejects.toMatchObject({code:'UNSAFE_SCOPE'});
    expect(state.draft.count).toBe(0); expect(state.outcome.proposal).toBeUndefined();
  });
});
