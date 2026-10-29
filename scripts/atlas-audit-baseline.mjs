import {spawnSync} from 'node:child_process';
export const ATLAS_AUDIT_BASELINE = '5b69abf';
export function requireAtlasAuditBaseline(cwd, baseline = ATLAS_AUDIT_BASELINE) {
  const result = spawnSync('git', ['cat-file', '-e', `${baseline}^{commit}`], {cwd, encoding:'utf8'});
  if (result.error || result.status !== 0) {
    throw new Error(`Atlas historical packaging audit requires local baseline commit ${baseline}. This is the 65→66 catalogue audit, not a current-tip Lumen test. Restore the historical Git object from an authorized local full-history clone/bundle, then run at the documented 66-entry Atlas snapshot. Do not skip the baseline, weaken counts/hashes, or fetch automatically. See docs/ATLAS_HISTORICAL_AUDIT.md.`);
  }
}
