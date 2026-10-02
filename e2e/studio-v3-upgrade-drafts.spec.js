import {test,expect} from '@playwright/test';
import {upgradeServer,NEXT} from './studio-v3-upgrade-server.js';
import {newProject} from '../studio-v3/model.js';
import {saveProject} from '../studio-v3/file-io.js';
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function start(page,server) {page.on('dialog',d=>d.accept());await page.goto(server.url);await ready(page);await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller));}
async function update(page,server) {
  server.publish();await page.locator('#update-button').click();await expect(page.locator('#update-button')).toHaveText(`Update to ${NEXT.slice(0,12)}`,{timeout:30000});
  await page.locator('#update-button').click();await page.locator('[data-update-choice=keep]').click();
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
  test(`pending ${target} read blocks snapshot and activation until import completes`,async({page})=> {
    const server=await upgradeServer();
    try {
      await start(page,server);
      await page.evaluate(()=> {
        const original=File.prototype.text;let release;
        const held=new Promise(resolve=>release=resolve);globalThis.finishFixtureRead=release;
        File.prototype.text=async function(){const text=await original.call(this);await held;return text;};
      });
      const project=newProject();project.manifest.title='Fictional delayed import';
      await page.locator(`#${target}`).setInputFiles({name:target==='open-file'?'fictional.printform.json':'fictional-dataset.json',mimeType:'application/json',buffer:Buffer.from(target==='open-file'?saveProject(project):JSON.stringify(project.sampleData))});
      server.publish();await page.locator('#update-button').click();await expect(page.locator('#update-button')).toContainText('Update to');
      await page.locator('#update-button').click();await expect(page.locator('#update-status')).toContainText('file read');
      await expect(page.locator('#update-dialog')).toBeHidden();await expect(page.locator('#app-version')).toContainText('aaaaaaaaaaaa');
      expect(await page.evaluate(()=>sessionStorage.getItem('printform-studio-v3:update-recovery'))).toBeNull();
      await page.evaluate(()=>globalThis.finishFixtureRead());await ready(page);
      if(target==='open-file')await expect(page.locator('#document-name')).toHaveValue('Fictional delayed import');
      else await expect(page.locator('#revision')).toContainText('r1');
    }finally{await server.close();}
  });
}

test('AI candidate/input recover without token or consent, require new preview, then bounded Apply/Undo',async({page})=> {
  const server=await upgradeServer();let calls=0;
  try {
    await demoMock(page,path=> {
      calls++;
      const body=path.endsWith('/session')?{token:'dmo_synthetic123456',expires_in:900}:path.endsWith('/models')?{data:[{id:'demo-fast'}]}:{choices:[{message:{content:JSON.stringify({summary:'Fictional navy proposal',edits:[{target:'style',property:'color',value:'#163a65'}]})},finish_reason:'stop'}]};
      return {status:path.endsWith('/session')?201:200,body};
    });
    await start(page,server);
    await page.locator('[data-ai-toggle]').click();await page.locator('#ai-prompt').fill('Fictional navy layout');await page.locator('#ai-consent').check();await page.locator('[data-ai-send]').click();
    await expect(page.locator('[data-ai-proposal]')).toBeVisible();await page.locator('[data-ai=preview]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();
    await update(page,server);await ready(page);
    await expect(page.locator('#ai-prompt')).toHaveValue('Fictional navy layout');await expect(page.locator('#ai-consent')).not.toBeChecked();
    await expect(page.locator('[data-ai-proposal]')).toBeVisible();await expect(page.locator('[data-ai=apply]')).toBeDisabled();expect(calls).toBe(3);
    expect(await page.evaluate(()=>[...Object.keys(sessionStorage),...Object.keys(localStorage)].some(key=>/token|credential|demo-session/i.test(key)))).toBe(false);
    await page.locator('[data-ai=preview]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();await page.locator('[data-ai=apply]').click();await ready(page);
    await expect(page.locator('#revision')).toContainText('r1');await page.locator('[data-action=undo]').click();await ready(page);expect(calls).toBe(3);
  }finally{await server.close();}
});

test('pending AI request is cancelled only on confirmed update and never resumes after recovery',async({page})=> {
  const server=await upgradeServer();let release,requests=0;const held=new Promise(resolve=>release=resolve);
  try {
    await demoMock(page,async path=> {
      if (path.endsWith('/chat/completions')) {requests++;await held;return {status:500,body:{}};}
      return {status:path.endsWith('/session')?201:200,body:path.endsWith('/session')?{token:'dmo_synthetic123456',expires_in:900}:{data:[{id:'demo-fast'}]}};
    });
    await start(page,server);
    await page.locator('[data-ai-toggle]').click();await page.locator('#ai-prompt').fill('Fictional held request');await page.locator('#ai-consent').check();await page.locator('[data-ai-send]').click();
    await expect.poll(()=>requests).toBe(1);server.publish();await page.locator('#update-button').click();await expect(page.locator('#update-button')).toContainText('Update to');
    await page.locator('#update-button').click();await page.locator('[data-update-choice=stay]').click();await expect(page.locator('[data-ai=cancel]')).toBeVisible();
    await page.locator('#update-button').click();await page.locator('[data-update-choice=keep]').click();await ready(page);release();
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
    server.publish();await page.locator('#update-button').click();await expect(page.locator('#update-button')).toContainText('Update to');await page.locator('#update-button').click();
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
    server.publish();await page.locator('#update-button').click();await expect(page.locator('#update-button')).toContainText('Update to');await page.locator('#update-button').click();
    await expect(page.locator('#update-status')).toContainText('Database storage is tab-only');await expect(page.locator('#app-version')).toContainText('aaaaaaaaaaaa');
    await expect(page.locator('#update-dialog')).toBeHidden();await ready(page);
  }finally{await server.close();}
});
