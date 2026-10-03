import {it,expect} from 'vitest';
import {imageCapability,modelCapabilityFacts} from '../studio-v3/model-capabilities.js';
it('accepts only the verified Responses and multimodal boolean pair',()=>{
 expect(imageCapability({capabilities:{responses:true,multimodal:true}})).toBe(true);
 for(const model of [null,undefined,{},[],{input:['image']},{input_modalities:['text','image']},{supports_images:true},
  {responses:true,multimodal:true},{capabilities:{responses:true}},{capabilities:{multimodal:true}},
  {capabilities:{responses:true,supports_images:true}},{capabilities:{responses:true,vision:true}},
  {capabilities:{responses:true,input_modalities:['image']}},{capabilities:['responses','multimodal']},
  {capabilities:{endpoints:{responses:true,multimodal:true}}}])expect(imageCapability(model)).toBe(false);
 for(const invalid of [false,undefined,null,0,1,'true','false',[],{}]) {
  expect(imageCapability({capabilities:{responses:invalid,multimodal:true}})).toBe(false);
  expect(imageCapability({capabilities:{responses:true,multimodal:invalid}})).toBe(false);
 }
});
it('shows only bounded public boolean/modality facts with their actual keys',()=>{
 const model={id:'demo-fast',account_id:'private',token:'secret',headers:{authorization:'Bearer secret'},endpoint:'https://private.example/account',input_modalities:['text','image','secret'],capabilities:{multimodal:true,streaming:false,account_enabled:true,foo:'secret',endpoints:['responses','https://private.example']}};
 const facts=modelCapabilityFacts(model);expect(facts).toContainEqual({field:'capabilities.multimodal',value:true});expect(facts).toContainEqual({field:'input_modalities',value:['text','image']});expect(facts).toContainEqual({field:'capabilities.endpoints',value:['responses']});
 const text=JSON.stringify(facts);for(const denied of ['private','secret','account','token','headers','https'])expect(text).not.toContain(denied);expect(facts.length).toBeLessThanOrEqual(24);
});
