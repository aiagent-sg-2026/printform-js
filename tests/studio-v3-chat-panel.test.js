import {beforeEach,describe,it,expect,vi} from 'vitest';
import {AIPanel} from '../studio-v3/ai-panel.js';
import {PaperPreview} from '../studio-v3/preview.js';
import {AIElementTags} from '../studio-v3/ai-element-tags.js';
import {newProject} from '../studio-v3/model.js';
import {createBus,editProject,designOperations} from '../studio-v3/controller.js';
import {html,setup} from './support/chat-panel.js';
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});
it('requires renewed context review if measured facts change before any gateway call',async()=> {
  let facts=[];const {panel,calls}=setup({facts:()=>facts});
  facts=[{id:'header',role:'title',pt:18}];await panel.send();expect(calls()).toBe(0);expect(panel.proposal).toBeNull();expect(panel.getBus().revision).toBe(0);
});
it('expires a response/card after selection moves away and back, preserving canonical revision',async()=> {
  const {panel,select}=setup();await panel.send();const bus=panel.getBus();expect(panel.proposal).toBeTruthy();select('customer');select('items');expect(panel.proposal).toBeNull();expect(bus.revision).toBe(0);expect(panel.conversation.messages.at(-1).status).toBe('expired');
});
it('keeps a completed edit attached to its captured bus when navigation replaces the document during render',async()=> {
  let release,started;const held=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const {panel,changeBus}=setup({commit:async proposal=> {await editProject(proposal.bus,designOperations(proposal.bus.project,proposal.design),'AI');const result={bus:proposal.bus,revision:proposal.bus.revision};started();await held;return result;}});
  await panel.send();await panel.preview();const oldBus=panel.getBus(),running=panel.apply();await ready;const current=changeBus();release();await running;
  const card=panel.conversation.messages.find(m=>m.diff);expect(card.status).toBe('applied');expect(card.appliedBus).toBe(oldBus);expect(card.appliedRevision).toBe(1);expect(current.revision).toBe(0);expect(panel.canUndo(card)).toBe(false);
});
it('binds typography to the committed document/revision, rejecting old, candidate and blocked contexts',()=> {
  const paper=new PaperPreview(document.querySelector('#preview-frame'),()=>{},()=>{}),project=createBus(newProject()).project;
  paper.committedFacts={documentId:project.manifest.documentId,revision:project.revision,design:JSON.stringify(project.manifest.studioV3),facts:[{id:'header',role:'title',pt:18}]};
  expect(paper.factsFor(project)).toHaveLength(1);expect(paper.factsFor({...project,revision:project.revision+1})).toEqual([]);
  const other=structuredClone(project);other.manifest.documentId='v3-other';expect(paper.factsFor(other)).toEqual([]);
  const candidate=structuredClone(project);candidate.manifest.studioV3.font=10;expect(paper.factsFor(candidate)).toEqual([]);
  paper.committedFacts=null;expect(paper.factsFor(project)).toEqual([]);
});

it('rejects a late provider reply when selection changes away and back during a request',async()=> {
  let release,started;const held=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const {panel,select}=setup({plan:async()=> {started();return held;}}),running=panel.send();await ready;select('customer');select('items');release({text:JSON.stringify({kind:'proposal',summary:'Late',edits:[{target:'style',property:'color',value:'#163a65'}]})});await running;
  expect(panel.proposal).toBeNull();expect(panel.getBus().revision).toBe(0);expect(panel.conversation.messages.some(m=>m.diff)).toBe(false);expect(panel.busy).toBe(false);
});
it('rejects a single-step answer if dataset identity changes without a revision during inference',async()=> {
  let holder;
  const {panel}=setup({plan:async()=> {holder.getBus().project.sampleData.company.name='Changed fictional company';return {text:JSON.stringify({kind:'answer',message:'Answer for old data'})};}});holder=panel;
  panel.node('#ai-prompt').value='What is this form for?';panel.share();await panel.send();
  expect(panel.proposal).toBeNull();expect(panel.getBus().revision).toBe(0);
  expect(panel.conversation.messages.at(-1).status).toBe('error');
  expect(panel.conversation.messages.some(m=>m.role==='assistant' && m.text==='Answer for old data')).toBe(false);
});
it('Stop during discovery prevents inference even if discovery ignores cancellation',async()=> {
  let release,started;
  const held=new Promise(r=>release=r),ready=new Promise(r=>started=r),plan=vi.fn(async()=>({text:JSON.stringify({kind:'answer',message:'Late'})}));
  const {panel}=setup({transport:{clear:()=>{},clearSession:()=>{},discover:async()=> {started();return held;},plan}});
  const running=panel.send();await ready;await panel.stop();release(['demo-fast']);await running;
  expect(plan).not.toHaveBeenCalled();expect(panel.proposal).toBeNull();expect(panel.getBus().revision).toBe(0);
  expect(panel.conversation.messages.at(-1).status).toBe('cancelled');
});
it('rechecks scope/selection when an Apply waits in the command queue',async()=> {
  let release,started,panel,restores=0;const held=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const result=setup({restore:async()=> {restores++;},commit:async(proposal,generation)=> {started();await held;panel.assertCurrent(proposal,generation);throw new Error('must not reach commit');}});panel=result.panel;
  await panel.send();await panel.preview();const running=panel.apply();await ready;result.select('customer');expect(panel.viewing).toBe(true);expect(panel.node('#ai-prompt').disabled).toBe(true);release();await running;
  expect(panel.getBus().revision).toBe(0);expect(panel.proposal).toBeNull();expect(panel.node('[data-ai-status]').textContent).toContain('Nothing changed');expect(restores).toBe(1);expect(panel.viewing).toBe(false);
});

