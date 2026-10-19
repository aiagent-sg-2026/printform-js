// Bounded investigation assertions; not a physical barcode verifier.
import assert from 'node:assert/strict';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {decodeBarcodeRow} from '../tests/support/barcode-decode.js';
import {insets,headers} from './studio-v3-long-table-label-fixtures.mjs';

const compact = value => value.replace(/\s/gu,'');
const near = (value,expected,tolerance,label) => assert.ok(Math.abs(value-expected)<tolerance,`${label}: ${value} != ${expected}`);
export async function inspectPrintDom(page) {
  return page.evaluate(() => {
    const rect = node => { const r=node.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
    return {status:document.documentElement.dataset.printformStatus,result:window.__printInvestigationResult,
      source:JSON.parse(document.getElementById('pf-sample-data').textContent),
      pages:[...document.querySelectorAll('#pf-mount .physical_page_wrapper')].map(sheet=>{
        const logical=sheet.querySelector('.printform_page'),style=getComputedStyle(sheet);
        const rows=[...sheet.querySelectorAll('.prowitem_processed')];
        return {sheet:rect(sheet),logical:rect(logical),padding:Object.fromEntries(['top','right','bottom','left'].map(side=>[side,parseFloat(style[`padding-${side}`])])),
          headers:[...sheet.querySelectorAll('thead th')].map(node=>node.textContent),
          rows:rows.map(row=>({source:row.dataset.pfSourceRow,index:row.dataset.pfFragmentIndex,count:row.dataset.pfFragmentCount,
            cells:[...row.querySelectorAll('td')].map(cell=>cell.textContent),rect:rect(row)})),
          barcodes:[...sheet.querySelectorAll('svg[data-pf-barcode-svg], [data-pf-barcode] svg')].map(svg=>({rect:rect(svg),width:Number(svg.getAttribute('width')),height:Number(svg.getAttribute('height'))})),
          scaled:[sheet,logical,...sheet.querySelectorAll('svg')].some(node=>{for(let n=node;n&&sheet.contains(n);n=n.parentElement){const s=getComputedStyle(n);if(s.transform!=='none'||Number(s.zoom||1)!==1)return true;}return false;})};
      })};
  });
}
export function assertPrintDom(observed,fixture) {
  assert.deepEqual(observed.source,fixture.project.sampleData,'embedded source must remain unchanged');
  if(fixture.blocked) {
    assert.equal(observed.status,'blocked');
    const errors=observed.result?.validation?.errors || [];
    assert.ok(errors.some(error=>fixture.code ? error.code==='BARCODE_CONTENT_OVERFLOW' : error.code==='FORMAT_FAILURE'),JSON.stringify(errors));
    assert.ok(observed.pages.every(page=>!page.scaled),'blocked content must not silently scale');
    if(fixture.code) {
      const symbols=observed.pages.flatMap(page=>page.barcodes);assert.equal(symbols.length,1,'oversize symbol retained for blocked diagnosis, not dropped');
      near(symbols[0].rect.width,symbols[0].width,0.01,'blocked symbol remains fixed width');
      assert.ok(symbols[0].width>observed.pages[0].logical.width,'fixture exceeds whole content width');
    }
    return;
  }
  assert.equal(observed.status,'ready',JSON.stringify(observed.result?.validation));
  assert.ok(observed.pages.length>0 && observed.pages.length<=12,'bounded physical pages');
  for(const page of observed.pages) {
    assert.deepEqual(page.padding,insets); assert.equal(page.scaled,false);
    near(page.sheet.width,fixture.sizeMm.width*96/25.4,0.1,'sheet width');
    near(page.sheet.height,fixture.sizeMm.height*96/25.4,0.1,'sheet height');
    near(page.logical.x-page.sheet.x,insets.left,0.1,'left inset');
    near(page.logical.y-page.sheet.y,insets.top,0.1,'top inset');
    near(page.logical.width,page.sheet.width-insets.left-insets.right,0.1,'content width');
    near(page.logical.height,page.sheet.height-insets.top-insets.bottom,0.1,'content height');
    for(const node of [...page.rows,...page.barcodes]) {
      const r=node.rect,b=page.logical;
      assert.ok(r.x>=b.x-0.1&&r.right<=b.right+0.1&&r.y>=b.y-0.1&&r.bottom<=b.bottom+0.1,'content remains inside page');
    }
  }
  if(fixture.rows) {
    assert.ok(observed.pages.length>1,'long row must span multiple pages');
    for(const page of observed.pages) assert.deepEqual(page.headers,headers,'every continued page repeats table headers');
    const rows=observed.pages.flatMap(page=>page.rows), fragments=rows.filter(row=>row.count);
    assert.ok(fragments.length>1,'measured row continuation metadata');
    const firstSource=fragments[0].source, first=rows.filter(row=>row.source===firstSource);
    assert.deepEqual(first.map(row=>Number(row.index)),first.map((_,i)=>i));
    assert.ok(first.every(row=>Number(row.count)===first.length));
    for(let column=0;column<3;column++) {
      const actual=rows.map(row=>row.cells[column]).join('');
      const expected=fixture.rows.map(row=>Object.values(row)[column]).join('');
      assert.equal(actual,expected,`exact source order in column ${column}`);
    }
  } else {
    assert.equal(observed.pages.length,1); assert.equal(observed.pages[0].barcodes.length,1);
    const barcode=observed.pages[0].barcodes[0];
    near(barcode.rect.width,barcode.width,0.01,'fixed symbol width');
    near(barcode.rect.height,barcode.height,0.01,'fixed symbol height');
  }
}
export async function decodePrintPixels(page,fixture,file) {
  const png=await page.locator('#pf-mount [data-pf-barcode] svg').screenshot({path:file,scale:'css'});
  const row=await page.evaluate(async bytes=>{
    const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));
    const canvas=document.createElement('canvas'); canvas.width=bitmap.width;canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
    const pixels=ctx.getImageData(0,20,canvas.width,1).data;
    return Array.from({length:canvas.width},(_,i)=>pixels[i*4]+pixels[i*4+1]+pixels[i*4+2]<384?1:0);
  },[...png]);
  const value=decodeBarcodeRow(row,fixture.code.format);assert.equal(value,fixture.code.value);
  // Independent minimum run width, read from pixels rather than SVG attributes.
  const runs=row.join('').replace(/^0+|0+$/g,'').match(/1+|0+/g);
  const moduleWidth=Math.min(...runs.map(run=>run.length));assert.equal(moduleWidth,fixture.code.moduleWidth);
  return {file,value,moduleWidth,samples:row.length,method:'native PNG raster row -> independent checksum decoder',physicalScanner:false};
}
export async function inspectPrintPdf(bytes,fixture,dom) {
  const loading=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
  try {
    const pdf=await loading.promise,pages=[];
    for(let i=1;i<=pdf.numPages;i++) {
      const page=await pdf.getPage(i),viewport=page.getViewport({scale:1}),text=await page.getTextContent();
      pages.push({widthPt:viewport.width,heightPt:viewport.height,items:text.items.filter(item=>item.str?.trim()).map(item=>({text:item.str,x:item.transform[4],y:item.transform[5],width:item.width,height:item.height}))});
    }
    const mediaBoxes=[...bytes.toString('latin1').matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)].map(match=>match[1].trim().split(/\s+/).map(Number));
    assert.equal(pages.length,dom.pages.length,'PDF page tree equals actual DOM physical pages');assert.equal(mediaBoxes.length,pages.length);
    for(const [index,page] of pages.entries()) {
      const [x0,y0,x1,y1]=mediaBoxes[index];near(x1-x0,page.widthPt,0.01,'MediaBox width');near(y1-y0,page.heightPt,0.01,'MediaBox height');
      near(page.widthPt,fixture.sizeMm.width*72/25.4,1,'PDF custom width');near(page.heightPt,fixture.sizeMm.height*72/25.4,1,'PDF custom height');
      if(fixture.rows) for(const header of headers) assert.equal(compact(page.items.map(item=>item.text).join('')).split(compact(header)).length-1,1,'one exact header per PDF page');
      for(const item of page.items) {
        assert.ok(item.x>=insets.left*0.75-1&&item.x+item.width<=page.widthPt-insets.right*0.75+1,'PDF horizontal inset');
        assert.ok(item.y>=insets.bottom*0.75-1&&item.y<=page.heightPt-insets.top*0.75+1,'PDF vertical inset');
      }
      if(fixture.rows) {
        const actual=compact(page.items.map(item=>item.text).join(''));
        const expected=compact([...dom.pages[index].headers,...dom.pages[index].rows.flatMap(row=>row.cells)].join(''));
        assert.equal(actual,expected,'PDF exact per-page source/order/continuation text');
        for(const item of page.items.filter(item=>/LINE-|SOURCE-|MYR/.test(item.text))) near(item.height,9,0.1,'unscaled source font');
      }
    }
    if(fixture.code) assert.equal(compact(pages.flatMap(page=>page.items.map(item=>item.text)).join('')).split(fixture.code.value).length-1,1,'PDF exact supplied label text');
    let pixelDecode=null;
    if(fixture.code) {
      let canvasModule;
      try {canvasModule=await import('@napi-rs/canvas');}
      catch(error) {if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;pixelDecode={available:false,reason:'optional PDF.js canvas module unavailable'};}
      if(canvasModule) {
        const page=await pdf.getPage(1),viewport=page.getViewport({scale:96/72});
        const canvas=canvasModule.createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),ctx=canvas.getContext('2d');
        await page.render({canvasContext:ctx,viewport,canvas}).promise;
        const geometry=dom.pages[0],y=Math.round(geometry.barcodes[0].rect.y-geometry.sheet.y+20);
        const pixels=ctx.getImageData(0,y,canvas.width,1).data;
        const row=Array.from({length:canvas.width},(_,i)=>pixels[i*4]+pixels[i*4+1]+pixels[i*4+2]<384?1:0);
        const value=decodeBarcodeRow(row,fixture.code.format);assert.equal(value,fixture.code.value);
        const runs=row.join('').replace(/^0+|0+$/g,'').match(/1+|0+/g),moduleWidth=Math.min(...runs.map(run=>run.length));
        assert.equal(moduleWidth,fixture.code.moduleWidth);
        pixelDecode={available:true,method:'actual PDF bytes -> PDF.js canvas raster -> independent checksum decoder',value,moduleWidth,samples:row.length,physicalScanner:false};
      }
    }
    return {mediaBoxes,pages,pixelDecode};
  } finally { await loading.destroy(); }
}
