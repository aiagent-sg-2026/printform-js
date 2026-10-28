# Meridian Enterprise Purchase Order (PF-064)

Original fictional demonstration. No real order, contact identity, bank account or tax registration is represented. All code, clauses, dummy data and original monogram are MIT licensed under the repository LICENSE. Code128 reuses `studio-v2/core/barcode.js` and the pinned MIT JsBarcode 3.12.1 distribution; their provenance is embedded in the generated HTML.

## Authoring

- `sample.json`: editable six-line fictional dataset; SGD is the fixed document currency.
- `model.mjs`: bounded schema, optional-contact defaults, exact cents calculations and count presets.
- `template.mjs`: one PrintForm source stream, atomic items, totals after items, explicit terms page break.
- `controller.mjs`: serialized preview updates, dirty/invalid print lock, bounded import/export and accessible controls.
- `styles.css`: A4 210 × 297 mm with 10 mm margins, 190 × 277 mm engine content, base 9 pt.
- `shell.html`: standalone build shell; `logo.svg`: original fictional monogram.

The generated `../../meridian-enterprise-purchase-order.html` embeds the freshly built genuine PrintForm runtime, application code, CSS, logo, data and MIT notices. It uses no network runtime, module loading, CDN, remote font or secondary paginator. Open it directly with `file://`; use the JSON editor, then **Update preview**. The toolbar is screen-only. On narrow screens the document scrolls horizontally without reducing print type size.

## Supported data

The sample JSON is the schema example. Quantities accept three decimal places; SGD unit prices, line discounts and GST rates accept two. Values must be numeric, finite and nonnegative. Discount and GST are 0–100%; quantities/prices are at most 1,000,000. Each line is rounded half up to cents after its discount. GST is rounded half up on the sum of net lines. Total is capped at SGD 9,999,999,999.99. Prices are not tax inclusive.

Input is at most 1 MiB and 200 items. Descriptions are literal text (up to 12,000 characters), not HTML. A physically over-tall atomic item fails clearly; it is never split, clipped, silently shortened or shrunk. Optional supplier address/email, reference and remarks may be omitted. PO identifiers must be printable ASCII (max 24); fictional item barcode values must contain 4–12 ASCII digits. Layout acceptance also blocks fields that cannot fit. Barcode quiet zones and checksum come from the existing renderer/encoder, not decorative stripes.

Grand Total appears exactly once after the last item; remarks and three blank signature columns follow. Original fictional terms start on a separate engine page. The genuine formatter computes global page numbers for every page, including terms. Page counts are not hardcoded. Gallery metadata describes only the default two-page sample.

Edits immediately invalidate printing and hide stale preview content while leaving measurement geometry intact. Update requests are serialized and revision checked. Invalid import is recoverable by correcting JSON or resetting the sample. A native keyboard print during invalid/pending state prints only a blocked notice, never a stale PO.

## Rebuild and verify locally

Requires the repository's Node/dependencies and an installed sandbox-capable Chromium. No sibling operational files are needed. The build always rebuilds `dist/printform.js` from current source before embedding; existing runtime bytes or timestamps are never accepted as freshness evidence.

```sh
npm ci --ignore-scripts                 # only if dependencies are absent
node scripts/build-meridian.mjs        # rebuilds genuine runtime, then standalone HTML
node scripts/verify-meridian-portability.mjs ../artifacts/portability
DISPLAY=:0 MERIDIAN_HEADFUL=1 MERIDIAN_CHROMIUM=/snap/bin/chromium \
  MERIDIAN_FILE_DIR=/home/ai-agent/snap/chromium/common \
  node scripts/verify-meridian.mjs ../artifacts/verification-final
DISPLAY=:0 MERIDIAN_HEADFUL=1 MERIDIAN_CHROMIUM=/snap/bin/chromium \
  node scripts/verify-meridian-regressions.mjs ../artifacts/regressions-final
node scripts/verify-meridian-pdf-pixels.mjs ../artifacts/verification-final
npx vitest run tests/gallery tests/format-all.test.js tests/measured-pagination.test.js tests/studio-v3-offline-barcode.test.js --maxWorkers=1 --no-file-parallelism
```

The commands above use this VM's existing sandboxed Snap Chromium. Other environments can omit these environment variables to use Playwright's installed browser. Snap cannot read `/srv`; the standalone verifier creates an identical-byte temporary HTML copy in its existing readable data directory and removes only its own copy afterward. It also puts test downloads there. No permission, sandbox or security settings are changed. Both browser helpers inspect actual CDP launch arguments and reject sandbox-disable flags.

The portability helper copies source into an isolated temporary checkout, links installed dependencies, and proves identical builds both without `dist` and with a deliberately poisoned future-dated runtime. It removes only its temporary copy. The PDF pixel helper requires Poppler `pdftoppm`; it independently decodes the PO and all six sample item barcodes from the actual PDF raster. The browser verifier checks text/SVG sibling boxes in screen and print media and deliberately introduces six overlaps to prove rejection before restoring and rechecking.

The generated HTML is not hand-edited. Rebuild after any source edit, and rerun verification. Bulky reports/PDFs/screenshots belong outside the repo in `../artifacts`; the real first-page screenshot is copied to `gallery/thumbs/meridian-enterprise-purchase-order.png`. Test failures remain in their original attempt directory. See root `SUMMARY.md` for actual execution results, hashes and untested surfaces; this README alone is not a claim of test success. Chromium PDF/pixel proof is not physical printer/scanner certification.
