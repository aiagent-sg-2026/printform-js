import {expect} from '@playwright/test';

// Wait for the completed commit, not the transient ready proposal rendered before it.
export async function expectApplied(page,revision,options) {
  const card = page.locator('.ai-change-card').filter({has:page.getByRole('heading',{name:'Applied',exact:true})}).filter({has:page.locator(`[data-ai=undo][title="Undo Revision ${revision}"]`)});
  await expect(card).toBeVisible(options);
  await expect(page.locator('#revision')).toHaveText(new RegExp(`^r${revision}\\b`));
  await expect(card.locator('[data-ai=undo]')).toBeVisible();
  await expect(page.locator('[data-ai=apply]')).toHaveCount(0);
  await card.locator('details.ai-change-details>summary').click();
  await expect(card.locator('details.ai-change-details')).toHaveAttribute('open','');
  return card;
}
