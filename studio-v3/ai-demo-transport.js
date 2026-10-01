import { createDemoGatewaySession, DEMO_GATEWAY_ENDPOINT } from '../studio-v2/ui/agent-demo-gateway.js';
import { fail, PLANNER_PROMPT } from './ai-edits.js';

export const DEMO_ALIASES = ['demo-fast','demo-auto'];
export function createDemoTransport({fetchImpl = (...args) => fetch(...args),now} = {}) {
  const session = createDemoGatewaySession({now,fetchImpl:async (url,options) => {
    const response = await fetchImpl(url,options);
    if (String(url).endsWith('/demo/session') && response.status === 403) throw fail('DEMO_ORIGIN_NOT_REGISTERED');
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
    clear:() => session.clear(),
    async discover(signal) {
      const payload = await json('models',{method:'GET',signal});
      const aliases = (Array.isArray(payload.data) ? payload.data : []).map(model=>model.id).filter(id=>DEMO_ALIASES.includes(id));
      if (!aliases.length) throw fail('DEMO_MODEL_UNAVAILABLE');
      return aliases;
    },
    async plan(alias, request, signal) {
      if (!DEMO_ALIASES.includes(alias)) throw fail('DEMO_MODEL_UNAVAILABLE');
      // Closed Demo wire contract; local tools and tokens never enter messages.
      const payload = await json('chat/completions',{
        method:'POST',signal,headers:{'content-type':'application/json'},
        body:JSON.stringify({model:alias,stream:false,messages:[{role:'system',content:PLANNER_PROMPT},{role:'user',content:request}]})
      });
      const choice = payload.choices?.[0], message = choice?.message;
      if (choice?.finish_reason !== 'stop' || message?.tool_calls || typeof message?.content !== 'string') throw fail('MALFORMED_PROPOSAL');
      return {text:message.content,usage:payload.usage};
    }
  };
}
