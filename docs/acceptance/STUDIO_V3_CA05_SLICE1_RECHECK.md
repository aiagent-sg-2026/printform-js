# CA-05 slice 1: current-tree recheck

Date: 2026-10-12 (Asia/Singapore). Result: receipt slice verified and stopped for review. CA-05 and Gate G4 remain Partial/open. Branch: `codex/studio-v3-ca05-observation`; HEAD and fetched `origin/main`: `774db9283b444d5e75aa13e529856dfe8347e402`. No commit, push, PR, merge or publication was performed.

## Scope and preconditions

The latest request limits delivery to Step 0 and slice 1. The receipt implementation and its [original evidence](STUDIO_V3_CA05_SLICE1.md) already exist in the dirty checkout. This pass reuses and verifies them rather than duplicating the service. Existing semantic, row-fill and element-style work is preserved; the current combined artifact is explicitly identified below. Those capabilities earn no new acceptance credit from this receipt checkpoint.

Fetched main has 2 shared / 18 parallel / 12 agent-only parity entries. The working register has 4 / 16 / 12 because of earlier local CA-04 work; registration does not establish final acceptance. Neither counter is a new result of slice 1. The remaining authoring parity gaps do not block numeric receipt custody: inspection already uses `validation.js`, and Validate/Pi scenarios use `scenario-matrix.js`. Full CA-04/COV-03 closure remains open. No prerequisite extraction or CA-04 implementation was added in this pass.

The receipt service binds run, release, document, host base revision, candidate generation, candidate/scenario/policy/content SHA-256 and capture time. It captures a private candidate, freezes metadata/content and keeps only the latest valid observation. Edits, undo to identical content, in-place changes, host revision changes and late renders invalidate or reject prior evidence. Reinspection recovers; a changed host revision requires a new run. `finish` retains the actual latest valid receipt.

Runtime review scope: `observation-records.js`; receipt integration in `agent-draft.js`, `agent-handlers.js`, `agent-tools.js`, `agent-loop.js`, `ai-agent-run.js`; registered contracts/errors/guide and conformance fixtures. The three receipt unit files and `e2e/studio-v3-observation-receipt.spec.js` exercise this path through actual Pi and Demo transport. No runtime source or test was changed during this recheck. Only this report/metadata and the TASK/ledger/registry documentation receive checkpoint updates.

## Verification

| Check | Observed result |
| --- | --- |
| Receipt units | Pass: 3 files / 22 tests (14 record, 7 real-handler, 1 actual-wire) |
| Wire mutation | Pass oracle: removing only `observation:receipt` from the inspection handler in a private source copy makes the outgoing-body test fail (1/1); restored-copy recovery passes (1/1) |
| Full `npx vitest run --maxWorkers=1 --no-file-parallelism` | Pass: 201 files / 1714 tests; this is regression evidence, not additional G4 case credit |
| `npm run check:studio-v3-agent` | Pass: executable contracts and all digest-bound release-review dispositions; publication baseline unchanged |
| `npm run build:site` | Pass, exit 0; its own full regression passes 201 files / 1714 tests |
| Validate/AI-panel browser path | Pass: receipt spec 3/3 across Chromium, Firefox and WebKit in the retained 51/51 regression matrix; real renderer, Pi and outgoing transport, recording provider stub |
| Independent wire digest checks | Pass: 33 requests / 12 unique receipts; exact `inspect_draft` call/result pairing, canonical content SHA-256, frozen release identity and stale-finish rejection/recovery |
| Artifact/source consistency | Pass: final app/manifest equal the browser artifact; all 4 declared resources and 93 dependency-file digests match |
| Preservation | All 59 pre-existing changed/untracked files matched their captured hashes before checkpoint documentation updates; runtime/test and historical acceptance files remain unchanged |

Each browser records base revisions `[0,0,0,1]` and candidate generations `[0,1,3,0]`. Undo restores the same candidate digest but cannot restore the old receipt ID; the fresh observation follows the rejected finish. The final read-only run observes the actual committed revision 1. The independent Node audit recomputes content hashes from recorded outgoing bodies. Synthetic provider usage is scripted; actual model version, live-model cost and qualification are unavailable.

The mutation fails specifically because the outgoing result has no observation (`undefined` rather than the retained receipt). The production handler hash is unchanged, the temporary copy is deleted, and the rejection/recovery logs remain in `.printform-studio/ca05-slice1-recheck/`. The earlier CA-04 build was interrupted before this checkpoint; it is not credited as a passed build. Historical slice-1/slice-2 and row-fill reports retain their original identities and results.

[Metadata](STUDIO_V3_CA05_SLICE1_RECHECK.json) records the current app/manifest/package, evidence hashes and raw wire locations. Current identity: contract `befd783aa9ff1c9501a6b7bac582ff9d8b68388c9f9220a07703144267032379`; knowledge `fb163609231a86dadca6da60885c1a48ad73a7c67bfcbf9d468c36cdc9abbf51`; package `b50addc9b6ca13700842020c4d3efdd4b8570eea94c08e9f3cbc9c0d3386aa4a`.

## Acceptance boundary

OBS-02 remains Partial: this checkpoint verifies receipt identity, freshness and custody, not page/crop retrieval. OBS-01 and OBS-03..06 receive no new closure credit here. Receipts carry numeric diagnostics without values or pixels. Pixel canary/compaction, provider modality/image-byte limits, independent final visual comparison and sensitive raster/signature authorization remain required for G4. Existing semantic work has its own evidence and is outside this delivery scope. No G4 case is fully closed by slice 1.

The requested `.agent/rules/03-verification.md` was not found in the checkout or inspected user rule locations. The available `/Users/yapweijun/.codex/instruction-modules/verification.md` and explicit acceptance requirements govern this report. All checkpoint files and the existing 59-file working set are at most 300 lines; whitespace checks pass. Work stops here for review as requested.