it('keeps the unapplied banner/print protection if canonical restoration itself fails',async()=> {
  const {panel}=setup({commit:async()=> {throw new Error('blocked');},restore:async()=> {throw new Error('restore failed');}});
  await panel.send();await panel.preview();await panel.apply();expect(panel.viewing).toBe(true);expect(document.querySelector('#ai-preview-banner').hidden).toBe(false);expect(panel.node('[data-ai-status]').textContent).toContain('restore the form before printing');expect(panel.getBus().revision).toBe(0);
});
it('keeps candidate print protection when a new Send or Discard cannot restore canonical paper',async()=> {
  const {panel,calls}=setup({restore:async()=>{throw new Error('restore failed');}});
  await panel.send();expect(panel.viewing).toBe(true);panel.node('#ai-prompt').value='Another request';panel.share();await panel.send();
  expect(calls()).toBe(1);expect(panel.viewing).toBe(true);expect(document.querySelector('#ai-preview-banner').hidden).toBe(false);
  await panel.discard();expect(panel.viewing).toBe(true);expect(panel.getBus().revision).toBe(0);
});
it('an older restoration cannot unlock Send while a newer selection restoration is still pending',async()=> {
  let release1,release2,calls=0;const one=new Promise(r=>release1=r),two=new Promise(r=>release2=r);
  const {panel,select}=setup({restore:()=>++calls===1 ? one : two});await panel.send();const stopped=panel.stop();select('customer');
  release1();await stopped;expect(panel.restoring).toBe(true);expect(panel.node('[data-ai-send]').disabled).toBe(true);
  release2();await new Promise(r=>setTimeout(r,0));expect(panel.restoring).toBe(false);expect(panel.viewing).toBe(false);
});
it('Clear keeps candidate print protection and does not reject if canonical restoration fails',async()=> {
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
  try {const {panel}=setup({restore:async()=>{throw new Error('restore failed');}});await panel.send();await expect(panel.clear()).resolves.toBeUndefined();expect(panel.viewing).toBe(true);expect(document.querySelector('#ai-preview-banner').hidden).toBe(false);expect(panel.conversation.messages).toHaveLength(0);expect(panel.node('[data-ai-status]').textContent).toContain('before printing');}
  finally {confirm.mockRestore();}
});

it('changing reference choices restores canonical paper and never unlocks candidate printing early',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve);const restore=vi.fn(()=>wait);const {panel}=setup({restore});
 await panel.send();expect(panel.viewing).toBe(true);panel.referenceFiles.changed();
 expect(panel.proposal).toBeNull();expect(panel.restoring).toBe(true);expect(panel.viewing).toBe(true);expect(restore).toHaveBeenCalledTimes(1);
 release();await vi.waitFor(()=>expect(panel.restoring).toBe(false));expect(panel.viewing).toBe(false);
});
it('reference files never enter recovery snapshots and are removed when the form changes',()=>{
 const {panel,changeBus}=setup();panel.referenceFiles.files=[{id:'reference-test',name:'fictional.pdf',kind:'pdf',mime:'application/pdf',pageCount:1,text:'fictional',pages:[{number:1,width:10,height:10,text:'fictional',textItems:[],preview:{dataUrl:'data:image/jpeg;base64,/9j/2Q=='}}],warnings:[]}];
 panel.referenceFiles.render();expect(JSON.stringify(panel.snapshot())).not.toContain('fictional.pdf');expect(JSON.stringify(panel.snapshot())).not.toContain('base64');changeBus();expect(panel.referenceFiles.files).toEqual([]);expect(panel.root.querySelectorAll('.ai-reference-card')).toHaveLength(0);
});

