import { fail } from './ai-edits.js';

// Effect profiles (docs/STUDIO_V3_CODING_AGENT_CONTRACTS.md). A grant is built by the host from host state when a run
// starts and is frozen. No tool argument, model text, reference text or classifier output can add an effect to it.
// `read` and `memory` are always available; `draft` edits the private copy, `proposal` hands it to the person's
// Preview/Apply, `answer` completes a run with text only, `stop` ends it. Nothing here can commit or persist.
export const EFFECT_PROFILES = Object.freeze({
  'read-only':Object.freeze({available:true,effects:Object.freeze(['read','memory','answer','stop'])}),
  design:Object.freeze({available:true,effects:Object.freeze(['read','memory','answer','draft','proposal','stop'])}),
  // Declared so a request for them fails with a specific code instead of silently widening a profile.
  data:Object.freeze({available:false,effects:Object.freeze([]),planned:'CA-04/CA-06'}),
  coding:Object.freeze({available:false,effects:Object.freeze([]),planned:'CA-07'})
});

export function createGrant(profile,{scope = {mode:'whole'}} = {}) {
  const entry = Object.hasOwn(EFFECT_PROFILES,profile) ? EFFECT_PROFILES[profile] : null;
  if (!entry) throw fail('GRANT_PROFILE_UNKNOWN');
  if (!entry.available) throw fail('GRANT_PROFILE_UNAVAILABLE');
  return Object.freeze({profile,effects:entry.effects,scope:Object.freeze(structuredClone(scope))});
}
export const allows = (grant,effect) => grant.effects.includes(effect);
export function assertEffect(grant,definition) {
  if (!allows(grant,definition.effect)) throw fail('GRANT_DENIED');
}
export const grantedDefinitions = (grant,definitions) => definitions.filter(definition=>allows(grant,definition.effect));
// A request the host classified as a question gets the narrower grant; the classifier can only narrow, never widen.
export const profileFor = ({question}) => question ? 'read-only' : 'design';
