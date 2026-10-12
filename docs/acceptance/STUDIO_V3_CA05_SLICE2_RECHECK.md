# CA-05 OBS-01: approved host text authorization recheck

Date: 2026-10-12 (Asia/Singapore). Result: the approved host prerequisite and bounded semantic slice are implemented and verified. CA-05/G4 remain Partial/open. Branch: `codex/studio-v3-ca05-observation`; source base: `774db9283b444d5e75aa13e529856dfe8347e402`. No commit, push, PR, merge, deployment or paid model call was performed.

## Authorization and scope

The direct human reply approves a default-off AI-panel label/static-text authorization bound to document/revision/content and one run, then permits continuing OBS-01. Existing host policy must independently permit business values; pixels stay disabled; Imported/Real/Unknown must not be automatically admitted. This approval authorizes the implemented bounded text prerequisite, not a new value classification, pixel grant, persistence policy or external publication.

The [existing slice-2 implementation](STUDIO_V3_CA05_SLICE2.md) already provides this exact boundary. This pass inspects and verifies it rather than duplicating its policy/service/UI. Nine security-relevant runtime modules retain the hashes corroborated by the [independent review](STUDIO_V3_CA05_SLICE2_REVIEW.md): receipt, policy, semantic projection, UI authorization, panel, protected history, provider, transport and handlers. Earlier CA-04 work, original receipt/semantic reports and the slice-1 recheck remain preserved. No CA-04 implementation is absorbed or newly credited.

## Observable behavior

- The visible AI-panel switch defaults off and is consumed once. Consent binds document, revision, full project content, selected targets, host policy and run; expires at the run deadline. Content/revision/policy/selection changes require fresh authorization.
- `observe_context` v1.0.0 returns authorized labels/static text, assigned field pointers and collection, selected targets, active scenario/row count, section/page/style layout and actual renderer diagnostics, bound to a fresh run-owned receipt. The core orchestration prompt has no task-specific branch.
- Text, assigned scalar values and pixels have independent policy checks. Imported uses Unknown classification. Real/Unknown values remain blocked even with allow flags; Synthetic values require a matching document, policy context/generation and explicit host permission. Unassigned data is never enumerated. This slice never returns image/asset bytes or page pixels, even if host pixel permission is true.
- Oversize semantic context rejects at the existing 32,000-byte limit; encoded pixel values reject without silently emitting partial context. Edited/undone drafts cannot revive semantic consent. Numeric inspection remains available for recovery and is still required before proposal handoff.
- Completion, failure and cancellation revoke the host object, including a mint that resolves after cancellation. Live authority is rechecked at actual dispatch, session refresh and response acceptance. Disclosed answers remain visible locally but cannot be replayed into later unapproved provider history or regain authority through snapshot/restore.

## Verification

| Check | Observed result |
| --- | --- |
| Current focused semantic/authorization units | Pass: 3 files / 31 tests (16 semantic custody/disclosure, 9 real panel lifecycle/history, 6 actual-wire) |
| Current native outgoing-wire mutation | Positive exit 0; omitting semantic content only through a private module-loader hook fails exit 1 at the outgoing label-canary assertion; recovery exit 0; production handler unchanged |
| Current focused Playwright | Pass: 6/6 across Chromium, Firefox, WebKit, including 3 semantic and 3 receipt cases; actual Validate panel, renderer, AI panel, Pi and transport; only the provider is a recording stub |
| Independent current raw-wire checks | Pass: 6 files / 63 requests / 18 unique receipts; semantic subset 30 requests / 6 receipts; call/result pairing, canonical content SHA-256, release identity, consent/history rejection and fresh-run recovery |
| Current artifact checks | Pass: same app/manifest/package as the slice-1 recheck; all 93 dependency digests and 4 resources in both root/pinned locations match |
| Full regression and site build | Reused same-runtime evidence from [the preceding recheck](STUDIO_V3_CA05_SLICE1_RECHECK.md): 201 files / 1714 tests; `npm run build:site` exit 0 and its own identical test totals. These commands were not rerun in this pass; no source, evaluation or runtime identity changed |
| Agent/release-review gate | Same-runtime preceding result plus final checkpoint check; all executable examples and digest-bound reviews pass, without advancing the publication baseline |

Each browser imports a fictional form and runs default denial, explicit text approval, unapproved next-run denial and fresh approval recovery. Each semantic wire has 10 requests / 2 receipts at revision 0: authorized labels/static text and assigned `/company/name`/`/items` paths appear only in approved requests; selected target `items`, 45 active rows and three measured pages reach the actual body. Unknown value, arbitrary-secret and encoded-pixel canaries are absent. The rejected next run does not replay the model's earlier answer containing the authorized canaries. Fresh approval keeps the same candidate digest but obtains a different run, receipt and policy digest. Committed revision remains 0.

The 31 unit cases separately exercise Synthetic value permission with text disabled, Real/Unknown rejection despite value/pixel flags, wrong-document authority, default/forged grants, expiry, changed document/revision/run/content/policy/selection, sticky revocation, edit/undo, render races, encoded/oversize rejection, cancellation during hashing, direct completion/failure, protected history and 401 refresh. These are bounded deterministic fixtures; no live-model competence or paid-provider cost is qualified.

The prior independent review identified and verified correction of ended/cancelled grant replay. Its report is historical evidence on its own frozen identity; the nine unchanged runtime hashes and current tests corroborate the correction here. It is not represented as a newly executed independent review of the current combined package. Historical failures, retries and mutation records remain in their original evidence archives.

[Current metadata](STUDIO_V3_CA05_SLICE2_RECHECK.json) records authorization scope, source/runtime identity, fresh checks, reused full/build logs, wire hashes and preservation. Raw fictional traffic and logs remain local in `.printform-studio/ca05-slice2-recheck/`. Model version and real monetary cost are unavailable. Existing Node/Vite/Playwright environment warnings were not suppressed or treated as product acceptance.

## Acceptance boundary and reporting

The approved prerequisite and semantic portion of OBS-01 are ready for review. G4 is not closed: page/crop retrieval, pixel canary and compaction retention, negotiated image modality/byte limits, independent final visual comparison, and sensitive raster/signature pixel authorization remain separate required slices. This checkpoint adds no pixel authority, full OBS-06 closure or CA-04 parity credit. The feature ledger keeps its existing exposure/gap dispositions.

Only this report/metadata and the TASK/ledger/registry checkpoint text change in this pass. Runtime and test code remain unchanged; all touched files are at most 300 lines. The requested `.agent/rules/03-verification.md` is unavailable; the available verification module and explicit acceptance requirements govern the report. No verification requirement or missing authority is inferred away.
