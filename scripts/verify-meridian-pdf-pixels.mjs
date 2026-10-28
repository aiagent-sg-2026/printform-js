// Bounded default-fixture proof: real PDF raster pixels, never production SVG.
// Requires Poppler's pdftoppm and the existing PDF.js canvas dependency.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {decodeBarcodeRow} from '../tests/support/barcode-decode.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=path.resolve(process.argv[2]||path.resolve(root,'../artifacts/verification-final'));
const sample=JSON.parse(await fs.readFile(path.join(root,'gallery/designs/assets/meridian/sample.json'),'utf8'));
const source=path.join(directory,'items-6.pdf'),bytes=await fs.readFile(source);
for(const [page,name] of [[1,'pdf-page-1'],[2,'pdf-terms']])
  execFileSync('pdftoppm',['-r','96','-f',String(page),'-singlefile','-png',source,path.join(directory,name)]);
const image=await loadImage(path.join(directory,'pdf-page-1.png'));
const canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
const report={source,pdfSha256:createHash('sha256').update(bytes).digest('hex'),
  method:'Chromium PDF -> pdftoppm 96dpi -> cropped pixel rows -> independent decodeBarcodeRow',
  checksumAndQuietZones:true,physicalCertified:false,barcodes:[]};
try {
  const pdf=await task.promise,page=await pdf.getPage(1),viewport=page.getViewport({scale:1});
  const text=(await page.getTextContent()).items;
  for(const [label,expected] of [[sample.poNumber,sample.poNumber],...sample.items.map(item=>[item.code,item.barcode])]) {
    const matches=text.filter(item=>item.str===label);assert.equal(matches.length,1,'unique printed label');
    const printed=matches[0],po=label===sample.poNumber;
    // PDF text positions locate the known sample's barcode strip. Only raster
    // pixels enter the decoder; label strings are expected-value assertions.
    const x=po?0:Math.floor(printed.transform[4]*96/72)-5;
    const y=Math.round((viewport.height-printed.transform[5])*96/72+14);
    const width=po?image.width:150;
    const pixels=ctx.getImageData(x,y,width,1).data;
    const row=Array.from({length:width},(_,i)=>pixels[i*4]+pixels[i*4+1]+pixels[i*4+2]<384?1:0);
    const decoded=decodeBarcodeRow(row,'CODE128');assert.equal(decoded,expected);
    report.barcodes.push({label,decoded,crop:{x,y,width,height:1}});
  }
  report.status='passed';
} finally {await task.destroy();}
await fs.writeFile(path.join(directory,'pdf-barcode-pixels.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
