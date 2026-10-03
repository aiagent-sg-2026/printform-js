import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {syntheticPdf,syntheticPng} from './fixtures/reference-documents.js';
test.use({serviceWorkers:'block'});test.setTimeout(90000);
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const paper=page=>page.frameLocator('#preview-frame');
const proposal={summary:'Use the fictional reference navy',edits:[{target:'style',property:'color',value:'#163a65'}]};
async function mockProvider(page,{images=false}={}) {
 const calls=[];
 await page.route('https://gpt.yapweijun1996.com/demo/**',async route=>{
  const path=new URL(route.request().url()).pathname,payload=route.request().postDataJSON();calls.push({path,payload});
  const value=path.endsWith('/session')?{token:'dmo_synthetic_demo123',expires_in:900}:path.endsWith('/models')?{data:[{id:'demo-fast',...(images?{input_modalities:['text','image']}:{})}]}:path.endsWith('/responses')?{status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(proposal)}]}],usage:{total_tokens:20}}:{choices:[{finish_reason:'stop',message:{content:JSON.stringify(proposal)}}],usage:{total_tokens:20}};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
 });return calls;
}
async function openReferences(page){await page.locator('[data-ai-toggle]').click();await page.getByText('References · PDF / image',{exact:true}).click();}
async function attach(page,fixture){await page.getByLabel('Add reference PDF or image',{exact:true}).setInputFiles(fixture);await expect(page.locator('.ai-reference-card')).toHaveCount(1,{timeout:30000});await expect(page.locator('.ai-reference-files')).toContainText('Ready locally');}
test.beforeEach(async({page})=>{page.on('dialog',d=>d.accept());await page.goto('/studio-v3/');await ready(page);});
test('catalogue, exact dataset kind, USD switch and editable save preserve v3 layout',async({page},info)=>{
 await page.locator('[data-action=new]').click();await page.getByText('Business demo templates',{exact:true}).click();await page.locator('[data-demo-template=SalesQuotation]').click();await ready(page);
 await expect(paper(page).locator('[data-v3-id=header-title]').first()).toHaveText('SALES QUOTATION');
 await page.locator('[data-mode=data]').click();
 const options=await page.locator('#database-choice option').allTextContents();expect(options.filter(text=>text.includes('Sales quotation')).length).toBeGreaterThanOrEqual(5);expect(options.some(text=>text.includes('Bank receipt'))).toBe(false);
 await page.locator('#database-choice').selectOption('demo:SalesQuotation:usd-independent');await ready(page);
 await expect(paper(page).locator('[data-v3-id=totals-total]').last()).toContainText('1,811.60');
 const saved=page.waitForEvent('download');await page.locator('[data-action=save]').click();const download=await saved,path=info.outputPath('quotation.printform.json');await download.saveAs(path);
 const data=JSON.parse(await fs.readFile(path,'utf8')).project;expect(data.manifest.currency).toBe('USD');expect(data.sampleData.document.kind).toBe('SalesQuotation');expect(data.sampleData.demo.fictional).toBe(true);
});
test('all business templates render and long scenario paginates without missing bindings',async({page,context,browserName},info)=>{
 test.setTimeout(180000);
 for(const kind of ['SalesOrder','SalesOrderConfirmation','DeliveryOrder','DeliveryOrderConfirmation','SalesInvoice','PurchaseOrder','PurchaseInvoice','BankReceipt','BankPayment','EnterpriseProject','ProgressClaim','CertifiedClaim','AccountsReceivableClaim','AccountsPayableClaim']) {
  await page.locator('[data-action=new]').click();const details=page.locator('#new-dialog details');if((await details.getAttribute('open'))===null)await details.locator('summary').click();await page.locator(`[data-demo-template=${kind}]`).click();await ready(page);
  await expect(page.locator('#status')).toContainText('current layout passed');
 }
 await page.locator('[data-action=new]').click();await page.locator('[data-demo-template=SalesInvoice]').click();await ready(page);await page.locator('[data-mode=data]').click();await page.locator('#database-choice').selectOption('demo:SalesInvoice:campus');await ready(page);
 expect(await paper(page).locator('.printform_page').count()).toBeGreaterThan(1);await expect(paper(page).locator('.prowitem_processed')).toHaveCount(64);
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-action=export]').click();const downloaded=await downloadPromise,path=info.outputPath('fictional-campus-invoice.html');await downloaded.saveAs(path);
 const printed=await context.newPage();await printed.goto(pathToFileURL(path).href);await expect(printed.locator('html')).toHaveAttribute('data-printform-status','ready');await expect(printed.locator('.prowitem_processed')).toHaveCount(64);
 if(browserName==='chromium')await printed.pdf({path:info.outputPath('fictional-campus-invoice-A4.pdf'),preferCSSPageSize:true,printBackground:true});await printed.screenshot({path:info.outputPath('fictional-campus-invoice.png'),fullPage:true});await printed.close();
});
test('real PDF parsing -> explicit text-only sharing -> mocked AI Preview Apply Undo -> export',async({page},info)=>{
 const calls=await mockProvider(page);await openReferences(page);await attach(page,syntheticPdf());
 await expect(page.locator('.ai-reference-card')).toContainText('2 page(s)');await expect(page.locator('#ai-share')).toContainText('FICTIONAL REFERENCE');await expect(page.locator('#ai-share')).toContainText('extracted-text-and-positions');expect(calls).toHaveLength(0);
 await page.locator('#ai-prompt').fill('Use navy #163a65 based on the reference structure.');await page.locator('[data-ai-send]').click();await expect(page.locator('[data-ai-proposal]')).toBeVisible();
 const wire=calls.find(c=>c.path.endsWith('/chat/completions')).payload;expect(wire.messages[1].content).toContain('DEMO-REF-001');expect(JSON.stringify(wire)).not.toContain('base64');expect(JSON.stringify(wire)).not.toContain('ACME Industrial');
 await page.locator('[data-ai=preview]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();await page.locator('[data-ai=apply]').click();await expect(page.locator('#revision')).toContainText('r1');
 const savePromise=page.waitForEvent('download');await page.locator('[data-action=save]').click();const saved=await savePromise,savedPath=info.outputPath('pdf-authored.printform.json');await saved.saveAs(savedPath);
 const authored=JSON.parse(await fs.readFile(savedPath,'utf8')).project;expect(authored.manifest.studioV3.color).toBe('#163a65');expect(authored.manifest.currency).toBe('MYR');expect(authored.sampleData.summary.total).toBe(12150);expect(authored.manifest.studioV3.columns.find(f=>f.id==='amount').pointer).toBe('./amount');
 await page.locator('[data-ai=undo]').click();await expect(page.locator('#revision')).toContainText('r2');await ready(page);
 const chooser=page.waitForEvent('filechooser');await page.locator('[data-action=open]').click();await (await chooser).setFiles(savedPath);await ready(page);await expect(page.locator('.ai-reference-card')).toHaveCount(0);
 const againPromise=page.waitForEvent('download');await page.locator('[data-action=save]').click();const again=await againPromise,againPath=info.outputPath('pdf-authored-reopened.printform.json');await again.saveAs(againPath);const reopened=JSON.parse(await fs.readFile(againPath,'utf8')).project;
 expect(reopened.sampleData).toEqual(authored.sampleData);expect(reopened.manifest.studioV3).toEqual(authored.manifest.studioV3);expect(reopened.manifest.currency).toBe(authored.manifest.currency);
 const downloaded=page.waitForEvent('download');await page.locator('[data-action=export]').click();const result=await downloaded;await result.saveAs(info.outputPath('reference-demo-export.html'));
 await page.reload();await ready(page);await openReferences(page);await expect(page.locator('.ai-reference-card')).toHaveCount(0);
});
test('unknown capability schema keeps images blocked while normal model diagnostics expose safe facts',async({page})=>{
 const calls=await mockProvider(page,{images:true});await openReferences(page);await attach(page,syntheticPng());await page.locator('#ai-prompt').fill('Use navy #163a65.');await expect(page.locator('[data-ai-send]')).toBeDisabled();expect(calls).toHaveLength(0);
 await page.locator('.ai-settings>summary').click();await page.locator('[data-ai=models]').click();await expect(page.locator('[data-ai-status]')).toContainText('Available: demo-fast');await page.locator('.ai-settings>summary').click();
 await page.getByText('Observed model capabilities',{exact:true}).click();await expect(page.locator('.ai-reference-files')).toContainText('input_modalities');await expect(page.locator('.ai-reference-files')).toContainText('Image support is not confirmed');await expect(page.locator('[data-ai-send]')).toBeDisabled();expect(calls.some(call=>call.path.endsWith('/responses') || call.path.endsWith('/chat/completions'))).toBe(false);
});
test('oversized page count and corrupt references fail locally; changing forms drops attachments',async({page})=>{
 const calls=await mockProvider(page);await openReferences(page);await page.getByLabel('Add reference PDF or image',{exact:true}).setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not a raster')});await expect(page.locator('.ai-reference-files')).toContainText('Only PDF, PNG, JPEG and WebP');await page.getByLabel('Add reference PDF or image',{exact:true}).setInputFiles(syntheticPdf({pages:7}));await expect(page.locator('.ai-reference-files')).toContainText('no more than 4 pages');await expect(page.locator('.ai-reference-card')).toHaveCount(0);
 await page.getByLabel('Add reference PDF or image',{exact:true}).setInputFiles(syntheticPdf({text:false,pages:1}));await expect(page.locator('.ai-reference-files')).toContainText('No extractable PDF text');await expect(page.locator('.ai-reference-card')).toHaveCount(0);await attach(page,syntheticPdf());
 await page.locator('[data-action=new]').click();await page.locator('[data-template=purchase]').click();await ready(page);await expect(page.locator('.ai-reference-card')).toHaveCount(0);expect(calls).toHaveLength(0);
});


test('drop an image into the conversation composer, then remove it without sending',async({page})=>{
 const calls=await mockProvider(page);await page.locator('[data-ai-toggle]').click();const fixture=syntheticPng();
 const transfer=await page.evaluateHandle(({bytes,name,mime})=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(bytes)],name,{type:mime}));return dt;},{bytes:[...fixture.buffer],name:fixture.name,mime:fixture.mimeType});
 await page.locator('.ai-composer').dispatchEvent('drop',{dataTransfer:transfer});await expect(page.locator('.ai-reference-card')).toHaveCount(1);await page.locator('.ai-reference-card button').click();await expect(page.locator('.ai-reference-card')).toHaveCount(0);expect(calls).toHaveLength(0);await transfer.dispose();
});

