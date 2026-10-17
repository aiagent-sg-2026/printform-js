import { describe, expect, it } from 'vitest';
import { newProject, compileProject, designOf } from '../studio-v3/model.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { chatRequest, parseChatReply } from '../studio-v3/ai-chat-protocol.js';
import { semanticObservation } from '../studio-v3/observation-context.js';
import { pageSettings } from '../studio-v3/paper-settings.js';

const operation = patch => ({type:'set_page',patch});
const profile = {version:1,source:'user-supplied',name:'PRIVATE-DEVICE-NAME-729',maxWidthMm:220,dpi:203};
function configured() {
  const project = newProject(), design = designOf(project);
  design.page = {...pageSettings(design),printerProfile:profile};
  return compileProject(project,design);
}

describe('agent special-media boundaries', () => {
  it('keeps custom dimensions private until human Apply and removes obsolete dimensions on standard media transition', () => {
    const project = newProject(), before = structuredClone(project), draft = createDraft(project);
    draft.apply('Use custom stock',[operation({paper:'CUSTOM',customSizeMm:{width:82.5,height:133.2}})]);
    expect(designOf(draft.project).page.customSizeMm).toEqual({width:82.5,height:133.2});
    draft.apply('Use letter stock',[operation({paper:'LETTER'})]);
    expect(designOf(draft.project).page.paper).toBe('LETTER');
    expect(designOf(draft.project).page).not.toHaveProperty('customSizeMm');
    expect(project).toEqual(before);
  });
  it('merges one requested margin without resetting the other three and permits disjoint page operations', () => {
    const base = newProject(), design = designOf(base), previous = {top:8,right:9,bottom:10,left:11};
    design.page = {...pageSettings(design),margins:previous};
    const project = compileProject(base,design), draft = createDraft(project);
    draft.apply('Adjust page',[operation({paper:'A5'}),operation({margins:{top:previous.top+1}})]);
    expect(designOf(draft.project).page.margins).toEqual({...previous,top:previous.top+1});
    expect(designOf(draft.project).page.paper).toBe('A5');
  });
  it('requires explicitly removing a conflicting declared device profile and never changes the committed one', () => {
    const project = configured(), draft = createDraft(project), original = structuredClone(project);
    expect(() => draft.apply('Too wide',[operation({paper:'CUSTOM',customSizeMm:{width:300,height:180}})])).toThrow('UNSAFE_PROPOSAL');
    expect(draft.project).toEqual(project);
    draft.apply('Remove declared constraints',[operation({paper:'CUSTOM',customSizeMm:{width:300,height:180},printerProfile:null})]);
    expect(designOf(draft.project).page).not.toHaveProperty('printerProfile');
    expect(project).toEqual(original);
  });
  it('does not widen an element-only scope to author global paper settings', () => {
    const project = newProject();
    expect(() => parseChatReply(JSON.stringify({kind:'proposal',summary:'Resize',operations:[operation({paper:'A5'})]}),project,{scope:{mode:'selected',id:'customer'}})).toThrow('UNSAFE_SCOPE');
  });
  it('omits local device names and unmapped raw import values from provider context and form text disclosure', () => {
    const project = configured();
    project.manifest.localImport = {sourceText:'UNMAPPED-PRIVATE-SOURCE-108',filename:'PRIVATE-FILE-934.csv'};
    const request = chatRequest(project,{request:'Improve the page',scope:{mode:'whole'},typography:[],conversation:[]});
    for (const canary of [profile.name,'UNMAPPED-PRIVATE-SOURCE-108','PRIVATE-FILE-934.csv']) expect(request).not.toContain(canary);
    const numeric = semanticObservation(project,{}, {text:false,values:false});
    const text = semanticObservation(project,{}, {text:true,values:false});
    for (const result of [numeric,text]) {
      expect(JSON.stringify(result)).not.toContain(profile.name);
      expect(result.layout.page.printerProfile).toMatchObject({maxWidthMm:220,dpi:203});
    }
    expect(designOf(project).page.printerProfile.name).toBe(profile.name);
  });
});
