// Verified public Demo Gateway contract: both Responses and multimodal input
// must be explicitly advertised. Other metadata remains diagnostic only.
export function imageCapability(model) {
  const capabilities=model?.capabilities;
  return Boolean(capabilities && typeof capabilities==='object' && !Array.isArray(capabilities)
    && capabilities.responses===true && capabilities.multimodal===true);
}
const containers=new Set(['capabilities','modalities','input','output','endpoints','supported_endpoints','input_modalities','output_modalities','supported_api_variants']);
const factKey=/^(?:supports?_)?(?:images?|vision|multimodal|responses|chat_completions|streaming|structured_output|tools|audio|files|json)$/;
const values=new Set(['text','image','vision','audio','video','json','responses','chat','chat/completions','/responses','/chat/completions']);
export function modelCapabilityFacts(model) {
  const facts=[];
  const visit=(object,path='',depth=0)=>{
    if(!object || typeof object!=='object' || Array.isArray(object) || depth>2)return;
    for(const [key,value] of Object.entries(object)) {
      if(facts.length>=24 || key.length>40 || (!containers.has(key) && !factKey.test(key)))continue;
      const field=path?`${path}.${key}`:key;
      if(typeof value==='boolean')facts.push({field,value});
      else if(typeof value==='string' && values.has(value))facts.push({field,value});
      else if(Array.isArray(value)) {const bounded=value.slice(0,8).filter(v=>typeof v==='string' && values.has(v));if(bounded.length)facts.push({field,value:bounded});}
      else if(containers.has(key))visit(value,field,depth+1);
    }
  };
  visit(model);return facts;
}