test('catalogue seed migration adds missing fixtures without overwriting a retained edited record',async({page})=>{
 await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('printform-studio-v3-demo-db',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(['datasets','preferences'],'readwrite'),store=tx.objectStore('datasets');
   const all=store.getAll();all.onsuccess=()=>{for(const record of all.result){if(record.id.startsWith('demo:'))store.delete(record.id);if(record.id==='starter:invoice'){record.data.customer.name='Retained fictional owner edit';record.revision=10;store.put(record);}}};
   tx.objectStore('preferences').delete('seed:business-demo-v1');tx.objectStore('preferences').put({key:'seed:v1',value:true});
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });db.close();
 });
 await page.reload();await ready(page);await expect(paper(page).locator('[data-v3-id=customer-bill]').first()).toContainText('Retained fictional owner edit');
 await page.locator('[data-action=new]').click();await page.getByText('Business demo templates',{exact:true}).click();await page.locator('[data-demo-template=SalesQuotation]').click();await ready(page);await page.locator('[data-mode=data]').click();expect(await page.locator('#database-choice option').count()).toBe(6);
});

test('explicit compact A5 preset retains all 45 rows, fields and totals in at most six readable pages',async({page,context,browserName},info)=>{
 await page.locator('[data-action=new]').click();await page.getByText('Business demo templates',{exact:true}).click();await page.locator('[data-demo-template=CompactA5Invoice]').click();await ready(page);
 const pages=paper(page).locator('.printform_page');expect(await pages.count()).toBeLessThanOrEqual(6);expect(await pages.count()).toBeGreaterThan(1);
 await expect(paper(page).locator('.prowitem_processed')).toHaveCount(45);expect(await pages.first().locator('.prowitem_processed').count()).toBeGreaterThanOrEqual(2);
 const text=await paper(page).locator('#pf-mount').textContent();for(const value of ['ACME Industrial Supply','202601234567','123 Innovation Drive','2026-10-01','2026-10-31','PO-2026-0087','Alicia Tan','12,150.00'])expect(text).toContain(value);
 const font=await paper(page).locator('.prowitem_processed td').first().evaluate(node=>getComputedStyle(node).fontSize);expect(parseFloat(font)).toBeGreaterThanOrEqual(12);
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-action=export]').click();const downloaded=await downloadPromise,path=info.outputPath('compact-a5-45.html');await downloaded.saveAs(path);
 const printed=await context.newPage();await printed.goto(pathToFileURL(path).href);await expect(printed.locator('html')).toHaveAttribute('data-printform-status','ready');await expect(printed.locator('.prowitem_processed')).toHaveCount(45);expect(await printed.locator('.printform_page').count()).toBeLessThanOrEqual(6);
 await printed.screenshot({path:info.outputPath('compact-a5-45.png'),fullPage:true});if(browserName==='chromium')await printed.pdf({path:info.outputPath('compact-a5-45.pdf'),preferCSSPageSize:true,printBackground:true});await printed.close();
});

