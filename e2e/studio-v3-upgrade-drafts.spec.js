import { isInference, responsesReply } from './demo-gateway-fixture.js';
import {test,expect} from '@playwright/test';
import {AGENT_KEY} from '../studio-v3/agent-preference.js';
import { keepStructureOpen } from './studio-v3-structure.js';
import {upgradeServer,NEXT} from './studio-v3-upgrade-server.js';
import {newProject} from '../studio-v3/model.js';
import {saveProject} from '../studio-v3/file-io.js';
// These specs run a fake gateway that only knows single-step replies, so working in steps starts switched off.
test.beforeEach(async({page})=> { await page.addInitScript(key=> { try { localStorage.setItem(key,'off'); } catch { /* storage may be blocked */ } },AGENT_KEY); });
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function start(page,server) {page.on('dialog',d=>d.accept());await keepStructureOpen(page);await page.goto(server.url);await ready(page);await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller));}
async function update(page,server) {
  // The check finds the build and, because work is unsaved, the approval dialog opens by itself.
  server.publish();await page.locator('#update-button').click();await expect(page.locator('#update-dialog')).toBeVisible({timeout:30000});
  await page.locator('[data-update-choice=keep]').click();
}
async function demoMock(page,reply) {
  // Keep real Service Workers enabled. Browser fetch interception cannot route
  // SW-initiated requests consistently across engines; this synthetic adapter
  // intercepts only the gateway URL before any request can leave the browser.
  await page.exposeFunction('demoFixture',reply);
  await page.addInitScript(()=> {
    const original=globalThis.fetch;
    globalThis.fetch=(input,options={})=> {
      const url=new URL(typeof input==='string'?input:input.url,location.href);
      if(url.origin!=='https://gpt.yapweijun1996.com')return original(input,options);
      const aborted=new Promise((_,reject)=> {if(options.signal?.aborted)reject(new DOMException('Cancelled','AbortError'));else options.signal?.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});});
      return Promise.race([globalThis.demoFixture(url.pathname).then(({body,status})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})),aborted]);
    };
  });
}
test('invalid JSON and typed table drafts survive update as unapplied values; no database write',async({page})=> {
  const server=await upgradeServer();
  try {
    await start(page,server);await page.locator('[data-mode=data]').click();
    await page.locator('#database-workbench [data-db-group=company]').click();await page.locator('[data-db-pointer="/company/name"]').fill('Fictional table draft');
    // JSON and table drafts can coexist through a non-destructive group change.
    await page.locator('#database-workbench [data-db-group=json]').click();
    await page.locator('#data-json').fill('{"items": [}');
    await update(page,server);await ready(page);await expect(page.locator('#app-version')).toContainText(NEXT.slice(0,12));
    await expect(page.locator('#data-json')).toHaveValue('{"items": [}');await expect(page.locator('#draft-state')).toContainText('2 unapplied');
    await page.locator('[data-mode=design]').click();await page.locator('[data-draft-choice=apply]').click();
    await expect(page.locator('#data-json')).toHaveValue('{"items": [}');await expect(page.locator('#revision')).toHaveText('r0');
    // Discard only JSON via its own action, keeping the recovered table draft.
    await page.locator('#database-workbench [data-action=cancel-draft]').click();
    await page.locator('#database-workbench [data-db-group=company]').click();await expect(page.locator('[data-db-pointer="/company/name"]')).toHaveValue('Fictional table draft');
    await page.locator('[data-mode=design]').click();await page.locator('[data-draft-choice=apply]').click();await ready(page);await expect(page.locator('#revision')).toContainText('r1');
    expect(await page.frameLocator('#preview-frame').locator('[data-v3-id=header-company]').first().textContent()).toContain('Fictional table draft');
  }finally{await server.close();}
});

