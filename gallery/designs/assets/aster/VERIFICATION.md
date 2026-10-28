# Aster PF-065 · verification record

Executed 2026-10-28 in this isolated workspace, Chromium 151 (Playwright cache chromium-1234), Node 24.22.0.
Scope: Aster only. No engine/security/permission/public API changes; no Atlas/Lumen work.
All evidence below is actual browser output, not inferred from a unit-test pass.

## Final results

- Clean dependency install (`npm ci --ignore-scripts`), `npm run clean`, `npm run build:assets`, fresh `node scripts/build-aster.mjs`: passed.
- Focused Vitest: **23 files / 185 tests passed**; existing jsdom pseudo-element warnings remain informational.
- Independent Python jsonschema Draft 2020-12 + Decimal checks: **10 fixtures passed** (five sizes × two scenarios).
- `verify-aster.mjs`: **20 sequential checks passed**, no page errors. Full result: `../artifacts/aster-browser-results.json`.
- `verify-aster-pdf.mjs`: **3 actual Chromium PDFs passed**, 612 spatially anchored monetary fields checked once each.
- Original gallery baseline: 64 designs; **known PF-004 horizontal overflow on its three pages** (baseline command exits 1).
- Final `verify-gallery-pagination.mjs --baseline`: **65 designs, original 64 byte-equivalent result objects, zero differences/new issues**.
- Existing first-64 manifest values protected by an independent SHA-256 assertion; all original design/thumbnail bytes untouched.

## Measured page counts

| PO lines | Review scenario / standard | All matched / standard |
|---|---:|---:|
| 0 | 1 | 1 |
| 1 | 4 | 4 |
| 24 | 8 | 7 |
| 60 | 13 | 12 |
| 150 | 25 | 23 |

Review-only N=24: **7 pages**, six PO display rows plus one unmatched line, six cases; full totals unchanged.
Long bilingual notes: N=24 **11 pages**, N=60 **16**, N=150 **28**.
REV-PARTIAL-003 prose really continues on pages 6–8, 10–12 and 21–23 respectively.
Additional authored long mixed Chinese/English description: **23 pages**, POL-003 spans 14 physical fragments;
all three monetary fields appear in its first fragment only; exact text/grapheme order and literal HTML injection safety passed.
No fixture is assigned a target page count or reduced in font size.

## Arithmetic and behavior

Default totals match every supplied oracle field: PO 615000 cents, canonical invoice 600250,
matched 581500, unmatched 18750; bridge −34500 +1000 +18750; net receipt 224 EA; six case IDs.
All-matched N=24: 615000 cents, 240 net/billed EA, no cases or repeated import event.
Canonical financial schedule amounts occur once: 24/24/150 in default/long/150-line PDFs.
Safe products/sums, negatives, fractions, NaN/infinity, duplicate IDs, unknown references, event conflicts,
return > receipt, schema extra/missing fields, fixed policy values and invalid dates are rejected.
The actual formatter rejects an oversized 2000px atomic block and preserves the source with no partial output.
A simulated formatter rejection produces an actionable error, clears stale output and disables print; reset recovers.
104 rapid control events settle on the final requested state. Native keyboard select/reset/print work.
390px viewport retains native paper width (1123px) with horizontal keyboard/scroll navigation, not document scaling.
Detached file with HTTP(S) blocked works. Gallery purchasing search, thumbnail and live modal preview work.

## PDF and visual evidence

`../artifacts/aster-default.pdf` (8), `aster-long.pdf` (11), `aster-150.pdf` (25).
Every PDF page is **841.92 × 594.96 pt**, A4 landscape within Chromium's rounding.
Every page has the repeated sample notice/reference and correct logical page/total;
text stays within paper bounds, body is 10.5pt, chrome 9.5pt (PDF rounds to 9.495pt).
Final blank review record occurs only on the last page. CJK extraction exactly conserves source ideographs/order.

All eight default browser sheets and PDF raster pages were inspected, plus bilingual continuation pages 6–8,
large-schedule pages 2/13 and final page 25, zero/one-line fixtures and review-only/narrow/error/gallery screens.
Screenshots: `aster-default-page-*.png`, `aster-default-pdf-*.png`, `aster-long-*-page-*.png`,
`aster-long-pdf-*.png`, `aster-150-page-*.png`, `aster-150-pdf-*.png` in `../artifacts/`.
Logs: `aster-focused.log`, `aster-independent-data.log`, `aster-browser.log`, `aster-pdf.log`,
`gallery-before*.json`, `gallery-after*.json`, `clean-build.log`, `aster-build.json`.

## Issues found and corrected without weakening checks

Initial baseline attempt lacked the untracked dist runtime; built assets, then recorded the actual baseline before authoring.
Initial 11-page layout: condensed first-page editorial hierarchy and removed an unnecessary explicit break that made a blank page;
final natural default is eight pages, still 10.5pt body. Fixed bridge total contrast specificity.
Long case first fact is inside its small atomic heading because keep-next cannot contain an entire oversized prose fragment.
PDF harness initially retained explicit screen media; now every PDF is emitted and checked under explicit print media.
Static CJK font duplicate radical cmap aliases initially changed PDF-extracted characters; corrected font-local aliases,
renamed modified OFL fonts, then reran strict exact-source PDF checks. No engine patch or text-normalizing assertion was used.

## Not run / residual limits

No blanket unrelated suite or npm lifecycle broad e2e, Firefox/WebKit, real printer/driver, ERP integration or real financial policy certification.
Known PF-004 baseline defect remains unchanged. Offline standalone is about 15 MB because the genuine CJK face is embedded.
Only the authorized bounded fixtures and separately described authored stress input were validated; arbitrary custom rich assets are not certified.
