import { Blob as NodeBlob } from 'node:buffer';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { parseReferenceFile,parseReferenceFiles,REFERENCE_LIMITS as L,ReferenceFileError,referenceTotals } from '../studio-v3/reference-files.js';
import { detectReferenceFormat,imageHeader } from '../studio-v3/reference-formats.js';
import { previewSize } from '../studio-v3/reference-limits.js';
const runtimeState=vi.hoisted(()=>({value:null}));
vi.mock('../studio-v3/reference-pdf-runtime.js',()=>({createPdfRuntime:()=>runtimeState.value}));
const file=(bytes,name='layout.png',type='image/png')=>({name,type,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
function png(width=200,height=100) {
  const b=new Uint8Array(45),v=new DataView(b.buffer); b.set([137,80,78,71,13,10,26,10]);
  v.setUint32(8,13); b.set([73,72,68,82],12); v.setUint32(16,width); v.setUint32(20,height); b[24]=8; b[25]=2;
  b.set([73,69,78,68],37); return b;
}
const pdfBytes=()=>new TextEncoder().encode('%PDF-1.7\nsynthetic-test');
const textItem=(str='Invoice')=>({str,width:42,height:12,transform:[12,0,0,12,10,40],dir:'ltr',hasEOL:true});
function pdfRuntime({items=[textItem()],width=200,height=300,pages=1,permissions=null,loadingError=null,renderError=null}={}) {
  const page={rotate:0,getViewport:({scale})=>({width:width*scale,height:height*scale,transform:[scale,0,0,-scale,0,height*scale]}),
    streamTextContent:()=> { let read=false; return {getReader:()=>({read:async()=>read ? {done:true} : (read=true,{done:false,value:{items}}),cancel:vi.fn(async()=>{})})}; },
    render:vi.fn(()=>({promise:renderError ? Promise.reject(renderError) : Promise.resolve(),cancel:vi.fn()})),cleanup:vi.fn()};
  const pdf={numPages:pages,getPermissions:vi.fn(async()=>permissions),getPage:vi.fn(async()=>page)};
  const loading={promise:loadingError ? Promise.reject(loadingError) : Promise.resolve(pdf),destroy:vi.fn(async()=>{})};
  const runtime={worker:{},port:{addEventListener:vi.fn()},destroy:vi.fn(),pdfjs:{getDocument:vi.fn(()=>loading),AnnotationMode:{DISABLE:0},Util:{transform:(a,b)=>[a[0]*b[0],0,0,a[3]*b[3],a[0]*b[4]+a[4],a[3]*b[5]+a[5]]}}};
  runtimeState.value=runtime; return {runtime,page,pdf,loading};
}
beforeEach(()=> {
  vi.stubGlobal('Blob',NodeBlob);
  vi.stubGlobal('createImageBitmap',vi.fn(async blob=> {
    const b=new Uint8Array(await blob.arrayBuffer()),size=imageHeader(b,blob.type); return {...size,close:vi.fn()};
  }));
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:vi.fn(),drawImage:vi.fn()});
  vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue('data:image/jpeg;base64,/9j/2Q==');
});
afterEach(()=> { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); runtimeState.value=null; });
describe('bounded local reference image ingestion',()=> {
  it('returns inert memory-only metadata and resized JPEG previews, not original bytes or file handles',async()=> {
    const result=await parseReferenceFile(file(png(),'<img src=x>.png'));
    expect(result).toMatchObject({name:'<img src=x>.png',mime:'image/png',bytes:45,kind:'image',pageCount:1,text:'',sourcePixels:20000});
    expect(result.id).toMatch(/^reference-/); expect(result.pages[0].preview).toMatchObject({mime:'image/jpeg',width:200,height:100});
    expect(result.warnings.join(' ')).toContain('No OCR'); expect(result).not.toHaveProperty('file'); expect(result).not.toHaveProperty('data');
  });
  it('recognizes bytes instead of trusting MIME or filename',()=> {
    expect(detectReferenceFormat(png(),{name:'x.png',type:''})).toBe('image/png');
    expect(()=>detectReferenceFormat(png(),{name:'x.pdf',type:'application/pdf'})).toThrow(expect.objectContaining({code:'FILE_MISMATCH'}));
    expect(()=>detectReferenceFormat(new TextEncoder().encode('<svg></svg>'),{name:'x.png',type:'image/png'})).toThrow(expect.objectContaining({code:'FILE_UNSUPPORTED'}));
  });
  it.each([[0,'FILE_EMPTY'],[L.maxFileBytes+1,'FILE_TOO_LARGE']])('rejects size %i before reading',async(size,code)=> {
    const f={...file(png()),size,arrayBuffer:vi.fn()}; await expect(parseReferenceFile(f)).rejects.toMatchObject({code}); expect(f.arrayBuffer).not.toHaveBeenCalled();
  });
  it('rejects mismatched declared byte length and corrupt images',async()=> {
    await expect(parseReferenceFile({...file(png()),size:46})).rejects.toMatchObject({code:'FILE_CORRUPT'});
    createImageBitmap.mockRejectedValue(new Error('decoder')); await expect(parseReferenceFile(file(png()))).rejects.toMatchObject({code:'FILE_CORRUPT'});
  });
  it.each([[8193,1],[6000,5000],[0,100]])('bounds %i × %i dimensions before decoding',async(width,height)=> {
    await expect(parseReferenceFile(file(png(width,height)))).rejects.toBeInstanceOf(ReferenceFileError); expect(createImageBitmap).not.toHaveBeenCalled();
  });
  it('bounds decoded dimensions as well as the header',async()=> {
    createImageBitmap.mockResolvedValue({width:9000,height:1,close:vi.fn()});
    await expect(parseReferenceFile(file(png()))).rejects.toMatchObject({code:'IMAGE_TOO_LARGE'});
  });
  it('bounds encoded thumbnail bytes and longest side/pixels',async()=> {
    const size=previewSize(8192,8192); expect(size.width*size.height).toBeLessThanOrEqual(L.maxPreviewPixels); expect(size.width).toBeLessThanOrEqual(L.maxPreviewEdge);
    HTMLCanvasElement.prototype.toDataURL.mockReturnValue(`data:image/jpeg;base64,${'A'.repeat(1_400_000)}`);
    await expect(parseReferenceFile(file(png()))).rejects.toMatchObject({code:'PREVIEW_TOO_LARGE'});
  });
  it('recognizes JPEG and the three supported WebP header forms',()=> {
    const jpeg=new Uint8Array([255,216,255,192,0,11,8,0,100,0,200,1,1,17,0,255,217]);
    expect(imageHeader(jpeg,detectReferenceFormat(jpeg,{name:'x.jpeg'}))).toEqual({width:200,height:100});
    for (const kind of ['VP8X','VP8 ','VP8L']) {
      const b=new Uint8Array(30),v=new DataView(b.buffer); b.set(new TextEncoder().encode('RIFF')); v.setUint32(4,22,true); b.set(new TextEncoder().encode(`WEBP${kind}`),8); v.setUint32(16,10,true);
      if (kind==='VP8X') { b[24]=199; b[27]=99; }
      if (kind==='VP8 ') { b.set([0x9d,1,0x2a],23); v.setUint16(26,200,true); v.setUint16(28,100,true); }
      if (kind==='VP8L') { b[20]=0x2f; v.setUint32(21,199+(99<<14),true); }
      expect(imageHeader(b,detectReferenceFormat(b,{name:'x.webp'}))).toEqual({width:200,height:100});
    }
  });
  it('rejects animation markers and truncated containers',()=> {
    const animated=png(); animated.set(new TextEncoder().encode('acTL'),37);
    expect(()=>imageHeader(animated,'image/png')).toThrow(expect.objectContaining({code:'IMAGE_ANIMATED'}));
    expect(()=>imageHeader(png().slice(0,20),'image/png')).toThrow(expect.objectContaining({code:'FILE_CORRUPT'}));
  });
  it('supports cancellation before reading and closes late image decodes',async()=> {
    const controller=new AbortController(); controller.abort();
    await expect(parseReferenceFile(file(png()),{signal:controller.signal})).rejects.toMatchObject({code:'REFERENCE_CANCELLED'});
    let resolve; const closed=vi.fn(); createImageBitmap.mockReturnValue(new Promise(r=>resolve=r));
    const active=new AbortController(),pending=parseReferenceFile(file(png()),{signal:active.signal});
    await vi.waitFor(()=>expect(createImageBitmap).toHaveBeenCalled()); active.abort();
    await expect(pending).rejects.toMatchObject({code:'REFERENCE_CANCELLED'});
    resolve({width:200,height:100,close:closed}); await Promise.resolve(); expect(closed).toHaveBeenCalled();
  });
  it('times out a hung file read without returning partial data',async()=> {
    vi.useFakeTimers(); const pending=parseReferenceFile({...file(png()),arrayBuffer:()=>new Promise(()=>{})});
    const assertion=expect(pending).rejects.toMatchObject({code:'REFERENCE_TIMEOUT'});
    await vi.advanceTimersByTimeAsync(L.timeoutMs); await assertion;
  });
  it('enforces atomic batches, count, original bytes, source and preview pixel budgets',async()=> {
    await expect(parseReferenceFiles(Array(5).fill(file(png())))).rejects.toMatchObject({code:'FILE_COUNT'});
    await expect(parseReferenceFiles(Array(3).fill({...file(png()),size:L.maxFileBytes}))).rejects.toMatchObject({code:'TOTAL_BYTES'});
    await expect(parseReferenceFiles(Array(3).fill(file(png(6000,4000))))).rejects.toMatchObject({code:'REFERENCE_BUDGET'});
    const first=await parseReferenceFile(file(png())); const before=JSON.stringify(first);
    await expect(parseReferenceFiles([file(new Uint8Array([1]))],{existing:[first]})).rejects.toMatchObject({code:'FILE_UNSUPPORTED'});
    expect(JSON.stringify(first)).toBe(before); expect(referenceTotals([first]).pages).toBe(1);
  });
});
describe('isolated PDF parsing contract',()=> {
  it('extracts positional text without rendering PDF pages or embedded raster images',async()=> {
    const {runtime,page}=pdfRuntime(); const result=await parseReferenceFile(file(pdfBytes(),'invoice.pdf','application/pdf'));
    expect(result).toMatchObject({kind:'pdf',pageCount:1,text:'Invoice'});
    expect(result.pages[0]).toMatchObject({number:1,width:200,height:300,coordinateSystem:'pdf-viewport-points',textItems:[{text:'Invoice',x:10,y:260,width:42,height:12}]});
    expect(result.pages[0].preview).toBeNull(); expect(page.render).not.toHaveBeenCalled(); expect(runtime.destroy).toHaveBeenCalled();
    expect(runtime.pdfjs.getDocument.mock.calls[0][0]).toMatchObject({isEvalSupported:false,enableXfa:false,useWorkerFetch:false,useWasm:false,stopAtErrors:true,maxImageSize:0});
    expect(runtime.pdfjs.getDocument.mock.calls[0][0]).not.toHaveProperty('url');
  });
  it('rejects PDFs without extracted text and never renders image-only pages',async()=> {
    const {page}=pdfRuntime({items:[]}); await expect(parseReferenceFile(file(pdfBytes(),'scan.pdf','application/pdf'))).rejects.toMatchObject({code:'PDF_NO_TEXT'}); expect(page.render).not.toHaveBeenCalled();
  });
  it.each([[{pages:7},'PDF_PAGE_COUNT'],[{width:2001},'PDF_PAGE_SIZE'],[{width:NaN},'PDF_PAGE_SIZE'],[{permissions:[]},'PDF_ENCRYPTED']])('rejects unsupported PDF constraints %j',async(options,code)=> {
    const {runtime}=pdfRuntime(options); await expect(parseReferenceFile(file(pdfBytes(),'x.pdf','application/pdf'))).rejects.toMatchObject({code}); expect(runtime.destroy).toHaveBeenCalled();
  });
  it('maps protected and corrupt PDFs to explicit rejection',async()=> {
    for (const [options,code] of [[{loadingError:Object.assign(new Error('password'),{name:'PasswordException'})},'PDF_ENCRYPTED'],[{loadingError:new Error('invalid xref')},'FILE_CORRUPT']]) {
      pdfRuntime(options); await expect(parseReferenceFile(file(pdfBytes(),'x.pdf','application/pdf'))).rejects.toMatchObject({code});
    }
  });
  it('rejects password requests instead of asking for or retaining credentials',async()=> {
    const {loading}=pdfRuntime(); loading.promise=new Promise(()=>{});
    const pending=parseReferenceFile(file(pdfBytes(),'x.pdf','application/pdf'));
    await vi.waitFor(()=>expect(loading.onPassword).toBeTypeOf('function')); loading.onPassword();
    await expect(pending).rejects.toMatchObject({code:'PDF_ENCRYPTED'});
  });
  it('bounds extracted text/items and discloses truncation',async()=> {
    pdfRuntime({items:Array.from({length:2100},()=>textItem('x'))});
    const result=await parseReferenceFile(file(pdfBytes(),'x.pdf','application/pdf'));
    expect(result.pages[0].textItems).toHaveLength(L.maxTextItems); expect(result.text.length).toBeLessThanOrEqual(L.maxTextChars); expect(result.warnings.join(' ')).toContain('truncated');
  });
  it('terminates PDF work on cancellation and timeout',async()=> {
    const {runtime,loading}=pdfRuntime(); loading.promise=new Promise(()=>{}); const controller=new AbortController();
    const pending=parseReferenceFile(file(pdfBytes(),'x.pdf','application/pdf'),{signal:controller.signal});
    await vi.waitFor(()=>expect(runtime.pdfjs.getDocument).toHaveBeenCalled()); controller.abort();
    await expect(pending).rejects.toMatchObject({code:'REFERENCE_CANCELLED'}); expect(runtime.destroy).toHaveBeenCalledTimes(1);
    vi.useFakeTimers(); const second=pdfRuntime(); second.loading.promise=new Promise(()=>{});
    const slow=parseReferenceFile(file(pdfBytes(),'x.pdf','application/pdf')); const assertion=expect(slow).rejects.toMatchObject({code:'REFERENCE_TIMEOUT'});
    await vi.advanceTimersByTimeAsync(L.timeoutMs); await assertion; expect(second.runtime.destroy).toHaveBeenCalled();
  });
});