test('PDF text extraction ignores raster content without decoding or advertising a visual preview',async({page})=>{
 const calls=await mockProvider(page);await openReferences(page);
 for(const raster of ['xobject','inline','negative']) {
  await attach(page,syntheticPdf({pages:1,raster}));await expect(page.locator('.ai-reference-card')).toContainText('PDF appearance, embedded images and annotations are not rendered');await expect(page.locator('.ai-reference-excerpt')).toContainText('FICTIONAL REFERENCE');await expect(page.locator('.ai-reference-card img')).toHaveCount(0);await expect(page.locator('#ai-share')).not.toContainText('base64');await page.locator('.ai-reference-card button').click();
 }
 expect(calls).toHaveLength(0);
});

test('visual PDF mode renders fictional JPEG, PNG-style Flate, masks and multiple images locally',async({page},info)=>{
 const {rasterPdf}=await import('./fixtures/raster-reference-documents.js');const calls=await mockProvider(page);await openReferences(page);await page.getByLabel('PDF reading for new attachments',{exact:true}).selectOption('visual');
 for(const kind of ['jpeg','png','mask','multiple']) {
  await attach(page,rasterPdf(kind,{text:kind!=='jpeg'}));await expect(page.locator('.ai-reference-card img')).toHaveCount(1);await expect(page.locator('.ai-reference-card img')).toHaveJSProperty('complete',true);expect(await page.locator('.ai-reference-card img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.ai-reference-card')).toContainText('best-effort controls');await expect(page.locator('#ai-share')).toContainText('visual-pages');await expect(page.locator('[data-ai-send]')).toBeDisabled();await page.screenshot({path:info.outputPath(`local-${kind}-pdf-reference.png`)});await page.locator('.ai-reference-card button').click();
 }
 await page.getByLabel('Add reference PDF or image',{exact:true}).setInputFiles(rasterPdf('oversized'));await expect(page.locator('.ai-reference-files')).toContainText('12-million-pixel limit');await expect(page.locator('.ai-reference-card')).toHaveCount(0);expect(calls).toHaveLength(0);
 await attach(page,syntheticPdf({pages:1,text:false,blank:true}));await expect(page.locator('.ai-reference-card img')).toHaveCount(1);await expect(page.locator('[data-ai-send]')).toBeDisabled();expect(calls).toHaveLength(0);
});
test('cancelled visual PDF worker can be replaced by a successful fresh read',async({page})=>{
 const {rasterPdf}=await import('./fixtures/raster-reference-documents.js');const calls=await mockProvider(page);await openReferences(page);await page.getByLabel('PDF reading for new attachments',{exact:true}).selectOption('visual');let release;const held=new Promise(resolve=>release=resolve);
 await page.route('**/pdf.worker*.js',async route=>{await held;await route.continue().catch(()=>{});});
 await page.getByLabel('Add reference PDF or image',{exact:true}).setInputFiles(rasterPdf('jpeg'));await page.getByRole('button',{name:'Cancel reading',exact:true}).click();await expect(page.locator('.ai-reference-files')).toContainText('reading cancelled');release();await page.unroute('**/pdf.worker*.js');await expect(page.getByRole('button',{name:'Cancel reading',exact:true})).toBeHidden();
 await attach(page,rasterPdf('png'));await expect(page.locator('.ai-reference-card img')).toHaveCount(1);expect(calls).toHaveLength(0);
});


