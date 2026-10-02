import {deflateSync} from 'node:zlib';
const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAEAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDgqKKK9Y84/9k=','base64');
const hex=bytes=>bytes.toString('hex')+'>';
const pngPixels=Buffer.from(Array.from({length:4*4*3},(_,i)=>[22,58,101][i%3]));
function serialize(objects) {
 let source='%PDF-1.7\n';const offsets=[0];objects.forEach((object,i)=>{offsets.push(source.length);source+=`${i+1} 0 obj\n${object}\nendobj\n`;});const xref=source.length;
 source+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size ${objects.length+1} >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(source);
}
export function rasterPdf(kind='jpeg',{text=true}={}) {
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 1 /Kids [4 0 R] >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const count=kind==='multiple'?3:1,images=[],resources=[];
 for(let i=0;i<count;i++) {
  const id=6+images.length,isJpeg=kind==='jpeg',masked=kind==='mask',encoded=hex(isJpeg?jpeg:deflateSync(pngPixels));resources.push(`/Im${i} ${id} 0 R`);
  const dimensions=kind==='oversized'?4000:4;
  images.push(`<< /Type /XObject /Subtype /Image /Width ${dimensions} /Height ${dimensions} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /${isJpeg?'DCTDecode':'FlateDecode'}] ${masked?`/SMask ${id+1} 0 R`:''} /Length ${encoded.length} >>\nstream\n${encoded}\nendstream`);
  if(masked){const alpha=hex(deflateSync(Buffer.from(Array.from({length:16},(_,j)=>j*17))));images.push(`<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /Length ${alpha.length} >>\nstream\n${alpha}\nendstream`);}
 }
 const content=(text?'BT /F1 14 Tf 40 760 Td (FICTIONAL RASTER REFERENCE) Tj ET\n':'')+Array.from({length:count},(_,i)=>`q 100 0 0 100 ${40+i*120} 550 cm /Im${i} Do Q`).join('\n');
 objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> /XObject << ${resources.join(' ')} >> >> /Contents 5 0 R >>`,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,...images);
 return {name:`fictional-${kind}.pdf`,mimeType:'application/pdf',buffer:serialize(objects)};
}
