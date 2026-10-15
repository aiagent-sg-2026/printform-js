import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { check, fail, pathName, text, keys, sha, treeDigest, LIMITS } from './policy.mjs';

const ROOT = '/workspace';
const ACTIVE = `${ROOT}/active`;
async function directory(path) {
  const stat = await fs.lstat(path);
  check(stat.isDirectory() && !stat.isSymbolicLink(), 'UNSAFE_TREE');
}
export async function snapshot(limits = LIMITS) {
  await directory(ROOT);
  const roots = await fs.readdir(ROOT);
  check(roots.length === 1 && roots[0] === 'active', 'EFFECT_UNKNOWN');
  await directory(ACTIVE);
  const entries = []; let bytes = 0, files = 0, directories = 0;
  async function walk(relative) {
    const parent = relative ? `${ACTIVE}/${relative}` : ACTIVE;
    for (const name of (await fs.readdir(parent)).sort()) {
      const path = relative ? `${relative}/${name}` : name; pathName(path);
      const absolute = `${ACTIVE}/${path}`;
      const stat = await fs.lstat(absolute);
      check(!stat.isSymbolicLink(), 'UNSAFE_TREE');
      const mode = stat.mode & 0o777;
      if (stat.isDirectory()) {
        check(++directories <= limits.directories, 'SOURCE_QUOTA');
        entries.push({ path, type: 'directory', bytes: 0, digest: null, mode });
        await walk(path);
      } else {
        check(stat.isFile() && stat.nlink === 1, 'UNSAFE_TREE');
        check(++files <= limits.files && stat.size <= limits.fileBytes && (bytes += stat.size) <= limits.treeBytes, 'SOURCE_QUOTA');
        const handle = await fs.open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        let buffer;
        try {
          const actual = await handle.stat();
          check(actual.isFile() && actual.nlink === 1 && actual.ino === stat.ino && actual.size === stat.size, 'UNSAFE_TREE');
          buffer = await handle.readFile(); check(buffer.length === stat.size, 'UNSAFE_TREE');
        } finally { await handle.close(); }
        let content;
        try { content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer); } catch { fail('INVALID_UTF8'); }
        check(!content.includes('\0'), 'INVALID_UTF8');
        entries.push({ path, type: 'file', bytes: buffer.length, digest: sha(buffer), mode, content });
      }
    }
  }
  await walk(''); entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { entries, treeDigest: treeDigest(entries) };
}
function validateEntries(entries, limits) {
  const paths = new Map(); let files = 0, dirs = 0, bytes = 0;
  for (const entry of entries) {
    pathName(entry.path); check(!paths.has(entry.path), 'DUPLICATE_PATH'); paths.set(entry.path, entry);
    if (entry.type === 'file') {
      text(entry.content, limits.fileBytes, true);
      check(++files <= limits.files && (bytes += Buffer.byteLength(entry.content)) <= limits.treeBytes, 'SOURCE_QUOTA');
    } else check(entry.type === 'directory' && ++dirs <= limits.directories, 'SOURCE_QUOTA');
  }
  for (const entry of entries) {
    let parent = entry.path;
    while (parent.includes('/')) {
      parent = parent.slice(0, parent.lastIndexOf('/'));
      check(!paths.has(parent) || paths.get(parent).type === 'directory', 'PATH_CONFLICT');
      if (!paths.has(parent)) { paths.set(parent, { path: parent, type: 'directory', mode: 0o755 }); check(++dirs <= limits.directories, 'SOURCE_QUOTA'); }
    }
  }
  return [...paths.values()].sort((a, b) => a.path < b.path ? -1 : 1);
}
async function stage(entries, path) {
  await fs.mkdir(path, { mode: 0o700 });
  for (const entry of entries.filter((item) => item.type === 'directory').sort((a, b) => a.path.split('/').length - b.path.split('/').length)) {
    await fs.mkdir(`${path}/${entry.path}`, { recursive: true, mode: 0o700 });
  }
  for (const entry of entries.filter((item) => item.type === 'file')) {
    await fs.writeFile(`${path}/${entry.path}`, entry.content, { flag: 'wx', mode: entry.mode ?? 0o644 });
  }
  for (const entry of entries.filter((item) => item.type === 'directory').reverse()) await fs.chmod(`${path}/${entry.path}`, entry.mode ?? 0o755);
  await fs.chmod(path, 0o755);
}
export async function initialize(files, limits) {
  check((await fs.readdir(ROOT)).length === 0, 'EFFECT_UNKNOWN');
  const entries = validateEntries(files.map((file) => ({ ...file, type: 'file', mode: 0o644 })), limits);
  const pending = `${ROOT}/stage-${randomUUID()}`;
  try { await stage(entries, pending); await fs.rename(pending, ACTIVE); }
  catch (error) { await fs.rm(pending, { recursive: true, force: true }).catch(() => {}); throw error; }
  return snapshot(limits);
}
export async function patch(changes, limits) {
  check(Array.isArray(changes) && changes.length > 0 && changes.length <= limits.files, 'INVALID_ARGUMENT');
  const before = await snapshot(limits), paths = new Set();
  const entries = new Map(before.entries.map((entry) => [entry.path, entry]));
  for (const change of changes) {
    keys(change, ['path', 'expectedDigest', 'content'], ['path', 'expectedDigest', 'content']); pathName(change.path);
    check(!paths.has(change.path), 'DUPLICATE_PATH'); paths.add(change.path);
    const old = entries.get(change.path);
    check(!old || old.type === 'file', 'PATH_CONFLICT');
    check(change.expectedDigest === null || /^[a-f0-9]{64}$/.test(change.expectedDigest), 'INVALID_ARGUMENT');
    check((old?.digest ?? null) === change.expectedDigest, 'STALE_FILE', 409);
    check(change.content !== null || old, 'FILE_NOT_FOUND', 404);
    if (change.content === null) entries.delete(change.path);
    else entries.set(change.path, { path: change.path, content: change.content, type: 'file', mode: old?.mode ?? 0o644 });
  }
  const next = validateEntries([...entries.values()], limits);
  const pending = `${ROOT}/stage-${randomUUID()}`, backup = `${ROOT}/backup-${randomUUID()}`;
  let moved = false, installed = false;
  try {
    await stage(next, pending);
    await fs.rename(ACTIVE, backup); moved = true;
    await fs.rename(pending, ACTIVE); installed = true;
    await fs.rm(backup, { recursive: true });
    return await snapshot(limits);
  } catch (error) {
    if (installed) fail('EFFECT_UNKNOWN');
    try { if (moved) await fs.rename(backup, ACTIVE); await fs.rm(pending, { recursive: true, force: true }); }
    catch { fail('EFFECT_UNKNOWN'); }
    if (error.code === 'ENOSPC') fail('SOURCE_QUOTA');
    throw error;
  }
}
