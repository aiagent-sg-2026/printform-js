import { authorizeObservation, canonicalObservation, allowsObservationValues, OBSERVATION_AUTHORIZATION_MS, revokeObservationAuthorization } from './observation-policy.js';
import { fail } from './ai-edits.js';

// The switch is session-local, single-use and never recovered from a saved conversation or project.
export class AIObservationAuthorization {
  constructor(panel) {
    this.panel = panel; this.input = panel.node('#ai-observation-text'); this.pixels = panel.node('#ai-observation-pixels');
    this.reset();
    for (const input of [this.input,this.pixels].filter(Boolean)) input.addEventListener('change',()=> { this.armed = this.input?.checked || this.pixels?.checked ? this.key() : null; this.armedAt = Date.now(); panel.update(); });
  }
  end() { this.epoch = (this.epoch || 0)+1; revokeObservationAuthorization(this.active); this.active = null; }
  reset() { this.end(); this.armed = null; for (const input of [this.input,this.pixels].filter(Boolean)) input.checked = false; }
  state(runId) {
    const bus = this.panel.getBus();
    return {project:bus?.project,baseRevision:bus?.revision,runId,dataPolicy:bus?.dataPolicy,
      selectedTargets:[this.panel.getSelection(),...(this.panel.scope().ids || [])]};
  }
  key() { return canonicalObservation(this.state('pending')); }
  refresh() {
    if (this.armed && (Date.now()-this.armedAt >= OBSERVATION_AUTHORIZATION_MS || this.armed !== this.key())) { this.armed = null; for (const input of [this.input,this.pixels].filter(Boolean)) input.checked = false; }
    for (const input of [this.input,this.pixels].filter(Boolean)) input.disabled = Boolean(this.panel.busy || this.panel.applying || this.panel.restoring);
  }
  async consume(runId) {
    const text = Boolean(this.input?.checked);
    const pixels = Boolean(this.pixels?.checked);
    if ((text || pixels) && (Date.now()-this.armedAt >= OBSERVATION_AUTHORIZATION_MS || this.armed !== this.key())) throw fail('OBSERVATION_AUTHORIZATION_STALE');
    const state = this.state(runId), expected = canonicalObservation(state);
    this.end(); const epoch = this.epoch;
    this.armed = null; for (const input of [this.input,this.pixels].filter(Boolean)) input.checked = false;
    const grant = await authorizeObservation(state,{text,pixels});
    if (epoch !== this.epoch || canonicalObservation(this.state(runId)) !== expected) {
      revokeObservationAuthorization(grant); throw fail('OBSERVATION_AUTHORIZATION_STALE');
    }
    this.active = grant; return grant;
  }
  notice({compact = false} = {}) {
    this.refresh();
    const state = this.state();
    if (compact) {
      const text = this.panel.busy ? this.active?.text : this.input?.checked, pixels = this.panel.busy ? this.active?.pixels : this.pixels?.checked;
      return `Text/bindings ${text ? 'authorized' : 'off'} · ${allowsObservationValues(state.dataPolicy,state.project?.manifest?.documentId) ? 'Synthetic values allowed' : 'Bound values blocked'} · Pixel consent ${pixels ? 'on' : 'off'}; assets blocked.`;
    }
    return `${(this.panel.busy ? this.active?.text : this.input?.checked) ? 'Current labels, static text and assigned binding paths authorized for one run.' : 'Form text and assigned binding paths are not authorized.'} ${allowsObservationValues(state.dataPolicy,state.project?.manifest?.documentId) ? 'Synthetic bound values allowed by host policy.' : 'Bound values blocked.'} ${(this.panel.busy ? this.active?.pixels : this.pixels?.checked) ? 'Fictional page pixels authorized for one run; denied values and all embedded assets remain blocked.' : 'Page and embedded asset pixels blocked.'}`;
  }
}
