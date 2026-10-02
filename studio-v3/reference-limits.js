// All attachment data stays in memory. Limits also apply to programmatic callers.
export const REFERENCE_LIMITS = Object.freeze({
  maxFiles:4, maxFileBytes:10*1024*1024, maxTotalBytes:20*1024*1024,
  maxPdfPages:4,maxPdfFileBytes:5*1024*1024,maxPdfImagePixels:12_000_000, maxTotalPages:12, maxImageEdge:8192, maxImagePixels:24_000_000,
  maxTotalSourcePixels:48_000_000, maxPdfPageEdge:2000, maxPdfPageArea:4_000_000,
  maxPreviewEdge:1280, maxPreviewPixels:1_000_000, maxTotalPreviewPixels:8_000_000,
  maxPreviewBytes:1024*1024, maxTotalPreviewBytes:6*1024*1024,
  maxTextChars:20_000, maxTotalTextChars:40_000, maxTextItems:2000,
  maxTotalTextItems:4000, maxTextItemChars:2000, maxOutputBytes:10*1024*1024,
  timeoutMs:20_000, maxNameChars:160
});
const MESSAGES = {
  FILE_INVALID:'Choose a local PDF, PNG, JPEG or WebP file.',
  FILE_EMPTY:'The reference file is empty.',
  FILE_TOO_LARGE:'Each reference must be 10 MiB or smaller.',
  FILE_COUNT:'Attach no more than 4 references.',
  TOTAL_BYTES:'References must total 20 MiB or less.',
  FILE_UNSUPPORTED:'Only PDF, PNG, JPEG and WebP references are supported.',
  FILE_MISMATCH:'The file extension or media type does not match its actual bytes.',
  FILE_CORRUPT:'The reference is damaged or could not be decoded.',
  IMAGE_TOO_LARGE:'Image dimensions exceed 8192 px per side or 24 million pixels.',
  IMAGE_ANIMATED:'Animated images are not supported. Export a still image first.',
  PDF_ENCRYPTED:'Encrypted PDFs are not supported. Export an unencrypted copy.',
  PDF_PAGE_COUNT:'A PDF reference may contain no more than 4 pages.',
  PDF_PAGE_SIZE:'PDF pages must be no larger than 2000 points per side.',
  PDF_UNSUPPORTED:'This PDF needs unsupported resources. Export its pages as PNG/JPEG/WebP references.',
  PDF_NO_TEXT:'No extractable PDF text was found. Choose Visual pages mode and attach again, or use PNG/JPEG/WebP. No OCR is performed.',
  PDF_MODE:'Choose Text & positions or Visual pages for PDF reading.',
  PDF_TOO_LARGE:'PDF references must be 5 MiB or smaller.',
  PDF_IMAGE_LIMIT:'An embedded PDF image exceeds the 12-million-pixel limit. Use Text & positions mode or a lower-resolution PDF.',
  PDF_WORKER:'The local PDF worker could not start. Reload the page and retry.',
  REFERENCE_BUDGET:'The references exceed the combined page, text, image or output budget.',
  PREVIEW_TOO_LARGE:'The decoded preview exceeds the safe image limit.',
  REFERENCE_TIMEOUT:'Reference processing exceeded 20 seconds. Use a smaller or simpler file.',
  REFERENCE_CANCELLED:'Reference processing was cancelled.'
};
export class ReferenceFileError extends Error {
  constructor(code) { super(MESSAGES[code] || MESSAGES.FILE_CORRUPT); this.name='ReferenceFileError'; this.code=code; }
}
export const referenceError = code=>new ReferenceFileError(code);
export function referenceScope(signal) {
  const controller=new AbortController(), cleaners=new Set();
  const abort=code=> { if (!controller.signal.aborted) controller.abort(referenceError(code)); };
  const outerAbort=()=>abort('REFERENCE_CANCELLED');
  if (signal?.aborted) outerAbort(); else signal?.addEventListener('abort',outerAbort,{once:true});
  const timer=setTimeout(()=>abort('REFERENCE_TIMEOUT'),REFERENCE_LIMITS.timeoutMs);
  controller.signal.addEventListener('abort',()=> { for (const clean of cleaners) clean(); },{once:true});
  return {
    signal:controller.signal,
    check() { if (controller.signal.aborted) throw controller.signal.reason; },
    cleanup(fn) { cleaners.add(fn); return ()=>cleaners.delete(fn); },
    async wait(promise) {
      this.check();
      let stop;
      const aborted=new Promise((_,reject)=> { stop=()=>reject(controller.signal.reason); controller.signal.addEventListener('abort',stop,{once:true}); });
      try { return await Promise.race([promise,aborted]); }
      finally { controller.signal.removeEventListener('abort',stop); }
    },
    close() { clearTimeout(timer); signal?.removeEventListener('abort',outerAbort); cleaners.clear(); }
  };
}
export function previewSize(width,height) {
  const l=REFERENCE_LIMITS, scale=Math.min(1,l.maxPreviewEdge/Math.max(width,height),Math.sqrt(l.maxPreviewPixels/(width*height)));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale)),scale};
}
export function imageBounds(width,height) {
  const l=REFERENCE_LIMITS;
  if (!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1) throw referenceError('FILE_CORRUPT');
  if (width>l.maxImageEdge||height>l.maxImageEdge||width*height>l.maxImagePixels) throw referenceError('IMAGE_TOO_LARGE');
}
export function encodePreview(canvas) {
  const dataUrl=canvas.toDataURL('image/jpeg',0.78), payload=dataUrl.split(',')[1] || '';
  const bytes=Math.floor(payload.length*3/4)-(payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
  if (!dataUrl.startsWith('data:image/jpeg;base64,')||!bytes) throw referenceError('FILE_CORRUPT');
  if (bytes>REFERENCE_LIMITS.maxPreviewBytes) throw referenceError('PREVIEW_TOO_LARGE');
  return {dataUrl,mime:'image/jpeg',width:canvas.width,height:canvas.height,bytes};
}
