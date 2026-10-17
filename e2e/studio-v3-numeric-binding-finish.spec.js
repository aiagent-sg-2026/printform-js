import {test,expect} from './studio-v3-test.js';
import {mountNumericProbeModules} from './studio-v3-rendered-probes.js';

test('an intermediate numeric source mismatch cannot finish until real preview validation succeeds',async({page},info)=> {
  await page.goto('/studio-v3/');
  await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
  const moduleUrl=await mountNumericProbeModules(page);
  const result=await page.evaluate(async moduleUrl=> {
    const {newProject,designOf,compileProject,createDraft,createAgentTools,PaperPreview,inspectProject,bindingValidation,DEMO_CONFIG}=await import(moduleUrl);
    const project=newProject('invoice',true), design=designOf(project);
    project.sampleData={operations:[{suppliedHours:1.5,alternate:2.5,sourceId:'SRC-0007'}]};
    design.additionalTables=[{id:'table-work',label:'Supplied work',collection:'/operations',enabled:true,repeatHeader:true,breakBefore:false,columns:[
      {id:'hours',label:'Supplied hours',pointer:'./suppliedHours',format:'number',width:50},
      {id:'reference',label:'Source ID',pointer:'./sourceId',format:'',width:50}
    ]}];
    const original=compileProject(project,design), source=JSON.stringify(original.sampleData);
    const draft=createDraft(original,{request:'Choose supplied ./alternate; report incompatible ./sourceId instead of inventing values'});
    const frame=document.createElement('iframe'); frame.setAttribute('sandbox','allow-scripts allow-modals');
    frame.style.cssText='position:fixed;left:0;top:0;width:820px;height:1200px;border:0;z-index:10000'; document.body.append(frame);
    const preview=new PaperPreview(frame,()=>{},()=>{}), outcome={}, inspections=[];
    const tools=createAgentTools({draft,context:()=>({}),signal:new AbortController().signal,outcome,limits:DEMO_CONFIG.agent,identity:{release:'development',verified:false},
      inspect:async({candidate})=> {
        const report=await preview.render(candidate);
        inspections.push({report,pages:preview.pages.length});
        return {report,quality:inspectProject(candidate,report)};
      }});
    const call=async(name,args)=> {const tool=tools.find(tool=>tool.name===name);tool.prepareArguments(args);return tool.execute('numeric-source-regression',args);};
    const inspect=async()=>JSON.parse((await call('inspect_draft',{})).content[0].text);
    try {
      await call('apply_operations',{summary:'Choose an incompatible supplied identifier',operations:[{type:'set_field',target:'table-work-hours',patch:{pointer:'./sourceId'}}]});
      const typed=bindingValidation(draft.project), wrong=await inspect();
      let rejected=null;
      try {await call('finish',{summary:'Must not deliver an incompatible numeric binding'});} catch(error) {rejected=error.code;}
      const hadWrongProposal=Boolean(outcome.proposal);
      await call('undo_step',{});
      await call('apply_operations',{summary:'Choose a compatible supplied numeric source',operations:[{type:'set_field',target:'table-work-hours',patch:{pointer:'./alternate'}}]});
      const valid=await inspect(); await call('finish',{summary:'Review the compatible supplied numeric binding'});
      return {typedValid:typed.valid,typedCodes:typed.errors.map(error=>error.code),wrongReady:wrong.ready,wrongCodes:wrong.errors,rejected,hadWrongProposal,validReady:valid.ready,
        inspections,proposedPointer:outcome.proposal?.design.additionalTables[0].columns[0].pointer,
        originalUnchanged:JSON.stringify(original.sampleData)===source,draftDataUnchanged:JSON.stringify(draft.project.sampleData)===source};
    } finally {preview.cancel();frame.remove();}
  },moduleUrl);
  await info.attach('numeric-binding-preview-and-finish.json',{body:JSON.stringify(result),contentType:'application/json'});
  expect(result.inspections).toHaveLength(2);
  expect(result.inspections[0].report.status).toBe('blocked');
  expect(result.inspections[0].report.validation.errors.map(error=>error.code)).toContain('NUMBER_REQUIRED');
  expect(result.inspections[1].report.status).toBe('ready');
  expect(result.inspections[1].pages).toBeGreaterThan(0);
  expect(result.typedValid).toBe(false); expect(result.typedCodes).toContain('NUMBER_REQUIRED');
  expect(result.wrongReady).toBe(false); expect(result.wrongCodes).toContain('NUMBER_REQUIRED');
  expect(result.rejected).toBe('AGENT_INSPECTION_BLOCKED'); expect(result.hadWrongProposal).toBe(false);
  expect(result.validReady).toBe(true); expect(result.proposedPointer).toBe('./alternate');
  expect(result.originalUnchanged).toBe(true); expect(result.draftDataUnchanged).toBe(true);
});
