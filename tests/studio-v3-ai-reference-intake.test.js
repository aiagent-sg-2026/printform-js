import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {html,setup} from './support/chat-panel.js';
const png=()=>new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],'image.png',{type:'image/png'});
const transfer=(files=[])=>({types:['Files'],files,dropEffect:'none'});
function fire(target,type,data,extra={}) {
  const event=new Event(type,{bubbles:true,cancelable:true});
  Object.defineProperty(event,type==='paste'?'clipboardData':'dataTransfer',{value:data});
  for(const [key,value] of Object.entries(extra))Object.defineProperty(event,key,{value});
  target.dispatchEvent(event);return event;
}
beforeEach(()=>{document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});
afterEach(()=>{vi.restoreAllMocks();localStorage.clear();});

describe('panel reference intake',()=>{
  it('accepts a file on the header and clears the announced highlight after drop',()=>{
    const {panel}=setup(),add=vi.spyOn(panel.referenceFiles,'add').mockResolvedValue(),header=panel.node('.ai-heading'),file=png(),data=transfer([file]);
    expect(fire(header,'dragenter',data).defaultPrevented).toBe(true);
    expect(data.dropEffect).toBe('copy');expect(panel.root.classList.contains('ai-drop-active')).toBe(true);
    expect(panel.node('[role=status].ai-drop-overlay').textContent).toBe('Drop images or PDFs to attach');
    expect(fire(header,'drop',data).defaultPrevented).toBe(true);expect(add).toHaveBeenCalledWith([file]);
    expect(panel.root.classList.contains('ai-drop-active')).toBe(false);expect(panel.node('.ai-drop-overlay').textContent).toBe('');
  });
  it('keeps the highlight across children and clears it when leaving the panel',()=>{
    const {panel}=setup(),header=panel.node('.ai-heading'),child=header.querySelector('h2'),data=transfer();
    fire(header,'dragenter',data);fire(child,'dragenter',data);fire(header,'dragleave',data,{relatedTarget:child});
    expect(panel.root.classList.contains('ai-drop-active')).toBe(true);
    fire(child,'dragleave',data,{relatedTarget:document.body});expect(panel.root.classList.contains('ai-drop-active')).toBe(false);
  });
  it('leaves URL-only drags alone',()=>{
    const {panel}=setup(),add=vi.spyOn(panel.referenceFiles,'add'),data={types:['text/uri-list'],dropEffect:'none'};
    for(const type of ['dragenter','dragover','drop'])expect(fire(panel.root,type,data).defaultPrevented).toBe(false);
    expect(data.dropEffect).toBe('none');expect(panel.root.classList.contains('ai-drop-active')).toBe(false);expect(add).not.toHaveBeenCalled();
  });
  it('blocks file drags and drops outside the panel without attaching or highlighting',()=>{
    const {panel}=setup(),add=vi.spyOn(panel.referenceFiles,'add'),data=transfer([png()]);
    data.dropEffect='copy';
    expect(fire(document.body,'dragover',data).defaultPrevented).toBe(true);
    expect(data.dropEffect).toBe('none');
    expect(fire(document.body,'drop',data).defaultPrevented).toBe(true);
    expect(add).not.toHaveBeenCalled();expect(panel.root.classList.contains('ai-drop-active')).toBe(false);
    expect(panel.node('.ai-drop-overlay').textContent).toBe('');
  });
  it('leaves URL-only drags and drops outside the panel alone',()=>{
    const {panel}=setup(),add=vi.spyOn(panel.referenceFiles,'add'),data={types:['text/uri-list'],dropEffect:'link'};
    for(const type of ['dragover','drop'])expect(fire(document.body,type,data).defaultPrevented).toBe(false);
    expect(data.dropEffect).toBe('link');expect(add).not.toHaveBeenCalled();
  });
  it('renames repeated image-only pastes and preserves their bytes',async()=>{
    const {panel}=setup(),add=vi.spyOn(panel.referenceFiles,'add').mockResolvedValue(),prompt=panel.node('#ai-prompt'),file=png(),before=prompt.value;
    const data={files:[file],types:['Files'],getData:()=>''};
    expect(fire(prompt,'paste',data).defaultPrevented).toBe(true);fire(prompt,'paste',data);
    const first=add.mock.calls[0][0][0],second=add.mock.calls[1][0][0];
    expect(first.name).toBe('pasted-image-1.png');expect(second.name).toBe('pasted-image-2.png');expect(first.type).toBe('image/png');
    const read=file=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});
    expect(await read(first)).toBe(await read(file));expect(prompt.value).toBe(before);
  });
  it('leaves image paste with non-empty plain text to the browser',()=>{
    const {panel}=setup(),add=vi.spyOn(panel.referenceFiles,'add'),prompt=panel.node('#ai-prompt');
    prompt.value='Existing prompt';
    const data={files:[png()],types:['Files','text/plain'],getData:vi.fn(()=>' copied cells ')};
    expect(fire(prompt,'paste',data).defaultPrevented).toBe(false);
    expect(data.getData).toHaveBeenCalledWith('text/plain');
    expect(add).not.toHaveBeenCalled();expect(prompt.value).toBe('Existing prompt');
  });
  it('attaches an image when accompanying plain text is whitespace only',()=>{
    const {panel}=setup(),add=vi.spyOn(panel.referenceFiles,'add').mockResolvedValue();
    const data={files:[png()],getData:()=> ' \n\t '};
    expect(fire(panel.node('#ai-prompt'),'paste',data).defaultPrevented).toBe(true);
    expect(add.mock.calls[0][0][0].name).toBe('pasted-image-1.png');
  });
  it('uses clipboard file items when the file list is empty',()=>{
    const {panel}=setup(),add=vi.spyOn(panel.referenceFiles,'add').mockResolvedValue();
    expect(fire(panel.node('[data-ai=attach]'),'paste',{files:[],items:[{kind:'string'},{kind:'file',getAsFile:()=>png()}]}).defaultPrevented).toBe(true);
    expect(add.mock.calls[0][0][0].name).toBe('pasted-image-1.png');
  });
  it('does not intercept plain text paste',()=>{
    const {panel}=setup(),add=vi.spyOn(panel.referenceFiles,'add');
    expect(fire(panel.node('#ai-prompt'),'paste',{files:[],items:[{kind:'string'}],getData:()=> 'plain text'}).defaultPrevented).toBe(false);
    expect(add).not.toHaveBeenCalled();
  });
  it.each(['locked','reading'])('rejects drop and paste while %s with visible feedback',state=>{
    const {panel}=setup(),references=panel.referenceFiles,add=vi.spyOn(references,'add').mockResolvedValue();panel.show();
    if(state==='locked'){panel.busy=true;panel.update();}else references.reading=true;
    for(const type of ['drop','paste']){
      expect(fire(panel.node('.ai-heading'),type,transfer([png()])).defaultPrevented).toBe(true);
      expect(references.notice.textContent).toBe('Wait for the current request to finish, then drop the file again.');
      expect(references.root.hidden).toBe(false);expect(references.root.open).toBe(true);
    }
    expect(add).not.toHaveBeenCalled();
  });
  it.each(['drop','paste'])('shows the parser error for an unsupported %s',async type=>{
    const {panel}=setup();panel.show();
    fire(panel.node('.ai-heading'),type,transfer([new File(['synthetic text'],'fictional.txt',{type:'text/plain'})]));
    await vi.waitFor(()=>expect(panel.referenceFiles.root.hasAttribute('data-error')).toBe(true));
    expect(panel.referenceFiles.files).toEqual([]);expect(panel.referenceFiles.root.hidden).toBe(false);expect(panel.referenceFiles.root.open).toBe(true);
    expect(panel.referenceFiles.notice.textContent).toBe('Only PDF, PNG, JPEG and WebP references are supported.');
  });
});
