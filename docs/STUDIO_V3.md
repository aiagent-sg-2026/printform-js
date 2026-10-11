# Studio v3 — structured ERP print forms

Studio v3 0.2.0 is a separate Pilot at `/studio-v3/`. The v2 editor and its
existing release gates remain available at `/studio-v2/`.

Complete built-in coding-agent target: [architecture and delivery](STUDIO_V3_CODING_AGENT_PLAN.md), [proposed contracts](STUDIO_V3_CODING_AGENT_CONTRACTS.md), [acceptance gates](STUDIO_V3_CODING_AGENT_ACCEPTANCE.md) and [task ledger](../TASK.md). Source execution and broader workflow coverage remain planned.

## What ships

The blue/white three-column workspace follows the user-selected concept:
Header / Customer / Items / Totals / Footer on the left, an actual A4 HTML
document with selection and page thumbnails in the center, and component
properties plus collapsible Quality on the right. Icons are inline SVG.

- **Design:** start a blank form or invoice, purchase order, delivery note;
  show/hide sections, add/remove/reorder fields and columns, edit labels,
  column widths, print typography, color and table style. Properties and Data
  binding are separate tabs; binding explicitly chooses Bound value or Static text.
- **Data:** set an absolute collection pointer (`/items`), row-relative field
  pointers (`./description`) or document pointers (`/customer/name`); apply
  sample JSON, locale and currency; switch isolated synthetic samples. The wide
  workbench offers a collapsible field tree, typed field tables, paged item editing,
  a path picker and
  Advanced JSON with parse-error line/column positions. The field tree shows
  document paths, array collection paths and first-record row paths; Use proposes
  a compatible binding without committing until Apply binding/collection.
- **Validate:** render 0/1/45/100/500-row and long bilingual samples; inspect
  missing fields, invalid numeric data, row identity/order, repeated headers,
  page/footer geometry and overflow. Sample-matrix results clear on edits.
- **Files:** save an editable `.printform.json`, reopen it or a v3 exported
  HTML file, and export a self-contained HTML with both existing runtimes.
  Use Print for the browser's native print dialog or Save as PDF there.
- **History:** edits use the existing CommandBus and monotonic revisions;
  undo/redo support buttons and Cmd/Ctrl Z / Shift Z outside text inputs.

Desktop, tablet and mobile support editing. At widths up to 900 px, Structure
and Properties open as drawers with Escape/backdrop close and focus return.
Fit page, Fit width, 100%, incremental zoom and panel/thumbnail toggles affect
only the editor view; the validated last zoom choice is kept in localStorage,
defaulting to Fit page, and fit modes recompute when the viewport/panels change; horizontal paper panning never changes print geometry.
In Design the structure panel starts hidden; the Structure toggle opens it and that
choice is remembered in localStorage (a `0/1` UI preference, never document data).
Data and Validate always show their left panel, which holds the sample and dataset lists.
The current-page indicator follows navigation and scrolling. The UI uses English; user data
supports bilingual text and the existing five print locales.

## AI layout editor

The browser sidepanel uses the pinned upstream `AgentHarness` and
`MemorySessionRepo` from `@earendil-works/pi-agent-core@0.85.1`, with a `pi-ai`
provider extension. Pi is TypeScript/JavaScript. The coding-agent CLI's shell
and filesystem are not installed or exposed. v2's embedded Designer remains
AGRUN; its PI-00..04 qualification modules are useful prior art, not the v3 UI.
This slice does not claim completion of v2's full direct-BYOK migration.

The owner-selected GPT Server Demo is the only v3 provider. Existing
`github-pages` registration is reused: browser CORS supplies the exact Origin;
`POST /demo/session` issues a short-lived memory-only token, `/demo/v1/models`
supplies the model aliases (only `demo-` aliases of a safe shape, at most eight; `demo-auto`
is the default and is listed first), and `/demo/v1/responses` returns `output_text` carrying a JSON envelope per bounded step.
Text requests stream server-sent events, but only to show progress ("Waiting for the AI
service", then received characters and seconds, silent for screen readers): the envelope is
parsed once, from the `response.completed` event, by the same rules as a plain body. Image
requests are not streamed until streamed images are verified, and a JSON answer to a stream
request is read as a plain body. Reasoning is opaque (encrypted) and never shown. Failures
are named from the HTTP status and the gateway's own code (network unreachable, origin not
registered, rate limit, service disabled, no provider available, slow gateway) and each
has its own message. Every gateway request has its own timeout (15 s for model discovery,
60 s for a model request, including its session and the one 401 refresh). A single-step Send is
bounded by their sum (225 s) and at most three model requests. Work-in-steps runs instead use
a 60-minute deadline, 1000 tool-call cap and accounted-token budget. A timeout is a failure, never a retry. No native provider tools, arbitrary schema, files, background,
web search, gateway key or private `/v1/*` request is sent. A first 401 refreshes
once; authoring repair is capped and disclosed. No model fallback occurs: a default the
user never changed adapts to the aliases the gateway offers, but a model the user chose
that is no longer offered stops the Send, refreshes the list and waits for a new Send.

