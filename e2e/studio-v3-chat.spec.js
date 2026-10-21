import {expectApplied} from './ai-applied.js';
import { isInference, responsesReply, userText } from './demo-gateway-fixture.js';
import {syntheticDemoTransport} from './synthetic-demo-transport.js';
import { limitToSelection, limitToWholeForm } from './studio-v3-scope.js';
import { keepStructureOpen } from './studio-v3-structure.js';
import { test, expect } from './studio-v3-test.js';

const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const answer={kind:'answer',message:'The supplied facts show the current font sizes.'};
const proposal={kind:'proposal',summary:'Use navy accents',edits:[{target:'style',property:'color',value:'#163a65'}]};
const manualProposal={kind:'proposal',summary:'Use navy accents and page margins',operations:[{type:'set_style',patch:{color:'#163a65'}},{type:'set_page',patch:{margins:{top:12}}}]};
async function mock(page,replies=[answer]) {
  const requests=[];let index=0;
  await page.route('https://gpt.yapweijun1996.com/demo/**',async route=> {
    const path=new URL(route.request().url()).pathname;
    let body;
    if(path.endsWith('/session'))body={token:'dmo_synthetic123456',expires_in:900};
    else if(path.endsWith('/models'))body={data:[{id:'demo-fast'},{id:'demo-auto'}]};
    else {requests.push(JSON.parse(route.request().postData()));const value=replies[Math.min(index++,replies.length-1)];body=responsesReply(value);}
    await route.fulfill({status:path.endsWith('/session')?201:200,contentType:'application/json',body:JSON.stringify(body)});
  });return requests;
}
async function send(page,text) {await page.locator('#ai-prompt').fill(text);await page.locator('[data-ai-send]').click();}
test.beforeEach(async({page})=>{page.on('dialog',d=>d.accept());await keepStructureOpen(page);await page.goto('/studio-v3/');await ready(page);});
test('grounded font Q&A and follow-up proposal form a real conversation with explicit Send payload and one-step Undo',async({page},info)=> {
  const requests=await mock(page,[answer,proposal]);
  const original=await page.frameLocator('#preview-frame').locator('[data-v3-id=totals-total]').textContent();
  await page.locator('[data-ai-toggle]').click();await send(page,'What are the current font sizes?');
  const log=page.locator('[data-ai-log]');await expect(log.locator('.ai-assistant .ai-message-text').last()).toHaveText(answer.message);
  await expect(page.locator('#revision')).toHaveText('r0');await expect(page.locator('[data-ai=apply]')).toHaveCount(0);
  const context=JSON.parse(userText(requests[0]));expect(context.typography.length).toBeGreaterThan(5);expect(context.typography.every(f=>Object.keys(f).sort().join(',')==='id,pt,role')).toBe(true);expect(JSON.stringify(context)).not.toMatch(/ACME|125|sampleData/);
  await page.locator('#ai-prompt').fill('Use navy accents #163a65 instead.');await expect(page.locator('#ai-consent')).toHaveCount(0);
  await page.locator('#ai-prompt').press('Enter');await expectApplied(page,1);
  expect(JSON.parse(userText(requests[1])).conversation).toHaveLength(2);expect(userText(requests[1])).toContain('What are the current font sizes?');await expect(page.locator('.ai-diff')).toContainText('#1763dc');await expect(page.locator('.ai-diff')).toContainText('#163a65');
  await ready(page);await page.screenshot({path:info.outputPath('chat-desktop-applied.png')});
  await expect(page.locator('[data-ai=undo]')).toBeVisible();
  await page.locator('[data-ai=undo]').click();await ready(page);await expect(page.locator('#revision')).toHaveText(/^r2\b/);expect(await page.frameLocator('#preview-frame').locator('[data-v3-id=totals-total]').textContent()).toBe(original);
  expect(await page.frameLocator('#preview-frame').locator('.brand-mark').first().evaluate(n=>getComputedStyle(n).color)).toBe('rgb(23, 99, 220)');
});
test('a referenced scope rejects global styles, the hint tracks scope and an earlier card expires on selection navigation',async({page})=> {
  await mock(page,[proposal,manualProposal]);await page.locator('[data-ai-toggle]').click();await limitToSelection(page);
  await expect(page.locator('#ai-scope')).toHaveValue('selected');await send(page,'Use navy accents.');await expect(page.locator('.ai-assistant .ai-message-text').last()).toContainText('exceeds the selected scope');await expect(page.locator('#revision')).toHaveText('r0');
  await limitToWholeForm(page);await expect(page.locator('#ai-scope')).toHaveValue('whole');await send(page,'Use navy accents.');await expect(page.locator('[data-ai-proposal]')).toBeVisible();
  await page.locator('#left-panel [data-select=customer]').click();await expect(page.locator('[data-ai-proposal]')).toHaveCount(0);await expect(page.locator('[data-ai-log]')).toContainText('Expired');await expect(page.locator('[data-ai=apply]')).toHaveCount(0);
  await page.locator('#left-panel [data-select=items]').click();await expect(page.locator('[data-ai=apply]')).toHaveCount(0);
});
test('font answers preserve model text inertly and do not treat Shift+Enter or IME Enter as Send',async({page})=> {
  const requests=await mock(page,[{kind:'answer',message:'<img src=x onerror=alert(1)>'}]);await page.locator('#left-panel [data-select=header-company]').click();await page.locator('[data-ai-toggle]').click();await limitToSelection(page);
  await page.locator('#ai-prompt').fill('What is the current font size?');await page.locator('#ai-prompt').press('Shift+Enter');expect(requests).toHaveLength(0);
  await page.locator('#ai-prompt').evaluate(n=>n.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true})));expect(requests).toHaveLength(0);
  await page.locator('[data-ai-send]').click();await expect(page.locator('[data-ai-log] .ai-assistant .ai-message-text').last()).toHaveText('<img src=x onerror=alert(1)>');await expect(page.locator('[data-ai-log] img')).toHaveCount(0);await expect(page.locator('#revision')).toHaveText('r0');
});
test('desktop panel resizing validates reload preference and refits paper without revision changes',async({page})=> {
  await page.setViewportSize({width:1440,height:900});await page.locator('[data-ai-toggle]').click();await page.locator('#zoom').selectOption('width');await expect(page.locator('#zoom')).toHaveValue('width');const separator=page.getByRole('separator',{name:'Resize AI panel'});await separator.focus();const before=await page.locator('#preview-frame').getAttribute('data-zoom');
  await page.keyboard.press('ArrowLeft');await expect(separator).toHaveAttribute('aria-valuenow','410');await expect(page.locator('#revision')).toHaveText('r0');
  await page.keyboard.press('End');await expect(separator).toHaveAttribute('aria-valuenow','600');await expect(page.locator('#preview-frame')).not.toHaveAttribute('data-zoom',before);await expect(page.locator('#revision')).toHaveText('r0');
  await page.reload();await ready(page);await page.locator('[data-ai-toggle]').click();await expect(separator).toHaveAttribute('aria-valuenow','600');
  await page.evaluate(()=>localStorage.setItem('printform-studio-v3:ai-width','Infinity'));await page.reload();await ready(page);await page.locator('[data-ai-toggle]').click();await expect(separator).toHaveAttribute('aria-valuenow','390');
});
test('mobile full-screen conversation returns to paper preview and restores a reviewable edit',async({page},info)=> {
  await mock(page,[manualProposal]);await page.setViewportSize({width:390,height:844});await page.locator('[data-ai-toggle]').click();
  const box=await page.locator('#ai-panel').boundingBox();expect(box.x).toBe(0);expect(box.y).toBe(0);expect(box.width).toBe(390);expect(box.height).toBeCloseTo(844,0);
  await send(page,'Use navy accents.');await expect(page.locator('[data-ai-proposal]')).toBeVisible();await page.screenshot({path:info.outputPath('chat-mobile-proposal.png')});
  await page.locator('[data-ai=preview]').click();await expect(page.locator('#ai-panel')).toBeHidden();await expect(page.locator('[data-ai-toggle]')).toBeFocused();await expect(page.locator('#ai-preview-banner')).toBeVisible();
  await page.locator('[data-ai-return]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();await page.locator('[data-ai=apply]').click();await expect(page.locator('#revision')).toContainText('r1');
  await page.locator('[data-ai=close]').click();await ready(page);await expect(page.locator('#ai-panel')).toBeHidden();
});
test('explicit Clear removes conversation without changing the template or sending a request',async({page})=> {
  const requests=await mock(page);await page.locator('[data-ai-toggle]').click();await send(page,'Explain this layout.');await expect(page.locator('[data-ai-log] .ai-message')).toHaveCount(2);
  await page.getByLabel('AI settings',{exact:true}).click();await page.locator('[data-ai=clear]').click();await expect(page.locator('[data-ai-log] .ai-message')).toHaveCount(0);await expect(page.locator('#revision')).toHaveText('r0');expect(requests).toHaveLength(1);await expect(page.locator('#ai-consent')).toHaveCount(0);
});

test('timeout stops a held request and retry requires another deliberate Send',async({page})=> {
  await page.addInitScript(()=> {const original=window.setTimeout;window.setTimeout=(callback,ms,...args)=>original(callback,ms>=60000?30:ms,...args);});await page.reload();await ready(page);
  let release;const held=new Promise(r=>release=r);await page.route('https://gpt.yapweijun1996.com/demo/**',async route=> {
    const path=new URL(route.request().url()).pathname;if(isInference(path))await held;
    await route.fulfill({status:path.endsWith('/session')?201:200,contentType:'application/json',body:JSON.stringify(path.endsWith('/session')?{token:'dmo_synthetic123456',expires_in:900}:path.endsWith('/models')?{data:[{id:'demo-fast'}]}:{output:[]})}).catch(()=>{});
  });
  try {await page.locator('[data-ai-toggle]').click();await send(page,'Fictional held request');await expect(page.locator('.ai-assistant .ai-message-text').last()).toContainText('timed out');await expect(page.locator('#revision')).toHaveText('r0');await page.locator('[data-ai=retry]').last().click();await expect(page.locator('#ai-prompt')).toHaveValue('Fictional held request');await expect(page.locator('#ai-consent')).toHaveCount(0);}finally{release();}
});
test.describe('normal browser context',()=> {
  test.use({blockServiceWorkers:false});
  test('read-only chat and print renders have no page errors with normal service-worker permissions',async({page,context})=> {
    const errors=[];page.on('pageerror',e=>errors.push(e.message));const transport=await syntheticDemoTransport(context,[answer,proposal]);await page.reload();await ready(page);await page.locator('[data-ai-toggle]').click();await send(page,'What are the current font sizes?');await expect(page.locator('.ai-assistant[data-state=answer]')).toBeVisible();
    await send(page,'Use navy accents.');await expectApplied(page,1);await ready(page);await page.locator('[data-ai=undo]').click();await ready(page);await expect(page.locator('#revision')).toHaveText(/^r2\b/);expect(errors).toEqual([]);expect(transport.requests).toHaveLength(2);expect(transport.unexpected).toEqual([]);
  });
});
