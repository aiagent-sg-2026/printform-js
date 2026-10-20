import {afterEach,describe,expect,it} from 'vitest';
import {stepLabel} from '../studio-v3/agent-step-labels.js';
import {agentEnabled,setAgentEnabled,AGENT_KEY} from '../studio-v3/agent-preference.js';

afterEach(()=> localStorage.clear());
describe('step labels',()=> {
  it('say what a step did, with its detail',()=> {
    expect(stepLabel({name:'get_context',ok:true})).toBe('Looked at the form');
    expect(stepLabel({name:'apply_operations',ok:true,detail:'4 changes'})).toBe('Made changes · 4 changes');
    expect(stepLabel({name:'inspect_draft',ok:true,detail:'ready'})).toBe('Checked the print preview · looks good');
  });
  it('use no internal words in any step line',()=> {
    const names = ['get_capabilities','read_skill','get_context','apply_operations','inspect_draft','take_notes','finish','report_blocked','undo_step','import_artifact','something_new'];
    for (const name of names) for (const ok of [true,false]) expect(stepLabel({name,ok})).not.toMatch(/draft|note|operation|handed/i);
  });
  it('show a rejected step as rejected, without its internal code',()=> {
    const text = stepLabel({name:'apply_operations',ok:false,code:'UNSAFE_PROPOSAL'});
    expect(text).toBe('Made changes · did not work, the assistant is trying another way'); expect(text).not.toContain('UNSAFE');
  });
  it('do not break on a tool they do not know',()=> expect(stepLabel({name:'something_new',ok:true})).toBe('Worked on the form'));
});
describe('the work-in-steps setting',()=> {
  it('is on by default and when storage cannot be read',()=> {
    expect(agentEnabled()).toBe(true);
    expect(agentEnabled({getItem(){ throw new Error('blocked'); }})).toBe(true);
  });
  it('remembers being turned off, and on again',()=> {
    setAgentEnabled(false); expect(localStorage.getItem(AGENT_KEY)).toBe('off'); expect(agentEnabled()).toBe(false);
    setAgentEnabled(true); expect(agentEnabled()).toBe(true);
  });
  it('does not throw when storage cannot be written',()=> expect(()=>setAgentEnabled(false,{setItem(){ throw new Error('blocked'); }})).not.toThrow());
});
