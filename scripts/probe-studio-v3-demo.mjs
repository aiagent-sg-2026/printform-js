// Opt-in live probe: fictional bundled layout only; no trace, body or token logging.
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const context = await browser.newContext({viewport:{width:1440,height:900}});
const page = await context.newPage();
const evidence = {origin:'http://127.0.0.1:4174',project:'github-pages',alias:'demo-fast',requests:[],syntheticOnly:true,trace:false};
page.on('response',async response=> {
  const url = new URL(response.url());
  if (url.origin === 'https://gpt.yapweijun1996.com') {
    const record = {path:url.pathname,status:response.status()}; evidence.requests.push(record);
    if (response.status() >= 400) {
      try { record.codes = [...new Set(JSON.stringify(await response.json()).match(/DEMO_[A-Z_]{2,60}/g) || [])]; } catch { /* Never retain raw errors. */ }
    }
  }
});
try {
  await page.goto(`${evidence.origin}/studio-v3/`);
  await page.locator('[data-action=export]').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('[data-action=export]').disabled);
  await page.locator('[data-ai-toggle]').click();
  await page.locator('#ai-prompt').fill('For this fictional demo form, use the brand accent color #163a65. Change only style color.');
  await page.locator('#ai-consent').check(); await page.locator('[data-ai-send]').click();
  await page.waitForFunction(()=>document.querySelector('[data-ai=cancel]').hidden,{timeout:65000});
  evidence.status = await page.locator('[data-ai-status]').textContent();
  if (!await page.locator('[data-ai-proposal]').isVisible()) throw new Error('Live request did not produce a supported proposal. See sanitized status.');
  await page.locator('[data-ai=preview]').click(); await page.waitForFunction(()=>!document.querySelector('[data-ai=apply]').disabled,{timeout:30000});
  evidence.preview = 'current browser layout passed'; evidence.revisionBefore = await page.locator('#revision').textContent();
  await page.screenshot({path:'output/playwright/demo-live-preview.png'});
  await page.locator('[data-ai=apply]').click(); await page.waitForFunction(()=>document.querySelector('#revision').textContent.startsWith('r1'));
  await page.waitForFunction(()=>!document.querySelector('[data-action=export]').disabled);
  evidence.revisionAfter = await page.locator('#revision').textContent();
  await page.locator('[data-action=undo]').click(); await page.waitForFunction(()=>document.querySelector('#revision').textContent.startsWith('r2'));
  evidence.undo = 'restored prior layout'; evidence.ok = true;
} catch (error) { evidence.ok = false; evidence.error = error.message; process.exitCode = 1; }
finally {
  await fs.writeFile('output/playwright/demo-live.json',JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence)); await context.close(); await browser.close();
}