test('expanded references keep the prompt and Send reachable without collapsing the conversation',async({page},info)=>{
 const calls=await mockProvider(page);
 for(const size of [{width:1280,height:720},{width:1440,height:900},{width:390,height:844}]) {
  await page.setViewportSize(size);await page.reload();await ready(page);await openReferences(page);await attach(page,syntheticPdf());
  const panel=await page.locator('#ai-panel').boundingBox(),composer=await page.locator('.ai-composer').boundingBox(),log=await page.locator('[data-ai-log]').boundingBox();
  expect(composer.y+composer.height).toBeLessThanOrEqual(panel.y+panel.height+1);const logPadding=await page.locator('[data-ai-log]').evaluate(node=>{const style=getComputedStyle(node);return parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);});expect(log.height-logPadding).toBeGreaterThan(40);
  await page.locator('#ai-prompt').focus();await page.locator('#ai-prompt').fill('Use navy accents from this fictional reference.');await expect(page.locator('#ai-prompt')).toBeInViewport({ratio:1});await expect(page.locator('[data-ai-send]')).toBeInViewport({ratio:1});await expect(page.locator('[data-ai-send]')).toBeEnabled();
  await page.screenshot({path:info.outputPath(`reference-composer-${size.width}.png`)});expect(calls).toHaveLength(0);
 }
});
