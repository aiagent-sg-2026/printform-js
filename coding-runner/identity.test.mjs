// @vitest-environment node
import { it, expect } from 'vitest';
import { mkdtemp, writeFile, rename, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runnerSourceHash } from './identity.mjs';

it('hashes sorted runner names and exact bytes, including Dockerfile but no other files', async () => {
  const one = await mkdtemp(join(tmpdir(), 'pf-identity-'));
  const two = await mkdtemp(join(tmpdir(), 'pf-identity-'));
  try {
    const files = [['Dockerfile', 'FROM immutable\n'], ['a.mjs', 'export const a = 1;\n'], ['b.mjs', 'export const b = 2;\n']];
    for (const [name, content] of files) await writeFile(join(one, name), content);
    for (const [name, content] of [...files].reverse()) await writeFile(join(two, name), content);
    const initial = runnerSourceHash(one); expect(initial).toMatch(/^[a-f0-9]{64}$/);
    expect(runnerSourceHash(two)).toBe(initial);
    await writeFile(join(one, 'ignored.txt'), 'not part of the runtime source');
    expect(runnerSourceHash(one)).toBe(initial);
    await rename(join(one, 'a.mjs'), join(one, 'c.mjs'));
    const renamed = runnerSourceHash(one); expect(renamed).not.toBe(initial);
    await writeFile(join(one, 'Dockerfile'), 'FROM immutable\r\n');
    expect(runnerSourceHash(one)).not.toBe(renamed);
    await symlink(join(one, 'c.mjs'), join(one, 'linked.mjs'));
    expect(() => runnerSourceHash(one)).toThrow('UNSAFE_RUNNER_SOURCE');
  } finally { await Promise.all([rm(one, { recursive: true, force: true }), rm(two, { recursive: true, force: true })]); }
});
