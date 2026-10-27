# PF-056 — fictional DemoBank four-page statement

## Purpose and boundaries

This local Finance gallery sample is for UI/UX and PrintForm testing only. It is
not a banking document, a financial product, an official rate sheet or advice.
Every page carries **SAMPLE DOCUMENT — NOT VALID FOR BANKING USE** in selectable
text. ALEX TAN, the address, merchant names, identifiers, dates and values are
synthetic. The SVG mark and geometric banner are original code-native artwork.
The QR encodes only `https://demobank.example/demo`, a reserved, non-payment
example domain. No online dependency is required to display or print the export.

## Structure / safe impact

- Entry: `gallery/designs/demobank-fourpage-statement.html`.
- Assets and reusable JSON: `gallery/designs/assets/demobank/`.
- `data.json` is canonical; `data.js` is the synchronized classic-script delivery
  copy so both file URLs and gallery service-worker offline loading work.
- `money.js` contains integer-cent calculations; `statement.js` renders the
  summary and transactions; `information.js` renders illustrative terms.
- Three **document sections**, not four manually authored page containers, use
  the actual PrintForm-JS engine. Summary and information each fit one page.
  The transaction section is a single ordinary row stream. Its third account
  opening fits on the first transaction page; its atomic payment/review block
  overflows naturally, with the native transaction header repeated.
- The engine measures at real A4 width; mobile preview scaling starts only
  after pagination. Print media disables that scaling.
- Native `.prowheader`, `.prowitem`, per-table context, repeated header/footer
  and public `PrintForm.formatAll()` are used. No engine, core defaults,
  generator contract or pre-existing design is changed.
- Long information blocks use ordinary atomic semantic rows rather than PTAC
  word splitting, which would repeat author min-height spacing on fragments.
- The existing large gallery manifest retains its schema and all 55 original
  entries. New source/test/helper files stay below 300 lines.

## Arithmetic contract

All monetary input values are nonnegative integer minor units. Charge values
increase the amount owed; payment and credit values reduce it and display CR.
Opening balances are not reclassified as new charges.

| Account | Opening | Charges | Payments | Credits | Closing | Minimum |
|---|---:|---:|---:|---:|---:|---:|
| DEMO DAILY | 1,250.00 | 670.50 | 1,000.00 | 42.00 | 878.50 | 43.93 |
| DEMO BALANCE TRANSFER | 2,400.00 | 12.00 | 400.00 | 0.00 | 2,012.00 | 100.60 |
| DEMO FLEX | 860.00 | 0.00 | 160.00 | 0.00 | 700.00 | 35.00 |
| Combined | 4,510.00 | 682.50 | 1,560.00 | 42.00 | **3,590.50** | **179.53** |

Minimum = 5% of each closing balance rounded up to cents, with a RM25 floor,
capped at that account balance. Sum the three minimums, not a separately rounded
combined percentage. No overdue or over-limit amount applies. The only posted
fee is the RM12 transfer-plan fee. USD20.00 × fictional MYR4.60 = RM92.00, without
an added conversion fee. There are exactly 17 transaction IDs.

Repayment examples are independent of the statement balance: RM1,200 principal,
6% annual **flat simple** interest, original principal basis, no compounding,
fees or new spending. For 6/12/18 months the interest is RM36/72/108 and the total
is RM1,236/1,272/1,308. Regular instalments are rounded down to cents; the final
instalment absorbs the remainder. For 18 months: 17 × RM72.66 + RM72.78 = RM1,308.
These are not effective APR examples or recommendations.

## Typography / fidelity limits

The sanitized measurement source records Dax Regular/Bold/Italic, but no
licensed Dax font was supplied. It was not extracted, reconstructed or included.
Unmodified **DejaVu Sans Condensed** regular/bold/oblique fonts are redistributed
with `FONT-LICENSE.txt` (Bitstream Vera permission; DejaVu changes public domain).
The offline HTML embeds the same fonts and license. SVG logo lettering uses a
system sans-serif fallback, not the source trademark.

Original geometry: 595.44 × 841.92 pt. CSS uses standard A4 at 96dpi; Chromium's
PDF serializer rounds to a 594.96 × 841.92 pt MediaBox. This is A4 within 0.5pt,
not an exact original-width claim. Horizontal geometry is defined in points;
transaction columns follow the measured original grid. Some replacement labels
need 6.5–7.3pt versus measured 8pt Dax; headings use 9–10pt. Both font metrics and
content differ, so pixel-perfect equivalence is expressly **not** claimed.

## Reproduction

Node 24 is required in this environment. Use the cached Chromium path rather
than downloading a browser. Heavy tests are serial.

```sh
export PATH=/home/ai-agent/.nvm/versions/node/v24.22.0/bin:$PATH
export CHROMIUM_PATH=/home/ai-agent/.cache/ms-playwright/chromium-1228/chrome-linux/chrome
npm ci --no-audit --no-fund
node scripts/sync-demobank-data.mjs --check
npm run build
node scripts/export-demobank.mjs ../output/demobank-statement-offline.html
# Verification-only QR decoder dependencies stay outside the repository:
npm install --prefix ../output/verification-tools --no-save --no-audit --no-fund qrcode jsqr pngjs
node scripts/verify-demobank.mjs
python3 scripts/compare-demobank.py ../input ../output
```

The committed QR was generated with `qrcode` in SVG mode, medium error
correction and a four-module quiet zone. Verification uses the independent
`jsqr` decoder on rendered pixels, never the SVG label. The dummy barcode was
created by the repository's existing CODE128 encoder for `DEMO-0042` and is
intentionally visually stretched in its narrow reference slot; it is not a
banking reference or a certified scanner target.

Unit tests independently derive account sums, minimums, foreign conversions and
repayment schedules. Browser checks verify ordered transaction conservation,
page count, repeated headers, section continuation, no clipping/overlaps/footer
collisions, page numbers, selectable PDF text and bounds, QR decoding, offline
reload and fresh mobile-load print geometry. `e2e/demobank-statement.spec.js`
provides focused Chromium regressions; gallery E2E also opens PF-056 offline.

## Evidence / comparison method

`../output` contains the PDF, standalone HTML, all four page screenshots,
region zooms, mobile screenshot, structured layout/PDF findings, comparison
JSON and an English verification report. Private reference renders, masks,
side-by-side images and red/blue overlays remain **outside git**.

`compare-demobank.py` rasterizes both PDFs at 144dpi (0.5pt sampling). It extracts
long black rules, a text-free strip through gray bars, generic-label positions,
font-size changes and page dimensions. Raster masks exclude all source/target
text boxes, all supplied graphic exclusions, new artwork, QR and footer safety
text. All text is excluded from raster scoring because even generic labels have
different licensed font metrics; those labels are instead measured separately.
The reported foreground-union MAE/difference fraction is descriptive, not a
pass threshold or a perceptual similarity score. Nearest-rule matches are
explicitly heuristic; side-by-side and region inspection are also required.

No reference PDF, private input geometry or reference rendering is committed.
The comparison cannot certify equality to unavailable original private values.
Only synthetic provenance and reserved endpoint/asset inventories are checked.
Physical printers and browser engines other than the tested Chromium are not
certified. The supplied dataset is exactly four pages; arbitrary longer or
localized datasets are not promised to retain four pages.
