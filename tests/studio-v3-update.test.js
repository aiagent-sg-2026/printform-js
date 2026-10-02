import {describe,it,expect,vi,afterEach} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {verifiedWrite,decodeRecovery,RECOVERY_KEY} from '../studio-v3/update-work.js';
import {newProject} from '../studio-v3/model.js';
import {createBus} from '../studio-v3/controller.js';
import {saveProject} from '../studio-v3/file-io.js';
import {runtimeSources} from '../studio-v3/runtime-assets.js';
import {finalizeStudioV3Pwa} from '../scripts/studio-v3-pwa.mjs';
import {checkRegistration,navigateUpdate} from '../studio-v3/update.js';
import {restoreDraftRecords} from '../studio-v3/form-drafts.js';

afterEach(()=>vi.unstubAllGlobals());
afterEach(()=> {vi.useRealTimers();vi.restoreAllMocks();});
const record = p=>({file:saveProject(p),id:p.manifest.documentId,session:p.studioV3Session});
function recovery() {
  const p=createBus(newProject()).project;
  return {version:1,project:record(p),history:{cursor:0,entries:[{revision:0,project:record(p)}]},ui:{mode:'design'},forms:[]};
}
describe('update recovery persistence',()=> {
  it('round-trips controlled FormSpec, bindings, independent ERP values, document identity and revision',()=> {
    const value=recovery(), project=decodeRecovery(JSON.stringify(value)).project;
    const original=JSON.parse(value.project.file).project;
    expect(project.manifest).toMatchObject(original.manifest); expect(project.sampleData).toEqual(original.sampleData);
    expect(project.revision).toBe(original.revision); expect(project.spec.components.find(c=>c.id==='totals-total').binding).toEqual({text:'/summary/total'});
  });
  it('verifies exact readback and propagates quota/security failures before activation',()=> {
    const value=recovery(); let text;
    const storage={setItem:vi.fn((key,v)=> {expect(key).toBe(RECOVERY_KEY);text=v;}),getItem:()=>text};
    expect(verifiedWrite(storage,value)).toBe(JSON.stringify(value));
    expect(()=>verifiedWrite({...storage,getItem:()=>null},value)).toThrow('verification failed');
    expect(()=>verifiedWrite({...storage,setItem:()=> {throw new DOMException('full','QuotaExceededError');}},value)).toThrow('full');
    expect(()=>verifiedWrite(storage,{huge:'x'.repeat(4*1024*1024)})).toThrow('too large');
  });
  it.each(['bad-json','version','cursor','unsafe-proposal','unsafe-design'])("rejects %s recovery without accepting model code or financial edits",kind=> {
    const value=recovery();
    if (kind==='bad-json') {expect(()=>decodeRecovery('{')).toThrow();return;}
    if (kind==='version') value.version=2;
    if (kind==='cursor') value.history.cursor=5;
    if (kind==='unsafe-proposal') value.ai={proposal:{summary:'unsafe',edits:[{target:'style',property:'amount',value:0}]}};
    if (kind==='unsafe-design') {const p=JSON.parse(value.project.file);p.project.manifest.studioV3.color='javascript:evil';value.project.file=JSON.stringify(p);}
    expect(()=>decodeRecovery(JSON.stringify(value))).toThrow();
  });
});
describe('bounded update check',()=> {
  it('enables a waiting update even when the browser update promise never settles',async()=> {
    const reg=new EventTarget(),worker=new EventTarget();worker.state='installing';reg.installing=worker;reg.update=()=>new Promise(()=>{});
    const result=checkRegistration(reg,100);worker.state='installed';worker.dispatchEvent(new Event('statechange'));await result;
  });
  it('reports installation failure and a timeout while keeping the current worker',async()=> {
    const reg=new EventTarget(),worker=new EventTarget();worker.state='installing';reg.installing=worker;reg.update=()=>new Promise(()=>{});
    const result=checkRegistration(reg,100);worker.state='redundant';worker.dispatchEvent(new Event('statechange'));await expect(result).rejects.toThrow('verification failed');
    worker.state='installing';await expect(checkRegistration(reg,5)).rejects.toThrow('timed out');
  });
});
describe('failed navigation recovery',()=> {
  it('stops a held navigation before unlocking new edits and retains the backup',async()=> {
    vi.useFakeTimers();const stop=vi.spyOn(window,'stop').mockImplementation(()=>{}),failed=vi.fn(),message=vi.fn(),reload=vi.fn();
    navigateUpdate({failed},'b'.repeat(40),reload,message);await vi.advanceTimersByTimeAsync(10000);
    expect(stop).toHaveBeenCalledOnce();expect(failed).toHaveBeenCalledOnce();expect(stop.mock.invocationCallOrder[0]).toBeLessThan(failed.mock.invocationCallOrder[0]);
    expect(message).toHaveBeenCalledWith(expect.stringContaining('backup are retained'));window.dispatchEvent(new Event('pagehide'));
  });
  it('does not unlock or stop a successful page navigation',async()=> {
    vi.useFakeTimers();const stop=vi.spyOn(window,'stop').mockImplementation(()=>{}),failed=vi.fn();
    navigateUpdate({failed},'b'.repeat(40),vi.fn(),vi.fn());window.dispatchEvent(new Event('pagehide'));await vi.advanceTimersByTimeAsync(10000);
    expect(stop).not.toHaveBeenCalled();expect(failed).not.toHaveBeenCalled();
  });
});

