import {test,expect} from '@playwright/test';
async function expectToolbarFits(page) {
  const geometry=await page.locator('.paper-toolbar').evaluate(toolbar=>({toolbarWidth:toolbar.clientWidth,toolbarScrollWidth:toolbar.scrollWidth,documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,nextRight:toolbar.querySelector('[data-action=next]').getBoundingClientRect().right,buttons:[...toolbar.querySelectorAll('button')].filter(button=>button.getClientRects().length).map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height}))}));
  expect(geometry.toolbarScrollWidth).toBeLessThanOrEqual(geometry.toolbarWidth);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.nextRight).toBeLessThanOrEqual(geometry.viewportWidth);
  for (const button of geometry.buttons) { expect(button.width).toBeGreaterThanOrEqual(40); expect(button.height).toBeGreaterThanOrEqual(44); }
}
for (const [width,height] of [[390,844],[360,640]]) {
  test(`mobile paper-first shell ${width}x${height}`,async({page},info)=> {
    await page.setViewportSize({width,height});
    let releaseApp; const appGate=new Promise(resolve=>{releaseApp=resolve;});
    await page.route('**/studio-v3/app.js',async route=>{await appGate; await route.continue();});
    await page.goto('/studio-v3/',{waitUntil:'commit'});
    await page.locator('.paper-toolbar').waitFor({state:'attached'});
    try {
      await expect(page.locator('.paper-toolbar')).toHaveCSS('height','52px');
      await expect(page.locator('#page-count')).not.toHaveAttribute('aria-label',/.+/);
      await expectToolbarFits(page);
    } finally { releaseApp(); }
    await expect(page.locator('body')).toHaveAttribute('aria-busy','false');
    await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
    await expectToolbarFits(page);
    for (const selector of ['.app-header','.workspace-bar','.paper-toolbar']) expect((await page.locator(selector).boundingBox()).height).toBeLessThanOrEqual(52);
    expect((await page.locator('.status-bar').boundingBox()).height).toBeLessThanOrEqual(32);
    expect((await page.locator('#paper-scroll').boundingBox()).height).toBeGreaterThanOrEqual(height*.6);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const more=page.getByRole('button',{name:'More actions',exact:true}), menu=page.locator('#mobile-actions');
    await more.click(); await expect(more).toHaveAttribute('aria-expanded','true');
    for (const name of ['New','Open','Save with source','HTML with source','Share copy…','Preview','Check for updates']) await expect(menu.getByRole('button',{name,exact:true})).toBeVisible();
    await page.keyboard.press('Escape'); await expect(menu).toBeHidden(); await expect(more).toBeFocused();
    await more.click(); await menu.getByRole('button',{name:'New',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Start a print form'})).toBeVisible(); await expect(menu).toBeHidden();
    await page.locator('[data-action=cancel-new]').click();
    const fab=page.getByRole('button',{name:'AI editor',exact:true}); await expect(fab).toBeVisible();
    expect((await fab.boundingBox()).width).toBe(56); await fab.click(); await expect(page.locator('#ai-panel')).toBeVisible(); await expect(fab).toBeHidden();
    await page.locator('[data-ai=close]').click(); await expect(fab).toBeVisible();
    const pages=page.getByRole('button',{name:'Toggle page thumbnails'});
    await expect(pages).toHaveAttribute('aria-expanded','false'); await expect(page.locator('#thumbnails')).toBeHidden();
    await pages.click(); await expect(pages).toHaveAttribute('aria-expanded','true'); await expect(page.locator('#thumbnails')).toBeVisible();
    await pages.click(); await expect(page.locator('#thumbnails')).toBeHidden();
    await more.click(); await page.locator('#paper-scroll').click({position:{x:4,y:4}}); await expect(menu).toBeHidden(); await expect(more).toBeFocused();
    await page.screenshot({path:info.outputPath(`mobile-shell-${width}.png`)});
  });
}
test('desktop preserves header and workspace controls',async({page},info)=> {
  await page.setViewportSize({width:1440,height:900}); await page.goto('/studio-v3/'); await expect(page.locator('body')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#mobile-more')).toBeHidden(); await expect(page.locator('#mobile-actions')).toBeHidden();
  for (const action of ['new','open','save','export','share','undo','redo','print']) await expect(page.locator(`.header-actions [data-action=${action}]`)).toBeVisible();
  await expect(page.locator('.workspace-bar [data-ai-toggle]')).toBeVisible();
  expect(await page.locator('[data-ai-toggle]').evaluate(node=>getComputedStyle(node).position)).not.toBe('fixed');
  await expect(page.locator('.workspace-bar [data-action=preview]')).toBeVisible(); await expect(page.locator('#draft-state')).toBeVisible();
  await expect(page.locator('.status-bar #update-button')).toBeVisible(); await expect(page.locator('#thumbnails')).toBeVisible();
  await page.screenshot({path:info.outputPath('desktop-shell.png')});
});
