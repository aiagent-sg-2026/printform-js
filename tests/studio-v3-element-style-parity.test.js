import {describe,it,expect} from 'vitest';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {createBus,formDesign,designOperations,editProject} from '../studio-v3/controller.js';
import {rightView} from '../studio-v3/workspace-views.js';
import {applyAuthoring} from '../studio-v3/ai-authoring.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {elementStyleChange,validateFieldStyle} from '../studio-v3/element-style.js';
import {pageSettings} from '../studio-v3/design-authoring.js';
import {bindingValidation,inspectProject} from '../studio-v3/validation.js';
import {createAgentTools} from '../studio-v3/agent-tools.js';
import {createGrant} from '../studio-v3/agent-effects.js';

const keyFor = target => target === 'header-title' ? 'titleStyle' : 'pageNumberStyle';
const operation = (target,patch) => ({type:'set_element_style',target,patch});
const initialStyle = {fontSize:14,bold:true,color:'#112233',align:'left'};
const inspector = (project,target,patch) => {
  const root = document.createElement('div'), kind = target === 'header-title' ? 'block' : 'style', prefix = keyFor(target);
  root.innerHTML = rightView(project,{mode:'design',selected:target,tab:'properties',report:null});
  const form = root.querySelector(`form[data-form="${kind}"]`);
  for (const property of ['fontSize','bold','color','align']) {
    const input = form.elements[`${prefix}.${property}`], value = patch[property] === undefined ? '' : String(patch[property]);
    if (input.tagName === 'SELECT' && !Array.from(input.options).some(option=>option.value === value)) input.add(new Option(value,value));
    input.value = value;
  }
  return {form,kind};
};
const failure = work => { try { work(); } catch (error) { return {code:error.code,message:error.message}; } throw new Error('Expected rejection'); };
// The forms materialize page defaults and the header's false keepTogether switch.
const normalized = design => ({...structuredClone(design),page:pageSettings(design),blocks:{...structuredClone(design.blocks),header:{...design.blocks.header,keepTogether:design.blocks.header.keepTogether ?? false}}});
const shape = project => ({...project,manifest:{...project.manifest,studioV3:normalized(project.manifest.studioV3)}});
const withStyle = (type,target) => {
  const project = newProject(type), design = designOf(project); design[keyFor(target)] = structuredClone(initialStyle);
  return compileProject(project,design);
};

