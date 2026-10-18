// Investigation smoke, not a print driver or a physical qualification checker.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {chromium, firefox, webkit} from '@playwright/test';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {newProject, designOf, compileProject} from '../studio-v3/model.js';
import {createStandaloneHtml} from '../studio-v2/core/exporter.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const near = (actual, expected, epsilon, label) => assert.ok(Math.abs(actual-expected)<epsilon, `${label}: ${actual} != ${expected}`);
const margins = {top:12, right:24, bottom:36, left:48};
const values = ['COMPAT-00007', 'SOURCE-0002.500'];

function projectFor(orientation, customSizeMm) {
  const initial = newProject('invoice', true), design = designOf(initial);
  initial.manifest.title = 'Fictional general print compatibility sheet';
  initial.sampleData = {reference:values[0], quantity:values[1]};
  initial.schema = {type:'object', additionalProperties:false, required:['reference','quantity'],
    properties:{reference:{type:'string'}, quantity:{type:'string'}}};
  design.title = 'General print compatibility';
  design.page = {paper:'CUSTOM', customSizeMm, orientation, margins};
  design.pageNumbers = false;
  design.blocks.header.enabled = true;
  design.header = ['reference','quantity'].map(id=>({id,label:id,pointer:`/${id}`,format:''}));
  return compileProject(initial, design);
}

async function inspectGeometry(page) {
  return page.evaluate(() => {
    const rect = node => {
      const r = node.getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
    };
    const sheet = document.querySelector('#pf-mount .physical_page_wrapper');
    const logical = sheet.querySelector('.printform_page'), style = getComputedStyle(sheet);
    return {status:document.documentElement.dataset.printformStatus,
      sheets:document.querySelectorAll('#pf-mount .physical_page_wrapper').length,
      sheet:rect(sheet), logical:rect(logical),
      padding:Object.fromEntries(['top','right','bottom','left'].map(side=>[side,parseFloat(style[`padding-${side}`])])),
      fields:[...sheet.querySelectorAll('[data-pf-text]')].map(node=>({text:node.textContent,rect:rect(node)})),
      pageRules:[...document.styleSheets].flatMap(sheet=>[...sheet.cssRules]).filter(rule=>rule.type===CSSRule.PAGE_RULE).map(rule=>rule.cssText),
      scaled:[sheet,logical].some(node=>{const s=getComputedStyle(node);return s.transform!=='none'||Number(s.zoom||1)!==1;})};
  });
}

function assertGeometry(geometry, sizeMm) {
  assert.equal(geometry.status,'ready'); assert.equal(geometry.sheets,1);
  assert.deepEqual(geometry.padding,margins); assert.equal(geometry.scaled,false);
  const width=sizeMm.width*96/25.4, height=sizeMm.height*96/25.4;
  near(geometry.sheet.width,width,0.1,'sheet width'); near(geometry.sheet.height,height,0.1,'sheet height');
  near(geometry.logical.width,width-margins.left-margins.right,0.1,'content width');
  near(geometry.logical.height,height-margins.top-margins.bottom,0.1,'content height');
  near(geometry.logical.x-geometry.sheet.x,margins.left,0.1,'left inset');
  near(geometry.logical.y-geometry.sheet.y,margins.top,0.1,'top inset');
  assert.deepEqual(geometry.fields.map(field=>field.text),values);
  for (const {rect} of geometry.fields) {
    assert.ok(rect.x>=geometry.logical.x-0.1 && rect.right<=geometry.logical.right+0.1);
    assert.ok(rect.y>=geometry.logical.y-0.1 && rect.bottom<=geometry.logical.bottom+0.1);
  }
}

async function inspectPdf(bytes) {
  const loading = getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
  try {
    const pdf = await loading.promise, pages = [];
    for (let i=1;i<=pdf.numPages;i++) {
      const page = await pdf.getPage(i), viewport = page.getViewport({scale:1});
      const text = await page.getTextContent();
      pages.push({widthPt:viewport.width,heightPt:viewport.height,
        items:text.items.filter(item=>item.str?.trim()).map(item=>({text:item.str,height:item.height,width:item.width,x:item.transform[4],y:item.transform[5]}))});
    }
    return pages;
  } finally { await loading.destroy(); }
}

