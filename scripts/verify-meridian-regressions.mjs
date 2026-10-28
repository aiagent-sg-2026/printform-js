// Local-only serial Gallery + representative unchanged-template regressions.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=await import('@playwright/test');
const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const output=path.resolve(process.argv[2]||path.resolve(root,'../artifacts',`regressions-${Date.now()}`));
await fs.mkdir(output,{recursive:true});
const report={started:new Date().toISOString(),scenarios:[],errors:[],external:[]};
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const target=path.resolve(root,`.${decodeURIComponent(url.pathname)}`);
    if(!target.startsWith(root)) {res.writeHead(403);res.end();return;}
    const bytes=await fs.readFile(target);
    res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');res.end(bytes);
  } catch {res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser,context;
try {
  report.executablePath=process.env.MERIDIAN_CHROMIUM || chromium.executablePath();
  browser=await chromium.launch({executablePath:report.executablePath,headless:process.env.MERIDIAN_HEADFUL !== '1',chromiumSandbox:true,
    args:['--enable-automation','--use-gl=angle','--use-angle=swiftshader']});
  const cdp=await browser.newBrowserCDPSession();
  const command=await cdp.send('Browser.getBrowserCommandLine');
  const disabled=command.arguments.filter(arg=>/^--(?:no-sandbox|disable-setuid-sandbox|disable-seccomp-filter-sandbox|disable-namespace-sandbox)(?:=|$)/.test(arg));
  assert.deepEqual(disabled,[]);
  report.sandbox={requested:true,disabledFlags:disabled,argumentCount:command.arguments.length};await cdp.detach();
  context=await browser.newContext({viewport:{width:1200,height:1000},serviceWorkers:'block'});
  await context.route('**/*',route=>{
    if(route.request().url().startsWith(base)||route.request().url().startsWith('data:')) return route.continue();
    report.external.push(route.request().url());return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${base}/gallery/index.html`);
  await page.waitForFunction(()=>document.querySelectorAll('.gallery-card').length===64);
  await page.locator('#category-filters [data-filter-value=purchasing]').click();
  assert.equal(await page.locator('.gallery-card').count(),7);
  await page.locator('#search').fill('PF-064');assert.equal(await page.locator('.gallery-card').count(),1);
  await page.locator('.gallery-card').click();
  await page.waitForFunction(()=>document.querySelector('iframe').contentWindow.MERIDIAN_READY===true);
  const frame=page.frames().find(f=>f.url().includes('meridian-enterprise'));
  assert.equal(await frame.locator('.printform_page').count(),2);
  assert.equal(await frame.locator('#print').isEnabled(),true);
  await page.waitForFunction(()=>document.querySelector('[data-print]').disabled===false);
  assert.equal(await page.locator('[data-print]').isEnabled(),true);
  await page.screenshot({path:path.join(output,'gallery-pf064.png')});
  await page.locator('[data-close]').click();
  report.scenarios.push({name:'Gallery PF-064 registration, purchasing filter and modal',cards:64,purchasing:7,pages:2});
  const designs=[
    {id:'sanyo-green-sales-quotation',query:'',rows:5,pages:1},
    {id:'sanyo-green-sales-quotation',query:'?overflow=1',rows:35},
    {id:'sanyo-blue-sales-quotation',query:'',rows:48,pages:5},
    {id:'modern-school-invoice',query:'?paper=A4&sample=short',school:true,pages:1},
    {id:'modern-school-invoice',query:'?paper=A4&sample=long',school:true}
  ];
  for(const [i,design] of designs.entries()) {
    await page.goto(`${base}/gallery/designs/${design.id}.html${design.query}`);
    await page.waitForFunction(s=>s?window.SCHOOL_READY===true:window.__printFormProcessed===true,Boolean(design.school));
    const count=await page.locator('.printform_page').count();
    if(design.pages) assert.equal(count,design.pages);else assert.ok(count>1);
    const selector=design.school?'[data-line-id]':'[data-sample-row]';
    const actual=await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>n.dataset.lineId||n.dataset.sampleRow));
    const expected=design.school?await page.evaluate(()=>window.SCHOOL_RESULT.lineIds):Array.from({length:design.rows},(_,n)=>String(n+1));
    assert.deepEqual(actual,expected);
    assert.equal(await page.locator(design.school?'[data-totals]':'#total').count(),1);
    const bytes=await page.pdf({path:path.join(output,`old-${i+1}.pdf`),preferCSSPageSize:true,printBackground:true});
    const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
    try {
      const pdf=await task.promise;assert.equal(pdf.numPages,count);
      let all='';
      for(let n=1;n<=count;n++) {
        const p=await pdf.getPage(n),v=p.getViewport({scale:1}),text=await p.getTextContent();
        assert.ok(Math.abs(v.width-595.28)<1 && Math.abs(v.height-841.89)<1);
        all+=text.items.map(t=>t.str||'').join('');
      }
      if(design.school) for(const id of expected) assert.equal(all.split(id).length-1,1);
    } finally {await task.destroy();}
    report.scenarios.push({name:design.id+design.query,pages:count,rows:actual.length});
  }
  assert.deepEqual(report.external,[]);assert.deepEqual(report.errors,[]);report.status='passed';
} catch(error) {report.status='failed';report.failure={message:error.message,stack:error.stack};process.exitCode=1;}
finally {
  report.finished=new Date().toISOString();
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  await context?.close();await browser?.close();await new Promise(resolve=>server.close(resolve));
  console.log(JSON.stringify(report));
}
