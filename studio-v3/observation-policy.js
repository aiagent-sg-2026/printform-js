import { stableStringify, sha256 } from '../studio-v2/core/json.js';
import { fail } from './ai-edits.js';
import { DEMO_CONFIG } from './ai-gateway-config.js';
import { BLOCKS, fieldKind } from './design-authoring.js';

export const canonicalObservation = value => stableStringify(value ?? null,0);
export const OBSERVATION_AUTHORIZATION_MS = DEMO_CONFIG.agent.maxRunMs;
const grants = new WeakMap();
export const revokeObservationAuthorization = grant => grants.delete(grant);
export const allowsObservationValues = (policy,documentId) => policy?.classification === 'synthetic' && policy.allowProviderDocumentContext === true &&
  policy.documentId === documentId && Boolean(policy.contextId) && Number.isSafeInteger(policy.generation) && policy.generation > 0;
const sourcesOf = ({project,baseRevision,runId,dataPolicy,selectedTargets = []}) => ({
  documentId:project?.manifest?.documentId,baseRevision,runId,
  content:canonicalObservation(project),policy:canonicalObservation(dataPolicy),targets:canonicalObservation(selectedTargets)
});
// Only the host can mint this object. A model-supplied lookalike has no entry in the custody map.
export async function authorizeObservation(state,{text = false,pixels = false,now = () => Date.now()} = {}) {
  const sources = sourcesOf(state);
  const values = allowsObservationValues(state.dataPolicy,sources.documentId);
  if (!sources.documentId || !sources.runId || !Number.isSafeInteger(sources.baseRevision) || sources.baseRevision < 0) throw fail('OBSERVATION_AUTHORIZATION_STALE');
  const [contentDigest,hostPolicyDigest] = await Promise.all([sha256(sources.content),sha256(sources.policy)]);
  const grant = Object.freeze({id:crypto.randomUUID(),expiresAt:now()+OBSERVATION_AUTHORIZATION_MS,documentId:sources.documentId,baseRevision:sources.baseRevision,
    runId:sources.runId,contentDigest,hostPolicyDigest,text,values,pixels});
  grants.set(grant,{sources,now}); return grant;
}
// Pixel consent attests fictional content for this run; it never classifies business values or approves assets.
export function pixelDisclosure(grant,state,candidateVersion = 0) {
  if (!grant) throw fail('OBSERVATION_PIXELS_REQUIRED');
  assertObservationAuthorization(grant,state,{candidateVersion});
  if (grant.pixels !== true || grant.text !== true) throw fail('OBSERVATION_PIXELS_REQUIRED');
  const design = state.project.manifest.studioV3;
  const fields = BLOCKS.flatMap(id=>id === 'items' ? design.columns || [] : design[id] || []);
  if (state.dataPolicy?.classification === 'real' || design.assets?.length || design.logo || fields.some(f=>fieldKind(f) === 'image') ||
      /data:image\/|blob:|[A-Za-z0-9+/]{256,}={0,2}/i.test(canonicalObservation(state.project))) throw fail('OBSERVATION_PIXELS_SENSITIVE');
  if (state.dataPolicy?.allowPixelEvidence === false) throw fail('OBSERVATION_PIXELS_POLICY_DENIED');
  // Check the whole document, including disabled sections: a crop cannot turn denied values into permitted pixels.
  if (fields.some(f=>fieldKind(f) === 'bound') && !allowsObservationValues(state.dataPolicy,state.project.manifest.documentId)) throw fail('OBSERVATION_PIXELS_VALUES_DENIED');
  return {projection:'fictional-page-pixels/v1',authorization:grant,host:JSON.parse(canonicalObservation(state.dataPolicy))};
}
export function assertObservationAuthorization(grant,state,{candidateVersion = 0} = {}) {
  const held = grants.get(grant);
  const expired = held && held.now() >= grant.expiresAt, changed = held && canonicalObservation(held.sources) !== canonicalObservation(sourcesOf(state));
  // An observed host change revokes the grant even if someone later restores identical bytes.
  // Draft generations independently reject semantic reuse while allowing numeric-only recovery.
  if (expired || (changed && candidateVersion === 0)) grants.delete(grant);
  if (!held || expired || changed || candidateVersion !== 0) throw fail('OBSERVATION_AUTHORIZATION_STALE');
}
export function observationDisclosure(grant,state,candidateVersion) {
  assertObservationAuthorization(grant,state,{candidateVersion});
  if (!grant.text && !grant.values) throw fail('OBSERVATION_DISCLOSURE_REQUIRED');
  return {projection:'semantic-context/v1',authorization:grant,host:JSON.parse(canonicalObservation(state.dataPolicy))};
}
