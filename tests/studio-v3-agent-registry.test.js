import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createModels,fauxProvider,fauxAssistantMessage,fauxToolCall} from '@earendil-works/pi-ai';
import {AGENT_TOOL_DEFINITIONS,OPERATION_CAPABILITIES,validateRegistry,capabilityCatalog} from '../studio-v3/agent-registry.js';
import {AUTHORING_TYPES,GLOBAL_STYLE_SCHEMA} from '../studio-v3/agent-operation-schemas.js';
import {GLOBAL_STYLE_KEYS} from '../studio-v3/ai-authoring-contract.js';
import {readSkill} from '../studio-v3/agent-knowledge.js';
import {chatRequest} from '../studio-v3/ai-chat-protocol.js';
import {newProject} from '../studio-v3/model.js';
import {runAgentLoop,AGENT_PROMPT} from '../studio-v3/agent-loop.js';
import {generateAgentPackage,capabilityChanges} from '../scripts/generate-studio-v3-agent.mjs';
import {finalizeStudioV3Pwa} from '../scripts/studio-v3-pwa.mjs';

const call=(name,args={})=>fauxAssistantMessage([fauxToolCall(name,args,{id:`c-${name}`})],{stopReason:'toolUse'});
const json = result=>JSON.parse(result.content[0].text);
const contextArgs={request:'Use navy',scope:{mode:'whole'},typography:[],conversation:[]};
describe('feature-owned registry and knowledge',()=> {
  it('has closed transport contracts, real source/evaluation references and one canonical operation list',()=> {
    expect(validateRegistry()).toHaveLength(23);
    expect(OPERATION_CAPABILITIES.map(op=>op.name)).toEqual(AUTHORING_TYPES);
    expect(Object.keys(GLOBAL_STYLE_SCHEMA.properties).sort()).toEqual([...GLOBAL_STYLE_KEYS].sort());
    const check=schema=> {
      if (schema.type==='object') expect(schema.additionalProperties).toBe(false);
      for (const child of Object.values(schema.properties || {})) check(child);
      if (schema.items) check(schema.items);
      for (const child of schema.anyOf || []) check(child);
    };
    for (const entry of validateRegistry()) {check(entry.parameters);for(const ref of [...entry.sources,...entry.evaluations])expect(fs.existsSync(ref)).toBe(true);}
    expect(()=>readSkill('../private')).toThrow('AGENT_SKILL_UNAVAILABLE');
    expect(readSkill('form-authoring').content).toContain('rowBackground');
  });
  it('can register a new read capability without changing the core prompt',()=> {
    const extra={...AGENT_TOOL_DEFINITIONS[0],id:'printform.agent.synthetic_read',name:'synthetic_read',description:'A synthetic new read capability.'};
    expect(validateRegistry({tools:[...AGENT_TOOL_DEFINITIONS,extra]})).toHaveLength(24);
    expect(AGENT_PROMPT).not.toContain('synthetic_read');
    expect(()=>validateRegistry({tools:[...AGENT_TOOL_DEFINITIONS,extra,extra]})).toThrow('Invalid');
    expect(()=>validateRegistry({tools:[{...extra,skills:['missing']}]})).toThrow('Invalid');
  });
  it('reports actual lane limits without confusing model requests and tool calls',()=> {
    const limits={maxTurns:17,maxRunMs:1234,maxRunTokens:500,maxRepeatedFailures:2,imageTurns:3,maxNoteChars:200};
    const step=JSON.parse(chatRequest(newProject(),contextArgs,{mode:'steps',limits,identity:{release:'fixture'}}));
    expect(step.run).toMatchObject({mode:'steps',maxToolCalls:17,maxRunMs:1234,maxRunTokens:500,identity:{release:'fixture'}});
    expect(step.run).not.toHaveProperty('maxModelRequests');expect(step.run).not.toHaveProperty('maxPreviewInspections');
    expect(JSON.parse(chatRequest(newProject(),contextArgs)).run).toMatchObject({mode:'single',maxModelRequests:3,maxPreviewInspections:3,maxRunMs:225000});
    expect(capabilityCatalog({limits}).run.maxToolCalls).toBe(17);
  });
  it('lets a Pi run discover/read a guide, recover a missing guide and author a reviewed draft',async()=> {
    const faux=fauxProvider({provider:'registry-faux',models:[{id:'registry-faux'}]});let catalog,guide;
    faux.setResponses([
      call('get_capabilities'), context=> {catalog=json(context.messages.at(-1));return call('read_skill',{id:'missing'});},
      context=> {expect(context.messages.at(-1).isError).toBe(true);return call('read_skill',{id:'form-authoring'});},
      context=> {guide=json(context.messages.at(-1));return call('get_context');},
      call('apply_operations',{summary:'Navy',operations:[{type:'set_style',patch:{color:'#163a65'}}]}),call('inspect_draft'),call('finish',{summary:'Navy accents'})]);
    const models=createModels();models.setProvider(faux.provider);const project=newProject(),before=structuredClone(project);
    const result=await runAgentLoop({models,model:faux.getModel(),project,request:'Use navy',context:(current,info)=>chatRequest(current,contextArgs,{mode:'steps',...info}),inspect:async()=>({report:{status:'ready'}}),signal:new AbortController().signal});
    expect(catalog.tools.map(t=>t.name)).toContain('read_skill');expect(catalog.operations).toHaveLength(13);
    expect(guide.id).toBe('form-authoring');expect(guide.identity).toEqual(catalog.identity);
    expect(result.identity).toEqual(catalog.identity);expect(project).toEqual(before);expect(result.inspection.ready).toBe(true);
  });
  it.each(['budget','repeated','coercion'])('counts schema-rejected calls and stops at the configured %s boundary',async kind=> {
    const faux=fauxProvider({provider:'rejection-faux',models:[{id:'rejection-faux'}]});
    const operations=[{type:'set_style',patch:{font:kind==='coercion' ? '10' : 'large'}}];
    faux.setResponses(Array.from({length:10},()=>call('apply_operations',{summary:'Invalid',operations})));
    const models=createModels();models.setProvider(faux.provider);const steps=[];
    await expect(runAgentLoop({models,model:faux.getModel(),project:newProject(),request:'Invalid',context:()=>'',signal:new AbortController().signal,
      limits:{maxTurns:kind==='budget' ? 2 : 100,maxRepeatedFailures:kind==='budget' ? 10 : 3,maxRunMs:60000},onStep:step=>steps.push(step)})).rejects.toMatchObject({code:kind==='budget' ? 'AGENT_BUDGET' : 'AGENT_STALLED'});
    expect(faux.state.callCount).toBe(3);expect(steps).toHaveLength(3);
  });
  it('rejects malformed operation shapes through the actual Pi tool boundary without editing the draft',async()=> {
    const faux=fauxProvider({provider:'schema-faux',models:[{id:'schema-faux'}]});
    faux.setResponses([call('apply_operations',{summary:'Invalid',operations:[{type:'set_style',patch:{font:'large',script:'bad'}}]}),context=> {
      expect(context.messages.at(-1).isError).toBe(true);return call('report_blocked',{reason:'Unsupported shape'});
    }]);const models=createModels();models.setProvider(faux.provider);const project=newProject(),before=structuredClone(project);
    await expect(runAgentLoop({models,model:faux.getModel(),project,request:'Invalid',context:()=>'',signal:new AbortController().signal})).rejects.toMatchObject({code:'AGENT_BLOCKED'});
    expect(project).toEqual(before);
  });
});

