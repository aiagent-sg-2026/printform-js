import { stableStringify, sha256 } from '../studio-v2/core/json.js';
import { fail } from './ai-edits.js';

// This slice admits numeric diagnostics only. Value and pixel authorization belong to their later projections.
export const DIAGNOSTIC_POLICY = Object.freeze({values:false,pixels:false,projection:'numeric-print-diagnostics/v1'});
const canonical = value => stableStringify(value,0);
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

// Run-local custody: callers receive immutable metadata; content and freshness remain host-owned.
// readState is trusted host state, never tool arguments. A generation prevents edit/undo from reviving a receipt.
export function createObservationRecords({readState,assertCurrent = () => {},now = () => Date.now()}) {
  let latest = null, captured = false;
  function snapshot() {
    assertCurrent();
    const {runId,releaseIdentity,documentId,baseRevision,candidateVersion,project,scenario,policy = DIAGNOSTIC_POLICY,kind = 'print-diagnostics'} = readState();
    if (!runId || !releaseIdentity?.release || !documentId || !Number.isSafeInteger(baseRevision) || baseRevision < 0 ||
        !Number.isSafeInteger(candidateVersion) || candidateVersion < 0 || project?.manifest?.documentId !== documentId || !scenario?.id) throw fail('EVIDENCE_STALE');
    const binding = {runId,releaseIdentity,documentId,baseRevision,candidateVersion};
    const sources = {binding:canonical(binding),candidate:canonical(project),scenario:canonical(scenario),policy:canonical(policy)};
    return {binding:JSON.parse(sources.binding),sources,key:canonical({kind,...sources}),kind,project:JSON.parse(sources.candidate)};
  }
  function assertSnapshot(expected) {
    try { if (snapshot().key !== expected.key) throw fail('EVIDENCE_STALE'); }
    catch (error) { latest = null; throw error; }
  }
  return {
    invalidate() { latest = null; },
    async capture(read,{evidenceRefs = []} = {}) {
      latest = null;
      const before = snapshot(), content = freeze(structuredClone(await read(before.project)));
      assertSnapshot(before);
      const [candidateDigest,scenarioDigest,policyDigest,contentDigest] = await Promise.all([
        sha256(before.sources.candidate),sha256(before.sources.scenario),sha256(before.sources.policy),sha256(canonical(content))
      ]);
      assertSnapshot(before);
      const receipt = freeze({id:`observation-${crypto.randomUUID()}`,...before.binding,candidateDigest,scenarioDigest,
        kind:before.kind,capturedAt:now(),policyDigest,contentDigest,evidenceRefs:[...evidenceRefs]});
      latest = {receipt,content,snapshot:before};
      captured = true;
      return {receipt,content};
    },
    current() {
      if (!latest) { if (captured) throw fail('EVIDENCE_STALE'); return null; }
      assertSnapshot(latest.snapshot);
      return {receipt:latest.receipt,content:latest.content};
    },
    requireLatest(id) {
      if (!latest || latest.receipt.id !== id) throw fail('EVIDENCE_STALE');
      assertSnapshot(latest.snapshot);
      return {receipt:latest.receipt,content:latest.content};
    }
  };
}