it('validates locale/currency and bindings before the recovery is offered, rejecting unavailable controls',()=> {
  const value=recovery();value.forms=[{key:'locale:global',kind:'locale',selected:'items',values:{locale:'zh-CN',currency:'USD'}}];
  expect(decodeRecovery(JSON.stringify(value)).forms).toEqual(value.forms);
  value.forms[0].values.unsafeAmount='0';expect(()=>decodeRecovery(JSON.stringify(value))).toThrow('Unavailable recovery control');
});
it('rejects removed select options instead of silently deleting the saved draft on recovery',()=> {
  const form=document.createElement('form');form.innerHTML='<select name="locale"><option>en-MY</option></select><select name="currency"><option>MYR</option></select>';
  const records=[{key:'locale:global',kind:'locale',selected:'items',values:{locale:'zh-CN',currency:'USD'}}];
  expect(()=>restoreDraftRecords(records,()=>form,null)).toThrow('no longer supports');
});

it('v3 preview/export loads both runtimes from the build selected by the page',async()=> {
  document.head.innerHTML='<meta name="printform-assets" content="./releases/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/">';
  const fetch=vi.fn(async url=>({ok:true,text:async()=>url}));vi.stubGlobal('fetch',fetch);
  const sources=await runtimeSources(); expect(fetch.mock.calls.flat().every(url=>url.startsWith('./releases/aaaa'))).toBe(true);
  expect(sources.printform).toContain('/printform.js'); expect(sources.documentRuntime).toContain('/printform-document.js');
});

