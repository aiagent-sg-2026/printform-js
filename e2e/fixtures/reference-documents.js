// Fully synthetic, deterministic documents. No customer or financial documents.
export function syntheticPdf({pages=2,text=true,raster=null,blank=false}={}) {
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],refs=[];
  for(let page=0;page<pages;page++) {
    const id=objects.length+1;refs.push(`${id} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> ${raster && raster!=='inline'?`/XObject << /Im0 ${id+2} 0 R >>`:""} >> /Contents ${id+1} 0 R >>`);
    const imageContent=raster==='inline'?'q 40 0 0 40 40 550 cm BI /W 1 /H 1 /CS /RGB /BPC 8 /F /AHx ID FF0000> EI Q':raster?'q 40 0 0 40 40 550 cm /Im0 Do Q':'';
    const content=`${imageContent}\n${blank?'':'0.1 0.2 0.4 rg 40 650 515 55 re f'}\n${text?`BT /F1 18 Tf 40 760 Td (FICTIONAL REFERENCE ${page+1}) Tj ET\nBT /F1 10 Tf 40 725 Td (DEMO-REF-001 - Layout only) Tj ET`:''}`;
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    if(raster && raster!=='inline')objects.push(`<< /Type /XObject /Subtype /Image /Width ${raster==='negative'?-1:1} /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length 7 >>\nstream\nFF0000>\nendstream`);
  }
  objects[1]=`<< /Type /Pages /Count ${pages} /Kids [${refs.join(' ')}] >>`;
  let source='%PDF-1.7\n';const offsets=[0];
  objects.forEach((value,i)=>{offsets.push(source.length);source+=`${i+1} 0 obj\n${value}\nendobj\n`;});const xref=source.length;
  source+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size ${objects.length+1} >>\nstartxref\n${xref}\n%%EOF\n`;
  return {name:'fictional-reference.pdf',mimeType:'application/pdf',buffer:Buffer.from(source)};
}
export const syntheticPng=()=>({name:'fictional-reference.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGMQs0qFIwbiOAAhcwtRKvDn0gAAAABJRU5ErkJggg==','base64')});
