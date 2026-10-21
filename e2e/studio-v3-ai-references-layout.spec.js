import { test, expect } from './studio-v3-test.js';
import { syntheticPdf, syntheticPng } from './fixtures/reference-documents.js';
import {openSharing,closeSettings} from './ai-sharing.js';
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function attach(page,file) {
  await page.getByLabel('Add reference PDF or image',{exact:true}).setInputFiles(file);
  await expect(page.locator('.ai-reference-card')).toHaveCount(1,{timeout:30000});
  await expect(page.locator('.ai-reference-files')).not.toHaveAttribute('open','');
}
async function expand(page,preview=false) {
  await page.locator('.ai-reference-files>summary').click();
  if(preview)await page.locator('.ai-reference-preview>summary').click();
}
const widths = page => page.locator('.ai-reference-card').evaluate(card=>({
  card:card.getBoundingClientRect().width,name:card.querySelector(':scope > span').getBoundingClientRect().width,
  remove:card.querySelector(':scope > button').getBoundingClientRect().width
}));
test.beforeEach(async({page})=> {
  await page.goto('/studio-v3/');await ready(page);await page.locator('[data-ai-toggle]').click();
});

test('a text-only PDF keeps its name readable and its excerpt available on demand',async({page})=> {
  await attach(page,syntheticPdf());await expand(page);
  await expect(page.locator('.ai-reference-excerpt')).toBeHidden();
  await page.locator('.ai-reference-preview>summary').click();await expect(page.locator('.ai-reference-excerpt')).toBeVisible();
  const {card,name,remove}=await widths(page);expect(name).toBeGreaterThan(card*.5);expect(remove).toBeLessThan(card*.3);
});
test('an image is compact until its preview is requested, and has no PDF selector',async({page})=> {
  await attach(page,syntheticPng());await expand(page,true);
  await expect(page.locator('.ai-reference-thumbnails img')).toBeVisible();
  await expect(page.getByLabel('PDF reading for new attachments',{exact:true})).toBeHidden();
  const image=await page.locator('.ai-reference-thumbnails img').boundingBox();expect(image.height).toBeLessThanOrEqual(64);
  const {card,name,remove}=await widths(page);expect(name).toBeGreaterThan(card*.5);expect(remove).toBeLessThan(card*.3);
});
for(const size of [{width:1440,height:900},{width:1024,height:768},{width:390,height:844},{width:400,height:800}]) {
  test(`${size.width}×${size.height}: expanded context shares one scroll owner and leaves the composer reachable`,async({page})=> {
    await page.setViewportSize(size);await attach(page,syntheticPdf());await expand(page,true);
    const owners=await page.locator('#ai-panel').evaluate(panel=>[...panel.querySelectorAll('*')].filter(n=> {
      const style=getComputedStyle(n);return n.getClientRects().length && !n.closest('details:not([open])') && !n.matches('input,select,textarea') && /auto|scroll/.test(style.overflowY) && n.scrollHeight>n.clientHeight+1;
    }).map(n=>n.className));
    expect(owners).toEqual(['ai-conversation-scroll']);
    const panel=await page.locator('#ai-panel').boundingBox(),scroll=await page.locator('.ai-conversation-scroll').boundingBox();
    expect(scroll.height).toBeGreaterThanOrEqual(panel.height*.5);
    await page.locator('.ai-conversation-scroll').evaluate(n=>n.scrollTop=n.scrollHeight);
    await openSharing(page);
    await page.locator('#ai-observation-pixels').scrollIntoViewIfNeeded(); await expect(page.locator('#ai-observation-pixels')).toBeInViewport({ratio:1});
    await closeSettings(page);
    await expect(page.locator('#ai-prompt')).toBeInViewport({ratio:1});await expect(page.locator('[data-ai-send]')).toBeInViewport({ratio:1});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
test('blocked image sharing gives a reason beneath the anchored message box',async({page})=> {
  await page.setViewportSize({width:390,height:844});await attach(page,syntheticPng());
  await page.locator('#ai-prompt').fill('Use navy accents.');await expect(page.locator('[data-ai-send]')).toBeDisabled();
  await expect(page.locator('[data-ai-send-reason]')).toHaveAttribute('data-kind','reason');
  await expect(page.locator('[data-ai-send-reason]')).toBeInViewport({ratio:1});
  await expand(page);await expect(page.getByRole('button',{name:'Check image support'})).toBeVisible();
});
