import {describe,it,expect} from 'vitest';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {validateDesign} from '../studio-v3/design-validation.js';
import {parseChatReply,chatRequest,CHAT_PROMPT} from '../studio-v3/ai-chat-protocol.js';
import {createBus,editProject,designOperations,formDesign} from '../studio-v3/controller.js';
import {saveProject,readProject} from '../studio-v3/file-io.js';
import {cleanMessages} from '../studio-v3/ai-conversation.js';
import {rightView} from '../studio-v3/workspace-views.js';
import {runLayoutHarness} from '../studio-v3/ai-harness.js';
import {tableBodyCss} from '../studio-v3/table-style.js';
const request='row data table bg style use yellow';
const operation={type:'set_table_style',target:'items',patch:{rowBackground:'#ffff00'}};
const proposal=(operations=[operation])=>JSON.stringify({kind:'proposal',summary:'Yellow data row background',operations});
const accent=JSON.stringify({kind:'proposal',summary:'Yellow table rows',edits:[{target:'style',property:'color',value:'#d4a017'}]});

describe('closed table body background',()=>{
  it('adds a real fill while preserving defaults, bound data, financial formats and document identity',async()=>{
    const project=newProject(),before=structuredClone(project),result=parseChatReply(proposal(),project,{request,scope:{mode:'selected',id:'items'}});
    expect(result.diff).toEqual([{target:'items',property:'tableStyle.rowBackground',before:'(unset)',after:'#ffff00'}]);
    expect(result.targets).toEqual(['items']);expect(result.design.tableStyle).toEqual({rowBackground:'#ffff00'});
    const expected=designOf(project);expected.tableStyle={rowBackground:'#ffff00'};expect(result.design).toEqual(expected);
    expect(result.candidate.sampleData).toEqual(before.sampleData);expect(result.candidate.manifest.documentId).toBe(before.manifest.documentId);
    expect(result.candidate.templateHtml).toBe(before.templateHtml);expect(project).toEqual(before);
    expect(tableBodyCss(before.manifest.studioV3)).toBe('');expect(result.candidate.themeCss).toContain('background:#ffff00');
    const bus=createBus(project);await editProject(bus,designOperations(bus.project,result.design),'AI row fill');
    const saved=JSON.parse(saveProject(bus.project)).project;expect(saved.manifest.documentId).toBe(before.manifest.documentId);
    expect(saved.sampleData).toEqual(before.sampleData);expect(saved.manifest.studioV3.columns).toEqual(before.manifest.studioV3.columns);
    const reopened=readProject(saveProject(bus.project));expect(reopened.manifest.studioV3).toEqual(result.design);expect(reopened.sampleData).toEqual(before.sampleData);
    await bus.navigateHistory('undo',bus.revision);expect(designOf(bus.project)).toEqual(designOf(project));expect(bus.project.sampleData).toEqual(before.sampleData);
  });
  it('paints body table, rows and cells without recoloring the header or brand',()=>{
    const result=parseChatReply(proposal(),newProject());
    document.head.innerHTML=`<style>${result.candidate.themeCss}</style>`;
    document.body.innerHTML=`<div id="pf-mount">${result.candidate.templateHtml}</div>`;
    const body=document.querySelector('[data-v3-id="items"]');
    body.classList.add('prowitem_processed');body.dataset.pfRowIndex='1';
    body.before(document.createElement('span'));if(!body.matches(':nth-child(even)'))body.before(document.createElement('span'));
    for(const node of [body,...body.querySelectorAll('tr,td')])expect(getComputedStyle(node).backgroundColor).toBe('rgb(255, 255, 0)');
    expect(getComputedStyle(document.querySelector('th')).backgroundColor).toBe('rgb(233, 239, 248)');
    expect(getComputedStyle(document.querySelector('.brand-mark')).color).toBe('rgb(23, 99, 220)');
    document.head.innerHTML='';document.body.innerHTML='';
  });
  it.each(['items-header','items-description','label-items-description','customer','header','totals-total'])('rejects whole-table fill outside table selection: %s',id=>{
    expect(()=>parseChatReply(proposal(),newProject(),{request,scope:{mode:'selected',id}})).toThrow('UNSAFE_SCOPE');
  });
  it('allows explicit multi-reference table scope but rejects global accent edits in table-only scope',()=>{
    expect(parseChatReply(proposal(),newProject(),{scope:{mode:'selected',ids:['items','footer']}}).kind).toBe('proposal');
    expect(()=>parseChatReply(accent,newProject(),{scope:{mode:'selected',id:'items'},request})).toThrow('UNSAFE_SCOPE');
  });
  it.each(['yellow','#ff0','#ffff00;display:none','url(https://example.com/a)',17,false,{},[]])('rejects unsafe fill %j',value=>{
    const project=newProject();expect(()=>parseChatReply(proposal([{...operation,patch:{rowBackground:value}}]),project)).toThrow('UNSAFE_PROPOSAL');
    const design=designOf(project);design.tableStyle={rowBackground:value};expect(()=>validateDesign(design)).toThrow();
  });
  it('rejects unsupported table properties, targets, arbitrary CSS, and financial edits',()=>{
    for(const op of [{...operation,target:'items-header'},{...operation,patch:{background:'#ffff00'}},{...operation,patch:{rowBackground:'#ffff00',css:'body{display:none}'}},{...operation,patch:{amount:0}}])expect(()=>parseChatReply(proposal([op]),newProject())).toThrow('UNSAFE_PROPOSAL');
    const design=designOf(newProject());design.tableStyle={rowBackground:'#ffff00',text:'999.00'};expect(()=>validateDesign(design)).toThrow('Unsupported');
    expect(()=>parseChatReply(proposal([operation,{type:'set_field',target:'items-amount',patch:{text:'0.00'}}]),newProject())).toThrow('UNSAFE_PROPOSAL');
  });
  it('restores the existing zebra preference with null and recovers only inert validated color diffs',()=>{
    const project=parseChatReply(proposal(),newProject()).candidate;
    const cleared=parseChatReply(proposal([{...operation,patch:{rowBackground:null}}]),project);
    expect(cleared.design.tableStyle).toBeUndefined();expect(cleared.design.striped).toBe(true);expect(tableBodyCss(cleared.design)).toBe('');
    expect(cleanMessages([{role:'assistant',text:'Row fill',time:1,diff:cleared.diff}])[0].status).toBe('expired');
    expect(()=>cleanMessages([{role:'assistant',text:'Row fill',time:1,diff:[{target:'items',property:'tableStyle.rowBackground',before:null,after:'red;display:none'}]}])).toThrow('INVALID_CHAT_RECOVERY');
  });
  it('exposes the current fill and table-only operation without leaking source values',()=>{
    const project=parseChatReply(proposal(),newProject()).candidate;
    const wire=JSON.parse(chatRequest(project,{request,scope:{mode:'selected',id:'items'},typography:[],conversation:[]}));
    expect(wire.layout.table).toEqual({target:'items',rowBackground:'#ffff00'});
    expect(wire.scopeAuthoringTargets[0]).toMatchObject({styleOperation:'set_table_style',allowedStylePatchKeys:['rowBackground']});
    expect(JSON.stringify(wire)).not.toContain('ACME');expect(CHAT_PROMPT).toContain('NOT a table background');
  });
  it('rejects an accent-only substitute and allows ordinary accent requests',()=>{
    for(const text of [request,'Make table row background yellow','把表格数据行背景改成黄色'])expect(()=>parseChatReply(accent,newProject(),{request:text})).toThrow('TABLE_BACKGROUND_INTENT');
    expect(parseChatReply(accent,newProject(),{request:'Use yellow brand accents'}).kind).toBe('proposal');
  });
  it('repairs the wrong accent intent through the bounded harness without applying it',async()=>{
    const project=newProject(),sent=[];
    const result=await runLayoutHarness({project,alias:'demo-fast',request:chatRequest(project,{request,scope:{mode:'whole'},typography:[],conversation:[]}),chat:{request},signal:new AbortController().signal,
      transport:{plan:async(_alias,wire)=>{sent.push(wire);return{text:sent.length===1?accent:proposal()};}},inspectCandidate:async()=>({ready:true})});
    expect(sent).toHaveLength(2);expect(sent[1]).toContain('TABLE_BACKGROUND_INTENT');expect(result.design.tableStyle.rowBackground).toBe('#ffff00');
    expect(project.manifest.studioV3.tableStyle).toBeUndefined();expect(project.revision).toBe(0);
  });
  it('provides fill/reset in existing global and table property forms, respecting staged changes',()=>{
    const project=newProject();
    for(const [selected,kind] of [['items','block'],['global-style','style']]){
      const root=document.createElement('div');root.innerHTML=rightView(project,{mode:'design',selected,tab:'properties',report:null});
      const form=root.querySelector(`form[data-form="${kind}"]`),control=form.elements.rowBackground;expect(control).toBeTruthy();control.value='#ffff00';
      const edited=formDesign(project,selected,form,kind);expect(edited.tableStyle).toEqual({rowBackground:'#ffff00'});expect(project.manifest.studioV3.tableStyle).toBeUndefined();
      const updated=compileProject(project,edited);control.value='';expect(formDesign(updated,selected,form,kind).tableStyle).toBeUndefined();
      control.value='red;display:none';expect(()=>designOperations(project,formDesign(project,selected,form,kind))).toThrow('hex');
    }
  });
});
