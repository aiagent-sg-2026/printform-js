# Immutable public original Gallery inputs

This is test data, not a replacement worker or a simulated legacy button.
`../gallery-original-build.js` builds these exact original inputs at test time.
It does not invoke Git, tar, a package installer or any network command.

## Provenance and integrity

- Public source commit: `53bd82bebad913553ad39d5e8c8ef63638db75f5` in this
  project's original Git history. All inputs were read from existing local objects;
  no remote fetch or external prior-art source was used.
- Archive: `inputs.json.gz`, 1,508,474 bytes, SHA-256
  `bba0bbfa933b89f53c838d9df20f3acf64f881f86072d670524339a8f9429313`.
- Original worker Git blob: `b0c0b0b00d74b748503c042ac975d77a2228ec4a`.
- Original builder Git blob: `8f918a556792f569adcfebeb7a3b3ce83bcf262e`.
- Original classic identity helper Git blob:
  `f02073337fe70023af163862ff898de8ba3e19b1`.
- Original module identity helper Git blob:
  `ae7a009377e276450c7c984d8fed7b2b771cbbe1`.
- Built original worker SHA-256:
  `a673efc47df4c8fb1c9516da72872636f0feb874a1ad3bc35d6b0c28c337a2f1`.
  This matches the earlier real installed-original-worker regression evidence.

The helper pins the archive SHA before decompression/writes/imports, bounds the
compressed and expanded sizes, accepts exactly 175 unique relative file entries
under `gallery/`, the original builder, and `LICENSE`, and writes only regular
files into an empty, non-symlink output directory. It independently checks the
worker/builder/identity Git blob hashes and the exact built worker SHA.

## Payload and license

The gzip contains a UTF-8 JSON array of `[relativePath, base64OriginalBytes]`.
Its 175 entries are precisely the pinned commit's files under `gallery/`, except
`gallery/thumbs/**` and `gallery/README.md`, plus
`scripts/gallery-pwa-build.mjs` and `LICENSE`. This retains the complete original
174-file precache inputs (with `dist/printform.js` supplied by the existing local
engine build). Thumbnails are not precached or required for this migration test;
no image substitutions or fake worker behavior are introduced. The original
builder's ordering and output bytes are unchanged. No engine source, Studio,
other project directories or Git objects are bundled.

The original MIT `LICENSE` (Copyright 2026 YAP WEI JUN) is included verbatim in the
archive, as are the original font licenses/provenance and asset attribution files
under `gallery/designs/assets/`. The archive's license is not a new license grant.

To reconstruct the payload for a deliberate provenance review (not at test
runtime), list the above selected paths with `git ls-tree -r --name-only` at the
pinned commit, preserving its path order; read each using `git show REV:path`;
encode the bytes as base64. Serialize the entry array using Python
`json.dumps(entries, separators=(',', ':')).encode() + b'\n'`, then
`gzip.compress(raw, mtime=0)` (created here with Python 3.12.3 / zlib 1.3).
Compression versions can differ; inspect all extracted bytes against the pinned
objects before changing a checksum. Do not regenerate from current Gallery code.

## Targeted verification

- `npx vitest run tests/gallery/original-fixture.test.js --maxWorkers=1 --no-file-parallelism`
  builds in a temporary no-`.git` project with an empty executable PATH; verifies
  the worker SHA, complete precache, licenses, corruption rejection and safe output.
- `npx playwright test e2e/gallery-legacy-migration.spec.js e2e/gallery-upgrade.spec.js --project=chromium --workers=1`
  reuses the real local engine and preserves all actual migration assertions.
- The same checks can run in a source export without `.git`; no historical objects
  or network fetches are needed. Browser dependencies must already be installed.
