# Atlas historical packaging audit (PF-066)

`scripts/verify-atlas-packaging.mjs` is the **historical 65→66 catalogue audit**,
not a universal current-tip regression command. It compares accepted Aster
baseline `5b69abf` to the 66-entry Atlas implementation at
`39b2bf3bf09c60782a7a2fc5519807809da3dd97`.

## Local prerequisites

- Both historical commits must exist locally. The explicit guard checks baseline
  `5b69abf^{commit}` before any audit writes. A shallow/export-only checkout gets
  an actionable error, never a skipped/pass result. Restore history only from an
  authorized local full-history clone or bundle; this script performs no fetch.
- Use an isolated local worktree at the Atlas snapshot, not the post-Lumen
  67-entry catalogue. Apply the guard/documentation patch there if needed.
- Install dependencies locally and run `node scripts/build-atlas.mjs` first.
  Keep its `../artifacts/atlas/build.json` and detached standalone output alongside
  that worktree: the historical command consumes them and emits `site-before`,
  `site-after` and packaging evidence under that worktree's sibling artifacts.
- Run `node scripts/verify-atlas-packaging.mjs` in that Atlas worktree.

After Lumen, an intentional 67-entry catalogue fails the historical length/hash
assertions. Do **not** change 66, the 65 protected records, baseline object,
protected-file comparisons, font-copy checks or runtime checks to make it pass.
Use `scripts/verify-lumen-packaging.mjs` for the additive current batch audit.

The bounded Lumen follow-up adds only this documentation and the missing-object
guard (tested using an empty local Git repository). Atlas product, fonts,
runtime and all existing audit assertions remain unchanged.
