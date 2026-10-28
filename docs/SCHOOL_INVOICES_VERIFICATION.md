# School invoices verification · 2026-10-28

## Scope

Inputs were restricted to the verified public PrintForm repository and the authorized adjacent implementation brief. No original uploads, private source, business fixtures, credentials, neighboring workspaces or real school identities were inspected. All added school/student/family names, references, contact details and artwork are newly fictional. There is no AI service integration or new credential requirement.

## Acceptance matrix

Actual Chromium browser / PDF results, using Node **v24.22.0**, the real `PrintForm.formatAll` API and the committed bundled fonts:

| Design | A4 short | A4 long | A5 short | A5 long |
|---|---:|---:|---:|---:|
| PF-058 Modern | 1 | 4 | 1 | 5 |
| PF-059 Preschool | 1 | 5 | 1 | 5 |
| PF-060 Statement | 1 | 5 | 1 | 5 |
| PF-061 Enrichment | 1 | 4 | 1 | 5 |
| PF-062 Premium | 1 | 5 | 1 | 5 |
| PF-063 Bilingual | 1 | 6 | 1 | 6 |

All **24 cases passed**. Counts are measured page counts, not manually sliced content. Short fixtures have four unique lines, long fixtures 44, each appearing once in exact order in both DOM and selectable PDF text. Every final page retains transaction lines along with totals; no detached totals-only page or orphaned table heading.

## Automated evidence

`node scripts/verify-school-invoices.mjs` records `verification.json` and verifies:

- Physical PDF media dimensions **210 × 297 mm** / **148 × 210 mm**, within Chromium PDF unit rounding tolerance (0.3 mm); corresponding DOM sizes within 0.02 mm. DOM/PDF page counts agree, without extra blank pages.
- Independent BigInt reconciliation of line amounts, positive/negative adjustments, illustrative tax and due amount. Short due **63,858 cents**; long due **150,931 cents**, shared across all styles/sizes.
- Exactly one invoice identity per page, useful repeated table headings wherever there are lines, correct page x/y, and visible sample warnings on every page.
- Amount due and masked demo payment details exactly once, on the final page only. QR/SVG load; the QR independently decodes to the reserved example.org demo URL.
- DOM text ranges, column bounds, direct block overlap and 5 mm page-edge safety; actual PDF text bounds use embedded font ascent/descent, not baseline-only estimates. All text is at least **7.5 pt** in the physical PDF. Primary body typography is **9 pt A4 / 8.1 pt A5**; compact labels/payment warnings are 7.5 pt. Minimum critical safety inset observed across the matrix is about **6.085 mm**.
- Actual first/continuation/final PDF pages rasterized for each of six styles at both sizes; short PDFs rasterized too. All six long-review contact sheets and both six-design short overviews were visually inspected: no clipped text, colliding totals, missing Chinese glyphs or artwork over transaction content was observed.
- Chinese headings, student text and bilingual warning remain selectable. Actual cmap coverage of both bundled static CJK fonts is checked by font regeneration and Linux `fc-scan` tests, including Chinese punctuation. No replacement characters or unembedded system CJK font are accepted.
- Six fresh **390 px** mobile loads and keyboard-only paper/dataset transitions, with no horizontal document overflow, stale duplicate rows or pages. Twelve supplementary bounded long-name/unbroken-word/multiline probes across six styles and both sizes. Long fixtures include zero-value and negative credit lines.
- All six offline HTMLs reopened under `file://`, network disabled, exercising all **24 offline combinations**, with zero HTTP(S) requests.

A separate slow-font browser regression delays CJK font requests and confirms the gallery cannot announce an empty auto-formatted document as ready. Unit coverage includes XSS escaping, duplicate IDs, fractional/negative quantities, unsafe integers, optional tax/adjustments and symmetric negative tax rounding.

## Baseline and regression status

- Before implementation: **57 designs**, gallery unit suite **12 files / 45 tests passed**.
- Original 57-design browser audit recorded page counts, dimensions, text hashes, overflow and errors before edits.
- Final 63-design audit compares every original entry with that baseline: **zero differences / zero new issues**. PF-004's existing horizontal-overflow warning remains byte-for-byte represented in the baseline comparison; it is not hidden or fixed by this task.
- Final gallery unit suite: **13 files / 54 tests passed**, including nine focused school-invoice tests.
- Full serial Node 24 build: **297 files passed, 1 skipped; 3,555 tests passed, 9 skipped**. Reproduction uses the project's `npm run build`, which explicitly runs one worker with file parallelism disabled.
- Focused Chromium school, gallery/PWA and PF-055/PF-056/PF-057 regressions: **57 tests passed**, including offline access to all six new gallery designs and delayed-font readiness. Final rerun details are also recorded in the task summary outside the repository.
- No pagination-engine source or existing design source was changed. Only gallery registration/category counts, affected catalogue expectations and the task's new assets/tooling/tests were changed.

## Visual review and limitations

Review the exported `previews/` contact sheets against the task's descriptive visual brief; no original reference image was supplied to this runtime, so pixel-perfect matching is not claimed. The six styles intentionally differ in hierarchy, table structure, brand mark, card shapes, artwork and A5 reflow, not just color.

Chromium PDF output is the acceptance print proof. Firefox/WebKit and physical printers are not certified here. Actual printer margins/background support vary; select matching paper, actual size and background graphics. There is no promise of physical edge-to-edge printing. Custom content beyond the bounded fixtures may need new fit tests and expanded CJK subsets; two-decimal currencies and integer quantities/sessions are the documented data interface. Do not use these fictional samples for payments or tax claims.

PDF.js may report a PostScript-to-WASM optimization fallback for the premium diagonal gradient; its JavaScript fallback renders the same actual PDF and does not affect text/paper verification. Existing jsdom pseudo-element warnings remain visible during the full project unit suite.

Artifacts are generated outside the repository under `../output/school-invoices/`. No push, PR, merge or deployment is performed by this implementation task.
