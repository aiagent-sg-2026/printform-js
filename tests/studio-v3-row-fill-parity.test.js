import {describe,it,expect} from 'vitest';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {createBus,formDesign,designOperations,editProject} from '../studio-v3/controller.js';
import {rightView} from '../studio-v3/workspace-views.js';
import {applyAuthoring} from '../studio-v3/ai-authoring.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {tableStyleChange} from '../studio-v3/table-style.js';
import {pageSettings} from '../studio-v3/design-authoring.js';
import {bindingValidation} from '../studio-v3/validation.js';
import {createAgentTools} from '../studio-v3/agent-tools.js';
import {createGrant} from '../studio-v3/agent-effects.js';

const operation = value => ({type:'set_table_style',target:'items',patch:{rowBackground:value}});
const inspector = (project,kind,value) => {
  const selected = kind === 'style' ? 'global-style' : 'items', root = document.createElement('div');
  root.innerHTML = rightView(project,{mode:'design',selected,tab:'properties',report:null});
  const form = root.querySelector(`form[data-form="${kind}"]`);
  form.elements.rowBackground.value = value;
  return {selected,form};
};
const failure = work => { try { work(); } catch (error) { return {code:error.code,message:error.message}; } throw new Error('Expected rejection'); };
// The existing global form materializes default page settings; normalize only that equivalent representation.
const normalized = design => ({...structuredClone(design),page:pageSettings(design)});
const candidateShape = project => ({...project,manifest:{...project.manifest,studioV3:normalized(project.manifest.studioV3)}});

