import {test,expect} from '@playwright/test';
import {upgradeServer,OLD,NEXT} from './studio-v3-upgrade-server.js';
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const version = (page,value)=>expect(page.locator('#app-version')).toHaveText(`v3 · ${value.slice(0,12)}`);
async function controlled(page) { await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller)); }
async function open(page,url) { await page.goto(url); await ready(page); await controlled(page); }
async function offer(page) {
  if(!(await page.locator('#update-button').textContent()).startsWith('Update to')) await page.locator('#update-button').click();
  await expect(page.locator('#update-button')).toHaveText(`Update to ${NEXT.slice(0,12)}`,{timeout:30000});
  if(await page.locator('#update-dialog').isVisible())await page.locator('[data-update-choice=stay]').click();
  await expect(page.locator('#update-button')).toBeEnabled();
}
async function choose(page,value) { await page.locator('#update-button').click(); await expect(page.locator('#update-dialog')).toBeVisible(); await page.locator(`[data-update-choice=${value}]`).click(); }

for (const [name,width,height] of [['desktop',1440,900],['tablet',768,1024],['mobile',390,844]]) {
  test(`two real builds: ${name} protects work offline, keeps drafts/history/data/zoom on update and leaves another tab open`,async({page,context},info)=> {
    const server = await upgradeServer(); const other = await context.newPage();
    try {
      await page.setViewportSize({width,height}); page.on('dialog',dialog=>dialog.accept());
      await open(page,server.url); await open(other,server.url); await version(page,OLD);
      const data = await page.evaluate(async()=> {
        const db = await new Promise(resolve=> { const r=indexedDB.open('printform-studio-v3-demo-db');r.onsuccess=()=>resolve(r.result); });
        return new Promise(resolve=> { const r=db.transaction('datasets').objectStore('datasets').getAll();r.onsuccess=()=> { db.close();resolve(r.result); }; });
      });
      await page.locator('#zoom').selectOption('0.75');
      if (width <= 900) await page.locator('.paper-toolbar [data-layout=structure]').click();
      await page.locator('#left-panel [data-select=items-sku]').click();
      await page.getByLabel('Label',{exact:true}).fill('Synthetic saved heading');
      await page.getByRole('button',{name:'Apply field',exact:true}).click(); await ready(page);
      await page.getByLabel('Label',{exact:true}).fill('Synthetic unapplied heading');
      if (width <= 900) await page.keyboard.press('Escape');
      const revision = await page.locator('#revision').textContent();
      server.publish(); await offer(page); await version(page,OLD);
      await choose(page,'stay'); await expect(page.getByLabel('Label',{exact:true})).toHaveValue('Synthetic unapplied heading');
      await page.locator('#update-button').click(); await page.keyboard.press('Escape'); await version(page,OLD);
      await page.locator('#update-button').click(); await context.setOffline(true);
      await page.locator('[data-update-choice=keep]').click(); await ready(page); await version(page,OLD);
      await expect(page.locator('#update-status')).toContainText('Reconnect');
      await expect(page.getByLabel('Label',{exact:true})).toHaveValue('Synthetic unapplied heading');
      await context.setOffline(false); await choose(page,'keep'); await ready(page); await version(page,NEXT);
      expect(await page.evaluate(()=>globalThis.__upgradeFixtureBuild)).toBe(NEXT);
      await expect(page.locator('#revision')).toHaveText(revision); await expect(page.locator('#zoom')).toHaveValue('0.75');
      await expect(page.locator('#draft-state')).toContainText('1 unapplied');
      await expect(page.getByLabel('Label',{exact:true})).toHaveValue('Synthetic unapplied heading');
      expect(await page.evaluate(()=>sessionStorage.getItem('printform-studio-v3:update-recovery'))).toBeNull();
      await page.screenshot({path:info.outputPath(`upgrade-${name}.png`)});
      await page.locator('[data-action=undo]').click(); await page.locator('[data-draft-choice=discard]').click(); await ready(page);
      await expect(page.frameLocator('#preview-frame').locator('.prowheader_processed').first().locator('th').nth(1)).toHaveText('Item code');
      await version(other,OLD); await expect(other.locator('#revision')).toHaveText('r0');
      expect(await other.evaluate(()=>globalThis.__upgradeFixtureBuild)).toBe(OLD);
      await context.setOffline(true);
      if (!await other.locator('[data-action=rerender]').isVisible()) await other.locator('details.quality-panel summary').click();
      await other.locator('[data-action=rerender]').click(); await ready(other);
      await expect(other.locator('#update-button')).toHaveText(`Update to ${NEXT.slice(0,12)}`);
      await context.setOffline(false);
      const after = await page.evaluate(async()=> {
        const db=await new Promise(resolve=> { const r=indexedDB.open('printform-studio-v3-demo-db');r.onsuccess=()=>resolve(r.result); });
        return new Promise(resolve=> { const r=db.transaction('datasets').objectStore('datasets').getAll();r.onsuccess=()=> { db.close();resolve(r.result); }; });
      }); expect(after).toEqual(data);
      const resourcePaths = await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>new URL(entry.name).pathname));
      expect(resourcePaths.filter(p=>p.includes('/releases/')).every(p=>p.includes(NEXT))).toBe(true);
    } finally { await context.setOffline(false); await other.close(); await server.close(); }
  });
}

test('failed integrity download and offline check retain old build; explicit discard never deletes saved datasets',async({page,context})=> {
  const server=await upgradeServer();
  try {
    await open(page,server.url); server.publish({broken:true}); await page.locator('#update-button').click();
    await version(page,OLD); await expect(page.locator('#update-button')).toHaveText('Check for updates');
    await context.setOffline(true); await page.locator('#update-button').click(); await version(page,OLD); await ready(page);
    await context.setOffline(false); server.publish(); await offer(page);
    await choose(page,'discard'); await version(page,NEXT); await ready(page);
    expect(await page.evaluate(()=>sessionStorage.getItem('printform-studio-v3:update-recovery'))).toBeNull();
  } finally { await context.setOffline(false); await server.close(); }
});

test('mobile viewport stays accessible: scale one, 16px inputs, keyboard update dialog and separate remembered paper zoom',async({page},info)=> {
  const server=await upgradeServer();
  try {
    await page.setViewportSize({width:430,height:932}); await open(page,server.url);
    const viewport=await page.locator('meta[name=viewport]').getAttribute('content');
    expect(viewport).toContain('initial-scale=1'); expect(viewport).not.toMatch(/maximum-scale|user-scalable/);
    await page.locator('#zoom').selectOption('width'); await page.reload(); await ready(page); await expect(page.locator('#zoom')).toHaveValue('width');
    await page.locator('[data-ai-toggle]').click(); await page.locator('#ai-prompt').fill('Fictional draft only');
    const inputs=await page.locator('input,select,textarea').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length && !['checkbox','color'].includes(n.type)).map(n=>parseFloat(getComputedStyle(n).fontSize)));
    expect(inputs.every(size=>size>=16)).toBe(true); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('[data-ai=close]').click(); server.publish(); await offer(page);
    await page.locator('#update-button').focus(); await page.keyboard.press('Enter'); await expect(page.locator('[data-update-choice=stay]')).toBeFocused();
    await page.keyboard.press('Escape'); await expect(page.locator('#update-button')).toBeFocused();
    await page.screenshot({path:info.outputPath('mobile-accessible-update.png')});
  } finally { await server.close(); }
});
