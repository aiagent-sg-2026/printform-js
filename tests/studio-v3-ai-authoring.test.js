import {describe,it,expect} from 'vitest';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {parseChatReply,chatRequest} from '../studio-v3/ai-chat-protocol.js';
import {availableBindings,shareAuthoring} from '../studio-v3/ai-authoring.js';
import {runLayoutHarness} from '../studio-v3/ai-harness.js';
import {safeRunDiagnostics} from '../studio-v3/ai-inspection.js';
import {Conversation,cleanMessages} from '../studio-v3/ai-conversation.js';
import {createBus,editProject,designOperations} from '../studio-v3/controller.js';
const plan = operations=>JSON.stringify({kind:'proposal',summary:'Author the referenced form elements',operations});
const label = {type:'set_field',target:'label-customer-ship',patch:{labelStyle:{fontSize:12,bold:true}}};
const request = project=>chatRequest(project,{request:'Label 12pt bold',scope:{mode:'whole'},typography:[],conversation:[]});
describe('framework-native AI authoring',()=> {
  it('makes screenshot label-only edit with unchanged bound values, data, revision and value typography',async()=> {
    const p=newProject(), original=structuredClone(p), result=parseChatReply(plan([label]),p,{scope:{mode:'selected',id:'customer'}});
    expect(result.design.customer.find(f=>f.id==='ship').labelStyle).toEqual({fontSize:12,bold:true});
    expect(result.design.customer.find(f=>f.id==='ship').valueStyle).toBeUndefined();
    expect(result.candidate.sampleData).toEqual(p.sampleData);expect(p).toEqual(original);expect(result.candidate.revision).toBe(p.revision);
    expect(result.candidate.templateHtml).toContain('font-size:12pt;font-weight:700');
    const bus=createBus(p);await editProject(bus,designOperations(bus.project,result.design),'AI authoring');expect(bus.revision).toBe(1);
    await bus.navigateHistory('undo',1);expect(designOf(bus.project)).toEqual(designOf(p));
  });
  it('supports structural field/column authoring, static text and exact stable-ID ordering',()=> {
    const p=newProject(), result=parseChatReply(plan([
      {type:'add_field',section:'footer',field:{id:'note-two',label:'Extra note',kind:'static',text:'Authored note'}},
      {type:'reorder_fields',section:'footer',order:['footer-note-two','footer-notes','footer-signature']},
      {type:'remove_field',target:'items-no'},
      {type:'set_field',target:'items-description',patch:{width:40}}
    ]),p);
    expect(result.design.footer[0].id).toBe('note-two');expect(result.design.columns.some(f=>f.id==='no')).toBe(false);
    expect(result.candidate.sampleData).toEqual(p.sampleData);
    expect(result.diff).toContainEqual({target:'footer-note-two',property:'text',before:'(unset)',after:'Authored note'});
    expect(result.diff).toContainEqual({target:'items-no',property:'pointer',before:'./no',after:'(unset)'});
    expect(cleanMessages([{role:'assistant',text:'Structural edit',time:1,diff:result.diff}])[0].status).toBe('expired');
  });
  it('allows multiple distinct fields to be added to one selected section in a single proposal',()=> {
    const p=newProject(),result=parseChatReply(plan(['a','b'].map(id=>({type:'add_field',section:'footer',field:{id,label:'New note',kind:'static',text:`Note ${id}`}}))),p,{scope:{mode:'selected',id:'footer'}});
    expect(result.design.footer.slice(-2).map(f=>f.id)).toEqual(['a','b']);expect(result.diff.filter(d=>d.property==='add_field').map(d=>d.target)).toEqual(['footer-a','footer-b']);
  });
  it('rebinds only known local paths and distinguishes scalar versus collection values',()=> {
    const p=newProject();expect(availableBindings(p)).toContainEqual({pointer:'/document/reference',type:'string',relative:false});
    const result=parseChatReply(plan([{type:'set_field',target:'header-number',patch:{pointer:'/document/reference'}}]),p);
    expect(result.design.header.find(f=>f.id==='number').pointer).toBe('/document/reference');
    expect(()=>parseChatReply(plan([{type:'set_field',target:'header-number',patch:{pointer:'/missing'}}]),p)).toThrow('UNSAFE_PROPOSAL');
    expect(()=>parseChatReply(plan([{type:'set_collection',value:'/document/reference'}]),p)).toThrow('UNSAFE_PROPOSAL');
  });
  it('atomically changes an explicitly named collection and binds row paths to that collection identity',()=> {
    const p=newProject();p.sampleData.shipments=[{name:'Synthetic',qty:2}];
    const operations=[{type:'set_collection',value:'/shipments'},{type:'reorder_fields',section:'items',order:['items-description','items-quantity','items-no','items-sku','items-rate','items-amount']},...['no','sku','rate','amount'].map(id=>({type:'remove_field',target:`items-${id}`})),{type:'set_field',target:'items-description',patch:{pointer:'./name',width:80}},{type:'set_field',target:'items-quantity',patch:{pointer:'./qty',width:20}}];
    const result=parseChatReply(plan(operations),p,{request:'Use /shipments and columns ./name and ./qty'});
    expect(result.design.collection).toBe('/shipments');expect(result.design.columns.map(c=>c.pointer)).toEqual(['./name','./qty']);
    const wire=JSON.parse(chatRequest(p,{request:'Use /shipments and ./name and ./qty',scope:{mode:'whole'},typography:[],conversation:[]}));expect(wire.authoring.bindings).toContainEqual({pointer:'./name',type:'string',relative:true,collection:'/shipments'});
    expect(()=>parseChatReply(plan([{type:'set_collection',value:'/shipments'}]),p,{request:'Use /shipments'})).toThrow('UNSAFE_PROPOSAL');
  });
  it('makes supported page/section/title changes via canonical compile only',()=> {
    const p=newProject(),result=parseChatReply(plan([
      {type:'set_style',patch:{repeatHeader:false}},
      {type:'reorder_sections',order:['customer','header','items','footer','totals']},
      {type:'set_page',patch:{paper:'LETTER',orientation:'landscape',margins:{top:10,right:10,bottom:10,left:10}}},
      {type:'set_element_style',target:'header-title',patch:{fontSize:24,bold:true}},
      {type:'set_section',target:'customer',patch:{layout:{columns:1,gap:16}}}
    ]),p);
    expect(result.candidate.spec.document.paper).toBe('LETTER');expect(result.design.titleStyle.fontSize).toBe(24);
  });
  it.each([
    {type:'replace_template',value:'<script>evil()</script>'},
    {type:'set_field',target:'totals-total',patch:{amount:0}},
    {type:'set_field',target:'label-customer-ship',patch:{valueStyle:{fontSize:12}}},
    {type:'remove_field',target:'label-customer-ship'},
    {type:'set_field',target:'customer-ship',patch:{labelStyle:{fontSize:12,css:'position:fixed'}}},
    {type:'set_page',patch:{orientation:'other'}},
    {type:'set_logo',value:{assetId:'https://private.example/img',width:20,height:20}},
    {type:'reorder_fields',section:'customer',order:[0,1,2,3]}
  ])('rejects untyped/unsafe code, data edits, role escalation and positional target %j',op=>expect(()=>parseChatReply(plan([op]),newProject())).toThrow());
  it('locally enforces selected field/label/section and multi-reference scope',()=> {
    const p=newProject();expect(parseChatReply(plan([label]),p,{scope:{mode:'selected',id:'label-customer-ship'}}).diff).toHaveLength(1);
    expect(parseChatReply(plan([label]),p,{scope:{mode:'selected',id:'items',ids:['label-customer-ship','footer-notes']}}).diff).toHaveLength(1);
    expect(()=>parseChatReply(plan([label]),p,{scope:{mode:'selected',id:'footer'}})).toThrow('UNSAFE_SCOPE');
    expect(()=>parseChatReply(plan([{type:'set_page',patch:{paper:'A5'}}]),p,{scope:{mode:'selected',id:'customer'}})).toThrow('UNSAFE_SCOPE');
    expect(()=>parseChatReply(plan([{type:'set_field',target:'customer-ship-address',patch:{valueStyle:{fontSize:12}}}]),p,{scope:{mode:'selected',id:'customer-ship'}})).toThrow('UNSAFE_SCOPE');
    expect(()=>parseChatReply(plan([{type:'remove_field',target:'customer-ship-address'}]),p,{scope:{mode:'selected',id:'customer-ship'}})).toThrow('UNSAFE_SCOPE');
    expect(()=>parseChatReply(plan([label]),p,{request:'Explain this layout'})).toThrow('UNSAFE_PROPOSAL');
    expect(()=>parseChatReply(plan([label]),p,{request:'What color is this label?'})).toThrow('UNSAFE_PROPOSAL');
    for (const request of ['Is the current layout using red?','Can you explain the current layout?','Tell me if the table borders are enabled.','Does the header repeat on every page?']) expect(()=>parseChatReply(plan([label]),p,{request})).toThrow('UNSAFE_PROPOSAL');
    expect(parseChatReply(plan([label]),p,{request:'Can you make this label 12pt bold?'}).kind).toBe('proposal');
  });
  it('does not disclose automatic text, image bytes, secrets or sample values in structural context',()=> {
    const p=newProject();p.sampleData.company.name='PRIVATE_COMPANY';p.sampleData.apiKey='VERY_SECRET';p.sampleData.contacts={'someone@example.com':'PRIVATE_CONTACT','record1234567':'PRIVATE'};p.manifest.studioV3.customer[0].label='PRIVATE_LABEL';
    const shared=JSON.stringify(shareAuthoring(p));expect(shared).not.toMatch(/PRIVATE|VERY_SECRET|apiKey|someone@|record1234567|125/);
    expect(shared).toContain('/summary/total');expect(shared).toContain('"type":"number"');
    p.sampleData.customers={alice_smith:{balance:15000}};expect(JSON.stringify(shareAuthoring(p))).not.toContain('alice_smith');
    expect(parseChatReply(plan([{type:'set_field',target:'header-reference',patch:{pointer:'/customers/alice_smith/balance'}}]),p,{request:'Bind /customers/alice_smith/balance to this ordinary reference field'}).design.header.find(f=>f.id==='reference').pointer).toBe('/customers/alice_smith/balance');
  });
  it('recovers authoring diff only as inert expired history with no candidate or tool authority',()=> {
    const p=newProject(),result=parseChatReply(plan([label,{type:'set_heading',value:'New title'}]),p),c=new Conversation();
    c.add('assistant',result.summary,'ready',{diff:result.diff,documentKey:p.manifest.documentId,candidate:result.candidate});
    const saved=c.snapshot();expect(JSON.stringify(saved)).not.toContain('candidate');expect(cleanMessages(saved)[0].status).toBe('expired');
  });
  it('cannot forge supplied numeric/financial values using static text, rebindings or display-format changes',()=> {
    const p=newProject();for(const patch of [{kind:'static',text:'999999.00'},{text:'999999.00'},{pointer:'/summary/tax'},{format:'percent'}])expect(()=>parseChatReply(plan([{type:'set_field',target:'totals-total',patch}]),p)).toThrow('UNSAFE_PROPOSAL');
    expect(()=>parseChatReply(plan([{type:'add_field',section:'totals',field:{id:'new-total',kind:'static',label:'Total',text:'999999',format:''}}]),p)).toThrow('UNSAFE_PROPOSAL');
    const d=designOf(p),rate=d.columns.find(c=>c.id==='rate');rate.id='custom-cost';rate.pointer='./cost';for(const item of p.sampleData.items)item.cost=125;const custom=compileProject(p,d);
    expect(()=>parseChatReply(plan([{type:'set_field',target:'items-custom-cost',patch:{pointer:'./quantity'}}]),custom)).toThrow('UNSAFE_PROPOSAL');
  });
  it('records implicit nonfinancial binding cleanup and rejects duplicate field/label aliases',()=> {
    const p=newProject(), result=parseChatReply(plan([{type:'set_field',target:'customer-ship',patch:{kind:'static',text:'User supplied static note'}}]),p);
    expect(result.diff).toContainEqual({target:'customer-ship',property:'pointer',before:'/shipTo/name',after:''});
    expect(()=>parseChatReply(plan([{type:'set_field',target:'customer-ship',patch:{labelStyle:{fontSize:12}}},{type:'set_field',target:'label-customer-ship',patch:{labelStyle:{fontSize:15}}}]),p)).toThrow('UNSAFE_PROPOSAL');
  });
  it('keeps large legal authoring diffs recoverable under the same parser/history cap',()=> {
    const p=newProject(), ops=[];for(const section of ['header','customer','items','totals','footer']) for(const f of (section==='items'?p.manifest.studioV3.columns:p.manifest.studioV3[section]))ops.push({type:'set_field',target:`${section}-${f.id}`,patch:{label:'New label',showLabel:true,labelStyle:{fontSize:10},valueStyle:{fontSize:10},...(f.format ? {} : {format:'number'})}});
    // Every operation changes five independently disclosed properties on nonnumeric fields.
    const result=parseChatReply(plan(ops),p),c=new Conversation();c.add('assistant','Large authoring edit','ready',{diff:result.diff});expect(result.diff.length).toBeGreaterThan(96);expect(cleanMessages(c.snapshot())[0].status).toBe('expired');
  });
});
describe('bounded inspected Pi run',()=> {
  it('repairs blocked geometry in at most three real Harness completions, shares no render text and returns one unapplied candidate',async()=> {
    const p=newProject(),sent=[];let inspections=0;
    const result=await runLayoutHarness({project:p,alias:'demo-fast',request:request(p),chat:{request:'Label 12pt bold'},signal:new AbortController().signal,
      transport:{plan:async(_alias,wire)=>{sent.push(wire);return {text:plan([label]),usage:{prompt_tokens:5,completion_tokens:3,total_tokens:8}};}},
      inspectCandidate:async()=>{inspections++;return inspections===1 ? {quality:{ready:false,errors:[{code:'HORIZONTAL_OVERFLOW',message:'PRIVATE: 125.00'}]},report:{status:'blocked',issues:[{code:'HORIZONTAL_OVERFLOW',component_id:'label-customer-ship',text:'PRIVATE',reason:'PRIVATE',selector:'PRIVATE',measured_size:{width:900,height:12},available_size:{width:794,height:1123}}]}} : {quality:{ready:true,errors:[]},report:{status:'ready'}};}
    });
    expect(sent).toHaveLength(2);expect(inspections).toBe(2);expect(result.iterations).toBe(2);expect(result.inspection.ready).toBe(true);expect(result.usage.total).toBe(16);expect(sent[1]).toContain('HORIZONTAL_OVERFLOW');expect(sent[1]).not.toContain('PRIVATE');expect(p.revision).toBe(0);
  });
  it('stops at the stated cap if inspection remains blocked without fake success or automatic apply',async()=> {
    const p=newProject();let calls=0;
    const result=await runLayoutHarness({project:p,alias:'demo-fast',request:request(p),signal:new AbortController().signal,transport:{plan:async()=>{calls++;return{text:plan([label])};}},inspectCandidate:async()=>({quality:{ready:false,errors:[{code:'VERTICAL_OVERFLOW'}]},report:{status:'blocked'}})});
    expect(calls).toBe(3);expect(result.inspection.ready).toBe(false);expect(result.usage.total).toBeNull();expect(p.revision).toBe(0);
  });
  it('aborts before another request when context changes and retains read-only question behavior',async()=> {
    const p=newProject();let calls=0,stale=false;
    await expect(runLayoutHarness({project:p,alias:'demo-fast',request:request(p),signal:new AbortController().signal,assertContext:()=>{if(stale)throw Object.assign(new Error('STALE_PROPOSAL'),{code:'STALE_PROPOSAL'});},transport:{plan:async()=>{calls++;return{text:plan([label])};}},inspectCandidate:async()=>{stale=true;throw Object.assign(new Error('STALE_PROPOSAL'),{code:'STALE_PROPOSAL'});}})).rejects.toThrow('STALE_PROPOSAL');expect(calls).toBe(1);
    let inspected=false;const result=await runLayoutHarness({project:p,alias:'demo-fast',request:request(p),signal:new AbortController().signal,transport:{plan:async()=>({text:JSON.stringify({kind:'answer',message:'Read-only.'})})},inspectCandidate:async()=>{inspected=true;}});expect(result.kind).toBe('answer');expect(inspected).toBe(false);
  });
  it('diagnostic allowlist removes unexpected codes, IDs, paths, text and all nonfinite geometry',()=> {
    const d=safeRunDiagnostics({quality:{errors:[{code:'SECRET',message:'PRIVATE',path:'/secret'}]},report:{issues:[{code:'SECRET',component_id:'PRIVATE',text:'PRIVATE',measured_size:{width:Infinity,height:10}}]}},newProject());
    expect(JSON.stringify(d)).not.toMatch(/SECRET|PRIVATE|secret|Infinity/);expect(d.errors).toEqual(['VALIDATION_BLOCKED']);
  });
});