describe('shared table row-fill service and real inspector/operation adapters',()=> {
  it.each(['#000000','#FFFFFF','#12aBcD','#ffff00',null])('row-fill inspector and operation produce equivalent candidates for %j',async value=> {
    for (const type of ['invoice','purchase','delivery']) for (const kind of ['style','block']) for (const striped of [true,false]) {
      let project = newProject(type);
      const initial = designOf(project); initial.striped = striped; initial.tableStyle = {rowBackground:'#112233'};
      project = compileProject(project,initial);
      const before = structuredClone(project), input = inspector(project,kind,value ?? ''), ui = formDesign(project,input.selected,input.form,kind);
      const pi = designOf(project), applied = applyAuthoring(pi,[operation(value)],project);
      const shared = tableStyleChange(initial,'items',{rowBackground:value});
      expect(normalized(ui)).toEqual(normalized(pi)); expect(normalized(ui)).toEqual(normalized(shared.design)); expect(shared.diagnostics).toEqual([]);
      const expected = structuredClone(initial);
      if (value === null) delete expected.tableStyle; else expected.tableStyle = {rowBackground:value};
      expect(normalized(ui)).toEqual(normalized(expected));
      expect(applied).toEqual({targets:['items'],diff:[{target:'items',property:'tableStyle.rowBackground',before:'#112233',after:value ?? '(unset)'}]});
      const draft = createDraft(project,{scope:{mode:'selected',id:'items'}}), step = draft.apply('Row fill',[operation(value)]);
      const uiCandidate = compileProject(project,ui);
      expect(candidateShape(step.candidate)).toEqual(candidateShape(uiCandidate)); expect(candidateShape(draft.project)).toEqual(candidateShape(uiCandidate)); expect(draft.version).toBe(1);
      expect(bindingValidation(uiCandidate)).toEqual(bindingValidation(step.candidate)); expect(bindingValidation(uiCandidate).valid).toBe(true);
      const bus = createBus(project), committedBefore = structuredClone(bus.project);
      expect(bus.revision).toBe(0); expect(bus.project).toEqual(committedBefore);
      await editProject(bus,designOperations(bus.project,ui),'inspector row fill');
      expect(bus.revision).toBe(1); expect(normalized(designOf(bus.project))).toEqual(normalized(pi)); expect(bus.project.sampleData).toEqual(before.sampleData);
      await bus.navigateHistory('undo',bus.revision); expect(designOf(bus.project)).toEqual(initial);
      expect(project).toEqual(before);
    }
  });
  it.each(['yellow','#ff0','#ffff0000','#ffff00;display:none','url(https://example.com/a)','#gggggg','x'.repeat(300)])('row-fill adapters reject %s with the same error and no mutations',async value=> {
    const project = newProject(), before = structuredClone(project);
    for (const kind of ['style','block']) {
      const bus = createBus(project), committed = structuredClone(bus.project), input = inspector(bus.project,kind,value);
      const uiError = failure(()=>formDesign(bus.project,input.selected,input.form,kind)), pi = designOf(project), original = structuredClone(pi);
      const piError = failure(()=>applyAuthoring(pi,[operation(value)],project));
      expect(uiError).toEqual(piError); expect(uiError.code).toBe('UNSAFE_PROPOSAL'); expect(uiError.message).toContain('six-digit hex');
      await expect(async()=>editProject(bus,designOperations(bus.project,formDesign(bus.project,input.selected,input.form,kind)),'invalid')).rejects.toThrow('hex');
      expect(pi).toEqual(original); expect(bus.project).toEqual(committed); expect(bus.revision).toBe(0); expect(project).toEqual(before);
      const draft = createDraft(project), candidate = draft.project;
      expect(()=>draft.apply('Invalid',[{type:'set_style',patch:{padding:12}},operation(value)])).toThrow('UNSAFE_PROPOSAL');
      expect(draft.project).toBe(candidate); expect(draft.version).toBe(0); expect(draft.count).toBe(0);
      const recovered = draft.apply('Recovery',[operation('#abcdef')]); expect(recovered.design.tableStyle.rowBackground).toBe('#abcdef');
    }
  });
  it.each([undefined,17,false,{},[],{rowBackground:'#ffffff',css:'body{}'}])('rejects raw non-color/unknown patch values %j without touching the input',value=> {
    const project = newProject(), design = designOf(project), before = structuredClone(design);
    const patch = value?.css ? value : {rowBackground:value};
    expect(()=>tableStyleChange(design,'items',patch)).toThrow('UNSAFE_PROPOSAL');
    expect(()=>applyAuthoring(design,[{...operation(null),patch}],project)).toThrow('UNSAFE_PROPOSAL');
    expect(design).toEqual(before);
  });
  it.each(['items-header','items-description','label-items-description','customer','header','totals-total'])('retains selected-scope denial for %s with candidate recovery',id=> {
    const project = newProject(), draft = createDraft(project,{scope:{mode:'selected',id}}), before = draft.project;
    expect(()=>draft.apply('Forbidden row fill',[operation('#ffffff')])).toThrow('UNSAFE_SCOPE');
    expect(draft.project).toBe(before); expect(draft.count).toBe(0); expect(draft.version).toBe(0);
    const recovery = createDraft(project,{scope:{mode:'selected',id:'items'}});
    recovery.apply('Allowed row fill',[operation('#ffffff')]); expect(recovery.project.manifest.studioV3.tableStyle.rowBackground).toBe('#ffffff');
    expect(project).toEqual(before);
  });
  it('keeps trimming and missing-input/no-op behavior in the adapters, without widening operation values',()=> {
    const project = newProject(), input = inspector(project,'style','  #12aBcD  ');
    expect(normalized(formDesign(project,input.selected,input.form,'style'))).toEqual(normalized(tableStyleChange(designOf(project),'items',{rowBackground:'#12aBcD'}).design));
    expect(()=>createDraft(project).apply('Whitespace',[operation('  #12aBcD  ')])).toThrow('UNSAFE_PROPOSAL');
    input.form.elements.rowBackground.remove(); expect(normalized(formDesign(project,input.selected,input.form,'style'))).toEqual(normalized(designOf(project)));
    const empty = tableStyleChange(designOf(project),'items',{}); expect(empty.design).toEqual(designOf(project)); expect(empty.changes).toEqual([]);
    for (const value of [null,'#112233']) {
      const initial = designOf(project); if (value !== null) initial.tableStyle = {rowBackground:value};
      const current = compileProject(project,initial), draft = createDraft(current);
      expect(()=>draft.apply('No change',[operation(value)])).toThrow('NO_CHANGES'); expect(draft.project).toBe(current);
    }
  });
  it('does not allow unsupported targets/patches or duplicate steps to partially change a candidate',()=> {
    const project = newProject(), draft = createDraft(project), before = draft.project;
    for (const operations of [[{...operation('#ffffff'),target:'items-header'}],[{...operation('#ffffff'),patch:{background:'#ffffff'}}],[operation('#ffffff'),operation('#000000')]]) {
      expect(()=>draft.apply('Invalid',[...operations])).toThrow('UNSAFE_PROPOSAL'); expect(draft.project).toBe(before); expect(draft.count).toBe(0);
    }
    draft.apply('Recovery',[operation('#ffffff')]); expect(draft.count).toBe(1);
  });
  it('keeps registered schema, read-only grants and selected scopes ahead of the shared effect',async()=> {
    const project = newProject();
    const run = (scope,profile='design') => {
      const draft = createDraft(project,{scope}), tools = createAgentTools({draft,outcome:{},context:()=>'',signal:new AbortController().signal,
        limits:{maxTurns:100,maxRepeatedFailures:100},grant:createGrant(profile)}), tool = tools.find(tool=>tool.name === 'apply_operations');
      const call = async operations => { const args = {summary:'Row fill',operations}; tool.prepareArguments(args); return tool.execute('row-fill',args); };
      return {draft,call};
    };
    const allowed = run({mode:'selected',id:'items'});
    for (const value of ['yellow',17,false]) await expect(allowed.call([operation(value)])).rejects.toMatchObject({code:'AGENT_ARGUMENTS_INVALID'});
    expect(allowed.draft.project).toBe(project); expect(allowed.draft.version).toBe(0);
    await allowed.call([operation('#12aBcD')]);
    const input = inspector(project,'block','#12aBcD');
    expect(allowed.draft.project).toEqual(compileProject(project,formDesign(project,input.selected,input.form,'block')));
    const scoped = run({mode:'selected',id:'items-description'});
    await expect(scoped.call([operation('#12aBcD')])).rejects.toMatchObject({code:'UNSAFE_SCOPE'}); expect(scoped.draft.project).toBe(project);
    const readonly = run({mode:'whole'},'read-only');
    await expect(readonly.call([operation('#12aBcD')])).rejects.toMatchObject({code:'GRANT_DENIED'}); expect(readonly.draft.project).toBe(project);
  });
});
