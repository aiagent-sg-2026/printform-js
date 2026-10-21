import {test,expect} from './studio-v3-test.js';
import {syntheticPdf} from './fixtures/reference-documents.js';
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
test.beforeEach(async({page})=>{
 await page.route('https://gpt.yapweijun1996.com/demo/**',route=>route.abort());
 await page.goto('/studio-v3/');await ready(page);await page.locator('[data-ai-toggle]').click();
});
for(const viewport of [{width:400,height:800},{width:320,height:568}]){
 test(`${viewport.width}×${viewport.height}: changing a sharing permission keeps the next permission reachable`,async({page},info)=>{
  await page.setViewportSize(viewport);
  const inference=[];page.on('request',request=>{if(request.url().endsWith('/demo/v1/responses'))inference.push(request.url());});
  await page.locator('.ai-settings>summary').click();
  await page.locator('.ai-sharing>summary').click();
  const menu=page.locator('.ai-settings-body');await menu.evaluate(node=>node.scrollTop=node.scrollHeight);
  const text=page.locator('#ai-observation-text'),pixels=page.locator('#ai-observation-pixels');
  await text.scrollIntoViewIfNeeded();await expect(pixels).toBeInViewport({ratio:1});
  await text.check();await expect(text).toBeChecked();
  await expect(pixels).toBeInViewport({ratio:1});
  await expect(page.locator('.ai-settings')).toHaveAttribute('open','');
  const bounds=await menu.evaluate(node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,overflow:getComputedStyle(node).overflowY};});
  expect(bounds.top).toBeGreaterThanOrEqual(0);expect(bounds.bottom).toBeLessThanOrEqual(viewport.height);expect(bounds.left).toBeGreaterThanOrEqual(0);expect(bounds.right).toBeLessThanOrEqual(viewport.width);expect(bounds.overflow).toBe('auto');
  const next=await pixels.boundingBox();expect(next.y).toBeGreaterThanOrEqual(bounds.top);expect(next.y+next.height).toBeLessThanOrEqual(bounds.bottom);
  await pixels.check();await expect(pixels).toBeChecked();
  await expect(page.locator('#ai-prompt')).toBeInViewport({ratio:1});
  expect(inference).toEqual([]);
  await page.screenshot({path:info.outputPath('sharing-controls-retain-position.png')});
 });
}
test('dropping a second PDF on existing references decodes it locally and preserves the first attachment',async({page},info)=>{
 await page.getByLabel('Add reference PDF or image',{exact:true}).setInputFiles(syntheticPdf());
 await expect(page.locator('.ai-reference-card')).toHaveCount(1,{timeout:30000});
 const file=syntheticPdf({pages:1}),url=page.url();
 const transfer=await page.evaluateHandle(({bytes})=>{
  const data=new DataTransfer();data.items.add(new File([new Uint8Array(bytes)],'second-layout.pdf',{type:'application/pdf'}));return data;
 },{bytes:Array.from(file.buffer)});
 try{await page.locator('.ai-reference-files>summary').dispatchEvent('drop',{dataTransfer:transfer});}finally{await transfer.dispose();}
 await expect(page.locator('.ai-reference-card')).toHaveCount(2,{timeout:30000});
 expect(page.url()).toBe(url);
 await page.locator('.ai-reference-files>summary').click();
 const cards=page.locator('.ai-reference-card');
 await expect(cards.first()).toContainText('fictional-reference.pdf');
 await expect(cards.last()).toContainText('second-layout.pdf');
 await cards.last().locator('.ai-reference-preview>summary').click();
 await expect(cards.last().locator('.ai-reference-excerpt')).toContainText('FICTIONAL REFERENCE 1');
 await page.screenshot({path:info.outputPath('two-decoded-reference-pdfs.png')});
});
