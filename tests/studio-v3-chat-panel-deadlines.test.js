import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {html,setup} from './support/chat-panel.js';
import {scriptedGateway,successfulRun,json,plain,turn,message} from './support/agent-gateway.js';
import {DEMO_CONFIG} from '../studio-v3/ai-gateway-config.js';
import {setAgentEnabled} from '../studio-v3/agent-preference.js';

beforeEach(()=> { document.documentElement.innerHTML=html.replace(/<!doctype html>/i,''); document.body.inert=false; localStorage.clear(); });
afterEach(()=> { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); });
const navy = '{"summary":"Page margins","operations":[{"type":"set_page","patch":{"margins":{"top":12}}}]}';

describe('panel mode deadlines',()=> {
  it('keeps a multi-step run alive beyond the single-step limit, then aborts at its own deadline',async()=> {
    const {panel}=setup(); vi.useFakeTimers();
    const {id,signal}=panel.begin(); panel.setRunTimeout(id,DEMO_CONFIG.agent.maxRunMs,'AGENT_TIMEOUT');
    await vi.advanceTimersByTimeAsync(DEMO_CONFIG.sendTimeoutMs);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(DEMO_CONFIG.agent.maxRunMs-DEMO_CONFIG.sendTimeoutMs-1);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true); expect(panel.timeoutCode).toBe('AGENT_TIMEOUT'); panel.finish();
  });

  it('keeps the single-step deadline and re-arms it for fallback',async()=> {
    const {panel}=setup(); vi.useFakeTimers();
    const first=panel.begin(); await vi.advanceTimersByTimeAsync(DEMO_CONFIG.sendTimeoutMs);
    expect(first.signal.aborted).toBe(true); expect(panel.timeoutCode).toBe('AI_TIMEOUT');
    const next=panel.begin(); panel.setRunTimeout(next.id,DEMO_CONFIG.agent.maxRunMs,'AGENT_TIMEOUT');
    await vi.advanceTimersByTimeAsync(1000); panel.setRunTimeout(next.id,DEMO_CONFIG.sendTimeoutMs);
    await vi.advanceTimersByTimeAsync(DEMO_CONFIG.sendTimeoutMs-1); expect(next.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); expect(next.signal.aborted).toBe(true); expect(panel.timeoutCode).toBe('AI_TIMEOUT'); panel.finish();
  });

  it('Stop immediately cancels the extended run and an old run cannot change a new deadline',async()=> {
    const {panel}=setup(); vi.useFakeTimers();
    const old=panel.begin(); panel.setRunTimeout(old.id,DEMO_CONFIG.agent.maxRunMs,'AGENT_TIMEOUT');
    await panel.stop(); expect(old.signal.aborted).toBe(true); expect(panel.busy).toBe(false);
    const current=panel.begin(); panel.setRunTimeout(old.id,1,'AGENT_TIMEOUT');
    await vi.advanceTimersByTimeAsync(1); expect(current.signal.aborted).toBe(false); panel.finish();
  });

  it.each(['steps','disabled','refused','ignored'])('arms the correct deadline through the actual %s send path',async mode=> {
    setAgentEnabled(mode !== 'disabled');
    const gateway=scriptedGateway({agent:mode === 'refused' ? [json({error:{code:'DEMO_AGENT_TOOLS_DISABLED'}},400)] : mode === 'ignored' ? [turn([message('Done')])] : successfulRun(),single:[plain(navy)]});
    const {panel}=setup({transport:gateway.transport}), deadlines=vi.spyOn(panel,'setRunTimeout');
    await panel.send(); expect(panel.proposal).not.toBeNull();
    const calls=deadlines.mock.calls.map(([,ms,code])=>[ms,code || 'AI_TIMEOUT']);
    expect(calls).toEqual(mode === 'steps' ? [[DEMO_CONFIG.sendTimeoutMs,'AI_TIMEOUT'],[DEMO_CONFIG.agent.maxRunMs,'AGENT_TIMEOUT']] : mode === 'disabled' ? [[DEMO_CONFIG.sendTimeoutMs,'AI_TIMEOUT']] : [[DEMO_CONFIG.sendTimeoutMs,'AI_TIMEOUT'],[DEMO_CONFIG.agent.maxRunMs,'AGENT_TIMEOUT'],[DEMO_CONFIG.sendTimeoutMs,'AI_TIMEOUT']]);
  });
});
