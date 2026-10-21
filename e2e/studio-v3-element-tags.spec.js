import {clickHeaderAction} from './header-action.js';
import {expectApplied} from './ai-applied.js';
import { isInference, responsesReply, userText } from './demo-gateway-fixture.js';
import { test, expect } from './studio-v3-test.js';
import { keepStructureOpen } from './studio-v3-structure.js';
import { clickPaper } from './studio-v3-paper-click.js';

const frame = page=>page.frameLocator('#preview-frame');
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function mock(page) {
  const calls = [];
  await page.route('https://gpt.yapweijun1996.com/demo/**',async route=> {
    const path = new URL(route.request().url()).pathname;
    calls.push({path,body:route.request().postDataJSON()});
    const body = path.endsWith('/session') ? {token:'dmo_synthetic123456',expires_in:900} : path.endsWith('/models') ? {data:[{id:'demo-fast'},{id:'demo-auto'}]} : responsesReply({kind:'answer',message:'Referenced elements received. The form is unchanged.'});
    await route.fulfill({status:path.endsWith('/session') ? 201 : 200,contentType:'application/json',body:JSON.stringify(body)});
  });
  return calls;
}
async function add(page,id) {
  await page.locator(`[data-select="${id}"]`).first().click();
  await page.locator('#left-panel [data-ai-add]').click();
  await expect(page.locator(`[data-ai-tag-id="${id}"]`)).toBeVisible();
}
test.beforeEach(async({page})=> { page.on('dialog',dialog=>dialog.accept()); await keepStructureOpen(page);await page.goto('/studio-v3/'); await ready(page); });

test('canvas label and structure value become removable composer references; only explicit Send transmits comments',async({page},info)=> {
  const calls = await mock(page), errors = []; page.on('pageerror',error=>errors.push(error.message));
  await clickPaper(page,frame(page).locator('[data-v3-id="label-customer-bill"]').first());
  await page.locator('.paper-toolbar [data-ai-add]').click();
  await expect(page.locator('[data-ai-tag-id="label-customer-bill"]')).toBeVisible();
  await page.getByLabel('Comment for label-customer-bill',{exact:true}).fill('Make this label 12pt, bold and navy.');
  await add(page,'header-company');
  await page.getByLabel('Comment for header-company',{exact:true}).fill('Keep this value unchanged.');
  await expect(page.locator('[data-ai-tag-id]')).toHaveCount(2);
  await page.getByRole('button',{name:'Locate Bill to · label (label-customer-bill)',exact:true}).hover();
  await expect(frame(page).locator('[data-v3-selection]')).toHaveCount(1);
  await expect(page.locator('#ai-prompt')).toHaveValue('');
  expect(calls).toHaveLength(0);
  await expect(page.locator('#ai-consent')).toHaveCount(0);
  await page.locator('[data-ai-send]').click();
  await expect(page.locator('.ai-assistant')).toContainText('Referenced elements received. The form is unchanged.');
  await expect(page.locator('[data-ai-proposal]')).toHaveCount(0);
  await expect(page.locator('[data-ai=apply]')).toHaveCount(0);
  expect(calls.filter(call=>isInference(call.path))).toHaveLength(1);
  const wire = calls.find(call=>isInference(call.path)).body;
  expect(JSON.stringify(wire)).not.toContain('ACME'); expect(JSON.stringify(wire)).not.toContain('Sterling');
  expect(JSON.stringify(wire)).toContain('label-customer-bill'); expect(JSON.stringify(wire)).toContain('Make this label 12pt');
  const sent = JSON.parse(userText(wire));
  expect(sent.references).toHaveLength(2);
  expect(sent.references[0]).toMatchObject({id:'label-customer-bill',kind:'label',role:'label',revision:0,comment:'Make this label 12pt, bold and navy.'});
  expect(sent.references[1]).toMatchObject({id:'header-company',role:'value',revision:0});
  await expect(page.locator('#revision')).toHaveText('r0');
  await page.screenshot({path:info.outputPath('element-reference-composer.png')});
  await page.getByRole('button',{name:'Remove reference header-company',exact:true}).click();
  await expect(page.locator('[data-ai-tag-id]')).toHaveCount(1); expect(calls.filter(call=>isInference(call.path))).toHaveLength(1);
  expect(errors).toEqual([]);
});
test('revision changes visibly block stale tags until the user removes and adds them again',async({page})=> {
  const calls = await mock(page); await add(page,'items-description');
  await page.getByLabel('Comment for items-description',{exact:true}).fill('Make this text larger.');
  await page.locator('#document-name').fill('Edited document title'); await page.locator('#document-name').press('Tab');
  await expect(page.locator('#revision')).toContainText('r1'); await ready(page);
  await expect(page.locator('[data-ai-tag-id="items-description"]')).toHaveAttribute('data-invalid','');
  await expect(page.locator('[data-ai-element-tags]')).toContainText('Older revision r0');
  await page.locator('[data-ai-send]').click(); expect(calls).toHaveLength(0);
  await page.getByRole('button',{name:'Remove reference items-description',exact:true}).click();
  await page.locator('#left-panel [data-ai-add]').click();
  await expect(page.locator('[data-ai-tag-id="items-description"]')).not.toHaveAttribute('data-invalid','');
  await page.getByLabel('Comment for items-description',{exact:true}).fill('Make this text larger.');
  await expect(page.locator('[data-ai-tag-id="items-description"]')).toContainText('r1');
});
test('deleted and cross-document references never target a neighboring field with the same position or ID',async({page})=> {
  const calls = await mock(page); await add(page,'items-sku'); await page.locator('[data-ai=close]').click();
  await page.locator('#right-panel [data-action=remove-field]').click(); await expect(page.locator('#revision')).toContainText('r1'); await ready(page);
  await page.locator('[data-ai-toggle]').click(); await expect(page.locator('[data-ai-element-tags]')).toContainText('Deleted element');
  await page.locator('#ai-prompt').fill('Amend this referenced field.'); await page.locator('[data-ai-send]').click(); expect(calls).toHaveLength(0);
  await page.getByRole('button',{name:'Remove all',exact:true}).click(); await add(page,'header-company');
  await clickHeaderAction(page,'new'); await page.locator('[data-template=delivery]').click(); await ready(page);
  await expect(page.locator('[data-ai-element-tags]')).toContainText('Another document');
  await page.locator('[data-ai-send]').click(); expect(calls).toHaveLength(0);
  expect(await page.locator('[data-ai-tag-id="header-company"] .ai-tag-meta').textContent()).toContain('r1');
});
test('mobile Add from the inspector opens the composer and clicking a chip returns to the highlighted paper',async({page},info)=> {
  const calls = await mock(page); await page.setViewportSize({width:390,height:844});
  await clickPaper(page,frame(page).locator('[data-v3-id="label-customer-bill"]').first());
  await expect(page.locator('body')).toHaveClass(/drawer-properties/);
  await page.locator('#right-panel [data-ai-add]').click();
  await expect(page.locator('#ai-panel')).toBeVisible();
  await page.getByLabel('Comment for label-customer-bill',{exact:true}).fill('Increase this label to 12pt.');
  await page.screenshot({path:info.outputPath('element-reference-mobile.png')});
  await page.getByRole('button',{name:'Locate Bill to · label (label-customer-bill)',exact:true}).click();
  await expect(page.locator('#ai-panel')).toBeHidden();
  await expect(frame(page).locator('[data-v3-selection]')).toHaveCount(1);
  await page.locator('[data-ai-toggle]').click(); await expect(page.getByLabel('Comment for label-customer-bill',{exact:true})).toHaveValue('Increase this label to 12pt.');
  expect(calls).toHaveLength(0); await expect(page.locator('#revision')).toHaveText('r0');
});

