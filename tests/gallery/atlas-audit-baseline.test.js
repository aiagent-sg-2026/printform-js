import {it, expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {requireAtlasAuditBaseline} from '../../scripts/atlas-audit-baseline.mjs';
it('fails actionably on a genuinely missing local Git baseline, without fetching', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-audit-'));
  try {
    execFileSync('git', ['init', '--quiet', dir]);
    expect(() => requireAtlasAuditBaseline(dir)).toThrow(/requires local baseline commit 5b69abf/);
    expect(() => requireAtlasAuditBaseline(dir)).toThrow(/Do not skip.*fetch automatically/);
  } finally { fs.rmSync(dir, {recursive:true, force:true}); }
});
it('accepts a baseline created in an independent temporary local repository', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-audit-'));
  try {
    execFileSync('git', ['init', '--quiet', dir]);
    execFileSync('git', ['-c', 'user.name=Pi Coding Agent', '-c', 'user.email=pi-coding-agent@localhost',
      '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '--no-verify', '-m', 'Test baseline'], {cwd:dir});
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:dir, encoding:'utf8'}).trim();
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(() => requireAtlasAuditBaseline(dir, sha)).not.toThrow();
  } finally { fs.rmSync(dir, {recursive:true, force:true}); }
});
