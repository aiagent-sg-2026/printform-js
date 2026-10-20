const waitMessage='Wait for the current request to finish, then drop the file again.';
const imageExtensions={'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'};

// Keep picker, drop and paste on the same local parser and consent path.
export function setupReferenceIntake(referenceFiles) {
  const root=referenceFiles.panel.root,overlay=document.createElement('div');
  overlay.className='ai-drop-overlay';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');root.append(overlay);
  let depth=0,pastedImages=0;
  const fileDrag=event=>Array.from(event.dataTransfer?.types || []).includes('Files');
  const highlight=active=>{root.classList.toggle('ai-drop-active',active);overlay.textContent=active?'Drop images or PDFs to attach':'';};
  const clear=()=>{depth=0;highlight(false);};
  const attach=(files,paste=false)=>{
    if(referenceFiles.locked || referenceFiles.reading){
      referenceFiles.feedback=true;referenceFiles.notice.textContent=waitMessage;referenceFiles.root.open=true;referenceFiles.render();
      referenceFiles.root.scrollIntoView?.({block:'nearest',inline:'nearest'});return;
    }
    const selected=paste?files.map(file=>{
      const ext=imageExtensions[file.type];
      return ext?new File([file],`pasted-image-${++pastedImages}.${ext}`,{type:file.type,lastModified:file.lastModified}):file;
    }):files;
    void referenceFiles.add(selected);
  };
  for(const type of ['dragover','drop'])document.addEventListener(type,event=>{
    if(!fileDrag(event) || root.contains(event.target))return;
    event.preventDefault();if(type==='dragover')event.dataTransfer.dropEffect='none';
  });
  for(const type of ['dragenter','dragover'])root.addEventListener(type,event=>{
    if(!fileDrag(event))return;
    event.preventDefault();event.dataTransfer.dropEffect='copy';if(type==='dragenter')++depth;highlight(true);
  });
  root.addEventListener('dragleave',event=>{
    if(!fileDrag(event))return;
    depth=Math.max(0,depth-1);
    if(event.relatedTarget && root.contains(event.relatedTarget))return;
    if(event.relatedTarget || !depth)clear();
  });
  root.addEventListener('dragend',clear);
  root.addEventListener('drop',event=>{
    if(!fileDrag(event))return;
    event.preventDefault();clear();attach(Array.from(event.dataTransfer.files || []));
  });
  root.addEventListener('paste',event=>{
    const clipboard=event.clipboardData;
    const text=clipboard?.getData?.('text/plain');
    if(typeof text==='string' && text.trim())return;
    let files=Array.from(clipboard?.files || []);
    if(!files.length)files=Array.from(clipboard?.items || []).filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter(Boolean);
    if(!files.length)return;
    event.preventDefault();attach(files,true);
  });
}
