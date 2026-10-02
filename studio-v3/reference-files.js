import { REFERENCE_LIMITS as L,ReferenceFileError,referenceError,referenceScope } from './reference-limits.js';
import { detectReferenceFormat } from './reference-formats.js';
import { parseReferenceImage } from './reference-images.js';
export { REFERENCE_LIMITS,ReferenceFileError } from './reference-limits.js';
export const REFERENCE_ACCEPT='.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp';

function checkFile(file) {
  if (!file||typeof file.name!=='string'||!Number.isSafeInteger(file.size)||file.size<0||
      (typeof file.arrayBuffer!=='function'&&typeof FileReader==='undefined')) throw referenceError('FILE_INVALID');
  if (!file.size) throw referenceError('FILE_EMPTY');
  if (file.size>L.maxFileBytes) throw referenceError('FILE_TOO_LARGE');
}
async function readBytes(file,scope) {
  if (typeof file.arrayBuffer==='function') return new Uint8Array(await scope.wait(file.arrayBuffer()));
  const reader=new FileReader(),stop=()=>reader.abort(),remove=scope.cleanup(stop);
  try {
    return new Uint8Array(await scope.wait(new Promise((resolve,reject)=> {
      reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(referenceError('FILE_CORRUPT'));
      reader.onabort=()=>reject(referenceError('REFERENCE_CANCELLED')); reader.readAsArrayBuffer(file);
    })));
  } finally { remove(); }
}
// sourcePixels counts only standalone image decodes, never PDF embedded images.
export function referenceTotals(references=[]) {
  return references.reduce((total,attachment)=> {
    total.bytes+=attachment.bytes; total.pages+=attachment.pageCount;
    total.sourcePixels+=attachment.sourcePixels || 0; total.textChars+=attachment.text?.length || 0;
    for (const page of attachment.pages || []) {
      total.items+=page.textItems?.length || 0; total.previewBytes+=page.preview?.bytes || 0;
      total.previewPixels+=(page.preview?.width || 0)*(page.preview?.height || 0);
    }
    return total;
  },{bytes:0,pages:0,sourcePixels:0,textChars:0,items:0,previewBytes:0,previewPixels:0});
}
function checkBudget(references) {
  const t=referenceTotals(references);
  if (references.length>L.maxFiles) throw referenceError('FILE_COUNT');
  if (t.bytes>L.maxTotalBytes) throw referenceError('TOTAL_BYTES');
  if (!Object.values(t).every(n=>Number.isFinite(n)&&n>=0)||t.pages>L.maxTotalPages||
      t.sourcePixels>L.maxTotalSourcePixels||t.textChars>L.maxTotalTextChars||
      t.items>L.maxTotalTextItems||t.previewBytes>L.maxTotalPreviewBytes||t.previewPixels>L.maxTotalPreviewPixels)
    throw referenceError('REFERENCE_BUDGET');
  if (new TextEncoder().encode(JSON.stringify(references)).byteLength>L.maxOutputBytes) throw referenceError('REFERENCE_BUDGET');
}
/** Parse locally; does not upload, store, run PDF actions, or call an AI provider.
 * Strings are untrusted content and must be displayed with textContent, never innerHTML.
 * bytes is the source byte count; original binary data is deliberately not retained.
 */
export async function parseReferenceFile(file,{signal,pdfMode='text'}={}) {
  checkFile(file); const scope=referenceScope(signal);
  try {
    scope.check(); const bytes=await readBytes(file,scope); scope.check();
    if (bytes.byteLength!==file.size) throw referenceError('FILE_CORRUPT');
    const mime=detectReferenceFormat(bytes,file);
    if(mime==='application/pdf' && file.size>L.maxPdfFileBytes)throw referenceError('PDF_TOO_LARGE');
    const parsed=mime==='application/pdf'
      ? await (await scope.wait(import('./reference-pdf.js'))).parseReferencePdf(bytes,scope,{mode:pdfMode})
      : await parseReferenceImage(bytes,mime,scope);
    scope.check();
    const attachment={id:`reference-${crypto.randomUUID()}`,name:file.name.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,L.maxNameChars),mime,bytes:file.size,...parsed};
    checkBudget([attachment]); return attachment;
  } catch (error) { scope.check(); throw error instanceof ReferenceFileError ? error : referenceError('FILE_CORRUPT'); }
  finally { scope.close(); }
}
/** Atomic batch: rejects the complete batch on failure. Existing objects remain unchanged. */
export async function parseReferenceFiles(files,{signal,existing=[],pdfMode='text'}={}) {
  const selected=Array.from(files || []);
  if (!Array.isArray(existing)||selected.length+existing.length>L.maxFiles) throw referenceError('FILE_COUNT');
  selected.forEach(checkFile); checkBudget(existing);
  if (selected.reduce((n,file)=>n+file.size,referenceTotals(existing).bytes)>L.maxTotalBytes) throw referenceError('TOTAL_BYTES');
  const parsed=[];
  for (const file of selected) { parsed.push(await parseReferenceFile(file,{signal,pdfMode})); checkBudget([...existing,...parsed]); }
  return parsed;
}
