import { AIReferenceFiles } from './ai-reference-files.js';
import { sendPanelMessage } from './ai-panel-run.js';
import { agentEnabled,setAgentEnabled } from './agent-preference.js';
import { stepLabel } from './agent-step-labels.js';
import { createDemoTransport } from './ai-demo-transport.js';
import { assertProposalCurrent, fail } from './ai-edits.js';
import { chatRequest,readOnlyRequest } from './ai-chat-protocol.js';
import { profileFor } from './agent-effects.js';
import { createIntentLedger } from './intent-ledger.js';
import { Conversation, cleanMessages } from './ai-conversation.js';
import { renderConversation, setupPanelLayout } from './ai-chat-view.js';
import { errorMessage } from './ai-messages.js';
import { inspectProject } from './validation.js';
import { AIElementTags } from './ai-element-tags.js';
import { DEMO_CONFIG, isDemoAlias } from './ai-gateway-config.js';
import { fillModels, showAlias } from './ai-model-select.js';
import { AIObservationAuthorization } from './ai-observation-authorization.js';
import { AISourceWorkspace } from './ai-source-workspace.js';
// Shown under the message box whenever Send works; it is the recipient notice Send accepts.
const RECIPIENT_NOTICE = 'Sent to the Demo gateway · use fictional data only';

