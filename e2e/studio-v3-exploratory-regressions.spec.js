import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});test.setTimeout(90000);
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
test('remembered quotation data never silently becomes an invoice on reload or New',async({page})=>{
 await page.goto('/studio-v3/');await ready(page);await page.locator('[data-action=new]').click();
 await page.getByText('Business demo templates',{exact:true}).click();await page.locator('[data-demo-template=SalesQuotation]').click();await ready(page);
 await page.locator('[data-mode=data]').click();await page.locator('#database-choice').selectOption('demo:SalesQuotation:canopy');await ready(page);
 await page.reload();await ready(page);
 const paper=page.frameLocator('#preview-frame');await expect(paper.locator('[data-v3-id=header-title]').first()).toHaveText('INVOICE');
 await expect(paper.locator('[data-v3-id=header-number]').first()).toContainText('INV-');
 await expect(paper.locator('#pf-mount')).not.toContainText('SQ-DEMO-2026-CANOPY');
 await page.locator('[data-action=new]').click();await page.locator('[data-template=invoice]').click();await ready(page);
 await expect(paper.locator('[data-v3-id=header-number]').first()).toContainText('INV-');
 await page.locator('[data-mode=data]').click();expect((await page.locator('#database-choice option').allTextContents()).some(text=>text.includes('Sales quotation'))).toBe(false);
});
test('expanded template chooser keeps Cancel visible and page navigation wraps as one group',async({page},info)=>{
 for(const size of [{width:1180,height:757},{width:768,height:1024},{width:390,height:844}]) {
  await page.setViewportSize(size);await page.goto('/studio-v3/');await ready(page);
  const previous=await page.getByRole('button',{name:'Previous page',exact:true}).boundingBox(),next=await page.getByRole('button',{name:'Next page',exact:true}).boundingBox();
  expect(Math.abs(previous.y-next.y)).toBeLessThan(2);
  await page.locator('[data-action=new]').click();await page.getByText('Business demo templates',{exact:true}).click();
  await expect(page.locator('[data-action=cancel-new]')).toBeInViewport({ratio:1});
  const bounds=await page.locator('#new-dialog').boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(size.height);
  await page.screenshot({path:info.outputPath(`template-chooser-${size.width}.png`)});
  await page.locator('[data-action=cancel-new]').click();await expect(page.locator('#new-dialog')).not.toBeVisible();
 }
});
test('page navigation disables unavailable directions at first, last, and single-page boundaries',async({page})=>{
 await page.goto('/studio-v3/');await ready(page);
 const previous=page.getByRole('button',{name:'Previous page',exact:true}),next=page.getByRole('button',{name:'Next page',exact:true});
 const thumbnails=page.locator('[data-page]');const count=await thumbnails.count();expect(count).toBeGreaterThan(1);
 await expect(previous).toBeDisabled();await expect(next).toBeEnabled();await expect(page.locator('#page-count')).toHaveText(`Page 1 / ${count}`);
 for(let index=1;index<count;index++)await next.click();
 await expect(next).toBeDisabled();await expect(previous).toBeEnabled();await expect(page.locator('#page-count')).toHaveText(`Page ${count} / ${count}`);
 await expect(thumbnails.last()).toHaveAttribute('aria-current','page');
 await previous.click();await expect(next).toBeEnabled();
 await thumbnails.first().click();await expect(previous).toBeDisabled();await expect(page.locator('#page-count')).toHaveText(`Page 1 / ${count}`);
 await page.locator('[data-mode=validate]').click();const before=await page.locator('#revision').textContent();await page.locator('[data-sample="1"]').click();
 await expect(page.locator('#revision')).not.toHaveText(before);await ready(page);
 await expect(page.locator('#page-count')).toHaveText('Page 1 / 1');await expect(previous).toBeDisabled();await expect(next).toBeDisabled();
});
