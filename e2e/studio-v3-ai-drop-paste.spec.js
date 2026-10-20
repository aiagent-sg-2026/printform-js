import {test,expect} from './studio-v3-test.js';
import {syntheticPng} from './fixtures/reference-documents.js';

test('header drop and prompt paste attach locally without navigating',async({page})=>{
  await page.addInitScript(()=>{
    const original=window.fetch.bind(window),json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    window.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url,location.href);
      if(url.origin!=='https://gpt.yapweijun1996.com')return original(input,init);
      if(url.pathname==='/demo/session')return json({token:'dmo_synthetic123456',expires_in:900},201);
      if(url.pathname.endsWith('/models'))return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:true}}]});
      throw new Error('Reference intake must not send a model request.');
    };
  });
  await page.goto('/studio-v3/');await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
  await page.locator('[data-ai-toggle]').click();const url=page.url();
  const fixture=syntheticPng();
  const dispatch=type=>page.evaluate(({type,png,mimeType})=>{
    const data=new DataTransfer();data.items.add(new File([Uint8Array.from(atob(png),c=>c.charCodeAt(0))],type==='drop'?'fictional-drop.png':'image.png',{type:mimeType}));
    const target=document.querySelector(type==='drop'?'.ai-heading':'#ai-prompt');
    const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,type==='drop'?'dataTransfer':'clipboardData',{value:data});
    target.dispatchEvent(event);return event.defaultPrevented;
  },{type,png:fixture.buffer.toString('base64'),mimeType:fixture.mimeType});
  expect(await dispatch('drop')).toBe(true);
  await expect(page.locator('.ai-reference-card')).toHaveCount(1,{timeout:30000});
  // Successful intake collapses references; expand to verify the actual card, not just its summary.
  await page.locator('.ai-reference-files>summary').click();
  await expect(page.locator('.ai-reference-list')).toContainText('fictional-drop.png');expect(page.url()).toBe(url);
  await expect(page.locator('[data-ai=attach]')).toBeEnabled();await expect(page.locator('#ai-prompt')).toBeEnabled();
  await page.locator('#ai-prompt').focus();expect(await dispatch('paste')).toBe(true);
  await expect(page.locator('.ai-reference-card')).toHaveCount(2,{timeout:30000});
  await page.locator('.ai-reference-files>summary').click();
  await expect(page.locator('.ai-reference-list')).toContainText('pasted-image-1.png');
  await expect(page.locator('.ai-reference-card').filter({hasText:'pasted-image-1.png'})).toBeVisible();expect(page.url()).toBe(url);
});
