import { test, expect } from './studio-v3-test.js';
import { syntheticPng } from './fixtures/reference-documents.js';
// The Demo gateway is replaced inside the page by a fetch that answers with tool-call turns (server-sent events), so
// the browser's own stream, timers and print preview are exercised. Nothing leaves the machine; the data is fictional.

test.use({workInSteps:true});
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function gateway(page,mode = 'run') {
  await page.addInitScript(({mode,single})=> {
    const original = window.fetch.bind(window);
    const frame = (type,data)=>`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`;
    const json = (body,status = 200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    const sse = output=>new Response(frame('response.created',{response:{status:'in_progress',output:[]}})+frame('response.completed',{response:{status:'completed',output,usage:{input_tokens:10,output_tokens:2,total_tokens:12}}}),{status:200,headers:{'content-type':'text/event-stream'}});
    const reasoning = n=>({id:`rs_${n}`,type:'reasoning',content:[],encrypted_content:`enc-${n}`,summary:[]});
    const call = (n,name,args)=>({id:`fc_${n}`,type:'function_call',status:'completed',call_id:`call_${n}`,name,arguments:JSON.stringify(args)});
    const navy = {summary:'Navy accents',operations:[{type:'set_style',patch:{color:'#163a65'}}]};
    const script = mode === 'images'
      ? [()=>call(1,'get_context',{}),()=>call(2,'take_notes',{notes:'Two columns; total bottom right.'}),()=>call(3,'get_context',{}),()=>call(4,'get_context',{}),()=>call(5,'apply_operations',navy),()=>call(6,'inspect_draft',{}),()=>call(7,'finish',{summary:'Navy accents'})]
      : [()=>call(1,'get_context',{}),()=>call(2,'apply_operations',navy),()=>call(3,'inspect_draft',{}),()=>call(4,'finish',{summary:'Navy accents'})];
    let turns = 0; window.__wire = [];
    window.fetch = async (input,init)=> {
      const url = new URL(typeof input === 'string' ? input : input.url,location.href);
      if (url.origin !== 'https://gpt.yapweijun1996.com') return original(input,init);
      if (url.pathname === '/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:true}}]});
      const body = JSON.parse(init.body); window.__wire.push(body);
      if (body.tools) {
        if (mode === 'off') return json({error:{code:'DEMO_AGENT_TOOLS_DISABLED',message:'agent tools are disabled'}},400);
        const n = turns++;
        if (n === 2 && window.__hold) await new Promise(resolve=>{ window.__release = resolve; }); // hold before the inspection
        return sse([reasoning(n + 1),script[n]()]);
      }
      return sse([{type:'message',content:[{type:'output_text',text:single}]}]);
    };
  },{mode,single:JSON.stringify({summary:'Navy',edits:[{target:'style',property:'color',value:'#163a65'}]})});
}
async function open(page) { await page.goto('/studio-v3/'); await ready(page); await page.locator('[data-ai-toggle]').click(); }
const send = async(page,text = 'Use navy accents #163a65.')=> { await page.locator('#ai-prompt').fill(text); await page.locator('[data-ai-send]').click(); };
const wire = page=>page.evaluate(()=>window.__wire);

test('works in steps: a visible timeline, one reviewable proposal, then Apply and Undo',async({page},info)=> {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=> { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(()=>{ window.__hold = true; }); await gateway(page); await open(page); await send(page);
  const steps = page.locator('[data-ai-log] .ai-steps li');
  await expect(steps.first()).toContainText('Looked at the form'); await expect(steps.nth(1)).toContainText('Made changes · 1 change');
  await expect(page.locator('[data-ai=cancel]')).toBeVisible(); await expect(page.locator('#revision')).toHaveText('r0');
  await page.screenshot({path:info.outputPath('agent-steps-running.png')});
  await page.waitForFunction(()=>window.__release); await page.evaluate(()=>window.__release());
  await expect(page.locator('[data-ai-proposal]')).toBeVisible(); await expect(page.locator('[data-ai-status]')).toContainText('4 steps');
  await expect(page.locator('#revision')).toHaveText('r0');
  await expect(page.locator('[data-ai=apply]')).toBeEnabled(); await page.locator('[data-ai=apply]').click();
  await expect(page.locator('#revision')).toContainText('r1');
  await expect(page.locator('[data-ai-log]')).toContainText('Applied to the form');
  await page.locator('[data-ai=undo]').click(); await expect(page.locator('#revision')).toContainText('r2'); await expect(page.locator('[data-ai=undo]')).toHaveCount(0); // undo is a revision of its own
  const sent = await wire(page);
  expect(sent.every(body=>body.store === undefined && body.previous_response_id === undefined)).toBe(true);
  expect(sent[1].input.map(item=>item.type || item.role)).toEqual(['system','user','reasoning','function_call','function_call_output']);
  expect(errors).toEqual([]);
});

test('falls back to one step when the gateway does not allow tools, and does not ask again',async({page})=> {
  await gateway(page,'off'); await open(page); await send(page);
  await expect(page.locator('[data-ai-proposal]')).toBeVisible();
  await expect(page.locator('#revision')).toHaveText('r0');
  await send(page); await expect.poll(async()=>(await wire(page)).length,{timeout:15000}).toBe(3);
  const sent = await wire(page);
  expect(sent.filter(body=>body.tools)).toHaveLength(1); expect(sent.filter(body=>!body.tools)).toHaveLength(2);
});

test('the work-in-steps setting turns it off and is remembered',async({page})=> {
  await gateway(page); await open(page);
  await page.locator('.ai-settings > summary').click(); await page.locator('#ai-agent').uncheck();
  await page.locator('.ai-settings > summary').click(); await send(page);
  await expect(page.locator('[data-ai-proposal]')).toBeVisible();
  expect((await wire(page)).some(body=>body.tools)).toBe(false);
  await page.reload(); await ready(page); await page.locator('[data-ai-toggle]').click();
  await page.locator('.ai-settings > summary').click(); await expect(page.locator('#ai-agent')).not.toBeChecked();
});

test('works in steps on a reference image: it is sent on the first turns only, and the notes carry on',async({page})=> {
  await gateway(page,'images'); await open(page);
  await page.locator('[data-ai=attach]').click();
  await page.getByLabel('Add reference PDF or image',{exact:true}).setInputFiles(syntheticPng());
  await expect(page.locator('.ai-reference-card')).toHaveCount(1,{timeout:30000});
  await expect(page.locator('.ai-reference-files')).toContainText('Images available');
  await send(page,'Use navy accents #163a65, following the reference.');
  await expect(page.locator('[data-ai-proposal]')).toBeVisible({timeout:30000});
  const sent = (await wire(page)).filter(body=>body.tools);
  expect(sent.map(body=>JSON.stringify(body.input).includes('data:image/'))).toEqual([true,true,true,true,false,false,false]);
  expect(sent.map(body=>body.stream)).toEqual([false,false,false,false,true,true,true]);
  expect(JSON.stringify(sent.at(-1).input)).toContain('Two columns; total bottom right.'); expect(JSON.stringify(sent.at(-1).input)).toContain('no longer attached');
  await expect(page.locator('#revision')).toHaveText('r0');
});
