import { describe,it,expect } from 'vitest';
import { newProject,designOf,compileProject,selectionField } from '../studio-v3/model.js';
import { tableDefinitions } from '../studio-v3/additional-tables.js';
import { alterTables } from '../studio-v3/additional-table-controls.js';
import { createBus,editProject,designOperations,formDesign,alterFields } from '../studio-v3/controller.js';
import { readProject,saveProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { bindingValidation } from '../studio-v3/validation.js';
import { rightView,leftView } from '../studio-v3/workspace-views.js';
import { shareAuthoring } from '../studio-v3/ai-authoring.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { protectedBindings,assertProtectedBindings } from '../studio-v3/agent-binding-invariants.js';
import { parseChatReply,scopeAuthoringTargets } from '../studio-v3/ai-chat-protocol.js';

const supplied = () => {
  const project = newProject();
  project.sampleData.operations = [{operation:'Cut <raw>',hours:'01.500',sourceId:'0007'},{operation:'Finish',hours:'0.250',sourceId:'0008'}];
  return project;
};
const withTable = () => {
  const project = supplied(), added = alterTables(project,'items','add-table');
  return {project:compileProject(project,added.design),id:added.selected};
};
const bind = project => {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  return bindTemplate(template,project.sampleData,project.manifest);
};

describe('independently scoped source tables',()=> {
  it('retains the canonical primary table and binds independent arrays without joins or coercion',()=> {
    const initial = supplied(), primary = designOf(initial), {project,id} = withTable(), design = designOf(project);
    expect(design.collection).toBe(primary.collection); expect(design.columns).toEqual(primary.columns);
    expect(tableDefinitions(design).map(table=>table.collection)).toEqual(['/items','/operations']);
    const result = bind(project);
    expect(result.report.errors).toEqual([]);
    expect(result.report.tableRowsByTable.items).toBe(45); expect(result.report.tableRowsByTable[id]).toBe(2);
    expect(result.fragment.textContent).toContain('Cut <raw>'); expect(result.fragment.textContent).toContain('01.500');
    expect(result.fragment.textContent).toContain('0007'); expect(result.fragment.querySelector('raw')).toBeNull();
    expect(project.sampleData).toEqual(initial.sampleData); expect(bindingValidation(project).valid).toBe(true);
    expect(selectionField(design,`${id}-column-2`).field.pointer).toBe('./hours');
    expect(project.spec.components.find(component=>component.id === id).binding.each).toBe('/operations');
  });
  it('human controls apply table changes with Undo and persist exact source and settings',async()=> {
    const initial = supplied(), bus = createBus(initial), added = alterTables(initial,'items','add-table');
    await editProject(bus,designOperations(bus.project,added.design),'add independent table');
    const root = document.createElement('div'); root.innerHTML = rightView(bus.project,{mode:'design',selected:added.selected,tab:'properties'});
    const form = root.querySelector('[data-form="additional-table"]');
    form.elements.label.value = 'Supplied operations'; form.elements.repeatHeader.checked = false; form.elements.breakBefore.checked = true;
    await editProject(bus,designOperations(bus.project,formDesign(bus.project,added.selected,form,'additional-table')),'apply source table');
    const saved = readProject(saveProject(bus.project));
    expect(saved.sampleData).toEqual(initial.sampleData); expect(saved.manifest.studioV3.additionalTables[0]).toMatchObject({label:'Supplied operations',repeatHeader:false,breakBefore:true});
    expect(saved.templateHtml).toContain(`data-pf-table-id="${added.selected}"`);
    await bus.navigateHistory('undo',bus.revision); expect(bus.project.manifest.studioV3.additionalTables[0].repeatHeader).toBe(true);
    await bus.navigateHistory('undo',bus.revision); expect(bus.project.manifest.studioV3.additionalTables).toBeUndefined();
    await bus.navigateHistory('redo',bus.revision); expect(bus.project.manifest.studioV3.additionalTables).toHaveLength(1);
    const removed = alterTables(bus.project,added.selected,'remove-table');
    expect(removed.design.columns).toEqual(designOf(initial).columns); expect(removed.design.additionalTables).toEqual([]);
    expect(()=>alterTables(initial,'items','remove-table')).toThrow('primary');
  });
  it('adds and removes columns on the selected extra table, never the protected primary',()=> {
    const {project,id} = withTable(), primary = designOf(project).columns;
    const added = alterFields(project,id,'add-field');
    expect(added.design.columns).toEqual(primary); expect(added.design.additionalTables[0].columns).toHaveLength(4);
    const changed = compileProject(project,added.design), removed = alterFields(changed,added.selected,'remove-field');
    expect(removed.design.additionalTables[0].columns).toHaveLength(3); expect(removed.selected).toBe(id);
    expect(leftView(project,{mode:'design',selected:id})).toContain('Add independent source table');
  });
  it.each([
    table=>{table.collection='/missing';},table=>{table.collection='/constructor/rows';},
    table=>{table.columns[0].pointer='/operation';},table=>{table.columns[0].width=101;},
    table=>{table.columns[0].id='header';},table=>{table.join='/items';},
    table=>{table.columns[1].id=table.columns[0].id;},table=>{table.id='items';}
  ])('rejects unsafe table shape, scope, layout and identity',mutate=> {
    const {project} = withTable(), design = designOf(project); mutate(design.additionalTables[0]);
    const change = () => { const next=compileProject(project,design); if (!bindingValidation(next).valid) throw new Error('binding invalid'); };
    expect(change).toThrow();
  });
  it('rejects nonarray and heterogeneous row source changes before commit',async()=> {
    const {project} = withTable(), bus = createBus(project), revision=bus.revision;
    for (const operations of [null,[{operation:'Cut',hours:{nested:true},sourceId:'1'}],[{operation:'Cut',hours:'1'}]]) {
      const data=structuredClone(project.sampleData); data.operations=operations;
      await expect(editProject(bus,[{type:'replace_sample_data',value:data}],'bad source')).rejects.toThrow();
      expect(bus.revision).toBe(revision);
    }
  });
  it('keeps additional collections human-only and routes numeric source compatibility through real draft consumers',()=> {
    const {project,id} = withTable(), design=designOf(project); design.additionalTables[0].columns[1].format='number';
    design.additionalTables[0].columns[1].pointer='./suppliedHours';
    project.sampleData.operations.forEach((row,index)=>{row.suppliedHours=index+0.5;});
    const compiled=compileProject(project,design), before=structuredClone(compiled.sampleData), baseline=protectedBindings(design), tampered=designOf(compiled);
    tampered.additionalTables[0].collection='/items'; expect(()=>assertProtectedBindings(baseline,tampered)).toThrow();
    expect(shareAuthoring(compiled).sections.find(section=>section.id===id).collection).toBe('/operations');
    const draft=createDraft(compiled,{request:'Use the supplied ./sourceId path in this column'});
    draft.apply('Choose another existing source',[{type:'set_field',target:`${id}-column-2`,patch:{pointer:'./sourceId'}}]);
    const validation=bindingValidation(draft.project);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(error=>error.code==='NUMBER_REQUIRED' && error.component===`${id}-column-2`)).toBe(true);
    // Core Intl formatting still accepts numeric strings; the V3 typed-data
    // gate rejects using these identifier strings as a supplied numeric field.
    const rendered=bind(draft.project);
    expect(rendered.fragment.querySelector(`[data-v3-id="${id}-column-2"]`).textContent).toBe(new Intl.NumberFormat(compiled.manifest.locale).format('0007'));
    expect(draft.project.sampleData).toEqual(before); expect(compiled.sampleData).toEqual(before);
    const protectedDraft=createDraft(compiled);
    expect(()=>protectedDraft.apply('Invent a numeric value',[{type:'set_field',target:`${id}-column-2`,patch:{kind:'static',pointer:'',text:'invented'}}])).toThrow();
  });
  it('protects an additional collection even when none of its plain-text columns is numeric or financial',()=> {
    const {project,id}=withTable(), design=designOf(project), baseline=protectedBindings(design);
    const relabeled=structuredClone(design); relabeled.additionalTables[0].columns[0].label='Supplied operation';
    expect(()=>assertProtectedBindings(baseline,relabeled)).not.toThrow();
    relabeled.additionalTables[0].collection='/items';
    expect(()=>assertProtectedBindings(baseline,relabeled)).toThrow();
    expect(project.manifest.studioV3.additionalTables[0].id).toBe(id);
  });
  it.each(['table','header'])('allows only the referenced additional %s descendants in chat and private drafts',selection=> {
    const {project,id}=withTable(), scope={mode:'selected',id:selection==='header' ? `${id}-header` : id};
    const target=`label-${id}-column-1`, operations=[{type:'set_field',target,patch:{label:'Supplied operation reference'}}];
    const reply=parseChatReply(JSON.stringify({kind:'proposal',summary:'Relabel the selected source column',operations}),project,{scope,request:'Change the selected label'});
    expect(reply.candidate.manifest.studioV3.additionalTables[0].columns[0].label).toBe('Supplied operation reference');
    expect(reply.candidate.sampleData).toEqual(project.sampleData);
    const draft=createDraft(project,{scope}); draft.apply('Relabel source column',operations);
    expect(draft.project.manifest.studioV3.additionalTables[0].columns[0].label).toBe('Supplied operation reference');
    expect(project.manifest.studioV3.additionalTables[0].columns[0].label).not.toBe('Supplied operation reference');
    expect(draft.project.sampleData).toEqual(project.sampleData);
    const outside=[{type:'set_field',target:`label-items-${designOf(project).columns[0].id}`,patch:{label:'Outside selection'}}];
    expect(()=>parseChatReply(JSON.stringify({kind:'proposal',summary:'Wrong table',operations:outside}),project,{scope,request:'Change label'})).toThrow();
    expect(()=>draft.apply('Wrong table',outside)).toThrow();
    if(selection==='header') {
      const values=[{type:'set_field',target:`${id}-column-1`,patch:{valueStyle:{bold:true}}}];
      expect(()=>parseChatReply(JSON.stringify({kind:'proposal',summary:'Body change',operations:values}),project,{scope,request:'Change value typography'})).toThrow();
      expect(()=>draft.apply('Body change',values)).toThrow();
      const targets=scopeAuthoringTargets(project,scope)[0].allowedLabelTargets;
      const exactReply=parseChatReply(JSON.stringify({kind:'proposal',summary:'Use advertised target',operations:[{type:'set_field',target:targets[0],patch:{label:'Header-only label'}}]}),project,{scope,request:'Change selected header label'});
      expect(exactReply.candidate.manifest.studioV3.additionalTables[0].columns[0].label).toBe('Header-only label');
      expect(exactReply.candidate.manifest.studioV3.columns).toEqual(designOf(project).columns);
    }
  });
  it('keeps enabled additional tables when primary is hidden and reports missing source explicitly',()=> {
    const {project,id} = withTable(), design=designOf(project); design.blocks.items.enabled=false;
    const compiled=compileProject(project,design); expect(bind(compiled).report.tableRowsByTable).toEqual({[id]:2});
    delete compiled.sampleData.operations;
    expect(bindingValidation(compiled).errors.some(error=>error.code==='COLLECTION_NOT_ARRAY' && error.component===id)).toBe(true);
  });
});
