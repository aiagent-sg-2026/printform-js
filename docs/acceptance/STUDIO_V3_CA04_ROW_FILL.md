# CA-04: table row-fill UI/Pi parity

Date: 2026-10-12 (Asia/Singapore). Scope: `printform.table.row-fill` only. Status: bounded parity slice implemented and verified; no whole-CA-04, CA-05/G4 or project completion is claimed. Source base: `774db9283b444d5e75aa13e529856dfe8347e402`; branch: `codex/studio-v3-ca05-observation`; changes remain uncommitted.

## Ownership and acceptance boundary

`table-style.js:tableStyleChange` owns the pure candidate transformation, closed items target, six-digit hex validation, null reset, color spelling and empty-style removal. It validates before transforming a cloned design and returns canonical property changes. `validateTableStyle` also serves stored-design validation.

The real inspector's `controller.js:formDesign` and Pi's `ai-authoring.js:applyAuthoring` call this service. UI blank input maps to null and retains its existing trimming. Pi keeps its closed raw six-digit hex/null operation schema. The shared service grants no effect authority: UI submission still uses CommandBus; Pi still uses its private draft, schema/effect/selected-scope checks and explicit Preview/Apply approval. Bound data, pointers, collections, document identity, financial formats, unrelated styles and the stripe preference remain unchanged.

The existing global Style form materializes omitted default page settings. Differential fixtures normalize only that equivalent page representation using the existing defaults; they compare the complete remaining candidate, template, theme, spec and binding validation. This slice does not change page authoring or claim page parity. Browser fixtures undo the UI edit within the same document before applying the same Pi operation, retaining document identity; different host revision numbers are asserted separately.

## Verification and evidence

- `tests/studio-v3-row-fill-parity.test.js`: 27/27 passed. Real generated inspector forms, direct applyAuthoring, private draft and registered tool; valid colors/reset, three document types and both stripe settings; common service errors, invalid-input atomicity, unsupported properties/targets, schema/grant/scope rejection, no-op and recovery. The 5 valid-color/reset cases exercise 60 inspector/Pi pairs, comparing complete normalized candidates and actual binding validation.
- Focused registered regression: 8 files / 87 tests passed, including ledger selectors, service register, contracts, grants and existing row-fill behavior. The register-only format follow-up passed 3/3 with identical parsed JSON content.
- Private-source-copy mutation: omitting only the UI call to the shared transformation changes 27 passes to 14 expected failures / 13 passes (exit 1). The shared controller source hash is unchanged, and the temporary copy was removed.
- `npx vitest run --maxWorkers=1 --no-file-parallelism`: 200 files / 1676 tests passed (193.30 seconds).
- `npm run check:studio-v3-agent`: passed with 12 tools, 13 operations, 2 guides, 66 executable contract examples and 27 digest-bound reviewed changes. The existing successful-publication baseline is retained.
- `npm run build:site`: passed; its own complete single-worker regression also passed 200 files / 1676 tests (311.54 seconds).
- `npx playwright test e2e/studio-v3-row-fill-parity.spec.js e2e/studio-v3-table-style.spec.js e2e/studio-v3-observation-receipt.spec.js e2e/studio-v3-semantic-observation.spec.js --workers=1`: 26 passes and 1 Firefox timeout across 27 cases. The unchanged failed case passes its focused recovery below. All 9 new parity cases, the other 11 existing row-fill cases and all 6 CA-05 receipt/semantic cases pass in the matrix.
- `npx playwright test e2e/studio-v3-table-style.spec.js --project=firefox --grep 'table selection permits row fill' --workers=1`: the same failed case passes (4.7 seconds; 6.7 seconds total), without source, assertion, timeout or policy changes. Combined evidence covers all 27 distinct cases; the original matrix is not described as 27/27.

The browser fixtures use the actual static app, inspector, AI panel, Pi handlers, renderer and outgoing Demo transport body; only the external provider is stubbed. Each new parity case records 6 actual provider requests. Six fill/reset cases prove equal ready diagnostics (45 rows / 3 pages), normalized design, unchanged data/document identity and explicit Apply before commit. Three scope cases preserve the exact committed save after schema/column rejection and recover only under fresh table scope. Row-fill evidence totals 54 requests and 15 numeric receipts.

An independent Node data check validates all 15 retained wire files (row-fill plus CA-05 regression): 33 unique receipts, exact tool-call pairing, independently recomputed content SHA-256 and current release identity. It checks root/pinned app and resource hashes, confirms the browser artifact matches the final full build, and verifies 35 unrelated pre-existing worktree files are byte-identical. Only row-fill changes register semantics. Register formatting was compacted to 288 lines; all changed tracked/authored files stay at or below 300 lines.

[Metadata](STUDIO_V3_CA04_ROW_FILL.json) records identities, source/evidence hashes, commands and remaining parity IDs. Raw local evidence is retained under `.printform-studio/ca04-row-fill/`; earlier CA-05 reports, metadata and raw wires remain separate unchanged historical artifacts. Browser traffic uses fictional fixtures only; real-model competence and monetary cost are not qualified by the stub's token usage.

## Failures and corrections

The first differential fixture compared raw designs and exposed the existing omitted-versus-explicit default page representation. The fixture now normalizes that representation and continues comparing compiled output; production page behavior was not changed.

Early browser fixtures attempted to dynamically import unbundled modules from the static site, checked the transient status instead of the existing generic blocked conversation message, and passed the intentionally minimal save format directly to static validation. The fixture now consumes real preview reports and recompiles the saved design with Studio v3's existing schema before applying the existing validators. The same UI and actual outgoing-wire assertions remain; no production check or safety rule was weakened. Failed/aborted fixture runs are retained and excluded from acceptance.

One final-matrix Firefox run timed out at the last CSS lookup in the existing manual-clear/global-style refill case. The trace shows the committed r3 and ready paper state, but the lookup did not return before the unchanged 90-second test budget. The exact isolated recovery passes; no source or test change was made. This is a recorded transient browser verification limit, not a claimed application fix or a proved root cause. The failing trace/screenshot and both raw logs are retained.

Existing Node module-type, Vite external `node:fs` and Playwright color-environment warnings do not fail checks. No warning suppression was added.

## Remaining work and limits

Only this parity entry changes from parallel to shared. The register has 3 shared, 17 parallel and 12 agent-only entries; CA-04 remains Partial and COV-03 remains open. CA-05/G4 stays Partial. No additional parity entry, page/crop/pixel capability, real-data permission, paid provider, persistent safety policy, commit, push, PR, merge, deployment, upload or publication is part of this slice.

The requested `.agent/rules/03-verification.md` and routed instruction modules are absent in this checkout; this report records scope, implementation, verification, failures/recovery, retained evidence and remaining limits without inventing their content.
