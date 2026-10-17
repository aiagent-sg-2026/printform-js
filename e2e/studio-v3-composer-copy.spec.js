import { test, expect } from './studio-v3-test.js';

test('retains and fits an unsent multiline request across viewport and panel-width changes',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/studio-v3/');await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
 await page.locator('[data-ai-toggle]').click();
 const prompt=page.getByRole('textbox',{name:'Message AI assistant'}),draft='先预览打印布局，等我确认后再应用。请保留所有来源事实。';
 await prompt.fill(draft);
 const fits=()=>expect.poll(()=>prompt.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
 await fits();
 for(const viewport of [{width:390,height:844},{width:320,height:720},{width:1440,height:900}]) {
  await page.setViewportSize(viewport);await fits();await expect(prompt).toHaveValue(draft);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 }
 await page.locator('[data-ai-resize]').press('Home');await fits();await expect(prompt).toHaveValue(draft);
 await page.locator('[data-ai-resize]').press('End');await fits();await expect(prompt).toHaveValue(draft);
});
