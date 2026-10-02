const MAX_TEXT = 12000, MAX_ITEMS = 60, MAX_MEDIA_BYTES = 8 * 1024 * 1024;
export function referenceProjection(files=[],visual=false) {
  if (files.length > 4) throw new Error('Use at most four reference files.');
  let remaining=MAX_TEXT, mediaBytes=0, remainingItems=MAX_ITEMS;
  const media=[], references=files.map(file=>{
    if(file.kind==='pdf' && file.processing!=='visual' && !file.text?.trim()) throw new Error('PDF references need extractable text. Export scanned pages as separate images.');
    if (file.kind==='pdf' && file.processing!=='visual' && visual) throw new Error('PDF references support text and positions only. Export page images separately for visual analysis.');
    const useImages=file.kind==='image' || file.processing==='visual';
    const pages=file.pages.map(page=>{
      const text=String(page.text || '').slice(0,remaining); remaining-=text.length;
      const items=(page.textItems || []).slice(0,remainingItems); remainingItems-=items.length;
      if (useImages) {
        const url=page.preview?.dataUrl;
        if (typeof url !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(url)) throw new Error('Reference preview is unavailable. Remove and add the file again.');
        mediaBytes+=url.length; if(mediaBytes>MAX_MEDIA_BYTES) throw new Error('Reference images exceed the sharing budget. Use fewer pages.');
        media.push({type:'input_image',image_url:url});
      }
      return {number:page.number,width:page.width,height:page.height,text,items:items.map(item=>({text:String(item.text).slice(0,40),x:item.x,y:item.y,width:item.width,height:item.height}))};
    });
    return {id:file.id,name:file.name,mime:file.mime,pageCount:file.pageCount,mode:useImages?'visual-pages':'extracted-text-and-positions',warnings:[...(file.warnings || []),...(pages.some((page,i)=>page.text.length<(file.pages[i].text || '').length || page.items.length<(file.pages[i].textItems || []).length)?['Sharing is limited to the first 12,000 text characters and 60 positioned text items across all references.']:[])],pages};
  });
  if(media.length>4) throw new Error('Send at most four reference images.');
  return {references,media,mediaBytes};
}
export { imageCapability } from './model-capabilities.js';
