# Integrated A4 and visual-authoring acceptance

## Candidate contents

This local candidate combines visual-capability baseline `89272b4` with the ten
A4-layout change `79305e1`. It also preserves the previously uncommitted
`studio-v3-boss-demo.spec.js` assertion for “Image support is not confirmed”.

The integration retains both closed `layoutPreset` and `tableStyle` validation.
The generated CSS order is base theme, A4 preset, explicit section grid, then
explicit table-body fill. A high-specificity custom-header reset prevents preset
registration/address positions from creating unexpected implicit grid columns.

A deterministic request check now inspects the final candidate's table-body fill,
rather than trusting its summary or checking only an accent-color diff. It covers
common named colors, Chinese color aliases, exact three/six-digit hex requests,
clearing, natural row-color wording, reviewed element comments, destination colors,
precise hex refinements, and already-satisfied colors with other edits. Body/text
clauses retain their own targets; ambiguous body-color alternatives fail closed.
Unspecified or modified shades require an actual body-fill edit. This is a bounded
intent check, not a claim to understand every natural-language color description.
Read-only answers, selection authority and financial-value guards remain separate.

Paper navigation now disables impossible directions on the first/last page,
single-page documents, and pending/blocked renders. Clicked paper selections,
thumbnails and scroll navigation synchronize the same page state.

## Local evidence, 2026-10-03

- `npm run build:site`: exit 0; 137 test files / 1,017 tests passed, followed by all
  asset, document-runtime and static-site builds.
- `npm run check` and `npm run check:agrun`: passed.
- All three generated v2 sample protocol validations passed, including runtime,
  pagination-runtime and content hashes. These do not establish browser geometry.
- `git diff --check`: passed. Every `studio-v3/*.js` file is at most 300 lines.
- Final focused checks: 85 tests passed. Independent bounded source review passed
  70 tests with matching source hashes and no remaining reproduced blocker. An
  independent A4 check also passed 40 header-grid combinations, 33 data-scenario
  round trips and 30 invalid-design rejections. None ran a real browser.
- Local Node was v24.19.0. Existing workspace dependencies were reused; all direct
  installed versions match the committed lockfile. Hosted CI performs a fresh install.
- Five affected browser specs discover 105 engine-specific test executions across
  Chromium, Firefox and WebKit; full discovery lists 852 executions in 104 files.
  Discovery is not browser execution.

New regression coverage includes padding-only and blue-row proposals rejected for
a yellow-row request; bounded repair through two incorrect proposals; real final
body fill across all ten A4 presets; selected header-grid restoration; coherent
fresh-invoice startup; and file serialization for quotation, receipt and purchase
invoice. Reload continues to start a fresh invoice. It is not document autosave.

## Browser transfer and commands

Use the exact committed source tree and its lockfile. Do not transfer local
`node_modules`, credentials, browser profiles or database files. The source includes
all synthetic parser fixtures under `e2e/fixtures/`, the ten templates and fictional
business catalogue. No user screenshot or customer document is required.

The normal repository PR workflow installs the browser engines and runs the exact
static build. On an already authorized execution environment:

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
GITHUB_SHA=$(git rev-parse HEAD) npm run build:site
npx playwright test --workers=1
```

The focused acceptance set is:

```sh
npx playwright test e2e/studio-v3-a4-presets.spec.js \
  e2e/studio-v3-table-style.spec.js e2e/studio-v3-visual-capability.spec.js \
  e2e/studio-v3-boss-demo.spec.js e2e/studio-v3-exploratory-regressions.spec.js \
  --workers=1
```

Use `scripts/serve-site.mjs` with `site-dist` for browser inspection. Keep the build's
revision-bound `studio-v3/releases/` and PDF worker chunks intact. Collect the full
`test-results/` directory, screenshots, trace ZIPs, exported HTML/PDF, downloaded
project bytes, and the actual runner exit status. Never accept a Save toast alone.

## Open acceptance gates

1. Independent review of the exact integrated commit/tree.
2. Exact-head Chromium/Firefox/WebKit execution, including interrupted/repeated
   flows, first/last/single-page boundaries and actual download/Open/re-save.
3. Human visual inspection of all ten A4 layouts, long names, short/empty/long
   collections, multipage row sequence, clipping, amounts and exported PDF pages.
4. Real model text, text-PDF, image and scanned-PDF requests through the already
   registered origin, comparing requested effects with actual rendered output and
   completing explicit Preview, Apply, Undo and Save/Open for the required forms.
5. Physical printing remains a separate unverified stage.

The live-model ledger remains unchanged: two text-only Sends on the older public
revision; no live visual-media request and one incomplete Apply/Undo run. Neither
this build nor the mocked-provider E2E scripts establish live model perception.
The previously denied local Chromium launch and cloud local-URL routes are not
retried through weakened security settings. This local integration did not push,
publish, merge, deploy, transmit references, or invite user acceptance testing.
