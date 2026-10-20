import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {html,setup} from './support/chat-panel.js';
import {scriptedGateway,successfulRun,json,plain,turn,reasoning,fn,message,manualOp} from './support/agent-gateway.js';
import {setAgentEnabled} from '../studio-v3/agent-preference.js';

beforeEach(()=> {document.documentElement.innerHTML = html.replace(/<!doctype html>/i,'');document.body.inert = false;localStorage.clear();});
afterEach(()=> localStorage.clear());
const NAVY = '{"kind":"proposal","summary":"Page margins","operations":[{"type":"set_page","patch":{"margins":{"top":12}}}]}';
const lastCard = panel => panel.conversation.messages.at(-1);
const ask = (panel,text) => { panel.node('#ai-prompt').value = text; panel.share(); };

describe('the panel working in steps',()=> {
  it('hands over one proposal from several steps, and leaves the live form alone',async()=> {
    const gateway = scriptedGateway({agent:successfulRun()}), {panel} = setup({transport:gateway.transport}), stepped = vi.spyOn(panel,'stepDone');
    await panel.send();
    expect(gateway.agentCalls()).toBe(4); expect(gateway.singleCalls()).toBe(0); expect(stepped).toHaveBeenCalledTimes(4);
    expect(panel.proposal).not.toBeNull(); expect(lastCard(panel).status).toBe('ready'); expect(lastCard(panel).diff.length).toBeGreaterThan(0);
    expect(panel.getBus().revision).toBe(0);
    expect(panel.proposal.alias).toBe('demo-fast');
    expect(panel.node('[data-ai-status]').textContent).toContain('4 steps'); expect(panel.node('[data-ai-status]').textContent).toContain('Local checks passed');
  });

  it('falls back to the single-step flow when the gateway has no tools, and remembers it',async()=> {
    const gateway = scriptedGateway({agent:[json({error:{code:'DEMO_AGENT_TOOLS_DISABLED',message:'agent tools are disabled'}},400)],single:[plain(NAVY),plain(NAVY)]}), {panel} = setup({transport:gateway.transport});
    await panel.send();
    expect(panel.proposal).not.toBeNull(); expect(panel.agentUnavailable).toBe(true); expect(gateway.agentCalls()).toBe(1); expect(gateway.singleCalls()).toBe(1);
    ask(panel,'Use navy accents.'); await panel.send();
    expect(gateway.agentCalls()).toBe(1); expect(gateway.singleCalls()).toBe(2);
  });

  it('uses the single-step flow, this once, when the model answers in words and calls no tool',async()=> {
    const gateway = scriptedGateway({agent:[turn([message('All done.')])],single:[plain(NAVY)]}), {panel} = setup({transport:gateway.transport});
    await panel.send();
    expect(panel.proposal).not.toBeNull(); expect(panel.agentUnavailable).toBe(false); expect(gateway.agentCalls()).toBe(1); expect(gateway.singleCalls()).toBe(1);
  });

  it('reports a run that took steps and then ended without a result, instead of starting over silently',async()=> {
    const gateway = scriptedGateway({agent:[turn([reasoning(1),fn(1,'get_context',{})]),turn([message('All done.')])],single:[plain(NAVY)]}), {panel} = setup({transport:gateway.transport});
    await panel.send();
    expect(panel.proposal).toBeNull(); expect(lastCard(panel).status).toBe('error'); expect(gateway.singleCalls()).toBe(0);
  });

  it('restores committed paper when the provider fails after inspecting a private draft',async()=> {
    const restore = vi.fn(async()=>{}), gateway = scriptedGateway({agent:[...successfulRun().slice(0,3),json({error:{code:'upstream_error'}},502)]}), {panel} = setup({transport:gateway.transport,restore});
    const committed = JSON.stringify(panel.getBus().project);
    await panel.send();
    expect(lastCard(panel).status).toBe('error'); expect(panel.proposal).toBeNull();
    expect(restore).toHaveBeenCalledTimes(1); expect(panel.viewing).toBe(false);
    expect(document.querySelector('#ai-preview-banner').hidden).toBe(true);
    expect(JSON.stringify(panel.getBus().project)).toBe(committed); expect(panel.getBus().revision).toBe(0);
    expect(gateway.singleCalls()).toBe(0);
  });

  it('keeps print protection and the error when restoration after a failed run fails',async()=> {
    const restore = vi.fn(async()=> { throw new Error('restore failed'); }), gateway = scriptedGateway({agent:[...successfulRun().slice(0,3),json({error:{code:'upstream_error'}},502)]}), {panel} = setup({transport:gateway.transport,restore});
    await panel.send();
    expect(lastCard(panel).status).toBe('error'); expect(panel.proposal).toBeNull();
    expect(restore).toHaveBeenCalledTimes(1); expect(panel.viewing).toBe(true);
    expect(document.querySelector('#ai-preview-banner').hidden).toBe(false);
    expect(panel.node('[data-ai-status]').textContent).toContain('before printing'); expect(panel.getBus().revision).toBe(0);
  });

  it('keeps general how-to questions in the read-only tool lane',async()=> {
    const gateway = scriptedGateway({agent:[turn([reasoning(1),fn(1,'get_context',{})]),turn([reasoning(2),fn(2,'finish_answer',{message:'Select the field, then choose an available binding.'})])]}), {panel} = setup({transport:gateway.transport});
    ask(panel,'How should I bind an attendance field?'); await panel.send();
    expect(lastCard(panel).status).toBe('answer'); expect(panel.proposal).toBeNull(); expect(panel.getBus().revision).toBe(0);
    for (const body of gateway.bodies.filter(body=>body.tools)) {
      expect(body.tools.map(tool=>tool.name)).toContain('finish_answer');
      expect(body.tools.map(tool=>tool.name)).not.toContain('apply_operations');
      expect(body.tools.map(tool=>tool.name)).not.toContain('finish');
    }
  });

  it('does not publish an inspected answer into a replaced document while restoration is pending',async()=> {
    let release,started;
    const held = new Promise(resolve=>release=resolve), ready = new Promise(resolve=>started=resolve);
    const gateway = scriptedGateway({agent:[turn([reasoning(1),fn(1,'inspect_draft',{})]),turn([reasoning(2),fn(2,'finish_answer',{message:'Answer from previous document'})])]}), {panel,changeBus} = setup({transport:gateway.transport,restore:async()=> { started(); await held; }});
    ask(panel,'Is the layout ready to print?');
    const old = panel.getBus(), before = structuredClone(old.project), sending = panel.send();
    await ready; const current = changeBus(); release(); await sending;
    expect(panel.conversation.messages.some(card=>card.text==='Answer from previous document')).toBe(false);
    expect(old.project).toEqual(before); expect(old.revision).toBe(0); expect(current.revision).toBe(0); expect(panel.proposal).toBeNull();
  });
  it('runs a question in steps under a read-only grant, and keeps the single-step flow when steps are off or unavailable',async()=> {
    const question = scriptedGateway({agent:[turn([reasoning(1),fn(1,'get_context',{})]),turn([reasoning(2),fn(2,'finish_answer',{message:'The footer holds the notes.'})])]}), asked = setup({transport:question.transport});
    ask(asked.panel,'What is in the footer?'); await asked.panel.send();
    expect(question.agentCalls()).toBe(2); expect(question.singleCalls()).toBe(0);
    expect(asked.panel.proposal).toBeNull(); expect(lastCard(asked.panel).status).toBe('answer'); expect(lastCard(asked.panel).text).toBe('The footer holds the notes.');
    expect(asked.panel.getBus().revision).toBe(0);
    document.documentElement.innerHTML = html.replace(/<!doctype html>/i,'');
    const unavailable = scriptedGateway({agent:[json({error:{code:'DEMO_AGENT_TOOLS_DISABLED',message:'agent tools are disabled'}},400)],single:[plain('{"kind":"answer","message":"Sizes below."}')]}), refused = setup({transport:unavailable.transport});
    ask(refused.panel,'What are the current font sizes?'); await refused.panel.send();
    expect(unavailable.agentCalls()).toBe(1); expect(unavailable.singleCalls()).toBe(1); expect(refused.panel.agentUnavailable).toBe(true);
    document.documentElement.innerHTML = html.replace(/<!doctype html>/i,'');
    setAgentEnabled(false);
    const off = scriptedGateway({single:[plain(NAVY),plain('{"kind":"answer","message":"Sizes below."}')]}), {panel} = setup({transport:off.transport});
    await panel.send(); expect(off.agentCalls()).toBe(0); expect(off.singleCalls()).toBe(1); expect(panel.proposal).not.toBeNull();
    ask(panel,'What are the current font sizes?'); await panel.send(); expect(off.agentCalls()).toBe(0); expect(off.singleCalls()).toBe(2);
  });

  it('does not work in steps for a request that carries images, which the step tools cannot see',()=> {
    const {panel} = setup({transport:scriptedGateway().transport}), payload = {request:'Use navy accents.',conversation:[]};
    expect(panel.useSteps(payload,[],'demo-fast')).toBe(true); expect(panel.useSteps(payload,[{type:'input_image'}],'demo-fast')).toBe(false);
  });

  it('works in steps on reference images once the gateway has confirmed image support, and stops resending them after a few turns',async()=> {
    const gateway = scriptedGateway({multimodal:true,agent:[
      turn([reasoning(1),fn(1,'get_context',{})]),turn([reasoning(2),fn(2,'take_notes',{notes:'Two columns; total bottom right.'})]),turn([reasoning(3),fn(3,'get_context',{})]),
      turn([reasoning(4),fn(4,'get_context',{})]),turn([reasoning(5),fn(5,'apply_operations',{summary:'Page margins',operations:[manualOp()]})]),turn([reasoning(6),fn(6,'inspect_draft',{})]),turn([reasoning(7),fn(7,'finish',{summary:'Page margins'})])
    ]}), {panel} = setup({transport:gateway.transport});
    panel.referenceFiles.files = [{id:'ref-1',name:'fictional.png',kind:'image',mime:'image/png',processing:'visual',pageCount:1,text:'',pages:[{number:1,width:10,height:10,text:'',textItems:[],preview:{dataUrl:'data:image/png;base64,AAAA'}}],warnings:[]}];
    panel.referenceFiles.root.open = true; panel.referenceFiles.changed();
    await panel.referenceFiles.checkImageSupport(); // the product asks for this before images are sent
    await panel.send();
    expect(panel.proposal).not.toBeNull(); expect(gateway.agentCalls()).toBe(7);
    const carries = body => JSON.stringify(body.input).includes('data:image/png;base64,AAAA');
    expect(gateway.bodies.filter(body=>body.tools).map(carries)).toEqual([true,true,true,true,false,false,false]);
    expect(gateway.bodies.filter(body=>body.tools).map(body=>body.stream)).toEqual([false,false,false,false,true,true,true]);
    expect(JSON.stringify(gateway.bodies.at(-1).input)).toContain('Two columns; total bottom right.');
  });

  it('shows the steps taken so far while it works',async()=> {
    const gateway = scriptedGateway({agent:[turn([reasoning(1),fn(1,'get_context',{})]),init=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'}))))]}), {panel} = setup({transport:gateway.transport});
    const sending = panel.send();
    await vi.waitFor(()=>expect(panel.node('[data-ai-log] .ai-steps li')).not.toBeNull());
    expect(panel.node('[data-ai-log] .ai-steps li').textContent).toContain('Looked at the form');
    expect(panel.node('[data-ai-status]').textContent).toMatch(/12 tokens/); // 10 in + 2 out of the finished turn
    panel.node('[data-ai=cancel]').click(); await sending;
    expect(panel.node('[data-ai-log] .ai-steps')).toBeNull();
  });

  it('can be stopped, and then has no proposal',async()=> {
    const gateway = scriptedGateway({agent:[turn([reasoning(1),fn(1,'get_context',{})]),init=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'}))))]}), {panel} = setup({transport:gateway.transport});
    const sending = panel.send();
    await vi.waitFor(()=>expect(gateway.agentCalls()).toBe(2));
    panel.node('[data-ai=cancel]').click(); await sending;
    expect(panel.proposal).toBeNull(); expect(lastCard(panel).status).toBe('cancelled');
  });

  it('drops the run, with no proposal and no further request, when the live form changes meanwhile',async()=> {
    let ctl;
    const gateway = scriptedGateway({agent:[turn([reasoning(1),fn(1,'get_context',{})]),()=> { ctl.changeBus(); return turn([reasoning(2),fn(2,'get_context',{})]); },turn([reasoning(3),fn(3,'finish',{summary:'x'})])]});
    ctl = setup({transport:gateway.transport});
    await ctl.panel.send();
    expect(ctl.panel.proposal).toBeNull(); expect(lastCard(ctl.panel).status).toBe('cancelled');
    expect(gateway.agentCalls()).toBe(2);
  });
});
