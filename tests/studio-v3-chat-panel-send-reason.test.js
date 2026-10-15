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
