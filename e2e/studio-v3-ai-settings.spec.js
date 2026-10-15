import { test, expect } from './studio-v3-test.js';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function openMenu(page) {
  await page.goto('/studio-v3/'); await ready(page);
  await page.locator('[data-ai-toggle]').click();
  await page.locator('.ai-settings > summary').click();
  await expect(page.locator('.ai-settings-body')).toBeVisible();
}


test('Escape and an outside click close the menu; the panel stays until the next Escape',async({page})=> {
  await openMenu(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ai-settings-body')).toBeHidden(); await expect(page.locator('#ai-panel')).toBeVisible();
  await page.locator('.ai-settings > summary').click(); await expect(page.locator('.ai-settings-body')).toBeVisible();
  await page.locator('.ai-heading h2').click(); await expect(page.locator('.ai-settings-body')).toBeHidden();
  await page.locator('.ai-settings > summary').click(); await page.locator('#ai-model').focus();
  await page.keyboard.press('Escape'); await expect(page.locator('.ai-settings-body')).toBeHidden(); await expect(page.locator('#ai-panel')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#ai-panel')).toBeHidden();
  await page.locator('[data-ai-toggle]').click(); await expect(page.locator('.ai-settings-body')).toBeHidden();
});
