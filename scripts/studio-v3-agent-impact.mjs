// Transitive dependency coverage and change impact for the agent package (KNO-01..03).
// Every capability/guide is hashed over its declared sources, their full relative-import closure and its evaluations,
// so a shared renderer or validator change marks every dependent capability for review.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'es-module-lexer/js';

const hash = value => createHash('sha256').update(value).digest('hex');
const SAFE = /^[a-zA-Z0-9_./-]+$/;

function checkName(name) {
  if (!SAFE.test(name) || name.split('/').includes('..') || path.isAbsolute(name)) throw new Error(`Invalid agent dependency path: ${name}`);
}
// Line endings are normalized so a Windows checkout produces the same identity as CI.
export function fileHash(root,name) {
  checkName(name);
  const target = path.resolve(root,name);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error(`Missing agent dependency: ${name}`);
  return hash(fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n'));
}

// Static and literal dynamic relative imports, resolved repository-relative. Bare package imports are pinned by the
// lockfile and are not followed. A non-literal dynamic import cannot be tracked and is reported for wider review.
export function importClosure(root,files) {
  const seen = new Set(), untracked = new Set(), queue = [...files];
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    fileHash(root,name); seen.add(name);
    if (!/\.(m?js)$/.test(name)) continue;
    const source = fs.readFileSync(path.resolve(root,name),'utf8');
    const [imports] = parse(source,name);
    for (const entry of imports) {
      if (entry.d === -2) continue; // import.meta is not a dependency.
      const spec = entry.n;
      if (typeof spec !== 'string') { if (entry.d >= 0) untracked.add(name); continue; }
      if (!spec.startsWith('.')) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(name),spec));
      if (resolved.startsWith('..')) throw new Error(`Agent dependency escapes the repository: ${name} -> ${spec}`);
      queue.push(resolved);
    }
  }
  return {files:[...seen].sort(),untracked:[...untracked].sort()};
}

// One index for the whole package: every tracked file hash, and per entry its dependency files and evaluations.
export function dependencyIndex(root,entries) {
  const files = {}, index = {}, untracked = new Set();
  for (const entry of entries) {
    const closure = importClosure(root,entry.sources);
    closure.untracked.forEach(name => untracked.add(name));
    for (const name of [...closure.files,...entry.evaluations]) files[name] ??= fileHash(root,name);
    index[entry.id] = {files:closure.files,evaluations:[...entry.evaluations].sort(),skills:[...(entry.skills || [])].sort()};
  }
  return {version:1,files:Object.fromEntries(Object.keys(files).sort().map(name => [name,files[name]])),entries:index,untracked:[...untracked]};
}
export const entryFileHashes = (index,id) => Object.fromEntries([...index.entries[id].files,...index.entries[id].evaluations].map(name => [name,index.files[name]]));

// Why each change happened (changed files) and what it touches (guides and evaluations), given both indexes.
export function explainChanges(changes,previous,current) {
  const changedFiles = new Set(Object.keys({...previous?.files,...current.files}).filter(name => previous?.files?.[name] !== current.files[name]));
  return changes.map(change => {
    const entry = current.entries[change.id] || previous?.entries?.[change.id];
    if (!entry) return change;
    const causes = previous ? [...entry.files,...entry.evaluations].filter(name => changedFiles.has(name)) : null;
    return {...change,causes,impacts:{guides:entry.skills,evaluations:entry.evaluations}};
  });
}
