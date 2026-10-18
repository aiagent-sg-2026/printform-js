# Studio v3 Feature Ledger (CA-01)

Status: reconciled draft, 2026-10-09. The authoritative data is [STUDIO_V3_FEATURE_LEDGER.csv](STUDIO_V3_FEATURE_LEDGER.csv); this page is the readable view and rationale. Every row is `review=proposed`: dispositions are evidence-based proposals for owner confirmation. These original dispositions remain proposed; later bounded implementation evidence is recorded below.

Method: enumerate real Studio UI entry points and published tool contracts, compare with the66-row [historical inventory](STUDIO_V3_AGENT_COVERAGE_INVENTORY.csv) (kept unchanged) and the [registry](../studio-v3/agent-registry.js) (now22 tools and13 typed design operations). Counts workflows, not private helpers. Source controls are operator/human-mediated; source tools require a separate per-run grant.

Dispositions: `agent-callable` (eligible; may still lack a service/adapter), `human-mediated` (agent prepares or explains; the human completes), `intentionally-unavailable` (host mechanism or view preference; reason recorded).

## Summary (CSV source for generated human workflow registry)

| Measure | Rows |
| --- | --- |
| Ledger rows | 89 |
| agent-callable | 49 |
| human-mediated | 31 |
| intentionally-unavailable | 9 |
| Eligible gaps (missing or limited agent paths) | 23 |

Origins:66 historical rows,13 reconciliation rows,5 bounded source-workspace rows and5 General capability rows. All rows remain proposed. New blank/starter and primary currency choice are now explicitly human-mediated, not callable tools. Source pairing and disclosure are human-mediated; source tools retain their separate explicit local Node/JSON grant.

## Added by reconciliation (13)

`project.rename`, `draft.review`, `project.replace-guard`, `history.shortcuts`, `issue.locate`, `preview.rerender`, `data.rows-page`, `data.draft-apply`, `ai.model-discovery`, `ai.preview-banner`, `ai.clear-conversation`, `update.choice`, `workspace.layout-toggles` (all under the `printform.` prefix).

Decision recorded: the `validate-all` action is the existing `printform.validation.matrix` row, so it is not duplicated. `rename` and `data.rows-page` / `data.draft-apply` stay as separate rows for stable, individually testable IDs even though they overlap broader rows.

The agent reads this ledger at runtime through the generated `studio-v3/agent-workflows.js` and the `product-workflows` guide. After editing the CSV, run `node scripts/generate-studio-v3-workflows.mjs`. Catalog/text equality is not consumer behavior coverage; use the relevant workflow and browser checks.

## Disposition rules used

| Rule | Disposition |
| --- | --- |
| Reachable today through a tool or operation | agent-callable |
| Unexposed reversible form/data/context workflow with an existing service | agent-callable, eligible gap |
| Needs a user-selected file, download, native print, persistence or destructive confirmation | human-mediated (agent may prepare the candidate) |
| Review gates and guards for unsaved user work | human-mediated |
| View preference, shortcut, provider/budget/transport internals, offline shell | intentionally-unavailable |

## Eligible gaps by domain

Data10, Project2, Observation4, Authoring4, References3 account for23 eligible gaps. CA-07 adds separately scoped source file/process/artifact workflows below; this inventory is not acceptance of parallel Studio workflows, hosted execution, arbitrary dependencies or G8/G9 qualification.

## UI entry mapping

The CSV column `ui_entries` links UI entry points to rows. Bare IDs are `data-action` / database action IDs. `attr:value` entries are delegated workflow selectors (for example `mode:data`, `template:blank`, `ai:models`, `form:locale`); `attr:*` covers a selector whose values are generated at runtime (samples, datasets, issues, tree paths). These are navigation metadata, not proof of runtime coverage. Preview internals (`data-v3-*`), element identity (`data-ai-tag-id`) and validation markers are not workflows and are excluded.

## Task families (CA-09 corpus)

The ten G8 families and their rules are owned by the [task register](STUDIO_V3_TASK_REGISTER.md); this table only links them to ledger domains. Task `capabilities` must be IDs from this ledger, which `tests/studio-v3-feature-ledger-register.test.js` enforces.

| Family | Main ledger domains | Likely oracle type |
| --- | --- | --- |
| `qa` | Observation, Agent runtime | reviewer |
| `authoring` | Project, Authoring | deterministic |
| `layout` | Authoring, Observation | deterministic plus visual-blinded |
| `bindings` | Authoring (binding, collection) | deterministic |
| `data` | Data | deterministic |
| `references` | References | visual-blinded |
| `files` | Lifecycle, Release | deterministic |
| `source-repair`, `source-implement`, `source-artifact` | `printform.source.files`, `.execute`, `.artifact` under the explicit local profile | real runner receipts plus independent task oracles |

## Open items

