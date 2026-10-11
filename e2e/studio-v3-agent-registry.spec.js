import {test,expect} from './studio-v3-test.js';
test.use({workInSteps:true});
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});

const EDIT=[['get_capabilities'],['read_skill',{id:'form-authoring'}],['get_context'],
  ['apply_operations',{summary:'Navy accents',operations:[{type:'set_style',patch:{color:'#163a65'}}]}],['inspect_draft'],['finish',{summary:'Navy accents'}]];
async function gateway(page,steps=EDIT) {
  await page.addInitScript(steps=> {
    const original=window.fetch.bind(window),json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    const call=(n,name,args={})=>({id:`fc_${n}`,type:'function_call',status:'completed',call_id:`call_${n}`,name,arguments:JSON.stringify(args)});
    const script=steps.map(([name,args],index)=>()=>call(index+1,name,args));
    let turn=0;window.__registryWire=[];
    window.fetch=async(input,init)=> {
      const url=new URL(typeof input==='string' ? input : input.url,location.href);
      if(url.origin!=='https://gpt.yapweijun1996.com')return original(input,init);
      if(url.pathname==='/demo/session')return json({token:'dmo_synthetic123456',expires_in:900},201);
      if(url.pathname.endsWith('/models'))return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]});
      const body=JSON.parse(init.body);window.__registryWire.push(body);
      const output=[script[turn++]()];
      if (!body.stream) return json({status:'completed',output,usage:{input_tokens:10,output_tokens:2,total_tokens:12}});
      return new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response:{status:'completed',output,usage:{input_tokens:10,output_tokens:2,total_tokens:12}}})}\n\n`,{headers:{'content-type':'text/event-stream'}});
    };
  },steps);
}
async function open(page) {await page.goto('/studio-v3/');await ready(page);await page.locator('[data-ai-toggle]').click();}
async function send(page) {await page.locator('#ai-prompt').fill('Use navy accents #163a65.');await page.locator('[data-ai-send]').click();}

test('discovers the shipped registry and guide, inspects, then preserves Preview/Apply/Undo',async({page})=> {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await gateway(page);await open(page);await send(page);
  await expect(page.locator('[data-ai-proposal]')).toBeVisible();await expect(page.locator('#revision')).toHaveText('r0');
  const bodies=await page.evaluate(()=>window.__registryWire);expect(bodies).toHaveLength(6);
  const results=bodies.flatMap(b=>b.input).filter(i=>i.type==='function_call_output').flatMap(i=>{try{return [JSON.parse(i.output)];}catch{return [];}}).filter(v=>v.tools || v.id==='form-authoring' || v.authoring);
  const catalog=results.find(v=>v.tools),guide=results.find(v=>v.id==='form-authoring'),context=results.find(v=>v.authoring);
  expect(catalog.tools).toHaveLength(10);expect(catalog.operations).toHaveLength(13);expect(catalog.identity.verified).toBe(true);
  expect(catalog.run.profile).toBe('design');expect(catalog.tools.map(t=>t.name)).toContain('finish_answer');
  expect(guide.identity).toEqual(catalog.identity);expect(guide.content).toContain('rowBackground');
  expect(context.run).toMatchObject({mode:'steps',maxToolCalls:1000,identity:catalog.identity});expect(context.run.maxModelRequests).toBeUndefined();
  const schema=bodies[0].tools.find(t=>t.name==='apply_operations').parameters;
  expect(schema.properties.operations.items.anyOf).toHaveLength(13);expect(schema.additionalProperties).toBe(false);
  await page.locator('[data-ai=apply]').click();await expect(page.locator('#revision')).toHaveText(/^r1\b/);
  await page.locator('[data-ai=undo]').click();await expect(page.locator('#revision')).toHaveText(/^r2\b/);expect(errors).toEqual([]);
});

test('answers a question in steps under a read-only grant with no proposal and no revision change',async({page})=> {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await gateway(page,[['get_capabilities'],['read_skill',{id:'form-authoring'}],['finish_answer',{message:'The footer holds the notes and the signature.'}]]);
  await open(page);
  await page.locator('#ai-prompt').fill('What is in the footer?');await page.locator('[data-ai-send]').click();
  await expect(page.locator('.ai-message').filter({hasText:'The footer holds the notes and the signature.'})).toBeVisible();
  await expect(page.locator('[data-ai-status]')).toContainText('Read-only answer; form unchanged.');
  await expect(page.locator('[data-ai-proposal]')).toHaveCount(0);await expect(page.locator('#revision')).toHaveText('r0');
  const bodies=await page.evaluate(()=>window.__registryWire);expect(bodies).toHaveLength(3);
  const shown=bodies[0].tools.map(t=>t.name);
  expect(shown).toEqual(expect.arrayContaining(['get_capabilities','read_skill','get_context','inspect_draft','finish_answer']));
  for(const name of ['apply_operations','undo_step','finish'])expect(shown).not.toContain(name);
  const catalog=bodies.flatMap(b=>b.input).filter(i=>i.type==='function_call_output').map(i=>{try{return JSON.parse(i.output);}catch{return null;}}).find(v=>v?.tools);
  expect(catalog.run.profile).toBe('read-only');expect(catalog.tools.map(t=>t.name)).not.toContain('apply_operations');expect(errors).toEqual([]);
});

test('rejects a mixed-release manifest before sending model content',async({page})=> {
  await gateway(page);
  await page.route('**/agent/agent-manifest.json',async route=> {
    const response=await route.fetch(),body=await response.json();body.knowledgeHash='0'.repeat(64);
    await route.fulfill({response,json:body});
  });
  await open(page);await send(page);
  await expect(page.locator('[data-ai-log]')).toContainText('belong to different versions');
  expect(await page.evaluate(()=>window.__registryWire)).toHaveLength(0);await expect(page.locator('#revision')).toHaveText('r0');
});
