// This function is embedded in the existing opaque-origin preview bridge; it has no Studio/global dependencies.
export async function capturePagePixels({pageIndex,crop},pages,limits) {
  const reject = code=> { throw Object.assign(new Error(code),{code}); };
  const page = pages[pageIndex];
  if (!Number.isSafeInteger(pageIndex) || !page) reject('OBSERVATION_PIXELS_BOUNDS');
  const rect = page.getBoundingClientRect(), area = crop || {x:0,y:0,width:Math.round(rect.width),height:Math.round(rect.height)};
  const pageWidth = Math.round(rect.width), pageHeight = Math.round(rect.height);
  if (pageWidth<1 || pageHeight<1 || Math.max(pageWidth,pageHeight)>limits.maxImageEdge || pageWidth*pageHeight>limits.maxImagePixels) reject('OBSERVATION_PIXELS_LIMIT');
  if (![area.x,area.y,area.width,area.height].every(Number.isSafeInteger) || area.x<0 || area.y<0 || area.width<1 || area.height<1 ||
      area.x+area.width>Math.round(rect.width) || area.y+area.height>Math.round(rect.height)) reject('OBSERVATION_PIXELS_BOUNDS');
  const draw = async(svg,width,height)=> {
    const image = new Image(); image.src = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    try { await image.decode(); const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'); if (!context) reject('OBSERVATION_PIXELS_UNSUPPORTED'); context.drawImage(image,0,0); return {canvas,context};
    } finally { image.src = ''; }
  };
  try {
    // Some engines decode foreignObject without painting it. A blank image must never count as captured evidence.
    const probe = await draw('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><foreignObject width="2" height="2"><div xmlns="http://www.w3.org/1999/xhtml" style="width:2px;height:2px;background:rgb(17,103,187)"></div></foreignObject></svg>',2,2);
    const pixel = probe.context.getImageData(0,0,1,1).data; probe.canvas.width = probe.canvas.height = 0;
    if (pixel.join(',') !== '17,103,187,255') reject('OBSERVATION_PIXELS_UNSUPPORTED');
    await document.fonts?.ready;
    const clone = page.cloneNode(true), originals = [page,...page.querySelectorAll('*')], copies = [clone,...clone.querySelectorAll('*')];
    originals.forEach((element,index)=> {
      if (element.closest('[data-v3-selection]')) return;
      if (element.matches('img,svg,canvas,video,iframe,object,embed,script')) reject('OBSERVATION_PIXELS_SENSITIVE');
      const style = getComputedStyle(element);
      if (/url\(/i.test(style.backgroundImage)) reject('OBSERVATION_PIXELS_SENSITIVE');
      for (const pseudo of ['::before','::after']) if (!['none','normal','""'].includes(getComputedStyle(element,pseudo).content)) reject('OBSERVATION_PIXELS_UNSUPPORTED');
      for (const property of style) copies[index].style.setProperty(property,style.getPropertyValue(property));
    });
    clone.querySelectorAll('[data-v3-selection]').forEach(node=>node.remove());
    Object.assign(clone.style,{margin:'0',boxShadow:'none',transform:'none',position:'absolute',left:'0',top:'0'});
    const scale = Math.min(1,limits.maxPreviewEdge/Math.max(area.width,area.height),Math.sqrt(limits.maxPreviewPixels/(area.width*area.height)));
    const width = Math.max(1,Math.floor(area.width*scale)), height = Math.max(1,Math.floor(area.height*scale));
    const html = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}"><foreignObject width="${pageWidth}" height="${pageHeight}">${html}</foreignObject></svg>`;
    const rendered = await draw(svg,pageWidth,pageHeight), canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    // Crop the full raster rather than changing the foreignObject viewport and re-laying out its contents.
    try { const context = canvas.getContext('2d'); if (!context) reject('OBSERVATION_PIXELS_UNSUPPORTED');
      context.drawImage(rendered.canvas,area.x,area.y,area.width,area.height,0,0,width,height);
      return {dataUrl:canvas.toDataURL('image/png'),width,height,scale,pageIndex,crop:area,renderer:'dom-raster/v1'}; }
    finally { canvas.width = canvas.height = rendered.canvas.width = rendered.canvas.height = 0; }
  } catch (error) { if (error.code) throw error; reject('OBSERVATION_PIXELS_UNSUPPORTED'); }
}
