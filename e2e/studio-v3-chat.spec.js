import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const answer={kind:'answer',message:'The supplied facts show the current font sizes.'};
const proposal={kind:'proposal',summary:'Use navy accents',edits:[{target:'style',property:'color',value:'#163a65'}]};
async function mock(page,replies=[answer]) {
  const requests=[];let index=0;
  await page.route('https://gpt.yapweijun1996.com/demo/**',async route=> {
    const path=new URL(route.request().url()).pathname;
    let body;
    if(path.endsWith('/session'))body={token:'dmo_synthetic123456',expires_in:900};
    else if(path.endsWith('/models'))body={data:[{id:'demo-fast'},{id:'demo-auto'}]};
    else {requests.push(JSON.parse(route.request().postData()).messages);const value=replies[Math.min(index++,replies.length-1)];body={choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]};}
    await route.fulfill({status:path.endsWith('/session')?201:200,contentType:'application/json',body:JSON.stringify(body)});
  });return requests;
}
async function send(page,text) {await page.locator('#ai-prompt').fill(text);await page.locator('#ai-consent').check();await page.locator('[data-ai-send]').click();}
test.beforeEach(async({page})=>{page.on('dialog',d=>d.accept());await page.goto('/studio-v3/');await ready(page);});
test('grounded font Q&A and follow-up proposal form a real conversation with explicit payload and one-step Undo',async({page},info)=> {
  const requests=await mock(page,[answer,proposal]);
  const original=await page.frameLocator('#preview-frame').locator('[data-v3-id=totals-total]').textContent();
  await page.locator('[data-ai-toggle]').click();await send(page,'What are the current font sizes?');
  const log=page.locator('[data-ai-log]');await expect(log).toContainText('header · title: 18 pt');await expect(log).toContainText('header-company · value: 12 pt');await expect(log).toContainText('items · column heading: 8 pt');await expect(log).toContainText('computed styles');
  await expect(page.locator('#revision')).toHaveText('r0');await expect(page.locator('[data-ai=apply]')).toHaveCount(0);
  const context=JSON.parse(requests[0][1].content);expect(context.typography.length).toBeGreaterThan(5);expect(context.typography.every(f=>Object.keys(f).sort().join(',')==='id,pt,role')).toBe(true);expect(JSON.stringify(context)).not.toMatch(/ACME|125|summary\/total|sampleData/);
  await page.locator('#ai-prompt').fill('Use navy accents #163a65 instead.');await expect(page.locator('#ai-share')).toContainText('What are the current font sizes?');await expect(page.locator('#ai-consent')).not.toBeChecked();
  await page.locator('#ai-consent').check();await page.locator('#ai-prompt').press('Enter');await expect(page.locator('[data-ai-proposal]')).toBeVisible();
  expect(JSON.parse(requests[1][1].content).conversation).toHaveLength(2);await expect(page.locator('.ai-diff')).toContainText('#1763dc');await expect(page.locator('.ai-diff')).toContainText('#163a65');
  await page.locator('[data-ai=preview]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();await page.screenshot({path:info.outputPath('chat-desktop-preview.png')});
  await page.locator('[data-ai=apply]').click();await ready(page);await expect(log).toContainText('Applied to the form');await expect(page.locator('[data-ai=undo]')).toBeVisible();
  await page.locator('[data-ai=undo]').click();await ready(page);expect(await page.frameLocator('#preview-frame').locator('[data-v3-id=totals-total]').textContent()).toBe(original);
  expect(await page.frameLocator('#preview-frame').locator('.brand-mark').first().evaluate(n=>getComputedStyle(n).color)).toBe('rgb(23, 99, 220)');
});
test('selected scope rejects global styles, exposes live selection and expires an earlier card on selection navigation',async({page})=> {
  await mock(page,[proposal,proposal]);await page.locator('[data-ai-toggle]').click();await page.locator('#ai-scope').selectOption('selected');
  await expect(page.locator('[data-ai-selection]')).toHaveText('Selected: items');await send(page,'Use navy accents.');await expect(page.locator('[data-ai-status]')).toContainText('exceeds the selected scope');await expect(page.locator('#revision')).toHaveText('r0');
  await page.locator('#ai-scope').selectOption('whole');await send(page,'Use navy accents.');await expect(page.locator('[data-ai-proposal]')).toBeVisible();
  await page.locator('#left-panel [data-select=customer]').click();await expect(page.locator('[data-ai-selection]')).toHaveText('Selected: customer');await expect(page.locator('[data-ai-proposal]')).toHaveCount(0);await expect(page.locator('[data-ai-log]')).toContainText('Expired');await expect(page.locator('[data-ai=apply]')).toHaveCount(0);
  await page.locator('#left-panel [data-select=items]').click();await expect(page.locator('[data-ai=apply]')).toHaveCount(0);
});
test('font answers use selected field facts, remain plain text and do not treat Shift+Enter or IME Enter as Send',async({page})=> {
  const requests=await mock(page,[{kind:'answer',message:'<img src=x onerror=alert(1)>'}]);await page.locator('#left-panel [data-select=header-company]').click();await page.locator('[data-ai-toggle]').click();await page.locator('#ai-scope').selectOption('selected');
  await page.locator('#ai-prompt').fill('What is the current font size?');await page.locator('#ai-consent').check();await page.locator('#ai-prompt').press('Shift+Enter');expect(requests).toHaveLength(0);
  await page.locator('#ai-prompt').evaluate(n=>n.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true})));expect(requests).toHaveLength(0);
  await page.locator('#ai-consent').check();await page.locator('[data-ai-send]').click();await expect(page.locator('[data-ai-log]')).toContainText('header-company · value: 12 pt');await expect(page.locator('[data-ai-log] img')).toHaveCount(0);await expect(page.locator('#revision')).toHaveText('r0');
});
test('desktop panel resizing validates reload preference and refits paper without revision changes',async({page})=> {
  await page.locator('#zoom').selectOption('width');await page.locator('[data-ai-toggle]').click();const separator=page.getByRole('separator',{name:'Resize AI panel'});await separator.focus();const before=await page.locator('#preview-frame').getAttribute('data-zoom');
  await page.keyboard.press('ArrowLeft');await expect(separator).toHaveAttribute('aria-valuenow','410');await expect(page.locator('#preview-frame')).not.toHaveAttribute('data-zoom',before);await expect(page.locator('#revision')).toHaveText('r0');
  await page.reload();await ready(page);await page.locator('[data-ai-toggle]').click();await expect(separator).toHaveAttribute('aria-valuenow','410');
  await page.evaluate(()=>localStorage.setItem('printform-studio-v3:ai-width','Infinity'));await page.reload();await ready(page);await page.locator('[data-ai-toggle]').click();await expect(separator).toHaveAttribute('aria-valuenow','390');
});
test('mobile full-screen conversation returns to paper preview and restores a reviewable edit',async({page},info)=> {
  await mock(page,[proposal]);await page.setViewportSize({width:390,height:844});await page.locator('[data-ai-toggle]').click();
  const box=await page.locator('#ai-panel').boundingBox();expect(box.x).toBe(0);expect(box.y).toBe(0);expect(box.width).toBe(390);expect(box.height).toBe(844);
  await send(page,'Use navy accents.');await expect(page.locator('[data-ai-proposal]')).toBeVisible();await page.screenshot({path:info.outputPath('chat-mobile-proposal.png')});
  await page.locator('[data-ai=preview]').click();await expect(page.locator('#ai-panel')).toBeHidden();await expect(page.locator('[data-ai-toggle]')).toBeFocused();await expect(page.locator('#ai-preview-banner')).toBeVisible();
  await page.locator('[data-ai-return]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();await page.locator('[data-ai=apply]').click();await expect(page.locator('#revision')).toContainText('r1');
  await page.locator('[data-ai=paper]').click();await ready(page);await expect(page.locator('#ai-panel')).toBeHidden();
});
test('explicit Clear removes conversation without changing the template or sending a request',async({page})=> {
  const requests=await mock(page);await page.locator('[data-ai-toggle]').click();await send(page,'Explain this layout.');await expect(page.locator('[data-ai-log] .ai-message')).toHaveCount(2);
  await page.getByLabel('AI settings',{exact:true}).click();await page.locator('[data-ai=clear]').click();await expect(page.locator('[data-ai-log] .ai-message')).toHaveCount(0);await expect(page.locator('#revision')).toHaveText('r0');expect(requests).toHaveLength(1);await expect(page.locator('#ai-consent')).not.toBeChecked();
});

test('timeout stops a held request and retry requires renewed consent',async({page})=> {
  await page.addInitScript(()=> {const original=window.setTimeout;window.setTimeout=(callback,ms,...args)=>original(callback,ms===60000?30:ms,...args);});await page.reload();await ready(page);
  let release;const held=new Promise(r=>release=r);await page.route('https://gpt.yapweijun1996.com/demo/**',async route=> {
    const path=new URL(route.request().url()).pathname;if(path.endsWith('/chat/completions'))await held;
    await route.fulfill({status:path.endsWith('/session')?201:200,contentType:'application/json',body:JSON.stringify(path.endsWith('/session')?{token:'dmo_synthetic123456',expires_in:900}:path.endsWith('/models')?{data:[{id:'demo-fast'}]}:{choices:[]})}).catch(()=>{});
  });
  try {await page.locator('[data-ai-toggle]').click();await send(page,'Fictional held request');await expect(page.locator('[data-ai-status]')).toContainText('timed out');await expect(page.locator('#revision')).toHaveText('r0');await page.locator('[data-ai=retry]').last().click();await expect(page.locator('#ai-prompt')).toHaveValue('Fictional held request');await expect(page.locator('#ai-consent')).not.toBeChecked();}finally{release();}
});
test.describe('normal browser context',()=> {
  test.use({serviceWorkers:'allow'});
  test('read-only chat and print renders have no page errors with normal service-worker permissions',async({page})=> {
    const errors=[];page.on('pageerror',e=>errors.push(e.message));await mock(page,[answer,proposal]);await page.reload();await ready(page);await page.locator('[data-ai-toggle]').click();await send(page,'What are the current font sizes?');await expect(page.locator('[data-ai-status]')).toContainText('Read-only answer');
    await send(page,'Use navy accents.');await expect(page.locator('[data-ai-proposal]')).toBeVisible();await page.locator('[data-ai=preview]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();await page.locator('[data-ai=apply]').click();await ready(page);await page.locator('[data-ai=undo]').click();await ready(page);expect(errors).toEqual([]);
  });
});
