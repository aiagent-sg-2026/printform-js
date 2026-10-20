import {beforeEach,describe,expect,it,vi} from 'vitest';
import {html,setup,AUTO_REPLY,MANUAL_REPLY} from './support/chat-panel.js';
import {editProject,designOperations} from '../studio-v3/controller.js';
import {autoApplicable,operationAutoApplicable} from '../studio-v3/ai-auto-apply-policy.js';
import {activityLines,describeChange} from '../studio-v3/ai-activity.js';
import {parseChatReply} from '../studio-v3/ai-chat-protocol.js';
import {newProject} from '../studio-v3/model.js';

beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});
const proposal = (operations,diff=[{target:'style',property:'color'}]) => ({kind:'proposal',operations,diff});
const commitInto = counter => async next => { counter.count++; await editProject(next.bus,designOperations(next.bus.project,next.design),'AI'); return {bus:next.bus,revision:next.bus.revision}; };

describe('auto-apply policy',()=> {
  it('allows layout and static-content operations',()=> {
    const allowed=[{type:'set_style',patch:{repeatHeader:true}},{type:'set_element_style',target:'header-title',patch:{fontSize:20}},
      {type:'set_table_style',target:'items',patch:{rowBackground:'#eee'}},{type:'set_heading',value:'Tax Invoice'},{type:'set_logo',value:null},
      {type:'set_section',target:'header',patch:{enabled:false}},{type:'reorder_fields',section:'items',order:[]},{type:'reorder_sections',order:[]},
      {type:'set_field',target:'footer-note',patch:{text:'Thanks',label:'Note',showLabel:true,width:12}},
      ...[undefined,'static','image'].map(kind=>({type:'add_field',section:'footer',field:{id:'note',text:'Thanks',...(kind ? {kind} : {})}})),
      {type:'remove_field',target:'footer-note'}];
    for (const op of allowed) {
      expect(operationAutoApplicable(op)).toBe(true); expect(autoApplicable(proposal([op]))).toBe(true);
      expect(autoApplicable(proposal([op]),{workspace:true})).toBe(false);
    }
  });
  it('keeps binding keys, collection, page and unknown operations manual',()=> {
    const manual=[{type:'set_collection',value:'/lines'},{type:'set_page',patch:{margins:{top:12}}},{type:'unknown_new_op'},
      ...['pointer','format','kind','barcode'].map(key=>({type:'set_field',target:'items-qty',patch:{[key]:null}})),
      ...['pointer','format','barcode'].map(key=>({type:'add_field',section:'footer',field:{id:'note',[key]:null}})),
      {type:'add_field',section:'footer',field:{id:'note',kind:'bound'}}];
    for (const op of manual) expect(autoApplicable(proposal([op]))).toBe(false);
  });
  it('uses the removed target pointer diff, not another field or model text',()=> {
    const op={type:'remove_field',target:'footer-note'};
    for (const before of [undefined,null,'']) expect(autoApplicable(proposal([op],[{target:op.target,property:'pointer',before}]))).toBe(true);
    expect(autoApplicable(proposal([op],[{target:op.target,property:'pointer',before:'/customer/name'}]))).toBe(false);
    expect(autoApplicable(proposal([op],[{target:'items-qty',property:'pointer',before:'./qty'}]))).toBe(true);
  });
  it('recognizes static and bound removals from the real parser diff',()=> {
    const project=newProject(),parse=operations=>parseChatReply(JSON.stringify({kind:'proposal',summary:'Field edits',operations}),project);
    const staticField={type:'add_field',section:'footer',field:{id:'auto-note',kind:'static',text:'Thanks'}},added=parse([staticField]);
    expect(autoApplicable(added)).toBe(true);
    const removed=parseChatReply(JSON.stringify({kind:'proposal',summary:'Remove note',operations:[{type:'remove_field',target:'footer-auto-note'}]}),added.candidate);
    expect(autoApplicable(removed)).toBe(true);
    const bound=parse([{type:'remove_field',target:'customer-ship'}]);
    expect(bound.diff).toContainEqual(expect.objectContaining({target:'customer-ship',property:'pointer',before:expect.stringMatching(/\S/)}));
    expect(autoApplicable(bound)).toBe(false);
  });
  it('requires every operation to pass, and rejects anything that is not a proposal',()=> {
    expect(autoApplicable(proposal([{type:'set_heading',value:'x'},{type:'set_page',patch:{paper:'A5'}}]))).toBe(false);
    expect(autoApplicable({kind:'answer',message:'hi'})).toBe(false); expect(autoApplicable(null)).toBe(false);
    expect(autoApplicable({kind:'proposal',diff:[]})).toBe(false);
  });
  it('decides single-step edits from the diff and ignores the model summary',()=> {
    expect(autoApplicable({kind:'proposal',summary:'Needs approval',diff:[{target:'style',property:'color'},{target:'items-qty',property:'width'}]})).toBe(true);
    expect(autoApplicable({kind:'proposal',summary:'Fine',diff:[{target:'style',property:'repeatHeader'}]})).toBe(true);
    expect(autoApplicable({kind:'proposal',diff:[{target:'page',property:'margins'}]})).toBe(false);
  });
});

