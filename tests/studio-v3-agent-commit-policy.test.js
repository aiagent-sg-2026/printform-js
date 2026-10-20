import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMMIT_POLICY_DESIGN,COMMIT_POLICY_SOURCE,COMMIT_POLICY_SHORT} from '../studio-v3/agent-commit-policy.js';
import {AGENT_PROMPT,promptFor} from '../studio-v3/agent-loop.js';
import {CHAT_PROMPT,chatRequest} from '../studio-v3/ai-chat-protocol.js';
import {capabilityCatalog} from '../studio-v3/agent-registry.js';
import {createGrant} from '../studio-v3/agent-effects.js';
import {authorizeSourceWorkspace} from '../studio-v3/source-workspace-run.js';
import {newProject} from '../studio-v3/model.js';
import {agentBody} from '../studio-v3/agent-wire.js';

const args={request:'Make the title blue',scope:{mode:'whole'},typography:[],conversation:[]};
describe('truthful host commit policy',()=> {
  it('sends the design policy in the actual context and system wire without universal human-only approval',()=> {
    const project=newProject(),context=chatRequest(project,args,{mode:'steps'}), sent=JSON.parse(context);
    expect(sent.run.commit).toBe(COMMIT_POLICY_SHORT);
    expect(sent.run.commitPolicy).toBe(COMMIT_POLICY_DESIGN);
    expect(chatRequest(project,args,{mode:'steps',source:false})).toBe(context);
    expect(capabilityCatalog().commit).toBe(COMMIT_POLICY_SHORT);
    for(const prompt of [CHAT_PROMPT,AGENT_PROMPT,promptFor(createGrant('design'))]) {
      const wire=JSON.parse(agentBody({alias:'demo-fast',context:{systemPrompt:prompt,messages:[{role:'user',content:context,timestamp:1}],tools:[]},stream:true}));
      expect(wire.input[0].content[0].text).toContain(COMMIT_POLICY_DESIGN);
      expect(wire.input[0].content[0].text).not.toContain('only a person can Preview and Apply');
    }
  });
  it.each(['coding','coding-read-only'])('keeps %s contexts behind explicit human Preview and Apply',async profile=> {
    const workspace=authorizeSourceWorkspace({available:true},{fictionalSource:true,readOnly:profile==='coding-read-only'});
    try {
      const grant=createGrant(profile,{workspace}),prompt=promptFor(grant);
      const sent=JSON.parse(chatRequest(newProject(),args,{mode:'steps',source:grant.profile.startsWith('coding')}));
      expect(sent.run.commit).toBe(COMMIT_POLICY_SHORT);
      expect(sent.run.commitPolicy).toBe(COMMIT_POLICY_SOURCE);
      expect(sent.run.commitPolicy).not.toContain(COMMIT_POLICY_DESIGN);
      if(profile==='coding') {expect(prompt).toContain(COMMIT_POLICY_SOURCE);expect(prompt).toContain('only a person can Preview and Apply');}
      expect(prompt).not.toContain(COMMIT_POLICY_DESIGN);
      expect(COMMIT_POLICY_SHORT).toContain('source-workspace work always requires explicit Preview and Apply');
    } finally {await workspace.close();}
  });
  it.each(['agent-loop.js','agent-registry.js','agent-handlers.js','agent-knowledge.js','agent-workflows.js','agent-general-print-guide.js','ai-chat-protocol.js','ai-harness.js'])('%s uses the canonical wording source',name=> {
    const source=fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../studio-v3',name),'utf8');
    expect(source).toMatch(/import\s*\{[^}]*COMMIT_POLICY_\w+[^}]*\}\s*from\s*['"]\.\/agent-commit-policy\.js['"]/);
  });
});
