# Studio v3 — structured ERP print forms

Studio v3 0.1.0 is a separate Pilot at `/studio-v3/`. The v2 editor and its
existing release gates remain available at `/studio-v2/`.

## What ships

The blue/white three-column workspace follows the user-selected concept:
Header / Customer / Items / Totals / Footer on the left, an actual A4 HTML
document with selection and page thumbnails in the center, and component
properties plus collapsible Quality on the right. Icons are inline SVG.

- **Design:** start a blank form or invoice, purchase order, delivery note;
  show/hide sections, add/remove/reorder fields and columns, edit labels,
  bindings, static text, column widths, print typography, color and table style.
- **Data:** set an absolute collection pointer (`/items`), row-relative field
  pointers (`./description`) or document pointers (`/customer/name`); apply
  ERP JSON, locale and currency; switch isolated synthetic samples.
- **Validate:** render 0/1/45/100/500-row and long bilingual samples; inspect
  missing fields, invalid numeric data, row identity/order, repeated headers,
  page/footer geometry and overflow. Sample-matrix results clear on edits.
- **Files:** save an editable `.printform.json`, reopen it or a v3 exported
  HTML file, and export a self-contained HTML with both existing runtimes.
  Use Print for the browser's native print dialog or Save as PDF there.
- **History:** edits use the existing CommandBus and monotonic revisions;
  undo/redo support buttons and Cmd/Ctrl Z / Shift Z outside text inputs.

Desktop and tablet support editing. Mobile supports paper preview, thumbnails,
opening existing v3 files, printing and export. The UI uses English; user data
supports bilingual text and the existing five print locales.

## Source and runtime ownership

`manifest.studioV3` is the bounded authoring model (version 1). `model.js`
projects that model to a canonical FormSpec with stable component IDs and to
controlled HTML/CSS in `template.js`. `controller.js` previews operations and
commits through the existing CommandBus. No arbitrary script, eval, formula
engine, free-position canvas or AI provider is introduced.

Preview and export both call the existing `createStandaloneHtml` with the same
`dist/printform.js` and `dist/printform-document.js`. Pagination measures actual
content height. A short sandbox bridge reports the finished HTML pages;
thumbnails clone those pages into scoped shadow DOM and execute no runtime.
Selection overlays are editor-only and are absent from exported files.

The main preview iframe allows scripts and the native print dialog, uses an
opaque sandbox origin, and disallows network access. Host messages validate
the sender window and a monotonic render token. Superseded renders cannot
replace current reports. A new document invalidates queued edits and file reads.

Amounts, rates, taxes, rounding and totals are supplied by the ERP. `/summary`
and item `rate`/`amount` bindings intentionally avoid the v2 sample-specific
financial rules. Studio validates presence/types and formats values; it does
not derive financial values. Synthetic sample fixtures are demonstration data.

## File and data boundaries

Data is kept in the tab's memory; v3 does not use localStorage, IndexedDB,
remote APIs or an autosave service. Save/Export are explicit downloads and
include the active dataset. Synthetic sample switching restores the last
supplied ERP dataset when ERP / current data is selected. A fresh tab starts
with synthetic data and does not inherit another tab's dataset.

Imports are limited to 10 MB, root sample JSON to 2 MB, a block to 30 fields,
and the existing runtime to 500 table rows / 100 logical pages. JSON and HTML
imports regenerate controlled markup from the validated authoring model.
Legacy v2 HTML is opened in v2; v3 does not silently convert or discard its
custom layout. A v3 HTML artifact can be inspected and printed independently.

## Quality limits

Export is available only after the current browser render passes static,
binding and layout validation. This is a human-authored Pilot HTML export;
it does not claim the v2 Agent AI review, provider qualification, native printer
certification, or Production Ready release credit. Review all pages in native
print preview and verify ERP values before actual use.

Item rows stay intact. A row taller than an available page is blocked as an
overflow issue; shorten it or adjust typography. Section order is the fixed
ERP reading order. Fields and columns can be reordered. Footer blocks/totals
use the existing engine's final-page flow and repeat page numbers.

## Verification and release

`npm run build:site` includes v3 and generates invoice/purchase/delivery samples
at `studio-v3/samples/`. The source revision is stamped into the built v3
index as `printform-source-revision`; no service worker caches v3.

`tests/studio-v3.test.js` covers canonical model/binding/history/import safety.
`e2e/studio-v3.spec.js` is part of the existing three-browser CI matrix and
covers fresh blank-to-export, measured row identity/pagination for all starters,
long bilingual content, missing-field recovery, hostile strings, tab isolation,
undo/redo, column changes, interrupted runs, keyboard/dialog focus and responsive
layouts. Preview and standalone export text, row order, page count and geometry
are compared; Chromium also writes an A4 PDF. Native printer output remains an
owner review boundary.
