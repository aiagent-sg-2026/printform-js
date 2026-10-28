# Meridian Enterprise Purchase Order — bounded review results

**Implementation and final scoped checks passed, including independent manager rerun. Local commit uses the verified existing Pi Coding Agent identity; no remote Git actions.**

Original implementation baseline was `53bd82bebad913553ad39d5e8c8ef63638db75f5`; reviewed commit `4a0cc351babdf9a3f1ce295605258efc0bd2830c` is preserved on `feat/meridian-enterprise-purchase-order`. Local integration branch is `feat/meridian-enterprise-po-integrated-20261028`. Read `../TASK.md`, `../REVIEW.md`, prior summary and verification evidence. REVIEW supersedes the earlier operational scheduling requirement. Preflight `ac7b801c-318e-4e8f-91ff-25a2699f8a89` records engineering readiness, not release authority; No remote push, PR, merge or deployment occurred. Local integration details are recorded below.

## Delivered corrections

- `scripts/build-meridian.mjs` always rebuilds the genuine readable runtime from current source using the repository Vite configuration, then embeds fresh runtime/application bundles. No operational marker, sibling-file prerequisite or runtime-mtime freshness logic remains.
- `scripts/verify-meridian*.mjs` and authoring README have no operational marker dependency. Isolated reproduction proves the normal build succeeds with **no sibling files and no dist**, then overwrites a **poisoned future-dated dist runtime**, yielding identical final HTML/runtime hashes both times. Installed dependencies are linked into the isolated source copy; no dependency install or network access is needed for this proof.
- `scripts/meridian-inspect.mjs` retains every prior row/page/SVG paint-containment assertion and adds explicit PO label → SVG and item label → SVG → human-readable sibling-box checks, text-range containment, expected text and 9pt font assertions in **screen and print**. Six deliberate overlap mutations are rejected by the new named assertions; each is restored and clean geometry rechecked.
- `scripts/verify-meridian-pdf-pixels.mjs` independently decodes the PO and all six item barcodes from final real PDF raster pixels, complementing the seven browser PNG decodes. No production SVG/encoder attributes enter the decoder.
- Regenerated standalone and actual screenshot thumbnail. Their bytes are unchanged from the previously corrected layout; no redesign, core change or previous-template edit was needed. Catalog remains **64**, purchasing **7**, unique **PF-064**.

## Final fresh verification (2026-10-28)

Final browser matrix ran **09:25:09–09:25:21Z**; representative regression ran **09:25:22–09:25:27Z**. Reports below supersede earlier passes for final acceptance.

| Fixture | Items | PDF pages |
| --- | ---: | ---: |
| Empty | 0 | 2 |
| Default | 6 | 2 |
| Medium | 20 | 3 |
| Long | 100 | 9 |
| Maximum | 200 | 16 |
| Multiline descriptions | 20 | 4 |
| Literal injection / absent optional contact | 6 | 2 |
| Concurrent rerenders, latest wins | 6 | 2 |

- **17 files / 134 tests passed**, one worker, no file parallelism; all Gallery tests, formatAll, measured pagination and existing independent barcode tests.
- **8 real PDFs** independently inspected with PDF.js and raw MediaBox checks: ordered IDs/HRI with none missing/duplicated, no split rows, one Grand Total after items, terms on a separate later page, repeated headings, global Page X of Y, no blank body pages, margins/bounds/footer/overlap checks. Item/description and barcode label/HRI typography is **9pt**; PDF IDs/HRI measure 9pt, with no transform/zoom scaling.
- CSS paper **210 × 297mm**, content **190 × 277mm**. Chromium quantizes the PDF MediaBox to **594.95996 × 841.91998pt** (`pdfinfo`: A4); no byte resizing or patching.
- Default amounts **450 / 330 / 925 / 1,680 / 250 / 456 SGD**; subtotal **4,091.00**, GST **368.19**, Grand Total **4,459.19**. Dynamic integer-cents totals pass across counts.
- **7 PNG + 7 PDF-raster barcodes** independently decoded, including checksum and quiet zones: `PO-2026-004128`, `880000000001` through `880000000006`.
- JSON import/export roundtrip, literal injection, missing optional email/reference, add/remove/reset/presets, rerender races, pending/dirty print lock, blocked native-print media and 390px mobile horizontal scrolling passed. No native dialog/printer job was invoked.
- Invalid JSON, negative/nonfinite/overflow numbers, invalid discount, 201 items, >1MiB import, add at 200 and a 400-line atomic row reject clearly and block print; no truncation or shrink.
- Cold offline `file://`: **0 external requests, 0 page errors, 0 unexpected dialogs**; tested-copy hash matches source. Existing Snap Chromium **155.0.8059.79**, headed `DISPLAY=:0`, SwiftShader, sandbox enabled; actual CDP arguments contain **0 sandbox-disable flags**.
- **6 browser regressions passed**: Gallery PF-064/filter/modal; unchanged SANYO green 5/35 rows → 1/6 pages; SANYO blue 48 rows → 5 pages; school A4 short/long 4/44 rows → 1/4 pages. Five old-template PDFs independently parsed.
- Viewed the final screen first page, real PDF first/terms pages, 200-item last-items page, mobile controls and Gallery modal with the image read tool. PO/item labels and human-readable values are complete, not overpainted.
- Syntax, authored-file line limits, catalog uniqueness, whitespace and scope checks passed. Each newly authored file is below 300 lines (standalone **199 lines / 173,051 bytes**). The pre-existing long manifest is only appended, not reformatted. Core, prior templates, package/lock and security settings are unchanged.

