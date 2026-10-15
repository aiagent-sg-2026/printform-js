import {beforeEach,describe,it,expect} from 'vitest';
import {AIElementTags} from '../studio-v3/ai-element-tags.js';
import {html,setup} from './support/chat-panel.js';
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});

describe('empty conversation',()=> {
  it('leaves the welcome state when the conversation starts',async()=> {
    const {panel}=setup();await panel.send();expect(panel.node('.ai-welcome')).toBeNull();
    expect(panel.node('.ai-user .ai-message-label')).not.toBeNull();expect(panel.node('.ai-assistant .ai-message-label')).not.toBeNull();
  });
});

describe('conversation scrolling',()=> {
  const viewport=panel=> {
    const scroll=panel.node('.ai-conversation-scroll');
    Object.defineProperties(scroll,{scrollHeight:{configurable:true,get:()=>1000},clientHeight:{configurable:true,get:()=>300}});
    return scroll;
  };
  it('keeps a reader at their history position during updates',async()=> {
    const {panel}=setup();await panel.send();const scroll=viewport(panel);scroll.scrollTop=120;
    panel.update();expect(scroll.scrollTop).toBe(120);
  });
  it('follows new work when already near the bottom',async()=> {
    const {panel}=setup();await panel.send();const scroll=viewport(panel);scroll.scrollTop=690;
    panel.update();expect(scroll.scrollTop).toBe(1000);
  });
  it('keeps sharing controls in place when a permission changes before the first message',()=> {
    const {panel}=setup(),scroll=viewport(panel);scroll.scrollTop=500;
    const input=panel.node('#ai-observation-text');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));
    expect(scroll.scrollTop).toBe(500);expect(input.checked).toBe(true);
  });
  it('resets context position only when the conversation is explicitly cleared',async()=> {
    const {panel}=setup(),scroll=viewport(panel);panel.node('#ai-prompt').value='';scroll.scrollTop=500;
    await panel.clear();expect(scroll.scrollTop).toBe(0);
  });
});

describe('scope and sharing',()=> {
  const selected=panel=> {
    panel.elementTags=new AIElementTags({bus:()=>panel.getBus(),selection:()=>'label-customer-ship',onChange:()=>panel.share()});
    panel.elementTags.add('label-customer-ship');panel.contextChanged();
  };
  it('derives selected scope and lets Whole form clear element references',()=> {
    const {panel}=setup(),select=panel.node('#ai-scope');expect(panel.scope()).toEqual({mode:'whole'});
    selected(panel);expect(panel.scope().ids).toEqual(['label-customer-ship']);expect(select.value).toBe('selected');
    select.value='whole';select.dispatchEvent(new Event('change',{bubbles:true}));
    expect(panel.scope()).toEqual({mode:'whole'});expect(panel.elementTags.snapshot()).toEqual([]);
  });
  it('cannot change scope during a run',()=> {
    const {panel}=setup();panel.busy=true;panel.update();expect(panel.node('#ai-scope').disabled).toBe(true);
  });
  it('keeps full explicit permissions available, unchecked and independent of disclosure state',()=> {
    const {panel}=setup(),sharing=panel.node('.ai-sharing');
    for(const id of ['#ai-observation-text','#ai-observation-pixels']) {
      const input=panel.node(id);expect(input.checked).toBe(false);expect(sharing.contains(input)).toBe(true);
    }
    sharing.open=true;sharing.open=false;
    expect(panel.node('#ai-observation-text').checked).toBe(false);expect(panel.node('#ai-observation-pixels').checked).toBe(false);
  });
});

describe('header and composer',()=> {
  it('dismisses settings on a conversation click without closing the panel',()=> {
    const {panel}=setup(),settings=panel.node('.ai-settings');settings.open=true;
    panel.node('[data-ai-log]').click();expect(settings.open).toBe(false);
  });
  it('requires a narrow-screen paper preview before enabling Apply',async()=> {
    const width=innerWidth;window.innerWidth=400;
    try {
      const {panel}=setup();await panel.send();
      expect(panel.node('[data-ai=apply]').disabled).toBe(true);expect(panel.getBus().revision).toBe(0);
      await panel.preview();
      expect(panel.node('[data-ai=apply]').disabled).toBe(false);expect(panel.getBus().revision).toBe(0);
    } finally {window.innerWidth=width;}
  });
});