The panel displays the selected alias and recipient notice; there is no initial-JSON preview control.
Send deliberately accepts the adjacent notice; there is no consent checkbox.
The owner-requested framework-native authoring surface is described in
[Authoring contract](STUDIO_V3_AUTHORING.md) and [Pi chat](STUDIO_V3_AI_CHAT.md).
It includes stable element references/comments, label/value typography, structural
fields/columns, bindings, section/page layout and embedded local raster assets.

A single-step Send is bounded to three model requests and three real local
preview inspections, with a code/geometry-only dynamic diagnostic boundary. Step-mode tools
discover their actual limits and bundled guide from the [release-bound registry](STUDIO_V3_AGENT_REGISTRY.md).
The previous reviewed context and model proposal may be resent for repair.
Questions remain read-only, in steps under a read-only grant or in the single-step flow. Local tools build one unapplied candidate and a
complete diff. Above 900 px the unapplied candidate is previewed on paper and
locally checked automatically once the response arrives; at 900 px and below
Preview stays a button because it reveals the full-screen paper. Apply is always an
explicit click and stays disabled until that preview check passes. CommandBus commits
one revision with scoped Undo after current validation and draft protection.
While a request runs the wait is shown inside the conversation (a hidden-from-readers
copy of the status line). The card says "Previewed on paper" once the preview passed. A
successful Apply clears the element references, which pointed at the replaced revision;
a failed Apply keeps them, and a hand edit still marks them outdated. Only the newest
failed request offers Edit & resend. For image references, Check image support asks the
gateway for model metadata only; afterwards the panel says whether the gateway reported
image support for the chosen model instead of repeating the prompt to check.
ERP data/calculations do not change, and existing financial-bound fields cannot
be replaced by model-authored literal values. There is no model code, shell,
filesystem, arbitrary HTML/CSS/JavaScript or automatic commit capability.

