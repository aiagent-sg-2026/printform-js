import {afterEach,describe,expect,it} from 'vitest';
import {stepLabel} from '../studio-v3/agent-step-labels.js';
import {agentEnabled,setAgentEnabled,AGENT_KEY} from '../studio-v3/agent-preference.js';

afterEach(()=> localStorage.clear());
describe('step labels',()=> {
  it('shows only the supplied safe guide identifier and operation count',()=> {
    expect(stepLabel({name:'read_skill',ok:true,skillId:'form-authoring'})).toBe('Read the form-authoring guide');
    expect(stepLabel({name:'apply_operations',ok:true,operationCount:1})).toBe('Made changes · 1 operation');
    expect(stepLabel({name:'apply_operations',ok:true,operationCount:3})).toBe('Made changes · 3 operations');
    expect(stepLabel({name:'read_skill',ok:true,skillId:'<private value>'})).not.toContain('private');
    for(const operationCount of [-1,1.5,'2',NaN]) expect(stepLabel({name:'apply_operations',ok:true,operationCount})).not.toContain(String(operationCount));
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
