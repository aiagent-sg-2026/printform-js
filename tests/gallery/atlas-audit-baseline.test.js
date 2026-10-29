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
it('accepts the locally available historical baseline', () => {
  expect(() => requireAtlasAuditBaseline(path.resolve(import.meta.dirname, '../..'))).not.toThrow();
});