it('visual PDF mode renders sequentially without pretending to budget all embedded decode pixels',async()=>{
 const {runtime,page}=pdfRuntime({items:[],pages:2});const result=await parseReferenceFile(file(pdfBytes(),'scan.pdf','application/pdf'),{pdfMode:'visual'});
 expect(runtime.pdfjs.getDocument.mock.calls[0][0].maxImageSize).toBe(L.maxPdfImagePixels);expect(page.render).toHaveBeenCalledTimes(2);expect(result.sourcePixels).toBe(0);expect(result.processing).toBe('visual');expect(result.pages[0].preview.mime).toBe('image/jpeg');expect(result.warnings.join(' ')).toContain('not a browser memory sandbox');
});
it('visual PDF per-image failures reject instead of silently dropping an image',async()=>{
 pdfRuntime({renderError:new Error('Image exceeded maximum allowed size and was removed.')});await expect(parseReferenceFile(file(pdfBytes(),'x.pdf','application/pdf'),{pdfMode:'visual'})).rejects.toMatchObject({code:'PDF_IMAGE_LIMIT'});
});

it.each(['text','visual'])('rejects swallowed external-resource fallback before accepting %s PDF output',async(pdfMode)=>{
 const {runtime,page}=pdfRuntime(),original=page.streamTextContent;
 page.streamTextContent=()=>{const Factory=runtime.pdfjs.getDocument.mock.calls[0][0].BinaryDataFactory;void new Factory().fetch().catch(()=>{});return original();};
 await expect(parseReferenceFile(file(pdfBytes(),'needs-font.pdf','application/pdf'),{pdfMode})).rejects.toMatchObject({code:'PDF_UNSUPPORTED'});expect(page.render).not.toHaveBeenCalled();expect(runtime.destroy).toHaveBeenCalled();
});
