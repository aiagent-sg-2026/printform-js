import {describe,it,expect} from 'vitest';
import {createModels,fauxProvider,fauxAssistantMessage,fauxToolCall} from '@earendil-works/pi-ai';
import {newProject,designOf} from '../studio-v3/model.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {createAgentTools} from '../studio-v3/agent-tools.js';
import {createGrant} from '../studio-v3/agent-effects.js';
import {runAgentLoop} from '../studio-v3/agent-loop.js';

const PRIVATE = 'PRIVATE_ARGUMENT_MARKER_8b4e';
const UNKNOWN = 'PRIVATE_UNKNOWN_KEY_03f1/~';
const call = (name,args = {}) => fauxAssistantMessage([fauxToolCall(name,args,{id:`repair-${name}`})],{stopReason:'toolUse'});
const hints = text => JSON.parse(text.slice(text.indexOf('[{')));
const rejection = work => { try { work(); } catch (error) { return error; } throw new Error('Expected rejection'); };
function boundary(options = {}) {
  const project = newProject(), draft = createDraft(project), outcome = {}, steps = [];
  const controller = new AbortController(); let stops = 0;
  const tools = Object.fromEntries(createAgentTools({draft,outcome,signal:controller.signal,context:()=> '{}',
    limits:{maxTurns:50,maxRepeatedFailures:3},onStep:step=>steps.push(step),stopRun:()=>stops++,...options}).map(tool=>[tool.name,tool]));
  return {project,draft,outcome,tools,steps,controller,get stops() { return stops; }};
}
const invoke = (state,name,input = {}) => state.tools[name].execute(`arguments-${name}`,state.tools[name].prepareArguments(input));
const args = operations => ({summary:PRIVATE,operations});

