import {expectApplied} from './ai-applied.js';
import { responsesReply, userText } from './demo-gateway-fixture.js';
import { test, expect } from './studio-v3-test.js';
import { limitToSelection } from './studio-v3-scope.js';
import { clickPaper } from './studio-v3-paper-click.js';

const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const frame=page=>page.frameLocator('#preview-frame');
const plan=operations=>({kind:'proposal',summary:'Edit the referenced template elements',operations});
const label={type:'set_field',target:'label-customer-ship',patch:{labelStyle:{fontSize:12,bold:true}}};
async function gateway(page,replies) {
  const requests=[];let i=0;
  await page.route('https://gpt.yapweijun1996.com/demo/**',async route=> {
    const path=new URL(route.request().url()).pathname;let body;
    if(path.endsWith('/session'))body={token:'dmo_synthetic123456',expires_in:900};
    else if(path.endsWith('/models'))body={data:[{id:'demo-fast'},{id:'demo-auto'}]};
    else {const wire=route.request().postDataJSON();requests.push(wire);body=responsesReply(replies[Math.min(i++,replies.length-1)]);}
    await route.fulfill({status:path.endsWith('/session')?201:200,contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
  });return requests;
}
async function send(page,text) {await page.locator('#ai-prompt').fill(text);await page.locator('[data-ai-send]').click();}
test.beforeEach(async({page})=>{page.on('dialog',d=>d.accept());await page.goto('/studio-v3/');await ready(page);});
test('screenshot request changes selected label to 12pt bold without changing its value, ERP total or paper size; one automatic apply and Undo',async({page},info)=> {
  const wire=await gateway(page,[plan([label])]);
  const value=frame(page).locator('[data-v3-id=customer-ship]').first(),node=frame(page).locator('[data-v3-id=label-customer-ship]').first();
  const beforeValue=await value.evaluate(n=>({text:n.textContent,font:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight}));
  const beforeLabel=await node.evaluate(n=>({font:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight}));
  const total=await frame(page).locator('[data-v3-id=totals-total]').textContent();
  await clickPaper(page,node);await page.locator('[data-ai-toggle]').click();await limitToSelection(page);
  await expect(page.locator('#ai-consent')).toHaveCount(0);await send(page,'Change this label to 12pt bold.');
  await expectApplied(page,1);await ready(page);await expect(page.locator('#ai-preview-banner')).toBeHidden();
  expect(wire).toHaveLength(1);const payload=JSON.parse(userText(wire[0]));expect(payload.scope.id).toBe('label-customer-ship');expect(JSON.stringify(payload)).not.toMatch(/Sterling Manufacturing|ACME Industrial|RM 125|sampleData/);
  await expect(page.locator('[data-ai=apply]')).toHaveCount(0);
  expect(await node.evaluate(n=>({font:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight}))).toEqual({font:'16px',weight:'700'});
  expect(await value.evaluate(n=>({text:n.textContent,font:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight}))).toEqual(beforeValue);
  await page.screenshot({path:info.outputPath('selected-label-12pt-bold-preview.png')});
  await ready(page);await expect(page.locator('#revision')).toContainText('r1');expect(await frame(page).locator('[data-v3-id=totals-total]').textContent()).toBe(total);
  await page.locator('[data-ai=undo]').click();await ready(page);await expect(page.locator('#revision')).toHaveText(/^r2\b/);expect(await node.evaluate(n=>({font:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight}))).toEqual(beforeLabel);
});
test('Pi inspects actual oversized paper and repairs within the disclosed run using only code/geometry diagnostics',async({page})=> {
  const oversized={type:'add_field',section:'header',field:{id:'oversized-note',label:'Synthetic note',kind:'static',text:'Synthetic overflow note '.repeat(160),format:'',valueStyle:{fontSize:72}}};
  const requests=await gateway(page,[plan([oversized]),plan([label])]);await page.locator('[data-ai-toggle]').click();await send(page,'Make the Ship to label 12pt bold.');
  await expectApplied(page,1,{timeout:45000});expect(requests).toHaveLength(2);
  const repair=JSON.parse(userText(requests[1])).repair;expect(repair.diagnostics.ready).toBe(false);expect(repair.diagnostics.errors.length).toBeGreaterThan(0);expect(JSON.stringify(repair.diagnostics)).not.toMatch(/ACME|Sterling|Synthetic|RM|text|selector|message/);
  await expect(page.locator('#revision')).toHaveText(/^r1\b/);await ready(page);
  await expect(frame(page).locator('[data-v3-id=label-customer-ship]').first()).toHaveCSS('font-size','16px');await expect(frame(page).locator('[data-v3-id=label-customer-ship]').first()).toHaveCSS('font-weight','700');
  await expect(frame(page).locator('[data-v3-id=header-oversized-note]')).toHaveCount(0);
});
test('typed structural proposal adds static text, reorders columns and preserves supplied amounts after Apply',async({page})=> {
  const operations=[{type:'add_field',section:'footer',field:{id:'extra-note',label:'Additional note',kind:'static',text:'Synthetic authored note',format:''}},{type:'reorder_fields',section:'items',order:['items-no','items-sku','items-description','items-quantity','items-amount','items-rate']}];
  await gateway(page,[plan(operations)]);const total=await frame(page).locator('[data-v3-id=totals-total]').textContent();
  await page.locator('[data-ai-toggle]').click();await send(page,'Add the static note and swap the Amount and Unit price columns.');await expect(page.locator('[data-ai-proposal]')).toBeVisible();
  await page.locator('[data-ai=preview]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();await page.locator('[data-ai=apply]').click();await ready(page);
  await expect(frame(page).locator('[data-v3-id=footer-extra-note]')).toHaveText('Synthetic authored note');expect(await frame(page).locator('[data-v3-id=totals-total]').textContent()).toBe(total);
  const ids=await frame(page).locator('.prowheader_processed').first().locator('[data-v3-role=label]').evaluateAll(nodes=>nodes.map(n=>n.dataset.v3Id));expect(ids.slice(-2)).toEqual(['label-items-amount','label-items-rate']);
});
test('read-only questions still cannot produce edits and unsupported model code never gains authority',async({page})=> {
  const wire=await gateway(page,[plan([{type:'replace_template',value:'<script>evil()</script>'}])]);await page.locator('[data-ai-toggle]').click();await send(page,'Make a safe framework change.');
  await expect(page.locator('.ai-assistant .ai-message-text').last()).toContainText('unsupported or unsafe');expect(wire).toHaveLength(3);await expect(page.locator('#revision')).toHaveText('r0');await ready(page);
});