for(const target of ['open-file','dataset-file']) {
  test(`pending ${target} read blocks snapshot and activation until native bytes settle`,async({page})=> {
    const server=await upgradeServer();
    try {
      await start(page,server);
      if(target==='dataset-file')await page.locator('[data-mode=data]').click();
      await page.evaluate(()=> {
        const original=File.prototype.arrayBuffer;let release;
        const held=new Promise(resolve=>release=resolve);
        globalThis.fixtureRead={bytesReady:false,settled:false};
        globalThis.fixtureController=navigator.serviceWorker.controller;
        globalThis.finishFixtureRead=()=>{File.prototype.arrayBuffer=original;release();};
        File.prototype.arrayBuffer=async function(){
          const bytes=await original.call(this);globalThis.fixtureRead.bytesReady=true;
          await held;globalThis.fixtureRead.settled=true;return bytes;
        };
      });
      const project=newProject();project.manifest.title='Fictional delayed import';project.sampleData.items[0].sku='FICTIONAL-NATIVE-READ';
      await page.locator(`#${target}`).setInputFiles({name:target==='open-file'?'fictional.printform.json':'fictional-dataset.json',mimeType:'application/json',buffer:Buffer.from(target==='open-file'?saveProject(project):JSON.stringify(project.sampleData))});
      await expect.poll(()=>page.evaluate(()=>globalThis.fixtureRead.bytesReady)).toBe(true);
      const updateStatus=await page.locator('#update-status').innerText();
      server.publish();await page.locator('#update-button').click();
      await expect(page.locator('#update-status')).not.toHaveText(updateStatus);await expect(page.locator('#update-button')).toBeEnabled();
      await expect(page.locator('#update-dialog')).toBeHidden();await expect(page.locator('#app-version')).toContainText('aaaaaaaaaaaa');
      expect(await page.evaluate(()=>({settled:globalThis.fixtureRead.settled,sameController:navigator.serviceWorker.controller===globalThis.fixtureController,backup:sessionStorage.getItem('printform-studio-v3:update-recovery')}))).toEqual({settled:false,sameController:true,backup:null});
      await expect(page.locator('#revision')).toHaveText('r0');
      await page.evaluate(()=>globalThis.finishFixtureRead());await ready(page);
      if(target==='open-file') {
        await expect(page.locator('#document-name')).toHaveValue('Fictional delayed import');
        await expect(page.frameLocator('#preview-frame').locator('.printform_page').first()).toContainText('FICTIONAL-NATIVE-READ');
        // Opening installs a clean r0 form. Add a real unapplied draft so Keep is an explicit choice.
        await page.locator('#left-panel [data-select=items-sku]').click();
        await page.getByLabel('Label',{exact:true}).fill('Fictional recovered label draft');
      }
      else {
        await expect(page.getByRole('heading',{name:'Review local CSV / JSON import'})).toBeVisible();
        await page.locator('#database-import-source').selectOption('/items');
        await page.getByLabel('Source for /sku',{exact:true}).selectOption('/sku');
        await expect(page.getByLabel('Source for /sku',{exact:true})).toContainText('FICTIONAL-NATIVE-READ');
        await expect(page.locator('[data-db-action=import-apply]')).toBeDisabled();
      }
      await expect(page.locator('#revision')).toHaveText('r0');
      expect(await page.evaluate(()=>({settled:globalThis.fixtureRead.settled,sameController:navigator.serviceWorker.controller===globalThis.fixtureController,backup:sessionStorage.getItem('printform-studio-v3:update-recovery')}))).toEqual({settled:true,sameController:true,backup:null});
      await page.locator('#update-button').click();await expect(page.locator('#update-dialog')).toBeVisible();
      await page.locator('[data-update-choice=keep]').click();await ready(page);await expect(page.locator('#app-version')).toContainText(NEXT.slice(0,12));
      await expect(page.locator('#revision')).toHaveText('r0');
      if(target==='open-file') {
        await expect(page.locator('#document-name')).toHaveValue('Fictional delayed import');
        await expect(page.getByLabel('Label',{exact:true})).toHaveValue('Fictional recovered label draft');
        await expect(page.frameLocator('#preview-frame').locator('.printform_page').first()).toContainText('FICTIONAL-NATIVE-READ');
      }
      else {
        await expect(page.getByRole('heading',{name:'Review local CSV / JSON import'})).toBeVisible();
        await expect(page.locator('.database-source')).toContainText('fictional-dataset.json');
        await expect(page.locator('#database-import-source')).toHaveValue('/items');
        await expect(page.getByLabel('Source for /sku',{exact:true})).toHaveValue('/sku');
        await expect(page.getByLabel('Source for /sku',{exact:true})).toContainText('FICTIONAL-NATIVE-READ');
        await expect(page.locator('[data-db-action=import-apply]')).toBeDisabled();
        await expect(page.getByRole('region',{name:'Reviewed import preview'})).toHaveCount(0);
      }
      expect(await page.evaluate(()=>sessionStorage.getItem('printform-studio-v3:update-recovery'))).toBeNull();
    }finally{await server.close();}
  });
}

