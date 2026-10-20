import {beforeEach,describe,expect,it,vi} from 'vitest';
import {html,setup} from './support/chat-panel.js';
import {SUGGESTIONS,visibleSuggestions} from '../studio-v3/ai-suggestions.js';
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});
const start=()=> { const result=setup(); result.panel.conversation.add('user','Refine the fictional form','answer',{documentKey:result.panel.documentKey()}); result.panel.update(); return result; };
describe('host-owned suggested actions',()=> {
  it('rotates all ten distinct prompts in deterministic groups of five and wraps',()=> {
    expect(SUGGESTIONS).toHaveLength(10); expect(new Set(SUGGESTIONS.map(item=>item.prompt)).size).toBe(10);
    expect(visibleSuggestions(0)).toEqual(SUGGESTIONS.slice(0,5)); expect(visibleSuggestions(5)).toEqual(SUGGESTIONS.slice(5)); expect(visibleSuggestions(10)).toEqual(visibleSuggestions(0));
    const {panel,calls}=start(), refresh=panel.node('[aria-label="Show other suggestions"]'), prompts=()=>[...panel.root.querySelectorAll('.ai-suggestions [data-prompt]')].map(button=>button.dataset.prompt);
    expect(prompts()).toEqual(visibleSuggestions(0).map(item=>item.prompt)); refresh.click(); expect(prompts()).toEqual(visibleSuggestions(5).map(item=>item.prompt)); refresh.click(); expect(prompts()).toEqual(visibleSuggestions(0).map(item=>item.prompt)); expect(calls()).toBe(0);
  });
  it('fills and focuses the input without sending or changing the form',()=> {
    const {panel,calls}=start(), send=vi.spyOn(panel,'send'), project=structuredClone(panel.getBus().project), button=panel.node('.ai-suggestions [data-prompt]'); button.click();
    expect(panel.node('#ai-prompt').value).toBe(button.dataset.prompt); expect(document.activeElement).toBe(panel.node('#ai-prompt')); expect(send).not.toHaveBeenCalled(); expect(calls()).toBe(0); expect(panel.getBus().project).toEqual(project);
  });
  it.each(['busy','applying','restoring'])('hides suggestions and prevents chip selection and refresh while %s',state=> {
    const {panel}=start(), prompt=panel.node('#ai-prompt'), before=prompt.value; panel[state]=true; panel.update();
    expect(panel.node('[data-ai-suggestions]').hidden).toBe(true);
    for (const button of panel.root.querySelectorAll('.ai-suggestions button')) { expect(button.disabled).toBe(true); button.click(); } expect(prompt.value).toBe(before);
    panel[state]=false; panel.update(); expect(panel.node('[data-ai-suggestions]').hidden).toBe(false); expect(panel.node('.ai-suggestions [data-prompt]').disabled).toBe(false);
  });
  it('uses welcome starters alone until conversation messages exist and hides suggestions again after clearing',()=> {
    const {panel}=setup(); expect(panel.node('.ai-welcome [data-prompt]')).not.toBeNull(); expect(panel.node('.ai-suggestions').hidden).toBe(true);
    expect(panel.root.querySelectorAll('[data-ai=prompt]')).toEqual(panel.root.querySelectorAll('.ai-welcome [data-ai=prompt]'));
    panel.conversation.add('user','Adjust spacing'); panel.update(); expect(panel.node('.ai-welcome')).toBeNull(); expect(panel.node('.ai-suggestions').hidden).toBe(false);
    expect([...panel.root.querySelectorAll('[data-ai=prompt]')].map(button=>button.dataset.prompt)).toEqual(visibleSuggestions(0).map(item=>item.prompt));
    panel.conversation.messages=[]; panel.update(); expect(panel.node('.ai-suggestions').hidden).toBe(true);
    expect(panel.node('.ai-suggestions').querySelector('[data-ai=prompt]')).toBeNull();
  });
  it('hides suggestions during reference reading and restores them when ready',()=> {
    const {panel}=start(); panel.referenceFiles.reading=true; panel.update(); expect(panel.node('[data-ai-suggestions]').hidden).toBe(true);
    panel.referenceFiles.reading=false; panel.update(); expect(panel.node('[data-ai-suggestions]').hidden).toBe(false);
  });
  it('keeps attachment, derived scope, send and stop available in the composer toolbar',()=> {
    const {panel}=setup(), toolbar=panel.node('.ai-composer-toolbar');
    for (const selector of ['[data-ai=attach]','#ai-scope','[data-ai-send]','[data-ai=cancel]']) expect(toolbar.querySelector(selector)).toBe(panel.node(selector));
    expect(panel.scope()).toEqual({mode:'whole'}); expect(panel.node('#ai-scope').value).toBe('whole'); expect(panel.node('#ai-scope').querySelector('[value=selected]').disabled).toBe(true); expect(panel.node('#ai-scope').getAttribute('aria-description')).toBeTruthy();
    panel.busy=true; panel.update(); expect(toolbar.querySelector('[data-ai-send]').hidden).toBe(true); expect(toolbar.querySelector('[data-ai=cancel]').hidden).toBe(false); expect(toolbar.querySelector('#ai-scope').disabled).toBe(true);
  });
});
