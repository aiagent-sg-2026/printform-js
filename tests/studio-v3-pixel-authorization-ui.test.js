import {describe,it,expect,vi,afterEach} from 'vitest';
import {AIObservationAuthorization} from '../studio-v3/ai-observation-authorization.js';
import {assertObservationAuthorization,OBSERVATION_AUTHORIZATION_MS} from '../studio-v3/observation-policy.js';
import {staticProject} from './support/pixel-observation.js';
afterEach(()=>vi.restoreAllMocks());
function setup() {
  document.body.innerHTML='<input id="ai-observation-text" type="checkbox"><input id="ai-observation-pixels" type="checkbox">';
  let selected='header-title';
  const bus={project:staticProject(),revision:0,dataPolicy:{allowDurable:false}}, panel={getBus:()=>bus,getSelection:()=>selected,scope:()=>({mode:'whole'}),node:selector=>document.querySelector(selector),update:()=>{}};
  const access=new AIObservationAuthorization(panel), arm=()=> { for (const input of document.querySelectorAll('input')) { input.checked=true; input.dispatchEvent(new Event('change')); } };
  return {bus,access,arm,select:id=> { selected=id; }};
}
describe('OBS-02 explicit single-run fictional pixel consent',()=> {
  it('defaults off, consumes once, revokes on completion/reset and requires fresh consent',async()=> {
    const host=setup(); expect((await host.access.consume('default')).pixels).toBe(false);
    host.arm(); const grant=await host.access.consume('approved'); expect(grant).toMatchObject({text:true,pixels:true,values:false});
    expect([...document.querySelectorAll('input')].every(n=>!n.checked)).toBe(true);
    host.access.end(); expect(()=>assertObservationAuthorization(grant,host.access.state('approved'))).toThrow();
    expect((await host.access.consume('next')).pixels).toBe(false);
    host.arm(); expect((await host.access.consume('fresh')).id).not.toBe(grant.id); host.access.reset();
    expect((await host.access.consume('restored')).pixels).toBe(false);
  });
  it.each(['selection','content','revision','deadline'])('clears armed pixel consent after %s change and recovers explicitly',async change=> {
    const host=setup(); host.arm();
    if (change==='selection') host.select('footer');
    if (change==='content') host.bus.project.sampleData.changed=true;
    if (change==='revision') host.bus.revision++;
    if (change==='deadline') host.access.armedAt-=OBSERVATION_AUTHORIZATION_MS;
    await expect(host.access.consume('stale')).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'});
    host.access.refresh(); expect(document.querySelector('#ai-observation-pixels').checked).toBe(false);
    host.arm(); expect((await host.access.consume('fresh')).pixels).toBe(true);
  });
  it('rejects a delayed pixel grant after cancellation and recovers only after a new arm',async()=> {
    const host=setup(), digest=crypto.subtle.digest.bind(crypto.subtle); let release,started=0;
    const waiting=new Promise(resolve=> { release=resolve; });
    vi.spyOn(crypto.subtle,'digest').mockImplementation(async(...args)=> { started++;await waiting;return digest(...args); });
    host.arm();const pending=host.access.consume('cancelled');await vi.waitFor(()=>expect(started).toBe(2));
    host.access.end();release();await expect(pending).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'});
    expect(host.access.active).toBeNull();expect((await host.access.consume('unarmed')).pixels).toBe(false);
    host.arm();expect((await host.access.consume('recovery')).pixels).toBe(true);
  });
});
