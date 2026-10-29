# PF-067 Lumen — local verification, awaiting independent review

## Scope and preservation

Baseline: `39b2bf3bf09c60782a7a2fc5519807809da3dd97` (66 entries).
Preflight `ad8b8313-0998-43c6-bc12-5632453bd305`: PROCEED, not runtime proof.
All nine approved transfer checksums passed. Only Lumen authoring/output,
additive catalogue/category/tests, and the bounded Atlas historical audit guard
were changed. No core, prior product, shared font or Service Worker policy edits.
Education did not previously exist: PF-067 alone enters the new category;
all seven old category memberships/counts remain unchanged.

## Actual local checks

Environment: Node 24.22.0, full Chromium 151.0.7922.34 at
`/home/ai-agent/.cache/ms-playwright/chromium-1234/chrome-linux/chrome`,
`NODE_OPTIONS=--max-old-space-size=4096`, owned loopback ports 4268/4269.
Heavy browser/build jobs were sequential; no remote operations.

- Fresh `npm run build:assets` before implementation.
- Existing `verify-gallery-pagination.mjs`: 66-entry fresh baseline, then
  67-entry comparison. Zero differences for the old 66 and no new Lumen issue.
  PF-004's three horizontal-overflow pages are preserved, not masked.
- `lumen-model-snapshots.mjs` + system `python3 verify-lumen-model.py`: 17 actual
  JS source/output snapshots independently checked using the supplied Python
  Draft202012/Fraction oracle, plus six exact ratio checks. All six scales,
  all seven edges, missing evidence, explicit Not observed and multi-domain
  deduplication are included. Default 14/16 = 87.5%; 88/95 = 92.6%; 79/85 = 92.9%.
- `verify-lumen.mjs`: 24 real browser checks, including all six scales,
  English/bilingual labels, long CJK, mutated metadata/footer/references,
  complete/missing/zero attendance, seven edges, multi-domain once globally,
  85 rapid events, keyboard/reset/print, error clearing/recovery, 390px wrapping
  and horizontal paper scrolling, Gallery category/search/modal Print/close/focus.
- `verify-lumen.mjs --standalone`: real file:// default and long cases.
- `verify-lumen-pwa.mjs`: actual unchanged Service Worker installed from an
  isolated local release, then offline fresh navigation. Document and exactly
  three shared fonts returned by the Service Worker; no network failures or
  detached output in the cache. Both default and long offline PDFs exported.
- `verify-lumen-pdf.mjs`: 15 actual PDFs, 130 pages, 846 anchored exact table-cell
  regions. Source English/CJK and labels survive in order; repeated page chrome,
  portrait A4, readable type, bounds and controls exclusion checked. Gallery,
  standalone and offline default/long PDF text AND coordinates are identical.
- Focused Vitest command: `npx vitest run tests/gallery
  tests/measured-pagination.test.js tests/page-chrome-lifecycle.test.js
  tests/footer-flow.test.js tests/active-table-context.test.js
  tests/renderer-integrity.test.js --maxWorkers=1 --no-file-parallelism`:
  **29 files / 257 tests passed**. Existing JSDOM pseudo-element warnings remain;
  real Chromium geometry/PDF checks are the layout authority.
- Packaging: 1,654 protected accepted files byte-identical; all 66 old manifest
  records unchanged; historical Atlas assertions identical after removing only
  the added guard/import/comment. Guard tested in an empty local Git repository.
  Historical Atlas 66-entry audit is intentionally not a post-Lumen tip test.

## Measured output and visual inspection

| Case | Pages |
|---|---:|
| 4×1 / 4×2 | 5 / 6 |
| 8×1 / default 8×2 | 7 / 9 |
| 12×1 / 12×2 stress | 10 / 12 |
| Long bilingual reflection | 12 |
| Long metadata/introduction/evidence mutation | 13 |
| Missing / zero attendance | 9 / 9 |
| All missing / planned-only / zero denominator | 4 / 5 / 5 |
| Multi-domain evidence | 5 |

Actual PDF raster contact sheets inspected: default, small, stress, long,
metadata, missing, zero, all-missing. Also inspected full-size default/long page
PNGs, narrow UI and settled Gallery modal. Forest/ivory/apricot, original grove,
editorial cards, apricot Planned distinction and attendance strips are legible.
No observed clipping, footer collision or blank pages. Paired concise cards are
not reduced type. Normal measured continuation leaves intentional variable
whitespace, especially before very long source cards and on final review pages;
there are no fixed page breaks/counts/spacers added to force the target.

During investigation, initial larger layouts were refined without dropping
source/type reduction. A long two-column evidence mutation initially failed
measured continuation: long source cards now use full-width continuation, and
that mutation passes DOM/PDF conservation. The initial new Vitest path issue
was corrected to the repository's existing `import.meta.dirname` pattern. The
font venv lacked jsonschema; system Python has it and ran the oracle successfully.
These were resolved failures, not skipped or weakened expectations.

## Packaging and limits

Gallery HTML: 140,390 bytes. Detached standalone: 15,458,033 bytes, outside
Gallery/precache. Logical precache: 15,115,763 → 15,388,417 bytes, incremental
**272,654 bytes**; additional font bytes **0**. Release cache has 256 entries /
15,391,614 source-file bytes. These are logical bytes, not compressed transfer,
Cache Storage overhead or quota guarantees. Thumbnail is an actual render.
Build and SHA-256 provenance: `../artifacts/lumen/build.json`; all exported
artifact sizes/hashes: `../artifacts/lumen/evidence-inventory.json`.

Artifacts live in the workspace sibling `artifacts/lumen/`; `LUMEN_RESULT.md`
records the final local commit. Lumen is **awaiting independent review**, not
accepted by this implementation report. Unrun: unrelated full suite, broad
lifecycle e2e, Firefox, WebKit/Safari, touch hardware, hardware printers,
institutional/legal certification and real learner/AI/production workflows.
