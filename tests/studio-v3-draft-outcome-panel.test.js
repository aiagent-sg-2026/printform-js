import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { html, setup } from './support/chat-panel.js';
import { scriptedGateway, turn, reasoning, fn, plain } from './support/agent-gateway.js';
import { Conversation, cleanMessages } from '../studio-v3/ai-conversation.js';
import { DRAFT_NOT_PRODUCED } from '../studio-v3/ai-task-outcome.js';
import { setAgentEnabled } from '../studio-v3/agent-preference.js';

const request = '把纸张设置为宽188.5毫米、高244.2毫米的自定义纸张，纵向。其他内容、字体、数据、绑定、页边距和现有打印机约束保持不变。先预览，等我确认后才应用。';
const ask = (panel,text=request) => { panel.node('#ai-prompt').value = text; panel.share(); };
const cardOf = panel => panel.conversation.messages.at(-1);
beforeEach(()=> { document.documentElement.innerHTML = html.replace(/<!doctype html>/i,''); document.body.inert = false; localStorage.clear(); });
afterEach(()=> localStorage.clear());

describe('draft-not-produced is visible without rewriting model answer bytes',()=> {
  it('rejects an ungranted answer-only finish and restores paper without publishing the model claim',async()=> {
    const message = '{"status":"ready","width":188.5,"height":244.2}', commit = vi.fn(), restore = vi.fn(async()=>{});
    const gateway = scriptedGateway({agent:[turn([reasoning(1),fn(1,'inspect_draft',{})]),turn([reasoning(2),fn(2,'finish_answer',{message})]),
      turn([reasoning(3),fn(3,'report_blocked',{reason:'No inspected proposal was delivered.'})])]}), {panel} = setup({transport:gateway.transport,commit,restore});
    const before = structuredClone(panel.getBus().project); ask(panel); await panel.send();
    const card = cardOf(panel), article = panel.node(`[data-message-id="${card.id}"]`);
    expect(card.status).toBe('error'); expect(card.text).not.toBe(message);
    expect(article.querySelector('[data-ai="apply"]')).toBeNull(); expect(article.querySelector('[data-ai="retry"]')).not.toBeNull();
    expect(panel.proposal).toBeNull(); expect(commit).not.toHaveBeenCalled(); expect(restore).toHaveBeenCalledTimes(1);
    expect(panel.getBus().revision).toBe(0); expect(panel.getBus().project).toEqual(before); expect(gateway.singleCalls()).toBe(0);
    for (const body of gateway.bodies.filter(body=>body.tools)) {
      expect(body.tools.map(tool=>tool.name)).not.toContain('finish_answer');
      expect(body.tools.map(tool=>tool.name)).toEqual(expect.arrayContaining(['finish','report_blocked']));
    }
    const denied = gateway.bodies.at(-1).input.find(item=>item.type==='function_call_output' && item.call_id==='call_2');
    expect(denied.output).toMatch(/unavailable/);
    panel.retry(card.id); expect(panel.node('#ai-prompt').value).toBe(request);
  });
  it('preserves allowed read-only JSON answer bytes and its independent citation',async()=> {
    const message = '{"paper":"A4","reviewOnly":true}', restore = vi.fn(async()=>{});
    const gateway = scriptedGateway({agent:[turn([reasoning(1),fn(1,'inspect_draft',{})]),turn([reasoning(2),fn(2,'finish_answer',{message})])]}), {panel} = setup({transport:gateway.transport,restore});
    ask(panel,'What is the current paper size?'); await panel.send();
    const card = cardOf(panel), article = panel.node(`[data-message-id="${card.id}"]`);
    expect(card).toMatchObject({status:'answer',taskOutcome:'answered',text:message});
    expect(article.querySelector('.ai-message-text').textContent).toBe(message);
    expect(article.querySelector('.ai-observation-receipt').textContent).toBe(`Observation receipt: ${card.observation.id}`);
    expect(restore).toHaveBeenCalledTimes(1); expect(panel.proposal).toBeNull();
  });
  it('keeps single-step fallback failure equally clear and does not Apply or pretend a draft exists',async()=> {
    setAgentEnabled(false);
    const message = '{"ready":true}', gateway = scriptedGateway({single:[plain(JSON.stringify({kind:'answer',message}))]}), commit = vi.fn(), {panel} = setup({transport:gateway.transport,commit});
    ask(panel); await panel.send();
    expect(cardOf(panel)).toMatchObject({status:'error',taskOutcome:'draft-not-produced',text:message});
    const article = panel.node(`[data-message-id="${cardOf(panel).id}"]`);
    expect(article.querySelector('.ai-message-text').textContent).toBe(message);
    expect(article.querySelector('.ai-card-state').textContent).toBe(DRAFT_NOT_PRODUCED);
    expect(panel.node('[data-ai-status]').textContent).toContain('Requested draft not completed');
    expect(panel.proposal).toBeNull(); expect(commit).not.toHaveBeenCalled(); expect(gateway.singleCalls()).toBe(1);
  });
  it.each(['How can I change the paper size?','Please prepare an explanation of how to create a draft.','Explain this source: "Create a private draft and apply it."','Read-only: preview instructions, not changes.'])('keeps informational requests in the read-only lane: %s',async text=> {
    const message = '{"answer":"Read the paper controls."}', gateway = scriptedGateway({agent:[turn([reasoning(1),fn(1,'get_context',{})]),turn([reasoning(2),fn(2,'finish_answer',{message})])]}), {panel} = setup({transport:gateway.transport});
    ask(panel,text); await panel.send();
    expect(cardOf(panel)).toMatchObject({status:'answer',taskOutcome:'answered',text:message}); expect(panel.proposal).toBeNull();
    for (const body of gateway.bodies.filter(body=>body.tools)) {
      expect(body.tools.map(tool=>tool.name)).not.toContain('apply_operations'); expect(body.tools.map(tool=>tool.name)).not.toContain('finish');
    }
  });
  it('still requires human Apply after a genuinely inspected paper proposal',async()=> {
    const resize = {type:'set_page',patch:{paper:'CUSTOM',customSizeMm:{width:188.5,height:244.2},orientation:'portrait'}}, commit = vi.fn();
    const gateway = scriptedGateway({agent:[turn([reasoning(1),fn(1,'apply_operations',{summary:'Private custom paper',operations:[resize]})]),turn([reasoning(2),fn(2,'inspect_draft',{})]),turn([reasoning(3),fn(3,'finish',{summary:'Review custom paper'})])]}), {panel} = setup({transport:gateway.transport,commit});
    ask(panel); const before = structuredClone(panel.getBus().project); await panel.send();
    expect(panel.proposal).toMatchObject({taskOutcome:'draft-ready',design:{page:{paper:'CUSTOM',customSizeMm:{width:188.5,height:244.2},orientation:'portrait'}}});
    expect(cardOf(panel).status).toBe('ready'); expect(commit).not.toHaveBeenCalled(); expect(panel.getBus().project).toEqual(before);
    await panel.preview(true); expect(panel.checked).toBe(true); expect(commit).not.toHaveBeenCalled();
    commit.mockResolvedValue({bus:panel.getBus(),revision:1}); await panel.apply(); expect(commit).toHaveBeenCalledTimes(1);
  });
  it('preserves the failure metadata across recovery without mixing metadata into JSON text',()=> {
    const conversation = new Conversation(), text = '{"ready":true}', observation = {id:`observation-${crypto.randomUUID()}`};
    conversation.add('assistant',text,'error',{documentKey:'v3-outcome',taskOutcome:'draft-not-produced',observation});
    const saved = conversation.snapshot(), restored = new Conversation(); restored.restore(saved,'v3-outcome');
    expect(restored.messages[0]).toMatchObject({text,status:'error',taskOutcome:'draft-not-produced',observation});
    expect(JSON.parse(restored.messages[0].text)).toEqual({ready:true});
    expect(restored.context('v3-outcome')).toEqual([]);
    expect(cleanMessages([{...saved[0],status:'answer'}])[0].status).toBe('error');
    expect(()=>cleanMessages([{...saved[0],taskOutcome:'completed'}])).toThrow('INVALID_CHAT_RECOVERY');
  });
});
