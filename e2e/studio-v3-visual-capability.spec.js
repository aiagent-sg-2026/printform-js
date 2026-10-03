import {test,expect} from '@playwright/test';
import {syntheticPng} from './fixtures/reference-documents.js';
import {rasterPdf} from './fixtures/raster-reference-documents.js';
test.use({serviceWorkers:'block'});test.setTimeout(90000);
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const paper=page=>page.frameLocator('#preview-frame');
const label={kind:'proposal',summary:'Style only the selected label',operations:[{type:'set_field',target:'label-customer-ship',patch:{labelStyle:{fontSize:12,bold:true}}}]};
async function provider(page,{reply=label,hold=false,revoke=false}={}) {
 const calls=[];let discoveries=0,release;
 const waiting=new Promise(resolve=>{release=resolve;});
 await page.route('https://gpt.yapweijun1996.com/demo/**',async route=>{
  const path=new URL(route.request().url()).pathname;calls.push({path,body:route.request().postDataJSON()});let body;
  if(path.endsWith('/session'))body={token:'dmo_synthetic_visual123',expires_in:900};
  else if(path.endsWith('/models'))body={data:[{id:'demo-fast',capabilities:{responses:true,multimodal:!(revoke && ++discoveries>1)}}]};
  else {if(hold)await waiting;body={status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(reply)}]}],usage:{total_tokens:20}};}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
 });return {calls,release};
}
async function prepare(page,fixture=syntheticPng()) {
 await paper(page).locator('[data-v3-id=label-customer-ship]').first().click();
 await page.locator('[data-ai-toggle]').click();await page.locator('#ai-scope').selectOption('selected');
 await page.getByText('References · PDF / image',{exact:true}).click();
 if(fixture.mimeType==='application/pdf')await page.getByLabel('PDF reading for new attachments',{exact:true}).selectOption('visual');
 await page.getByLabel('Add reference PDF or image',{exact:true}).setInputFiles(fixture);
 await expect(page.locator('.ai-reference-card')).toHaveCount(1,{timeout:30000});await expect(page.locator('.ai-reference-files')).toContainText('Ready locally');
 await page.locator('#ai-prompt').fill('Only make the selected Ship to label 12pt bold, using this fictional visual reference.');
 await expect(page.locator('[data-ai-send]')).toBeDisabled();
 await page.getByRole('button',{name:'Check image support',exact:true}).click();
 await expect(page.locator('[data-ai-status]')).toContainText('Available: demo-fast');
 await expect(page.locator('.ai-reference-files')).toContainText('Images available');await expect(page.locator('[data-ai-send]')).toBeEnabled();
}
test.beforeEach(async({page})=>{page.on('dialog',d=>d.accept());await page.goto('/studio-v3/');await ready(page);});
for(const kind of ['image','scanned-pdf'])test(`verified ${kind} uses bounded Responses and preserves selected scope through Preview Apply Undo`,async({page},info)=>{
 const {calls}=await provider(page);const total=await paper(page).locator('[data-v3-id=totals-total]').textContent();
 const node=()=>paper(page).locator('[data-v3-id=label-customer-ship]').first();
 const before=await node().evaluate(n=>({font:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight}));
 await prepare(page,kind==='image'?syntheticPng():rasterPdf('jpeg',{text:false}));
 expect(calls.some(c=>c.path.endsWith('/responses'))).toBe(false);await page.locator('[data-ai-send]').click();
 await expect(page.locator('[data-ai-proposal]')).toBeVisible();await expect(page.locator('#revision')).toHaveText('r0');
 const inference=calls.filter(c=>c.path.endsWith('/responses'));expect(inference).toHaveLength(1);expect(calls.some(c=>c.path.endsWith('/chat/completions'))).toBe(false);
 const wire=inference[0].body,user=wire.input.find(m=>m.role==='user').content;
 expect(user.filter(p=>p.type==='input_image')).toHaveLength(1);expect(user[1].image_url).toMatch(/^data:image\/(png|jpeg|webp);base64,/);
 expect(JSON.stringify(wire)).not.toMatch(/ACME Industrial|Sterling Manufacturing|sampleData|dmo_synthetic/);
 expect(user[0].text).toContain('label-customer-ship');expect(user[0].text).toContain('visual-pages');
 await page.locator('[data-ai=preview]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();await expect(page.locator('#revision')).toHaveText('r0');
 await page.locator('[data-ai=apply]').click();await ready(page);await expect(page.locator('#revision')).toHaveText('r1 · unsaved template');
 expect(await paper(page).locator('[data-v3-id=totals-total]').textContent()).toBe(total);
 expect(await node().evaluate(n=>({font:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight}))).toEqual({font:'16px',weight:'700'});
 await page.screenshot({path:info.outputPath(`${kind}-selected-label-applied.png`)});
 await page.locator('[data-ai=undo]').click();await ready(page);await expect(page.locator('#revision')).toHaveText('r2 · unsaved template');
 expect(await node().evaluate(n=>({font:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight}))).toEqual(before);
});
test('fresh discovery revocation blocks image inference after an earlier positive result',async({page})=>{
 const {calls}=await provider(page,{revoke:true});await prepare(page);await page.locator('[data-ai-send]').click();
 await expect(page.locator('[data-ai-status]')).toContainText('Image analysis is unavailable');await expect(page.locator('[data-ai-send]')).toBeDisabled();
 expect(calls.some(c=>c.path.endsWith('/responses'))).toBe(false);await expect(page.locator('#revision')).toHaveText('r0');
});
test('Stop rejects a late visual reply without applying or retaining authority',async({page})=>{
 const pending=await provider(page,{hold:true});await prepare(page);await page.locator('[data-ai-send]').click();
 await expect.poll(()=>pending.calls.filter(c=>c.path.endsWith('/responses')).length).toBe(1);
 await page.locator('[data-ai=cancel]').click();pending.release();await expect(page.locator('[data-ai-status]')).toContainText('Cancelled');
 await expect(page.locator('[data-ai-proposal]')).toHaveCount(0);await expect(page.locator('#revision')).toHaveText('r0');await ready(page);
});
for(const invalid of [
 {name:'widen selection',operation:{type:'set_field',target:'label-customer-bill',patch:{labelStyle:{fontSize:12,bold:true}}},message:'exceeds the selected scope'},
 {name:'change supplied financial data',operation:{type:'set_field',target:'totals-total',patch:{text:'0'}},message:'unsafe'}
])test(`visual input cannot ${invalid.name}`,async({page})=>{
 const total=await paper(page).locator('[data-v3-id=totals-total]').textContent();
 await provider(page,{reply:{kind:'proposal',summary:'Untrusted reference asks for unrelated value mutation',operations:[invalid.operation]}});
 await prepare(page);await page.locator('[data-ai-send]').click();await expect(page.locator('[data-ai-status]')).toContainText(invalid.message);
 await expect(page.locator('[data-ai-proposal]')).toHaveCount(0);await expect(page.locator('#revision')).toHaveText('r0');
 expect(await paper(page).locator('[data-v3-id=totals-total]').textContent()).toBe(total);
});
