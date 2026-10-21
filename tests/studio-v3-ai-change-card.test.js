import {describe,expect,it} from 'vitest';
import {renderChangeCard} from '../studio-v3/ai-change-card.js';

const bus = {};
const diff = [{target:'items-code',property:'width',before:10,after:12},{target:'items-qty',property:'width',before:8,after:10}];
const message = (patch={}) => ({id:'card-1',status:'applied',appliedRevision:12,appliedBus:bus,diff,at:Date.UTC(2026,9,20,7,40),...patch});
const panel = (patch={}) => ({getBus:()=>bus,canUndo:()=>true,applying:false,...patch});

describe('applied change card',()=> {
  it('keeps revision on Undo and groups activity, steps and raw changes in one native disclosure',()=> {
    const steps=[{text:'Adjusted table columns',ok:true},{text:'Checked print layout',ok:true}], card=renderChangeCard(panel(),message({steps})), details=card.querySelector('details.ai-change-details'), undo=card.querySelector('[data-ai=undo]');
    expect(undo.title).toBe('Undo Revision 12'); expect(undo.getAttribute('aria-description')).toBe('Undo Revision 12');
    expect(details.open).toBe(false); expect(card.querySelectorAll('details')).toHaveLength(1);
    expect(details.querySelectorAll('.ai-activity li')).toHaveLength(1);
    expect([...details.querySelectorAll('.ai-run-steps li')].map(item=>item.textContent)).toEqual(steps.map(step=>step.text));
    for (const item of details.querySelectorAll('.ai-run-steps li,.ai-activity li')) expect(item.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(details.querySelector('.ai-diff-json').textContent).toBe(JSON.stringify(diff,null,2));
    expect(card.querySelector('.ai-card-footer')).toBeNull(); expect(card.querySelector('.ai-card-state')).toBeNull();
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
