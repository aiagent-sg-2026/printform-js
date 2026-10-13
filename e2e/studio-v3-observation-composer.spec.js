import {test,expect} from './studio-v3-test.js';
import fs from 'node:fs/promises';

for (const viewport of [{width:1280,height:720},{width:1024,height:768},{width:390,height:844},{width:320,height:568}]) {
  test(`observation permissions and referenced elements remain usable at ${viewport.width}x${viewport.height}`,async({page},info)=> {
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://gpt.yapweijun1996.com/**',route=>route.abort());
    await page.setViewportSize({width:1280,height:720});
    await page.goto('/studio-v3/');await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
    await expect(page.locator('#ai-panel')).toBeHidden();
    await page.locator('.paper-toolbar [data-ai-add]').click();
    await page.setViewportSize(viewport);
    const tags=page.locator('[data-ai-element-tags]'),permissions=page.locator('.ai-observation-disclosure');
    await expect(tags).toBeVisible();await expect(permissions).toBeVisible();
    await expect(page.locator('#ai-scope')).toHaveValue('selected');
    await expect(page.locator('#ai-observation-text')).not.toBeChecked();
    await expect(page.locator('#ai-observation-pixels')).not.toBeChecked();
    const measure=()=>page.evaluate(()=>Object.fromEntries(['#ai-panel','.ai-heading','[data-ai-log]','.ai-composer','.ai-observation-disclosure','[data-ai-element-tags]','.ai-input','[data-ai-send-reason]'].map(selector=>{
      const node=document.querySelector(selector),r=node.getBoundingClientRect();return [selector,{x:r.x,y:r.y,width:r.width,height:r.height,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,scrollTop:node.scrollTop}];
    })));
    const before=await measure();expect(before['[data-ai-element-tags]'].height).toBeGreaterThanOrEqual(24);
    expect(before['.ai-observation-disclosure'].height).toBeGreaterThanOrEqual(48);
    const frames=[];
    for(const fraction of [0,.5,1]) {
      await permissions.evaluate((node,fraction)=>node.scrollTop=(node.scrollHeight-node.clientHeight)*fraction,fraction);
      frames.push(await measure());
      await expect(page.locator('#ai-prompt')).toBeInViewport({ratio:1});await expect(page.locator('[data-ai-send]')).toBeInViewport({ratio:1});
      await expect(page.locator('[data-ai=close]')).toBeInViewport({ratio:1});
    }
    await page.locator('#ai-observation-text').check();await page.locator('#ai-observation-pixels').check();
    await expect(page.locator('#ai-observation-text')).toBeChecked();await expect(page.locator('#ai-observation-pixels')).toBeChecked();
    await page.locator('#ai-observation-pixels').uncheck();await page.locator('#ai-observation-text').uncheck();
    const comment=page.locator('[data-ai-tag-comment]').first();await comment.fill('Use a readable heading.');await expect(comment).toBeFocused();
    await page.locator('#ai-prompt').fill('Keep the selected typography readable.');
    await expect(page.locator('#ai-prompt')).toBeFocused();await expect(page.locator('[data-ai-send]')).toBeInViewport({ratio:1});
    await tags.locator('[data-ai-tag-action=remove]').click();await expect(tags).toBeHidden();await expect(page.locator('#ai-scope')).toHaveValue('whole');
    for(const frame of frames){expect(frame['.ai-heading'].y).toBe(before['.ai-heading'].y);expect(frame['.ai-input'].y).toBe(before['.ai-input'].y);}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('composer-open.png')});
    await page.locator('[data-ai=close]').click();await expect(page.locator('#ai-panel')).toBeHidden();
    await page.screenshot({path:info.outputPath('composer-closed.png')});
    await page.locator('[data-ai-toggle]').click();await expect(page.locator('#ai-panel')).toBeVisible();
    await expect(page.locator('#ai-prompt')).toHaveValue('Keep the selected typography readable.');
    await expect(page.locator('#ai-observation-text')).not.toBeChecked();await expect(page.locator('#ai-observation-pixels')).not.toBeChecked();
    await page.locator('[data-ai=close]').click();expect(errors).toEqual([]);
    const evidence=info.outputPath('composer-layout.json');await fs.writeFile(evidence,JSON.stringify({viewport,browser:info.project.name,before,frames}));await info.attach('composer-layout',{path:evidence,contentType:'application/json'});
  });
}
