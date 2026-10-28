# Six fictional school invoices · PF-058–063

Six editable HTML/CSS/JSON designs in the **Sales** category. Each style has one PF number and supports portrait A4 and A5, with single-page and naturally overflowing multi-page fixtures. Existing PF-001–057 and the pagination engine are unchanged.

| Number | Design | Distinct layout / original art |
|---|---|---|
| PF-058 | Modern School Invoice | Blue shield/book crest, right-aligned identity, gridded four-column fees, blue student card |
| PF-059 | Preschool & Childcare Invoice | Tree mark, cream/green rounded cards, original sun/bird/giraffe/tree footer scene |
| PF-060 | School Fee Statement | Formal crest, serif school identity, genuinely two-column description/amount statement, boxed notice, no illustration |
| PF-061 | Tuition & Enrichment Invoice | Open-book mark, coral side stripe, orange Sessions table and programme card |
| PF-062 | Premium International School Invoice | Centred crest/serif identity on A4, navy/gold corner, gold due bar, navy footer with original campus line art |
| PF-063 | Bilingual Academy Invoice | Abstract seal, plum/rose, original blossom accents, selectable Chinese and English on the same page |

## Preview

```sh
npm ci
npm run build:assets
python3 -m http.server 4185 --bind 127.0.0.1
```

Open `http://127.0.0.1:4185/gallery/` and search PF-058 through PF-063. Each design has keyboard-native **Paper size**, **Dataset**, and **Print / Save PDF** controls. For reproducibility, append `?paper=A5&sample=long` to its design URL; defaults are A4 / short. Controls disappear when printing.

Example: `gallery/designs/bilingual-academy-invoice.html?paper=A5&sample=long`.

A5 uses different grids, header hierarchy, spacing, artwork and payment arrangement; it is not a scaled A4 DOM. Only the screen preview is fitted after pagination. Print is always unscaled physical A4/A5, with `@page` margins zero and essential text safely inset. Enable print backgrounds, disable browser headers/footers, use 100% / actual size and select the matching paper. Decorative edge backgrounds are not a promise of physical borderless printer support.

## Data and maintenance

Everything shared lives under `gallery/designs/assets/school-invoices/`:

- `data.json`: canonical fictional transaction, customer/student metadata, four short lines, signed adjustments, bounded 44-line long fixture and six style identities.
- `invoice.schema.json`: reusable JSON Schema; integer quantities/sessions, signed integer unit cents, optional signed adjustments, optional illustrative tax in basis points, two-decimal currency code, payment metadata.
- `data.js`: generated browser wrapper, **not** a second source of truth. After editing JSON run `node scripts/sync-school-invoices.mjs`; CI checks equality.
- `math.js`: safe-integer validation, unique IDs, line multiplication, signed adjustments, symmetric half-away-from-zero tax rounding and final amount. Verification independently recomputes with BigInt.
- `template.js`: semantic PrintForm sections, one unsliced source row per line. Header, student info and table headings repeat; totals and demo payment appear only on the final page. A keep-with-next hint binds the last pair of rows and their final footer when it fits.
- `art.js`: original inline SVG logos and footer scenes. No reference screenshots or source customer artwork.
- `controller.js`: waits for bundled fonts and QR, then loads the **unmodified** engine and calls `PrintForm.formatAll({force:true})`. Each switch replaces the previous source/output stream. Delayed engine loading prevents an empty auto-format from publishing gallery-ready state.
- `invoice.css`, `themes.css`: shared physical typography/spacing plus distinct style-specific layouts. Newly authored text/code files stay below 300 lines. The existing large manifest is deliberately not reformatted.

Optional boundary-data testing uses `window.SCHOOL_CUSTOM_DATA` followed by `await window.SCHOOL_RERENDER()`; this is not a new app integration. Custom input must follow the schema and fit the engine's measured-content limits. HTML-sensitive transaction strings are escaped.

The supplied short transaction totals SGD **638.58**; the same long transaction totals SGD **1,509.31** in every style/size. Credits remain negative; free lines remain zero. Illustrative 2.5% tax is explicitly not a legal tax or registration claim.

## Safety and resources

Every page says **SAMPLE — NOT VALID FOR PAYMENT**, plus Chinese on PF-063. All identities and contacts are fictional. The account is `DEMO-XXXX-NONVALID`; there are no phone, banking, tax-registration or business identifiers. The QR independently decodes to `https://example.org/demo-school-invoice`, never a payment payload. It was generated with the public MIT `qrcode` CLI; decoding is checked using the Apache-2.0 `jsqr` development dependency.

Latin fonts reuse existing licensed DejaVu assets. Two bundled static Noto Sans SC subsets (about **40 KB combined**) cover every fixture CJK character and Chinese punctuation. They are renamed **Demo School CJK**, licensed under SIL OFL 1.1; see `FONT-LICENSE.txt`, `FONT-PROVENANCE.md` and `cjk-glyphs.txt`. They embed as searchable CID TrueType PDF fonts, not Type 3 outlines. No system fonts were installed. Additional custom Chinese characters require extending the subset.

Optional font regeneration (not required by builds): create a local Python venv, install `fonttools brotli` there, then run `scripts/build-school-invoice-fonts.py`. It fetches only the official Google Fonts subset API and OFL, instantiates static weights and asserts actual cmap coverage. Normal builds and offline HTML need no network.

## Export and verification

```sh
node scripts/export-school-invoices.mjs
# Keep the local static server on port 4185 running:
node scripts/verify-school-invoices.mjs
node scripts/package-school-invoices.mjs
npm test -- --run tests/gallery --maxWorkers=1 --no-file-parallelism
node scripts/build-site.mjs
npx playwright test e2e/school-invoices.spec.js --project=chromium --workers=1
```

`SCHOOL_BASE_URL` overrides the verification server URL; optional first arguments override output directories. Outputs default to `../output/school-invoices/`:

- `offline/`: six self-contained HTMLs, each retaining both paper/dataset controls, font licenses, SVG/QR and engine; verified under `file://` with networking disabled in all four modes.
- `pdf/`: all 24 physical-paper PDF exports.
- `rendered/`: actual PDF rasterizations of every short page and first/continuation/final long pages for each style and both sizes.
- `previews/`: A4/A5 six-design overviews and six first/continuation/final review sheets.
- `artwork/`: original marks and scenes exported as standalone SVGs.
- `verification.json`: per-case measured page counts, dimensions, arithmetic, minimum font and safety geometry; mobile, keyboard, boundary and offline checks.
- Three compact ZIPs: source with shared fonts once, 24 PDFs, and six standalone HTMLs. The source ZIP is a task overlay for a clean public repository checkout, not a second full application distribution. No raw references, private inputs, node_modules or tooling venv are packaged.

See [verification evidence and limits](SCHOOL_INVOICES_VERIFICATION.md). A parent reviewer handles any push or PR; this task does not deploy, push or merge.
