import {it,expect} from 'vitest';
import {imageCapability,modelCapabilityFacts} from '../studio-v3/model-capabilities.js';
it('fails closed for every unverified capability shape',()=>{
 for(const model of [{input:['image']},{input_modalities:['text','image']},{capabilities:{multimodal:true}},{supports_images:true}])expect(imageCapability(model)).toBe(false);
});
it('shows only bounded public boolean/modality facts with their actual keys',()=>{
 const model={id:'demo-fast',account_id:'private',token:'secret',headers:{authorization:'Bearer secret'},endpoint:'https://private.example/account',input_modalities:['text','image','secret'],capabilities:{multimodal:true,streaming:false,account_enabled:true,foo:'secret',endpoints:['responses','https://private.example']}};
 const facts=modelCapabilityFacts(model);expect(facts).toContainEqual({field:'capabilities.multimodal',value:true});expect(facts).toContainEqual({field:'input_modalities',value:['text','image']});expect(facts).toContainEqual({field:'capabilities.endpoints',value:['responses']});
 const text=JSON.stringify(facts);for(const denied of ['private','secret','account','token','headers','https'])expect(text).not.toContain(denied);expect(facts.length).toBeLessThanOrEqual(24);
});
