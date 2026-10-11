# Studio v3 Feature Ledger (CA-01)

Status: reconciled draft, 2026-10-09. The authoritative data is [STUDIO_V3_FEATURE_LEDGER.csv](STUDIO_V3_FEATURE_LEDGER.csv); this page is the readable view and rationale. Every row is `review=proposed`: dispositions are evidence-based proposals for owner confirmation. Product and runtime code is unchanged.

Method: enumerate real UI entry points (`studio-v3/index.html`, `app.js` `action()`, `database-controller.js`), compare with the 66-row [historical inventory](STUDIO_V3_AGENT_COVERAGE_INVENTORY.csv) (a pre-registry baseline kept unchanged) and the current [registry](../studio-v3/agent-registry.js) (nine tools, thirteen operations). Counts workflows, not private helpers. All evidence paths of the 66 historical rows were checked to exist.

Dispositions: `agent-callable` (eligible; may still lack a service/adapter), `human-mediated` (agent prepares or explains; the human completes), `intentionally-unavailable` (host mechanism or view preference; reason recorded).

## Summary (checked against the CSV by `tests/studio-v3-feature-ledger.test.js`)

| Measure | Rows |
| --- | --- |
| Ledger rows | 79 |
| agent-callable | 48 |
| human-mediated | 22 |
| intentionally-unavailable | 9 |
| Eligible gaps (agent-callable, not yet reachable) | 27 |

Origins: 66 rows from the historical inventory, 13 added by this reconciliation. `baseline_access` keeps the historical Tool/Limited/Unexposed/Host label; `eligible_gap=yes` marks agent-callable rows whose baseline was Unexposed or Limited.

## Added by reconciliation (13)

`project.rename`, `draft.review`, `project.replace-guard`, `history.shortcuts`, `issue.locate`, `preview.rerender`, `data.rows-page`, `data.draft-apply`, `ai.model-discovery`, `ai.preview-banner`, `ai.clear-conversation`, `update.choice`, `workspace.layout-toggles` (all under the `printform.` prefix).

Decision recorded: the `validate-all` action is the existing `printform.validation.matrix` row, so it is not duplicated. `rename` and `data.rows-page` / `data.draft-apply` stay as separate rows for stable, individually testable IDs even though they overlap broader rows.

The agent reads this ledger at runtime through the generated `studio-v3/agent-workflows.js` and the `product-workflows` guide. After editing the CSV, run `node scripts/generate-studio-v3-workflows.mjs`; a test fails while the module is stale.

## Disposition rules used

| Rule | Disposition |
| --- | --- |
| Reachable today through a tool or operation | agent-callable |
| Unexposed reversible form/data/context workflow with an existing service | agent-callable, eligible gap |
| Needs a user-selected file, download, native print, persistence or destructive confirmation | human-mediated (agent may prepare the candidate) |
| Review gates and guards for unsaved user work | human-mediated |
| View preference, shortcut, provider/budget/transport internals, offline shell | intentionally-unavailable |

## Eligible gaps by domain

Data 10, Project 5, Observation 5, Authoring 4, References 3. Highest-value first: create blank/starter/preset, locale and currency, rename; dataset list/read/schema/edit/load (draft versus save kept separate); scenario-matrix validation and issue locate; richer context and reference re-reading. Planned owners are `planned:CA-04` (service), `planned:CA-02` (knowledge/contract) and `planned:CA-09` (evaluation) until each capability gets its real owner. Source-workspace tools belong to CA-07 and are not Studio ledger rows.

## UI entry mapping

The CSV column `ui_entries` links UI entry points to rows. Bare IDs are `data-action` / database action IDs. `attr:value` entries are delegated workflow selectors (for example `mode:data`, `template:blank`, `ai:models`, `form:locale`); `attr:*` covers a selector whose values are generated at runtime (samples, datasets, issues, tree paths). Tests fail when a UI entry exists without a row, or a row names an entry that no longer exists. Preview internals (`data-v3-*`), element identity (`data-ai-tag-id`) and validation markers are not workflows and are excluded.

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
| `source-repair`, `source-implement`, `source-artifact` | CA-07/CA-08 workspace (no Studio ledger rows yet) | runner-receipt |

## Open items

- Owner confirmation of every `proposed` row (the model is not the sole judge of its own ledger).
- Replace `planned:*` owners as CA-02/04/09 deliver.
- Local companion versus hosted runner and cost profiles gate CA-07/CA-10, not CA-01.