Earlier provisional probes returned HTTP 403 and were stopped without model
inference. That dated blocker was superseded by the owner-approved PR3 release
at main `f0e02d7`: on 2026-10-01 21:01 UTC, the real public page completed
session 201, model discovery 200 and one fictional `demo-fast` inference 200,
then preview/apply/undo/save/reopen. Exact main CI
[36921811288](https://github.com/yapweijun1996/printform-js/actions/runs/36921811288)
passed. This is dated release evidence, not a guarantee of future provider
availability. The PWA slice changes no project/origin registration, grants,
credentials or gateway configuration; its deterministic upgrade tests use
synthetic transport without sending document data or model requests.

## Source and runtime ownership

`manifest.studioV3` is the bounded authoring model (version 1). `model.js`
projects that model to a canonical FormSpec with stable component IDs and to
controlled HTML/CSS in `template.js`. `controller.js` previews operations and
commits through the existing CommandBus. No arbitrary script, eval, formula
engine or free-position canvas is introduced. The AI editor uses the bounded
layout proposal flow described below.

Preview and export both call the existing `createStandaloneHtml` with the same
`dist/printform.js` and `dist/printform-document.js`. Pagination measures actual
content height. A short sandbox bridge reports the finished HTML pages;
thumbnails clone those pages into scoped shadow DOM and execute no runtime.
Selection overlays are editor-only and are absent from exported files.

The main preview iframe allows scripts and the native print dialog, uses an
opaque sandbox origin, and disallows network access. Host messages validate
the sender window and a monotonic render token. Superseded renders cannot
replace current reports. A new document invalidates queued edits and file reads.

The document is assigned to the frame once, never through an empty reset. A
busy browser can drop a `srcdoc` navigation, leaving an empty document that
never reports, so the bridge sends `hello` on start. Without it within 4 s the
document is assigned again (twice in total), after which the render is blocked
as `PREVIEW_NOT_STARTED`. A started preview that still fails to finish within
25 s is blocked as `RENDER_TIMEOUT`. A repeated `rendered` message for one
token is ignored. All timings live in `studio-v3/preview-launch.js`.

Amounts, rates, taxes, rounding and totals are supplied by the ERP. `/summary`
and item `rate`/`amount` bindings intentionally avoid the v2 sample-specific
financial rules. Studio validates presence/types and formats values; it does
not derive financial values. Synthetic sample fixtures are demonstration data.

## File and data boundaries

Saved sample datasets use IndexedDB `printform-studio-v3-demo-db` version 1,
with `datasets` and `preferences` stores. Three synthetic starter records are
seeded once; deleting one does not silently recreate it on reload. Selection is
remembered per document type. This is a browser-local demo database, with no ERP
connection, credentials, financial calculation or remote data API.

Table values and the dataset name remain unapplied drafts until Apply or Save
& apply. Apply retains the name as portable `manifest.sampleDataTitle` metadata
in the form's history, Save file and exported HTML, without a database record
link or implicit database write. Save & apply explicitly persists that name.
Custom numeric fields keep their original type while invalid/empty; Apply and
Save share validation, and deleting a row remaps outstanding numeric errors. Save & apply
atomically writes the selected record plus selection, then updates the form.
Save as new creates a separate record; imports also create new records and do
not overwrite older datasets. Reload saved explicitly replaces the form data.
Restore starter datasets asks for confirmation and writes only the three known
starter records; copies, current drafts and other browser storage are retained.
Revision compare-and-swap blocks stale overwrites from another tab. Cross-tab
notifications never replace an active form or draft automatically.

Startup controls stay inactive until the dataset load finishes, preventing a
late initial load from replacing a newly created form.

If opening or seeding IndexedDB fails or is blocked, the UI explicitly offers
tab-only storage and export. Later quota/transaction failures retain the draft
and roll back the database transaction; they do not silently claim persistence.
Browser/site-data clearing or changing origin can remove these local datasets.
Dataset JSON exports are the portable backup. Template layout remains an
explicit `.printform.json` download; it is not auto-saved to the database.

Save form and Export HTML embed the active dataset. Source labels distinguish
Built-in demo, Local demo dataset, Imported data and Validation sample. Sample
switching restores the prior current-document dataset and source. Source, sample
selection and baseline follow CommandBus undo/redo, but saved database records
do not: undo changes only the form draft. Imports of existing forms remain
unlinked drafts until saved as a new dataset.

Unapplied properties, binding, style, locale, JSON and table edits are distinct
from an applied but unsaved template revision. Selection/workspace/file/history
transitions use Apply / Discard / Stay. Apply commits to the form, Discard restores
current values, and Stay retains input/focus. Database and template-file saves
remain explicit; failed JSON parsing retains the text and prevents transition.

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
overflow issue; shorten it or adjust typography. Supported section order is declarative and uses native flow rows; fields and
columns also retain stable IDs when reordered. Footer blocks/totals
use native pagination and repeat page numbers. Non-default page geometry uses
independent flow blocks so totals and notes can continue on separate pages.

## Verification and release

`npm run build:site` includes v3 and generates invoice/purchase/delivery samples
at `studio-v3/samples/`. The source revision is stamped into the built v3
index as `printform-source-revision` and shown in the status bar. The isolated
v3 PWA uses a complete verified shell and immutable release assets, with
explicit protected updates; see [PWA lifecycle](STUDIO_V3_PWA.md).

`tests/studio-v3*.test.js` covers canonical model/binding/history/import safety,
typed dataset limits, independent ERP amounts and source/history behavior.
`e2e/studio-v3*.spec.js` is part of the existing three-browser CI matrix and
covers fresh blank-to-export, measured row identity/pagination for all starters,
long bilingual content, missing-field recovery, hostile strings, tab isolation,
undo/redo, column changes, interrupted runs, keyboard/dialog focus and responsive
layouts, draft transitions, IndexedDB persistence, stale concurrent writes,
quota/transaction rollback, tab-only fallback and non-destructive reset. Required
viewports are 1366×768, 1440×900, 768×1024, 390×844 and 430×932. Preview and standalone export text, row order, page count and geometry
are compared; Chromium also writes an A4 PDF. Native printer output remains an
owner review boundary.

Aggregate CI also covers existing v2 behavior. Its legacy progress-claim
long-text fixture has a confirmed pagination overflow and remains blocked;
its unsigned diagnostic now crosses the public gateway correctly. Positive
trusted-export evidence uses the passing invoice fixture. This does not close
the existing v2 Pilot release gates.
