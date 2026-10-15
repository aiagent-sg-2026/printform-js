import { keys, check, text, pathName, integer, DIGEST, sha, changesBetween } from './policy.mjs';

function publicEntry({ content, ...entry }) { return entry; }
function boundedText(value, maxBytes) {
  const buffer = Buffer.from(value); if (buffer.length <= maxBytes) return { content: value, truncated: false };
  let end = maxBytes;
  while (end > 0 && (buffer[end] & 0xc0) === 0x80) end--;
  return { content: buffer.subarray(0, end).toString('utf8'), truncated: true };
}
export function list(tree, args) {
  keys(args, ['prefix', 'cursor', 'limit']); const prefix = pathName(args.prefix ?? '', true);
  const limit = integer(args.limit ?? 50, 1, 128); const offset = integer(args.cursor === undefined ? 0 : Number(args.cursor), 0, 256);
  check(args.cursor === undefined || /^(0|[1-9][0-9]*)$/.test(args.cursor));
  const entries = tree.entries.filter((entry) => !prefix || entry.path === prefix || entry.path.startsWith(`${prefix}/`));
  return { entries: entries.slice(offset, offset + limit).map(publicEntry), nextCursor: entries.length > offset + limit ? String(offset + limit) : null };
}
export function read(tree, args, limits) {
  keys(args, ['path', 'offset', 'maxChars', 'expectedDigest'], ['path']); pathName(args.path);
  const entry = tree.entries.find((candidate) => candidate.path === args.path); check(entry?.type === 'file', 'FILE_NOT_FOUND', 404);
  if (args.expectedDigest !== undefined) check(args.expectedDigest === entry.digest, 'STALE_FILE', 409);
  const offset = integer(args.offset ?? 0, 0, entry.content.length), maxChars = integer(args.maxChars ?? Math.min(6000, limits.outputBytes), 1, limits.outputBytes);
  check(offset === 0 || !/[\uDC00-\uDFFF]/.test(entry.content[offset] ?? ''), 'INVALID_OFFSET');
  let end = Math.min(offset + maxChars, entry.content.length);
  if (end < entry.content.length && /[\uDC00-\uDFFF]/.test(entry.content[end])) end--;
  if (end === offset && end < entry.content.length) end = Math.min(end + 2, entry.content.length);
  const result = boundedText(entry.content.slice(offset, end), limits.outputBytes);
  return { path: entry.path, digest: entry.digest, bytes: entry.bytes, offset, ...result,
    truncated: result.truncated || end < entry.content.length, nextOffset: offset + result.content.length };
}
export function validatePatch(args, limits, write = false) {
  if (write) keys(args, ['path', 'expectedDigest', 'content'], ['path', 'expectedDigest', 'content']);
  else keys(args, ['changes'], ['changes']);
  const changes = write ? [args] : args.changes;
  check(Array.isArray(changes) && changes.length > 0 && changes.length <= limits.files);
  const paths = new Set();
  for (const change of changes) {
    keys(change, ['path', 'expectedDigest', 'content'], ['path', 'expectedDigest', 'content']); pathName(change.path);
    check(!paths.has(change.path), 'DUPLICATE_PATH'); paths.add(change.path);
    check(change.expectedDigest === null || (typeof change.expectedDigest === 'string' && DIGEST.test(change.expectedDigest)));
    if (change.content !== null) {
      check(typeof change.content === 'string'); check(Buffer.byteLength(change.content) <= limits.fileBytes, 'SOURCE_QUOTA');
      text(change.content, limits.fileBytes, true);
    } else check(!write);
  }
  return changes;
}
export function diff(base, tree, args, limits) {
  keys(args, []); const changes = changesBetween(base.entries, tree.entries);
  const entries = changes.map((change) => ({ ...change,
    before: base.entries.find((entry) => entry.path === change.path)?.content ?? null,
    after: tree.entries.find((entry) => entry.path === change.path)?.content ?? null }));
  check(Buffer.byteLength(JSON.stringify(entries)) <= limits.outputBytes, 'DIFF_TOO_LARGE', 413);
  return { changes: entries, baseDigest: base.treeDigest, treeDigest: tree.treeDigest, truncated: false };
}
export function artifact(workspace, args, limits, imageDigest) {
  keys(args, ['callId', 'path'], ['callId', 'path']); pathName(args.path);
  const call = workspace.calls.get(args.callId);
  check(call && call.operation === 'run' && call.status === 'completed' && !call.error && call.exitCode === 0, 'BUILD_NOT_SUCCESSFUL', 409);
  check(call.afterRevision === workspace.revision && call.afterDigest === workspace.tree.treeDigest, 'STALE_ARTIFACT', 409);
  check(args.path.endsWith('.json'), 'ARTIFACT_TYPE');
  const entry = workspace.tree.entries.find((candidate) => candidate.path === args.path);
  check(entry?.type === 'file', 'FILE_NOT_FOUND', 404); check(entry.bytes <= limits.artifactBytes, 'ARTIFACT_TOO_LARGE', 413);
  let json; try { json = JSON.parse(entry.content.replace(/^\uFEFF/, '')); } catch { check(false, 'ARTIFACT_JSON'); }
  keys(json, ['format', 'version', 'summary', 'operations'], ['format', 'version', 'summary', 'operations']);
  check(json.format === 'printform-operation-artifact' && json.version === 1 && Array.isArray(json.operations) && json.operations.length > 0 && json.operations.length <= 64, 'ARTIFACT_SCHEMA');
  text(json.summary, 2000); check(json.operations.every((operation) => operation !== null && typeof operation === 'object' && !Array.isArray(operation)), 'ARTIFACT_SCHEMA');
  return { id: `artifact-${sha(JSON.stringify([workspace.id,call.callId,args.path,workspace.revision,workspace.tree.treeDigest,entry.digest,imageDigest]))}`, mediaType: 'application/json', bytes: entry.bytes, contentDigest: sha(entry.content), content: entry.content,
    workspaceId: workspace.id, sourceRevision: workspace.revision, buildCallId: call.callId, treeDigest: workspace.tree.treeDigest,
    imageDigest, releaseIdentity: workspace.context.releaseIdentity, documentId: workspace.context.documentId,
    baseRevision: workspace.context.baseRevision, runId: workspace.context.runId };
}
