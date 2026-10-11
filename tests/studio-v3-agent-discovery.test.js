import {describe,it,expect,vi,afterEach} from 'vitest';
import fs from 'node:fs';
import {Type,createModels,fauxProvider,fauxAssistantMessage,fauxToolCall} from '@earendil-works/pi-ai';
import {AGENT_TOOL_DEFINITIONS,validateRegistry,capabilityCatalog} from '../studio-v3/agent-registry.js';
import {readSkill} from '../studio-v3/agent-knowledge.js';
import {LEDGER_WORKFLOWS} from '../studio-v3/agent-workflows.js';
import {renderWorkflowsModule,LEDGER,MODULE} from '../scripts/generate-studio-v3-workflows.mjs';
import {capabilityChanges} from '../scripts/generate-studio-v3-agent.mjs';
import {parseCsv} from '../scripts/studio-v3-task-register.mjs';

const call = (name,args = {}) => fauxAssistantMessage([fauxToolCall(name,args,{id:`c-${name}`})],{stopReason:'toolUse'});
const json = message => JSON.parse(message.content[0].text);
const synthetic = {...AGENT_TOOL_DEFINITIONS[0],id:'printform.agent.synthetic_lookup',name:'synthetic_lookup',description:'Look up a synthetic fact.',
  parameters:Type.Object({key:Type.String({minLength:1,maxLength:20})},{additionalProperties:false}),outputSchema:Type.String(),
  errors:['AGENT_ARGUMENTS_INVALID'],examples:[{args:{key:'answer'}}],invalid:[{args:{key:''},error:'AGENT_ARGUMENTS_INVALID'}],skills:['synthetic-guide']};
const guide = {id:'synthetic-guide',description:'How to use synthetic_lookup.',sources:['studio-v3/agent-registry.js'],evaluations:['tests/studio-v3-agent-discovery.test.js'],content:'# Synthetic\n\nCall synthetic_lookup with a key.'};

