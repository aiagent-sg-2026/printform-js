import { pixelDisclosure } from './observation-policy.js';
import { fail } from './ai-edits.js';
import { REFERENCE_LIMITS } from './reference-limits.js';
import { canonicalObservation } from './observation-policy.js';
import { sha256 } from '../studio-v2/core/json.js';

function assertPngChunks(bytes) {
  const view = new DataView(bytes.buffer), bad = ()=> { throw fail('OBSERVATION_PIXELS_LIMIT'); };
  let offset = 8, data = false, ended = false;
  while (offset<bytes.length) {
    if (offset+12>bytes.length) bad();
    const length = view.getUint32(offset), end = offset+8+length;
    if (end+4>bytes.length) bad();
    const type = String.fromCharCode(...bytes.slice(offset+4,offset+8));
    if (!/^[A-Za-z]{4}$/.test(type) || (offset===8 && (type!=='IHDR' || length!==13)) || (offset!==8 && type==='IHDR')) bad();
    let crc = 0xffffffff;
    for (let i=offset+4;i<end;i++) { crc ^= bytes[i]; for (let bit=0;bit<8;bit++) crc = (crc>>>1)^((crc&1) ? 0xedb88320 : 0); }
    if (((crc^0xffffffff)>>>0)!==view.getUint32(end)) bad();
    if (type==='IDAT' && length>0) data = true;
    if (type==='IEND') { if (length!==0 || end+4!==bytes.length) bad(); ended = true; }
    offset = end+4;
  }
  if (!data || !ended) bad();
}

export async function validatePixelImage(image) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(image?.dataUrl || '');
  if (!match || match[1].length > Math.ceil(REFERENCE_LIMITS.maxPreviewBytes/3)*4) throw fail('OBSERVATION_PIXELS_LIMIT');
  let binary; try { binary = atob(match[1]); } catch { throw fail('OBSERVATION_PIXELS_LIMIT'); }
  const bytes = Uint8Array.from(binary,char=>char.charCodeAt(0)), view = new DataView(bytes.buffer);
  if (bytes.length<33 || bytes.length>REFERENCE_LIMITS.maxPreviewBytes || bytes.slice(0,8).join(',') !== '137,80,78,71,13,10,26,10' ||
      bytes.slice(12,16).join(',') !== '73,72,68,82' || view.getUint32(16)!==image.width || view.getUint32(20)!==image.height ||
      !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height) || image.width<1 || image.height<1 ||
      Math.max(image.width,image.height)>REFERENCE_LIMITS.maxPreviewEdge || image.width*image.height>REFERENCE_LIMITS.maxPreviewPixels) throw fail('OBSERVATION_PIXELS_LIMIT');
  assertPngChunks(bytes);
  const digest = await crypto.subtle.digest('SHA-256',bytes);
  return {data:match[1],bytes:bytes.length,contentDigest:Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')};
}

// Only this host-owned service holds PNG bytes. Metadata is returned to Pi; the provider receives a guarded image input.
export function createPixelEvidence(run,capturePixels) {
  let latest = null;
  const state = ()=>({...run.readObservationHost(),runId:run.runId});
  const authorized = ()=> { run.signal.throwIfAborted(); return pixelDisclosure(run.authorization,state(),run.draft.version); };
  return {
    clear() { latest = null; },
    current() {
      if (!latest) return null;
      authorized(); run.observations.requireLatest(latest.observation.id); return latest;
    },
    async retrieve(input,toolCallId) {
      const {observationId,pageIndex} = input, crop = input.crop ? Object.freeze({...input.crop}) : undefined;
      authorized(); run.observations.requireLatest(observationId);
      if (!Number.isSafeInteger(pageIndex) || pageIndex<0 || (crop && (![crop.x,crop.y,crop.width,crop.height].every(Number.isSafeInteger) || crop.x<0 || crop.y<0 || crop.width<1 || crop.height<1))) throw fail('OBSERVATION_PIXELS_BOUNDS');
      if (!capturePixels) throw fail('OBSERVATION_PIXELS_UNSUPPORTED');
      latest = null; run.observationKind = 'page-pixels';
      const id = `evidence-${crypto.randomUUID()}`; let data;
      const observed = await run.observations.capture(async candidate=> {
        const image = await capturePixels(candidate,{pageIndex,crop},run.signal); authorized();
        const validated = await validatePixelImage(image); authorized(); data = validated.data;
        if (image.pageIndex!==pageIndex || image.renderer!=='dom-raster/v1' || !Number.isFinite(image.scale) || image.scale<=0 || image.scale>1 ||
            !image.crop || ![image.crop.x,image.crop.y,image.crop.width,image.crop.height].every(Number.isSafeInteger) ||
            image.width!==Math.max(1,Math.floor(image.crop.width*image.scale)) || image.height!==Math.max(1,Math.floor(image.crop.height*image.scale)) ||
            (crop && ['x','y','width','height'].some(key=>image.crop[key]!==crop[key]))) throw fail('OBSERVATION_PIXELS_BOUNDS');
        const selectionDigest = await sha256(canonicalObservation(state().selectedTargets || [])); authorized();
        return {version:1,sourceObservationId:observationId,evidence:{id,mediaType:'image/png',bytes:validated.bytes,contentDigest:validated.contentDigest,selectionDigest,
          width:image.width,height:image.height,scale:image.scale,pageIndex:image.pageIndex,crop:image.crop,renderer:image.renderer}};
      },{evidenceRefs:[id]});
      authorized();
      const result = {...observed.content,observation:observed.receipt};
      latest = Object.freeze({observation:observed.receipt,evidence:observed.content.evidence,toolCallId,args:Object.freeze({observationId,pageIndex,...(crop ? {crop} : {})}),output:JSON.stringify(result),data});
      run.evidence = true; return result;
    }
  };
}