export class AIPanel {
  constructor({bus,selection=()=> 'items',facts=()=>[],elementTags,guard,preview,capturePixels,restore,commit,undo,sync,transport=createDemoTransport()}) {
    Object.assign(this,{getBus:bus,getSelection:selection,getFacts:facts,elementTags,guard,renderPreview:preview,capturePixels,restore,commit,undo,sync,transport});
    this.root = document.querySelector('#ai-panel'); this.viewing = false; this.agentSteps = []; this.agentUnavailable = false; this.modelChosen = false; this.proposal = null; this.generation = 0; this.epoch = 0; this.intents = createIntentLedger(); this.conversation = new Conversation();
    this.root.addEventListener('submit',event=> { event.preventDefault(); void this.send(); });
    this.node('#ai-agent').checked = agentEnabled();
    this.root.addEventListener('change',event=> { if (event.target.id === 'ai-agent') { setAgentEnabled(event.target.checked); this.agentUnavailable = false; }
      if (event.target.id === 'ai-scope' && event.target.value === 'whole') { this.elementTags?.clear(); this.showScopeHint(); } });
    this.root.addEventListener('input',event=> { if (['ai-prompt','ai-model'].includes(event.target.id)) { this.share(); if (event.target.id === 'ai-model') { this.modelChosen = true; this.update(); } } });
    this.root.addEventListener('click',event=> {
      const button = event.target.closest('[data-ai]'), action = button?.dataset.ai;
      if (button?.disabled) return;
      if (action === 'close') this.close();
      if (action === 'attach') this.referenceFiles?.pick();
      if (action === 'cancel') void this.stop();
      if (action === 'discard') void this.discard();
      if (action === 'preview') void this.guard(()=>this.preview()).catch(error=>this.error(error));
      if (action === 'apply') { const intent = button.dataset.intent; void this.guard(()=>this.apply(intent)).catch(error=>this.error(error)); }
      if (action === 'undo') void this.guard(()=>this.undoCard(button.dataset.cardId)).catch(error=>this.error(error));
      if (action === 'models') void this.discover();
      if (action === 'clear') { this.node('.ai-settings').open = false; void this.clear(); }
      if (action === 'retry') this.retry(button.dataset.cardId);
      if (button?.dataset.prompt) { this.node('#ai-prompt').value = button.dataset.prompt; this.share(); this.node('#ai-prompt').focus(); }
    });
    document.addEventListener('click',event=> { const menu = this.node('.ai-settings'); if (menu.open && !menu.contains(event.target)) menu.open = false; });
    document.querySelector('#ai-preview-banner').addEventListener('click',event=> { if (this.applying) return; if (event.target.closest('[data-ai-return]')) this.show(); if (event.target.closest('[data-ai-discard]')) void this.discard(); });
    document.querySelector('[data-ai-toggle]').addEventListener('click',()=>this.open ? this.close() : this.show());
    this.node('[data-ai-origin]').textContent = `${location.origin} · project github-pages`;
    this.observationAccess = new AIObservationAuthorization(this);
    this.sourceWorkspace = new AISourceWorkspace(this);
    this.referenceFiles = new AIReferenceFiles(this); setupPanelLayout(this); this.update();
  }
  node(selector) { return this.root.querySelector(selector); }
  // Progress ticks twice a second; they stay silent for screen readers, phase changes are announced.
  message(text,{progress = false} = {}) { const status = this.node('[data-ai-status]'); status.setAttribute('aria-live',progress ? 'off' : 'polite'); status.textContent = text; status.title = text; const wait = this.root.querySelector('.ai-pending-text'); if (wait) wait.textContent = text; }
  error(error) { this.message(errorMessage(error)); }
  // Scope is derived, never chosen: referenced elements limit the edit, otherwise the whole form is editable.
  scope() { const ids = this.elementTags?.snapshot().map(r=>r.id) || []; return ids.length ? {mode:'selected',id:ids[0],ids} : {mode:'whole'}; }
  // The scope bar says plainly what AI may change; a narrow screen needs the extra step of closing the panel to select.
  // The scope is always derived from the referenced elements; this bar shows it and offers the way back to the whole form.
  showScopeHint() {
    const bar = this.node('[data-ai-scope]'), count = this.scope().ids?.length || 0, choice = this.node('#ai-scope'), selected = choice.querySelector('[value=selected]');
    bar.dataset.scope = count ? 'selected' : 'whole';
    selected.disabled = !count; selected.textContent = count ? `${count} selected element${count > 1 ? 's' : ''}` : 'Selected elements'; choice.value = count ? 'selected' : 'whole';
    const how = count ? 'Choose Whole form to edit any part.' : innerWidth <= 900 ? 'To limit them, close this panel, tap an element, then press Add to chat.' : 'To limit them, select an element and press Add to chat.';
    this.node('.ai-scope-help').textContent = count ? 'Only referenced elements can change.' : 'Any part can change. Layout edits apply automatically; Undo restores them.';
    const guidance = `${this.node('.ai-scope-help').textContent} ${how}`;
    choice.title = guidance; choice.setAttribute('aria-description',guidance);
  }
  documentKey() { return this.getBus()?.project.manifest.documentId; }
  payload() {
    const references = this.elementTags?.payload() || [];
    const input = this.node('#ai-prompt').value.trim(), request = input || (references.some(r=>r.comment) ? 'Apply the comments on the referenced elements.' : '');
    return {request,scope:this.scope(),typography:this.getFacts(),conversation:this.conversation.context(this.documentKey()),references,...(this.referenceFiles?.files.length ? {attachments:this.referenceFiles.projection().references} : {})};
  }
  request() { return this.getBus() ? chatRequest(this.getBus().project,this.payload()) : '{}'; }
  // One line at rest; grows with the text (the CSS caps it). Hidden panels measure 0, so they keep the natural height.
  fitPrompt() { const box = this.node('#ai-prompt'); box.style.height = 'auto'; if (box.scrollHeight) box.style.height = `${box.scrollHeight}px`; }
  share() {
    this.fitPrompt();
    try { this.sharedRequest = this.request(); this.shareBlocked = false; }
    catch (error) { this.shareBlocked = true; this.sharedRequest = null; this.message(error.message); }
  }
  show() { this.open = true; this.root.hidden = false; document.body.classList.add('ai-open'); this.contextChanged(); this.share(); this.update(); this.node('#ai-prompt').focus(); this.sync(); }
  suspend() { this.closeVersionHistory?.(false); this.node('.ai-settings').open = false; this.open = false; this.root.hidden = true; document.body.classList.remove('ai-open'); this.update(); this.sync(); }
  close() { if (this.applying) return; if (this.busy) void this.stop(); this.sourceWorkspace?.resetConsent(); this.suspend(); document.querySelector('[data-ai-toggle]').focus(); }
  contextChanged(force=false) {
    const bus = this.getBus(), selected = this.getSelection();
    this.elementTags?.contextChanged(); this.referenceFiles?.contextChanged();
    this.showScopeHint();
    if (force || bus !== this.contextBus || selected !== this.contextSelection) {
      this.contextBus = bus; this.contextSelection = selected; ++this.epoch;
      this.sourceWorkspace?.resetConsent();
      const viewing = this.viewing; this.invalidate('Form changed, or selection/scope changed. Send again.');
      if (viewing && !this.applying) void this.restoreUnapplied();
    }
  }
  assertCurrent(proposal,generation=this.generation) {
    assertProposalCurrent(this.getBus(),proposal || {});
    if (this.proposal !== proposal || this.generation !== generation || proposal.epoch !== this.epoch || proposal.selection !== this.getSelection() || proposal.scope !== JSON.stringify(this.scope())) throw fail('STALE_PROPOSAL');
  }
  cancel(message='Cancelled. Live form unchanged.') {
    if (this.applying) return;
    this.observationAccess?.end();
    void this.sourceWorkspace?.cancelActive();
    ++this.generation; this.controller?.abort(); this.transport.clear(); this.controller = null;
    clearTimeout(this.timer); this.busy = false;
    const logged = Boolean(this.pendingMessage);
    if (logged) { this.conversation.add('assistant',message,'cancelled',{request:this.pendingMessage,documentKey:this.documentKey()}); this.pendingMessage = null; }
    this.message(logged ? '' : message); this.update();
  }
  async stop() {
    const viewing = this.viewing; this.cancel(); const restored = viewing ? this.restoreUnapplied() : undefined; await Promise.all([this.sourceWorkspace?.cancelActive(),restored]);
  }
  async restoreUnapplied() {
    const bus = this.getBus(), generation = this.generation, token = {}; this.restoration = token; this.viewing = true; this.restoring = true; this.update(); this.sync();
    try { await this.restore(); if (bus === this.getBus() && generation === this.generation) this.viewing = false; }
    catch { if (bus === this.getBus() && generation === this.generation) { this.viewing = true; this.message('Restore the committed form before printing. The candidate remains unapplied.'); } }
    finally { if (this.restoration === token) this.restoring = false; this.update(); this.sync(); }
  }
  async discard() { const viewing = this.viewing; this.invalidate('Preview discarded.'); if (viewing) await this.restoreUnapplied(); }
  invalidate(message='Form changed. Send again for the current revision.') {
    const active = this.busy || this.proposal || this.viewing;
    if (!this.applying) this.cancel(active ? message : '');
    this.conversation.expire(); this.proposal = null; if (!this.applying) this.viewing = false; this.checked = false; this.share(); this.update();
  }
  begin() {
    this.cancel('Connecting to Demo gateway…'); this.busy = true;
    const id = this.generation, controller = new AbortController(); this.controller = controller;
    this.setRunTimeout(id,DEMO_CONFIG.sendTimeoutMs);
    this.update(); return {id,signal:controller.signal};
  }
  setRunTimeout(id,ms,code='AI_TIMEOUT') {
    if (id !== this.generation || !this.controller) return;
    clearTimeout(this.timer);
    const controller = this.controller;
    this.timer = setTimeout(()=> { if (id !== this.generation) return; this.timedOut = id; this.timeoutCode = code; controller.abort(); },ms);
  }
  // Resolves true only when the gateway answered; failures are reported in the conversation instead.
  async discover() {
    if (this.busy || this.applying || this.restoring) return;
    const {id,signal} = this.begin();
    try { const aliases = await this.transport.discover(signal); if (id !== this.generation) return; this.setModels(aliases); this.message(`Available: ${aliases.join(', ')}. No document sent.`); return true; }
    catch (error) { if (id === this.generation) this.error(this.timedOut === id ? fail(this.timeoutCode) : error); }
    finally { if (id === this.generation) { this.transport.clearSession(); this.finish(); this.share(); } }
  }
  // Returns whether the shown model survived. An untouched default may adapt to what the gateway offers;
  // a model the user chose never changes silently (see send()).
  setModels(aliases) { const kept = fillModels(this.node('#ai-model'),aliases); this.referenceFiles?.capabilityChanged(); return kept; }
  restoreAlias(alias) { const valid = isDemoAlias(alias) ? alias : DEMO_CONFIG.defaultAlias; showAlias(this.node('#ai-model'),valid); this.modelChosen = valid !== DEMO_CONFIG.defaultAlias; }
  finish() { this.observationAccess?.end(); clearTimeout(this.timer); this.controller = null; this.busy = false; this.pendingMessage = null; this.agentSteps = []; this.update(); }
  // Work in steps unless it is off, known to be unavailable, or images lack confirmed support. A question runs the same
  // way under a read-only grant (see grantProfile); with steps unavailable it keeps the single-step answer flow.
  useSteps(payload,media,alias) { return agentEnabled() && !this.agentUnavailable && (!media.length || this.transport.supportsImages?.(alias) === true) && typeof this.transport.agentTurn === 'function'; }
  // The effect grant comes from host state. The question check can only narrow it to read-only, never widen it.
  grantProfile(payload) { return profileFor({question:readOnlyRequest(payload.request,payload.conversation)}); }
  stepDone(step,id) { if (id === this.generation) { this.agentSteps.push({text:stepLabel(step),ok:step.ok,code:step.code}); this.update(); } }
  async send() { return sendPanelMessage.call(this); }
  present() { this.update(); }
  async preview(quiet = false,{keepOpen = false} = {}) {
    const proposal = this.proposal; this.assertCurrent(proposal); this.viewing = true; this.checked = false; this.update(); this.sync();
    const report = await this.renderPreview(proposal.candidate); if (this.proposal !== proposal) return;
    this.assertCurrent(proposal); this.checked = inspectProject(proposal.candidate,report).ready;
    if (!quiet) this.message(this.checked ? 'Unapplied paper preview passed. Review the pages before Apply.' : 'Unapplied preview blocked by layout/data validation. Discard or request another suggestion.');
    this.update(); this.sync();
    if (innerWidth <= 900 && !keepOpen) { this.suspend(); document.querySelector('[data-ai-toggle]').focus(); }
  }
  // The same Apply path as the button (intent ledger, stale checks, restore on failure), reached without a click.
  async autoApply(proposal) {
    if (this.proposal !== proposal || !this.checked || this.busy || this.applying) return;
    await this.guard(()=>this.apply(proposal.intentKey)).catch(error=>this.error(error));
  }
  // A duplicate Apply for a key already seen (a second click, a queued repeat) waits for the original outcome and does
  // nothing more: one commit, no stale-proposal or busy error for the harmless repeat.
  async apply(intentKey = this.proposal?.intentKey) {
    const duplicate = this.intents.replay(intentKey);
    if (duplicate) { await duplicate.catch(() => {}); return; }
    // A key that is neither known nor the current proposal's belongs to something else; it never commits this proposal.
    if (intentKey !== this.proposal?.intentKey) throw fail('STALE_PROPOSAL');
    const proposal = this.proposal; this.assertCurrent(proposal); if (!this.checked || this.busy) throw fail('AI_RUN_FAILED');
    const card = this.conversation.messages.find(m=>m.id === proposal.cardId), generation = this.generation;
    this.applying = true; this.busy = true; this.update(); let canonical = false;
    try {
      const applied = await this.intents.run(proposal.intentKey,JSON.stringify([proposal.revision,proposal.baseDesign,proposal.design]),() => this.commit(proposal,generation)); canonical = true;
      if (card) Object.assign(card,{status:'applied',appliedBus:applied.bus,appliedRevision:applied.revision,appliedEpoch:proposal.epoch});
      // The references pointed at the revision just replaced; keeping them would block the next Send as outdated.
      if (applied.bus === this.getBus()) { this.elementTags?.consume(); this.showScopeHint(); }
      this.message(applied.bus === this.getBus() ? 'Applied to the form. Undo restores the previous layout.' : 'Applied to the previous form. Current form unchanged.');
    } catch (error) {
      try { await this.restore(); canonical = true; this.error(error); }
      catch { this.message('Apply failed. The candidate remains unapplied; restore the form before printing.'); }
    }
    finally { this.applying = false; this.busy = false; this.proposal = null; this.checked = false; this.viewing = !canonical; this.update(); this.share(); this.sync(); }
  }
  canUndo(card) { return card.appliedBus === this.getBus() && card.appliedRevision === this.getBus()?.revision && card.appliedEpoch === this.epoch && this.getBus()?.history.canUndo; }
  async undoCard(id) { const card = this.conversation.messages.find(m=>m.id === id); if (!card || !this.canUndo(card)) throw fail('STALE_PROPOSAL'); await this.undo(()=> { if (!this.canUndo(card)) throw fail('STALE_PROPOSAL'); }); card.status = 'expired'; this.message('Undid this layout edit. Your source data is unchanged.'); this.update(); }
  retry(id) { if (this.busy || this.applying) return; const card = this.conversation.messages.find(m=>m.id === id); this.node('#ai-prompt').value = card?.request || [...this.conversation.messages].reverse().find(m=>m.role === 'user')?.text || ''; this.share(); this.node('#ai-prompt').focus(); }
  async clear() {
    if (this.applying || this.restoring || ((this.busy || this.proposal || this.node('#ai-prompt').value) && !confirm('Clear this conversation, input, element comments and unapplied AI suggestion? The form and datasets stay unchanged.'))) return;
    const viewing = this.viewing; this.invalidate('Conversation cleared.'); this.observationAccess.reset(); this.sourceWorkspace?.resetConsent(); this.conversation.messages = []; this.node('#ai-prompt').value = ''; this.elementTags?.clear(false); this.referenceFiles?.clear(); if (viewing) await this.restoreUnapplied(); this.share(); this.update();
    this.node('.ai-conversation-scroll').scrollTop = 0;
  }
  snapshot() { return {open:Boolean(this.open),prompt:this.node('#ai-prompt').value || this.pendingMessage || '',alias:this.node('#ai-model').value,messages:this.conversation.snapshot(),references:this.elementTags?.snapshot() || []}; }
  restoreSnapshot(saved) {
    this.observationAccess.reset();
    this.sourceWorkspace?.resetConsent();
    this.conversation.restore(saved.messages || [],this.documentKey()); this.node('#ai-prompt').value = saved.prompt; this.restoreAlias(saved.alias);
    this.elementTags?.restoreSnapshot(saved.references || []);
    if (saved.parsed) this.conversation.add('assistant',saved.parsed.summary,'expired',{diff:saved.parsed.diff,documentKey:this.documentKey()});
    if (saved.open) this.show(); else { this.share(); this.update(); }
    this.message('Recovered conversation. Old suggestions are expired; send again before Preview or Apply.');
  }
  static validateSnapshot(saved) { if (saved.open === undefined && !saved.messages) saved.open = false; if (typeof saved.prompt !== 'string' || saved.prompt.length > 4000 || typeof saved.open !== 'boolean') throw fail('INVALID_CHAT_RECOVERY'); if (saved.messages) cleanMessages(saved.messages); AIElementTags.validateSnapshot(saved.references || []); }
  update() {
    document.querySelector('#ai-preview-banner').hidden = !this.viewing;
    document.querySelector('[data-ai-toggle]').setAttribute('aria-expanded',String(Boolean(this.open)));
    this.elementTags?.setBusy(Boolean(this.busy || this.applying || this.restoring)); this.referenceFiles?.setBusy(Boolean(this.busy || this.applying || this.restoring));
    this.updateVersionHistory?.();
    for (const node of this.root.querySelectorAll('#ai-prompt,#ai-model,#ai-scope,#ai-agent,[data-ai=models],[data-ai-send],[data-prompt]')) node.disabled = Boolean(this.busy || this.applying || this.restoring || this.referenceFiles?.reading);
    this.referenceFiles?.capabilityChanged(); if (this.referenceFiles?.imageBlocked()) this.node('[data-ai-send]').disabled=true;
    this.sourceWorkspace?.update();
    this.node('[data-ai=cancel]').hidden = !this.busy || Boolean(this.applying); this.node('[data-ai-send]').hidden = Boolean(this.busy);
    for (const node of this.root.querySelectorAll('[data-ai=close],[data-ai=clear]')) node.disabled = Boolean(this.applying);
    this.showSendReason(); renderConversation(this);
  }
  // The line under the message box: who receives the request, or why Send is off when nothing else on screen says so
  // (files still being read, image support not confirmed). The reason replaces the notice while it applies.
  showSendReason() {
    const files = this.referenceFiles, node = this.node('[data-ai-send-reason]');
    const source = this.sourceWorkspace;
    const reason = source?.closing || source?.cleanupFailed ? source.notice() : files?.reading ? 'Reading references… Send unlocks when they are ready.' : files?.imageBlocked() ? 'Send is off: image support is not confirmed for this model. Use Check image support, or remove the image.' : '';
    node.textContent = reason || `${RECIPIENT_NOTICE}.`; node.dataset.kind = reason ? 'reason' : 'notice';
    const consent = this.node('[data-ai-consent-state]');
    consent.textContent = `${this.observationAccess?.notice({compact:true}) || ''} ${source?.notice() || ''}`.trim();
  }
}
