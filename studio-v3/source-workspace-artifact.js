import { sourceFailure as fail } from './source-workspace-errors.js';
import { MAX_AUTHORING_OPERATIONS } from './ai-authoring-contract.js';
import { parseLosslessRecords } from './structured-import-parser.js';

const rejected = () => { throw fail('ARTIFACT_REJECTED'); };
const sameIdentity = (actual,expected) => actual && Object.keys(actual).length === 4 &&
  ['release','contractHash','knowledgeHash','packageHash'].every(key=>Object.hasOwn(actual,key) && actual[key] === expected[key]);

// This verifies provenance and closed JSON, not business intent or a test verdict.
// draft.apply remains the sole operation/scope/financial-binding validator.
export async function verifySourceArtifact(artifact,expected) {
  if (!artifact || typeof artifact !== 'object' || artifact.mediaType !== 'application/json' || typeof artifact.content !== 'string') rejected();
  for (const key of ['workspaceId','sourceRevision','buildCallId','treeDigest','imageDigest','documentId','baseRevision','runId']) if (artifact[key] !== expected[key]) rejected();
  if (!sameIdentity(artifact.releaseIdentity,expected.releaseIdentity)) rejected();
  const bytes = new TextEncoder().encode(artifact.content);
  if (bytes.byteLength > 64000 || artifact.bytes !== bytes.byteLength || !/^[a-f0-9]{64}$/.test(artifact.contentDigest || '')) rejected();
  if (!globalThis.crypto?.subtle) throw fail('ENVIRONMENT_UNSUPPORTED');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  if (digest !== artifact.contentDigest) rejected();
  let value;
  try {
    const source = artifact.content.replace(/^\uFEFF/, '');
    // Validate decoded keys and bounded structure before native parsing erases ambiguity.
    // Keep native number types for the existing typed draft validator.
    parseLosslessRecords(source);
    value = JSON.parse(source);
  }
  catch { rejected(); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key=>!['format','version','summary','operations'].includes(key)) ||
    value.format !== 'printform-operation-artifact' || value.version !== 1 || typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 500 ||
    !Array.isArray(value.operations) || !value.operations.length || value.operations.length > MAX_AUTHORING_OPERATIONS) rejected();
  return value;
}
