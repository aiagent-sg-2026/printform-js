import {spawnSync} from 'node:child_process';
export const LUMEN_AUDIT_BASELINE = '39b2bf3bf09c60782a7a2fc5519807809da3dd97';
export function requireLumenAuditBaseline(cwd, baseline = LUMEN_AUDIT_BASELINE) {
  const result = spawnSync('git', ['cat-file', '-e', `${baseline}^{commit}`], {cwd, encoding:'utf8'});
  if (result.error || result.status !== 0) {
    throw new Error(`Lumen historical packaging audit requires local baseline commit ${baseline}. This is the 66→67 catalogue audit; shallow, squash-only or exported checkouts may lack the required historical object. Restore it from an authorized local full-history clone/bundle and run at the documented 67-entry Lumen snapshot with its build artifacts. Do not skip the baseline, weaken 66/67 counts or protected hashes, or fetch automatically. See docs/LUMEN_HISTORICAL_AUDIT.md.`);
  }
}