// Assertions concern the model-visible rejection and the actual candidate, never SDK exception wording.
describe('safe schema-derived argument repair',()=> {
  it('lets the Pi consumer repair a malformed union member and finish the complete intended candidate',async()=> {
    const faux = fauxProvider({provider:'argument-repair-faux',models:[{id:'argument-repair-faux'}]});
    const operations = [{type:'set_heading',value:PRIVATE},
      {type:'set_element_style',target:'header-title',patch:{fontSize:PRIVATE}},
      {type:'set_section',target:'header',patch:{enabled:true}}];
    let repair;
    faux.setResponses([call('apply_operations',args(operations)),context=> {
      const result = context.messages.at(-1), text = result.content[0].text;
      expect(result.isError).toBe(true); expect(text).toContain('AGENT_ARGUMENTS_INVALID');
      expect(text).not.toContain(PRIVATE);
      repair = hints(text).find(hint=>hint.path === 'arguments.operations[1].patch.fontSize');
      expect(repair).toMatchObject({operation:'set_element_style',expected:{type:'number',minimum:6,maximum:72}});
      // The safe location and bounds identify the exact property to fix, without losing the other requested work.
      const fixed = structuredClone(operations); fixed[1].patch.fontSize = 18;
      return call('apply_operations',args(fixed));
    },call('inspect_draft'),call('finish',{summary:'Heading repaired'})]);
    const models = createModels(); models.setProvider(faux.provider);
    const project = newProject(), original = structuredClone(project);
    const result = await runAgentLoop({models,model:faux.getModel(),project,request:'Set the heading and its type size.',
      context:()=> '{}',inspect:async()=>({report:{status:'ready'}}),signal:new AbortController().signal});
    expect(result.kind).toBe('proposal'); expect(result.steps).toBe(1);
    expect(result.design.title).toBe(PRIVATE); expect(result.design.titleStyle.fontSize).toBe(18);
    expect(result.design.blocks.header.enabled).toBe(true);
    expect(project).toEqual(original);
    expect(result.candidate.sampleData).toEqual(original.sampleData);
    expect(result.candidate.manifest.documentId).toBe(original.manifest.documentId);
    expect(result.candidate.schema).toEqual(original.schema);
  });

  it.each([
    ['number',{type:'set_style',patch:{font:'10'}},'arguments.operations[0].patch.font','number',10],
    ['boolean',{type:'set_style',patch:{striped:'false'}},'arguments.operations[0].patch.striped','boolean',false],
    ['optional null',{type:'set_style',patch:{font:null}},'arguments.operations[0].patch.font','number',10],
    ['integer',{type:'set_section',target:'customer',patch:{layout:{columns:'2'}}},'arguments.operations[0].patch.layout.columns','integer',2]
  ])('rejects raw %s coercion atomically, then applies the explicitly repaired value',async(_kind,operation,path,type,value)=> {
    const state = boundary(), before = structuredClone(state.project), input = args([{type:'set_heading',value:PRIVATE},operation]);
    const error = rejection(()=>state.tools.apply_operations.prepareArguments(input));
    expect(error.code).toBe('AGENT_ARGUMENTS_INVALID');
    const location = path.replace('[0]','[1]');
    expect(hints(error.message)).toEqual(expect.arrayContaining([expect.objectContaining({path:location,expected:expect.objectContaining({type})})]));
    expect(error.message).not.toContain(PRIVATE); expect(state.draft.count).toBe(0); expect(state.draft.version).toBe(0);
    expect(state.draft.project).toEqual(before); expect(input.operations[1]).toEqual(operation);
    const fixed = structuredClone(input), patch = fixed.operations[1].patch;
    if (patch.layout) patch.layout.columns = value;
    else patch[Object.keys(patch)[0]] = value;
    const prepared = state.tools.apply_operations.prepareArguments(fixed);
    await state.tools.apply_operations.execute('repaired',prepared);
    expect(state.draft.count).toBe(1); expect(state.draft.version).toBe(1);
    const design = designOf(state.draft.project);
    expect(design.title).toBe(PRIVATE);
    expect(patch.layout ? design.blocks.customer.layout.columns : design[Object.keys(patch)[0]]).toBe(value);
    expect(state.project).toEqual(before); expect(state.draft.project.sampleData).toEqual(before.sampleData);
  });

  it('locates a missing required member and schema bounds rather than forwarding received text',()=> {
    const {tools,draft} = boundary();
    const error = rejection(()=>tools.apply_operations.prepareArguments(args([
      {type:'set_heading'},
      {type:'set_section',target:'customer',patch:{layout:{columns:5}}},
      {type:'set_style',patch:{color:PRIVATE}}
    ])));
    expect(hints(error.message)).toEqual(expect.arrayContaining([
      expect.objectContaining({path:'arguments.operations[0].value',expected:{type:'string',maxLength:100}}),
      expect.objectContaining({path:'arguments.operations[1].patch.layout.columns',expected:{type:'integer',minimum:1,maximum:4}}),
      expect.objectContaining({path:'arguments.operations[2].patch.color',expected:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}})
    ]));
    expect(error.message).not.toContain(PRIVATE); expect(draft.count).toBe(0);
  });

  it.each(['root','operation','patch','nested-style','unknown-type'])('never reflects private values or unknown %s names',place=> {
    const {tools,draft} = boundary();
    const operation = {type:'add_field',section:'footer',field:{id:'private-note',label:PRIVATE,kind:'static',text:PRIVATE,pointer:PRIVATE}};
    const input = args([operation]), secret = {[UNKNOWN]:{label:PRIVATE}};
    if (place === 'root') input[UNKNOWN] = secret;
    if (place === 'operation') operation[UNKNOWN] = secret;
    if (place === 'patch') operation.field[UNKNOWN] = secret;
    if (place === 'nested-style') operation.field.labelStyle = {[UNKNOWN]:PRIVATE,fontSize:PRIVATE};
    if (place === 'unknown-type') operation.type = UNKNOWN;
    const error = rejection(()=>tools.apply_operations.prepareArguments(input));
    expect(error.code).toBe('AGENT_ARGUMENTS_INVALID');
    expect(error.message).not.toContain(PRIVATE); expect(error.message).not.toContain(UNKNOWN);
    expect(error.message).not.toContain('Received arguments');
    const repair = hints(error.message);
    expect(draft.count).toBe(0);
    if (place === 'unknown-type') {
      expect(repair[0]).toMatchObject({path:'arguments.operations[0].type',expected:{enum:expect.arrayContaining(['set_heading','add_field'])}});
    }
  });

  it('rejects extra input instead of silently dropping it to manufacture a valid draft',async()=> {
    const {tools,draft,project} = boundary(), before = structuredClone(project);
    const input = args([{type:'set_heading',value:PRIVATE,[UNKNOWN]:PRIVATE}]);
    const error = rejection(()=>tools.apply_operations.prepareArguments(input));
    const repair = hints(error.message).find(hint=>hint.path === 'arguments.operations[0]');
    expect(repair.expected.allowedProperties).toEqual(['type','value']);
    expect(input.operations[0][UNKNOWN]).toBe(PRIVATE); expect(draft.count).toBe(0);
    delete input.operations[0][UNKNOWN];
    await tools.apply_operations.execute('explicitly-repaired',tools.apply_operations.prepareArguments(input));
    expect(draft.count).toBe(1); expect(designOf(draft.project).title).toBe(PRIVATE); expect(project).toEqual(before);
  });

  it('bounds hints for oversized arrays and keeps all rejected operations unapplied',()=> {
    const {tools,draft} = boundary();
    const input = args(Array.from({length:200},()=>({type:'set_style',patch:{font:PRIVATE,[UNKNOWN]:PRIVATE}})));
    const error = rejection(()=>tools.apply_operations.prepareArguments(input));
    expect(error.code).toBe('AGENT_ARGUMENTS_INVALID');
    expect(hints(error.message)).toEqual(expect.arrayContaining([
      expect.objectContaining({path:'arguments.operations',expected:expect.objectContaining({type:'array',minItems:1,maxItems:24})})
    ]));
    expect(error.message).not.toContain(PRIVATE); expect(error.message).not.toContain(UNKNOWN); expect(draft.count).toBe(0);
  });

  it('does not weaken effect grants, repeat limits, successful-call reset, or abort',async()=> {
    const denied = boundary({grant:createGrant('read-only')});
    const input = args([{type:'set_style',patch:{font:PRIVATE}}]);
    expect(rejection(()=>denied.tools.apply_operations.prepareArguments(input)).code).toBe('GRANT_DENIED');
    expect(denied.draft.count).toBe(0);
    const state = boundary(), tool = state.tools.apply_operations;
    for (let index = 0; index < 2; index++) expect(rejection(()=>tool.prepareArguments(input)).code).toBe('AGENT_ARGUMENTS_INVALID');
    const fixed = args([{type:'set_heading',value:PRIVATE}]);
    await tool.execute('valid',tool.prepareArguments(fixed));
    for (let index = 0; index < 2; index++) expect(rejection(()=>tool.prepareArguments(input)).code).toBe('AGENT_ARGUMENTS_INVALID');
    expect(rejection(()=>tool.prepareArguments(input)).code).toBe('AGENT_STALLED');
    expect(state.outcome.blocked).toEqual({code:'AGENT_STALLED'}); expect(state.stops).toBe(1); expect(state.draft.count).toBe(1);
    const stopped = boundary(); stopped.controller.abort();
    expect(rejection(()=>stopped.tools.apply_operations.prepareArguments(input)).name).toBe('AbortError');
    expect(stopped.steps).toEqual([]); expect(stopped.draft.count).toBe(0);
  });
});

