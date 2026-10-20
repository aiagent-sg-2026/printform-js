import {test,expect} from './studio-v3-test.js';
import {expectApplied} from './ai-applied.js';

test.use({workInSteps:true});
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const paper=page=>page.frameLocator('#preview-frame');
async function gateway(page,operations) {
  await page.addInitScript(operations=> {
    const original=window.fetch.bind(window),json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    const steps=[['get_context',{}],['apply_operations',{summary:'Requested form changes',operations}],['inspect_draft',{}],['finish',{summary:'Requested form changes'}]];let turn=0;
    window.fetch=async(input,init)=> {
      const url=new URL(typeof input==='string'?input:input.url,location.href);
      if(url.origin!=='https://gpt.yapweijun1996.com')return original(input,init);
      if(url.pathname==='/demo/session')return json({token:'dmo_synthetic123456',expires_in:900},201);
      if(url.pathname.endsWith('/models'))return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]});
      const [name,args]=steps[turn++],output=[{id:`fc_${turn}`,type:'function_call',status:'completed',call_id:`call_${turn}`,name,arguments:JSON.stringify(args)}];
      const response={status:'completed',output,usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
      return JSON.parse(init.body).stream?new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response})}\n\n`,{headers:{'content-type':'text/event-stream'}}):json(response);
    };
  },operations);
}
async function open(page,operations) {await gateway(page,operations);await page.goto('/studio-v3/');await ready(page);await page.locator('[data-ai-toggle]').click();}
async function send(page,text) {await page.locator('#ai-prompt').fill(text);await page.locator('[data-ai-send]').click();}
const undo=async page=> {await page.locator('[data-ai=undo]').click();await ready(page);await expect(page.locator('#revision')).toHaveText(/^r2\b/);};
const margin=page=>paper(page).locator('.physical_page_wrapper').first().evaluate(node=>node.querySelector('.printform_page').getBoundingClientRect().top-node.getBoundingClientRect().top);

test('heading and an added static field auto-apply in one revision and Undo restores both',async({page})=> {
  await open(page,[{type:'set_heading',value:'Fictional handover'},{type:'add_field',section:'footer',field:{id:'auto-note',kind:'static',text:'Please sign here'}}]);
  const title=paper(page).locator('[data-v3-id=header-title]').first(),before=await title.textContent();
  await send(page,'Change the title to Fictional handover and add the static note Please sign here in the footer.');
  await expectApplied(page,1);await ready(page);
  await expect(title).toHaveText('Fictional handover');await expect(paper(page).locator('[data-v3-id=footer-auto-note]')).toHaveText('Please sign here');
  await undo(page);await expect(title).toHaveText(before);await expect(paper(page).locator('[data-v3-id=footer-auto-note]')).toHaveCount(0);
});

test('page margins wait for Apply, then commit and Undo restores geometry',async({page})=> {
  await open(page,[{type:'set_page',patch:{margins:{top:12}}}]);const before=await margin(page);
  await send(page,'Set the top page margin to 12 px.');
  await expect(page.locator('[data-ai-proposal]')).toBeVisible();await expect(page.locator('#revision')).toHaveText('r0');await expect(page.locator('[data-ai=undo]')).toHaveCount(0);
  // Desktop may show the candidate before Apply, but the committed revision remains r0.
  await page.locator('[data-ai=preview]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await page.locator('[data-ai=apply]').click();await ready(page);await expect(page.locator('#revision')).toHaveText(/^r1\b/);expect(await margin(page)).toBeCloseTo(12,0);
  await undo(page);expect(await margin(page)).toBeCloseTo(before,0);
});

test('field pointer changes remain manual even after inspection',async({page})=> {
  await open(page,[{type:'set_field',target:'header-number',patch:{pointer:'/document/reference'}}]);
  await send(page,'Bind header-number to /document/reference.');
  await expect(page.locator('[data-ai-proposal]')).toBeVisible();await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await expect(page.locator('#revision')).toHaveText('r0');await expect(page.locator('[data-ai=undo]')).toHaveCount(0);
  await page.locator('[data-ai=discard]').click();await ready(page);await expect(page.locator('#revision')).toHaveText('r0');
});