it('previews the unapplied candidate automatically on wide screens, leaving Apply explicit',async()=> {
  const {panel}=setup();await panel.send();
  expect(panel.proposal).toBeTruthy();expect(panel.checked).toBe(true);expect(panel.viewing).toBe(true);
  expect(panel.node('[data-ai=apply]').disabled).toBe(false);
  expect(panel.getBus().revision).toBe(0);
});
it('keeps Preview manual on narrow screens where it reveals the full-screen paper',async()=> {
  const width=window.innerWidth;
  try {
    window.innerWidth=600;const {panel}=setup();await panel.send();
    expect(panel.checked).toBe(false);expect(panel.node('[data-ai=apply]').disabled).toBe(true);
    await panel.preview();expect(panel.checked).toBe(true);expect(panel.getBus().revision).toBe(0);
  } finally { window.innerWidth=width; }
});
const gatewayWith=(aliases,planned=[])=>({clear:()=>{},clearSession:()=>{},discover:async()=>aliases,plan:async alias=> {planned.push(alias);return {text:JSON.stringify({kind:'answer',message:'ok'})};}});
const chooseModel=(panel,alias)=> {const select=panel.node('#ai-model');panel.setModels(['demo-auto',alias]);select.value=alias;select.dispatchEvent(new Event('input',{bubbles:true}));};
const askAgain=panel=> {panel.node('#ai-prompt').value='Use navy accents.';panel.share();};
it('adapts an untouched default model to what the gateway offers',async()=> {
  const planned=[];const {panel}=setup({transport:gatewayWith(['demo-openai-mini','demo-groq'],planned)});
  expect(panel.node('#ai-model').value).toBe('demo-auto');
  await panel.send();
  expect(planned).toEqual(['demo-openai-mini']);expect(panel.node('#ai-model').value).toBe('demo-openai-mini');
  expect([...panel.node('#ai-model').options].map(o=>o.value)).toEqual(['demo-openai-mini','demo-groq']);
  expect(panel.node('[data-ai-status]').textContent).toContain('demo-openai-mini');
});
it('keeps the routing alias and lists it first when the gateway offers it',async()=> {
  const planned=[];const {panel}=setup({transport:gatewayWith(['demo-groq','demo-auto'],planned)});
  await panel.send();expect(planned).toEqual(['demo-auto']);expect([...panel.node('#ai-model').options].map(o=>o.value)).toEqual(['demo-auto','demo-groq']);
});
it('never replaces a model the user chose: it stops, refreshes the list, and sends only after a new Send',async()=> {
  const planned=[],offered=['demo-auto'];const {panel}=setup({transport:{...gatewayWith(offered,planned),discover:async()=>offered}});
  chooseModel(panel,'demo-groq');expect(panel.modelChosen).toBe(true);
  await panel.send();
  expect(planned).toEqual([]);
  expect(panel.conversation.messages.at(-1).text).toContain('no longer available');
  expect(panel.node('#ai-model').value).toBe('demo-auto');
  askAgain(panel);await panel.send();
  expect(planned).toEqual(['demo-auto']);
});
it('treats a restored non-default model as a deliberate choice and never trusts an unsafe one',()=> {
  const {panel}=setup();const select=panel.node('#ai-model');
  panel.restoreSnapshot({prompt:'',alias:'demo-groq',messages:[],references:[],open:false});
  expect(select.value).toBe('demo-groq');expect(panel.modelChosen).toBe(true);
  panel.restoreSnapshot({prompt:'',alias:'demo-auto',messages:[],references:[],open:false});
  expect(select.value).toBe('demo-auto');expect(panel.modelChosen).toBe(false);
  for(const alias of ['private-model','<script>','demo-x"}',undefined,42]) {
    panel.restoreSnapshot({prompt:'',alias,messages:[],references:[],open:false});
    expect(select.value).toBe('demo-auto');expect(panel.modelChosen).toBe(false);
    expect([...select.options].every(o=>/^demo-[a-z0-9-]+$/.test(o.value))).toBe(true);
  }
});
it('keeps progress ticks silent for screen readers but announces phase changes',async()=> {
  const status=()=>panel.node('[data-ai-status]');
  const {panel}=setup({transport:{clear:()=>{},clearSession:()=>{},discover:async()=>['demo-auto'],plan:async(alias,request,signal,media,{onProgress})=> {
    onProgress({chars:0,elapsedMs:0});expect(status().getAttribute('aria-live')).toBe('off');
    onProgress({chars:1204,elapsedMs:6900});expect(status().getAttribute('aria-live')).toBe('off');
    return {text:JSON.stringify({kind:'answer',message:'ok'})}; }}});
  await panel.send();
  expect(status().getAttribute('aria-live')).toBe('polite');
});
it('hides duplicate progress from screen readers and removes the wait after completion',async()=> {
  const pending=()=>document.querySelector('[data-ai-log] .ai-pending-text');let hidden;
  const {panel}=setup({transport:{clear:()=>{},clearSession:()=>{},discover:async()=>['demo-auto'],plan:async(alias,request,signal,media,{onProgress})=> {
    onProgress({chars:1204,elapsedMs:6900});hidden=pending()?.closest('article').getAttribute('aria-hidden');
    return {text:JSON.stringify({kind:'answer',message:'ok'})}; }}});
  await panel.send();expect(hidden).toBe('true');expect(pending()).toBeNull();
});
it('clears element references once their own Apply succeeds, so the next Send is not blocked as outdated',async()=> {
  const label={kind:'proposal',summary:'Label',operations:[{type:'set_field',target:'label-customer-ship',patch:{label:'Deliver to'}}]};
  // Like the app, the commit announces the changed document (refreshing the hint) while the references still exist.
  let holder;const {panel}=setup({reply:label,commit:async()=> {holder.contextChanged();return {bus:holder.getBus(),revision:1};}});holder=panel;
  panel.elementTags=new AIElementTags({bus:()=>panel.getBus(),selection:()=>'label-customer-ship',onChange:()=>panel.share()});
  panel.elementTags.add('label-customer-ship');expect(panel.scope().mode).toBe('selected');
  await panel.send();expect(panel.checked).toBe(true);
  await panel.apply();
  expect(panel.elementTags.snapshot()).toEqual([]);expect(panel.scope()).toEqual({mode:'whole'});
});
it('keeps element references when the Apply fails',async()=> {
  const label={kind:'proposal',summary:'Label',operations:[{type:'set_field',target:'label-customer-ship',patch:{label:'Deliver to'}}]};
  const {panel}=setup({reply:label,commit:async()=> {throw new Error('commit failed');}});
  panel.elementTags=new AIElementTags({bus:()=>panel.getBus(),selection:()=>'label-customer-ship',onChange:()=>panel.share()});
  panel.elementTags.add('label-customer-ship');
  await panel.send();await panel.apply();
  expect(panel.elementTags.snapshot().map(r=>r.id)).toEqual(['label-customer-ship']);
});
it('offers Edit & resend only on the newest failed request, not on history',async()=> {
  let fail=true;const retries=()=>document.querySelectorAll('[data-ai=retry]').length;
  const {panel}=setup({plan:async()=> { if(fail)throw new Error('boom');return {text:JSON.stringify({kind:'answer',message:'ok'})}; }});
  await panel.send();expect(retries()).toBe(1);
  fail=false;panel.node('#ai-prompt').value='Try again.';panel.share();await panel.send();
  expect(retries()).toBe(0);
});
describe('AI settings menu',()=> {
  const press=key=>document.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
  const opened=()=> {const result=setup();result.panel.show();const menu=result.panel.node('.ai-settings');menu.open=true;return {...result,menu};};
  it('Escape closes the menu first and the panel only on the next press',()=> {
    const {panel,menu}=opened();
    press('Escape');expect(menu.open).toBe(false);expect(panel.open).toBe(true);
    press('Escape');expect(panel.open).toBe(false);
  });
  it('a click outside the menu closes it, a click inside does not',()=> {
    const {menu}=opened();
    menu.querySelector('select').dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(menu.open).toBe(true);
    document.querySelector('#ai-prompt').dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(menu.open).toBe(false);
  });
  it('Clear conversation closes the menu, Discover available models keeps it open',async()=> {
    const {panel,menu}=opened();
    panel.node('[data-ai=models]').click();expect(menu.open).toBe(true);
    await vi.waitFor(()=>expect(panel.busy).toBe(false));
    panel.node('[data-ai=clear]').click();expect(menu.open).toBe(false);
  });
  it('closing the panel does not leave the menu open for the next time',()=> {
    const {panel,menu}=opened();
    panel.close();expect(menu.open).toBe(false);
  });
});
