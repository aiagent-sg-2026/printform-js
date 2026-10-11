import {describe,it,expect} from 'vitest';
import {SCENARIOS,SCENARIO_IDS,scenarioCandidate,runScenarioMatrix,canonicalScenario} from '../studio-v3/scenario-matrix.js';
import {createValidateAll} from '../studio-v3/validate-all.js';
import {createAgentTools} from '../studio-v3/agent-tools.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {createGrant,grantedDefinitions} from '../studio-v3/agent-effects.js';
import {AGENT_TOOL_DEFINITIONS} from '../studio-v3/agent-registry.js';
import {SAMPLES} from '../studio-v3/views.js';
import {newProject} from '../studio-v3/demo-templates.js';
import {DEMO_CONFIG} from '../studio-v3/ai-gateway-config.js';

const rowsOf = candidate => candidate.sampleData.items.length;
// A deterministic stand-in for the print renderer: pages follow rows, and the stress scenario is blocked.
const report = candidate => {
  const rows = rowsOf(candidate), metrics = {rows,logicalPages:Math.max(1,Math.ceil(rows / 45))};
  return rows >= 500 ? {status:'blocked',metrics,issues:Array.from({length:30},(_,i)=>({code:'ROW_TOO_TALL',pageIndex:i,measured_size:{width:100,height:900},available_size:{width:100,height:800}}))} : {status:'ready',metrics};
};
const render = async candidate => report(candidate);

describe('Studio v3 scenario matrix service', () => {
  it('has one scenario list that the Validate panel and the agent tool both derive from', () => {
    expect(SCENARIO_IDS).toEqual(['0','1','45','100','500','long']);
    expect(SAMPLES.map(([id]) => id)).toEqual(['erp',...SCENARIO_IDS]);
    expect(AGENT_TOOL_DEFINITIONS.find(tool => tool.name === 'validate_scenarios').parameters.properties.scenarios.items.anyOf.map(item => item.const)).toEqual(SCENARIO_IDS);
    expect(Object.isFrozen(SCENARIOS) && SCENARIOS.every(Object.isFrozen)).toBe(true);
  });
  it('builds synthetic candidates of the form type without touching the original project', () => {
    const project = newProject('delivery'), before = JSON.stringify(project);
    expect(rowsOf(scenarioCandidate(project,'0'))).toBe(0); expect(rowsOf(scenarioCandidate(project,'500'))).toBe(500);
    expect(scenarioCandidate(project,'long').sampleData.document.number).toMatch(/^DN-/);
    expect(JSON.stringify(scenarioCandidate(project,'long').sampleData)).not.toBe(JSON.stringify(scenarioCandidate(project,'45').sampleData));
    expect(JSON.stringify(project)).toBe(before);
  });
  it('runs the chosen scenarios in order, reports each as it ends, and rejects bad input with coded errors', async () => {
    const seen = [], result = await runScenarioMatrix({project:newProject(),ids:['100','0'],render,onScenario:scenario => seen.push(scenario.id)});
    expect(seen).toEqual(['100','0']); expect(result.scenarios.map(scenario => scenario.id)).toEqual(['100','0']); expect(result.ready).toBe(true);
    expect((await runScenarioMatrix({project:newProject(),render})).scenarios.map(scenario => scenario.id)).toEqual(SCENARIO_IDS);
    for (const [ids,code] of [[['999'],'SCENARIO_UNKNOWN'],[['0','0'],'SCENARIO_UNKNOWN'],[[],'SCENARIO_LIMIT'],[[...SCENARIO_IDS,'0'],'SCENARIO_LIMIT'],['0','SCENARIO_LIMIT'],[null,'SCENARIO_LIMIT']])
      await expect(runScenarioMatrix({project:newProject(),ids,render}), JSON.stringify(ids)).rejects.toMatchObject({code});
  });
  it('stops before the next scenario when aborted', async () => {
    const controller = new AbortController(), rendered = [];
    const run = runScenarioMatrix({project:newProject(),signal:controller.signal,render:async candidate => { rendered.push(rowsOf(candidate)); controller.abort(); return report(candidate); }});
    await expect(run).rejects.toMatchObject({name:'AbortError'}); expect(rendered).toEqual([0]);
  });
  it('keeps the full quality for the panel and a bounded canonical view for the agent', async () => {
    const result = await runScenarioMatrix({project:newProject(),ids:['500'],render}), [scenario] = result.scenarios;
    expect(result.ready).toBe(false); expect(scenario.quality.ready).toBe(false); expect(scenario.diagnostics.pages).toEqual([]);
    const canonical = canonicalScenario(scenario);
    expect(Object.keys(canonical).sort()).toEqual(['errors','id','issues','label','metrics','ready']); expect(canonical.issues.length).toBeLessThanOrEqual(20);
  });
});