test('AI conversation recovers without token or consent and old candidates remain expired',async({page})=> {
  const server=await upgradeServer();let calls=0;
  try {
    await demoMock(page,path=> {
      calls++;
      const body=path.endsWith('/session')?{token:'dmo_synthetic123456',expires_in:900}:path.endsWith('/models')?{data:[{id:'demo-fast'}]}:responsesReply({summary:'Fictional page margin proposal',operations:[{type:'set_page',patch:{margins:{top:12}}}]});
      return {status:path.endsWith('/session')?201:200,body};
    });
    await start(page,server);
    await page.locator('[data-ai-toggle]').click();await page.locator('#ai-prompt').fill('Set the top page margin to 12 mm.');await page.locator('[data-ai-send]').click();
    await expect(page.locator('[data-ai-proposal]')).toBeVisible();await page.locator('[data-ai=preview]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();
    await update(page,server);await expect(page.locator('#app-version')).toContainText(NEXT.slice(0,12));await ready(page);
    await expect(page.locator('#ai-prompt')).toHaveValue('');await expect(page.locator('[data-ai-log]')).toContainText('Set the top page margin to 12 mm.');await expect(page.locator('#ai-consent')).toHaveCount(0);
    await expect(page.locator('[data-ai-proposal]')).toHaveCount(0);await expect(page.locator('[data-ai=apply]')).toHaveCount(0);await expect(page.locator('[data-ai-log]')).toContainText('Expired');expect(calls).toBe(3);
    expect(await page.evaluate(()=>[...Object.keys(sessionStorage),...Object.keys(localStorage)].some(key=>/token|credential|demo-session/i.test(key)))).toBe(false);
    await expect(page.locator('[data-ai=preview]')).toHaveCount(0);await expect(page.locator('#revision')).toHaveText('r0');expect(calls).toBe(3);
  }finally{await server.close();}
});

test('pending AI request is cancelled only on confirmed update and never resumes after recovery',async({page})=> {
  const server=await upgradeServer();let release,requests=0;const held=new Promise(resolve=>release=resolve);
  try {
    await demoMock(page,async path=> {
      if (isInference(path)) {requests++;await held;return {status:500,body:{}};}
      return {status:path.endsWith('/session')?201:200,body:path.endsWith('/session')?{token:'dmo_synthetic123456',expires_in:900}:{data:[{id:'demo-fast'}]}};
    });
    await start(page,server);
    await page.locator('[data-ai-toggle]').click();await page.locator('#ai-prompt').fill('Fictional held request');await page.locator('[data-ai-send]').click();
    await expect.poll(()=>requests).toBe(1);server.publish();await page.locator('#update-button').click();await expect(page.locator('#update-dialog')).toBeVisible({timeout:30000});
    await page.locator('[data-update-choice=stay]').click();await expect(page.locator('[data-ai=cancel]')).toBeVisible();
    await page.locator('#update-button').click();await page.locator('[data-update-choice=keep]').click();await expect(page.locator('#app-version')).toContainText(NEXT.slice(0,12));await ready(page);release();
    await expect(page.locator('#ai-prompt')).toHaveValue('Fictional held request');await expect(page.locator('[data-ai=cancel]')).toBeHidden();await expect(page.locator('[data-ai-proposal]')).toBeHidden();
    expect(requests).toBe(1);await expect(page.locator('#revision')).toHaveText('r0');
  }finally{release();await server.close();}
});

test('quota failure blocks activation and leaves work and old version usable',async({page})=> {
  const server=await upgradeServer();
  try {
    await start(page,server);await page.locator('#left-panel [data-select=items-sku]').click();await page.getByLabel('Label',{exact:true}).fill('Fictional protected draft');
    await page.evaluate(()=> {const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='printform-studio-v3:update-recovery')throw new DOMException('Recovery storage full','QuotaExceededError');return original.call(this,key,value);};});
    await update(page,server);await expect(page.locator('#update-status')).toContainText('Recovery storage full');await expect(page.getByLabel('Label',{exact:true})).toHaveValue('Fictional protected draft');
    await expect(page.locator('#app-version')).toContainText('aaaaaaaaaaaa');await expect(page.locator('#update-button')).toBeEnabled();await expect(page.locator('#revision')).toHaveText('r0');
  }finally{await server.close();}
});

