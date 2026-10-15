import { pairSourceRunner, SOURCE_RUNNER_URL } from './source-workspace-client.js';
import { authorizeSourceWorkspace } from './source-workspace-run.js';
import { sourceFailure } from './source-workspace-errors.js';
import { agentEnabled } from './agent-preference.js';
import { errorMessage } from './ai-messages.js';

export class AISourceWorkspace {
  constructor(panel) {
    this.panel = panel; this.connection = null; this.active = null; this.closing = null; this.cleanupFailed = false;
    const setup = document.createElement('details'); setup.className = 'ai-source-setup';
    setup.innerHTML = `<summary>Isolated source workspace · advanced</summary><div class="ai-source-controls"><p>A locally started Docker companion runs fictional Node source. No active dataset is uploaded. Your browser may ask for local-network access.</p><a href="${SOURCE_RUNNER_URL}/pair" target="_blank" rel="noopener noreferrer">Open local pairing page</a><label for="ai-source-code">One-use pairing code<input id="ai-source-code" type="password" maxlength="128" autocomplete="off" spellcheck="false"></label><button type="button" data-source-pair>Pair local companion</button><button type="button" data-source-disconnect disabled>Disconnect and revoke</button><p data-source-status role="status">Not paired. Ordinary browser-first form editing needs no companion.</p></div>`;
    panel.node('.ai-settings-body').append(setup); this.setup = setup;
    const disclosure = document.createElement('div'); disclosure.className = 'ai-source-consent'; disclosure.hidden = true;
    disclosure.innerHTML = '<label class="hint"><input id="ai-source-enabled" type="checkbox">Use isolated source for one request. I confirm all source/output is fictional and authorize sharing it with Demo Gateway and the selected model. This does not authorize current business values or real records.</label>';
    panel.node('.ai-sharing').append(disclosure); this.disclosure = disclosure;
    this.code = setup.querySelector('input[type="password"]'); this.consent = disclosure.querySelector('input'); this.status = setup.querySelector('[data-source-status]');
    setup.querySelector('[data-source-pair]').addEventListener('click',()=>void this.pair());
    setup.querySelector('[data-source-disconnect]').addEventListener('click',()=>void this.disconnect());
    this.code.addEventListener('keydown',event=> { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); void this.pair(); } });
    this.consent.addEventListener('change',()=> { panel.share(); panel.update(); });
    window.addEventListener('pagehide',()=> { void this.cancelActive(); });
  }
  resetConsent() { this.consent.checked = false; }
  async pair() {
    if (this.pairing || this.panel.busy || this.closing || this.cleanupFailed || this.connection?.available) return;
    this.pairing = true; this.status.textContent = 'Pairing with the locally started companion…'; this.update();
    try {
      this.connection = await pairSourceRunner(this.code.value.trim()); this.resetConsent();
      this.status.textContent = 'Paired locally. Source access remains off until one-request fictional-source permission is checked.';
    } catch (error) { this.status.textContent = errorMessage(error); }
    finally { this.code.value = ''; this.pairing = false; this.panel.update(); }
  }
  consume(baseProfile) {
    if (!this.consent.checked) return undefined;
    this.resetConsent();
    if (this.closing || this.cleanupFailed || !agentEnabled() || this.panel.agentUnavailable) throw sourceFailure('ENVIRONMENT_UNSUPPORTED');
    const run = authorizeSourceWorkspace(this.connection,{fictionalSource:true,readOnly:baseProfile === 'read-only'});
    this.active = run; this.panel.update(); return run;
  }
  async release(run) {
    if (!run) return true;
    if (this.closing) return this.closing;
    const pending = run.close().then(()=> {
      this.status.textContent = 'Isolated workspace closed. Live form changes still require Preview and Apply.'; return true;
    },()=> {
      this.cleanupFailed = true;
      this.status.textContent = 'Local cleanup was not acknowledged. No new source work is authorized; disconnect/reconcile the companion.';
      this.panel.message(this.status.textContent); return false;
    }).finally(()=> {
      if (this.active === run) this.active = null;
      if (this.closing === pending) this.closing = null;
      this.panel.update();
    });
    this.closing = pending; this.panel.update(); return pending;
  }
  cancelActive() { return this.active ? this.release(this.active) : this.closing || Promise.resolve(true); }
  async disconnect() {
    if (this.disconnecting || this.pairing || this.panel.applying) return;
    this.disconnecting = true; this.resetConsent(); this.update();
    try {
      await this.cancelActive();
      await this.connection?.revoke();
      this.connection = null; this.cleanupFailed = false;
      this.status.textContent = 'Pairing revoked and owned workspaces closed. Ordinary form editing remains available.';
    } catch { this.cleanupFailed = true; this.status.textContent = 'Revocation/cleanup was not acknowledged. Reconcile the locally started companion before source use.'; }
    finally { this.disconnecting = false; this.panel.update(); }
  }
  notice() {
    if (this.closing) return 'Waiting for isolated workspace cleanup; Send is paused.';
    if (this.cleanupFailed) return 'Local source cleanup is unconfirmed. Reconcile/disconnect before another request.';
    return this.consent.checked ? 'Fictional source/output sharing is enabled for the next request only.' : '';
  }
  update() {
    const busy = Boolean(this.panel.busy || this.panel.applying || this.panel.restoring || this.pairing || this.disconnecting || this.closing);
    const paired = Boolean(this.connection?.available);
    this.disclosure.hidden = !this.connection;
    this.consent.disabled = busy || !paired || this.cleanupFailed || !agentEnabled() || this.panel.agentUnavailable;
    this.code.disabled = busy || paired || this.cleanupFailed;
    this.setup.querySelector('[data-source-pair]').disabled = busy || paired || this.cleanupFailed;
    this.setup.querySelector('[data-source-disconnect]').disabled = Boolean(this.panel.applying || this.disconnecting || this.pairing || !this.connection);
    if (this.closing || this.cleanupFailed) this.panel.node('[data-ai-send]').disabled = true;
  }
}
