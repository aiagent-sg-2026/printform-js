// Executes every registered tool/operation example through the real agent tool handlers (COV-04).
// A broken example, an undeclared error code or a result outside its outputSchema fails the build.
import { JSDOM } from 'jsdom';
import { validateToolArguments } from '@earendil-works/pi-ai';
import { AGENT_TOOL_DEFINITIONS, OPERATION_CAPABILITIES } from '../studio-v3/agent-registry.js';
import { createAgentTools } from '../studio-v3/agent-tools.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { createGrant } from '../studio-v3/agent-effects.js';
import { chatRequest } from '../studio-v3/ai-chat-protocol.js';
import { newProject } from '../studio-v3/demo-templates.js';
import { DEMO_CONFIG } from '../studio-v3/ai-gateway-config.js';
import { authorizeObservation } from '../studio-v3/observation-policy.js';
import { staticProject, unitImage } from '../tests/support/pixel-observation.js';

// The print validators parse HTML templates with DOMParser. Node has none, so borrow jsdom's, as the site build does.
globalThis.DOMParser ??= new JSDOM('').window.DOMParser;
const FIXTURES = Object.freeze({
  invoice:() => newProject('invoice'),
  static:staticProject,
  // Invoice rows carry financial bindings that keep their collection; a delivery note has none.
  'second-collection':() => { const project = newProject('delivery'); project.sampleData.lines = structuredClone(project.sampleData.items); return project; }
});
const INSPECTIONS = {ready:{report:{status:'ready'}},blocked:{report:{status:'blocked',issues:[{code:'OVERFLOW'}]}},stale:{report:{status:'ready'}}};

async function harness({request = 'Change the form',fixture = 'invoice',inspection = 'ready',grant = 'design',authorization} = {}) {
  if (!FIXTURES[fixture] || !INSPECTIONS[inspection]) throw new Error(`Unknown conformance fixture: ${fixture}/${inspection}.`);
  const project = FIXTURES[fixture](), draft = createDraft(project,{request});
  const context = (current,info) => chatRequest(current,{request,scope:{mode:'whole'},typography:[],conversation:[]},{mode:'steps',...info});
  const runId = 'conformance', readObservationHost = ()=>({project,baseRevision:0,dataPolicy:null,selectedTargets:['items']});
  const observationAuthorization = ['text','pixels'].includes(authorization) ? await authorizeObservation({...readObservationHost(),runId},{text:true,pixels:authorization==='pixels'}) : undefined;
  const tools = createAgentTools({draft,context,inspect:async () => {
    if (inspection === 'stale') draft.apply('Concurrent edit',[{type:'set_style',patch:{color:'#a82938'}}]);
    return INSPECTIONS[inspection];
  },signal:new AbortController().signal,outcome:{},
    limits:{...DEMO_CONFIG.agent,maxRepeatedFailures:1000},identity:{release:'development',verified:false},grant:createGrant(grant),runId,observationAuthorization,readObservationHost,capturePixels:async(_candidate,region)=>unitImage(region)});
  return Object.fromEntries(tools.map(tool => [tool.name,tool]));
}
async function call(tool,args) {
  tool.prepareArguments(args);
  return tool.execute('conformance',args);
}
function parseResult(result) {
  const value = result.content[0].text;
  try { return JSON.parse(value); } catch { return value; }
}
const conforms = (schema,value) => {
  try { return JSON.stringify(validateToolArguments({name:'output',parameters:schema},{name:'output',id:'output',arguments:value})) === JSON.stringify(value); } catch { return false; }
};

async function runExample(definition,example,{tool,args,output}) {
  const tools = await harness(example);
  let latest;
  for (const [name,setupArgs] of example.setup || []) { const result=parseResult(await call(tools[name],setupArgs)); if (result.observation) latest=result.observation.id; }
  if (example.latestObservation) args={...args,observationId:latest};
  try {
    const result = await call(tools[tool],args);
    if (example.error) return `${definition.id}: expected ${example.error} but the call succeeded`;
    if (!conforms(output,parseResult(result))) return `${definition.id}: result does not match the ${tool} outputSchema`;
  } catch (error) {
    if (!example.error) return `${definition.id}: example failed with ${error.code || error.message}`;
    if (error.code !== example.error) return `${definition.id}: expected ${example.error} but got ${error.code}`;
    if (!definition.errors.includes(error.code)) return `${definition.id}: raised undeclared error ${error.code}`;
  }
  return null;
}

export async function checkAgentConformance({tools = AGENT_TOOL_DEFINITIONS,operations = OPERATION_CAPABILITIES} = {}) {
  const failures = [], applyOutput = AGENT_TOOL_DEFINITIONS.find(entry => entry.name === 'apply_operations').outputSchema;
  for (const definition of tools) for (const example of [...definition.examples,...definition.invalid]) {
    failures.push(await runExample(definition,example,{tool:definition.name,args:example.args,output:definition.outputSchema}));
  }
  for (const definition of operations) for (const example of [...definition.examples,...definition.invalid]) {
    const args = {summary:`Example ${definition.name}`,operations:[example.operation]};
    failures.push(await runExample(definition,example,{tool:'apply_operations',args,output:applyOutput}));
  }
  const errors = failures.filter(Boolean);
  if (errors.length) throw Object.assign(new Error(`Agent contract conformance failed:\n${errors.join('\n')}`),{failures:errors});
  return {tools:tools.length,operations:operations.length,examples:[...tools,...operations].reduce((n,d) => n + d.examples.length + d.invalid.length,0)};
}
