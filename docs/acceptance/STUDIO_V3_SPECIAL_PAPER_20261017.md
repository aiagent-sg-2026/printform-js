# Studio v3 finite special-paper and physical-printer audit — 2026-10-17

## Decision and evidence scope

This is general printform-js Studio evidence, not an ERP integration or a device certification.
The existing 58/80mm receipts, 100×70mm label and 210×140mm finite continuous-stock profiles are reused, not duplicated.
Source inspection and read-only native device discovery are complete. No product/spec defect was demonstrated, so no paper code or browser spec was changed.
No build, test, browser run, driver installation, queue configuration, settings change or print submission was performed by this audit worker.
Current-source runtime acceptance belongs to the parent integration run below; historical passes in the earlier paper documents are not a pass for this run.
Sanitized machine-readable evidence: [STUDIO_V3_SPECIAL_PAPER_20261017.json](STUDIO_V3_SPECIAL_PAPER_20261017.json).

## Native queue versus physical-device availability

The parent already executed `lpstat -p -d` once: exit 1, `lpstat: No destinations added.` and `no system default destination`.
That observation is preserved without rerunning it. It proves no configured CUPS destination/default, **not** that no physical printer exists.

| Read-only observation performed by audit worker | Actual result | Interpretation |
| --- | --- | --- |
| `lpinfo -v` | Exit 0; only `network ipp/http/ipps/https/lpd/smb/socket` entries | Transport backends exist; no concrete device URI returned |
| `system_profiler SPPrintersDataType SPUSBDataType -json` | Exit 0; printers `no_info_found`; CUPS/2.3.4, macOS 27.0.1 arm64; old USB category empty | No printer inventory; empty unsupported legacy USB category alone is inconclusive |
| `system_profiler -listDataTypes` | Exit 0; actual USB category is `SPUSBHostDataType` | Correct category selected rather than mistaking old empty output for hardware absence |
| `system_profiler SPUSBHostDataType SPThunderboltDataType -json` | Exit 0; 2 built-in USB host buses, no attached child devices; 2 Thunderbolt buses, both receptacles report no connected devices | No physical printer identified on these reported buses |
| `ippfind -T 5` | Exit 1; no output after bounded 5-second discovery | No advertised IPP service returned in this window |

No accessible physical printer was identified. Discovery is bounded: sleeping or unadvertised devices, other subnets, Bluetooth and serial devices are not ruled out.
**Physical output is blocked**, not passed/skipped-as-pass. Exact prerequisite: an operator-accessible physical printer supporting the intended stock, a reachable configured destination with recorded driver/IPP media capabilities, permission to print, and an operator to inspect/measure the resulting paper.
No destination was invented and no virtual PDF was substituted for paper. No print job was submitted.
Public/KB evidence must retain protocol names and aggregate counts only: omit device/queue names, URIs, addresses, serials, UUIDs, bus IDs and user paths. Raw native output is not copied into this report.

## Existing media matrix to execute unchanged

All dimensions are width × height in mm. Insets are per side, horizontal / vertical; logical budget excludes these authored insets.
CSS uses 96 px/in; expected PDF dimensions are `mm × 72 / 25.4`, with existing less-than-1-point quantization tolerance.

