// @vitest-environment node
import {it, expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {LUMEN_AUDIT_BASELINE, requireLumenAuditBaseline} from '../../scripts/lumen-audit-baseline.mjs';

function withRepo(test) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-audit-'));
  const dir = path.join(temp, 'repo');
  try {
    execFileSync('git', ['init', '--quiet', dir], {timeout:5000});
    const git = (...args) => execFileSync('git', args, {cwd:dir, encoding:'utf8', timeout:5000}).trim();
    const commit = () => {
      git('-c', 'user.name=Pi Coding Agent', '-c', 'user.email=pi-coding-agent@localhost',
        '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '--no-verify', '-m', 'Test baseline');
      return git('rev-parse', 'HEAD');
    };
    test({temp, dir, git, commit});
  } finally { fs.rmSync(temp, {recursive:true, force:true}); }
}

it('accepts an actual commit in an independent temporary local repository', () => {
  withRepo(({dir, git, commit}) => {
    const sha = commit();
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(git('cat-file', '-t', sha)).toBe('commit');
    expect(() => requireLumenAuditBaseline(dir, sha)).not.toThrow();
  });
});

it('fails actionably on a missing historical object in an empty local repository', () => {
  withRepo(({dir, git}) => {
    expect(() => requireLumenAuditBaseline(dir)).toThrow(`requires local baseline commit ${LUMEN_AUDIT_BASELINE}`);
    expect(() => requireLumenAuditBaseline(dir)).toThrow(/66→67.*shallow, squash-only/);
    expect(() => requireLumenAuditBaseline(dir)).toThrow(/authorized local full-history clone\/bundle/);
    expect(() => requireLumenAuditBaseline(dir)).toThrow(/Do not skip.*66\/67.*protected hashes.*fetch automatically/);
    expect(() => requireLumenAuditBaseline(dir)).toThrow(/docs\/LUMEN_HISTORICAL_AUDIT.md/);
    expect(git('remote')).toBe('');
  });
});

it('accepts an available shallow tip but rejects its absent historical parent', () => {
  withRepo(({dir, git, commit}) => {
    const baseline = commit(), tip = commit();
    // Construct a shallow boundary locally; no clone, remote, or fetch is used.
    fs.writeFileSync(path.join(dir, '.git/shallow'), `${tip}\n`);
    fs.unlinkSync(path.join(dir, '.git/objects', baseline.slice(0, 2), baseline.slice(2)));
    expect(git('rev-parse', '--is-shallow-repository')).toBe('true');
    expect(git('rev-list', 'HEAD')).toBe(tip);
    expect(() => requireLumenAuditBaseline(dir, tip)).not.toThrow();
    expect(() => requireLumenAuditBaseline(dir, baseline)).toThrow(`requires local baseline commit ${baseline}`);
    expect(git('remote')).toBe('');
  });
});

it('stops the actual packaging entry point before artifact reads or writes when history is missing', () => {
  withRepo(({temp, dir}) => {
    const scripts = path.join(dir, 'scripts');
    fs.mkdirSync(scripts);
    for (const file of ['verify-lumen-packaging.mjs', 'lumen-audit-baseline.mjs', 'gallery-pwa-build.mjs']) {
      fs.copyFileSync(path.resolve(import.meta.dirname, '../../scripts', file), path.join(scripts, file));
    }
    const result = spawnSync(process.execPath, [path.join(scripts, 'verify-lumen-packaging.mjs')],
      {cwd:dir, encoding:'utf8', timeout:5000});
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`requires local baseline commit ${LUMEN_AUDIT_BASELINE}`);
    expect(result.stderr).not.toContain('ENOENT');
    expect(result.stdout).toBe('');
    expect(fs.existsSync(path.join(temp, 'artifacts'))).toBe(false);
    expect(fs.readdirSync(dir).sort()).toEqual(['.git', 'scripts']);
  });
});
