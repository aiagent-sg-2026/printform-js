import { createHash } from 'node:crypto';
import { readdirSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
export function runnerSourceHash(root = directory) {
  const parent = lstatSync(root);
  if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error('UNSAFE_RUNNER_SOURCE');
  const names = readdirSync(root).filter((name) => name === 'Dockerfile' || name.endsWith('.mjs')).sort();
  if (!names.includes('Dockerfile')) throw new Error('RUNNER_SOURCE_INCOMPLETE');
  const hash = createHash('sha256').update('printform-coding-source-v1\0');
  for (const name of names) {
    const path = join(root, name), stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('UNSAFE_RUNNER_SOURCE');
    const bytes = readFileSync(path), encoded = Buffer.from(name, 'utf8');
    hash.update(`${encoded.length}:`).update(encoded).update(`${bytes.length}:`).update(bytes);
  }
  return hash.digest('hex');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify({ runnerSourceHash: runnerSourceHash() }));
}