| Spec / profile | CSS/PDF mm | Insets mm | Logical budget mm | Source/length coverage |
| --- | --- | --- | --- | --- |
| special / `thermal58` | 58 × 120 | 5 / 4 | 48 × 112 | 3 supplied long rows; finite multipage receipt |
| special / `thermal80` | 80 × 160 | 5 / 4 | 70 × 152 | 3 supplied long rows; finite multipage receipt |
| special / `label` | 100 × 70 | 5 / 4 | 90 × 62 | 3 source labels, 3 pages/fragments, embedded Code39 reference asset |
| special / `continuous` | 210 × 140 | 5 / 4 | 200 × 132 | 3 long rows; finite continuous-stock pages |
| additional / `a5wide` | 210 × 148 | 5 / 5 | 200 × 138 | one-row and multi-row |
| additional / `label50` | 50 × 30 | 2 / 2 | 46 × 26 | one-row = 1 page; multi-row = 3 labels, each page equals its source row; no barcode |
| additional / `fanfold280` | 210 × 280 | 13 / 5 | 184 × 270 | one-row and multi-row, finite fanfold pages |
| letter-legal / `letterportrait` | 215.9 × 279.4 | 10 / 10 | 195.9 × 259.4 | one-row and multi-row |
| letter-legal / `letterlandscape` | 279.4 × 215.9 | 10 / 10 | 259.4 × 195.9 | one-row and multi-row |
| letter-legal / `legalportrait` | 215.9 × 355.6 | 10 / 10 | 195.9 × 335.6 | one-row and multi-row |
| letter-legal / `legallandscape` | 355.6 × 215.9 | 10 / 10 | 335.6 × 195.9 | one-row and multi-row |

Run **every row** through Chromium, Firefox and WebKit, in both `direct` and `standalone` modes.
Special: 4×2×3 = 24 cases / 8 Chromium PDFs. Additional: 3×2 coverages×2×3 = 36 / 12 PDFs. Letter/Legal: 4×2×2×3 = 48 / 16 PDFs.
Total: **108 browser cases and 36 real Chromium PDFs expected if all complete**; not observed results.
Firefox/WebKit execute screen and print-media DOM consumers; their lack of `page.pdf` calls is not a skipped test and is not PDF certification. Playwright WebKit is not Safari.app.

### Parent commands (not executed by audit worker)

Use the existing installed environment and browser binaries. Build once, serially, after all integrated changes; `build:site` includes the existing full unit/build chain.

```sh
npm run build:site
npx playwright test e2e/special-paper-matrix.spec.js e2e/additional-paper-matrix.spec.js e2e/letter-legal-paper-matrix.spec.js --workers=1 --retries=0 --reporter=line,json --output=test-results/studio-v3-special-paper-20261017
```

Retain the JSON reporter output and the output directory before another suite overwrites default reporting files.
If host/browser isolation requires separate processes, use the same three full file arguments and the same flags, adding each of `--project=chromium`, `--project=firefox`, `--project=webkit` in turn with distinct output directories. Do not filter profiles, narrow assertions, increase deadlines or retry failures into a pass.
Alternative when no build has run: `npm run test:e2e --` followed by the same file arguments/flags invokes the existing pretest build; do not execute both build routes redundantly.

### Evidence consumers already present

- Fixtures: `tests/fixtures/special-paper.js:3-8,15-69`, `additional-paper.js:4-27`, `letter-legal-paper.js:4-15`.
- `e2e/special-paper-scenario.js:5-83`: direct uses actual validation/binding/formatter; standalone uses actual exporter/runtime, saved `file:` HTML, disabled HTTP(S) and runtime readiness.
- Shared inspection `special-paper-scenario.js:86-139` reconstructs all six source fields by row identity/order and measures actual element/text-Range geometry.
- Existing screen and print consumers reject hidden/clip overflow, transforms and zoom; retain 12px field fonts/RTL; require sheet/content geometry and scroll extents. No silent font reduction or fit-to-page workaround.
- Special spec `17-48,50-95`: labels have one fragment/page per source count, preserved reference image; receipts/continuous have real continuation. Real PDF page tree, dimensions, per-page ID/date/amount, CJK/Arabic inventory, image drawing operations and text bounds are checked.
- Additional spec `18-93`: one-row finite single page, per-source small label page equality, multi-row continuation and equivalent PDF conservation/bounds.
- Letter/Legal spec `15-68`: corresponding geometry/conservation plus PDF text item height of 9pt (12px) and nonempty font-family evidence.
- PDF options are `preferCSSPageSize:true`, `scale:1`, background enabled, header/footer disabled. These bypass Playwright's default fit behavior, not a physical printer's settings.
- Attachments: each executed case emits `*-geometry.json` and PNG; completed Chromium PDF stages emit `.pdf` and `*-pdf-pages.json`; standalone emits saved `*-offline.html` and runtime JSON. A failed case may have only partial artifacts; absence is not success.

