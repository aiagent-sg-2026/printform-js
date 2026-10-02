import {describe,it,expect} from 'vitest';
import {newProject} from '../studio-v3/model.js';
import {chatRequest,CHAT_PROMPT,parseChatReply,scopeAuthoringTargets} from '../studio-v3/ai-chat-protocol.js';
const request='Only make the Ship to label 12pt bold.';
const project=newProject();
const scope={mode:'selected',id:'label-customer-ship'};
const proposal=target=>JSON.stringify({kind:'proposal',summary:'Make only the selected label 12pt bold',operations:[{type:'set_field',target,patch:{labelStyle:{fontSize:12,bold:true}}}]});
describe('plain-language selected label authoring contract',()=>{
 it('supplies the exact label operation from selection, without requiring an ID in the user request',()=>{
  expect(request).not.toContain('label-customer-ship');
  const context=JSON.parse(chatRequest(project,{request,scope,typography:[],conversation:[]}));
  const target=context.scopeAuthoringTargets[0];
  expect(target).toMatchObject({target:'label-customer-ship',operation:'set_field',typographyPatchKey:'labelStyle',allowedPatchKeys:['label','showLabel','labelStyle']});
  const result=parseChatReply(proposal(target.target),project,{request,scope});
  expect(result.design.customer.find(field=>field.id==='ship').labelStyle).toEqual({fontSize:12,bold:true});
  expect(result.design.customer.find(field=>field.id==='ship').valueStyle).toBeUndefined();
  expect(result.candidate.sampleData).toEqual(project.sampleData);
  expect(result.diff).toHaveLength(1);expect(result.diff[0].target).toBe('label-customer-ship');
 });
 it('corrects the system example and still rejects parent, sibling and value mutations',()=>{
  expect(CHAT_PROMPT).toContain('"target":"label-customer-ship"');expect(CHAT_PROMPT).not.toContain('set_field customer-ship patch labelStyle');
  for(const target of ['customer-ship','label-customer-bill','label-customer-ship-address'])expect(()=>parseChatReply(proposal(target),project,{request,scope})).toThrow('UNSAFE_SCOPE');
  const valueChange=JSON.stringify({kind:'proposal',summary:'Incorrect value change',operations:[{type:'set_field',target:scope.id,patch:{valueStyle:{fontSize:12}}}]});
  expect(()=>parseChatReply(valueChange,project,{request,scope})).toThrow('UNSAFE_PROPOSAL');
 });
 it('uses explicit reference scopes rather than an unrelated current selection',()=>{
  const targets=scopeAuthoringTargets(project,{mode:'selected',id:'items',ids:['label-customer-ship','label-footer-notes']});
  expect(targets.map(target=>target.target)).toEqual(['label-customer-ship','label-footer-notes']);expect(JSON.stringify(targets)).not.toContain('Sterling');
  expect(scopeAuthoringTargets(project,{mode:'selected',id:'customer-ship'})[0].labelTarget).toBe('label-customer-ship');
  expect(scopeAuthoringTargets(project,{mode:'whole'})).toEqual([]);
 });
});
