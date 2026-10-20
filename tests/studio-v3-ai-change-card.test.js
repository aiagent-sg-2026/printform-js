import {describe,expect,it,vi} from 'vitest';
import {renderChangeCard} from '../studio-v3/ai-change-card.js';

const bus = {};
const diff = [{target:'items-code',property:'width',before:10,after:12},{target:'items-qty',property:'width',before:8,after:10}];
const message = (patch={}) => ({id:'card-1',status:'applied',appliedRevision:12,appliedBus:bus,diff,at:Date.UTC(2026,9,20,7,40),...patch});
const panel = (patch={}) => ({getBus:()=>bus,canUndo:()=>true,applying:false,...patch});

describe('applied change card',()=> {
  it('uses the committed revision and raw change count rather than grouped activity count',()=> {
    const card=renderChangeCard(panel(),message());
    expect(card.querySelector('h3').textContent).toContain('Revision 12');
    expect(card.querySelectorAll('.ai-activity li')).toHaveLength(1);
    expect(card.querySelector('.ai-card-footer').textContent).toContain('2 changes applied');
    expect(card.querySelector('time').dateTime).toBe(new Date(message().at).toISOString());
    expect(renderChangeCard(panel(),message({at:undefined})).querySelector('time')).toBeNull();
  });
  it('toggles the linked disclosure both ways and synchronizes native disclosure changes',()=> {
    const card=renderChangeCard(panel(),message()),details=card.querySelector('details'),view=card.querySelector('[aria-controls]');
    details.scrollIntoView=vi.fn();
    expect(view.getAttribute('aria-controls')).toBe(details.id); expect(details.open).toBe(false); expect(view.getAttribute('aria-expanded')).toBe('false');
    view.click(); expect(details.open).toBe(true); expect(view.getAttribute('aria-expanded')).toBe('true'); expect(details.scrollIntoView).toHaveBeenCalledWith({block:'nearest'});
    expect(details.querySelector('.ai-diff-json').textContent).toBe(JSON.stringify(diff,null,2));
    view.click(); expect(details.open).toBe(false); expect(view.getAttribute('aria-expanded')).toBe('false');
    details.open=true; details.dispatchEvent(new Event('toggle')); expect(view.getAttribute('aria-expanded')).toBe('true');
  });
  it('retains undo routing and disables it during an apply, but omits it from history',()=> {
    const card=renderChangeCard(panel({applying:true}),message()),undo=card.querySelector('[data-ai=undo]');
    expect(undo.dataset.cardId).toBe('card-1'); expect(undo.disabled).toBe(true);
    const history=renderChangeCard(panel({canUndo:()=>false}),message({appliedBus:{}}));
    expect(history.querySelector('[data-ai=undo]')).toBeNull(); expect(history.textContent).toContain('Applied to a previous form · history only');
  });
  it('keeps ready proposals unapplied with their original action gates and intent',()=> {
    const card=renderChangeCard(panel({proposal:{cardId:'card-1',intentKey:'intent-1'},checked:false}),message({status:'ready'}));
    expect(card.textContent).not.toMatch(/Applied/); expect(card.hasAttribute('data-ai-proposal')).toBe(true);
    expect(card.querySelector('[data-ai=preview]').disabled).toBe(false);
    expect(card.querySelector('[data-ai=apply]').disabled).toBe(true); expect(card.querySelector('[data-ai=apply]').dataset.intent).toBe('intent-1');
    expect(card.querySelector('[data-ai=discard]').disabled).toBe(false); expect(card.querySelector('[data-ai=undo]')).toBeNull();
    expect(card.querySelector('details').open).toBe(false);
  });
});
