import { runPanelAgent } from './ai-agent-run.js';
import { assertProposalCurrent, fail } from './ai-edits.js';
import { validateElementReferences } from './ai-element-tags.js';
import { runLayoutHarness } from './ai-harness.js';
import { inspectProject } from './validation.js';
import { errorMessage } from './ai-messages.js';
import { DEMO_CONFIG } from './ai-gateway-config.js';
import { newIntentKey } from './intent-ledger.js';

// Same conversation/proposal lifecycle; extraction keeps AIPanel below300 lines.
export async function sendPanelMessage() {
  if (this.busy || this.applying || this.restoring || this.sourceWorkspace?.closing || this.sourceWorkspace?.cleanupFailed) return;
  let payload, request;
  try { this.referenceFiles?.assertReady(); payload = this.payload(); request = this.request(); } catch (error) { this.error(error); this.message(error.message); return; }
  if (!payload.request) { this.message('Write a request or a comment on a referenced element before Send.'); return; }
  let alias = this.node('#ai-model').value;
  if (request !== this.sharedRequest) { this.share(); this.message('Layout context updated. Send again to use the current layout.'); return; }
  if (request.length > 40000) { this.message('The shared context is too large. Clear conversation or shorten the request.'); return; }
  const bus = this.getBus(), revision = bus.revision, project = structuredClone(bus.project), baseDesign = JSON.stringify(project.manifest.studioV3), baseData = JSON.stringify(project.sampleData), epoch = this.epoch, selection = this.getSelection(), scope = JSON.stringify(this.scope()), references = JSON.stringify(payload.references), attachmentVersion = this.referenceFiles?.version, media = this.referenceFiles?.projection().media || [];
  const assertContext = ()=> {
    signal.throwIfAborted();
    if (id !== this.generation) throw fail('STALE_PROPOSAL');
    assertProposalCurrent(this.getBus(),{bus,revision,baseDesign});
    if (attachmentVersion !== this.referenceFiles?.version || baseData !== JSON.stringify(bus.project.sampleData) || epoch !== this.epoch || selection !== this.getSelection() || scope !== JSON.stringify(this.scope()) || references !== JSON.stringify(this.elementTags?.payload() || [])) throw fail('STALE_PROPOSAL');
    validateElementReferences(bus.project,payload.references,bus.revision);
  };
  const {id,signal} = this.begin(); this.conversation.expire(); this.proposal = null; this.checked = false;
  let inspected = false, workspace;
  this.pendingMessage = payload.request; this.conversation.add('user',[payload.request,...payload.references.filter(r=>r.comment).map(r=>`${r.id}: ${r.comment}`)].join('\n'),'answer',{documentKey:this.documentKey()}); this.node('#ai-prompt').value = ''; this.share(); this.update();
  try {
    const runId = crypto.randomUUID(), readObservationHost = ()=>this.observationAccess.state(runId), baseProfile = this.grantProfile(payload);
    workspace = this.sourceWorkspace?.consume(baseProfile);
    const observationAuthorization = await this.observationAccess.consume(runId); assertContext(); signal.throwIfAborted();
    if (this.viewing) { await this.restore(); this.viewing = false; }
    assertContext();
    const aliases = await this.transport.discover(signal);
    assertContext();
    if (!this.setModels(aliases)) { if (this.modelChosen) throw fail('DEMO_MODEL_UNAVAILABLE'); alias = this.node('#ai-model').value; }
    if (media.length && !this.transport.supportsImages?.(alias)) throw fail('DEMO_IMAGE_CAPABILITY_UNVERIFIED');
    assertContext();
    const inspectCandidate = async proposal=> {
      assertContext(); inspected = true; this.viewing = true; this.update(); this.sync();
      const report = await this.renderPreview(proposal.candidate); assertContext(); signal.throwIfAborted();
      return {report,quality:inspectProject(proposal.candidate,report)};
    };
    const onPhase = (text,options)=> { if (id === this.generation) this.message(`${alias} · ${text}`,options); };
    let result;
    const steps = this.useSteps(payload,media,alias);
    if (workspace && !steps) throw fail('ENVIRONMENT_UNSUPPORTED');
    if (steps) {
      this.setRunTimeout(id,DEMO_CONFIG.agent.maxRunMs,'AGENT_TIMEOUT'); this.agentSteps = [];
      try { result = await runPanelAgent({transport:this.transport,alias,payload,media,project,signal,assertContext,inspectCandidate,capturePixels:async(...args)=> { assertContext(); const image=await this.capturePixels?.(...args); assertContext(); return image; },onPhase,onStep:step=>this.stepDone(step,id),profile:workspace?.profile || baseProfile,baseRevision:revision,runId,observationAuthorization,readObservationHost,workspace}); }
      catch (error) {
        const refused = error.code === 'DEMO_TOOLS_UNAVAILABLE', ignored = error.code === 'AI_RUN_FAILED' && !this.agentSteps.length;
        if (refused) this.agentUnavailable = true;
        if (workspace || (!refused && !ignored)) throw error;
        this.setRunTimeout(id,DEMO_CONFIG.sendTimeoutMs);
        this.agentSteps = []; onPhase(refused ? 'Step-by-step runs are not available here; using the single-step flow' : 'The model did not use the step tools; using the single-step flow');
      }
    }
    if (workspace && !result) throw fail('SOURCE_ARTIFACT_REQUIRED');
    result ||= await runLayoutHarness({transport:this.transport,alias,request,project,signal,chat:payload,assertContext,media,inspectCandidate,onPhase});
    if (id !== this.generation) return;
    assertContext();
    if (result.kind === 'answer' && this.viewing) { await this.restoreUnapplied(); if (id !== this.generation) return; assertContext(); }
    const card = this.conversation.add('assistant',result.kind === 'answer' ? result.message : result.summary,result.kind === 'answer' ? 'answer' : 'ready',{documentKey:this.documentKey(),observationProtected:observationAuthorization.text || observationAuthorization.values,...(result.kind === 'answer' && result.observation ? {observation:result.observation} : {}),...(result.diff ? {diff:result.diff} : {})});
    if (result.kind === 'proposal') this.proposal = {...result,bus,revision,baseDesign,epoch,selection,scope,cardId:card.id,intentKey:newIntentKey()};
    if (result.kind === 'answer' && this.viewing) return;
    const auto = result.kind === 'proposal' && innerWidth > 900, next = auto && result.inspection?.ready ? 'Review the paper preview, then Apply.' : 'Preview before Apply.';
    const details = `${alias} · ${result.kind === 'answer' ? '' : `r${revision} · ${result.mode === 'steps' ? `${result.turns} steps` : `${result.iterations} inspection round(s)`} · `}Tokens: ${result.usage?.total ?? 'unavailable'}`;
    this.message(`${result.kind === 'answer' ? 'Read-only answer; form unchanged.' : `${result.inspection?.ready ? 'Local checks passed.' : 'Local checks blocked.'} ${next}`} (${details})`);
    if (auto) await this.preview(true).catch(error=>this.error(error));
  } catch (error) {
    if (id === this.generation) { const message = errorMessage(this.timedOut === id ? fail(this.timeoutCode) : error); this.conversation.add('assistant',message,error.name === 'AbortError' && this.timedOut !== id ? 'cancelled' : 'error',{request:payload.request,documentKey:this.documentKey()}); this.message(''); }
    if (id === this.generation && inspected && this.viewing && !this.proposal) await this.restoreUnapplied();
  } finally {
    await this.sourceWorkspace?.release(workspace);
    if (id === this.generation) { this.transport.clearSession(); this.finish(); this.share(); this.sync(); }
  }
}