describe('Studio v3 UI and Pi parity for the scenario matrix (COV-03)', () => {
  const identity = {release:'development'};
  function piTools(project,{grant = createGrant('design'),inspectOutcome = render} = {}) {
    const draft = createDraft(project), outcome = {};
    const tools = Object.fromEntries(createAgentTools({draft,context:() => '{}',inspect:async ({candidate}) => ({report:await inspectOutcome(candidate)}),signal:new AbortController().signal,outcome,
      limits:{...DEMO_CONFIG.agent,maxRepeatedFailures:1000},identity,grant}).map(tool => [tool.name,tool]));
    return {tools,outcome,draft};
  }
  const call = async (tool,args = {}) => { tool.prepareArguments(args); const text = (await tool.execute('call',args)).content[0].text; try { return JSON.parse(text); } catch { return text; } };
  function uiRun(project,{render:paint = render} = {}) {
    const state = {running:false,runId:0,matrix:{}}, events = [], bus = {project};
    const validateAll = createValidateAll({state,project:() => bus.project,render:async candidate => paint(candidate ?? bus.project),stopRun:() => { state.runId += 1; state.running = false; events.push('stop'); },
      cancelPaper:() => events.push('cancel'),invalidateAI:() => events.push('invalidate'),renderPanels:() => events.push(`panels:${Object.keys(state.matrix).length}`),syncControls:() => {}});
    return {state,events,validateAll};
  }

  it('gives the Validate panel and the agent tool equivalent diagnostics for the same project and renderer', async () => {
    const project = newProject('purchase'), {state,validateAll} = uiRun(project), {tools} = piTools(project);
    await validateAll(); const output = await call(tools.validate_scenarios);
    expect(output.scenarios.map(scenario => scenario.id)).toEqual(Object.keys(state.matrix));
    for (const scenario of output.scenarios) {
      const ui = state.matrix[scenario.id];
      expect({ready:ui.ready,metrics:ui.metrics,errors:[...new Set(ui.errors.map(error => error.code))]}, scenario.id)
        .toEqual({ready:scenario.ready,metrics:scenario.metrics,errors:scenario.errors});
    }
    expect(output.ready).toBe(false); expect(output.scenarios.find(scenario => scenario.id === '500')).toMatchObject({ready:false,metrics:{rows:500}});
    expect(output.scenarios.find(scenario => scenario.id === '100')).toMatchObject({ready:true,metrics:{rows:100,logicalPages:3}});
  });
  it('validates the draft the agent is editing, and a named subset, through the same service', async () => {
    const project = newProject(), {tools,draft} = piTools(project);
    await call(tools.apply_operations,{summary:'Footer',operations:[{type:'set_section',target:'footer',patch:{label:'Terms'}}]});
    const seen = []; const {tools:watched} = piTools(draft.project,{inspectOutcome:async candidate => { seen.push(candidate.manifest.studioV3.blocks.footer.label); return report(candidate); }});
    const output = await call(watched.validate_scenarios,{scenarios:['1','45']});
    expect(output.scenarios.map(scenario => scenario.id)).toEqual(['1','45']); expect(seen).toEqual(['Terms','Terms']);
  });
  it('is not an inspection of the exact draft, but it is evidence for an answer', async () => {
    const edit = piTools(newProject());
    await call(edit.tools.apply_operations,{summary:'Footer',operations:[{type:'set_section',target:'footer',patch:{label:'Terms'}}]});
    await call(edit.tools.validate_scenarios);
    await expect(edit.tools.finish.execute('call',{summary:'Footer'})).rejects.toMatchObject({code:'AGENT_INSPECTION_REQUIRED'});
    const readOnly = piTools(newProject(),{grant:createGrant('read-only')});
    expect(grantedDefinitions(createGrant('read-only'),AGENT_TOOL_DEFINITIONS).map(tool => tool.name)).toContain('validate_scenarios');
    await expect(readOnly.tools.finish_answer.execute('call',{message:'Not yet.'})).rejects.toMatchObject({code:'AGENT_EVIDENCE_REQUIRED'});
    await call(readOnly.tools.validate_scenarios,{scenarios:['0']});
    expect((await readOnly.tools.finish_answer.execute('call',{message:'The empty scenario passes.'})).terminate).toBe(true);
    expect(readOnly.outcome.answer.message).toBe('The empty scenario passes.'); expect(readOnly.draft.count).toBe(0);
  });
  it('rejects an unknown, empty or repeated scenario at the tool boundary, and stays bounded in the worst case', async () => {
    const {tools} = piTools(newProject());
    for (const args of [{scenarios:['999']},{scenarios:[]},{scenarios:['0','0']},{scenarios:'0'},{all:true}]) expect(() => tools.validate_scenarios.prepareArguments(args), JSON.stringify(args)).toThrow(/^AGENT_ARGUMENTS_INVALID\./);
    const worst = await call(tools.validate_scenarios,{scenarios:SCENARIO_IDS,});
    expect(JSON.stringify(worst).length).toBeLessThan(16000);
    expect(worst.scenarios.every(scenario => !('pages' in scenario))).toBe(true);
  });

  it('keeps the Validate panel behavior: progress per scenario, a final restore, stop on a second click, and no late results', async () => {
    const project = newProject(), done = uiRun(project);
    await done.validateAll();
    expect(done.state.running).toBe(false); expect(done.events[0]).toBe('invalidate'); expect(done.events.filter(event => event.startsWith('panels:'))).toContain('panels:6'); expect(Object.keys(done.state.matrix)).toEqual(SCENARIO_IDS);
    // A second click while it runs stops it and restores the committed paper.
    const gates = []; const stopped = uiRun(project,{render:candidate => new Promise(resolve => gates.push(() => resolve(report(candidate))))});
    const first = stopped.validateAll(); await Promise.resolve(); expect(stopped.state.running).toBe(true);
    const second = stopped.validateAll(); await Promise.resolve();
    expect(stopped.events).toEqual(expect.arrayContaining(['stop','cancel'])); expect(stopped.state.running).toBe(false);
    gates.splice(0).forEach(open => open()); await Promise.all([first,second]);
    expect(stopped.state.matrix).toEqual({}); // the result that arrived after the stop was dropped
  });
  it('lets a render failure surface to the caller without recording a result', async () => {
    const failing = uiRun(newProject(),{render:async () => { throw new Error('render failed'); }});
    await expect(failing.validateAll()).rejects.toThrow('render failed'); expect(failing.state.matrix).toEqual({});
  });
});