describe('shared element typography and real inspector/operation adapters',()=> {
  it.each([{}, {fontSize:6}, {fontSize:72}, {fontSize:6.25}, {fontSize:6.5,bold:false}, {bold:true}, {color:'#12aBcD'}, {align:'center'}, {fontSize:20,bold:false,color:'#ABCDEF',align:'right'}])('element-style inspector and operation produce equivalent candidates for %j',async patch=> {
    for (const type of ['invoice','purchase','delivery']) for (const target of ['header-title','page-number']) {
      const project = withStyle(type,target), before = structuredClone(project), initial = designOf(project), input = inspector(project,target,patch);
      expect(input.form.checkValidity()).toBe(true);
      const ui = formDesign(project,target,input.form,input.kind), pi = designOf(project), applied = applyAuthoring(pi,[operation(target,patch)],project);
      const shared = elementStyleChange(initial,target,patch), expected = structuredClone(initial);
      if (Object.keys(patch).length) expected[keyFor(target)] = structuredClone(patch); else delete expected[keyFor(target)];
      expect(normalized(ui)).toEqual(normalized(pi)); expect(normalized(pi)).toEqual(normalized(shared.design)); expect(normalized(ui)).toEqual(normalized(expected));
      expect(applied).toEqual({targets:[target],diff:[{target,property:'typography',before:JSON.stringify(initialStyle),after:Object.keys(patch).length ? JSON.stringify(patch) : '(unset)'}]});
      const draft = createDraft(project,{scope:{mode:'selected',id:target}}), step = draft.apply('Typography',[operation(target,patch)]), candidate = compileProject(project,ui);
      expect(shape(step.candidate)).toEqual(shape(candidate)); expect(shape(draft.project)).toEqual(shape(candidate)); expect(draft.version).toBe(1);
      expect(bindingValidation(candidate)).toEqual(bindingValidation(step.candidate)); expect(bindingValidation(candidate).valid).toBe(true);
      expect(inspectProject(candidate,null)).toEqual(inspectProject(step.candidate,null));
      const bus = createBus(project), committed = structuredClone(bus.project);
      expect(bus.revision).toBe(0); expect(bus.project).toEqual(committed);
      await editProject(bus,designOperations(bus.project,ui),'inspector typography');
      expect(normalized(designOf(bus.project))).toEqual(normalized(pi)); expect(bus.project.sampleData).toEqual(before.sampleData);
      await bus.navigateHistory('undo',bus.revision); expect(designOf(bus.project)).toEqual(initial); expect(project).toEqual(before);
    }
  });
  it.each([{fontSize:5.99},{fontSize:72.01},{fontSize:0},{color:'yellow'},{color:'#ff0'},{color:'#gggggg'},{color:'#ffff00;display:none'},{align:'justify'}])('common service errors reject %j without mutation and recover',async patch=> {
    for (const target of ['header-title','page-number']) {
      const project = withStyle('invoice',target), before = structuredClone(project), bus = createBus(project), committed = structuredClone(bus.project), input = inspector(bus.project,target,patch);
      const pi = designOf(project), initial = structuredClone(pi), uiError = failure(()=>formDesign(bus.project,target,input.form,input.kind));
      expect(uiError).toEqual(failure(()=>applyAuthoring(pi,[operation(target,patch)],project))); expect(uiError.code).toBe('UNSAFE_PROPOSAL');
      await expect(async()=>editProject(bus,designOperations(bus.project,formDesign(bus.project,target,input.form,input.kind)),'invalid')).rejects.toThrow('UNSAFE_PROPOSAL');
      expect(pi).toEqual(initial); expect(bus.project).toEqual(committed); expect(bus.revision).toBe(0); expect(project).toEqual(before);
      const draft = createDraft(project), candidate = draft.project;
      expect(()=>draft.apply('Invalid batch',[{type:'set_style',patch:{padding:12}},operation(target,patch)])).toThrow('UNSAFE_PROPOSAL');
      expect(draft.project).toBe(candidate); expect(draft.count).toBe(0); expect(draft.version).toBe(0);
      const recovery = draft.apply('Recovery',[operation(target,{fontSize:20,bold:false})]); expect(recovery.design[keyFor(target)]).toEqual({fontSize:20,bold:false});
    }
  });
  it.each([null,[],17,'style',{fontSize:'12'},{fontSize:NaN},{fontSize:Infinity},{bold:'false'},{bold:null},{color:17},{align:null},{css:'body{}'}])('rejects raw invalid patch %j before the effect',patch=> {
    const project = newProject(), design = designOf(project), before = structuredClone(design);
    expect(()=>elementStyleChange(design,'header-title',patch)).toThrow('UNSAFE_PROPOSAL');
    expect(()=>applyAuthoring(design,[operation('header-title',patch)],project)).toThrow('UNSAFE_PROPOSAL'); expect(design).toEqual(before);
  });
  it.each(['items','items-description','label-header-company','customer','header-logo'])('keeps selected-scope denial for %s with fresh recovery',id=> {
    const project = newProject();
    for (const target of ['header-title','page-number']) {
      const draft = createDraft(project,{scope:{mode:'selected',id}});
      expect(()=>draft.apply('Forbidden typography',[operation(target,{fontSize:20})])).toThrow('UNSAFE_SCOPE');
      expect(draft.project).toBe(project); expect(draft.version).toBe(0); expect(draft.count).toBe(0);
      const recovery = createDraft(project,{scope:{mode:'selected',id:target}}); recovery.apply('Recovery',[operation(target,{fontSize:20})]);
      expect(recovery.project.manifest.studioV3[keyFor(target)]).toEqual({fontSize:20});
    }
  });
  it('keeps partial replacement, inherited no-op, missing controls, target and duplicate-step behavior',()=> {
    for (const target of ['header-title','page-number']) {
      const project = newProject(), empty = elementStyleChange(designOf(project),target,{});
      expect(empty.design).toEqual(designOf(project)); expect(()=>createDraft(project).apply('No change',[operation(target,{})])).toThrow('NO_CHANGES');
      const initial = withStyle('invoice',target), input = inspector(initial,target,{bold:false}); input.form.elements[`${keyFor(target)}.fontSize`].remove();
      expect(normalized(formDesign(initial,target,input.form,input.kind))).toEqual(normalized(designOf(initial)));
      const draft = createDraft(initial);
      expect(()=>draft.apply('Duplicate',[operation(target,{bold:false}),operation(target,{color:'#ffffff'})])).toThrow('UNSAFE_PROPOSAL'); expect(draft.project).toBe(initial);
      draft.apply('Reset',[operation(target,{})]); expect(draft.project.manifest.studioV3[keyFor(target)]).toBeUndefined();
    }
    expect(()=>elementStyleChange(designOf(newProject()),'__proto__',{})).toThrow('UNSAFE_PROPOSAL');
    const style = {fontSize:12,bold:false,color:'#ABCDEF',align:'left'}; expect(validateFieldStyle(style)).toBe(style);
  });
  it('keeps registered schema, read-only grants and selected scopes ahead of the shared effect',async()=> {
    const project = newProject(), run = (id,profile='design') => {
      const draft = createDraft(project,{scope:id ? {mode:'selected',id} : {mode:'whole'}}), tools = createAgentTools({draft,outcome:{},context:()=>'',signal:new AbortController().signal,
        limits:{maxTurns:100,maxRepeatedFailures:100},grant:createGrant(profile)}), tool = tools.find(tool=>tool.name === 'apply_operations');
      const call = async operations => { const args = {summary:'Typography',operations}; tool.prepareArguments(args); return tool.execute('element-style',args); };
      return {draft,call};
    };
    for (const target of ['header-title','page-number']) {
      const allowed = run(target);
      for (const patch of [{fontSize:5.99},{bold:'false'},{color:'#ff0'},{css:'body{}'}]) await expect(allowed.call([operation(target,patch)])).rejects.toMatchObject({code:'AGENT_ARGUMENTS_INVALID'});
      expect(allowed.draft.project).toBe(project); expect(allowed.draft.version).toBe(0);
      await allowed.call([operation(target,{fontSize:20,bold:false})]); const input = inspector(project,target,{fontSize:20,bold:false});
      expect(shape(allowed.draft.project)).toEqual(shape(compileProject(project,formDesign(project,target,input.form,input.kind))));
      const scoped = run(target === 'header-title' ? 'page-number' : 'header-title');
      await expect(scoped.call([operation(target,{fontSize:20})])).rejects.toMatchObject({code:'UNSAFE_SCOPE'}); expect(scoped.draft.project).toBe(project);
      const readonly = run(null,'read-only'); await expect(readonly.call([operation(target,{fontSize:20})])).rejects.toMatchObject({code:'GRANT_DENIED'}); expect(readonly.draft.project).toBe(project);
    }
  });
  it('normalizes a legacy empty stored override without changing supplied data or other styles',()=> {
    for (const target of ['header-title','page-number']) {
      const initial = designOf(newProject()); initial[keyFor(target)] = {};
      const project = compileProject(newProject(),initial), before = structuredClone(project), input = inspector(project,target,{}), draft = createDraft(project);
      const ui = formDesign(project,target,input.form,input.kind); draft.apply('Restore inheritance',[operation(target,{})]);
      expect(shape(draft.project)).toEqual(shape(compileProject(project,ui))); expect(draft.project.manifest.studioV3[keyFor(target)]).toBeUndefined();
      expect(draft.project.sampleData).toEqual(before.sampleData); expect(project).toEqual(before);
    }
  });
  it('treats reordered but identical typography keys as no change through actual adapters and the registered tool',async()=> {
    const patch = {align:'left',color:'#112233',bold:true,fontSize:14};
    for (const target of ['header-title','page-number']) {
      const project = withStyle('invoice',target), before = structuredClone(project), input = inspector(project,target,patch), design = designOf(project);
      expect(normalized(formDesign(project,target,input.form,input.kind))).toEqual(normalized(design));
      expect(applyAuthoring(design,[operation(target,patch)],project)).toEqual({targets:[target],diff:[]}); expect(design).toEqual(designOf(project));
      const draft = createDraft(project), tools = createAgentTools({draft,outcome:{},context:()=>'',signal:new AbortController().signal,
        limits:{maxTurns:100,maxRepeatedFailures:100},grant:createGrant('design')}), tool = tools.find(tool=>tool.name === 'apply_operations');
      const call = async patch => { const args = {summary:'Typography',operations:[operation(target,patch)]}; tool.prepareArguments(args); return tool.execute('no-op',args); };
      expect(()=>draft.apply('Same style',[operation(target,patch)])).toThrow('NO_CHANGES');
      await expect(call(patch)).rejects.toMatchObject({code:'NO_CHANGES'}); expect(draft.project).toBe(project); expect(draft.version).toBe(0); expect(draft.count).toBe(0);
      await call({...patch,fontSize:14.25}); expect(draft.project.manifest.studioV3[keyFor(target)]).toEqual({...patch,fontSize:14.25}); expect(project).toEqual(before);
    }
  });
});