CA-05 slice 1 (2026-10-12): `printform.preview.inspect` now returns numeric diagnostics with a run-owned observation receipt and invalidates evidence after candidate edits or undo. Its updated service/guide/evaluation owners are in the CSV. [Slice evidence](acceptance/STUDIO_V3_CA05_SLICE1.md) records 22 new unit cases, an expected wire-mutation failure, full 196-file/1618-test regression, agent/site checks and 3/3 browser paths. Counts and exposure dispositions are unchanged. The later semantic slice is recorded separately; page/crop retrieval, pixels and full G4 acceptance remain open. CA-04 retains its 18 parallel workflows.

CA-05 slice 2 (2026-10-12): `printform.context.structure` and `printform.context.selection` use `observe_context` for receipt-bound labels/static text, assigned bindings/collections, selected targets and measured layout. A default-off, single-run AI-panel text grant is bound to document/revision/content/run/policy; host policy independently denies Real/Unknown values and all pixels. Protected answers stay local through history recovery; independent review verified end/cancellation revocation after correcting one P2. [Semantic evidence](acceptance/STUDIO_V3_CA05_SLICE2.md): 31 new unit cases, real outgoing-body canaries, mutation rejection, full 199 files / 1649 tests, agent gate/site build and three-engine browser rejection/recovery. Rows stay Limited with eligible gaps; no G4 case or CA-04 parity gap is closed.

- Owner confirmation of every `proposed` row (the model is not the sole judge of its own ledger).
- Replace `planned:*` owners as CA-02/04/09 deliver.
- Local companion versus hosted runner and cost profiles gate CA-07/CA-10, not CA-01.

CA-04 row-fill slice (2026-10-12): `printform.table.row-fill` uses the shared `table-style.js` transformation and validation from both inspector forms and Pi authoring; the CSV records its actual service/UI/evaluation owners. [Bounded evidence](acceptance/STUDIO_V3_CA04_ROW_FILL.md) records 27 new unit cases, full 200 files / 1676 tests, agent/site gates and 9 new real-wire browser cases across three engines, with existing regressions and an unchanged Firefox timeout case passing focused recovery. Only this parity entry changes to shared (3 shared / 17 parallel / 12 agent-only). Counts and exposure dispositions stay unchanged; CA-04/COV-03 and CA-05/G4 remain open.

CA-05 slice-1-only recheck (2026-10-12): [current evidence](acceptance/STUDIO_V3_CA05_SLICE1_RECHECK.md) verifies the existing numeric receipt path on the recorded combined-tree artifact: 22 receipt units, expected actual-wire mutation failure and recovery, full 201 files / 1714 tests, agent/site gates and 3/3 browser receipt paths. Runtime, CSV ownership/exposure dispositions and all earlier acceptance reports are preserved. This checkpoint adds no semantic/pixel authority, CA-04 parity implementation or G4 closure credit; OBS-02 page/crop retrieval remains open. Work stops for review.

CA-05 approved host text / OBS-01 recheck (2026-10-12): [current evidence](acceptance/STUDIO_V3_CA05_SLICE2_RECHECK.md) confirms the existing default-off, one-run text grant and receipt-bound semantic path following direct human approval. Fresh 31-unit and 6-browser checks plus actual-wire mutation rejection/recovery pass; independent audit covers 63 requests / 18 receipts on the unchanged artifact. Imported/Real/Unknown values and pixels stay blocked; Synthetic values require explicit matching host policy independently from text. Existing CSV owners, exposure/gap dispositions and historical evidence remain unchanged. Full G4 and CA-04 parity remain open.

CA-05 approved fictional page/crop slice (2026-10-12): `printform.preview.inspect` retains numeric inspection and adds `retrieve_page` under separate one-run fictional pixel consent plus existing text/value restrictions. [Evidence](acceptance/STUDIO_V3_CA05_SLICE3.md) covers 38 new units; actual tool-paired PNG inputs through compaction; byte/PNG integrity and modality rejection/recovery; full 204 files / 1752 tests; agent/site gates and 9/9 three-engine paths. Independent audit checks 114 requests / 42 receipts / 9 evidence IDs and 15 image-bearing requests. Real data and sensitive assets remain blocked; DOM raster capture does not qualify native-print fidelity or final visual comparison. Dispositions stay proposed; CA-04 and full G4 remain open.

CA-05 OBS-05 technical checkpoint (2026-10-12): `printform.agent.question-route` names the existing completion handler/evaluation owner. `finish_answer` v1.1.0 host-authors and retains the latest receipt; wrong/stale evidence and oversize delivered answers reject explicitly. [Current technical evidence](acceptance/STUDIO_V3_CA05_OBS05.md) and [machine report](acceptance/STUDIO_V3_CA05_OBS05.json) resolve both P2 delivery findings and save 33 exact delivered texts bound to current source/app/manifest identity. Fresh 206 files / 1773 full tests, agent/site gates, 12/12 three-engine browser specs and wire/citation mutation rejection/recovery pass. The 33-fixture independent native text/geometry matrix detects all five defects and passes every repair. Evidence-only delivery preserves CSV owners/counts, Limited/proposed exposure, disclosure authority, CA-04 parity and historical reports; full G4 blinded human qualification stays open.

