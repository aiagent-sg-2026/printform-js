import { test, expect } from './studio-v3-test.js';
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function open(page,size) {
  await page.setViewportSize(size);await page.goto('/studio-v3/');await ready(page);
  await page.locator('[data-ai-toggle]').click();await expect(page.locator('.ai-welcome')).toBeVisible();
}
for(const size of [{width:1440,height:900},{width:1024,height:768},{width:390,height:844},{width:400,height:800}]) {
  test(`${size.width}×${size.height}: one attachment action, readable starting tasks and an anchored composer`,async({page})=> {
    await open(page,size);
    await expect(page.locator('[data-ai=attach]')).toHaveCount(1);
    await expect(page.locator('#ai-prompt')).toBeInViewport({ratio:1});
    await expect(page.locator('[data-ai-send-reason]')).toHaveAttribute('data-kind','notice');
    await expect(page.locator('[data-ai-send-reason]')).toBeInViewport({ratio:1});
    const chips=page.locator('[data-ai=prompt]');expect(await chips.count()).toBeGreaterThanOrEqual(3);
    for(const chip of await chips.all()) {
      await chip.scrollIntoViewIfNeeded();await expect(chip).toBeInViewport({ratio:1});
      const target=await chip.getAttribute('data-prompt');await chip.click();await expect(page.locator('#ai-prompt')).toHaveValue(target);
      await expect(page.locator('.ai-user')).toHaveCount(0);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
test('the single attachment action is keyboard-operable and opens the native multiple picker',async({page})=> {
  await open(page,{width:1440,height:900});const plus=page.locator('[data-ai=attach]');
  await plus.focus();const chooser=page.waitForEvent('filechooser');await page.keyboard.press('Enter');
  expect((await chooser).isMultiple()).toBe(true);
});
test('sharing remains explicit and unchecked after expanding and closing its disclosure',async({page})=> {
  await open(page,{width:390,height:844});
  await page.locator('.ai-sharing>summary').click();
  for(const selector of ['#ai-observation-text','#ai-observation-pixels']) {
    await expect(page.locator(selector)).toBeVisible();await expect(page.locator(selector)).not.toBeChecked();
  }
  await page.locator('.ai-sharing>summary').click();
  await expect(page.locator('#ai-observation-text')).not.toBeChecked();await expect(page.locator('#ai-observation-pixels')).not.toBeChecked();
});
test('Escape closes settings first and returns focus before closing the phone panel',async({page})=> {
  await open(page,{width:390,height:844});const settings=page.locator('.ai-settings>summary');await settings.click();
  await page.keyboard.press('Escape');await expect(settings).toBeFocused();await expect(page.locator('#ai-panel')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#ai-panel')).toBeHidden();
});
