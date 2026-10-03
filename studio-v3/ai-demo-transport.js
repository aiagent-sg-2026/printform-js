import { imageCapability, modelCapabilityFacts } from './model-capabilities.js';
import { createDemoGatewaySession, DEMO_GATEWAY_ENDPOINT } from '../studio-v2/ui/agent-demo-gateway.js';
import { fail } from './ai-edits.js';
import { CHAT_PROMPT } from './ai-chat-protocol.js';

export const DEMO_ALIASES = ['demo-fast','demo-auto'];
const assertDispatch = Symbol('assertDemoDispatch');
export function createDemoTransport({fetchImpl = (...args) => fetch(...args),now} = {}) {
  let imageModels = new Set(), capabilityFacts=[], discoveryGeneration=0;
  const resetCapabilities=()=>{imageModels.clear();capabilityFacts=[];return ++discoveryGeneration;};
  const session = createDemoGatewaySession({now,fetchImpl:async (url,options) => {
    // Recheck after session acquisition/refresh; keep the guard off the wire.
    const {[assertDispatch]:assertCurrent,...init}=options;
    assertCurrent?.();
    const response = await fetchImpl(url,init);
    if (String(url).endsWith('/demo/session') && response.status === 403) throw fail('DEMO_SESSION_FORBIDDEN');
    return response;
  }});
  async function json(path, options) {
    const response = await session.fetch(`${DEMO_GATEWAY_ENDPOINT}/${path}`,options);
    if (!response.ok) throw fail(response.status === 401 ? 'DEMO_SESSION_EXPIRED' : response.status === 429 ? 'DEMO_RATE_LIMIT' : 'DEMO_REQUEST_FAILED');
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let source = '';
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        source += decoder.decode(part.value,{stream:true});
        if (source.length > 64000) throw fail('DEMO_RESPONSE_LIMIT');
      }
      source += decoder.decode(); return JSON.parse(source);
    } catch (error) { if (error.code || error.name === 'AbortError') throw error; throw fail('MALFORMED_PROPOSAL'); }
    finally { await reader.cancel().catch(()=>{}); }
  }
  return {
    clear:() => { resetCapabilities(); session.clear(); },
    // Completed UI actions drop tokens while retaining the latest model facts.
    clearSession:() => session.clear(),
    supportsImages:alias => imageModels.has(alias),
    capabilityDiagnostics:()=>structuredClone(capabilityFacts),
    async discover(signal) {
      const generation=resetCapabilities();
      const payload = await json('models',{method:'GET',signal});
      signal?.throwIfAborted();
      if(generation!==discoveryGeneration)throw fail('DEMO_MODEL_UNAVAILABLE');
      const models = Array.isArray(payload?.data) ? payload.data.filter(model=>DEMO_ALIASES.includes(model?.id)) : [];
      const aliases = [...new Set(models.map(model=>model.id))];
      if (!aliases.length) throw fail('DEMO_MODEL_UNAVAILABLE');
      imageModels = new Set(aliases.filter(alias=>models.filter(model=>model.id===alias).every(imageCapability)));
      capabilityFacts=models.map(model=>({alias:model.id,facts:modelCapabilityFacts(model)}));
      return aliases;
    },
    async plan(alias, request, signal, media = []) {
      if (!DEMO_ALIASES.includes(alias)) throw fail('DEMO_MODEL_UNAVAILABLE');
      if (media.length) {
        if (!imageModels.has(alias)) throw fail('DEMO_IMAGE_CAPABILITY_UNVERIFIED');
        const generation=discoveryGeneration;
        const assertImages=()=>{if(generation!==discoveryGeneration || !imageModels.has(alias))throw fail('DEMO_IMAGE_CAPABILITY_UNVERIFIED');};
        if (media.length > 4 || media.some(part => Object.keys(part).some(key=>!['type','image_url'].includes(key)) || part.type !== 'input_image' || typeof part.image_url !== 'string' || part.image_url.length > 5592508 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(part.image_url)) || JSON.stringify(media).length > 8*1024*1024) throw fail('UNSAFE_PROPOSAL');
        const body=JSON.stringify({model:alias,stream:false,input:[{role:'system',content:[{type:'input_text',text:CHAT_PROMPT}]},{role:'user',content:[{type:'input_text',text:request},...media]}]});
        if(new TextEncoder().encode(body).length>12*1024*1024)throw fail('UNSAFE_PROPOSAL');
        const payload = await json('responses',{method:'POST',signal,headers:{'content-type':'application/json'},body,[assertDispatch]:assertImages});
        if (payload.status !== 'completed' || !Array.isArray(payload.output) || payload.output.some(item=>item.type !== 'message' && item.type !== 'reasoning')) throw fail('MALFORMED_PROPOSAL');
        const content = payload.output.filter(item=>item.type === 'message').flatMap(item=>item.content || []);
        if (!content.length || content.some(part=>part.type !== 'output_text' || typeof part.text !== 'string')) throw fail('MALFORMED_PROPOSAL');
        return {text:content.map(part=>part.text).join(''),usage:{prompt_tokens:payload.usage?.input_tokens,completion_tokens:payload.usage?.output_tokens,total_tokens:payload.usage?.total_tokens}};
      }
      // Closed Demo wire contract; local tools and tokens never enter messages.
      const payload = await json('chat/completions',{
        method:'POST',signal,headers:{'content-type':'application/json'},
        body:JSON.stringify({model:alias,stream:false,messages:[{role:'system',content:CHAT_PROMPT},{role:'user',content:request}]})
      });
      const choice = payload.choices?.[0], message = choice?.message;
      if (choice?.finish_reason !== 'stop' || message?.tool_calls || typeof message?.content !== 'string') throw fail('MALFORMED_PROPOSAL');
      return {text:message.content,usage:payload.usage};
    }
  };
}
