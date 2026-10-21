import {test,expect} from './studio-v3-test.js';
test.use({workInSteps:true});
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});

const EDIT=[['get_capabilities'],['read_skill',{id:'form-authoring'}],['get_context'],
  ['apply_operations',{summary:'Navy accents and Tax Invoice heading',operations:[{type:'set_style',patch:{color:'#163a65'}},{type:'set_heading',value:'Tax Invoice'}]}],['inspect_draft'],['finish',{summary:'Navy accents and Tax Invoice heading'}]];
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

test('discovers the shipped registry and guide, inspects, then automatically applies heading edits with Undo',async({page})=> {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await gateway(page);await open(page);
  const accent=()=>page.frameLocator('#preview-frame').locator('.v3-header').first().evaluate(node=>getComputedStyle(node).borderBottomColor),before=await accent();
  const heading=()=>page.frameLocator('#preview-frame').locator('[data-v3-id=header-title]').first(),originalHeading=await heading().textContent();
  await send(page);
  await expect(page.locator('.ai-change-card')).toContainText('Applied to draft');await ready(page);await expect(page.locator('#revision')).toHaveText(/^r1\b/);expect(await accent()).toBe('rgb(22, 58, 101)');
  await expect(heading()).toHaveText('Tax Invoice');
  await page.locator('[data-ai=undo]').click();await ready(page);await expect(page.locator('#revision')).toHaveText(/^r2\b/);expect(await accent()).toBe(before);expect(errors).toEqual([]);
  await expect(heading()).toHaveText(originalHeading);
});

test('inspected page setup preserves manual Preview/Apply/Undo',async({page})=> {
  await gateway(page,[['get_context'],['apply_operations',{summary:'Page margins',operations:[{type:'set_page',patch:{margins:{top:12}}}]}],['inspect_draft'],['finish',{summary:'Page margins'}]]);
  await open(page);
  const margin=()=>page.frameLocator('#preview-frame').locator('.physical_page_wrapper').first().evaluate(node=>node.querySelector('.printform_page').getBoundingClientRect().top-node.getBoundingClientRect().top),before=await margin();
  await send(page);
  await expect(page.locator('[data-ai-proposal]')).toBeVisible();await expect(page.locator('#revision')).toHaveText('r0');
  await page.locator('[data-ai=preview]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await page.locator('[data-ai=apply]').click();await ready(page);await expect(page.locator('#revision')).toHaveText(/^r1\b/);
  expect(await margin()).toBeCloseTo(12,0);
  await page.locator('[data-ai=undo]').click();await ready(page);await expect(page.locator('#revision')).toHaveText(/^r2\b/);
  expect(await margin()).toBeCloseTo(before,0);
});

test('answers a question in steps under a design grant with no proposal and no revision change',async({page})=> {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await gateway(page,[['get_capabilities'],['read_skill',{id:'form-authoring'}],['finish_answer',{message:'The footer holds the notes and the signature.'}]]);
  await open(page);
  await page.locator('#ai-prompt').fill('What is in the footer?');await page.locator('[data-ai-send]').click();
  await expect(page.locator('.ai-assistant[data-state=answer]')).toBeVisible();
  await expect(page.locator('[data-ai-proposal]')).toHaveCount(0);await expect(page.locator('#revision')).toHaveText('r0');
  const bodies=await page.evaluate(()=>window.__registryWire);expect(bodies).toHaveLength(3);
  const shown=bodies[0].tools.map(t=>t.name);
  expect(shown).toEqual(expect.arrayContaining(['get_capabilities','read_skill','get_context','inspect_draft','finish_answer']));
  expect(shown).toEqual(expect.arrayContaining(['apply_operations','undo_step','finish']));
  const catalog=bodies.flatMap(b=>b.input).filter(i=>i.type==='function_call_output').map(i=>{try{return JSON.parse(i.output);}catch{return null;}}).find(v=>v?.tools);
  expect(catalog.run.profile).toBe('design');expect(catalog.tools.map(t=>t.name)).toContain('apply_operations');expect(errors).toEqual([]);
});

test('rejects a mixed-release manifest before sending model content',async({page})=> {
  await gateway(page);
  await page.route('**/agent/agent-manifest.json',async route=> {
    const response=await route.fetch(),body=await response.json();body.knowledgeHash='0'.repeat(64);
    await route.fulfill({response,json:body});
  });
  await open(page);await send(page);
  await expect(page.locator('.ai-assistant[data-state=error]')).toBeVisible();
  expect(await page.evaluate(()=>window.__registryWire)).toHaveLength(0);await expect(page.locator('#revision')).toHaveText('r0');
});
