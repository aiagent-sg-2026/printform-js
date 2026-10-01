import { createDemoTransport } from './ai-demo-transport.js';
import { shareLayout, assertProposalCurrent, fail } from './ai-edits.js';
import { inspectProject } from './validation.js';
import { runLayoutHarness } from './ai-harness.js';

const MESSAGES = {
  DEMO_SESSION_FORBIDDEN:'Demo session rejected (HTTP 403) for project github-pages and this browser Origin. Request stopped. The gateway owner must check the existing project and Demo access policy.',
  DEMO_SESSION_UNAVAILABLE:'Demo session unavailable. Check connection or existing origin registration.',
  DEMO_SESSION_EXPIRED:'Demo session expired after one refresh. Send again to retry.',
  DEMO_MODEL_UNAVAILABLE:'The selected Demo alias is unavailable. Discover models again.',
  DEMO_RATE_LIMIT:'Demo request limit reached. Try again later.',
  DEMO_REQUEST_FAILED:'Demo request failed. Check gateway availability and Chat Completions capability.',
  MALFORMED_PROPOSAL:'The model did not return a complete supported proposal. Nothing changed.',
  UNSAFE_PROPOSAL:'The model proposed an unsupported or unsafe edit. Nothing changed.',
  COLUMN_WIDTH_LIMIT:'Proposed column widths exceed 100%. Nothing changed.',
  NO_CHANGES:'The suggestion contains no layout changes.',
  STALE_PROPOSAL:'The form changed. Send a new request before applying.',
  AI_TIMEOUT:'The request timed out. Nothing changed.',
  AI_RUN_FAILED:'Pi could not complete a validated proposal. Nothing changed.'
};
export class AIPanel {
  constructor({bus,guard,preview,restore,commit,sync,transport = createDemoTransport()}) {
    Object.assign(this,{getBus:bus,guard,renderPreview:preview,restore,commit,sync,transport});
    this.root = document.querySelector('#ai-panel'); this.viewing = false; this.proposal = null; this.generation = 0;
    this.root.addEventListener('submit',event=> { event.preventDefault(); void this.send(); });
    this.root.addEventListener('input',event=> { if (event.target.id === 'ai-prompt' || event.target.id === 'ai-model') this.share(); });
    this.root.addEventListener('click',event=> {
      const action = event.target.closest('[data-ai]')?.dataset.ai;
      if (action === 'close') this.close();
      if (action === 'cancel') this.cancel();
      if (action === 'discard') { this.invalidate('Proposal discarded.'); void this.restore(); }
      if (action === 'preview') void this.guard(()=>this.preview()).catch(error=>this.error(error));
      if (action === 'apply') void this.guard(()=>this.apply()).catch(error=>this.error(error));
      if (action === 'models') void this.discover();
    });
    document.querySelector('[data-ai-toggle]').addEventListener('click',()=>this.open ? this.close() : this.show());
    document.addEventListener('keydown',event=> {
      if (!this.open || document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') { event.preventDefault(); if (!this.applying) this.close(); }
      if (event.key === 'Tab' && innerWidth <= 900) {
        const nodes = [...this.root.querySelectorAll('button,textarea,select,input,summary')].filter(n=>!n.disabled && n.getClientRects().length);
        if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
      }
    });
    this.root.querySelector('[data-ai-origin]').textContent = `${location.origin} · project github-pages`;
    this.update();
  }
  node(selector) { return this.root.querySelector(selector); }
  message(text) { this.node('[data-ai-status]').textContent = text; }
  error(error) { this.message(error.name === 'AbortError' ? 'Cancelled. Nothing changed.' : MESSAGES[error.code] || 'AI request failed. Nothing changed.'); }
  request() { return JSON.stringify({request:this.node('#ai-prompt').value.trim(),layout:shareLayout(this.getBus().project)},null,2); }
  share() { this.node('#ai-share').textContent = this.request(); this.node('#ai-consent').checked = false; }
  show() {
    this.open = true; this.root.hidden = false; document.body.classList.add('ai-open');
    this.share(); this.update(); this.node('#ai-prompt').focus(); this.sync();
  }
  suspend() { this.open = false; this.root.hidden = true; document.body.classList.remove('ai-open'); this.update(); this.sync(); }
  close() {
    if (this.applying) return;
    const viewing = this.viewing; this.invalidate('AI editor closed.'); if (viewing) void this.restore(); this.open = false; this.root.hidden = true; document.body.classList.remove('ai-open');
    this.update(); document.querySelector('[data-ai-toggle]').focus(); this.sync();
  }
  cancel(message = 'Cancelled. Nothing changed.') {
    ++this.generation; this.controller?.abort(); this.transport.clear(); this.controller = null;
    clearTimeout(this.timer); this.busy = false; this.message(message); this.update();
  }
  invalidate(message = 'Form changed. Send again for the current revision.') {
    const active = this.busy || this.proposal || this.viewing;
    this.cancel(active ? message : 'Ready. Review what will be shared before sending.');
    this.proposal = null; this.viewing = false; this.checked = false;
    this.node('[data-ai-proposal]').hidden = true; this.share(); this.update();
  }
  begin() {
    this.cancel('Connecting to Demo gateway…'); this.busy = true;
    const id = this.generation, controller = new AbortController(); this.controller = controller;
    this.timer = setTimeout(()=> { this.timedOut = id; controller.abort(); },60000);
    this.update(); return {id,signal:controller.signal};
  }
  async discover() {
    if (this.applying) return;
    const {id,signal} = this.begin();
    try {
      const aliases = await this.transport.discover(signal);
      if (id !== this.generation) return;
      this.setModels(aliases); this.message(`Available Demo aliases: ${aliases.join(', ')}. No document sent.`);
    } catch (error) { if (id === this.generation) this.error(this.timedOut === id ? fail('AI_TIMEOUT') : error); }
    finally { if (id === this.generation) this.finish(); }
  }
  setModels(aliases) {
    const select = this.node('#ai-model');
    for (const option of select.options) option.disabled = !aliases.includes(option.value);
    if (!aliases.includes(select.value)) select.value = aliases[0];
  }
  finish() { clearTimeout(this.timer); this.controller = null; this.busy = false; this.update(); }
  async send() {
    if (this.busy || this.applying || !this.node('#ai-consent').checked || !this.node('#ai-prompt').value.trim()) return;
    const bus = this.getBus(), revision = bus.revision, project = structuredClone(bus.project), baseDesign = JSON.stringify(project.manifest.studioV3);
    const request = this.request(), alias = this.node('#ai-model').value;
    if (request.length > 12000) { this.message('Keep the request under 4,000 characters.'); return; }
    const {id,signal} = this.begin();
    this.proposal = null; this.checked = false; this.node('[data-ai-proposal]').hidden = true;
    try {
      if (this.viewing) { this.viewing = false; await this.restore(); }
      const aliases = await this.transport.discover(signal);
      if (!aliases.includes(alias)) throw fail('DEMO_MODEL_UNAVAILABLE');
      this.setModels(aliases);
      const result = await runLayoutHarness({transport:this.transport,alias,request,project,signal,onPhase:text=> { if (id === this.generation) this.message(`${alias} · ${text}`); }});
      if (id !== this.generation) return;
      assertProposalCurrent(this.getBus(),{bus,revision,baseDesign});
      this.proposal = {...result,bus,revision,baseDesign}; this.present();
      this.message(`${alias} · Proposal ready at r${revision}. Preview before Apply. Tokens: ${result.usage?.total ?? 'unavailable'}.`);
    } catch (error) { if (id === this.generation) this.error(this.timedOut === id ? fail('AI_TIMEOUT') : error); }
    finally { if (id === this.generation) { this.transport.clear(); this.node('#ai-consent').checked = false; this.finish(); this.sync(); } }
  }
  present() {
    this.node('[data-ai-proposal]').hidden = false;
    this.node('[data-ai-summary]').textContent = this.proposal.summary;
    const body = this.node('[data-ai-diff]'); body.replaceChildren();
    for (const diff of this.proposal.diff) {
      const row = document.createElement('tr');
      for (const value of [`${diff.target} · ${diff.property}`,diff.before,diff.after]) { const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell); }
      body.append(row);
    }
  }
  async preview() {
    const proposal = this.proposal; assertProposalCurrent(this.getBus(),proposal || {});
    this.viewing = true; this.checked = false; this.update(); this.sync();
    const report = await this.renderPreview(proposal.candidate);
    if (this.proposal !== proposal) return;
    assertProposalCurrent(this.getBus(),proposal);
    const quality = inspectProject(proposal.candidate,report); this.checked = quality.ready;
    this.message(quality.ready ? 'Unapplied AI preview · current browser layout passed. Review the pages, then Apply or Discard.' : 'Unapplied AI preview blocked by layout/data validation. Discard or request another suggestion.');
    this.update(); this.sync();
  }
  async apply() {
    const proposal = this.proposal; assertProposalCurrent(this.getBus(),proposal || {});
    if (!this.checked || this.busy) throw fail('AI_RUN_FAILED');
    const generation = this.generation; this.applying = true; this.busy = true; this.message('Applying reviewed suggestion…'); this.update();
    try { await this.commit(proposal,generation); this.message(`Applied ${proposal.alias} suggestion. Use Undo to restore the previous layout.`); }
    catch (error) { if (generation === this.generation) throw error; }
    finally { this.applying = false; if (generation === this.generation) this.busy = false; this.update(); }
  }
  update() {
    document.querySelector('[data-ai-toggle]').setAttribute('aria-expanded',String(Boolean(this.open)));
    for (const node of this.root.querySelectorAll('#ai-prompt,#ai-model,#ai-consent,[data-ai=models],[data-ai-send]')) node.disabled = Boolean(this.busy || this.applying);
    this.node('[data-ai=cancel]').hidden = !this.busy || Boolean(this.applying);
    for (const node of this.root.querySelectorAll('[data-ai=close],[data-ai=discard]')) node.disabled = Boolean(this.applying);
    this.node('[data-ai=preview]').disabled = !this.proposal || this.busy || this.applying;
    this.node('[data-ai=apply]').disabled = !this.checked || this.busy || this.applying;
  }
}