function worker({broken=false,existing=false}={}) {
  const listeners=new Map(),cache=new Map(),build='a'.repeat(40),body='fixture';
  const shell=[{url:'./index.html',hash:createHash('sha256').update(body).digest('hex')}];
  if(existing)cache.set('https://fixture.test/studio-v3/index.html',new Response(broken?'retained previous content':body));
  const context={URL,Response,crypto:{subtle:{digest:(algorithm,bytes)=>webcrypto.subtle.digest(algorithm,Buffer.from(new Uint8Array(bytes)))}},Uint8Array,fetch:vi.fn(async()=>new Response(broken?'incomplete':body)),
    caches:{keys:async()=>existing?[`printform-studio-v3-shell:${build}`]:[],open:async()=>({put:async(key,value)=>cache.set(String(key),value),match:async key=>cache.get(String(key))}),delete:vi.fn(async()=>cache.clear())},
    self:{location:{href:'https://fixture.test/studio-v3/sw.js'},clients:{claim:vi.fn(async()=>{})},skipWaiting:vi.fn(),addEventListener:(type,fn)=>listeners.set(type,fn)}};
  vm.runInNewContext(fs.readFileSync('studio-v3/sw.js','utf8').replaceAll('__PRINTFORM_V3_REVISION__',build).replace('"__PRINTFORM_V3_SHELL__"',JSON.stringify(shell)),context);
  return {listeners,context,cache,build};
}
describe('v3 atomic offline shell policy',()=> {
  it('offers only a complete hash-verified shell, without unsolicited activation',async()=> {
    const w=worker();let pending;w.listeners.get('install')({waitUntil:p=>pending=p});await pending;
    expect(w.cache.size).toBe(1);expect(w.context.self.skipWaiting).not.toHaveBeenCalled();
    w.listeners.get('message')({data:{type:'ACTIVATE',build:'wrong'}});expect(w.context.self.skipWaiting).not.toHaveBeenCalled();
    w.listeners.get('message')({data:{type:'ACTIVATE',build:w.build}});expect(w.context.self.skipWaiting).toHaveBeenCalledOnce();
  });
  it('discards a partial/mixed shell on hash mismatch',async()=> {
    const w=worker({broken:true});let pending;w.listeners.get('install')({waitUntil:p=>pending=p});await expect(pending).rejects.toThrow('integrity mismatch');
    expect(w.context.caches.delete).toHaveBeenCalledWith(`printform-studio-v3-shell:${w.build}`);expect(w.cache.size).toBe(0);
  });
  it('rollback reuses a complete retained build and never deletes its cache on failure',async()=> {
    const valid=worker({existing:true});let pending;valid.listeners.get('install')({waitUntil:p=>pending=p});await pending;expect(valid.context.fetch).not.toHaveBeenCalled();
    const failed=worker({existing:true,broken:true});failed.listeners.get('install')({waitUntil:p=>pending=p});await expect(pending).rejects.toThrow('integrity mismatch');
    expect(failed.context.caches.delete).not.toHaveBeenCalled();expect(await failed.cache.get('https://fixture.test/studio-v3/index.html').text()).toBe('retained previous content');
    const incomplete=worker({existing:true});incomplete.cache.clear();incomplete.listeners.get('install')({waitUntil:p=>pending=p});await pending;
    expect(incomplete.context.fetch).toHaveBeenCalledOnce();expect(incomplete.cache.size).toBe(1);
  });
  it('ignores external requests, POST and arbitrary user documents, without storing their content',()=> {
    const w=worker();
    for(const request of [{method:'GET',url:'https://gpt.yapweijun1996.com/demo/v1/models'},{method:'POST',url:'https://fixture.test/studio-v3/'},{method:'GET',url:'https://fixture.test/studio-v3/imported.html',mode:'navigate'}]) {
      const respondWith=vi.fn();w.listeners.get('fetch')({request,respondWith});expect(respondWith).not.toHaveBeenCalled();
    }
  });
});

it('build emits an isolated scope, immutable asset URLs and a complete content manifest',()=> {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'printform-build-test-'));
  try {
    for(const name of ['studio-v3','studio-v2','dist']) fs.mkdirSync(path.join(temp,name));
    fs.writeFileSync(path.join(temp,'studio-v3/index.html'),fs.readFileSync('studio-v3/index.html'));
    fs.writeFileSync(path.join(temp,'studio-v3/sw.js'),fs.readFileSync('studio-v3/sw.js'));
    fs.copyFileSync('studio-v3/manifest.webmanifest',path.join(temp,'studio-v3/manifest.webmanifest'));
    fs.writeFileSync(path.join(temp,'studio-v2/icon.svg'),'<svg/>');
    for(const name of ['app.js','tokens.css','styles.css','ai-panel.css','update.css'])fs.writeFileSync(path.join(temp,'studio-v3',name),name);
    for(const name of ['printform.js','printform-document.js'])fs.writeFileSync(path.join(temp,'dist',name),name);
    finalizeStudioV3Pwa(temp,'a'.repeat(40));
    const html=fs.readFileSync(path.join(temp,'studio-v3/index.html'),'utf8');expect(html).toContain(`releases/${'a'.repeat(40)}/app.js`);
    const sw=fs.readFileSync(path.join(temp,'studio-v3/sw.js'),'utf8');expect(sw).not.toContain('__PRINTFORM');expect(sw).toContain('printform-document.js');
    expect(()=>finalizeStudioV3Pwa(temp,'invalid')).toThrow('Invalid');
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
