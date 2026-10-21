import {beforeEach,describe,expect,it,vi} from 'vitest';
import {html,setup} from './support/chat-panel.js';
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});
describe('empty conversation starters',()=> {
  it('fills and focuses the input without sending or changing the form',()=> {
    const {panel,calls}=setup(),send=vi.spyOn(panel,'send'),project=structuredClone(panel.getBus().project),button=panel.node('.ai-welcome [data-prompt]'); button.click();
    expect(panel.node('#ai-prompt').value).toBe(button.dataset.prompt); expect(document.activeElement).toBe(panel.node('#ai-prompt')); expect(send).not.toHaveBeenCalled(); expect(calls()).toBe(0); expect(panel.getBus().project).toEqual(project);
  });
  it.each(['busy','applying','restoring'])('prevents starter selection while %s',state=> {
    const {panel}=setup(),prompt=panel.node('#ai-prompt'),before=prompt.value; panel[state]=true; panel.update();
    for (const button of panel.root.querySelectorAll('.ai-welcome [data-prompt]')) { expect(button.disabled).toBe(true); button.click(); } expect(prompt.value).toBe(before);
  });
  it('shows starters only before the first exchange and restores them after clearing',()=> {
    const {panel}=setup(); expect(panel.node('.ai-welcome [data-prompt]')).not.toBeNull(); expect(panel.node('[data-ai-suggestions]').hidden).toBe(true);
    panel.conversation.add('user','Adjust spacing'); panel.update(); expect(panel.node('.ai-welcome')).toBeNull(); expect(panel.node('[data-ai-suggestions]').hidden).toBe(true);
    panel.conversation.messages=[]; panel.update(); expect(panel.node('.ai-welcome [data-prompt]')).not.toBeNull(); expect(panel.node('[data-ai-suggestions]').hidden).toBe(true);
  });
  it('keeps attachment, derived scope, send and stop available in the composer toolbar',()=> {
    const {panel}=setup(),toolbar=panel.node('.ai-composer-toolbar');
    for (const selector of ['[data-ai=attach]','#ai-scope','[data-ai-send]','[data-ai=cancel]']) expect(toolbar.querySelector(selector)).toBe(panel.node(selector));
    expect(panel.scope()).toEqual({mode:'whole'}); expect(panel.node('#ai-scope').value).toBe('whole'); expect(panel.node('#ai-scope').querySelector('[value=selected]').disabled).toBe(true); expect(panel.node('#ai-scope').getAttribute('aria-description')).toBeTruthy();
    panel.busy=true; panel.update(); expect(toolbar.querySelector('[data-ai-send]').hidden).toBe(true); expect(toolbar.querySelector('[data-ai=cancel]').hidden).toBe(false); expect(toolbar.querySelector('#ai-scope').disabled).toBe(true);
  });
});
