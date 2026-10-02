import { REFERENCE_LIMITS as L,referenceError,previewSize,encodePreview } from './reference-limits.js';

function geometry(item,viewport,util) {
  if (!Array.isArray(item.transform)||item.transform.length!==6||!item.transform.every(Number.isFinite)) return null;
  const transform=util.transform(viewport.transform,item.transform);
  if (!transform.every(n=>Number.isFinite(n)&&Math.abs(n)<=1_000_000)) return null;
  const width=Math.abs(item.width),height=Math.abs(item.height),x=transform[4],y=transform[5];
  if (![width,height].every(n=>Number.isFinite(n)&&n<=L.maxPdfPageEdge*10)) return null;
  // Baseline origin and the complete matrix preserve rotation; these are approximate text boxes.
  return {x,y,width,height,transform,direction:['ltr','rtl','ttb'].includes(item.dir) ? item.dir : 'ltr'};
}
async function extractText(page,viewport,pdfjs,budget,scope) {
  const reader=page.streamTextContent({includeMarkedContent:false}).getReader(),textItems=[];
  const cancel=()=> { void reader.cancel().catch(()=>{}); },remove=scope.cleanup(cancel);
  let done=false,truncated=false;
  try {
    while (!done) {
      const chunk=await scope.wait(reader.read()); done=chunk.done;
      for (const item of chunk.value?.items || []) {
        if (typeof item.str!=='string'||!item.str) continue;
        if (budget.items>=L.maxTextItems || budget.chars>=L.maxTextChars) { truncated=true; done=true; break; }
        const box=geometry(item,viewport,pdfjs.Util); if (!box) { budget.geometrySkipped=true; continue; }
        const text=item.str.slice(0,Math.min(L.maxTextItemChars,L.maxTextChars-budget.chars));
        if (text.length<item.str.length) truncated=true;
        textItems.push({text,...box,hasEOL:Boolean(item.hasEOL)}); budget.items++; budget.chars+=text.length;
      }
    }
  } finally { remove(); cancel(); }
  const text=textItems.map(item=>item.text+(item.hasEOL ? '\n' : ' ')).join('').trim();
  return {text,textItems,truncated};
}
export async function parseReferencePdf(bytes,scope,{mode='text'}={}) {
  if(!['text','visual'].includes(mode))throw referenceError('PDF_MODE');
  const {createPdfRuntime}=await scope.wait(import('./reference-pdf-runtime.js')); scope.check();
  let runtime,loading,render,canvas,destroyed=false,blockedResource=false;
  try { runtime=createPdfRuntime(); } catch { throw referenceError('PDF_WORKER'); }
  const stop=()=> {
    if (destroyed) return; destroyed=true; render?.cancel();
    try { const closing=loading?.destroy(); closing?.catch(()=>{}); } catch { /* already destroyed */ }
    runtime.destroy();
  };
  const remove=scope.cleanup(stop);
  class LocalOnlyDataFactory {
    async fetch() { blockedResource=true; throw referenceError('PDF_UNSUPPORTED'); }
  }
  try {
    const workerError=new Promise((_,reject)=>runtime.port.addEventListener('error',()=>reject(referenceError('PDF_WORKER')),{once:true}));
    loading=runtime.pdfjs.getDocument({
      data:bytes,worker:runtime.worker,verbosity:0,stopAtErrors:true,isEvalSupported:false,
      enableXfa:false,disableAutoFetch:true,disableStream:true,disableRange:true,
      useWorkerFetch:false,useWasm:false,BinaryDataFactory:LocalOnlyDataFactory,
      useSystemFonts:true,maxImageSize:mode==='visual'?L.maxPdfImagePixels:0,canvasMaxAreaInBytes:L.maxPreviewPixels*4,
      isOffscreenCanvasSupported:false,isImageDecoderSupported:false
    });
    const passwordError=new Promise((_,reject)=> { loading.onPassword=()=>reject(referenceError('PDF_ENCRYPTED')); });
    const pdf=await scope.wait(Promise.race([loading.promise,passwordError,workerError]));
    if (await scope.wait(pdf.getPermissions()) !== null) throw referenceError('PDF_ENCRYPTED');
    if (!Number.isInteger(pdf.numPages)||pdf.numPages<1||pdf.numPages>L.maxPdfPages) throw referenceError('PDF_PAGE_COUNT');
    const pages=[],warnings=[],budget={items:0,chars:0};
    for (let number=1;number<=pdf.numPages;number++) {
      scope.check(); const page=await scope.wait(pdf.getPage(number)),viewport=page.getViewport({scale:1});
      const {width,height}=viewport;
      if (![width,height].every(n=>Number.isFinite(n)&&n>0&&n<=L.maxPdfPageEdge)||width*height>L.maxPdfPageArea) throw referenceError('PDF_PAGE_SIZE');
      const extracted=await extractText(page,viewport,runtime.pdfjs,budget,scope);
      if (blockedResource) throw referenceError('PDF_UNSUPPORTED');
      if (extracted.truncated&&!warnings.includes('Text and geometry were truncated to the safe extraction limit.')) warnings.push('Text and geometry were truncated to the safe extraction limit.');
      if(mode==='text') {
        pages.push({number,width,height,rotation:page.rotate,coordinateSystem:'pdf-viewport-points',text:extracted.text,textItems:extracted.textItems,preview:null});page.cleanup();continue;
      }
      const size=previewSize(width*2,height*2),renderViewport=page.getViewport({scale:size.scale*2});
      canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.floor(renderViewport.width)); canvas.height=Math.max(1,Math.floor(renderViewport.height));
      render=page.render({canvas,viewport:renderViewport,background:'#fff',annotationMode:runtime.pdfjs.AnnotationMode.DISABLE});
      await scope.wait(Promise.race([render.promise,workerError])); scope.check();
      if (blockedResource) throw referenceError('PDF_UNSUPPORTED');
      pages.push({number,width,height,rotation:page.rotate,coordinateSystem:'pdf-viewport-points',text:extracted.text,textItems:extracted.textItems,preview:encodePreview(canvas)});
      canvas.width=canvas.height=0; canvas=null; render=null; page.cleanup();
    }
    const text=pages.map(page=>page.text).filter(Boolean).join('\n\n').slice(0,L.maxTextChars);
    if (!text && mode==='text')throw referenceError('PDF_NO_TEXT');
    if (!text) warnings.push('Image-only or outlined-text PDF. No OCR was performed; visual interpretation requires verified model image support.');
    if (budget.geometrySkipped) warnings.push('Invalid or out-of-range text geometry was omitted.');
    warnings.push(mode==='text'?'PDF text and approximate positions only. PDF appearance, embedded images and annotations are not rendered, inspected or sent. For visual analysis, attach again using Visual pages mode.':'Local PDF page previews. Input/page/per-image/output limits and worker timeout are best-effort controls, not a browser memory sandbox or an aggregate decoded-image guarantee. Annotations are not rendered.');
    return {kind:'pdf',processing:mode,pageCount:pages.length,sourcePixels:0,pages,text,warnings};
  } catch (error) {
    scope.check();
    if (error.code) throw error;
    if (/Image exceeded maximum allowed size/i.test(error.message || ''))throw referenceError('PDF_IMAGE_LIMIT');
    if (error.name==='PasswordException') throw referenceError('PDF_ENCRYPTED');
    if (blockedResource) throw referenceError('PDF_UNSUPPORTED');
    throw referenceError('FILE_CORRUPT');
  } finally { remove(); stop(); if (canvas) canvas.width=canvas.height=0; }
}
