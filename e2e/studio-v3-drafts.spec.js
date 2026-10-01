import { test, expect } from '@playwright/test';
const frame = page => page.frameLocator('#preview-frame');
const label = page => page.getByLabel('Label',{exact:true});
const choice = (page,value) => page.locator(`[data-draft-choice=${value}]`).click();
async function ready(page) { await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000}); }
test.beforeEach(async ({page}) => {page.on('dialog',d=>d.accept());await page.goto('/studio-v3/');await ready(page);});

test('P0 Item code label → Qty: Stay retains focus, Apply commits and Discard restores; history is correct', async ({page},info) => {
  await page.locator('#left-panel [data-select=items-sku]').click();
  await label(page).fill('Client stock code');
  await expect(page.locator('#draft-state')).toContainText('1 unapplied');
  await expect(page.locator('#revision')).not.toContainText('unsaved template');
  await page.locator('#left-panel [data-select=items-quantity]').click();
  await expect(page.locator('#draft-dialog')).toBeVisible();
  await expect(label(page)).toHaveValue('Client stock code');
  await page.screenshot({path:info.outputPath('P0-draft-guard.png')});
  await choice(page,'stay'); await expect(label(page)).toHaveValue('Client stock code');await expect(label(page)).toBeFocused();
  await page.locator('#left-panel [data-select=items-quantity]').click(); await choice(page,'apply');
  await expect(label(page)).toHaveValue('Qty'); await ready(page);
  await expect(frame(page).locator('.prowheader_processed th').first().locator('..').locator('th').nth(1)).toHaveText('Client stock code');
  await expect(page.locator('#draft-state')).toHaveText('No unapplied edits');
  await expect(page.locator('#revision')).toContainText('unsaved template');
  await page.locator('[data-action=undo]').click(); await ready(page);
  await expect(frame(page).locator('.prowheader_processed').first().locator('th').nth(1)).toHaveText('Item code');
  await page.locator('[data-action=redo]').click(); await ready(page);
  await expect(frame(page).locator('.prowheader_processed').first().locator('th').nth(1)).toHaveText('Client stock code');
  await label(page).fill('Discarded units'); await page.locator('[data-mode=data]').click(); await choice(page,'discard');
  await expect(page.locator('#database-workbench')).toBeVisible();
  await page.locator('[data-mode=design]').click();
  await expect(label(page)).toHaveValue('Qty');
  await page.screenshot({path:info.outputPath('P0-applied-label.png')});
});

test('workspace, Open, New and Escape retain unapplied values until an explicit choice', async ({page}) => {
  await page.locator('#left-panel [data-select=items-sku]').click(); await label(page).fill('Kept draft');
  for (const target of ['[data-mode=data]','[data-action=open]','[data-action=new]','#right-panel [data-action=remove-field]','[data-action=print]']) {
    await page.locator(target).click(); await expect(page.locator('#draft-dialog')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('#draft-dialog')).toBeHidden();
    await expect(label(page)).toHaveValue('Kept draft'); await expect(label(page)).toBeFocused();
  }
  await page.locator('[data-mode=data]').click(); await choice(page,'apply'); await ready(page);
  await expect(page.locator('#database-workbench')).toBeVisible();
  await page.locator('[data-mode=design]').click(); await expect(label(page)).toHaveValue('Kept draft');
});

test('invalid JSON preserves input and blocks both commit and guarded transitions', async ({page}) => {
  await page.locator('[data-mode=data]').click();
  await page.locator('#database-workbench [data-db-group=json]').click();
  const revision = await page.locator('#revision').innerText(), invalid = '{"items": [}';
  await page.locator('#data-json').fill(invalid); await page.getByRole('button',{name:'Apply JSON data',exact:true}).click();
  await expect(page.locator('#data-json')).toHaveValue(invalid); await expect(page.locator('#revision')).toHaveText(revision);
  await page.locator('[data-mode=design]').click(); await choice(page,'apply');
  await expect(page.locator('[data-mode=data]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#data-json')).toHaveValue(invalid); await expect(page.locator('#revision')).toHaveText(revision);
  await page.locator('[data-mode=design]').click(); await choice(page,'discard');
  await expect(page.locator('[data-mode=design]')).toHaveAttribute('aria-current','page');
});
