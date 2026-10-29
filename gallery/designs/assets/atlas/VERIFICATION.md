# Atlas PF-066 verification record

## Scope and environment

Only AtlasLandedCostDossier was implemented after accepted Aster `5b69abf`.
Current-source preflight supplied by the task: `PROCEED
 a152d00f-0184-485e-a707-95e0847f7176`; runtime proof was measured separately.
No engine/API, old template, dependency, shared font or PWA-policy changes.
Only the catalogue record, logistics classification and necessary exact catalogue
assertions extend existing files. No Lumen or remote operation was started.

Node 24.22.0, full Chromium 151.0.7922.34 (Playwright chromium-1234), sequential
owned local contexts/ports, 4 GB Node cap. All five supplied Base64 artifacts
matched the fully read originals. The approved Python generator reproduced both
source and expected JSON byte-for-byte in a temporary evidence directory.

## Actual automated results

- Focused Vitest: 25 files / 229 tests passed, including the unchanged Aster
  tests, catalogue tests, measured pagination, table context and segmentation.
  jsdom's pre-existing pseudo-element `getComputedStyle` warnings are not browser
  render evidence. Real Chromium checks below produced no console/network errors.
- Atlas model tests compare every charge and line of all six independent default
  oracle scenarios and eight supplied edge fixtures. All 12 container/line pairs
  exercise both modes and all three bases, exact per-charge conservation and
  source-derived container totals. Invalid source/date/ID/overflow cases fail.
- 216 actual JS snapshots: all 12 pairs × complete/missing/zero × three bases ×
  two modes, independently recomputed with Python Fraction and schema validation.
- 29 browser checks: default + all six basis/mode combinations; all 12 missing/
  zero combinations; representative scale extremes; long bilingual notes;
  escaped and long actual-source metadata/description mutation; 150 rapid events;
  keyboard/reset/print, error clearing/recovery and 390px scroll; Gallery search,
  category and actual modal iframe rendering.
- Every emitted row/cell conserves actual source text in order. Monetary fields
  occur once, quantities use first-only continuation, repeated cells are explicit
  reference IDs. Headers are associated with distinct real table IDs. Exact A4
  geometry, non-overlap, native controls, page numbering and one overview passed.
- Four actual print PDFs: default 10 pages, long bilingual 14, dense 120 lines /
  eight containers 37, escaped metadata / long description 14. Every page has A4
  landscape dimensions, bounded text and at least 9.5pt administrative type;
  monetary body type is at least 10.5pt (PDF emission tolerance 0.01pt).
- 3,250 anchored monetary fields and 794 split-cell PDF regions checked against
  actual DOM geometry/text, including exact Chinese and English source order.
  PDF glyph runs are reconstructed only inside each exact amount rectangle,
  because a Unicode minus can be emitted as a separate fallback-font run.
- Nine packaging comparisons: HTTP Gallery, offline file Gallery and detached
  offline standalone × default/long/dense. DOM and PDF text, dimensions and
  coordinates are exactly equal, with all fonts explicitly loaded and a strict
  document/font request allowlist. Each PDF also passes the same anchored-money,
  exact split-text, CJK, readability and physical geometry checks.

## Measured natural page counts

| Source | Pages |
|---|---:|
| Default 3 containers / 24 lines, every basis/mode | 10 |
| Default missing / zero, every basis/mode | 10 |
| 1 container / 10 lines | 7 |
| 8 containers / 10 lines | 13 |
| 1 container / 120 lines | 29 |
| 8 containers / 120 lines | 37 |
| 3 containers / 50 lines | 15 |
| Default long bilingual notes | 14 |
| Escaped metadata plus long first description | 14 |

No manual page containers, target-count padding, forced breaks or font reduction.
The 6–10-page design target applies to the default, not dense/long stress data.
Goods are 1,036,500 cents; estimated/actual charges 302,000/339,000;
landed totals 1,338,500/1,375,500. Missing-weight actual allocates 45,000 and
leaves 294,000 unresolved: partial landed subtotal 1,081,500 cents.

## Visual review and failures corrected

Reviewed all ten default browser sheets and all ten PDF raster sheets, plus
representative long-CJK continuation, dense matrix/inventory/last pages,
missing-basis overview, escaped metadata, narrow screen and Gallery modal.
The logistics composition uses an original route/container illustration, ocean
teal/sand, a restrained orange rule, compact trace matrix and source registers,
not Aster's reconciliation layout.

The initial layout measured 14 pages; repeated explanation text and inefficient
header/description wrapping were reduced without shrinking type or dropping
source facts. A following 11-page draft had an isolated print-record page; concise
method prose restored natural ten-page flow. An early browser assertion expected
long text to be contiguous across physical headers; it was corrected to compare
ordered actual fragments, preserving exact text assertions. PDF tests initially
assumed each amount was one PDF text run; exact geometry reconstruction now checks
split minus glyphs without ignoring sign, amount, coordinates or duplicate fields.
The first baseline launch used a nonexistent `chrome-linux64` path; the documented
actual full-Chromium path was then used throughout.

## Packaging, baseline and evidence

Detailed measured bytes and hashes are recorded in output-only
`../artifacts/atlas/{packaging-results,pwa-offline}.json`. All 1,621 protected
parent files, including Aster, engine, fonts, SW and PWA build policy, are
byte-identical; all 65 accepted manifest records retain exact values. A real
existing-SW release installed successfully: after disconnecting the browser,
Atlas HTML and all three fonts came from the SW, and long bilingual output
passed at 14 pages. Each shared font appears once per release; standalone is
absent from precache. Rebuilding Gallery HTML, standalone and readable runtime
produced byte-identical outputs. Shared-font cmap coverage also remains intact.

The fresh 66-design Gallery audit compared every old record against the newly
measured 65-design pre-Atlas baseline: zero differences or new issues. The
initial baseline exited 1 solely for known PF-004 horizontal overflow on three
pages; final baseline comparison exited 0, retaining that issue explicitly.
See `../ATLAS_RESULT.md` for the final local commit and exact byte totals.

Evidence: `../artifacts/atlas/` contains `build.json`, `focused-tests.log`,
`model-independent.log`, `browser-results.json`, `pdf-results.json`, all four
primary PDFs/DOM snapshots, all default screen/print sheets and contact sheets,
long/dense/metadata/narrow/error/Gallery images, packaging comparison PDFs and
network logs, plus before/after Gallery results. Build reproduction and all final
commands are recorded there and in `README.md`.

Not run: unrelated full repository suite/lifecycle e2e, Firefox, WebKit, hardware
printing/drivers, compressed-transfer or CacheStorage-overhead measurements,
real customs/financial/ERP scenarios. Offline release-cache policy is unchanged;
shared fonts still download on first installation, and standalone adds its own
embedded bytes when explicitly obtained. No blanket real-world certification.