## Exact final commands

Node `v24.22.0`, Vite `8.1.5`; executed serially from repo root with already-installed dependencies:

```sh
node scripts/build-meridian.mjs > ../artifacts/review-final-build.log 2>&1
node scripts/verify-meridian-portability.mjs ../artifacts/review-final-portability > ../artifacts/review-final-portability.log 2>&1
DISPLAY=:0 MERIDIAN_HEADFUL=1 MERIDIAN_CHROMIUM=/snap/bin/chromium MERIDIAN_FILE_DIR=/home/ai-agent/snap/chromium/common node scripts/verify-meridian.mjs ../artifacts/review-final > ../artifacts/review-final.log 2>&1
DISPLAY=:0 MERIDIAN_HEADFUL=1 MERIDIAN_CHROMIUM=/snap/bin/chromium node scripts/verify-meridian-regressions.mjs ../artifacts/review-final-regressions > ../artifacts/review-final-regressions.log 2>&1
node scripts/verify-meridian-pdf-pixels.mjs ../artifacts/review-final > ../artifacts/review-final-pdf-pixels.log 2>&1
npx vitest run tests/gallery tests/format-all.test.js tests/measured-pagination.test.js tests/studio-v3-offline-barcode.test.js --maxWorkers=1 --no-file-parallelism > ../artifacts/review-final-targeted-tests.log 2>&1
pdfinfo ../artifacts/review-final/items-6.pdf > ../artifacts/review-final/pdfinfo.txt
node ../artifacts/review-scope-check.mjs > ../artifacts/review-scope-check.log 2>&1
git diff --check
git diff --quiet -- src studio-v2 studio-v3 package.json package-lock.json
```

For a fresh dependency installation use `npm ci --ignore-scripts`, then the build command above; it does not require an earlier `build:assets`. Poppler `pdftoppm` is required only for the PDF pixel verifier. Browser environment variables above select this VM's installed browser. Snap cannot read `/srv`; the verifier tests an identical-byte temporary copy in its existing readable data directory, then removes only its own temporary copy/downloads. No permissions/security settings were changed.

## Principal evidence and SHA-256

| Path | SHA-256 |
| --- | --- |
| `gallery/designs/meridian-enterprise-purchase-order.html` | `faf1c387522e05561ee53c6eb18fb57cc9bbdd2c94b76a901467229bcc30ac94` |
| `gallery/thumbs/meridian-enterprise-purchase-order.png` | `42a05b1a6984e5ee9d207116f855d832b7b52a292bf00b519da9b4298be85b70` |
| `dist/printform.js` (ignored, freshly rebuilt) | `8a2e51ada1a644d3c427a1eb5754fd0a76bf66383d2eed22f58f97e638083f74` |
| Embedded genuine runtime | `689e15ca0870e9699d636029995803fcc1a9a2f416e18f5bcb6a1333b37a1203` |
| `../artifacts/review-final/items-6.pdf` | `36fc2df9a8ea1dfabe31c1dbcd6753babab1100201c6e03e6fee5ee62f4cc69b` |
| `../artifacts/review-final/report.json` | `768f4a734a9ae8cb7c40a00ebf6a5ceb594e257549ec4d481fc548fdd40f2829` |
| `../artifacts/review-final/pdf-barcode-pixels.json` | `9ad0fdccf429862afbeb7b79e6f8accef05c5b042bc31190cc524a883dad1a38` |
| `../artifacts/review-final-portability/report.json` | `fc9c4741ab5d1b332b7f9fbb63edc6038666055e33948d557d3f0b5da80f499b` |
| `../artifacts/review-final-regressions/report.json` | `7c58f4f56439573f7c0f53a74ff2be1e107540abcbe4ac37a5fabc73da8975aa` |

