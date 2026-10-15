import { test, expect } from './studio-v3-test.js';
import { syntheticPng } from './fixtures/reference-documents.js';

// The gateway is replaced inside the page; only the session and the model list are needed. Nothing leaves the machine.
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function gateway(page,multimodal) {
  await page.addInitScript(multimodal=> {
    const original = window.fetch.bind(window);
    const json = (body,status = 200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    window.__models = 0;
    window.fetch = async (input,init)=> {
      const url = new URL(typeof input === 'string' ? input : input.url,location.href);
      if (url.origin !== 'https://gpt.yapweijun1996.com') return original(input,init);
      if (url.pathname === '/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) { window.__models += 1; return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal}}]}); }
      return json({error:'not used here'},500);
    };
  },multimodal);
}
async function attachImage(page) {
  await page.setViewportSize({width:391,height:786}); await page.goto('/studio-v3/'); await ready(page);
  await page.locator('[data-ai-toggle]').click(); await page.locator('[data-ai=attach]').click();
  await page.getByLabel('Add reference PDF or image',{exact:true}).setInputFiles(syntheticPng());
  await expect(page.locator('.ai-reference-card')).toHaveCount(1,{timeout:30000});
}

test('an attached image has its support checked at once, and Send is ready when the gateway reports it',async({page})=> {
  await gateway(page,true); await attachImage(page);
  await expect(page.locator('.ai-reference-files')).toContainText('Images available'); await expect(page.locator('[data-ai-send-reason]')).toHaveAttribute('data-kind','notice');
  await page.locator('#ai-prompt').fill('Use navy accents.'); await expect(page.locator('[data-ai-send]')).toBeEnabled();
  expect(await page.evaluate(()=>window.__models)).toBe(1);
});

test('when support is not reported, expanding references exposes the retry without moving the composer',async({page})=> {
  await gateway(page,false); await attachImage(page);
  const button = page.getByRole('button',{name:'Check image support'});
  await expect(page.locator('[data-ai-send-reason]')).toHaveAttribute('data-kind','reason'); await expect(page.locator('[data-ai-send]')).toBeDisabled();
  await page.locator('.ai-reference-files>summary').click();
  await expect(button).toBeVisible(); await expect(button).toBeInViewport({ratio:1});
});