export async function runPrintCompatibilityStudy({outputDir, runtimeDir=path.join(root,'site-dist/dist')}={}) {
  assert.ok(outputDir,'Supply an explicit local evidence directory');
  await mkdir(outputDir,{recursive:true});
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const installed = ['document','DOMParser','Node','HTMLElement','XMLSerializer'];
  const previous = new Map(installed.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for (const key of installed) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true,writable:true});
  const evidence = {purpose:'digital compatibility study, not physical certification',observedAt:new Date().toISOString(),
    runtimeFiles:{},browserLaunches:[],physicalCertified:false,coldTransportOfflineFileExecuted:false,cases:[]};
  try {
    const documentRuntime = await readFile(path.join(runtimeDir,'printform-document.js'),'utf8');
    const printform = await readFile(path.join(runtimeDir,'printform.js'),'utf8');
    evidence.runtimeFiles = {documentRuntime:digest(documentRuntime),printform:digest(printform)};
    const exports = [];
    for (const customSizeMm of [{width:180,height:240},{width:240,height:360}]) for (const orientation of ['portrait','landscape']) {
      const project = projectFor(orientation,customSizeMm), before = JSON.stringify(project);
      const result = await createStandaloneHtml(project,{runtimeSources:{documentRuntime,printform,runtimeVersion:'2.0.0'},networkDisabled:true,requireTrusted:true});
      assert.equal(JSON.stringify(project),before,'export must not mutate source');
      const stem = `${customSizeMm.width}x${customSizeMm.height}-${orientation}`;
      const file = path.join(outputDir,`${stem}.html`);
      await writeFile(file,result.html);
      exports.push({stem,orientation,file,htmlDigest:digest(result.html),
        sizeMm:orientation==='portrait'?customSizeMm:{width:customSizeMm.height,height:customSizeMm.width}});
    }
    for (const [engine,type] of Object.entries({chromium,firefox,webkit})) {
      const browser = await type.launch({headless:true,...(engine==='chromium'?{chromiumSandbox:true,args:['--enable-automation']}:{})});
      try {
        const launch = {engine,headless:true};
        evidence.browserLaunches.push(launch);
        if (engine==='chromium') {
          const session = await browser.newBrowserCDPSession();
          try {
            const {arguments:args} = await session.send('Browser.getBrowserCommandLine');
            Object.assign(launch,{chromiumSandboxRequested:true,cdpMethod:'Browser.getBrowserCommandLine',
              argumentCount:args.length,noSandboxArgumentPresent:args.some(arg=>arg==='--no-sandbox'||arg.startsWith('--no-sandbox='))});
            assert.equal(launch.noSandboxArgumentPresent,false,'Chromium must not launch with --no-sandbox');
          } finally { await session.detach(); }
        }
        // Transport is NOT set offline: this does not rerun or replace the known WebKit failure.
        const context = await browser.newContext();
        try {
          for (const exported of exports) {
            const page = await context.newPage(), networkRequests = [], pageErrors = [];
            await page.route(/^https?:/,route=>{networkRequests.push('blocked-http-request');return route.abort();});
            page.on('pageerror',error=>pageErrors.push(error.message));
            try {
              await page.goto(pathToFileURL(exported.file).href);
              await page.waitForFunction(()=>['ready','blocked'].includes(document.documentElement.dataset.printformStatus));
              const screen = await inspectGeometry(page); assertGeometry(screen,exported.sizeMm);
              await page.emulateMedia({media:'print'});
              const print = await inspectGeometry(page); assertGeometry(print,exported.sizeMm);
              assert.deepEqual(print.fields.map(field=>field.text),screen.fields.map(field=>field.text));
              assert.deepEqual(networkRequests,[]); assert.deepEqual(pageErrors,[]);
              const record = {engine,browserVersion:browser.version(),orientation:exported.orientation,sizeMm:exported.sizeMm,
                htmlFile:path.basename(exported.file),htmlDigest:exported.htmlDigest,screen,print,networkRequests,pageErrors,pdfs:[]};
              evidence.cases.push(record);
              if (engine==='chromium') {
                for (const preferCSSPageSize of [true,false]) {
                  const options = {preferCSSPageSize,scale:1,printBackground:true,displayHeaderFooter:false};
                  const bytes = await page.pdf(options), pages = await inspectPdf(bytes);
                  const filename = `${exported.stem}-${preferCSSPageSize?'css-size':'default-paper'}.pdf`;
                  await writeFile(path.join(outputDir,filename),bytes);
                  // Inspect actual Chromium PDF dictionaries, independently of DOM/CSS dimensions.
                  // This bounded probe does not claim to parse arbitrary compressed PDF object streams.
                  const mediaBoxes = [...bytes.toString('latin1').matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)]
                    .map(match=>match[1].trim().split(/\s+/).map(Number));
                  record.pdfs.push({file:filename,digest:digest(bytes),options,mediaBoxes,pages});
                  assert.equal(pages.length,1); assert.equal(mediaBoxes.length,1);
                  const physical = pages[0], [x0,y0,x1,y1] = mediaBoxes[0];
                  near(x1-x0,physical.widthPt,0.01,'MediaBox/PDF.js width');
                  near(y1-y0,physical.heightPt,0.01,'MediaBox/PDF.js height');
                  const text = physical.items.map(item=>item.text).join('').replace(/\s/gu,'');
                  for (const value of values) assert.equal(text.split(value).length-1,1,`PDF source token ${value}: ${text}`);
                  if (preferCSSPageSize) {
                    near(physical.widthPt,exported.sizeMm.width*72/25.4,1,'PDF width');
                    near(physical.heightPt,exported.sizeMm.height*72/25.4,1,'PDF height');
                    for (const item of physical.items) {
                      if (values.some(value=>value.includes(item.text))) near(item.height,9,0.1,'unscaled bound field text');
                      assert.ok(item.x>=margins.left*0.75-1 && item.x+item.width<=physical.widthPt-margins.right*0.75+1);
                      assert.ok(item.y>=margins.bottom*0.75-1 && item.y<=physical.heightPt-margins.top*0.75+1);
                    }
                  } else {
                    assert.ok(Math.abs(physical.widthPt-exported.sizeMm.width*72/25.4)>1 || Math.abs(physical.heightPt-exported.sizeMm.height*72/25.4)>1,
                      'default PDF paper must be reported separately, not accepted as CSS-size fidelity');
                    const sourceFont = physical.items.find(item=>item.text===values[0]).height;
                    if (exported.sizeMm.width>300 || exported.sizeMm.height>300) assert.ok(sourceFont<8,'oversize default-paper output actually shrinks');
                    else near(sourceFont,9,0.1,'smaller custom sheet is not enlarged');
                  }
                }
              }
            } finally { await page.close(); }
          }
        } finally { await context.close(); }
      } finally { await browser.close(); }
    }
    evidence.completedAt = new Date().toISOString();
    await writeFile(path.join(outputDir,'print-compatibility.json'),JSON.stringify(evidence,null,2)+'\n');
    return evidence;
  } catch (error) {
    evidence.failure = {name:error.name,message:error.message};
    await writeFile(path.join(outputDir,'print-compatibility.json'),JSON.stringify(evidence,null,2)+'\n');
    throw error;
  } finally {
    for (const [key,descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];
    }
    dom.window.close();
  }
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await runPrintCompatibilityStudy({outputDir:process.argv[2],runtimeDir:process.argv[3]});
  console.log(JSON.stringify({cases:result.cases.length,pdfs:result.cases.flatMap(item=>item.pdfs).length,outputDir:process.argv[2],physicalCertified:false}));
}
