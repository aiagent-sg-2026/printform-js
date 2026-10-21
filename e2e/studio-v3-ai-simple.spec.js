import {test,expect} from './studio-v3-test.js';
test.use({workInSteps:true});
async function gateway(page) {
  await page.addInitScript(()=> {
    const original=window.fetch.bind(window),frame=(type,data)=>`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`,json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    const call=(n,name,args)=>({id:`fc_${n}`,type:'function_call',status:'completed',call_id:`call_${n}`,name,arguments:JSON.stringify(args)});
    const script=[()=>call(1,'get_context',{}),()=>call(2,'apply_operations',{summary:'Larger blue title',operations:[{type:'set_element_style',target:'header-title',patch:{fontSize:20,color:'#1d4ed8'}}]}),()=>call(3,'inspect_draft',{}),()=>call(4,'finish',{summary:'The title is larger and blue.'})]; let turns=0;
    window.fetch=async(input,init)=> {
      const url=new URL(typeof input==='string'?input:input.url,location.href); if(url.origin!=='https://gpt.yapweijun1996.com')return original(input,init);
      if(url.pathname==='/demo/session')return json({token:'dmo_synthetic123456',expires_in:900},201);
      if(url.pathname.endsWith('/models'))return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:true}}]});
      const body=JSON.parse(init.body),n=turns++,output=body.tools?[{id:`rs_${n}`,type:'reasoning',content:[],encrypted_content:`enc-${n}`,summary:[]},script[n%script.length]()]:[{type:'message',content:[{type:'output_text',text:'ok'}]}];
      return new Response(frame('response.created',{response:{status:'in_progress',output:[]}})+frame('response.completed',{response:{status:'completed',output,usage:{input_tokens:10,output_tokens:2,total_tokens:12}}}),{status:200,headers:{'content-type':'text/event-stream'}});
    };
  });
}
const textLength=locator=>locator.evaluate(node=>node.innerText.replace(/\s+/g,' ').trim().length);
for(const size of [{width:1440,height:900},{width:400,height:800}]) {
  test(`simple AI panel ${size.width}x${size.height}`,async({page,browserName})=> {
    test.skip(browserName!=='chromium','Chromium layout budget');
    await page.setViewportSize(size); await gateway(page); await page.goto('/studio-v3/'); await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000}); await page.locator('[data-ai-toggle]').click();
    await expect(page.locator('.ai-welcome')).toBeVisible(); expect(await textLength(page.locator('#ai-panel'))).toBeLessThanOrEqual(200);
    const recipient=page.locator('[data-ai-send-reason]'); await expect(recipient).toBeHidden();
    await page.locator('.ai-settings>summary').click();await expect(page.locator('.ai-settings-body')).toContainText('Demo AI gateway · use fictional data only');await page.locator('.ai-sharing>summary').click();
    for(const id of ['#ai-observation-text','#ai-observation-pixels']) { await expect(page.locator(id)).toBeVisible(); await expect(page.locator(id)).not.toBeChecked(); }
    await page.locator('.ai-settings>summary').click();
    await page.locator('#ai-prompt').fill('Make the title larger and blue.'); await page.locator('[data-ai-send]').click();
    const card=page.locator('.ai-change-card').last(),details=card.locator('details.ai-change-details'),undo=card.locator('[data-ai=undo]');
    await expect(card.getByRole('heading',{name:'Applied',exact:true})).toBeVisible({timeout:30000}); await expect(undo).toBeVisible(); await expect(page.locator('#revision')).toHaveText(/^r1\b/);
    await expect(details).not.toHaveAttribute('open',''); expect(await textLength(card)).toBeLessThanOrEqual(60); await expect(page.locator('[data-ai-suggestions]')).toBeHidden(); await expect(recipient).toBeHidden();
    await page.locator('.ai-conversation-scroll').focus(); let reachedUndo=false,reachedDetails=false;
    for(let i=0;i<12 && !reachedDetails;i++) { await page.keyboard.press('Tab'); reachedUndo ||= await undo.evaluate(node=>node===document.activeElement); reachedDetails=await details.locator('summary').evaluate(node=>node===document.activeElement); }
    expect(reachedUndo).toBe(true); expect(reachedDetails).toBe(true); await page.keyboard.press('Enter'); await expect(details).toHaveAttribute('open','');
    await expect(details.locator('.ai-activity li').first()).toBeVisible(); await expect(details.locator('.ai-run-steps')).toContainText(/Worked in \d+ steps/); await expect(details.locator('.ai-run-steps li').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
