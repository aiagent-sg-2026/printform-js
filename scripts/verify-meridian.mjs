// Serial, bounded Chromium verification of the current standalone artifact.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=await import('@playwright/test');
const {inspectDom,inspectPdf,barcodePixels}=await import('./meridian-inspect.mjs');
const {preset,calculate}=await import('../gallery/designs/assets/meridian/model.mjs');
const output=path.resolve(process.argv[2] || path.resolve(root,'../artifacts',`verification-${Date.now()}`));
await fs.mkdir(output,{recursive:true});
const report={started:new Date().toISOString(),output,scenarios:[],errors:[],requests:[],pageerrors:[],physicalCertified:false};
const sample=JSON.parse(await fs.readFile(path.join(root,'gallery/designs/assets/meridian/sample.json'),'utf8'));
let browser,context,page,temporaryFileDirectory;
const ready=async count=>page.waitForFunction(n=>window.MERIDIAN_READY && (n===null||window.MERIDIAN_RESULT.data.items.length===n),count,{timeout:30000});
async function edit(data, invalid=false) {
  await page.locator('#editor-panel').evaluate(n=>{n.open=true;});
  await page.locator('#editor').fill(typeof data==='string'?data:JSON.stringify(data));
  assert.equal(await page.locator('#print').isDisabled(),true,'dirty print is blocked immediately');
  await page.locator('#update').click();
  if(invalid) {
    await page.waitForFunction(()=>document.body.dataset.state==='invalid');
    assert.equal(await page.locator('#print').isDisabled(),true);
    return await page.locator('#status').textContent();
  }
  await ready(null);
}
async function overlapOracle(data) {
  report.overlapMutations=[];
  for(const media of ['screen','print']) {
    await page.emulateMedia({media});
    for(const [selector,message] of [
      ['.po-barcode svg',/PO label\/SVG sibling boxes must not overlap/],
      ['.item-code svg',/item label\/SVG sibling boxes must not overlap/],
      ['.barcode-value',/item SVG\/human-readable sibling boxes must not overlap/]
    ]) {
      const locator=page.locator(selector).first();
      const previous=await locator.getAttribute('style');
      try {
        await locator.evaluate(n=>{n.style.position='relative';n.style.top='-4px';});
        await assert.rejects(()=>inspectDom(page,data),message);
        report.overlapMutations.push({media,selector,rejected:true});
      } finally {
        await locator.evaluate((n,style)=>style===null?n.removeAttribute('style'):n.setAttribute('style',style),previous);
      }
    }
    await inspectDom(page,data);
  }
  await page.emulateMedia({media:'screen'});
}
async function scenario(name,data) {
  await ready(data.items.length);
  await page.emulateMedia({media:'screen'});
  const screen=await inspectDom(page,data);
  await page.emulateMedia({media:'print'});
  const dom=await inspectDom(page,data);
  assert.deepEqual(screen.map(p=>p.ids),dom.map(p=>p.ids),'screen and print retain identical item pages');
  const bytes=await page.pdf({path:path.join(output,`${name}.pdf`),preferCSSPageSize:true,printBackground:true});
  const pdf=await inspectPdf(bytes,dom,data);
  assert.deepEqual(await page.evaluate(()=>window.MERIDIAN_RESULT.total),calculate(data));
  const result={name,count:data.items.length,pages:dom.length,screen,dom,pdf,pdfSha256:createHash('sha256').update(bytes).digest('hex')};
  report.scenarios.push(result);
  await page.emulateMedia({media:'screen'});
  return result;
}
try {
  if (process.env.MERIDIAN_FILE_DIR) temporaryFileDirectory=await fs.mkdtemp(path.join(process.env.MERIDIAN_FILE_DIR,'meridian-po-'));
  report.executablePath=process.env.MERIDIAN_CHROMIUM || chromium.executablePath();
  browser=await chromium.launch({executablePath:report.executablePath,headless:process.env.MERIDIAN_HEADFUL !== '1',chromiumSandbox:true,downloadsPath:temporaryFileDirectory,
    args:['--enable-automation','--use-gl=angle','--use-angle=swiftshader']});
  const cdp=await browser.newBrowserCDPSession();
  const command=await cdp.send('Browser.getBrowserCommandLine');
  const disabled=command.arguments.filter(arg=>/^--(?:no-sandbox|disable-setuid-sandbox|disable-seccomp-filter-sandbox|disable-namespace-sandbox)(?:=|$)/.test(arg));
  assert.deepEqual(disabled,[],'sandbox must remain enabled');
  report.sandbox={requested:true,disabledFlags:disabled,argumentCount:command.arguments.length,method:'actual CDP Browser.getBrowserCommandLine'};
  await cdp.detach();
  report.browser=browser.version();
  context=await browser.newContext({viewport:{width:1200,height:1000},offline:true,serviceWorkers:'block',acceptDownloads:true});
  await context.route(/^https?:/,route=>{report.requests.push(route.request().url());return route.abort();});
  page=await context.newPage();
  page.on('pageerror',e=>report.pageerrors.push(e.message));
  page.on('dialog',async dialog=>{report.errors.push(`Unexpected dialog: ${dialog.message()}`);await dialog.dismiss();});
  let standalone=path.join(root,'gallery/designs/meridian-enterprise-purchase-order.html');
  report.sourceHtmlSha256=createHash('sha256').update(await fs.readFile(standalone)).digest('hex');
  if (process.env.MERIDIAN_FILE_DIR) {
    // Snap Chromium cannot read /srv. Test an identical standalone byte copy in
    // its existing readable data directory, then remove only this run's copy.
    const copy=path.join(temporaryFileDirectory,'purchase-order.html');await fs.copyFile(standalone,copy);standalone=copy;
  }
  report.fileUrl=pathToFileURL(standalone).href;
  report.testedHtmlSha256=createHash('sha256').update(await fs.readFile(standalone)).digest('hex');
  assert.equal(report.testedHtmlSha256,report.sourceHtmlSha256);
  await page.goto(report.fileUrl);
  await ready(6);
  for(const count of [0,6,20,100,200]) {
    await page.locator('#preset').selectOption(String(count)); await ready(count);
    const data=await page.evaluate(()=>window.MERIDIAN_RESULT.data);
    await scenario(`items-${count}`,data);
    if(count===6) {
      await page.locator('.physical_page_wrapper').first().screenshot({path:path.join(output,'sample-page-1.png')});
      await page.locator('.physical_page_wrapper').last().screenshot({path:path.join(output,'sample-terms.png')});
      await fs.copyFile(path.join(output,'sample-page-1.png'),path.join(root,'gallery/thumbs/meridian-enterprise-purchase-order.png'));
      report.barcodes=[];
      report.barcodes.push(await barcodePixels(page,page.locator('.po-barcode svg').first(),data.poNumber,path.join(output,'po-barcode.png')));
      for(let i=0;i<6;i++) report.barcodes.push(await barcodePixels(page,page.locator('.item-code svg').nth(i),data.items[i].barcode,path.join(output,`item-barcode-${i+1}.png`)));
      await overlapOracle(data);
    }
    if(count===200) {
      await page.locator('.physical_page_wrapper').first().screenshot({path:path.join(output,'200-first.png')});
      await page.locator('.physical_page_wrapper').nth(-2).screenshot({path:path.join(output,'200-last-items.png')});
    }
  }
  const long=preset(sample,20);
  long.items[0].description=Array.from({length:20},(_,i)=>`Multiline specification ${i+1}: fictional accessory.`).join('\n');
  long.items[9].description='Additional fictional detail.\n'.repeat(12);
  await edit(long); await scenario('long-multiline',long);
  const oversized=structuredClone(sample);oversized.items[0].description='Tall atomic line.\n'.repeat(400);
  report.oversizedError=await edit(oversized,true);
  assert.match(report.oversizedError,/atomic|unsplittable|height/i);
  for(const [name,modify] of [
    ['negative',d=>{d.items[0].quantity=-1;}],['discount',d=>{d.items[0].discount=101;}],
    ['nonfinite',d=>{d.items[0].unitPrice=Infinity;}],['201 items',d=>{d.items=preset(sample,200).items;d.items.push(sample.items[0]);}]
  ]) {
    const data=structuredClone(sample);modify(data); report.errorsExpected ||= [];
    report.errorsExpected.push({name,message:await edit(data,true)});
  }
  report.nonfiniteJsonError=await edit(JSON.stringify(sample).replace('"unitPrice":45','"unitPrice":1e999'),true);
  assert.match(report.nonfiniteJsonError,/finite/);
  report.invalidJson=await edit('{',true);
  // Literal HTML must stay text, including script-looking JSON import content.
  const injected=structuredClone(sample);delete injected.supplier.email;delete injected.reference;
  injected.items[0].description='<script>alert(1)</script>\n<img src=x onerror=alert(2)>';
  await page.locator('#import').setInputFiles({name:'literal.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(injected))});
  await ready(6);
  assert.equal(await page.locator('.description script,.description img').count(),0);
  assert.equal(await page.locator('.description').first().textContent(),injected.items[0].description);
  await scenario('injection-and-optional-contact',await page.evaluate(()=>window.MERIDIAN_RESULT.data));
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);
  const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.deepEqual(exported,await page.evaluate(()=>window.MERIDIAN_RESULT.data));
  report.jsonRoundtrip=true;
  await page.locator('#import').setInputFiles({name:'too-big.json',mimeType:'application/json',buffer:Buffer.alloc(1048577,32)});
  await page.waitForFunction(()=>document.body.dataset.state==='invalid');
  assert.match(await page.locator('#status').textContent(),/1 MiB/);
  report.oversizedFileBlocked=true;
  await page.locator('#reset').click();await ready(6);
  await page.locator('#add').click();await ready(7);
  await page.locator('#remove').click();await ready(6);
  await page.evaluate(async data=>{
    const a=structuredClone(data),b=structuredClone(data);a.items=[];b.items=b.items.slice(0,2);
    await Promise.all([window.Meridian.setData(a),window.Meridian.setData(b),window.Meridian.setData(data)]);
  },sample);
  await ready(6);await scenario('race-final',await page.evaluate(()=>window.MERIDIAN_RESULT.data));
  await page.locator('#preset').selectOption('200');await ready(200);
  await page.locator('#add').click();await page.waitForFunction(()=>document.body.dataset.state==='invalid');
  assert.match(await page.locator('#status').textContent(),/Maximum 200/);
  await page.locator('#reset').click();await ready(6);
  report.pendingPrint=await page.evaluate(async data=>{
    const pending=window.Meridian.setData(data);
    const observation={state:document.body.dataset.state,disabled:document.querySelector('#print').disabled,
      previewVisibility:getComputedStyle(document.querySelector('#preview')).visibility};
    await pending;return observation;
  },sample);
  assert.deepEqual(report.pendingPrint,{state:'pending',disabled:true,previewVisibility:'hidden'});
  await ready(6);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('#preview-scroll').evaluate(n=>n.scrollWidth>n.clientWidth),true);
  await page.locator('#editor-panel').evaluate(n=>{n.open=false;});
  await page.screenshot({path:path.join(output,'mobile-controls.png')});
  await page.locator('#preview-scroll').evaluate(n=>{n.scrollLeft=n.scrollWidth;});
  assert.ok(await page.locator('#preview-scroll').evaluate(n=>n.scrollLeft)>0);
  report.mobileScroll=true;report.controls=true;report.serialRace=true;
  await page.evaluate(()=>{window.print=()=>{window.TEST_PRINT_CALLS=(window.TEST_PRINT_CALLS||0)+1;};});
  await page.locator('#print').click();assert.equal(await page.evaluate(()=>window.TEST_PRINT_CALLS),1);
  await page.locator('#editor-panel').evaluate(n=>{n.open=true;});
  await page.locator('#editor').fill('{');
  assert.equal(await page.locator('#print').isDisabled(),true);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('#preview-scroll').isVisible(),false);
  assert.equal(await page.locator('.print-blocked').isVisible(),true);
  report.invalidNativePrintShowsOnlyBlockedNotice=true;
  await page.emulateMedia({media:'screen'});
  assert.deepEqual(report.requests,[]);assert.deepEqual(report.pageerrors,[]);assert.deepEqual(report.errors,[]);
  report.status='passed';
} catch(error) {
  report.status='failed';report.failure={message:error.message,stack:error.stack};
  if(page) {
    report.lastStatus=await page.locator('#status').textContent().catch(()=>null);
    await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});
  }
  process.exitCode=1;
} finally {
  report.finished=new Date().toISOString();
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  await context?.close();await browser?.close();
  if (temporaryFileDirectory) await fs.rm(temporaryFileDirectory,{recursive:true,force:true});
  console.log(JSON.stringify({status:report.status,output,scenarios:report.scenarios.map(s=>({name:s.name,pages:s.pages})),failure:report.failure?.message}));
}
