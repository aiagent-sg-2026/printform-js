// Digital investigation only. Never calls print(), native dialogs or devices.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {chromium,firefox,webkit} from '@playwright/test';
import {createStandaloneHtml} from '../studio-v2/core/exporter.js';
import {printInvestigationFixtures} from './studio-v3-long-table-label-fixtures.mjs';
import {inspectPrintDom,assertPrintDom,decodePrintPixels,inspectPrintPdf} from './studio-v3-long-table-label-inspection.mjs';

const digest=bytes=>`sha256:${createHash('sha256').update(bytes).digest('hex')}`;
export async function runLongTableLabelStudy({outputDir,runtimeDir}={}) {
  assert.ok(outputDir&&runtimeDir,'Supply explicit outputDir and built runtimeDir');
  await mkdir(outputDir,{recursive:true});
  const dom=new JSDOM('<!doctype html><html><body></body></html>');
  const installed=['document','DOMParser','Node','HTMLElement','XMLSerializer'];
  const previous=new Map(installed.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const key of installed) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true,writable:true});
  const evidence={purpose:'bounded long-row and fixed-module label digital investigation',observedAt:new Date().toISOString(),
    runtimeDir:path.resolve(runtimeDir),runtimeFiles:{},browserLaunches:[],exports:[],cases:[],physicalCertified:false,
    coldTransportOfflineFileExecuted:false,transportOffline:false,httpPolicy:'abort every HTTP(S) request',nativePrintInvoked:false};
  try {
    const documentRuntime=await readFile(path.join(runtimeDir,'printform-document.js'),'utf8');
    const printform=await readFile(path.join(runtimeDir,'printform.js'),'utf8');
    evidence.runtimeFiles={documentRuntime:digest(documentRuntime),printform:digest(printform)};
    const fixtures=printInvestigationFixtures();
    for(const fixture of fixtures) {
      const before=JSON.stringify(fixture.project);
      const exported=await createStandaloneHtml(fixture.project,{runtimeSources:{documentRuntime,printform,runtimeVersion:'2.0.0'},networkDisabled:true,requireTrusted:true});
      assert.equal(JSON.stringify(fixture.project),before,'export cannot mutate project');
      fixture.file=path.join(outputDir,`${fixture.id}.html`);await writeFile(fixture.file,exported.html);
      evidence.exports.push({id:fixture.id,htmlFile:path.basename(fixture.file),digest:digest(exported.html),sourceUnchanged:true,
        sourceDigest:digest(before),sizeMm:fixture.sizeMm,orientation:fixture.orientation,expectedStatus:fixture.blocked?'blocked':'ready',code:fixture.code});
    }
    for(const [engine,type] of Object.entries({chromium,firefox,webkit})) {
      const browser=await type.launch({headless:true,...(engine==='chromium'?{chromiumSandbox:true,args:['--enable-automation']}:{})});
      try {
        const launch={engine,browserVersion:browser.version(),headless:true};evidence.browserLaunches.push(launch);
        if(engine==='chromium') {
          const session=await browser.newBrowserCDPSession();
          try {
            const {arguments:args}=await session.send('Browser.getBrowserCommandLine');
            Object.assign(launch,{chromiumSandboxRequested:true,cdpMethod:'Browser.getBrowserCommandLine',argumentCount:args.length,
              noSandboxArgumentPresent:args.some(arg=>arg==='--no-sandbox'||arg.startsWith('--no-sandbox='))});
            assert.equal(launch.noSandboxArgumentPresent,false);
          } finally {await session.detach();}
        }
        // Deliberately NOT offline:true: never reruns/relabels the original WebKit cold failure.
        const context=await browser.newContext({viewport:{width:1100,height:900},deviceScaleFactor:1});
        try {
          for(const fixture of fixtures) {
            const page=await context.newPage(),networkRequests=[],pageErrors=[];
            const record={id:fixture.id,engine,browserVersion:browser.version(),networkRequests,pageErrors,pdf:null,pixels:[]};evidence.cases.push(record);
            try {
              page.setDefaultTimeout(20000);
              await page.route(/^https?:/,route=>{networkRequests.push('blocked-http-request');return route.abort();});
              page.on('pageerror',error=>pageErrors.push(error.message));
              await page.addInitScript(()=>window.addEventListener('printform:rendered',event=>{window.__printInvestigationResult=event.detail;}));
              await page.goto(pathToFileURL(fixture.file).href);
              await page.waitForFunction(()=>['ready','blocked'].includes(document.documentElement.dataset.printformStatus));
              record.screen=await inspectPrintDom(page);assertPrintDom(record.screen,fixture);
              await page.emulateMedia({media:'print'});
              record.print=await inspectPrintDom(page);assertPrintDom(record.print,fixture);
              const flow = observed=>observed.pages.map(item=>item.rows.map(({rect,...row})=>({...row,
                rect:{...rect,y:rect.y-item.logical.y,bottom:rect.bottom-item.logical.y}})));
              assert.deepEqual(flow(record.print),flow(record.screen),'print media preserves page-relative source rows and geometry');
              assert.deepEqual(networkRequests,[]);assert.deepEqual(pageErrors,[]);
              if(!fixture.blocked&&fixture.code) {
                const file=path.join(outputDir,`${fixture.id}-${engine}-print.png`);
                const decoded=await decodePrintPixels(page,fixture,file);record.pixels.push({...decoded,file:path.basename(file)});
              }
              if(!fixture.blocked&&engine==='chromium') {
                const options={preferCSSPageSize:true,scale:1,printBackground:true,displayHeaderFooter:false};
                const bytes=await page.pdf(options),file=`${fixture.id}.pdf`;await writeFile(path.join(outputDir,file),bytes);
                record.pdf={file,digest:digest(bytes),options,...await inspectPrintPdf(bytes,fixture,record.print)};
              }
              record.completed=true;
            } catch(error) {
              record.failure={name:error.name,message:error.message};throw error;
            } finally {await page.close();}
          }
        } finally {await context.close();}
      } finally {await browser.close();}
    }
    evidence.completedAt=new Date().toISOString();return evidence;
  } catch(error) {
    evidence.failure={name:error.name,message:error.message};throw error;
  } finally {
    await writeFile(path.join(outputDir,'long-table-label-printing.json'),JSON.stringify(evidence,null,2)+'\n');
    for(const [key,descriptor] of previous) {if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
    dom.window.close();
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const result=await runLongTableLabelStudy({outputDir:process.argv[2],runtimeDir:process.argv[3]});
  console.log(JSON.stringify({cases:result.cases.length,pdfs:result.cases.filter(item=>item.pdf).length,physicalCertified:false,outputDir:process.argv[2]}));
}
