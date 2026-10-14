import { designOf, sampleData } from './model.js';
import { demoDataForKind } from './demo-catalog.js';
import { compactA5Record } from './compact-a5-demo.js';
import { createScenario } from '../studio-v2/core/sample-scenarios.js';
import { inspectProject } from './validation.js';
import { safeRunDiagnostics } from './ai-inspection.js';
import { fail } from './ai-edits.js';

// Shared service for "check this form against the built-in row-count scenarios". The Validate panel and the agent's
// validate_scenarios tool both call runScenarioMatrix, so equivalent input gives equivalent diagnostics (COV-03).
// Scenarios use built-in synthetic data of the exact document kind, or the generic family when no kind is declared.
// They never copy a person's ERP data; custom bindings absent from that fixture remain visible missing values.
export const SCENARIOS = Object.freeze([['0','Empty','0 rows'],['1','Single item','1 row'],['45','Standard','45 rows'],['100','Multi-page','100 rows'],['500','Stress','500 rows'],['long','Long & bilingual','45 rows']]
  .map(row=>Object.freeze(row)));
export const SCENARIO_IDS = Object.freeze(SCENARIOS.map(([id])=>id));
export const MAX_SCENARIOS = SCENARIOS.length;

export function scenarioIds(ids = SCENARIO_IDS) {
  if (!Array.isArray(ids) || !ids.length || ids.length > MAX_SCENARIOS) throw fail('SCENARIO_LIMIT');
  if (new Set(ids).size !== ids.length || ids.some(id=>!SCENARIO_IDS.includes(id))) throw fail('SCENARIO_UNKNOWN');
  return ids;
}
export function scenarioCandidate(project, id) {
  scenarioIds([id]);
  const count = id === 'long' ? 45 : Number(id);
  const kind = project.sampleData?.document?.kind || project.studioV3Session?.erpData?.document?.kind;
  if (!kind) return {...project,sampleData:sampleData(designOf(project).type,count,id === 'long')};
  const data = kind === 'CompactA5Invoice' ? compactA5Record().data : demoDataForKind(kind);
  const generated = createScenario(data,count === 1 ? 'one' : count === 0 ? 'empty' : `${count}-rows`);
  return {...project,manifest:{...project.manifest,currency:data.document.currency},sampleData:id === 'long' ? createScenario(generated,'long-text') : generated};
}
// The contract view of one scenario: what the agent receives and what parity is judged on. The page geometry is
// left out to keep the result bounded; the Validate panel keeps the full `quality` next to it.
export const canonicalScenario = ({id,label,diagnostics}) => {
  const {pages,...rest} = diagnostics;
  return {id,label,...rest};
};

// `render(candidate)` shows or measures one candidate and resolves to its print report. `onScenario` receives each
// finished scenario as it ends. Aborting through `signal` stops before the next scenario.
export async function runScenarioMatrix({project,ids,render,signal,onScenario = () => {}}) {
  const chosen = scenarioIds(ids), base = structuredClone(project), scenarios = [];
  for (const id of chosen) {
    signal?.throwIfAborted();
    const candidate = scenarioCandidate(base,id), report = await render(candidate);
    signal?.throwIfAborted();
    const quality = inspectProject(candidate,report), [,label,detail] = SCENARIOS.find(([key])=>key === id);
    const scenario = {id,label,detail,diagnostics:safeRunDiagnostics({report,quality},candidate),quality};
    scenarios.push(scenario); onScenario(scenario);
  }
  return {scenarios,ready:scenarios.every(scenario=>scenario.diagnostics.ready)};
}
