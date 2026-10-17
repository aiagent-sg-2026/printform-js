import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { html, setup } from './support/chat-panel.js';
import { scriptedGateway, turn, fn } from './support/agent-gateway.js';
import { Conversation } from '../studio-v3/ai-conversation.js';
import { errorMessage } from '../studio-v3/ai-messages.js';

beforeEach(()=> { document.documentElement.innerHTML=html.replace(/<!doctype html>/i,''); document.body.inert=false; localStorage.clear(); });
afterEach(()=> { localStorage.clear(); vi.restoreAllMocks(); });
const ask = (panel,request) => { panel.node('#ai-prompt').value=request; panel.share(); };

describe('assistant-reported blocker is plain text, not a verified capability diagnosis',()=> {
  it('shows a real report_blocked reason without executing markup, automatically retrying or enabling Apply; recovery stays inert',async()=> {
    const reason = '<img src=x onerror="window.__reportBlockedExecuted489=true"><script>window.__reportBlockedExecuted489=true</script> The assistant could not produce a current draft.';
    const gateway = scriptedGateway({agent:[turn([fn(1,'report_blocked',{reason})])]}), commit = vi.fn(), {panel}=setup({transport:gateway.transport,commit});
    const before=structuredClone(panel.getBus().project); ask(panel,'Create a private draft and wait for human Apply.'); await panel.send();
    const card=panel.conversation.messages.at(-1), article=panel.node(`[data-message-id="${card.id}"]`), shown=article.querySelector('.ai-message-text');
    expect(card.status).toBe('error'); expect(shown.textContent).toContain(`Assistant-reported blocker: ${reason}`);
    expect(shown.textContent).toContain('not a host-verified capability limit');
    expect(shown.querySelector('img,script')).toBeNull(); expect(window.__reportBlockedExecuted489).toBeUndefined();
    expect(article.querySelector('[data-ai="apply"]')).toBeNull(); expect(article.querySelector('[data-ai="preview"]')).toBeNull();
    expect(commit).not.toHaveBeenCalled(); expect(panel.proposal).toBeNull(); expect(panel.getBus().project).toEqual(before); expect(panel.getBus().revision).toBe(0);
    expect(gateway.agentCalls()).toBe(1); expect(gateway.singleCalls()).toBe(0);
    const saved=panel.snapshot(), history=new Conversation(); history.restore(saved.messages,panel.documentKey());
    expect(history.messages.at(-1)).toMatchObject({status:'error',text:card.text}); expect(history.context(panel.documentKey()).some(entry=>entry.content.includes(reason))).toBe(false);
    panel.restoreSnapshot(saved);
    const recovered=panel.conversation.messages.at(-1), restored=panel.node(`[data-message-id="${recovered.id}"] .ai-message-text`);
    expect(restored.textContent).toBe(card.text); expect(restored.querySelector('img,script')).toBeNull(); expect(panel.proposal).toBeNull();
  });
  it.each(['AGENT_BLOCKED','AGENT_TIMEOUT'])('never saves runtime/cause output while presenting %s',async code=> {
    const secret='PRIVATE_RUNTIME_OUTPUT_482', reason=code==='AGENT_BLOCKED' ? 'A bounded public assistant report.' : secret;
    const failure=Object.assign(new Error(secret),{code,reason,stderr:secret,stdout:secret,cause:{reason:secret}}), commit=vi.fn();
    const {panel}=setup({commit,plan:async()=> {throw failure;}}); ask(panel,'Create a private draft.'); await panel.send();
    const card=panel.conversation.messages.at(-1), saved=panel.snapshot();
    expect(card.status).toBe('error'); expect(card.text).toBe(errorMessage(failure)); expect(card.text).not.toContain(secret);
    expect(JSON.stringify(saved)).not.toContain(secret); expect(commit).not.toHaveBeenCalled(); expect(panel.proposal).toBeNull();
    if (code==='AGENT_BLOCKED') expect(card.text).toContain(`Assistant-reported blocker: ${reason}`);
    const history=new Conversation(); history.restore(saved.messages,panel.documentKey()); expect(history.messages.at(-1).text).toBe(card.text);
  });
  it('keeps a normal inspected read-only JSON answer and its observation receipt separate and byte-exact',async()=> {
    const message='{"paper":"A4","unchanged":true}', gateway=scriptedGateway({agent:[turn([fn(1,'inspect_draft',{})]),turn([fn(2,'finish_answer',{message})])]}), {panel}=setup({transport:gateway.transport});
    ask(panel,'What is the current paper size?'); await panel.send();
    const card=panel.conversation.messages.at(-1), article=panel.node(`[data-message-id="${card.id}"]`);
    expect(card).toMatchObject({status:'answer',text:message,taskOutcome:'answered'}); expect(article.querySelector('.ai-message-text').textContent).toBe(message);
    expect(article.querySelector('.ai-observation-receipt').textContent).toBe(`Observation receipt: ${card.observation.id}`);
    expect(card.text).not.toContain('Assistant-reported blocker'); expect(panel.proposal).toBeNull(); expect(panel.getBus().revision).toBe(0);
  });
});
