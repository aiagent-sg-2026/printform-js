import {beforeEach,it,expect} from 'vitest';
import fs from 'node:fs';
import {AIPanel} from '../studio-v3/ai-panel.js';
import {PaperPreview} from '../studio-v3/preview.js';
import {newProject} from '../studio-v3/model.js';
import {createBus,editProject,designOperations} from '../studio-v3/controller.js';
const html=fs.readFileSync('studio-v3/index.html','utf8');
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});
function setup({facts=()=>[],commit,plan,reply={kind:'proposal',summary:'Navy',edits:[{target:'style',property:'color',value:'#163a65'}]}}={}) {
  let bus=createBus(newProject()),calls=0,selected='items';
  const panel=new AIPanel({bus:()=>bus,selection:()=>selected,facts,guard:work=>work(),preview:async()=>({status:'ready',validation:{errors:[],warnings:[]}}),restore:async()=>{},commit,sync:()=>{},transport:{clear:()=>{},discover:async()=>['demo-fast'],plan:async(...args)=> {calls++;return plan ? plan(...args) : {text:JSON.stringify(reply)};}}});
  panel.contextChanged();panel.node('#ai-prompt').value='Use navy accents.';panel.share();panel.node('#ai-consent').checked=true;
  return {panel,calls:()=>calls,changeBus:()=> {bus=createBus(newProject());panel.contextChanged();return bus;},select:id=> {selected=id;panel.contextChanged();}};
}
it('requires renewed review if measured facts change after consent, before any gateway call',async()=> {
  let facts=[];const {panel,calls}=setup({facts:()=>facts});
  facts=[{id:'header',role:'title',pt:18}];await panel.send();expect(calls()).toBe(0);expect(panel.node('#ai-consent').checked).toBe(false);expect(panel.node('#ai-share').textContent).toContain('18');expect(panel.node('[data-ai-status]').textContent).toContain('updated');
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
  let release,started,panel;const held=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const result=setup({commit:async(proposal,generation)=> {started();await held;panel.assertCurrent(proposal,generation);throw new Error('must not reach commit');}});panel=result.panel;
  await panel.send();await panel.preview();const running=panel.apply();await ready;result.select('customer');release();await running;
  expect(panel.getBus().revision).toBe(0);expect(panel.proposal).toBeNull();expect(panel.node('[data-ai-status]').textContent).toContain('Nothing changed');
});
