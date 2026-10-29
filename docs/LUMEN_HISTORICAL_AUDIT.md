# Lumen historical packaging audit (PF-067)

`scripts/verify-lumen-packaging.mjs` is the **historical 66→67 catalogue audit**,
not a universal current-tip regression command. It compares accepted Atlas
baseline `39b2bf3bf09c60782a7a2fc5519807809da3dd97` to the 67-entry Lumen
implementation at `001a03653650573801e387c402ea5a880a7c7cc5` (plus the bounded
review guard/documentation corrections).

## Local prerequisites

- The Atlas baseline commit must exist locally. The early guard checks
  `39b2bf3bf09c60782a7a2fc5519807809da3dd97^{commit}` before file comparisons,
  artifact reads or audit writes. Missing history is an actionable failure,
  never a skipped/pass result. Shallow, squash-only and exported checkouts may
  omit that object even when current product files are complete.
- Restore required historical objects only from an authorized local
  full-history clone or bundle. A shallow checkout also needs sufficient local
  history; changing counts, substituting HEAD or ignoring the failure is not a
  remedy. The guard and audit never fetch or change Git configuration.
- Run at the documented 67-entry Lumen snapshot with the guard patch, not at a
  future catalogue snapshot. A squash-only copy needs the original historical
  baseline object as well as the expected snapshot files.
- Dependencies and Lumen build artifacts must already be available locally:
  `../artifacts/lumen/build.json`, its detached standalone target outside Gallery,
  and the matching `dist/printform.js`. Artifact creation is a separate operation
  subject to the batch's heavy-work scheduling; this guard does not build them.
- When the heavy window permits, run `node scripts/verify-lumen-packaging.mjs`.
  The full audit writes `site-before`, `site-after`, precache inventories and
  `packaging-results.json` under the sibling `artifacts/lumen` directory.

Do **not** relax the 66 protected records, 67 total entries, PF-067 uniqueness,
protected-file hashes, historical Atlas assertions, font-copy checks, standalone
boundary or runtime provenance assertions. Atlas retains its own historical
65→66 prerequisite and guard: [ATLAS_HISTORICAL_AUDIT.md](ATLAS_HISTORICAL_AUDIT.md).

## Lightweight guard tests

`node_modules/.bin/vitest run tests/gallery/atlas-audit-baseline.test.js tests/gallery/lumen-audit-baseline.test.js --maxWorkers=1 --no-file-parallelism`

These tests use independent temporary local Git repositories, not ambient
historical objects. They cover successful commits, missing objects, a synthetic
shallow boundary and early failure of the actual Lumen audit entry point. They
neither build nor run the full packaging, browser or PDF audit.
