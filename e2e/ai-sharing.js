import {expect} from './studio-v3-test.js';
export async function openSharing(page) {
  const settings=page.locator('.ai-settings'),sharing=page.locator('.ai-sharing');
  if(!await settings.evaluate(node=>node.open))await settings.locator(':scope > summary').click();
  if(!await sharing.evaluate(node=>node.open))await sharing.locator(':scope > summary').click();
  await expect(sharing).toBeVisible();
}
export async function closeSharing(page) {
  await openSharing(page);
  await page.locator('.ai-sharing>summary').click();
  await expect(page.locator('.ai-sharing')).not.toHaveAttribute('open','');
}
export async function closeSettings(page) {
  const settings=page.locator('.ai-settings');
  if(await settings.evaluate(node=>node.open))await settings.locator(':scope > summary').click();
  await expect(settings).not.toHaveAttribute('open','');
}
