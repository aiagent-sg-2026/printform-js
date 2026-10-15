import { initialize, patch, snapshot } from './tree.mjs';
import { check, keys, normalizeLimits, pathName, text, integer, safeError } from './policy.mjs';

async function search(args, limits) {
  keys(args, ['pattern', 'paths', 'literal', 'limit'], ['pattern']); text(args.pattern, 512);
  check(args.literal === undefined || typeof args.literal === 'boolean');
  check(args.paths === undefined || (Array.isArray(args.paths) && args.paths.length <= limits.files));
  for (const path of args.paths ?? []) pathName(path);
  const limit = integer(args.limit ?? 50, 1, 100); let expression;
  if (!args.literal) { try { expression = new RegExp(args.pattern, 'u'); } catch { check(false, 'INVALID_REGEX'); } }
  const tree = await snapshot(limits); const matches = []; let truncated = false, bytes = 0;
  for (const entry of tree.entries) {
    if (entry.type !== 'file' || (args.paths && !args.paths.includes(entry.path))) continue;
    const lines = entry.content.split('\n');
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!(args.literal ? line.includes(args.pattern) : expression.test(line))) continue;
      const buffer = Buffer.from(line); let end = Math.min(1000, buffer.length);
      while (end > 0 && end < buffer.length && (buffer[end] & 0xc0) === 0x80) end--;
      const result = { path: entry.path, line: index + 1, text: buffer.subarray(0, end).toString('utf8'), digest: entry.digest, truncated: end < buffer.length };
      bytes += Buffer.byteLength(JSON.stringify(result));
      if (matches.length >= limit || bytes > limits.outputBytes) { truncated = true; break; }
      matches.push(result);
    }
    if (truncated) break;
  }
  return { matches, truncated, treeDigest: tree.treeDigest };
}
const chunks = []; let inputBytes = 0;
try {
  for await (const chunk of process.stdin) { inputBytes += chunk.length; check(inputBytes <= 14000000, 'BODY_TOO_LARGE'); chunks.push(chunk); }
  const input = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  const request = JSON.parse(input); keys(request, ['operation', 'args', 'limits'], ['operation', 'args', 'limits']);
  const limits = normalizeLimits(request.limits); let result;
  if (request.operation === 'initialize') result = await initialize(request.args.files, limits);
  else if (request.operation === 'snapshot') result = await snapshot(limits);
  else if (request.operation === 'patch') result = await patch(request.args.changes, limits);
  else if (request.operation === 'search') result = await search(request.args, limits);
  else check(false, 'INVALID_OPERATION');
  process.stdout.write(JSON.stringify({ ok: true, result }));
} catch (error) {
  const mapped = ['EACCES', 'EPERM', 'ELOOP', 'ENOTDIR'].includes(error.code) ? { code: 'UNSAFE_TREE', message: 'UNSAFE_TREE' } :
    error.code === 'ENOSPC' ? { code: 'SOURCE_QUOTA', message: 'SOURCE_QUOTA' } : safeError(error);
  process.stdout.write(JSON.stringify({ ok: false, error: mapped })); process.exitCode = 1;
}