test('unsupported recovery is retained with a download and blocks another update',async({page})=> {
  const server=await upgradeServer();
  try {
    await page.addInitScript(()=> {sessionStorage.setItem('printform-studio-v3:update-recovery','{"version":99}');Object.defineProperty(globalThis,'indexedDB',{value:undefined});});
    await start(page,server);await expect(page.locator('#recovery-download')).toBeVisible();
    expect(await page.evaluate(()=>sessionStorage.getItem('printform-studio-v3:update-recovery'))).toBe('{"version":99}');
    server.publish();await page.locator('#update-button').click();await expect(page.locator('#update-button')).toBeEnabled();await page.locator('#update-button').click();
    await expect(page.locator('#update-status')).toContainText('retained recovery backup');await expect(page.locator('#app-version')).toContainText('aaaaaaaaaaaa');
    const download=page.waitForEvent('download');await page.locator('#recovery-download').click();await download;
    expect(await page.evaluate(()=>sessionStorage.getItem('printform-studio-v3:update-recovery'))).toBe('{"version":99}');
    await page.locator('#recovery-discard').click();await expect(page.locator('#recovery-download')).toBeHidden();
    expect(await page.evaluate(()=>sessionStorage.getItem('printform-studio-v3:update-recovery'))).toBeNull();
  }finally{await server.close();}
});

test('locale and currency drafts survive Keep and remain unapplied until Apply',async({page})=> {
  const server=await upgradeServer();
  try {
    await start(page,server);await page.locator('[data-mode=data]').click();
    await page.getByText('Locale & currency',{exact:true}).click();
    await page.locator('[name=locale]').selectOption('zh-CN');await page.locator('[name=currency]').selectOption('USD');
    await update(page,server);await ready(page);
    await expect(page.locator('#recovery-download')).toBeHidden();await expect(page.locator('[name=locale]')).toHaveValue('zh-CN');await expect(page.locator('[name=currency]')).toHaveValue('USD');
    await expect(page.locator('#draft-state')).toContainText('1 unapplied');await expect(page.locator('#revision')).toHaveText('r0');
    await page.getByText('Locale & currency',{exact:true}).click();await page.getByRole('button',{name:'Apply locale',exact:true}).click();await ready(page);
    await expect(page.locator('#revision')).toContainText('r1');
  }finally{await server.close();}
});

test('tab-only saved datasets block update before reload and remain available to export',async({page})=> {
  const server=await upgradeServer();
  try {
    await page.addInitScript(()=>Object.defineProperty(globalThis,'indexedDB',{value:undefined}));await start(page,server);
    server.publish();await page.locator('#update-button').click();await expect(page.locator('#update-button')).toBeEnabled();await page.locator('#update-button').click();
    await expect(page.locator('#update-status')).toContainText('Database storage is tab-only');await expect(page.locator('#app-version')).toContainText('aaaaaaaaaaaa');
    await expect(page.locator('#update-dialog')).toBeHidden();await ready(page);
  }finally{await server.close();}
});