## Meaningful boundary gaps, without redundant profiles

The existing thermal profiles test variable **content fragmentation/page count**, but use fixed finite heights of 120/160mm. Neither those three matrices nor the targeted source search contains a thermal consumer for content-dependent roll length or a sweep of alternate finite roll heights.
`specialPaperFixture(profile)` accepts explicit dimensions and derives both wrapper/@page and logical budget; this is a reusable input interface, not evidence that any arbitrary length or driver maximum has passed.
Likewise the 140/280mm continuous/fanfold profiles do not prove endless spool, cut-per-document, perforation alignment or variable final-page feed.
This is a qualification boundary, not a demonstrated production defect: no unrequested profile or redundant browser spec was introduced.
If advertising alternate finite roll lengths, first supply the exact intended height(s), stock and driver limits, then exercise the same direct/offline/PDF conservation and no-clipping/no-zoom consumers with matching logical budget and host paper rules. Do not advertise automatic content-sized rolls from current fixed-height results.
Label one-per-source and no-clipping/no-silent-zoom consumers already exist and must not be replaced by screenshots or wrapper count alone.
Barcode evidence proves source asset retention/image drawing only, never scanner grade, successful decoding or GS1 compliance.

## Official requirements read for this audit

1. [CSS Paged Media Level 3](https://www.w3.org/TR/css-page-3/) and [CSSWG editor's draft §§1–2, 7.1, 7.4](https://drafts.csswg.org/css-page-3/): the page box has finite width/height; physical non-printable areas depend on the device. Two lengths specify width then height. Mismatched sheet handling can rotate, scale, slice or clip: CSS size alone cannot certify paper output. This remains draft guidance, not a conformance certificate.
2. [Apple: unusually sized paper](https://support.apple.com/guide/mac-help/print-on-unusual-sized-paper-mchlp15541/mac): custom paper sizes are selected in Print; availability depends on app/printer. User-defined zero margins are an application troubleshooting option, not proof that hardware can mark the entire sheet.
3. [Apple: print options](https://support.apple.com/guide/mac-help/choose-print-options-mh26678/mac): paper size, Scale to fit, tray/media/quality, pages per sheet and orientation are separate controls. Actual output must record matching media and 100% scale with Scale to fit off, one page/sheet, correct feed/tray, no header/footer.
4. [CUPS options](https://www.cups.org/doc/options.html): media size/type/source are printer-dependent; `lpoptions -p <actual-destination> -l` is a future read-only capability query, once a real destination exists. `Custom.WIDTHxLENGTHmm` is valid only when that destination supports Custom. Do not issue a speculative `lp` command now.
5. [CUPS lpinfo](https://www.cups.org/doc/man-lpinfo.html): `-v` enumerates devices known to the server; protocol entries alone are not reachable device endpoints. Driver/backend deprecation also prevents assuming legacy PPD guidance is universal for IPP paths.
6. [Epson TM-T88VII Rev. G](https://files.support.epson.com/pdf/pos/bulk/tm-t88vii_trg_en_revg.pdf), pp52,97,117–121: 79.5±0.5mm paper has 72.2±0.2mm standard printable width; 57.5±0.5mm paper has 50.8±0.2mm, with asymmetric approximately 3.7/3.0mm edges. Mac/Linux CUPS raster drivers and cutter controls are distinct from CSS. Changing from 80 to 58mm involves the guide and software settings and the manual warns against changing back after printing; this audit does not alter hardware. 70mm fixture content does not fit the separate 67.7mm 48-column mode merely because it fits standard mode on paper.
7. [Zebra ZD421 specifications](https://www.zebra.com/content/dam/zebra_dam/en/tech-specs/zd421-tech-specs-en-us.pdf), pp1–2,5: 203/300dpi print widths 104/108mm; media width depends on d/t/c submodel; gap/black-line/notch sensing, roll/fanfold and cutter/peeler limits require real settings. 991mm maximum print length does not make 210mm-wide stock fit. Zebra explicitly requires application qualification with actual supplies/settings.
8. [Playwright PDF API](https://playwright.dev/docs/api/class-page#page-pdf): `preferCSSPageSize` defaults false and otherwise fits content; `scale` defaults 1. Existing explicit options and PDF parsing verify browser artifacts, not native printing.

## Physical acceptance once prerequisites exist

For each actually supported matrix row, retain a private device capability record (model/submodel, firmware, driver/IPP path/version, DPI, supported media bounds, non-printable edges, tray, sensor/cutter/calibration mode) and sanitized public alias only.
Keep screen, standalone and PDF artifacts from the same source; record actual OS/browser version and native print settings separately. Print only after permission, not as part of this read-only audit.
Measure physical width/height, content offsets and fiducial/text size; compare first/last source identity and all supplied date/amount strings, CJK/RTL appearance, source label/page count, blank/duplicate pages and any crop. Record feed/perforation/label-gap registration and cutter behavior only when that actual device supports them.
Choose measurement tolerances from the identified device/stock specification before printing; do not reuse PDF's 1pt quantization tolerance as physical feed accuracy. Keep ruler photos/scans and operator findings linked to exact media/driver settings.
A rejected custom size, substituted stock, shrink-to-fit, clipped glyph, extra/missing label or feed drift fails that device/profile. Do not relax source conservation or claim certification for another OS/device.
Receipt/label hardware cannot qualify Letter/Legal by shrinking; a separate sheet printer with the required stock/tray is necessary. No ESC/POS/ZPL, statutory, production or universal-font claim is made.

## Parent execution record — observed integration results

2026-10-17: isolated tracked snapshot of base `f6e5f8a430b4b5244cb297966f3bef735f277a42` plus the owned service/logistics integration overlay. This was not yet a deployed commit. Node24 `npm run build:site` passed 244 test files / 2,778 tests; 9 opt-in tests skipped.

| Check | Actual outcome | Retained evidence |
| --- | --- | --- |
| Special paper | 24/24 passed; 8 actual Chromium PDFs | `report-font-context.json`, companion JSON PDF hashes |
| Additional paper | 36/36 passed; 12 actual Chromium PDFs | Same report and actual attachment bytes |
| Letter/Legal | 48/48 passed; 16 actual Chromium PDFs | Same report and actual attachment bytes |
| Paper subset total | 108 passed, 0 failed, 0 skipped, 0 retries; 36 PDFs | `/tmp/printform-industry-task-20261017/report-font-context.json` |
| Native queue/device discovery | No usable configured/discovered destination or physical printer identified | Preserved sanitized `queueEvidence` / `nativeObservations` |
| Physical prints | Blocked; 0 jobs | Missing actual device, supported stock, destination capabilities and measurement operator |

Actual browser command: Node24 `playwright test --config verification.config.mjs`, workers1/retries0/test timeout45000; all three existing paper specs remained unchanged. The same full report also contains 13 passed / 2 failed business cases (Firefox HTML-reopen lifecycle); those failures are retained, not relabeled or counted as paper successes.
Report SHA-256: `a4335ff143ca958330662105d479bea6a4a3a99e01e356ab9e437a17acf42360`; generated pagination runtime SHA-256: `e03c592a250e973bee4ddc1be71dfd3cf5ff19997ad20d18ee801008d9501fcf`.
The companion JSON retains every actual PDF's name, byte count and digest. These browser/PDF results do not certify physical printers, arbitrary roll heights, cutter/feed/scanner behavior, all fonts or Studio UI media beyond its declared picker.
Subsequent business-only verification retained the same runtime and all facts/geometry/PDF checks: five kinds × three engines passed 15/15 with zero retries and five actual PDFs (`report-business-live-dom.json`). The consumer reads the current live iframe's main-world DOM after render/load; no copied bridge HTML, sandbox weakening, Firefox exception or deadline increase. This does not overwrite either earlier failed full report or change the paper/hardware verdict.
