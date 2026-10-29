# PF-066 Atlas Landed Cost Dossier

A fictional logistics allocation demonstration, not customs, accounting, insurance,
tax, inventory valuation or payment advice. No ERP, online AI, approval, posting,
payment, send or FX actions. PF-066 belongs to Inventory & logistics. Accepted
PF-065 Aster and its shared OFL font assets remain unchanged.

## Authoring boundary

- `sample.json`: approved full 24-line / three-container source, unchanged.
- `schema.json` + `validate.mjs`: structural and semantic validation; integer,
  product/sum/variance bounds, real ISO dates, unique ASCII IDs and explicit scope.
- `allocate.mjs`: BigInt signed largest remainder, one independent allocation per
  charge. Rank absolute fractional remainders descending, exact ASCII IDs ascending,
  then apply the sign. Unknown eligible weight leaves the entire nonzero charge
  unresolved. Zero quantity has zero extended weight even with a null unit weight.
- `model.mjs`: source-derived goods, both modes, bridge and container subtotals.
  Unresolved status is per-charge, never inferred from net unallocated amounts.
- `fixtures.mjs`: clean 1/3/8-container and 10/24/50/120-line source fixtures; zero
  scenarios alter actual source fields. The default preserves canonical CHG-01..08.
- `overview.mjs`, `inventory.mjs`, `charges.mjs`, `closing.mjs`, `template.mjs`:
  six logical sections, ordinary measured rows and real per-table headers.
- `controller.mjs`: serialized clean-source rebuilds, font/image awaits, coalesced
  rapid events, final state wins. Errors remove output and disable printing.
- `route.svg`: original route/container artwork, no external imagery or map claim.
- `expected.json` and `oracle-generator.py`: supplied independent Python rational
  oracle; never imported by UI calculations. Expected file remains byte-identical.

The A4 landscape printable area is 273 × 190 mm, with 12/10 mm physical margins.
Body/table type is 10.5 pt; administrative header/footer is 9.5 pt. Natural flow,
not manual pages or forced breaks, determines page counts. The default is ten
pages in the tested full Chromium environment. Long notes are splittable prose;
amounts and quantities use `first`, only explicit reference IDs use `repeat`.
Matrices group at most eight charges to preserve readable columns at scale.
Computed residual examples come from the selected actual allocation trace.

## Build and packaging

From the repository root, with dependencies already available:

```sh
NODE_OPTIONS=--max-old-space-size=4096 node scripts/build-atlas.mjs
```

This builds a fresh runtime from current, unmodified `src/vite-entry.js` and embeds
runtime/app/JSON/SVG in `gallery/designs/atlas-landed-cost-dossier.html`. Only three
same-origin font URLs point to the existing unchanged `assets/fonts/aster-v1/`.
No new full CJK copy or weakened cmap is introduced. Font and MIT licenses and
runtime hashes are embedded. The optional self-contained artifact is written only
to `../artifacts/standalone/atlas-landed-cost-dossier.html`, outside Gallery,
repository distribution and existing precache. Packaging differs only in those
three font URLs. A detached Gallery file needs its adjacent shared font directory;
the standalone needs no adjacent assets. No engine or SW policy changes are needed.

## Focused verification

Use an owned local static server with `.mjs` JavaScript MIME (Python's standard
server works). Explicit full Chromium, not headless-shell, was used:

```sh
export NODE_OPTIONS=--max-old-space-size=4096
export CHROMIUM_PATH=/home/ai-agent/.cache/ms-playwright/chromium-1234/chrome-linux/chrome
python3 -m http.server 4266 --bind 127.0.0.1 --directory .
# In another shell, sequentially:
npx vitest run tests/gallery tests/active-table-context.test.js tests/text-segmentation.test.js tests/measured-pagination.test.js --maxWorkers=1 --no-file-parallelism
node scripts/atlas-model-snapshots.mjs
python3 scripts/verify-atlas-model.py
node scripts/verify-atlas.mjs
node scripts/verify-atlas-pdf.mjs
node scripts/verify-atlas-packaging.mjs
node scripts/verify-atlas-packaging-browser.mjs
python3 -m http.server 4267 --bind 127.0.0.1 --directory ../artifacts/atlas/site-after
node scripts/verify-atlas-pwa.mjs
PF055_BASE_URL=http://127.0.0.1:4266 node scripts/verify-gallery-pagination.mjs --baseline ../artifacts/atlas/gallery-before.json --output ../artifacts/atlas/gallery-after.json
```

The first and second server commands are long-running; retain ownership and stop
them after use. Environment overrides `ATLAS_BASE_URL` / `ATLAS_PWA_BASE_URL` are
available for other local ports. PDF verification supports `ATLAS_ARTIFACT_DIR`
and `ATLAS_PDF_NAMES`. The Python independent check requires local `jsonschema`.
To reproduce the approved oracle, copy `oracle-generator.py` into a temporary
output directory before running it; never overwrite authoring data accidentally.

See `VERIFICATION.md` for actual results and limitations. Evidence is output-only
under `../artifacts/atlas/`; absence of a browser/driver measurement is not a pass.
