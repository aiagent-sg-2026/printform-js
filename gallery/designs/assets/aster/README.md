# Aster · PF-065

Fictional three-way procurement review, not an order, invoice, decision or ERP integration.
Original midnight/copper artwork; native A4 landscape, 10.5pt body, 9.5pt administrative chrome.

## Authoring

- `sample.json`, `input.schema.json`: complete supplied input/schema, lossless compact JSON.
- `expected.json`: independent supplied oracle; tests only, never imported by the UI.
- `fixtures.mjs`: deterministic 0/1/24/60/150 inputs and bilingual stress prose.
- `validate.mjs`: supplied-schema keywords, references, dates, IDs, import conflicts and safe integers.
- `reconcile.mjs`, `reviews.mjs`: canonical-only cents arithmetic and deterministic case precedence.
- `template.mjs`, `summary.mjs`, `schedule.mjs`, `closing.mjs`, `dom.mjs`: natural measured stream.
- `controller.mjs`: clean source reconstruction; serialized/coalesced final-state-wins formatting.
- `shell.html`, `styles.css`, `logo.svg`: controls, native-paper print host, original mark.

No upload, financial source editor or operational action is exposed. Edit sources and rebuild.

## Two packagings, identical document

`node scripts/build-aster.mjs` rebuilds the unmodified runtime from current source and emits:

1. `gallery/designs/aster-three-way-match-review-pack.html`: normal Gallery document;
   inline app/runtime/data/artwork, three relative WOFF2 references to `assets/fonts/aster-v1/`.
   Open via HTTP or directly from disk **with the shared directory in its relative location**.
   The unchanged Gallery service worker precaches HTML/fonts for offline use.
2. `../artifacts/standalone/aster-three-way-match-review-pack.html`: detached self-contained
   download artifact with all three fonts embedded. Open this one file offline, anywhere.
   Output-only: never commit it, copy it into Gallery/dist/site-dist, or offer it via a new Gallery UI.

Only font URLs differ between these outputs. A data URI favicon avoids Chromium's implicit
`/favicon.ico` request; document controls/layout are unchanged. No CDN or cross-origin fetches.
Do not distribute the Gallery HTML alone as though it were the standalone download.

## Focused build and verification

```sh
npm ci --ignore-scripts
node scripts/build-aster.mjs
# Serve repo with correct .mjs MIME, e.g. python3 -m http.server 4197 --bind 127.0.0.1
export CHROMIUM_PATH=/path/to/chrome
npx vitest run tests/gallery --maxWorkers=1 --no-file-parallelism
node scripts/verify-aster.mjs
node scripts/verify-aster-pdf.mjs
ASTER_ARTIFACT_DIR=../artifacts/aster-package/metadata-gallery node scripts/verify-aster-metadata.mjs
ASTER_PACKAGE=standalone ASTER_ARTIFACT_DIR=../artifacts/aster-package/metadata-standalone node scripts/verify-aster-metadata.mjs
node scripts/verify-aster-packaging-browser.mjs
node scripts/verify-aster-packaging.mjs
# Serve ../artifacts/aster-package/sites/shared on 4199, then:
node scripts/verify-aster-packaging-pwa.mjs
```

No global site build/full test lifecycle is required. The builder does not trust stale `dist` runtime.
`ASTER_BASE_URL` overrides port 4197; `ASTER_PWA_BASE_URL` overrides port 4199.
`ASTER_ARTIFACT_DIR` isolates browser/PDF evidence; standalone build output remains outside the product.
Browser scripts run sequentially in isolated Playwright contexts and no longer overwrite the thumbnail.
`verify-aster-pdf.mjs` checks real emitted PDF CJK order, anchored once-only amounts, geometry/bounds/font size.
The packaging browser proof checks HTTP Gallery, actual `file://` Gallery and fully offline standalone,
compares exact text/DOM/PDF coordinates, and rejects all unexpected requests/console/network/font errors.
Run both metadata commands before the packaging comparison, which also compares their six PDF pairs.
`verify-aster-packaging.mjs` creates controlled real-path Gallery copies of old main `5124bea`,
pre-fix `6434b83` and the working tree; it measures unchanged `buildGalleryPrecache` output and
finalizes only the controlled new Gallery PWA. It checks protected file bytes and unchanged runtime/app.
Do not use the generic static server without a `.mjs` MIME mapping for module-based authored tests.

## Shared fonts and evidence

The exact renamed OFL font set and license live once at `../fonts/aster-v1/`.
See its `README.md` for source hashes, deterministic regeneration and the CJK PDF cmap correction.
Do not reduce coverage, replace fonts, rename internal families again, or copy them per template.
The detached standalone remains about 15 MB; this duplicate is a local download output, not precache input.
See `VERIFICATION.md` for fresh results and raw byte counts. No compressed-network savings are claimed.
Chromium PDF evidence is not hardware printing or procurement-policy certification.
No old-template, engine, permission, security, public API or PWA cache-contract changes are included.