describe('generated coherent release resources',()=> {
  it('emits reproducible content hashes and includes knowledge in change tracking',()=> {
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'agent-package-'));
    try {
      const first=generateAgentPackage({output:temp,revision:'a'.repeat(40)}),second=generateAgentPackage({revision:'a'.repeat(40),baseline:first.manifest});
      expect(second.identity).toEqual(first.identity);expect(second.changes.changes).toEqual([]);
      for (const [name,hash] of Object.entries(first.manifest.files)) expect(createHash('sha256').update(fs.readFileSync(path.join(temp,'studio-v3/agent',name))).digest('hex')).toBe(hash);
      expect(first.manifest.entries.some(e=>e.id==='printform.knowledge.form-authoring')).toBe(true);
      const previous={...first.manifest,entries:[{id:'removed',hash:'f'.repeat(64),status:'active'},...first.manifest.entries.slice(1).map((e,i)=>i ? e : {...e,hash:'f'.repeat(64)})]};
      expect(capabilityChanges(previous,first.manifest).changes.map(c=>c.kind)).toEqual(expect.arrayContaining(['added','changed','removed']));
      const deprecated={...first.manifest,entries:first.manifest.entries.map((e,i)=>i ? e : {...e,hash:'f'.repeat(64),status:'deprecated'})};
      expect(capabilityChanges(first.manifest,deprecated).changes[0].kind).toBe('deprecated');
      expect(()=>generateAgentPackage({root:temp})).toThrow();expect(()=>generateAgentPackage({revision:'bad'})).toThrow('revision');
    } finally {fs.rmSync(temp,{recursive:true,force:true});}
  });
  it('requires matching resources and hashes all of them in the immutable offline shell',()=> {
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'agent-pwa-'));
    try {
      for(const dir of ['studio-v3','studio-v2','dist'])fs.mkdirSync(path.join(temp,dir));
      for(const name of ['index.html','sw.js','manifest.webmanifest'])fs.copyFileSync(`studio-v3/${name}`,path.join(temp,'studio-v3',name));
      for(const name of ['app.js','tokens.css','styles.css','ai-panel.css','update.css'])fs.writeFileSync(path.join(temp,'studio-v3',name),name);
      fs.writeFileSync(path.join(temp,'studio-v2/icon.svg'),'<svg/>');
      for(const name of ['printform.js','printform-document.js'])fs.writeFileSync(path.join(temp,'dist',name),name);
      expect(()=>finalizeStudioV3Pwa(temp,'a'.repeat(40))).toThrow('Missing');
      generateAgentPackage({output:temp,revision:'b'.repeat(40)});expect(()=>finalizeStudioV3Pwa(temp,'a'.repeat(40))).toThrow('revision mismatch');
      generateAgentPackage({output:temp,revision:'a'.repeat(40)});finalizeStudioV3Pwa(temp,'a'.repeat(40));
      const sw=fs.readFileSync(path.join(temp,'studio-v3/sw.js'),'utf8');
      for(const name of ['agent-manifest.json','capabilities.json','knowledge-index.json','resources/form-authoring.md','capability-changes.json'])expect(sw).toContain(`releases/${'a'.repeat(40)}/agent/${name}`);
    } finally {fs.rmSync(temp,{recursive:true,force:true});}
  });
});
