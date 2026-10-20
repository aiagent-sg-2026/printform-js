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