describe('Studio v3 agent discovery and lifecycle (COV-05)', () => {
  afterEach(() => { for (const id of ['agent-registry','agent-handlers','agent-knowledge']) vi.doUnmock(`../studio-v3/${id}.js`); vi.resetModules(); });

  it('keeps the generated workflow module in sync with the ledger', () => {
    // Compare with LF on both sides: a Windows checkout (text=auto, autocrlf) holds these files with CRLF.
    const lf = file => fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
    expect(lf(MODULE)).toBe(renderWorkflowsModule(lf(LEDGER)));
    const rows = parseCsv(fs.readFileSync(LEDGER,'utf8')).rows, notCallable = rows.filter(row => row.disposition !== 'agent-callable' || row.agent_path === 'none');
    expect(LEDGER_WORKFLOWS.map(row => row[0])).toEqual(notCallable.map(row => row.id));
  });
  it('derives unsupported workflows from the ledger and documents each human path', () => {
    const catalog = capabilityCatalog(), content = readSkill('product-workflows').content;
    const count = status => LEDGER_WORKFLOWS.filter(row => row[2] === status).length;
    expect(catalog.workflows).toEqual({guide:'product-workflows',humanMediated:count('human-mediated'),notYetCallable:count('not-yet-callable'),intentionallyUnavailable:count('intentionally-unavailable')});
    expect(catalog.workflows.humanMediated + catalog.workflows.notYetCallable + catalog.workflows.intentionallyUnavailable).toBe(LEDGER_WORKFLOWS.length);
    expect(catalog.unsupported).toEqual(['source/shell execution','preview pixels']);
    for (const [,feature,,path] of LEDGER_WORKFLOWS) expect(content).toContain(`- ${feature}: ${path}`);
    expect(content).toContain('Open editable v3 JSON or exported HTML: Open button');
    expect(catalog.knowledge.map(skill => skill.id)).toEqual(['form-authoring','product-workflows']);
  });
  it('requires deprecations and tombstones to point at an active replacement', () => {
    const tools = AGENT_TOOL_DEFINITIONS, total = validateRegistry().length, replace = (name,patch) => tools.map(entry => entry.name === name ? {...entry,...patch} : entry);
    expect(() => validateRegistry({tools:replace('take_notes',{status:'deprecated'})})).toThrow('needs an active replacement');
    expect(() => validateRegistry({tools:replace('take_notes',{status:'retired'})})).toThrow('Invalid capability status');
    const deprecated = replace('take_notes',{status:'deprecated',replacementId:'printform.agent.finish'});
    expect(validateRegistry({tools:deprecated})).toHaveLength(total);
    expect(capabilityCatalog({tools:deprecated}).tools.find(tool => tool.name === 'take_notes')).toMatchObject({status:'deprecated',replacementId:'printform.agent.finish'});
    const stone = {id:'printform.agent.old_notes',name:'old_notes',replacementId:'printform.agent.take_notes',removedIn:'2.0.0',advice:'Use take_notes.'};
    expect(validateRegistry({tombstones:[stone]})).toHaveLength(total);
    expect(capabilityCatalog({tombstones:[stone]}).removed).toEqual([stone]);
    for (const bad of [{...stone,replacementId:'printform.agent.missing'},{...stone,advice:''},{...stone,id:'printform.agent.finish'},{...stone,name:'finish'},{...stone,removedIn:'2'}])
      expect(() => validateRegistry({tombstones:[bad]})).toThrow('Invalid capability tombstone');
    expect(() => validateRegistry({tombstones:[stone,stone]})).toThrow('Invalid capability tombstone');
  });
  it('reports removal advice, and flags a removal without a tombstone for the release gate', () => {
    const entry = id => ({id,status:'active',hash:'a'.repeat(64)});
    const previous = {version:1,release:'a'.repeat(40),packageHash:'p',entries:[entry('kept'),entry('gone'),entry('lost')]};
    const current = {release:'b'.repeat(40),packageHash:'q',entries:[entry('kept')],tombstones:[{id:'gone',replacementId:'kept',advice:'Use kept.'}]};
    const changes = capabilityChanges(previous,current).changes;
    expect(changes).toContainEqual({id:'gone',kind:'removed',reviewRequired:true,tombstone:true,replacementId:'kept',advice:'Use kept.'});
    expect(changes).toContainEqual({id:'lost',kind:'removed',reviewRequired:true,tombstone:false});
    const deprecated = capabilityChanges(previous,{...current,entries:[{...entry('kept'),hash:'b'.repeat(64),status:'deprecated',replacementId:'next'}]}).changes;
    expect(deprecated[0]).toEqual({id:'kept',kind:'deprecated',reviewRequired:true,replacementId:'next'});
  });
  it('discovers, documents and uses a synthetic new feature without editing the core prompt or tool lists', async () => {
    const total = validateRegistry().length;
    vi.resetModules();
    vi.doMock('../studio-v3/agent-knowledge.js',async original => {
      const actual = await original(), skills = [...actual.AGENT_SKILLS,guide];
      return {...actual,AGENT_SKILLS:skills,skillIndex:() => skills.map(({id,description,sources,evaluations}) => ({id,description,sources,evaluations})),
        readSkill:id => { const skill = skills.find(item => item.id === id); if (!skill) throw Object.assign(new Error('AGENT_SKILL_UNAVAILABLE'),{code:'AGENT_SKILL_UNAVAILABLE'}); return {...skill}; }};
    });
    vi.doMock('../studio-v3/agent-registry.js',async original => {
      const actual = await original(), tools = [...actual.AGENT_TOOL_DEFINITIONS,synthetic];
      return {...actual,AGENT_TOOL_DEFINITIONS:tools,AGENT_TOOL_NAMES:tools.map(tool => tool.name)};
    });
    vi.doMock('../studio-v3/agent-handlers.js',async original => {
      const actual = await original();
      return {...actual,TOOL_HANDLERS:{...actual.TOOL_HANDLERS,synthetic_lookup:async ({key}) => actual.reply(`Synthetic value for ${key}.`)}};
    });
    const {runAgentLoop} = await import('../studio-v3/agent-loop.js');
    const registry = await import('../studio-v3/agent-registry.js');
    expect(registry.validateRegistry({tools:registry.AGENT_TOOL_DEFINITIONS})).toHaveLength(total + 1);
    const faux = fauxProvider({provider:'discovery-faux',models:[{id:'discovery-faux'}]});
    let catalog, skill, value;
    faux.setResponses([call('get_capabilities'),context => { catalog = json(context.messages.at(-1)); return call('read_skill',{id:'synthetic-guide'}); },
      context => { skill = json(context.messages.at(-1)); return call('synthetic_lookup',{key:'answer'}); },
      context => { value = context.messages.at(-1).content[0].text; return call('report_blocked',{reason:'Synthetic run complete.'}); }]);
    const models = createModels(); models.setProvider(faux.provider);
    await expect(runAgentLoop({models,model:faux.getModel(),project:(await import('../studio-v3/demo-templates.js')).newProject(),request:'Look it up',
      context:() => '{}',signal:new AbortController().signal})).rejects.toMatchObject({code:'AGENT_BLOCKED',reason:'Synthetic run complete.'});
    expect(catalog.tools.map(tool => tool.name)).toContain('synthetic_lookup');
    expect(catalog.knowledge.map(item => item.id)).toContain('synthetic-guide');
    expect(skill.content).toContain('Call synthetic_lookup');
    expect(value).toBe('Synthetic value for answer.');
    // The core prompt text and the handler list were not edited; the new name only reaches the prompt through the registry.
    const loop = fs.readFileSync('studio-v3/agent-loop.js','utf8'), tools = fs.readFileSync('studio-v3/agent-tools.js','utf8');
    expect(loop).not.toContain('synthetic_lookup'); expect(tools).not.toContain('synthetic_lookup');
  });
});
