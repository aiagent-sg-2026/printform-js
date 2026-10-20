import { test, expect } from './studio-v3-test.js';
// The gateway is replaced inside the page by a fetch that streams server-sent events with real
// delays, so the browser's own stream, decoder and timers are exercised. Nothing leaves the machine.

const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const proposal = {summary:'Use navy and compact spacing with page margins',operations:[{type:'set_style',patch:{color:'#163a65',padding:5}},{type:'set_page',patch:{margins:{top:12}}}]};
async function streamingGateway(page) {
  await page.addInitScript(text=> {
    const original=window.fetch.bind(window),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),encoder=new TextEncoder();
    const frame=(name,data)=>`event: ${name}\ndata: ${JSON.stringify({type:name,...data})}\n\n`;
    const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    window.__wire=[];
    // A test may hold each phase until it releases it (window.__hold); otherwise phases last 1.5 s.
    const gate=name=>window.__hold ? new Promise(resolve=>{(window.__gates??={})[name]=resolve;}) : sleep(1500);
    window.fetch=async(input,init)=> {
      const url=new URL(typeof input==='string' ? input : input.url,location.href);
      if(url.origin!=='https://gpt.yapweijun1996.com')return original(input,init);
      if(url.pathname==='/demo/session')return json({token:'dmo_synthetic123456',expires_in:900},201);
      if(url.pathname.endsWith('/models'))return json({data:[{id:'demo-auto',capabilities:{responses:true,multimodal:true}}]});
      window.__wire.push(JSON.parse(init.body));
      const half=Math.floor(text.length/2);
      return new Response(new ReadableStream({async start(controller) {
        const send=value=>controller.enqueue(encoder.encode(value));
        send(frame('response.created',{response:{status:'in_progress',output:[]}}));
        await gate('first');send(frame('response.output_text.delta',{delta:text.slice(0,half)}));
        await gate('second');send(frame('response.output_text.delta',{delta:text.slice(half)})+frame('response.completed',{response:{status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}],usage:{input_tokens:3,output_tokens:4,total_tokens:7}}}));
        controller.close();
      }}),{status:200,headers:{'content-type':'text/event-stream'}});
    };
  },JSON.stringify(proposal));
}
async function ask(page) {
  await page.goto('/studio-v3/');await ready(page);
  await page.locator('[data-ai-toggle]').click();await page.locator('#ai-prompt').fill('Use navy #163a65 and padding 5 px.');await page.locator('[data-ai-send]').click();
}
test('a streamed answer shows silent progress, then the usual reviewable proposal',async({page})=> {
  await page.addInitScript(()=>{window.__hold=true;});   // each phase lasts until released, however slow the machine is
  await streamingGateway(page);await ask(page);
  const status=page.locator('[data-ai-status]');
  await expect(status).toContainText('Waiting for the AI service');await expect(status).toHaveAttribute('aria-live','off');
  await page.waitForFunction(()=>window.__gates?.first);await page.evaluate(()=>window.__gates.first());
  await expect(status).toContainText('Receiving response');await expect(status).toContainText('characters');await expect(status).toHaveAttribute('aria-live','off');
  await page.waitForFunction(()=>window.__gates?.second);await page.evaluate(()=>window.__gates.second());
  await expect(page.locator('[data-ai-proposal]')).toBeVisible();await expect(status).toHaveAttribute('aria-live','polite');
  await expect(status).toContainText('Tokens: 7');await expect(page.locator('#revision')).toHaveText('r0');
  const wire=await page.evaluate(()=>window.__wire);
  expect(wire).toHaveLength(1);expect(wire[0].stream).toBe(true);expect(wire[0].model).toBe('demo-auto');expect(Object.keys(wire[0]).sort()).toEqual(['input','model','stream']);
});
test('Stop during a stream cancels cleanly and leaves the form unchanged',async({page})=> {
  await page.addInitScript(()=>{window.__hold=true;});
  await streamingGateway(page);await ask(page);
  await page.waitForFunction(()=>window.__gates?.first);await page.evaluate(()=>window.__gates.first());
  await expect(page.locator('[data-ai-status]')).toContainText('Receiving response');
  await page.waitForFunction(()=>window.__gates?.second);
  const stop=page.locator('[data-ai=cancel]');
  await stop.focus();await stop.press('Space');
  await expect(page.locator('.ai-assistant .ai-message-text').last()).toContainText('Cancelled');
  await expect(page.locator('[data-ai-proposal]')).toHaveCount(0);await expect(page.locator('#revision')).toHaveText('r0');
  await page.evaluate(()=>window.__gates.second());
  await page.waitForTimeout(2500);
  await expect(page.locator('[data-ai-proposal]')).toHaveCount(0);await expect(page.locator('[data-ai-send]')).toBeVisible();await expect(page.locator('#revision')).toHaveText('r0');
});