Maintainable sources/data/original artwork: `gallery/designs/assets/meridian/`; focused tests: `tests/gallery/meridian.test.js`. Build provenance: `../artifacts/meridian-build.json`. Full report: `../artifacts/VERIFICATION.md`. Eight PDFs, screen/barcode/mobile images, PDF rasters and detailed geometry: `../artifacts/review-final/`; Gallery evidence: `../artifacts/review-final-regressions/`. Exact hashes for retained evidence: `../artifacts/SHA256SUMS`; delivery file hashes: `../artifacts/review-delivery-sha256.json`.

## Preserved failures, limits and commit blocker

Earlier attempts `../artifacts/verification-01` through `verification-05`, `verification-final`, original logs and `targeted-tests-01.log` remain. In particular `verification-04` preserves the white-background barcode overpaint failure. Its fix adjusts only background vertical geometry, preserving barcode modules/checksum/quiet zones; final pixel review and the strengthened mutation-tested assertions verify the corrected result. Earlier browser path/sandbox/Snap download and Vite test-resolution failures are documented in `../artifacts/VERIFICATION.md`; no failed attempt is counted as a final pass.

Manager resolved the identity blocker by verifying Gallery commit `129f757c2e76e505d1db253e82f703c8b46d8873`: author and committer are `Pi Coding Agent <pi-coding-agent@localhost>`. The same identity is used per commit, without global configuration changes. Independent manager job `e9353ce1-8978-40ce-bc49-07fe9308ae7b` passed at 2026-10-28T09:34:56Z: marker-free/no-dist/poisoned-dist portability, 17 files / 134 tests, full eight-PDF matrix, seven independent PDF barcode decodes and diff/core scope checks. Evidence: `../artifacts/manager-final/` and `../artifacts/manager-portability/`. Manager visually inspected final PO header and six item labels/barcodes; no overpaint remains. Upstream PR112 integration is now locally verified as recorded below; no remote mutation has occurred.

Not tested: full repository suite, complete Gallery Playwright/PWA replay, Firefox/WebKit/Safari, arbitrary customer fonts/data, real printer/scanner/native print dialog, backend/online AI, release/deployment. Earlier dependency install reported 3 existing vulnerabilities (2 moderate, 1 high); no dependency/audit/security changes or new audit claim. Existing Node typeless-package warnings remain.

## Local upstream integration — 2026-10-28 09:45 UTC

Fresh read of upstream main confirmed `71448f7f68bd5827158413ea9ad32d8287f23773`. Fetched and merged locally into the isolated integration branch, preserving reviewed commit `4a0cc35`; no merge conflicts or product/layout changes. The upstream updater, modal, SSOT dialog, sorting, service worker, shell and PWA builder are byte-identical to main. Only catalog-size/newest-entry expectations in newly integrated tests changed from 63/PF-063 to 64/PF-064; the Meridian regression waits for the existing asynchronous modal readiness signal before asserting print is enabled.

Fresh checks: **20 files / 154 tests passed** (Gallery plus focused format/pagination/barcode tests). Browser integration smoke passed: **64 cards with PF-064 first**, purchasing 7, iframe scroll advances, dialog footer remains in viewport, enabled ready print control; default six-row standalone produces **2 A4 pages** with correct rows, totals and separate terms. Five unchanged-template PDF regressions passed. Zero page errors/external requests. Source HTML SHA256 remains `faf1c387522e05561ee53c6eb18fb57cc9bbdd2c94b76a901467229bcc30ac94`; fresh default PDF SHA256 is `e8eb2aeb27c15dd24b6795ce324622b7c470f00d11be57bacbbb3cd360e2b0bb`.

Evidence: `../artifacts/integration-targeted.log`, `../artifacts/integration-smoke-final/report.json`, default PDF and screenshots in the same directory. The first smoke observed the expected new-modal polling delay and failed an immediate assertion; preserved at `../artifacts/integration-smoke/`. After waiting for actual readiness, final smoke passed without changing production behavior. Full 0–200 matrix was not repeated because the exact standalone HTML is unchanged; the independently passed earlier matrix remains applicable to those bytes. Full PWA lifecycle/legacy migration replay and real devices were not rerun in this integration phase.