describe('activity lines',()=> {
  it('say what changed in plain words, once per kind of change',()=> {
    const diff=[{target:'items',property:'rowBackground',before:null,after:'#eee'},{target:'label-items-code',property:'labelStyle',before:'{}',after:'{"color":"#fff"}'},{target:'label-items-qty',property:'labelStyle',before:'{}',after:'{"color":"#fff"}'},
      {target:'header',property:'layout',before:'{}',after:'{"gap":8}'},{target:'items-qty',property:'width',before:10,after:12},{target:'style',property:'padding',before:4,after:6}];
    expect(activityLines(diff)).toEqual(['Updated table row color','Updated table header color','Adjusted header spacing','Changed column widths','Adjusted cell spacing']);
  });
  it('keep raw property names out of every line and fold a long list',()=> {
    const diff=Array.from({length:9},(_,i)=>({target:`items-c${i}`,property:'width',before:1,after:2})).concat(['color','font','padding','striped','borders','repeatHeader','pageNumbers'].map(property=>({target:'style',property,before:1,after:2})));
    const lines=activityLines(diff); expect(lines.length).toBe(6); expect(lines.at(-1)).toMatch(/^and \d+ more$/);
    for (const entry of diff) expect(describeChange(entry)).not.toMatch(/[a-z][A-Z]|_|\bstyle ·/);
  });
  it('collapse an added field into one line instead of one per property',()=> {
    const diff=[{target:'footer-note',property:'add_field',before:null,after:'footer-note'},{target:'footer-note',property:'id',before:'(unset)',after:'note'},{target:'footer-note',property:'text',before:'(unset)',after:'Thanks'}];
    expect(activityLines(diff)).toEqual(['Added a field']);
  });
});

describe('the panel applies ordinary layout edits by itself',()=> {
  it('applies a checked style edit once, shows it as applied, and offers Undo',async()=> {
    const counter={count:0},{panel}=setup({reply:AUTO_REPLY,commit:commitInto(counter)});
    await panel.send();
    const card=panel.conversation.messages.find(m=>m.diff);
    expect(counter.count).toBe(1); expect(card.status).toBe('applied'); expect(panel.proposal).toBeNull(); expect(panel.getBus().revision).toBe(1);
    expect(panel.node('[data-ai=apply]')).toBeNull(); expect(panel.canUndo(card)).toBe(true);
    expect(panel.node('[data-ai=undo]')).not.toBeNull(); expect(panel.node('[data-ai-log]').textContent).toContain('Applied to the form');
  });
  it('shows plain activity lines first and keeps the raw diff and JSON inside collapsed Details',async()=> {
    const {panel}=setup({reply:AUTO_REPLY,commit:commitInto({count:0})}); await panel.send();
    const card=panel.node('.ai-change-card'),details=card.querySelector('details.ai-change-details');
    expect([...card.querySelectorAll('.ai-activity li')].map(li=>li.textContent)).toEqual(['Updated accent color']);
    expect(details.open).toBe(false); expect(details.querySelector('table.ai-diff')).not.toBeNull(); expect(details.querySelector('pre.ai-diff-json').textContent).toContain('"property": "color"');
    expect(card.querySelector(':scope > table')).toBeNull();
  });
  it('still requires Apply for a change outside the allowlist',async()=> {
    const counter={count:0},{panel}=setup({reply:MANUAL_REPLY,commit:commitInto(counter)}); await panel.send();
    expect(counter.count).toBe(0); expect(panel.proposal).not.toBeNull(); expect(panel.getBus().revision).toBe(0);
    expect(panel.node('[data-ai=apply]')).not.toBeNull(); expect(panel.conversation.messages.find(m=>m.diff).status).toBe('ready');
  });
  it('does not apply when the paper preview is blocked, and leaves the form unchanged',async()=> {
    const counter={count:0},blocked=async()=>({status:'blocked',validation:{valid:false,errors:[{code:'PAPER_SIZE_OVERFLOW',message:'x'}],warnings:[]}});
    const {panel}=setup({reply:AUTO_REPLY,commit:commitInto(counter),preview:blocked}); await panel.send();
    expect(counter.count).toBe(0); expect(panel.getBus().revision).toBe(0); expect(panel.checked).toBe(false);
    expect(panel.node('[data-ai=apply]')?.disabled).toBe(true);
  });
  it('does not apply a proposal that went stale while the request was running',async()=> {
    let release,started;const held=new Promise(r=>release=r),ready=new Promise(r=>started=r),counter={count:0};
    const {panel,changeBus}=setup({commit:commitInto(counter),plan:async()=> {started();await held;return {text:JSON.stringify(AUTO_REPLY)};}});
    const running=panel.send();await ready;changeBus();release();await running;
    expect(counter.count).toBe(0); expect(panel.proposal).toBeNull();
  });
  it('treats a repeated Apply for the auto-applied proposal as a harmless replay',async()=> {
    const counter={count:0},{panel}=setup({reply:AUTO_REPLY,commit:commitInto(counter)});
    const apply=vi.spyOn(panel,'apply'); await panel.send();
    const key=apply.mock.calls[0][0]; expect(key).toBeTruthy();
    await panel.apply(key); expect(counter.count).toBe(1); expect(panel.getBus().revision).toBe(1);
  });
  it('applies on a narrow screen without closing the panel',async()=> {
    vi.stubGlobal('innerWidth',600); const counter={count:0},{panel}=setup({reply:AUTO_REPLY,commit:commitInto(counter)});
    try { panel.show(); await panel.send(); expect(counter.count).toBe(1); expect(panel.open).toBe(true); } finally { vi.unstubAllGlobals(); }
  });
});
