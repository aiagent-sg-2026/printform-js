import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {html,setup,AUTO_REPLY} from './support/chat-panel.js';
import {parseChatReply} from '../studio-v3/ai-chat-protocol.js';
import {runPanelAgent} from '../studio-v3/ai-agent-run.js';
import {autoApplicable} from '../studio-v3/ai-auto-apply-policy.js';
import {editProject,designOperations} from '../studio-v3/controller.js';

// Isolate the agent boundary, not workspace authorization: real authorizations require a private WeakSet.
vi.mock('../studio-v3/ai-agent-run.js',()=>({runPanelAgent:vi.fn()}));
beforeEach(()=> {
  document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;
  runPanelAgent.mockReset();
  runPanelAgent.mockImplementation(async({project,payload,inspectCandidate})=> {
    const result=parseChatReply(JSON.stringify(AUTO_REPLY),project,payload);
    await inspectCandidate(result);
    return {...result,inspection:{ready:true},mode:'steps',turns:1};
  });
});
afterEach(()=> {vi.restoreAllMocks();vi.unstubAllGlobals();});
const allowlisted={kind:'proposal',operations:[{type:'set_style',patch:{color:'#163a65'}}],diff:[{target:'style',property:'color'}]};

describe('source-bound automatic apply exclusion',()=> {
  it('rejects host workspace flags without changing ordinary operation or legacy eligibility',()=> {
    for (const proposal of [allowlisted,{kind:'proposal',diff:allowlisted.diff}]) {
      expect(autoApplicable(proposal)).toBe(true);
      expect(autoApplicable(proposal,{workspace:{profile:'coding'}})).toBe(false);
      expect(autoApplicable(proposal,{workspace:{profile:'coding-read-only'}})).toBe(false);
      expect(autoApplicable(proposal,{workspace:{}})).toBe(false);
    }
  });
  it.each([600,1200])('keeps a workspace proposal pending at width %i until human Apply',async width=> {
    vi.stubGlobal('innerWidth',width);const commit=vi.fn(async next=> {
      await editProject(next.bus,designOperations(next.bus.project,next.design),'AI');return {bus:next.bus,revision:next.bus.revision};
    });
    const {panel}=setup({commit}),workspace={profile:'coding'};
    vi.spyOn(panel.sourceWorkspace,'consume').mockReturnValue(workspace);
    vi.spyOn(panel.sourceWorkspace,'release').mockResolvedValue();vi.spyOn(panel,'useSteps').mockReturnValue(true);
    const preview=vi.spyOn(panel,'preview');await panel.send();
    expect(panel.proposal?.sourceBound).toBe(true);expect(commit).not.toHaveBeenCalled();expect(panel.getBus().revision).toBe(0);
    expect(panel.node('[data-ai=apply]')).not.toBeNull();expect(preview).toHaveBeenCalledTimes(width>900 ? 1 : 0);
    if (width<=900) await panel.preview();
    expect(panel.checked).toBe(true);await panel.apply();expect(commit).toHaveBeenCalledTimes(1);expect(panel.getBus().revision).toBe(1);
  });
  it.each(['coding','coding-read-only'])('keeps profile %s manual even without a workspace object',async profile=> {
    const commit=vi.fn(),{panel}=setup({reply:AUTO_REPLY,commit});vi.spyOn(panel,'grantProfile').mockReturnValue(profile);
    await panel.send();expect(panel.proposal?.sourceBound).toBe(true);expect(commit).not.toHaveBeenCalled();expect(panel.node('[data-ai=apply]')).not.toBeNull();
  });
  it.each(['sourceBound','workspace'])('refuses a queued automatic apply carrying %s',async marker=> {
    const commit=vi.fn(),{panel}=setup({commit});await panel.send();await panel.preview();
    const proposal=panel.proposal;proposal[marker]=marker==='workspace' ? {profile:'coding'} : true;
    expect(panel.checked).toBe(true);await panel.autoApply(proposal);
    expect(commit).not.toHaveBeenCalled();expect(panel.proposal).toBe(proposal);expect(panel.getBus().revision).toBe(0);
  });
});
