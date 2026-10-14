# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Version numbers below track the **pagination engine** (`dist/printform.js`).
Studio v2, the single-HTML protocol, and the Agent Contract version separately —
see the [compatibility matrix](docs/COMPATIBILITY_MATRIX.zh-CN.md) for why, and
for the current number on each line.

See [TASK.md](TASK.md) for the full engineering log with commit hashes, test
counts, and verification detail; this file only lists what changed, for readers
who don't need the diary.

## [Unreleased]

Current working-tree versions: runtime `1.0.0`, Studio `0.11.0`, Protocol `2.0.0`, Agent Contract `4.0.0`.
E13-SERVER provides a bounded single-writer SQLite backend; the browser UI still uses localStorage.
E14 UI includes four layers, context badges, structured change cards, apply-mode controls,
batch history controls, session/settings/trace surfaces and a resizable rail.


### Measured Unicode pagination and physical n-up — 2026-10-14

- Replaced first-cell whitespace cloning with DOM Range fragments measured against active page chrome and configured paper width, including parallel CJK/RTL cells, inline graphemes, oversized ordinary rows and retained PTAC/PADDT readability ceilings.
- Preserved atomic assets, amounts, short fields and explicit split/first/last/repeat policies; added complete ordered fragment identity validation without discarding physical overflow checks.
- Fixed exhausted fixed-height paragraph wrappers leaking into the next fragment and intrinsic table/cell widths preventing narrow-paper reflow.
- Added validated physical sheet grids, uniform layout-aware CSS zoom, scoped named paper rules, mixed paper sizes and partial forced-sheet boundaries; transform-only printing had moved footer text into extra PDF pages.
- Updated usage, support and [complex pagination contract](docs/ERP_COMPLEX_PAGINATION.zh-CN.md). Oversized atomic content still fails with original DOM preserved; no universal font/DOM/printer certification.

### ERP settlement projections — 2026-10-14

- Added explicit canonical BankReceipt/BankPayment input and portable projects for multi-document full/partial allocations and zero-allocation advances/prepayments.
- Kept cash movement, source cash, invoice applied/cleared, cash applied, balances and unapplied cash distinct across independently declared currencies/precisions; supplied bank fees, withholding, discounts and FX adjustments are separately labeled.
- Missing bank/approval/balance facts remain absent. No commodity rows, automatic posting, reconciliation, exchange/tax computation or bank-clearance inference.
- Added exact [settlement API and primary-source boundaries](docs/ERP_SETTLEMENT_BUSINESS_CONTRACT.zh-CN.md); raw database field mapping is not invented.

### Raw PCAR / SO work-done mapping — 2026-10-14

- Added explicit AR link/numeric/measurement profiles, exact SO header+line-group resolution and source `idcode` provenance; ambiguous joins fail instead of taking the first row.
- Kept original `extnamt_orig_forex` distinct from distributed amounts; copied authoritative Work Done figures and derived only the researched Previous/Current gross and quantity/percentage movements.
- Latest eligible supplied certification, stored Last Claim, explicit new work and absent certification are independently represented; no unknown prior value is filled with zero.
- Added a landscape `/valuations` portable project with four-digit valuation amounts, independently precise ERP header figures and transaction payment terms; no net-payable, tax, FX, booked-AR or full raw financial variant claim.
- Exact inputs, variants and source evidence: [raw PCAR contract](docs/ERP_RAW_PCAR_WORK_DONE.zh-CN.md).

### Globe3 claim business contracts — 2026-10-14

- Added a fail-closed raw CCAR financial-tab normalizer and portable print-project creator using `financialRows`, with explicit numeric profiles, supplied currency precision and optional ERP balances; no invented commodity rows or accounting recognition.
- Added canonical PCAR project creation requiring `entp_pbill`, an explicit prior-certified or stored-last-claim basis and supplied valuation amounts; no full raw PCAR database adapter is claimed.
- Corrected fictional PCAR movements to use prior cumulative certification, including retention/on-hold movements without a second deduction; separately identified seed migration preserves user records and selection checks basis and collection.
- Documented [business contracts and import APIs](docs/ERP_CLAIM_BUSINESS_CONTRACT.zh-CN.md), immutable financial-print snapshot refresh, six Studio currencies, precision 0..6, and the legacy `items` workbench boundary. No live ERP, booked-AR, Production Ready or new verification-count claim is added; the following execution counts remain historical.


### ERP print correctness and coverage — 2026-10-13

