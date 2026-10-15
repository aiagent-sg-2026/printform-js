import { createHash } from 'node:crypto';

export const PROTOCOL = 'printform-coding-v1';
export const PROFILE = 'local-docker-node24-source-json-v1';
export const JSON_RESPONSE_BYTES = 1024 * 1024;
export const BASE_IMAGE = 'public.ecr.aws/docker/library/node@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20';
export const LABEL = 'io.printform.coding';
export const DEFAULT_IMAGE = 'printform-coding-runner:local';
export const LIMITS = Object.freeze({ files: 128, directories: 128, fileBytes: 262144, treeBytes: 4194304,
  outputBytes: 64000, artifactBytes: 64000, workspaces: 2, calls: 64, receipts: 16,
  timeoutMs: 60000, idleMs: 600000, tokenMs: 3600000, bodyBytes: 7000000 });
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DIGEST = /^[a-f0-9]{64}$/;
export class RunnerError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export function fail(code, status) { throw new RunnerError(code, status); }
export function check(condition, code = 'INVALID_ARGUMENT', status = 400) { if (!condition) fail(code, status); }
export function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function keys(value, allowed, required = []) {
  check(plain(value));
  check(Object.keys(value).every((key) => allowed.includes(key)) && required.every((key) => Object.hasOwn(value, key)));
}
export function text(value, max = 1024, empty = false) {
  check(typeof value === 'string' && (empty || value.length > 0) && Buffer.byteLength(value) <= max && !value.includes('\0'));
  check(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.from(value)) === value, 'INVALID_UTF8');
  return value;
}
export function pathName(value, empty = false) {
  text(value, 240, empty);
  if (empty && value === '') return value;
  check(!value.includes('\\') && !value.includes(':') && !value.startsWith('/') &&
    value.split('/').every((part) => part && part !== '.' && part !== '..' && !/[\x00-\x1f\x7f]/.test(part)), 'UNSAFE_PATH');
  return value;
}
export function integer(value, min, max) { check(Number.isSafeInteger(value) && value >= min && value <= max); return value; }
export function sha(value) { return createHash('sha256').update(value).digest('hex'); }
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (plain(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function treeDigest(entries) {
  return sha(canonical(entries.map(({ path, type, bytes, digest, mode }) => ({ path, type, bytes, digest, mode }))));
}
export function validateFiles(files, limits = LIMITS) {
  check(Array.isArray(files) && files.length <= limits.files, 'SOURCE_QUOTA');
  const names = new Set(); let bytes = 0;
  for (const file of files) {
    keys(file, ['path', 'content'], ['path', 'content']); pathName(file.path);
    check(!names.has(file.path), 'DUPLICATE_PATH'); names.add(file.path);
    check(typeof file.content === 'string'); check(Buffer.byteLength(file.content) <= limits.fileBytes, 'SOURCE_QUOTA');
    text(file.content, limits.fileBytes, true); bytes += Buffer.byteLength(file.content);
  }
  check(bytes <= limits.treeBytes, 'SOURCE_QUOTA');
  for (const name of names) for (const other of names) check(!other.startsWith(`${name}/`), 'PATH_CONFLICT');
  return files;
}
export function normalizeLimits(input = {}) {
  keys(input, Object.keys(LIMITS));
  return Object.fromEntries(Object.entries(LIMITS).map(([key, value]) => [key,
    input[key] === undefined ? value : integer(input[key], 1, value)]));
}
export function safeError(error) {
  return { code: error instanceof RunnerError ? error.code : 'INTERNAL_ERROR', message: error instanceof RunnerError ? error.code : 'INTERNAL_ERROR' };
}
export function runArgs(args, limits) {
  keys(args, ['command', 'cwd', 'env', 'timeoutMs'], ['command']); text(args.command, 16000);
  const cwd = pathName(args.cwd ?? '', true); const env = args.env ?? {};
  keys(env, ['CI', 'NODE_ENV', 'TZ', 'LANG']);
  for (const value of Object.values(env)) text(value, 256, true);
  return { command: args.command, cwd, env, timeoutMs: integer(args.timeoutMs ?? limits.timeoutMs, 1, limits.timeoutMs) };
}
export function context(body) {
  keys(body, ['files', 'releaseIdentity', 'documentId', 'baseRevision', 'runId'], ['files', 'releaseIdentity', 'documentId', 'baseRevision', 'runId']);
  keys(body.releaseIdentity, ['release', 'contractHash', 'knowledgeHash', 'packageHash'], ['release', 'contractHash', 'knowledgeHash', 'packageHash']);
  for (const value of Object.values(body.releaseIdentity)) text(value, 256);
  text(body.documentId, 256); text(body.runId, 256);
  check((typeof body.baseRevision === 'string' && body.baseRevision.length <= 256) ||
    (Number.isSafeInteger(body.baseRevision) && body.baseRevision >= 0));
}
export function changesBetween(before, after) {
  const old = new Map(before.map((entry) => [entry.path, entry]));
  const next = new Map(after.map((entry) => [entry.path, entry]));
  return [...new Set([...old.keys(), ...next.keys()])].sort().flatMap((path) => {
    const a = old.get(path), b = next.get(path);
    if (a?.digest === b?.digest && a?.type === b?.type && a?.mode === b?.mode) return [];
    return [{ path, type: b ? (a ? 'modified' : 'added') : 'deleted', beforeDigest: a?.digest ?? null, afterDigest: b?.digest ?? null,
      beforeType: a?.type ?? null, afterType: b?.type ?? null, beforeMode: a?.mode ?? null, afterMode: b?.mode ?? null,
      beforeBytes: a?.bytes ?? null, afterBytes: b?.bytes ?? null }];
  });
}
