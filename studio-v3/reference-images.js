import { imageBounds,referenceError,previewSize,encodePreview } from './reference-limits.js';
import { imageHeader } from './reference-formats.js';

async function decodeImage(blob,scope) {
  if (typeof createImageBitmap==='function') {
    const pending=createImageBitmap(blob);
    pending.then(bitmap=> { if (scope.signal.aborted) bitmap.close(); },()=>{});
    return scope.wait(pending);
  }
  const url=URL.createObjectURL(blob), image=new Image();
  const stop=()=> { image.src=''; URL.revokeObjectURL(url); };
  const remove=scope.cleanup(stop);
  try {
    await scope.wait(new Promise((resolve,reject)=> { image.onload=resolve; image.onerror=()=>reject(referenceError('FILE_CORRUPT')); image.src=url; }));
    return image;
  } finally { remove(); URL.revokeObjectURL(url); }
}
export async function parseReferenceImage(bytes,mime,scope) {
  const header=imageHeader(bytes,mime); scope.check();
  const decoded=await decodeImage(new Blob([bytes],{type:mime}),scope);
  let canvas;
  try {
    scope.check();
    const width=decoded.naturalWidth || decoded.width,height=decoded.naturalHeight || decoded.height;
    imageBounds(width,height);
    // EXIF orientation can swap dimensions, but cannot expand the decoded pixel area.
    if (width*height!==header.width*header.height) throw referenceError('FILE_CORRUPT');
    const size=previewSize(width,height); canvas=document.createElement('canvas');
    canvas.width=size.width; canvas.height=size.height;
    const context=canvas.getContext('2d'); if (!context) throw referenceError('FILE_CORRUPT');
    context.fillStyle='#fff'; context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(decoded,0,0,canvas.width,canvas.height); scope.check();
    return {
      kind:'image',pageCount:1,sourcePixels:width*height,text:'',
      pages:[{number:1,width,height,rotation:0,coordinateSystem:'image-pixels',text:'',textItems:[],preview:encodePreview(canvas)}],
      warnings:['Image reference only. No OCR, text extraction or layout interpretation has been performed.']
    };
  } finally { decoded.close?.(); if (canvas) canvas.width=canvas.height=0; }
}
