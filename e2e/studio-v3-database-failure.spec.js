import { test, expect } from '@playwright/test';

const preview = page => page.frameLocator('#preview-frame').locator('[data-v3-id=customer-bill]').first();
async function ready(page) { await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000}); }
async function data(page) { await page.locator('[data-mode=data]').click(); await page.locator('[data-db-group=customer]').click(); }
test.setTimeout(60000);

for (const failure of ['disabled','blocked']) {
  test(`IndexedDB ${failure}: tab-only fallback is explicit and never promises reload persistence`, async ({page}) => {
    page.on('dialog',d=>d.accept());
    await page.addInitScript(kind => {
      if (kind === 'disabled') Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});
      else Object.defineProperty(window,'indexedDB',{value:{open:()=> {
        const request = {}; queueMicrotask(()=>request.onblocked?.()); return request;
      }},configurable:true});
    },failure);
    await page.goto('/studio-v3/'); await ready(page); await data(page);
    await expect(page.locator('#database-workbench')).toContainText('Storage unavailable · this tab only');
    await page.getByLabel('/customer/name',{exact:true}).fill('Tab-only demo');
    await page.locator('[data-db-action=copy]').click(); await ready(page);
    await expect(preview(page)).toHaveText('Tab-only demo');
    await expect(page.locator('#database-notice')).toContainText('this tab only');
    await page.reload(); await ready(page);
    await expect(preview(page)).toHaveText('Sterling Manufacturing Sdn. Bhd.');
  });
}

for (const failure of ['QuotaExceededError','UnknownError']) {
  test(`${failure}: database transaction rolls back record and selection; unapplied draft remains`, async ({page}) => {
    page.on('dialog',d=>d.accept()); await page.goto('/studio-v3/'); await ready(page); await data(page);
    const initial = await page.evaluate(() => new Promise(resolve => {
      const request = indexedDB.open('printform-studio-v3-demo-db'); request.onsuccess = () => {
        const db = request.result, tx = db.transaction('datasets'), all = tx.objectStore('datasets').getAll();
        all.onsuccess = ()=> {resolve(all.result);db.close();};
      };
    }));
    await page.evaluate(name => {
      window.originalDatasetPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(...args) {
        if (this.name === 'preferences' && this.transaction.db.name === 'printform-studio-v3-demo-db') throw new DOMException('Simulated storage write failure',name);
        return window.originalDatasetPut.apply(this,args);
      };
    },failure);
    await page.getByLabel('/customer/name',{exact:true}).fill('Unapplied failure draft');
    const revision = await page.locator('#revision').innerText(); await page.locator('[data-db-action=copy]').click();
    await expect(page.locator('#database-notice')).toContainText(failure === 'QuotaExceededError' ? 'storage is full' : 'not saved');
    await expect(page.locator('#revision')).toHaveText(revision);
    await expect(preview(page)).toHaveText('Sterling Manufacturing Sdn. Bhd.');
    await expect(page.getByLabel('/customer/name',{exact:true})).toHaveValue('Unapplied failure draft');
    const stored = await page.evaluate(() => new Promise(resolve => {
      IDBObjectStore.prototype.put = window.originalDatasetPut;
      const request = indexedDB.open('printform-studio-v3-demo-db'); request.onsuccess = () => {
        const db = request.result, tx = db.transaction(['datasets','preferences']);
        let all, selected;
        const a = tx.objectStore('datasets').getAll(), b = tx.objectStore('preferences').get('active:invoice');
        a.onsuccess=()=>{all=a.result;};b.onsuccess=()=>{selected=b.result;};
        tx.oncomplete=()=>{resolve({all,selected});db.close();};
      };
    }));
    expect(stored.all).toEqual(initial); expect(stored.selected).toBeUndefined();
    await page.locator('[data-db-action=copy]').click(); await ready(page);
    await expect(preview(page)).toHaveText('Unapplied failure draft');
  });
}
