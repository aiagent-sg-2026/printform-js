import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {html,setup} from './support/chat-panel.js';
import {scriptedGateway,json} from './support/agent-gateway.js';
import {setAgentEnabled} from '../studio-v3/agent-preference.js';

// Attaching goes through the real add(); only the reading of the file itself is replaced.
const parsed = vi.hoisted(()=>({files:[]}));
vi.mock('../studio-v3/reference-files.js',()=>({parseReferenceFiles:async()=>parsed.files}));

const image = {id:'ref-1',name:'fictional.png',kind:'image',mime:'image/png',processing:'visual',pageCount:1,text:'',pages:[{number:1,width:10,height:10,text:'',textItems:[],preview:{dataUrl:'data:image/png;base64,AAAA'}}],warnings:[]};
const textPdf = {id:'ref-2',name:'fictional.pdf',kind:'pdf',mime:'application/pdf',processing:'text',pageCount:1,text:'FICTIONAL REFERENCE',pages:[{number:1,width:10,height:10,text:'FICTIONAL REFERENCE',textItems:[],preview:null}],warnings:[]};
beforeEach(()=> {document.documentElement.innerHTML = html.replace(/<!doctype html>/i,'');document.body.inert = false;setAgentEnabled(false);parsed.files = [];});
afterEach(()=> localStorage.clear());
const attach = async(panel,files) => { parsed.files = files; await panel.referenceFiles.add([{name:files[0].name}]); };

describe('attaching an image',()=> {
  it('checks image support by itself, and Send is ready when the gateway reports it',async()=> {
    const {panel} = setup({transport:scriptedGateway({multimodal:true}).transport}), discover = vi.spyOn(panel,'discover');
    expect(panel.node('[data-ai-send]').disabled).toBe(false);
    await attach(panel,[image]);
    expect(discover).toHaveBeenCalledTimes(1);
    expect(panel.referenceFiles.capability.textContent).toContain('Images available'); expect(panel.node('[data-ai-send]').disabled).toBe(false);
    expect(panel.node('[data-ai-send-reason]').hidden).toBe(true);
  });

  it('keeps Send off and says why when the gateway does not report image support, with the retry button in reach',async()=> {
    const {panel} = setup({transport:scriptedGateway({multimodal:false}).transport});
    await attach(panel,[image]);
    expect(panel.node('[data-ai-send]').disabled).toBe(true); expect(panel.node('[data-ai-send-reason]').dataset.kind).toBe('reason');
    expect(panel.referenceFiles.checkSupport.hidden).toBe(false);
  });

  it('does not stop the attachment when the check itself fails',async()=> {
    const {panel} = setup({transport:scriptedGateway().transport}); panel.transport.discover = async()=> { throw Object.assign(new Error('x'),{code:'DEMO_NETWORK_UNREACHABLE'}); };
    await attach(panel,[image]);
    expect(panel.referenceFiles.files).toHaveLength(1); expect(panel.node('[data-ai-send]').disabled).toBe(true);
  });

  it('does not check for a text-only PDF; for images it checks again after each new file, because changing the references clears the earlier answer',async()=> {
    const {panel} = setup({transport:scriptedGateway({multimodal:true}).transport}), discover = vi.spyOn(panel,'discover');
    await attach(panel,[textPdf]); expect(discover).not.toHaveBeenCalled();
    parsed.files = [image]; await panel.referenceFiles.add([{name:'a.png'}]); expect(discover).toHaveBeenCalledTimes(1);
    parsed.files = [{...image,id:'ref-3'}]; await panel.referenceFiles.add([{name:'b.png'}]); expect(discover).toHaveBeenCalledTimes(2);
    expect(panel.node('[data-ai-send]').disabled).toBe(false);
  });
});

describe('the status row of the references',()=> {
  it('keeps the support status and its button together, so they can stay in view',()=> {
    const {panel} = setup({transport:scriptedGateway().transport}), row = panel.node('.ai-capability-row');
    expect(row).not.toBeNull(); expect(row.contains(panel.referenceFiles.capability)).toBe(true); expect(row.contains(panel.referenceFiles.checkSupport)).toBe(true);
  });
});
