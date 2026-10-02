import { imageBounds,referenceError } from './reference-limits.js';
const ascii=(b,start,length)=>String.fromCharCode(...b.subarray(start,start+length));
const u24=(b,p)=>b[p]+(b[p+1]<<8)+(b[p+2]<<16);
const pngSignature=[137,80,78,71,13,10,26,10];
const mimeExtensions={'application/pdf':['pdf'],'image/png':['png'],'image/jpeg':['jpg','jpeg','jpe'],'image/webp':['webp']};
export function detectReferenceFormat(bytes,file={}) {
  let mime;
  if (bytes.length>=8 && pngSignature.every((v,i)=>bytes[i]===v)) mime='image/png';
  else if (bytes.length>=4 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) mime='image/jpeg';
  else if (bytes.length>=16 && ascii(bytes,0,4)==='RIFF' && ascii(bytes,8,4)==='WEBP') mime='image/webp';
  else if (bytes.length>=8 && /^%PDF-[12]\.\d/.test(ascii(bytes,0,8))) mime='application/pdf';
  else throw referenceError('FILE_UNSUPPORTED');
  const declared=String(file.type || '').toLowerCase().split(';')[0].trim();
  if (declared && declared!=='application/octet-stream' && declared!==mime) throw referenceError('FILE_MISMATCH');
  const name=String(file.name || ''), extension=name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (extension && !mimeExtensions[mime].includes(extension)) throw referenceError('FILE_MISMATCH');
  return mime;
}
export function imageHeader(bytes,mime) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); let width,height;
  if (mime==='image/png') {
    if (bytes.length<33 || ascii(bytes,12,4)!=='IHDR' || view.getUint32(8)!==13) throw referenceError('FILE_CORRUPT');
    width=view.getUint32(16); height=view.getUint32(20);
    for (let p=8;p+12<=bytes.length;) {
      const size=view.getUint32(p); if (p+12+size>bytes.length) throw referenceError('FILE_CORRUPT');
      if (ascii(bytes,p+4,4)==='acTL') throw referenceError('IMAGE_ANIMATED');
      p+=12+size;
    }
  } else if (mime==='image/jpeg') {
    const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
    for (let p=2;p<bytes.length;) {
      if (bytes[p++]!==255) throw referenceError('FILE_CORRUPT');
      while (p<bytes.length && bytes[p]===255) p++;
      const marker=bytes[p++];
      if (marker===0xda || marker===0xd9) break;
      if (marker===0x01 || (marker>=0xd0 && marker<=0xd7)) continue;
      if (p+2>bytes.length) throw referenceError('FILE_CORRUPT');
      const size=view.getUint16(p); if (size<2 || p+size>bytes.length) throw referenceError('FILE_CORRUPT');
      if (sof.has(marker)) { if (size<8) throw referenceError('FILE_CORRUPT'); height=view.getUint16(p+3); width=view.getUint16(p+5); break; }
      p+=size;
    }
  } else if (mime==='image/webp') {
    if (view.getUint32(4,true)+8!==bytes.length) throw referenceError('FILE_CORRUPT');
    const kind=ascii(bytes,12,4), size=view.getUint32(16,true);
    if (20+size>bytes.length) throw referenceError('FILE_CORRUPT');
    if (kind==='VP8X' && size>=10) {
      if (bytes[20]&2) throw referenceError('IMAGE_ANIMATED');
      width=u24(bytes,24)+1; height=u24(bytes,27)+1;
    } else if (kind==='VP8 ' && size>=10 && bytes[23]===0x9d && bytes[24]===1 && bytes[25]===0x2a) {
      width=view.getUint16(26,true)&0x3fff; height=view.getUint16(28,true)&0x3fff;
    } else if (kind==='VP8L' && size>=5 && bytes[20]===0x2f) {
      const packed=view.getUint32(21,true); width=(packed&0x3fff)+1; height=((packed>>>14)&0x3fff)+1;
    }
  }
  imageBounds(width,height); return {width,height};
}
