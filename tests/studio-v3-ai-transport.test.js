import { describe,it,expect } from 'vitest';
import { createDemoTransport } from '../studio-v3/ai-demo-transport.js';
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const models = {data:[{id:'demo-auto'},{id:'demo-fast'},{id:'private-model'}]};
const reply = {choices:[{finish_reason:'stop',message:{content:'{}'}}]};
describe('v3 Demo wire contract',()=> {
  it('uses existing registration, discovers aliases and sends no native tools/private credentials',async()=> {
    const calls = []; const transport = createDemoTransport({fetchImpl:async(url,init)=> {
      calls.push({url,init}); return url.endsWith('/session') ? json({token:'dmo_synthetic1234',expires_in:900},201) : url.endsWith('/models') ? json(models) : json(reply);
    }});
    expect(await transport.discover()).toEqual(['demo-auto','demo-fast']); await transport.plan('demo-fast','fictional layout');
    expect(JSON.parse(calls[0].init.body)).toEqual({project_id:'github-pages'}); expect(calls[0].init.headers.authorization).toBeUndefined();
    expect(calls[2].url).toBe('https://gpt.yapweijun1996.com/demo/v1/chat/completions');
    const payload = JSON.parse(calls[2].init.body); expect(Object.keys(payload).sort()).toEqual(['messages','model','stream']);
    expect(payload.model).toBe('demo-fast'); expect(JSON.stringify(payload)).not.toContain('dmo_');
    expect(new Headers(calls[2].init.headers).get('authorization')).toBe('Bearer dmo_synthetic1234');
    expect(new Headers(calls[0].init.headers).has('origin')).toBe(false);
  });
  it('refreshes once after 401 and proactively after expiry; clear releases memory state',async()=> {
    let now = 0,sessions = 0, requests = 0;
    const transport = createDemoTransport({now:()=>now,fetchImpl:async(url)=> {
      if (url.endsWith('/session')) return json({token:`dmo_synthetic${++sessions}`,expires_in:60});
      return ++requests === 1 ? json({},401) : json(models);
    }});
    await transport.discover(); expect(sessions).toBe(2);
    now = 31000; await transport.discover(); expect(sessions).toBe(3);
    transport.clear(); await transport.discover(); expect(sessions).toBe(4);
  });
  it('fails closed for unregistered origin and repeated unauthorized token',async()=> {
    const denied = createDemoTransport({fetchImpl:async()=>json({},403)});
    await expect(denied.discover()).rejects.toThrow('DEMO_ORIGIN_NOT_REGISTERED');
    let sessions = 0;
    const expired = createDemoTransport({fetchImpl:async url=>url.endsWith('/session') ? (sessions++,json({token:'dmo_synthetic123',expires_in:60})) : json({},401)});
    await expect(expired.discover()).rejects.toThrow('DEMO_SESSION_EXPIRED'); expect(sessions).toBe(2);
  });
  it('reports a rejected session during a 401 refresh without claiming the inference request was never sent',async()=> {
    let issued = 0,dispatched = 0;
    const transport = createDemoTransport({fetchImpl:async url=> {
      if (url.endsWith('/session')) return ++issued === 1 ? json({token:'dmo_synthetic123'}) : json({},403);
      dispatched++; return json({},401);
    }});
    await expect(transport.plan('demo-fast','fictional')).rejects.toThrow('DEMO_ORIGIN_NOT_REGISTERED');
    expect(dispatched).toBe(1);
  });
  it.each([429,500])('sanitizes HTTP %i error bodies',async status=> {
    const transport = createDemoTransport({fetchImpl:async url=>url.endsWith('/session') ? json({token:'dmo_synthetic123'}) : json({secret:'must never display'},status)});
    await expect(transport.discover()).rejects.toThrow(status===429?'DEMO_RATE_LIMIT':'DEMO_REQUEST_FAILED');
  });
  it('rejects absent aliases, native tool responses, truncation and oversized responses',async()=> {
    for (const bad of [{choices:[{finish_reason:'length',message:{content:'{}'}}]},{choices:[{finish_reason:'stop',message:{content:'{}',tool_calls:[]}}]},{padding:'x'.repeat(65000)}]) {
      const transport = createDemoTransport({fetchImpl:async url=>url.endsWith('/session') ? json({token:'dmo_synthetic123'}) : json(bad)});
      await expect(transport.plan('demo-fast','fake')).rejects.toThrow();
    }
    const missing = createDemoTransport({fetchImpl:async url=>url.endsWith('/session') ? json({token:'dmo_synthetic123'}) : json({data:[{id:'private'}]})});
    await expect(missing.discover()).rejects.toThrow('DEMO_MODEL_UNAVAILABLE');
  });
});