- Added independently identified PCAR (Progress Claim Account Receivable) and CCAR (Certified Claim Account Receivable) templates, source-linked three-period fictional datasets, receivable/certification bindings and non-destructive catalogue seed migration.
- Kept supplied ERP amounts unchanged; application and certification stages are not additional sales or automatic accounting postings.
- Fixed mixed-node PTAC/PADDT content loss, integer segmentation, presentation context, skip/nonrepeating table headers, actual-height dummy filling, configuration overrides, page markers and reserved-key table identities.
- Batch formatting now includes later source forms, shares concurrent completion and rejects partial failure with `AggregateError` plus per-batch counts. Failed formatting rolls back its own output and preserves source nodes/listeners; unsplittable overflow fails explicitly.
- Fixed schema-profile bypasses, keyword shapes, JSON equality, Unicode/date validation, scoped repeat identity and nested row preflight, RFC6901 contract editing, Intl diagnostics, standalone business-rule parity and stale-render generation guards.
- Restricted HTTP fault injection to explicit test mode; non-loopback listeners require a token. Shared-token identity remains a deployment limitation, not a new user-authentication system.
- Added the [complete findings register](docs/ERP_PRINT_AUDIT.zh-CN.md) and [ERP transaction/format contract](docs/ERP_PRINT_SUPPORT.zh-CN.md), updated API/integration documentation and synchronized project knowledge through KB-MCP.
- Local integrated build: 211 test files / 1,899 tests passed; final reserved-key binding-report correction passed another 5 files / 36 focused tests and rebuilt the site. Three-engine browser checks: 67 passed / 2 intentional skips, plus 6 catalogue/seed passes. Remaining boundaries are recorded in the audit; no Production Ready, tax, real-ERP or native-printer certification is granted.
### Documentation — 2026-09-07

- Reconciled architecture, current behavior, epic/task status, roadmap, product strategy,
  trust model and release checks against code.
- Corrected blanket E14 completion claims: scope, Review apply policy, readiness display,
  card-history semantics and real-data persistence remain incomplete.
- Added the [production plan](docs/STUDIO_V2_PRODUCTION_PLAN.md) with requirement IDs,
  dependencies, evidence limits, proposed layout and release-profile decisions.
- Earlier session evidence: 72 files / 385 tests, doctor 5/5, three static pilot validations,
  bundle syntax and Windows Chromium 60/60 passed. Full application suites were not rerun
  for this documentation amendment; no new full browser/print/HA/network-audit result is claimed.
- No source, runtime-loaded Agent prompt, behavior, version, supported-platform promise or release change.

## [1.0.0] — 2026-07-31

First tagged release. The engine itself long predates this tag — it has been in
production ERP use for years — so 1.0.0 states its actual stability rather than
implying it is new. At that release time it shipped alongside Studio v2 0.9.0,
protocol 2.0.0 and Agent Contract 2.0.0; see `[Unreleased]` above and the
compatibility matrix for the current version lines.

### Added

- **Studio v2**: a single self-contained-HTML "Production Pilot" editor for the
  two standard templates (Sales Invoice, Purchase Order), with a transactional
  Agent Contract command bus shared across the UI, WebMCP, and a CDP gateway —
  so AI agents and humans go through the same validated command path.
- Studio v2 engineer panels: table column widths, print font scale, page
  settings (paper size), repeated-areas (header/footer/docinfo repeat
  flags), brand heading color, and a data contract panel (view schema
  structure, edit sample values and existing field constraints), all
  applying directly against the live preview with no raw-JSON editing
  required for common changes.
- Side-by-side diff review before applying a manual source edit, replacing a
  single-line `confirm()` dialog.
- Studio-issued layout evidence receipts (geometric fingerprints, not pixel
  screenshots) and dual-runtime attestation hashes, so a production export's
  trust claims are independently verifiable rather than self-declared.
- A release-acceptance script (`scripts/browser-matrix.mjs`) covering both
  templates across four browser targets, every boundary row-count scenario,
  and five print locales — plus an on-demand `workflow_dispatch` CI job to
  reproduce it on a Linux runner.
- MIT license.
- Independent SemVer for each of the four contracts, with a
  [compatibility matrix](docs/COMPATIBILITY_MATRIX.zh-CN.md) explaining the
  split and machine checks preventing the derived copies from drifting.
  `PrintForm.version` now reports the engine version at runtime.
- `npm run doctor`: a one-command local health check (unit tests, the
  production build, and protocol validation for both pilot exports) with
  a one-page pass/fail summary.

### Changed

- Cross-engine pagination divergence in the Purchase Order template resolved:
  non-row page area now has enough padding that every browser engine and
  print locale converges on the same rows-per-page count.
- The service worker's offline precache manifest is now generated at build
  time from the actual build output, instead of hand-maintained (the
  hand-written list had silently drifted twice).
- Large documents with an enlarged font paginate substantially faster: row
  heights are now pre-measured in one batch and the common case skips a
  redundant layout reflow per row. Pagination output is unchanged.

### Fixed

- A script injected into the page after `DOMContentLoaded` failed to run;
  auto-init now checks `document.readyState`.
- PTAC/PADDT long-text continuation segments could force an extra page break
  after being cloned.
- Studio v1: structure-mode block indexing could point at the wrong element
  after edits; preview `postMessage` handling lacked origin/level validation.
- Studio v2 diagnostics bundles reported a `studio` version that never
  existed — the protocol version had been hardcoded into a field naming the
  Studio.

### Security

- Studio v2 preview messages are verified against `event.source`, print
  preview windows sever `window.opener`, `set_manifest_value` rejects
  prototype-pollution path segments, and revision numbers are monotonic
  (never reused after an undo).