test('plain-language selected label request supplies its exact target and stays label-only through automatic apply and Undo',async({page})=>{
 const wording='Only make the Ship to label 12pt bold.';let captured;
 await page.route('https://gpt.yapweijun1996.com/demo/**',async route=>{
  const path=new URL(route.request().url()).pathname;let body;
  if(path.endsWith('/session'))body={token:'dmo_synthetic123456',expires_in:900};
  else if(path.endsWith('/models'))body={data:[{id:'demo-fast'}]};
  else {
   captured=JSON.parse(userText(route.request().postDataJSON()));
   expect(captured.request).toBe(wording);expect(captured.request).not.toContain('label-customer-ship');
   const selected=captured.scopeAuthoringTargets.find(target=>target.target==='label-customer-ship');expect(selected?.typographyPatchKey).toBe('labelStyle');
   body=responsesReply({kind:'proposal',summary:'Only the selected label becomes 12pt bold',operations:[{type:'set_field',target:selected.target,patch:{labelStyle:{fontSize:12,bold:true}}}]});
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const valueBefore=await frame(page).locator('[data-v3-id=customer-ship]').first().textContent();
 await clickPaper(page,frame(page).locator('[data-v3-id=label-customer-ship]').first());await page.locator('.paper-toolbar [data-ai-add]').click();
 await page.locator('#ai-prompt').fill(wording);await page.locator('[data-ai-send]').click();await expectApplied(page,1);await ready(page);
 await expect(frame(page).locator('[data-v3-id=label-customer-ship]').first()).toHaveCSS('font-size','16px');await expect(frame(page).locator('[data-v3-id=label-customer-ship]').first()).toHaveCSS('font-weight','700');
 expect(await frame(page).locator('[data-v3-id=customer-ship]').first().textContent()).toBe(valueBefore);await page.locator('[data-ai=undo]').click();await ready(page);await expect(page.locator('#revision')).toContainText('r2');
});