describe('nullable finish_answer evidence at the real tool boundary',()=> {
  it.each([
    ['guide','null','read_skill',{id:'form-authoring'},{observationId:null}],
    ['context','null','get_context',{}, {observationId:null}],
    ['guide','omitted','read_skill',{id:'form-authoring'},{}],
    ['context','omitted','get_context',{},{}]
  ])('accepts a %s-grounded answer with %s observationId without inventing a receipt',async(_evidence,_id,name,input,optional)=> {
    const state = boundary({grant:createGrant('read-only')}), before = structuredClone(state.project);
    await invoke(state,name,input);
    const message = '{"toolsAvailable":true}', arguments_ = {message,...optional};
    const result = await invoke(state,'finish_answer',arguments_);
    expect(result.terminate).toBe(true);
    expect(state.outcome.answer).toEqual({message,identity:undefined});
    expect(arguments_).toEqual({message,...optional});
    expect(state.outcome.proposal).toBeUndefined(); expect(state.outcome.blocked).toBeUndefined();
    expect(state.draft.count).toBe(0); expect(state.draft.project).toEqual(before); expect(state.project).toEqual(before);
  });

  it('resolves null to the actual current observation without charging the receipt against the answer allowance',async()=> {
    const state = boundary({grant:createGrant('read-only'),inspect:async()=>({report:{status:'ready'}})});
    const inspected = await invoke(state,'inspect_draft'), receipt = JSON.parse(inspected.content[0].text).observation;
    const message = 'x'.repeat(4000);
    expect((await invoke(state,'finish_answer',{message,observationId:null})).terminate).toBe(true);
    expect(state.outcome.answer).toEqual({message,identity:undefined,observation:receipt});
    expect(state.draft.count).toBe(0); expect(state.outcome.proposal).toBeUndefined();
  });

  it('rejects an invented nonnull ID instead of treating it as null',async()=> {
    const observationId = 'latest', state = boundary({grant:createGrant('read-only')});
    await invoke(state,'get_context');
    await expect(invoke(state,'finish_answer',{message:'Grounded answer.',observationId})).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    expect(state.outcome.answer).toBeUndefined(); expect(state.draft.count).toBe(0);
  });

  it('rejects an actual but superseded ID, then accepts the current ID',async()=> {
    const state = boundary({grant:createGrant('read-only'),inspect:async()=>({report:{status:'ready'}})});
    const first = JSON.parse((await invoke(state,'inspect_draft')).content[0].text).observation;
    const latest = JSON.parse((await invoke(state,'inspect_draft')).content[0].text).observation;
    await expect(invoke(state,'finish_answer',{message:'Old inspection.',observationId:first.id})).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    expect(state.outcome.answer).toBeUndefined();
    await invoke(state,'finish_answer',{message:'Current inspection.',observationId:latest.id});
    expect(state.outcome.answer.observation).toEqual(latest);
  });

  it('does not let null bypass required evidence or revive an invalidated observation',async()=> {
    const empty = boundary({grant:createGrant('read-only')});
    await expect(invoke(empty,'finish_answer',{message:'Ungrounded.',observationId:null})).rejects.toMatchObject({code:'AGENT_EVIDENCE_REQUIRED'});
    expect(empty.outcome.answer).toBeUndefined();
    const state = boundary({inspect:async()=>({report:{status:'ready'}})});
    await invoke(state,'inspect_draft');
    await invoke(state,'apply_operations',{summary:'Change heading',operations:[{type:'set_heading',value:'Updated heading'}]});
    await expect(invoke(state,'finish_answer',{message:'Stale inspection.',observationId:null})).rejects.toMatchObject({code:'EVIDENCE_STALE'});
    expect(state.outcome.answer).toBeUndefined(); expect(state.draft.count).toBe(1);
  });
});
