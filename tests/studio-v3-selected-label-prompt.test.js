import {describe,it,expect} from 'vitest';
import {newProject} from '../studio-v3/model.js';
import {chatRequest,parseChatReply,scopeAuthoringTargets} from '../studio-v3/ai-chat-protocol.js';
import {bindTemplate} from '../studio-v2/core/binding.js';
const request='Only make the Ship to label 12pt bold.';
const project=newProject();
const scope={mode:'selected',id:'label-customer-ship'};
const proposal=target=>JSON.stringify({kind:'proposal',summary:'Make only the selected label 12pt bold',operations:[{type:'set_field',target,patch:{labelStyle:{fontSize:12,bold:true}}}]});
const printed=project=>{
 const template=document.createElement('template');template.innerHTML=project.templateHtml;
 const {fragment,report}=bindTemplate(template,project.sampleData,project.manifest);
 expect(report.errors).toEqual([]);return fragment;
};
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
  const paper=printed(result.candidate),baseline=printed(project),label=paper.querySelector('[data-v3-id="label-customer-ship"]');
  expect(label.style.fontSize).toBe('12pt');expect(label.style.fontWeight).toBe('700');
  const value=paper.querySelector('[data-v3-id="customer-ship"]'),oldValue=baseline.querySelector('[data-v3-id="customer-ship"]');
  expect(value.textContent).toBe(oldValue.textContent);expect(value.getAttribute('style')).toBe(oldValue.getAttribute('style'));
 });
 it('rejects parent, sibling and value mutations under the selected label scope',()=>{
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
