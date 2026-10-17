import {describe,it,expect,vi,afterEach} from 'vitest';
import {Type} from '@earendil-works/pi-ai';
import {AGENT_TOOL_DEFINITIONS,OPERATION_CAPABILITIES,validateRegistry} from '../studio-v3/agent-registry.js';
import {checkAgentConformance} from '../scripts/studio-v3-agent-conformance.mjs';

const tool = name => AGENT_TOOL_DEFINITIONS.find(entry => entry.name === name);
const operation = name => OPERATION_CAPABILITIES.find(entry => entry.name === name);
const failures = async options => (await checkAgentConformance(options).then(() => [],error => error.failures)).join('\n');

describe('Studio v3 agent executable contracts (COV-04)', () => {
  afterEach(() => { vi.doUnmock('../studio-v3/agent-registry.js'); vi.resetModules(); });

  it('fails publication on a broken example', async () => {
    const broken = {...operation('set_field'),examples:[{operation:{type:'set_field',target:'footer-missing',patch:{label:'Terms'}}}]};
    expect(await failures({tools:[],operations:[broken]})).toContain('printform.authoring.set_field: example failed with UNSAFE_PROPOSAL');
  });
  it('fails publication on a result outside the declared output schema', async () => {
    const wrong = {...tool('take_notes'),outputSchema:Type.Number(),invalid:[]};
    expect(await failures({tools:[wrong],operations:[]})).toContain('printform.agent.take_notes: result does not match the take_notes outputSchema');
  });
  it('fails publication on an undeclared or wrong error code', async () => {
    const undeclared = {...operation('set_logo'),errors:['AGENT_ARGUMENTS_INVALID']};
    expect(await failures({tools:[],operations:[undeclared]})).toContain('raised undeclared error LOGO_ASSET_UNAVAILABLE');
    const wrong = {...tool('read_skill'),examples:[],invalid:[{args:{id:'missing'},error:'AGENT_ARGUMENTS_INVALID'}]};
    expect(await failures({tools:[wrong],operations:[]})).toContain('expected AGENT_ARGUMENTS_INVALID but got AGENT_SKILL_UNAVAILABLE');
  });
  it('rejects static contract defects before any handler runs', () => {
    const tools = AGENT_TOOL_DEFINITIONS, invalid = (patch,name = 'read_skill') => () => validateRegistry({tools:tools.map(entry => entry.name === name ? {...entry,...patch} : entry)});
    expect(invalid({contractVersion:'1'})).toThrow('Invalid agent capability contract');
    expect(invalid({outputSchema:undefined})).toThrow('Invalid agent capability contract');
    expect(invalid({errors:['NOT_A_CODE']})).toThrow('Invalid agent capability contract');
    expect(invalid({examples:[{args:{id:5}}]})).toThrow('Invalid agent capability contract');
    // A schema-valid call cannot be declared as an argument rejection, and the reverse.
    expect(invalid({invalid:[{args:{id:'missing'},error:'AGENT_ARGUMENTS_INVALID'}]})).toThrow('Invalid agent capability contract');
    expect(invalid({invalid:[{args:{id:''},error:'AGENT_SKILL_UNAVAILABLE'}]})).toThrow('Invalid agent capability contract');
    expect(invalid({invalid:[]})).toThrow('Invalid agent capability contract');
  });
  it('fails publication when a registered tool has no trusted handler', async () => {
    vi.resetModules();
    vi.doMock('../studio-v3/agent-registry.js',async original => {
      const actual = await original();
      const orphan = {...actual.AGENT_TOOL_DEFINITIONS[0],id:'printform.agent.orphan',name:'orphan'};
      return {...actual,AGENT_TOOL_DEFINITIONS:[...actual.AGENT_TOOL_DEFINITIONS,orphan]};
    });
    const {checkAgentConformance:check} = await import('../scripts/studio-v3-agent-conformance.mjs');
    await expect(check()).rejects.toMatchObject({code:'AGENT_REGISTRY_INVALID'});
  });
});
