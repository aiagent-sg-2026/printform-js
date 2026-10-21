import {test,expect} from '@playwright/test';
async function expectToolbarFits(page,{rendering=false}={}) {
  const geometry=await page.locator('.paper-toolbar').evaluate((toolbar,rendering)=>{
    const label=toolbar.querySelector('#page-count'), html=label.innerHTML, accessibleName=label.getAttribute('aria-label');
    try {
      if (rendering) { label.textContent='Rendering…'; label.removeAttribute('aria-label'); }
      return {labelText:label.textContent,toolbarWidth:toolbar.clientWidth,toolbarScrollWidth:toolbar.scrollWidth,documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,nextRight:toolbar.querySelector('[data-action=next]').getBoundingClientRect().right,buttons:[...toolbar.querySelectorAll('button')].filter(button=>button.getClientRects().length).map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height}))};
    } finally {
      if (rendering) { label.innerHTML=html; if (accessibleName===null) label.removeAttribute('aria-label'); else label.setAttribute('aria-label',accessibleName); }
    }
  },rendering);
  if (rendering) expect(geometry.labelText).toBe('Rendering…');
  expect(geometry.toolbarScrollWidth).toBeLessThanOrEqual(geometry.toolbarWidth);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.nextRight).toBeLessThanOrEqual(geometry.viewportWidth);
  for (const button of geometry.buttons) { expect(button.width).toBeGreaterThanOrEqual(40); expect(button.height).toBeGreaterThanOrEqual(44); }
}
for (const [width,height] of [[390,844],[360,640]]) {
  test(`mobile paper-first shell ${width}x${height}`,async({page},info)=> {
    await page.setViewportSize({width,height});
    await page.goto('/studio-v3/');
    await expect(page.locator('body')).toHaveAttribute('aria-busy','false');
    await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
    await expect(page.locator('.paper-toolbar')).toHaveCSS('height','52px');
    // Measure the initial label synchronously so completed renders cannot race the geometry check.
    await expectToolbarFits(page,{rendering:true});
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
    await more.click(); const paper=await page.locator('#preview-frame').boundingBox();
    await page.locator('#mobile-menu-backdrop').click({position:{x:paper.x+paper.width/2,y:Math.min(paper.y+paper.height/2,height-60)}});
    await expect(menu).toBeHidden(); await expect(more).toBeFocused(); await expect(page.locator('#mobile-menu-backdrop')).toBeHidden();
    await page.locator('[data-mode=data]').click(); await expect(page.locator('#database-workbench')).toBeVisible();
    await page.locator('#database-workbench [data-db-action=preview]').click(); await expect(page.locator('#database-workbench')).toBeHidden();
    await expect(page.locator('#show-database')).toBeVisible(); await expect(page.locator('#show-database')).toHaveAccessibleName('Sample database'); await expectToolbarFits(page);
    await expect(pages).toBeHidden();
    await page.locator('#show-database').click(); await expect(page.locator('#database-workbench')).toBeVisible();
    await page.locator('[data-mode=design]').click(); await expect(pages).toBeVisible(); await pages.click(); await expect(pages).toHaveAttribute('aria-expanded','true'); await pages.click();
    await page.screenshot({path:info.outputPath(`mobile-shell-${width}.png`)});
  });
}
test('desktop preserves header and workspace controls',async({page},info)=> {
  await page.setViewportSize({width:1440,height:900}); await page.goto('/studio-v3/'); await expect(page.locator('body')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#mobile-more')).toBeHidden(); await expect(page.locator('#mobile-actions')).toBeHidden();
  await expect(page.locator('#mobile-menu-backdrop')).toBeHidden();
  for (const action of ['new','open','save','export','share','undo','redo','print']) await expect(page.locator(`.header-actions [data-action=${action}]`)).toBeVisible();
  await expect(page.locator('.workspace-bar [data-ai-toggle]')).toBeVisible();
  expect(await page.locator('[data-ai-toggle]').evaluate(node=>getComputedStyle(node).position)).not.toBe('fixed');
  await expect(page.locator('.workspace-bar [data-action=preview]')).toBeVisible(); await expect(page.locator('#draft-state')).toBeVisible();
  await expect(page.locator('.status-bar #update-button')).toBeVisible(); await expect(page.locator('#thumbnails')).toBeVisible();
  await page.screenshot({path:info.outputPath('desktop-shell.png')});
});
