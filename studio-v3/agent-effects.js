import { fail } from './ai-edits.js';
import { isSourceAuthorization } from './source-workspace-run.js';

// Effect profiles (docs/STUDIO_V3_CODING_AGENT_CONTRACTS.md). A grant is built by the host from host state when a run
// starts and is frozen. No tool argument, model text, reference text or classifier output can add an effect to it.
// `read` and `memory` are always available; `draft` edits the private copy, `proposal` hands it to the host:
// checked ordinary design edits may auto-apply; other/source work needs human Preview/Apply. `answer` returns text; `stop` ends it. These effects never commit or persist.
export const EFFECT_PROFILES = Object.freeze({
  'read-only':Object.freeze({available:true,effects:Object.freeze(['read','memory','answer','stop'])}),
  design:Object.freeze({available:true,effects:Object.freeze(['read','memory','answer','draft','proposal','stop'])}),
  data:Object.freeze({available:false,effects:Object.freeze([]),planned:'CA-04/CA-06'}),
  coding:Object.freeze({available:true,effects:Object.freeze(['read','memory','answer','draft','proposal','stop','workspace-read','workspace'])}),
  'coding-read-only':Object.freeze({available:true,effects:Object.freeze(['read','memory','answer','stop','workspace-read'])})
});

export function createGrant(profile,{scope = {mode:'whole'},workspace,intent} = {}) {
  const entry = Object.hasOwn(EFFECT_PROFILES,profile) ? EFFECT_PROFILES[profile] : null;
  if (!entry) throw fail('GRANT_PROFILE_UNKNOWN');
  if (!entry.available) throw fail('GRANT_PROFILE_UNAVAILABLE');
  if (profile.startsWith('coding') && (!isSourceAuthorization(workspace) || workspace.profile !== profile)) throw fail('WORKSPACE_DISCLOSURE_REQUIRED');
  // A confirmed draft may finish only with an inspected proposal or a block. This
  // subtracts one effect without changing profile identity or workspace authority.
  const effects = intent?.kind === 'draft' && entry.effects.includes('draft')
    ? Object.freeze(entry.effects.filter(effect=>effect !== 'answer')) : entry.effects;
  return Object.freeze({profile,effects,scope:Object.freeze(structuredClone(scope))});
}
export const allows = (grant,effect) => grant.effects.includes(effect);
export function assertEffect(grant,definition) {
  if (!allows(grant,definition.effect)) throw fail('GRANT_DENIED');
}
export const grantedDefinitions = (grant,definitions) => definitions.filter(definition=>allows(grant,definition.effect));
// A request the host classified as a question gets the narrower grant; the classifier can only narrow, never widen.
export const profileFor = ({question}) => question ? 'read-only' : 'design';
