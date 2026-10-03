import { parseReferenceFiles } from './reference-files.js';
import { referenceProjection } from './reference-sharing.js';
const node=(tag,text)=>{const n=document.createElement(tag); if(text!==undefined)n.textContent=text;return n;};
export class AIReferenceFiles {
  constructor(panel) {
    this.panel=panel; this.files=[]; this.version=0; this.documentKey=panel.documentKey();
    this.root=node('details'); this.root.className='ai-reference-files'; this.root.setAttribute('aria-label','Design references');
    const summary=node('summary','References · PDF / image');this.root.append(summary);
    const label=node('label','Add reference PDF or image'); this.input=node('input'); this.input.type='file'; this.input.multiple=true; this.input.accept='application/pdf,image/png,image/jpeg,image/webp'; label.append(this.input);
    const modeLabel=node('label','PDF reading for new attachments');this.pdfMode=node('select');this.pdfMode.setAttribute('aria-label','PDF reading for new attachments');for(const [value,text] of [['text','Text & positions (lightweight)'],['visual','Visual pages (best-effort local preview)']]){const option=node('option',text);option.value=value;this.pdfMode.append(option);}modeLabel.append(this.pdfMode);
    this.list=node('div'); this.list.className='ai-reference-list';
    this.notice=node('p','Files stay in memory. Text mode skips PDF appearance/images. Visual pages uses best-effort local limits. Use Check image support before sending pixels. If visual reading fails, choose Text & positions and attach again.');this.notice.className='hint';
    this.cancel=node('button','Cancel reading');this.cancel.type='button';this.cancel.hidden=true;this.cancel.addEventListener('click',()=>{this.controller?.abort();this.notice.textContent='Reference reading cancelled. Nothing was sent.';});
    this.capability=node('p');this.capability.className='hint';this.capability.setAttribute('role','status');
    this.checkSupport=node('button','Check image support');this.checkSupport.type='button';this.checkSupport.addEventListener('click',()=>void this.checkImageSupport());
    this.diagnostics=node('details');this.diagnostics.append(node('summary','Observed model capabilities'));this.diagnosticText=node('pre');this.diagnostics.append(this.diagnosticText);
    this.root.append(modeLabel,label,this.cancel,this.list,this.capability,this.checkSupport,this.diagnostics,this.notice); panel.node('.ai-input')?.before(this.root);
    this.input.addEventListener('change',()=>{const files=[...this.input.files];this.input.value='';void this.add(files);});
    const dropTarget=panel.node('.ai-composer') || this.root;
    dropTarget.addEventListener('dragover',e=>{e.preventDefault();if(!this.locked)e.dataTransfer.dropEffect='copy';});
    dropTarget.addEventListener('drop',e=>{e.preventDefault();if(!this.locked)void this.add([...e.dataTransfer.files]);});
    this.render();
  }
  async add(files) {
    if(this.locked || !files.length)return; this.root.open=true;
    this.controller?.abort(); const controller=new AbortController();this.controller=controller; const key=this.panel.documentKey();this.reading=true;this.cancel.hidden=false;this.panel.update();
    this.notice.textContent='Reading references locally…';
    try {
      const parsed=await parseReferenceFiles(files,{signal:controller.signal,existing:this.files,pdfMode:this.pdfMode.value});
      if(controller.signal.aborted || key!==this.panel.documentKey())return;
      this.files=[...this.files,...parsed];this.changed();
      this.notice.textContent='Ready locally. Send shares the listed PDF text/positions and attached images with the Demo gateway and its provider. Use fictional demo files only.';
    } catch(error){if(this.controller===controller && !controller.signal.aborted)this.notice.textContent=error.message;}
    finally {if(this.controller===controller){this.reading=false;this.cancel.hidden=true;this.controller=null;this.panel.update();}}
  }
  changed() { ++this.version;this.panel.contextChanged(true);this.render(); }
  projection() { return referenceProjection(this.files); }
  hasImages(){return this.files.some(file=>file.kind==='image' || file.processing==='visual');}
  async checkImageSupport(){
    if(this.locked || this.reading || this.checking)return;
    this.checking=true;this.capabilityChanged();
    try {await this.panel.discover();}
    finally {this.checking=false;this.capabilityChanged();}
  }
  capabilityChanged(){
    const facts=this.panel.transport.capabilityDiagnostics?.() || [],hasImages=this.hasImages();
    this.diagnosticText.textContent=facts.length?JSON.stringify(facts,null,2):'Use Check image support or Discover available models to inspect bounded public capability facts.';
    const allowed=this.panel.transport.supportsImages?.(this.panel.node('#ai-model').value)===true;
    this.checkSupport.hidden=!hasImages || allowed;this.checkSupport.disabled=Boolean(this.locked || this.reading || this.checking);
    this.capability.textContent=this.checking?'Checking image support. No reference files are shared by this check.':allowed?'Images available for this model. Review every AI result.':hasImages?'Image support is not confirmed for this model. Use Check image support to check or retry. The check shares no reference files.':'Image and visual-PDF references need confirmed image support.';
    return allowed;
  }
  imageBlocked(){return this.hasImages() && !this.capabilityChanged();}
  assertReady() {if(this.reading)throw new Error('Wait for reference processing to finish.');if(this.imageBlocked())throw new Error('Image support is not confirmed. Use Check image support, or remove image and visual-PDF references. Choose Text & positions and reattach the PDF to send without images.');}
  render() {
    this.list.replaceChildren();
    for(const file of this.files){
      const card=node('div');card.className='ai-reference-card';
      const textOnly=file.kind==='pdf' && file.processing!=='visual',preview=node(textOnly?'pre':'div');preview.className=textOnly?'ai-reference-excerpt':'ai-reference-thumbnails';if(textOnly)preview.textContent=`Text excerpt (not a visual preview):\n${file.text.slice(0,320)}`;else for(const page of file.pages){const image=node('img');image.src=page.preview.dataUrl;image.alt=`${file.name} · reference page ${page.number}`;preview.append(image);}
      const info=node('span',`${file.name} · ${file.pageCount} page(s)${!file.text?.trim()?' · image-only, no extracted text':''}`);
      const remove=node('button','Remove');remove.type='button';remove.disabled=this.locked;remove.addEventListener('click',()=>{this.files=this.files.filter(f=>f.id!==file.id);this.changed();});
      card.append(preview,info,remove);for(const warning of file.warnings || [])card.append(node('small',warning));this.list.append(card);
    }
    this.capabilityChanged();
  }
  contextChanged(){const key=this.panel.documentKey();if(key!==this.documentKey){this.documentKey=key;this.clear();}}
  clear(){this.controller?.abort();this.files=[];this.pdfMode.value='text';this.root.open=false;++this.version;this.render();}
  setBusy(value){this.locked=value;for(const input of this.root.querySelectorAll('input,select,button'))input.disabled=value;this.checkSupport.disabled=Boolean(value || this.reading || this.checking);}
}
