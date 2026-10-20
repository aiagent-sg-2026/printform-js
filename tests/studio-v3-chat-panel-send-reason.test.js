import {beforeEach,describe,it,expect} from 'vitest';
import {html,setup,visualPanel} from './support/chat-panel.js';
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});

// One line under the message box is always on screen: who receives the request, or why Send is off.
const line=panel=>panel.node('[data-ai-send-reason]');
describe('the line under the message box',()=> {
  it('tells who receives the request while Send works',()=> {
    const {panel}=setup();panel.update();
    expect(panel.node('[data-ai-send]').disabled).toBe(false);
    expect(line(panel).hidden).toBe(false);expect(line(panel).dataset.kind).toBe('notice');
  });
  it('keeps consent state inside the disclosure and updates it without expanding or authorizing anything',()=> {
    const {panel}=setup(); panel.update();
    const sharing=panel.node('.ai-sharing'), consent=sharing.querySelector('[data-ai-consent-state]'), input=panel.node('#ai-observation-text');
    expect(sharing.open).toBe(false); expect(input.checked).toBe(false);
    expect(consent.textContent).toContain(panel.observationAccess.notice({compact:true}));
    expect(line(panel).textContent).toContain('Demo gateway'); expect(line(panel).textContent).toContain('fictional data only');
    expect(line(panel).textContent).not.toContain('Text/bindings');
    input.click();
    expect(consent.textContent).toContain(panel.observationAccess.notice({compact:true}));
    expect(consent.textContent).toContain('Text/bindings authorized'); expect(panel.node('#ai-observation-pixels').checked).toBe(false);
    input.click(); expect(consent.textContent).toContain('Text/bindings off'); expect(sharing.open).toBe(false);
  });
  it('retains full status text and tooltip while preserving announcement modes',()=> {
    const {panel}=setup(), status=panel.node('[data-ai-status]'), text='Local checks passed. Review the paper preview, then Apply. (demo-fast · r1 · 4 steps · Tokens: 48)';
    panel.message(text); expect(status.textContent).toBe(text); expect(status.title).toBe(text); expect(status.getAttribute('aria-live')).toBe('polite');
    panel.message('Waiting…',{progress:true}); expect(status.title).toBe('Waiting…'); expect(status.getAttribute('aria-live')).toBe('off');
  });
  it('is still there once the conversation has started',async()=> {
    const {panel}=setup();await panel.send();
    expect(panel.node('[data-ai-log] .ai-welcome')).toBeNull();expect(line(panel).hidden).toBe(false);
  });
  it('names the missing image support and what to do about it, tied to the Send button',()=> {
    const {panel}=visualPanel('image');panel.update();
    expect(panel.node('[data-ai-send]').disabled).toBe(true);
    expect(line(panel).dataset.kind).toBe('reason');expect(line(panel).textContent).toContain('image support is not confirmed');expect(line(panel).textContent).toContain('Check image support');
    expect(panel.node('[data-ai-send]').getAttribute('aria-describedby')).toBe(line(panel).id);
  });
  it('goes back to the notice once image support is confirmed',async()=> {
    const {panel}=visualPanel('image');panel.update();
    await panel.referenceFiles.checkImageSupport();panel.update();
    expect(panel.node('[data-ai-send]').disabled).toBe(false);expect(line(panel).dataset.kind).toBe('notice');
  });
  it('says references are still being read',()=> {
    const {panel}=setup();panel.referenceFiles.reading=true;panel.update();
    expect(panel.node('[data-ai-send]').disabled).toBe(true);expect(line(panel).dataset.kind).toBe('reason');expect(line(panel).textContent).toContain('Reading references');
  });
});
