import {beforeEach,it,expect,vi} from 'vitest';
import fs from 'node:fs';
import {AIPanel} from '../studio-v3/ai-panel.js';
import {PaperPreview} from '../studio-v3/preview.js';
import {newProject} from '../studio-v3/model.js';
import {createBus,editProject,designOperations} from '../studio-v3/controller.js';
const html=fs.readFileSync('studio-v3/index.html','utf8');
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});
function setup({facts=()=>[],commit,plan,restore=async()=>{},reply={kind:'proposal',summary:'Navy',edits:[{target:'style',property:'color',value:'#163a65'}]}}={}) {
  let bus=createBus(newProject()),calls=0,selected='items';
  const panel=new AIPanel({bus:()=>bus,selection:()=>selected,facts,guard:work=>work(),preview:async()=>({status:'ready',validation:{errors:[],warnings:[]}}),restore,commit,sync:()=>{},transport:{clear:()=>{},discover:async()=>['demo-fast'],plan:async(...args)=> {calls++;return plan ? plan(...args) : {text:JSON.stringify(reply)};}}});
  panel.contextChanged();panel.node('#ai-prompt').value='Use navy accents.';panel.share();
  return {panel,calls:()=>calls,changeBus:()=> {bus=createBus(newProject());panel.contextChanged();return bus;},select:id=> {selected=id;panel.contextChanged();}};
}
it('requires renewed review if measured facts change after consent, before any gateway call',async()=> {
  let facts=[];const {panel,calls}=setup({facts:()=>facts});
  facts=[{id:'header',role:'title',pt:18}];await panel.send();expect(calls()).toBe(0);expect(panel.node('#ai-consent')).toBeNull();expect(panel.node('#ai-share').textContent).toContain('18');expect(panel.node('[data-ai-status]').textContent).toContain('updated');
});
it('expires a response/card after selection moves away and back, preserving canonical revision',async()=> {
  const {panel,select}=setup();await panel.send();const bus=panel.getBus();expect(panel.proposal).toBeTruthy();select('customer');select('items');expect(panel.proposal).toBeNull();expect(bus.revision).toBe(0);expect(panel.conversation.messages.at(-1).status).toBe('expired');
});
it('keeps a completed edit attached to its captured bus when navigation replaces the document during render',async()=> {
  let release,started;const held=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const {panel,changeBus}=setup({commit:async proposal=> {await editProject(proposal.bus,designOperations(proposal.bus.project,proposal.design),'AI');const result={bus:proposal.bus,revision:proposal.bus.revision};started();await held;return result;}});
  await panel.send();await panel.preview();const oldBus=panel.getBus(),running=panel.apply();await ready;const current=changeBus();release();await running;
  const card=panel.conversation.messages.find(m=>m.diff);expect(card.status).toBe('applied');expect(card.appliedBus).toBe(oldBus);expect(card.appliedRevision).toBe(1);expect(current.revision).toBe(0);expect(panel.canUndo(card)).toBe(false);expect(panel.node('[data-ai-status]').textContent).toContain('previous form');
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
  await panel.discard();expect(panel.viewing).toBe(true);expect(panel.node('[data-ai-status]').textContent).toContain('before printing');expect(panel.getBus().revision).toBe(0);
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
