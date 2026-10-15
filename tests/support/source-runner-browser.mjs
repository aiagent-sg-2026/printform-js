import http from 'node:http';
import { randomUUID } from 'node:crypto';

// Real local-origin browser protocol coverage, not a published-origin or AI pilot.
// Positive requests never set Origin or Sec-Fetch-*; the browser owns them.
export async function sourceRunnerBrowser(browser) {
  const server = http.createServer((_request,response)=> {
    response.setHeader('Content-Type','text/html; charset=utf-8');
    response.setHeader('Content-Security-Policy',"default-src 'none'; connect-src http://127.0.0.1:*");
    response.end('<!doctype html><title>Fictional source protocol fixture</title><p>Local source protocol fixture. No business data or model requests.</p>');
  });
  await new Promise((resolve,reject)=> { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let context;
  try {
    context = await browser.newContext();
    const page = await context.newPage(); await page.goto(origin);
    return {
      origin,
      async pair(url) {
        const pairing = await context.newPage();
        try {
          const response = await pairing.goto(`${url}/pair`); if (response.status() !== 200) throw new Error(`Human navigation rejected: ${response.status()}`);
          const code = (await pairing.locator('#pair-code').textContent()).trim();
          const result = await page.evaluate(async({url,code})=> {
            const response = await fetch(`${url}/v1/pair`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code}),credentials:'omit'});
            if (!response.ok) throw new Error(`Pair rejected: ${response.status}`);
            return response.json();
          },{url,code});
          return result;
        } finally { await pairing.close(); }
      },
      async request(url,token,path,body,{intent = randomUUID(),headers = {}} = {}) {
        if (Object.keys(headers).length) {
          // Explicit hostile-header protocol probes only; never used as live-browser proof.
          const response = await fetch(`${url}${path}`,{method:body === undefined ? 'GET' : 'POST',
            headers:{origin,authorization:`Bearer ${token}`,'content-type':'application/json','x-pf-intent':intent,...headers},
            ...(body === undefined ? {} : {body:JSON.stringify(body)})});
          return {status:response.status,body:await response.json()};
        }
        return page.evaluate(async({url,path,body,token,intent})=> {
          const response = await fetch(`${url}${path}`,{method:body === undefined ? 'GET' : 'POST',
            headers:{authorization:`Bearer ${token}`,'content-type':'application/json','x-pf-intent':intent},
            ...(body === undefined ? {} : {body:JSON.stringify(body)}),credentials:'omit'});
          return {status:response.status,body:await response.json()};
        },{url,path,body,token,intent});
      },
      async close() { try { await context.close(); } finally { await new Promise((resolve,reject)=>server.close(error=>error ? reject(error) : resolve())); } }
    };
  } catch (error) {
    await context?.close(); await new Promise(resolve=>server.close(resolve)); throw error;
  }
}
