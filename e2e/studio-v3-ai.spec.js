import { test,expect } from '@playwright/test';
const proposal = {summary:'Use navy and compact spacing',edits:[{target:'style',property:'color',value:'#163a65'},{target:'style',property:'padding',value:5}]};
const frame = page=>page.frameLocator('#preview-frame');
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function openAI(page) { await page.locator('[data-ai-toggle]').click(); await page.locator('#ai-prompt').fill('Use navy #163a65 and padding 5 px.'); }
async function send(page) { await page.locator('#ai-consent').check(); await page.locator('[data-ai-send]').click(); }
async function mock(page,{reply = proposal,status = 200,sessionStatus = 201,hold = null,unauthorized = false} = {}) {
  const calls = []; let sessions = 0,plans = 0;
  await page.route('https://gpt.yapweijun1996.com/demo/**',async route=> {
    const request = route.request(), path = new URL(request.url()).pathname;
    const payload = request.postDataJSON();
    calls.push({path,payload,auth:Boolean(request.headers().authorization),origin:request.headers().origin});
    const fulfill = (body,code=200)=>route.fulfill({status:code,contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
    if (path === '/demo/session') { sessions++; await fulfill({token:'dmo_synthetic123456',expires_in:900},sessionStatus); }
    else if (path.endsWith('/models')) await fulfill({data:[{id:'demo-fast'},{id:'demo-auto'}]});
    else {
      plans++; if (hold) await hold;
      await fulfill(unauthorized && plans===1 ? {} : {choices:[{finish_reason:'stop',message:{content:typeof reply === 'string' ? reply : JSON.stringify(reply)}}],usage:{total_tokens:25}},unauthorized && plans===1 ? 401 : status);
    }
  });
  return {calls,sessions:()=>sessions,plans:()=>plans};
}
test.beforeEach(async({page})=> { page.on('dialog',d=>d.accept()); await page.goto('/studio-v3/'); await ready(page); });
test('explicit sharing -> actual Harness local proposal -> real preview -> apply -> undo; ERP and print dimensions survive',async({page},info)=> {
  const m = await mock(page); const before = await frame(page).locator('.printform_page').first().evaluate(n=>({width:n.offsetWidth,height:n.offsetHeight}));
  const total = await frame(page).locator('[data-v3-id=totals-total]').textContent();
  await openAI(page); await expect(page.locator('#ai-share')).not.toContainText('ACME');
  await page.locator('[data-ai-send]').click(); expect(m.calls).toHaveLength(0);
  await send(page); await expect(page.locator('[data-ai-proposal]')).toBeVisible();
  await expect(page.locator('[data-ai-status]')).toContainText('demo-fast'); await expect(page.locator('#revision')).toHaveText('r0');
  expect(m.plans()).toBe(1); expect(m.calls[0].payload).toEqual({project_id:'github-pages'}); expect(m.calls[0].auth).toBe(false);
  const wire = m.calls.find(c=>c.path.endsWith('/chat/completions')).payload;
  expect(Object.keys(wire).sort()).toEqual(['messages','model','stream']); expect(JSON.stringify(wire)).not.toContain('ACME');
  await expect(page.locator('[data-ai=apply]')).toBeDisabled();
  await page.locator('[data-ai=preview]').click(); await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await expect(page.locator('[data-action=print]')).toBeDisabled(); await expect(page.locator('[data-action=export]')).toBeDisabled();
  expect(await frame(page).locator('.brand-mark').first().evaluate(n=>getComputedStyle(n).color)).toBe('rgb(22, 58, 101)');
  await page.screenshot({path:info.outputPath('ai-unapplied-preview.png')});
  await page.locator('[data-ai=apply]').click(); await expect(page.locator('#revision')).toContainText('r1'); await ready(page);
  await expect(frame(page).locator('[data-v3-id=totals-total]')).toHaveText(total);
  expect(await frame(page).locator('.printform_page').first().evaluate(n=>({width:n.offsetWidth,height:n.offsetHeight}))).toEqual(before);
  await page.locator('[data-action=undo]').click(); await ready(page);
  expect(await frame(page).locator('.brand-mark').first().evaluate(n=>getComputedStyle(n).color)).toBe('rgb(23, 99, 220)');
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>/ai|token|session/i.test(k)))).toEqual([]);
});
for (const [name,reply] of [['malformed','hello'],['unsafe',{summary:'Change money',edits:[{target:'data',property:'total',value:0}]}]]) {
  test(`${name} proposal cannot mutate the form`,async({page})=> {
    await mock(page,{reply}); await openAI(page); await send(page);
    await expect(page.locator('[data-ai-status]')).toContainText('Nothing changed.'); await expect(page.locator('#revision')).toHaveText('r0'); await expect(page.locator('[data-ai-proposal]')).toBeHidden(); await ready(page);
  });
}
test('session registration blocker and token expiry retry are explicit',async({page})=> {
  await mock(page,{sessionStatus:403}); await openAI(page); await send(page);
  await expect(page.locator('[data-ai-status]')).toContainText('not registered'); await expect(page.locator('#revision')).toHaveText('r0');
  await page.unrouteAll(); const m = await mock(page,{unauthorized:true}); await send(page);
  await expect(page.locator('[data-ai-proposal]')).toBeVisible(); expect(m.sessions()).toBe(2); expect(m.plans()).toBe(2);
});
test('cancel and a changed revision reject late responses; replaced form gets fresh disclosure',async({page})=> {
  let release; const hold = new Promise(r=>release=r); const m = await mock(page,{hold});
  await openAI(page); await send(page); await expect.poll(()=>m.plans()).toBe(1);
  await page.locator('[data-ai=cancel]').click(); release(); await expect(page.locator('[data-ai-status]')).toContainText('Cancelled');
  await page.unrouteAll(); let release2; const hold2 = new Promise(r=>release2=r); const m2 = await mock(page,{hold:hold2});
  await send(page); await expect.poll(()=>m2.plans()).toBe(1);
  await page.locator('#document-name').fill('Fictional renamed form'); await page.locator('#document-name').press('Tab'); release2();
  await expect(page.locator('#revision')).toContainText('r1'); await expect(page.locator('[data-ai-proposal]')).toBeHidden();
  await expect(page.locator('[data-ai-status]')).toContainText('Form changed'); await expect(page.locator('#ai-consent')).not.toBeChecked();
  await page.locator('[data-action=new]').click(); await page.locator('[data-template=delivery]').click(); await ready(page);
  await expect(page.locator('#ai-share')).not.toContainText('items-amount');
});
test('unapplied drafts stay protected across AI preview and cannot be silently overwritten by Apply',async({page})=> {
  await mock(page); await page.locator('#left-panel [data-select=items-description]').click();
  await page.getByLabel('Label',{exact:true}).fill('Keep this draft');
  await openAI(page); await send(page); await expect(page.locator('[data-ai-proposal]')).toBeVisible();
  await page.locator('[data-ai=preview]').click(); await expect(page.locator('#draft-dialog')).toBeVisible();
  await page.locator('[data-draft-choice=stay]').click(); await expect(page.getByLabel('Label',{exact:true})).toHaveValue('Keep this draft');
  await page.locator('[data-ai-toggle]').click(); await page.locator('[data-ai=preview]').click(); await page.locator('[data-draft-choice=apply]').click();
  await expect(page.locator('#revision')).toContainText('r1'); await expect(page.locator('[data-ai=apply]')).toBeDisabled(); await expect(page.locator('[data-ai-proposal]')).toBeHidden();
  await ready(page);
});
test('Fit page defaults and preferences survive reload, panel/viewport refit and invalid stored values',async({page})=> {
  await expect(page.locator('#zoom')).toHaveValue('fit'); const revision = await page.locator('#revision').textContent();
  const initial = await page.locator('#preview-frame').getAttribute('data-zoom');
  await page.locator('[data-layout=thumbnails]').click(); await expect(page.locator('#preview-frame')).not.toHaveAttribute('data-zoom',initial);
  await page.locator('#zoom').selectOption('width'); await page.reload(); await ready(page); await expect(page.locator('#zoom')).toHaveValue('width');
  await page.locator('[data-layout=zoom-in]').click(); const custom = await page.locator('#zoom').inputValue();
  await page.reload(); await ready(page); await expect(page.locator('#zoom')).toHaveValue(custom);
  await page.locator('#zoom').selectOption('fit'); await page.setViewportSize({width:1440,height:900});
  await expect(page.locator('#revision')).toHaveText(revision);
  await page.evaluate(()=>localStorage.setItem('printform-studio-v3:zoom','Infinity')); await page.reload(); await ready(page); await expect(page.locator('#zoom')).toHaveValue('fit');
});
test('coherent accessible SVG controls and keyboard/mobile AI sidepanel',async({page},info)=> {
  for (const [name,icon] of [['structure','structure'],['properties','properties'],['thumbnails','pages']]) {
    const button = page.locator(`.paper-toolbar [data-layout=${name}]`); await expect(button).toHaveAttribute('data-icon',icon);
    await expect(button.locator('svg')).toHaveAttribute('aria-hidden','true'); await expect(button.locator('svg')).toHaveAttribute('focusable','false'); await expect(button).toHaveAttribute('aria-label',/Toggle/);
  }
  await page.locator('[data-ai-toggle]').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#ai-prompt')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('[data-ai-toggle]')).toBeFocused();
  await page.setViewportSize({width:390,height:844}); await page.locator('[data-ai-toggle]').click();
  const box = await page.locator('#ai-panel').boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(390);
  await page.locator('[data-ai=close]').focus(); await page.keyboard.press('Shift+Tab'); await expect(page.locator('[data-ai-send]')).toBeFocused();
  await page.screenshot({path:info.outputPath('ai-mobile.png')});
  await page.keyboard.press('Escape'); await expect(page.locator('[data-ai-toggle]')).toBeFocused();
});