CA-05 local merge checkpoint (2026-10-13): [isolated verification](acceptance/STUDIO_V3_CA05_LOCAL_MERGE.md) binds the CA-05-only implementation, 33 fresh exact delivered texts and latest receipts to the rebuilt artifact. Existing proposed/Limited exposure and CA-04 parity dispositions are preserved. Full G4 human qualification remains open; only local commit/merge is authorized.

CA-04 style checkpoint (2026-10-13): [current evidence](acceptance/STUDIO_V3_CA04_STYLE_PARITY.md) records the existing heading/page-number typography slice and row fill on the current artifact, including the remaining Firefox verification gap. The current CSV service/UI/evaluation owners are linked to 65 style unit cases, 21 direct three-engine parity cases plus 45 existing browser regressions and 12 composer layout cases, actual outgoing numeric receipts, mutation rejection/recovery and full unit/agent/site gates. The register is 4 shared / 16 parallel / 12 agent-only; inventory counts, exposure dispositions and disclosure authority are unchanged. Firefox stability qualification remains incomplete; CA-04/COV-03 remains Partial.

CA-04 Firefox recheck (2026-10-13): [current evidence](acceptance/STUDIO_V3_CA04_FIREFOX_RECHECK.md) remains Partial. Original full Firefox suites pass 25/26, 24/26 and 23/26 without retries or assertion/timeout/trace changes. The same-version task-owned browser cache recovers a missing shared executable; protocol capture records preview execution-context loss but leaves its cause unproven. All 145 dependency hashes and the tested artifact identity remain unchanged. No code, disclosure authority or parity disposition changes; clean Firefox qualification and COV-03 remain open.

## Bounded source profile (2026-10-16)

The five `printform.source.*` rows separate human pairing/disclosure from model capabilities. The same Pi Harness receives source tools only after a host-built one-run fictional-source grant; pairing, code, tokens, profile and source/image identities cannot be supplied by model arguments. Source never replaces current business data. JSON artifacts retain the existing operation parser, selected scope, financial bindings, exact-candidate inspection and human Preview/Apply.

Current scope is local Docker/Node24/UTF8 and structured operation JSON, not arbitrary repositories/HTML or hosted multi-tenant execution. Default build conformance exercises missing-session rejection; real Docker and true-browser Origin checks are separate evidence. No formal G6/G8/G9 closure follows merely from tool discovery, a process exit or model-writable tests.

## General bounded capabilities (2026-10-17)

The five `general-option2` CSV rows describe implementation boundaries, not fresh verification. [Independent tables/barcodes](GENERAL_SOURCE_TABLES_BARCODES.zh-CN.md), [offline barcode](STUDIO_V3_OFFLINE_BARCODE.zh-CN.md) and [currency/manufacturing/timesheet](GENERAL_CURRENCY_MANUFACTURING_TIMESHEET.zh-CN.md) own the detailed contracts.

- Primary plus at most four additional tables, each at most30 columns, use independent collection/column pointers; no joins or sums. Table creation/configuration and extra-column add/reorder are manual (`add-table`, `remove-table`, `form:additional-table`). Existing extra columns support `set_field`/`remove_field`; `add_field`/`reorder_fields` retain only the original five section enums.
- Barcode field operations accept exact supplied strings: CODE1281–128 printable ASCII; EAN13 supplied13 digits with valid checksum. V3 integer moduleWidth1–4 and height20–160; no trim, padding, source generation or physical scanner qualification. The public service-parity register records barcode as `parallel`: shared validation/runtime do not prove inspector/Pi transformation parity, and no new parity pass is claimed.
- The16 currency catalog applies only to Studio primary UI/project construction. Source ISO facts (including legal BHD/AED) and core formatter retain original support; outside-catalog project primary currency retains `PROJECT_CURRENCY`. Supplied `/document/currency` synchronizes primary currency, and mismatch produces `SOURCE_CURRENCY_MISMATCH`, not FX.
- Supplied-business kinds include ManufacturingOrder/Timesheet and PurchaseRequisition/MaintenanceWorkOrder. New is human fictional-starter choice. Explicit profile normalizers/project SDKs are not direct raw ERP UI import; the pinned optional ERPNext Purchase Material Request adapter requires linked Company facts plus an exact quantity export. Data CSV/JSON uses human mapping/Preview/Apply. No approval, work execution, completion, wages, certification, FX or totals inference.
- Save/HTML with source retain the original import receipt, text, filename and mapping. Human share-copy download omits that receipt/source text/filename only; all live data including unbound values, printed values, labels, images and metadata remain. This is not anonymization or upload.

Regenerate `studio-v3/agent-workflows.js` centrally from the CSV; do not hand-edit the generated module. No tests, builds, lint, formatter or generator were executed for this documentation update.
