import {beforeEach,describe,expect,it,vi} from 'vitest';
import {html,setup} from './support/chat-panel.js';
import {Conversation,cleanMessages} from '../studio-v3/ai-conversation.js';
import {AIPanel} from '../studio-v3/ai-panel.js';
import {formatMessageTime} from '../studio-v3/ai-message-time.js';
import {editProject} from '../studio-v3/controller.js';
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});
describe('conversation timestamps and avatars',()=> {
  it('stores and restores epoch milliseconds without adding time metadata to provider context',()=> {
    const at=Date.UTC(2026,9,20,15,40), clock=vi.spyOn(Date,'now').mockReturnValue(at), conversation=new Conversation();
    try { conversation.add('user','Change title','answer',{documentKey:'v3-demo'}); } finally { clock.mockRestore(); }
    expect(conversation.messages[0].at).toBe(at);
    const saved=conversation.snapshot(); expect(saved[0].at).toBe(at); AIPanel.validateSnapshot({prompt:'',open:false,messages:saved});
    const restored=new Conversation(); restored.restore(saved); expect(restored.messages[0].at).toBe(at);
    expect(restored.context('v3-demo')).toEqual([{role:'user',content:'Change title'}]);
  });
  it('restores legacy snapshots without inventing a displayed timestamp',()=> {
    const messages=[{role:'user',text:'Old request',time:1}], {panel}=setup();
    AIPanel.validateSnapshot({prompt:'',open:false,messages}); panel.conversation.restore(messages); panel.update();
    expect(panel.conversation.snapshot()[0]).not.toHaveProperty('at'); expect(panel.node('.ai-message time')).toBeNull();
  });
  it.each([-1,1.5,Infinity,NaN,null,'123',8640000000000001])('rejects invalid optional timestamp %s',at=> {
    const messages=[{role:'user',text:'Request',time:1,at}];
    expect(()=>cleanMessages(messages)).toThrow('INVALID_CHAT_RECOVERY');
    expect(()=>AIPanel.validateSnapshot({prompt:'',open:false,messages})).toThrow('INVALID_CHAT_RECOVERY');
  });
  it('renders generic icon-only avatars for both roles and the working answer',()=> {
    const {panel}=setup(), at=Date.UTC(2026,9,20,15,40);
    panel.conversation.restore([{role:'user',text:'Title',time:at,at},{role:'assistant',text:'Updated',time:at,at}]); panel.pendingMessage='Next request'; panel.update();
    const messages=[...panel.root.querySelectorAll('.ai-message')]; expect(messages).toHaveLength(3);
    for (const message of messages) { const avatar=message.querySelector('.ai-avatar'); expect(avatar.textContent).toBe(''); expect(avatar.querySelector('svg')).not.toBeNull(); expect(avatar.getAttribute('aria-hidden')).toBe('true'); }
    expect(messages[0].dataset.messageId).toBe(panel.conversation.messages[0].id); expect(messages[1].dataset.state).toBe('answer');
    expect(messages[0].querySelector('time').dateTime).toBe(new Date(at).toISOString());
    expect(messages[0].querySelector('time').textContent).toBe(new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(at));
    expect(formatMessageTime(undefined)).toBe(''); expect(messages[2].querySelector('.ai-avatar-assistant')).not.toBeNull();
  });
});
describe('read-only version history',()=> {
  it.each(['busy','applying','restoring'])('disables history while %s and closes an already open popover',state=> {
    const {panel}=setup(), button=panel.node('[data-ai-history]'), popover=panel.node('#ai-history');
    button.click(); expect(popover.hidden).toBe(false); panel[state]=true; panel.update();
    expect(button.disabled).toBe(true); expect(popover.hidden).toBe(true); expect(button.getAttribute('aria-expanded')).toBe('false');
    panel[state]=false; panel.update(); button.click(); expect(popover.hidden).toBe(false);
  });
  it('lists real retained revisions and the monotonic current revision after undo without navigating',async()=> {
    const {panel}=setup(), bus=panel.getBus();
    await editProject(bus,[{type:'set_manifest_value',path:'/title',value:'Changed'}],'title'); await bus.navigateHistory('undo',bus.revision);
    const revision=bus.revision, project=structuredClone(bus.project), button=panel.node('[data-ai-history]'); button.click();
    const current=panel.node('#ai-history [aria-current]'); expect(current.textContent).toBe(`Revision ${revision} · Current`);
    expect([...panel.root.querySelectorAll('#ai-history li')].map(item=>item.textContent)).toEqual(['Revision 0','Revision 1',`Revision ${revision} · Current`]);
    expect(bus.revision).toBe(revision); expect(bus.project).toEqual(project);
  });
  it('takes keyboard focus, consumes Escape before panel dismissal, and returns focus to its trigger',()=> {
    const {panel}=setup(); panel.show(); const button=panel.node('[data-ai-history]'); button.click();
    expect(document.activeElement).toBe(panel.node('#ai-history'));
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(panel.node('#ai-history').hidden).toBe(true); expect(panel.open).toBe(true); expect(document.activeElement).toBe(button);
  });
});
describe('retained run steps',()=> {
  const steps=[{text:'Read the form-authoring guide',ok:true},{text:'Could not change the selected field',ok:false}];
  it('retains only bounded plain steps when stopping and clears them before the next run',()=> {
    const {panel}=setup(); panel.pendingMessage='Request';
    panel.agentSteps=Array.from({length:45},(_,i)=>({text:`${i}:`+'x'.repeat(180),ok:i%2===0,code:'INTERNAL_CODE'}));
    const expected=panel.agentSteps.slice(-40).map(({text,ok})=>({text:text.slice(0,160),ok}));
    panel.cancel(); expect(panel.conversation.messages.at(-1).steps).toEqual(expected); expect(panel.agentSteps).toEqual([]);
    expect(panel.conversation.snapshot().at(-1).steps).toEqual(expected);
    panel.pendingMessage='Next request'; panel.cancel(); expect(panel.conversation.messages.at(-1)).not.toHaveProperty('steps');
  });
  it('round trips assistant steps while excluding them from model context',()=> {
    const conversation=new Conversation(); conversation.add('assistant','Result','answer',{documentKey:'v3-demo',steps});
    const saved=conversation.snapshot(); AIPanel.validateSnapshot({prompt:'',open:false,messages:saved});
    const restored=new Conversation(); restored.restore(saved);
    expect(restored.messages[0].steps).toEqual(steps); expect(restored.context('v3-demo')).toEqual([{role:'assistant',content:'Result'}]);
    saved[0].steps[0].text='Changed snapshot'; expect(conversation.messages[0].steps).toEqual(steps);
  });
  it.each([null,{},'steps',[null],[{text:'x',ok:1}],[{text:3,ok:true}],[{text:'x'.repeat(161),ok:true}],Array.from({length:41},()=>({text:'x',ok:true}))])('rejects malformed steps %j',value=> {
    const messages=[{role:'assistant',text:'Result',time:1,steps:value}];
    expect(()=>cleanMessages(messages)).toThrow('INVALID_CHAT_RECOVERY');
    expect(()=>AIPanel.validateSnapshot({prompt:'',open:false,messages})).toThrow('INVALID_CHAT_RECOVERY');
  });
  it('rejects user steps, including an empty array, and accepts the exact assistant bounds',()=> {
    for(const value of [[],steps]) expect(()=>cleanMessages([{role:'user',text:'Request',time:1,steps:value}])).toThrow('INVALID_CHAT_RECOVERY');
    const bounded=Array.from({length:40},()=>({text:'x'.repeat(160),ok:true}));
    expect(cleanMessages([{role:'assistant',text:'Result',time:1,steps:bounded}])[0].steps).toEqual(bounded);
  });
  it('merges retained steps into the change card disclosure',()=> {
    const {panel}=setup();
    panel.conversation.add('user','Request');
    panel.conversation.add('assistant','Result','ready',{steps,diff:[{target:'style',property:'color',before:'#111111',after:'#222222'}]});
    panel.update();
    const details=panel.node('.ai-assistant details.ai-change-details'), retained=details.querySelector('.ai-run-steps');
    expect(details.open).toBe(false); expect(panel.root.querySelectorAll('.ai-assistant details')).toHaveLength(1);
    expect([...retained.querySelectorAll('li')].map(n=>n.textContent)).toEqual(steps.map(s=>`${s.ok?'✓':'✗'} ${s.text}`));
    expect(retained.querySelectorAll('.ai-step-failed')).toHaveLength(1);
    expect(details.closest('.ai-change-card')).not.toBeNull();
    expect(panel.node('.ai-user .ai-run-steps')).toBeNull();
  });
  it('uses the singular count and omits disclosures for empty or absent steps',()=> {
    const {panel}=setup();
    panel.conversation.add('assistant','One','answer',{steps:steps.slice(0,1)});
    panel.conversation.add('assistant','Empty','answer',{steps:[]}); panel.conversation.add('assistant','Single-step answer'); panel.update();
    expect(panel.root.querySelectorAll('.ai-run-steps')).toHaveLength(1); expect(panel.node('.ai-run-steps summary').textContent).toBe('Worked in 1 step');
  });
});
