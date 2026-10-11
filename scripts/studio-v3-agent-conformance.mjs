// Executes every registered tool/operation example through the real agent tool handlers (COV-04).
// A broken example, an undeclared error code or a result outside its outputSchema fails the build.
import { validateToolArguments } from '@earendil-works/pi-ai';
import { AGENT_TOOL_DEFINITIONS, OPERATION_CAPABILITIES } from '../studio-v3/agent-registry.js';
import { createAgentTools } from '../studio-v3/agent-tools.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { createGrant } from '../studio-v3/agent-effects.js';
import { chatRequest } from '../studio-v3/ai-chat-protocol.js';
import { newProject } from '../studio-v3/demo-templates.js';
import { DEMO_CONFIG } from '../studio-v3/ai-gateway-config.js';

const FIXTURES = Object.freeze({
  blank:() => newProject(),
  // Invoice rows carry financial bindings that keep their collection; a delivery note has none.
  'second-collection':() => { const project = newProject('delivery'); project.sampleData.lines = structuredClone(project.sampleData.items); return project; }
});
const INSPECTIONS = {ready:{report:{status:'ready'}},blocked:{report:{status:'blocked',issues:[{code:'OVERFLOW'}]}}};

function harness({request = 'Change the form',fixture = 'blank',inspection = 'ready',grant = 'design'} = {}) {
  if (!FIXTURES[fixture] || !INSPECTIONS[inspection]) throw new Error(`Unknown conformance fixture: ${fixture}/${inspection}.`);
  const project = FIXTURES[fixture](), draft = createDraft(project,{request});
  const context = (current,info) => chatRequest(current,{request,scope:{mode:'whole'},typography:[],conversation:[]},{mode:'steps',...info});
  const tools = createAgentTools({draft,context,inspect:async () => INSPECTIONS[inspection],signal:new AbortController().signal,outcome:{},
    limits:{...DEMO_CONFIG.agent,maxRepeatedFailures:1000},identity:{release:'development',verified:false},grant:createGrant(grant)});
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
  const tools = harness(example);
  for (const [name,setupArgs] of example.setup || []) await call(tools[name],setupArgs);
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
