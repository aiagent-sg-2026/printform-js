import {afterEach,describe,it,expect,vi} from 'vitest';
import {AIObservationAuthorization} from '../studio-v3/ai-observation-authorization.js';
import {newProject} from '../studio-v3/model.js';
import {Conversation} from '../studio-v3/ai-conversation.js';
import {assertObservationAuthorization} from '../studio-v3/observation-policy.js';
import {html,setup as setupPanel} from './support/chat-panel.js';

afterEach(()=>vi.restoreAllMocks());
function panelOf(options) {
  document.documentElement.innerHTML=html.replace(/<!doctype html>/i,''); document.body.inert=false;
  return setupPanel(options).panel;
}
const armPanel=panel=> { const input=panel.node('#ai-observation-text'); input.checked=true; input.dispatchEvent(new Event('change')); };

function setup() {
  document.body.innerHTML='<input type="checkbox" id="consent">';
  const input=document.querySelector('input'), bus={project:newProject(),revision:0,dataPolicy:{allowDurable:false}};
  const panel={getBus:()=>bus,getSelection:()=> 'items',scope:()=>({mode:'whole'}),node:selector=>selector === '#ai-observation-text' ? input : null,update:()=>{}};
  const access=new AIObservationAuthorization(panel);
  const arm=()=> { input.checked=true; input.dispatchEvent(new Event('change')); };
  return {input,bus,panel,access,arm};
}
describe('OBS-01 host text authorization UI lifecycle',()=> {
  it.each(['direct completion','discovery failure'])('revokes a consumed host grant after %s and requires fresh approval',async path=> {
    const transport={clear:()=>{},clearSession:()=>{},discover:async()=>{if(path==='discovery failure')throw new Error('unavailable');return ['demo-fast'];},plan:async()=>({text:JSON.stringify({kind:'answer',message:'Ordinary answer.'})})};
    const panel=panelOf({transport}), access=panel.observationAccess, consume=access.consume.bind(access); let grant;
    vi.spyOn(access,'consume').mockImplementation(async id=> { grant=await consume(id); expect(grant.text).toBe(true); assertObservationAuthorization(grant,access.state(id)); return grant; });
    armPanel(panel); await panel.send();
    expect(panel.busy).toBe(false); expect(access.active).toBeNull();
    expect(panel.conversation.messages.at(-1).status).toBe(path==='direct completion' ? 'answer' : 'error');
    expect(()=>assertObservationAuthorization(grant,access.state(grant.runId))).toThrow(expect.objectContaining({code:'OBSERVATION_AUTHORIZATION_STALE'}));
    armPanel(panel); const fresh=await consume('fresh'); expect(fresh.text).toBe(true); expect(fresh.id).not.toBe(grant.id); access.reset();
  });
  it('rejects a pending mint after cancel instead of restoring authority when hashing completes',async()=> {
    const panel=panelOf(), access=panel.observationAccess, digest=crypto.subtle.digest.bind(crypto.subtle); let release, started=0;
    const pending=new Promise(resolve=> { release=resolve; });
    vi.spyOn(crypto.subtle,'digest').mockImplementation(async(...args)=> { started++; await pending; return digest(...args); });
    armPanel(panel); const sending=panel.send(); await vi.waitFor(()=>expect(started).toBe(2));
    panel.cancel(); release(); await sending;
    expect(access.active).toBeNull(); expect(panel.busy).toBe(false); expect(panel.conversation.messages.at(-1).status).toBe('cancelled');
    armPanel(panel); expect((await access.consume('recovered')).text).toBe(true); access.reset();
  });
  it('revokes a prior host grant before consuming the next run',async()=> {
    const host=setup(); host.arm(); const old=await host.access.consume('old');
    const fresh=await host.access.consume('new'); expect(fresh.text).toBe(false);
    expect(()=>assertObservationAuthorization(old,host.access.state('old'))).toThrow(expect.objectContaining({code:'OBSERVATION_AUTHORIZATION_STALE'}));
    assertObservationAuthorization(fresh,host.access.state('new')); host.access.reset();
  });
  it('keeps answers using disclosed observations out of later and recovered provider history',()=> {
    const history=new Conversation(), key='v3-fixture';
    history.add('assistant','AUTHORIZED_HISTORY_CANARY','answer',{documentKey:key,observationProtected:true});
    history.add('assistant','Ordinary public answer','answer',{documentKey:key});
    expect(JSON.stringify(history.context(key))).not.toContain('AUTHORIZED_HISTORY_CANARY');
    const recovered=new Conversation(); recovered.restore(history.snapshot());
    expect(recovered.messages[0].text).toBe('AUTHORIZED_HISTORY_CANARY');
    expect(JSON.stringify(recovered.context(key))).not.toContain('AUTHORIZED_HISTORY_CANARY');
    expect(JSON.stringify(recovered.context(key))).toContain('Ordinary public answer');
  });
  it('defaults off, explicitly arms, consumes once and never persists consent',async()=> {
    const host=setup(); expect((await host.access.consume('default')).text).toBe(false);
    host.arm(); expect(host.access.notice()).toContain('authorized for one run');
    expect((await host.access.consume('approved')).text).toBe(true); expect(host.input.checked).toBe(false);
    expect((await host.access.consume('next')).text).toBe(false);
    expect(host.access.notice()).toContain('Bound values blocked. Page and embedded asset pixels blocked.');
    host.arm(); host.access.reset(); expect(host.input.checked).toBe(false);
    expect((await host.access.consume('recovered-conversation')).text).toBe(false);
  });
  it.each(['content','revision','policy'])('clears armed consent on %s changes and permits explicit recovery',async change=> {
    const host=setup(); host.arm();
    if (change==='content') host.bus.project.sampleData.extra='changed';
    if (change==='revision') host.bus.revision++;
    if (change==='policy') host.bus.dataPolicy={classification:'unknown'};
    await expect(host.access.consume('stale')).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'});
    host.access.refresh(); expect(host.input.checked).toBe(false);
    host.arm(); expect((await host.access.consume('fresh')).text).toBe(true);
  });
});
