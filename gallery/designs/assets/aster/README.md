# Aster · PF-065

Fictional three-way procurement review, not an order, invoice, decision or ERP integration.
Original midnight/copper geometric artwork; native A4 landscape, 10.5pt body, 9.5pt administrative chrome.

## Authoring

- `sample.json` and `input.schema.json`: supplied complete input/schema, lossless compact JSON.
- `expected.json`: independent supplied oracle; tests only, never imported by the UI.
- `fixtures.mjs`: deterministic 0/1/24/60/150 inputs and bilingual stress prose.
- `validate.mjs`: strict supplied-schema keywords, references, dates, IDs, import conflicts and safe integers.
- `reconcile.mjs`, `reviews.mjs`: canonical-only cents arithmetic and deterministic case precedence.
- `template.mjs`, `summary.mjs`, `schedule.mjs`, `closing.mjs`, `dom.mjs`: natural measured stream.
- `controller.mjs`: clean source reconstruction; serialized/coalesced final-state-wins formatting.
- `shell.html`, `styles.css`, `logo.svg`: screen controls, native-paper print host, original mark.

Edit these local sources and rebuild. No upload, financial source editor or operational action is exposed.
The standalone HTML embeds data, genuine current-source PrintForm runtime, app, artwork and fonts.
Open it directly from disk; no server or network is needed for the finished sample.

## Build and focused verification

```sh
npm ci --ignore-scripts
NODE_OPTIONS=--max-old-space-size=4096 npm run build:assets
NODE_OPTIONS=--max-old-space-size=4096 node scripts/build-aster.mjs
# Own local server, e.g. python3 -m http.server 4197 --bind 127.0.0.1
CHROMIUM_PATH=/path/to/chrome NODE_OPTIONS=--max-old-space-size=4096 node scripts/verify-aster.mjs
NODE_OPTIONS=--max-old-space-size=4096 node scripts/verify-aster-pdf.mjs
NODE_OPTIONS=--max-old-space-size=4096 npx vitest run tests/gallery tests/active-table-context.test.js tests/measured-pagination.test.js tests/text.test.js tests/text-segmentation.test.js tests/studio-v2/row-continuation.test.js --maxWorkers=1 --no-file-parallelism
```

Browser scripts run sequentially using an isolated Playwright browser; set `ASTER_BASE_URL` for a different own port.
Evidence goes to `../artifacts/`, outside the product. Browser verification also refreshes this design's thumbnail only.
`verify-aster-pdf.mjs` validates actual emitted PDFs against measured monetary field positions, not just text search.
Screenshot crops use the existing PDF.js canvas dependency; no document scaling/retouching is performed.

`build-aster.mjs` always rebuilds the unmodified runtime from source, never trusts stale `dist` output.
It does not run site builds or the full test suite. Normal builds require only existing npm dependencies.
`npm run clean` removes the core dist runtime; `npm run build:assets` recreates it before gallery checks.

## Fonts

`Aster Sans` derives from locally installed static Noto Sans regular/bold (Latin subsets).
`Aster CJK SC` derives from the locally installed static Noto Sans CJK SC face and preserves unified CJK coverage.
All remain OFL 1.1; see `FONT-LICENSE.txt`. Their actual internal family names are renamed for the modified versions.
Redundant lower-codepoint radical aliases sharing unified ideograph glyphs are removed from the CJK cmap:
otherwise Chromium's PDF ToUnicode mapping emits radicals instead of the source Chinese characters.
No input text is normalized/replaced to conceal this problem. PDF extraction is checked against exact source CJK order.

Optional regeneration: a local Python venv with `fonttools` and `brotli`, then `python scripts/build-aster-fonts.py`.
That script reads `/usr/share/fonts/truetype/noto/NotoSans-{Regular,Bold}.ttf` and
`/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc`, face 2; it uses no network or global installation.
The complete unified-CJK repertoire makes the standalone about 15 MB, intentionally larger than text-only samples.

## Evidence boundaries

See `VERIFICATION.md`. Chromium PDF evidence is not hardware print certification or a live procurement policy.
No engine, permission, security or public API contract changes are part of this sample.
