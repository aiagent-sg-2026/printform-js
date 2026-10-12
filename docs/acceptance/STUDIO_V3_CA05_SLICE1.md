# CA-05 slice 1: observation receipt evidence

Date: 2026-10-12 (Asia/Singapore). Status: implemented slice, ready for review; CA-05 and Gate G4 remain open. Source base: `774db9283b444d5e75aa13e529856dfe8347e402`; branch: `codex/studio-v3-ca05-observation`; changes are uncommitted. No push, PR, merge or publication was performed.

This report records the historical slice-1 tree. Later authorized semantic work changes the current package identity. Its original app, manifest, raw wires and metadata are preserved under `.printform-studio/ca05-evidence/slice1/`; original wire paths in the metadata resolve relative to that archive. See [slice 2](STUDIO_V3_CA05_SLICE2.md) for current combined-tree evidence.

## Preconditions and scope

CA-04 is Pending. Its register still has 18 parallel authoring workflows, 2 shared workflows and 12 agent-only entries. Existing shared inspection (`validation.js`) and scenario validation (`scenario-matrix.js`) suffice for receipt custody. No CA-04 parity implementation was changed or credited. Its unresolved parity remains a prerequisite for overall product completeness.

Only slice 1 is implemented: the `inspect_draft` numeric projection has a run-owned receipt binding release/document/base revision/candidate generation, candidate/scenario/policy/content hashes and capture time. Candidate edits and undo invalidate it; in-place changes and render races reject; a host revision change requires a new run. `finish` retains the actual latest valid receipt. Receipts contain no values or pixels; the fixed diagnostic policy denies both. This does not qualify the independent disclosure paths of OBS-01/06.

The receipt service reuses canonical JSON/SHA-256. It stores only the latest observation, with immutable content and metadata. Rendering uses a captured private candidate; the live CommandBus, data and history retain their existing owners. Scenario-matrix results have no receipts in this slice and never satisfy final-draft inspection.

## Evidence and independent oracles

| Check | Observed outcome |
| --- | --- |
| `tests/studio-v3-observation-records.test.js` | 14/14: exact SHA-256 via Node crypto; identity/content/scenario/policy changes; cross-run and forged IDs; superseded, failed and late capture; recovery |
| `tests/studio-v3-observation-tools.test.js` | 7/7: real handlers; latest receipt in proposal; edit/undo-to-identical-content/in-place changes; changed host revision; late-render rejection and recovery |
| `tests/studio-v3-observation-wire.test.js` | 1/1: actual `runPanelAgent` / Demo transport outgoing body contains the receipt with its `inspect_draft` call pairing and supplied host revision |
| Wire mutation | Temporarily removed `observation:receipt` from the handler reply: 1/1 failed at the outgoing-body assertion (`undefined` instead of the receipt). Source restored; positive test passes in the full regression |
| `npx vitest run --maxWorkers=1 --no-file-parallelism` | 196 files / 1618 tests passed; no failures |
| `npm run check:studio-v3-agent` | Passed, including 62 executable contract examples and digest-bound review of 26 changes against the retained publication baseline |
| `npm run build:site` | Passed; its own full regression also passed 196 files / 1618 tests |
| `npx playwright test e2e/studio-v3-observation-receipt.spec.js --workers=1` | 3/3 passed: Chromium, Firefox, WebKit; actual Validate panel, renderer, AI panel, Pi and transport; recording provider stub |

The browser fixture runs the shared Validate matrix, observes r0 read-only, edits/inspects/edits/undoes to identical content, verifies stale finish rejection, reinspects and completes, applies once, then observes real r1 in a new run. It checks page geometry, all receipt hashes, run/document/revision identity and exact function-call pairing in the outgoing body. There are 11 scripted provider requests across three runs per browser; provider token reports are synthetic, real cost/model identity unavailable. No live-model or visual-reconstruction qualification is claimed.

Recording wire files are retained under `test-results/studio-v3-observation-rece-*/observation-provider-wire.json` and attached to each test result. They contain synthetic test requests only. The first three-engine run passed 3/3; its in-memory attachment was then replaced with a file attachment so the list reporter leaves inspectable evidence.

After ledger/review changes, `node scripts/build-site.mjs` refreshed the final artifact and the focused browser spec again passed 3/3 (28.0 s). A separate Node check verified every outgoing observation's content SHA-256 and exact release/contract/knowledge/package identity against the built manifest: 11 requests and four unique receipts per browser, with base revisions `[0,0,0,1]`. [Final metadata](STUDIO_V3_CA05_SLICE1.json) records built app/knowledge hashes, raw wire-file hashes/paths and local runtime/browser versions. Browser versions were checked by launching the same installed engines used by this default Playwright profile. The final ledger/review/wire regression also passed 5 files / 17 tests. Neither browser run had a failed product assertion; the mutation's failure was intentional.

## Gate G4 coverage

| Case | Status and remaining work |
| --- | --- |
| OBS-01 | Not run: authorized labels/pointers/collections and independent value/pixel policy paths |
| OBS-02 | Partial: receipt identity/freshness/custody verified; page/crop evidence retrieval remains open |
| OBS-03 | Not run: this slice proves receipt text on the actual wire only; pixel canary and compaction preservation remain open |
| OBS-04 | Not run: provider modality negotiation and observation image-byte limits |
| OBS-05 | Not run: latest receipt retained in proposal preparation; independent missing-section/text/geometry/pagination comparison still absent |
| OBS-06 | Not run: sensitive raster/signature/data fixtures and explicit pixel authorization |

No G4 case is fully closed. Slice 1 was reviewed before the separately authorized slice 2. All touched source/test/document files are at most 300 lines.

Final tree checks: 24 changed/new files; maximum 275 lines; local documentation links and `git diff --check` pass. Generated source identity matches the final built artifact and its digest-bound release review passes. The shared checkout briefly moved to the CA-04 branch at the same base commit; all changes were preserved and the requested CA-05 branch was restored before handoff.

## Reporting limitation

`.agent/rules/03-verification.md` and the routed investigation/architecture/verification module files are absent from this checkout and the inspected parent directories. The supplied core rules and explicit task acceptance own this report; no unavailable format or instruction was invented. The missing format file does not prevent implementation or the observable checks above.
