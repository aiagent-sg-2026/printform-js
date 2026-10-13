# CA-04 row-fill and element typography parity checkpoint

Date: 2026-10-13. Branch: `codex/studio-v3-ca04-style-parity`. Source commit: `da38846aea170f6f234770bf43a899b68559f0db` plus the recorded uncommitted CA-04 dependency hashes.
Status: both style slices have passing per-case local evidence; a clean Firefox matrix remains unverified. CA-04/COV-03 remains Partial; independent delivery review is pending.

## Scope and result

This follow-up inspects and verifies the pending row-fill and heading/page-number typography changes after the separate CA-05 commit. The first native matrix exposed an existing shared-composer regression: permission copy collapsed selected references to zero height. A minimal HTML/CSS prerequisite groups the unchanged labels in a bounded scrolling region; a four-viewport native regression and digest-bound registry references accompany it. This follow-up also adds durable evidence and CA-04 notes in TASK, the feature ledger and the agent registry. Existing CA-04 source/test/CSV/release-review changes remain uncommitted on the separate local branch.

The real inspector and Pi call `tableStyleChange` for row fill and `elementStyleChange` for heading/page-number typography. The services own validation and normalized candidates. UI Apply retains CommandBus/undo; Pi retains private draft, selected scope, effect grants, inspection and human Apply. Existing text/value/pixel disclosure authority is unchanged.

Row fill accepts only six-digit hex colors or reset; blank UI input maps to reset. Typography replaces an override: omitted properties inherit and an empty patch removes it. Fractional native font controls match the existing finite 6..72pt operation contract. Explicit false weight, color spelling, supplied values and bindings remain intact. Reordered identical properties cannot create a change; legacy empty overrides normalize to absence.

## Verification and independent oracles

- Focused unit/contract/ledger/register checks: 5 files / 82 tests pass, including 27 row-fill and 38 typography cases. Real form adapters, Pi handlers and expected candidates cover positive, rejection and fresh recovery paths.
- The pre-fix standalone full suite passes 206 files / 1773 tests. After the layout prerequisite, the final full site build independently reruns the same 206 files / 1773 tests and passes. Aggregate v2 totals are regression evidence only.
- Final documentation checks: ledger/register regression passes 2 files / 9 tests; the release-review gate passes again after the notes are written.
- Agent release review: 76 executable contract examples and all 28 changed entries pass the digest-bound gate. No successful-publication baseline was advanced.
- Post-fix native browser matrix: 74/78 pass with four Firefox timeouts, zero automatic retries, skips or flaky results. A separate unchanged serial recovery passes 3/4; the remaining page-number case passes with trace collection disabled. The no-trace stability repeat also times out: 1 pass, 1 failure and 6 skipped/interrupted cases before cancellation. It is failed/incomplete evidence, not recovery credit. Source, assertions, fixtures and timeouts are identical. Combined results cover 78 distinct cases, 26 each in Chromium, Firefox and WebKit; this is not described as a 78/78 first-pass matrix. There are 21 style parity cases (12 typography, 9 row-fill) plus 45 existing authoring, table-style and receipt/semantic/pixel regressions and 12 new disclosure/reference composer cases across four viewports. The actual static app, preview renderer, AI panel, Pi handlers and outgoing Demo transport execute; the external provider is a recording stub.
- CSS assertions check actual requested fractional font size, weight, color, alignment, row background and inherited reset. Expected saved candidates, preserved data, revision/approval/undo and numeric diagnostics are checked separately from UI/Pi equality.
- Schema, cross-target scope, no-change and low-contrast rejection are exercised. Low contrast blocks inspection/export; a repaired candidate receives a different receipt before approval. Denied scope preserves the exact committed save and requires fresh permitted scope for recovery.
- A private-copy mutation removes the three real inspector calls to the shared services. Positive and restored recovery pass all 65 style tests; the mutant fails as expected. The mutated controller source hash remains unchanged and the private copy is removed; the later layout prerequisite does not change either style service or the mutation target.

The data auditor recomputes 153 actual style request digests and validates 42 unique numeric receipts across 21 retained style wire files (54 receipt occurrences). Every receipt has a paired inspect call/output, valid content hash and the current verified release identity. These style requests contain no image input. Pixel regression uses only the existing approved fictional fixture and authority.

## Artifact and custody

[Machine evidence](STUDIO_V3_CA04_STYLE_PARITY.json) records all 145 dependency hashes, commands and log digests, individual browser outcomes, request digests, numeric receipt content, normalized project evidence, mutation outcomes and the remaining parity IDs.

| Identity | SHA-256 / value |
| --- | --- |
| release | `local` |
| contractHash | `e01527621aa9f6338be5c12d61c80cbc1e64e9d2a0ab7d3a328ae681ff1a1e41` |
| knowledgeHash | `74f92af6e265ec2cdee34f906dc1279edfd9f448cdf0ee268b24ec8e0e55e086` |
| packageHash | `5ccfe08355d0f4788bda06c44dabd9f7d7d77a06cb33d967a30ec62ed9505635` |
| appHash | `71bd92947d8666cea8e6e65211a93785223a1c6cc24b7f75c607d0a9bdb6ecf5` |
| manifestHash | `987c393f0c9daef3c641ba5d481afeef72ce93177953918188ffa8bced112b46` |
| dependencyIndexHash | `afa536ce97e963bb0f35e5046eb8339859cb1e4ee9fcc6167bd8027c72656534` |

The current source hashes match the built dependency index; root and pinned app/manifest/resource copies match. Raw logs, native report, wire bodies, saved fictional forms and the runtime copy remain at `.printform-studio/ca04-style-parity-20261013-OxO9be`. The auditor verifies 897 pre-existing files byte for byte, excluding the three intended documentation notes and four prerequisite/review files; this preserves historical CA-04/CA-05 reports and unrelated progress-audit work.

| Check | Exit | Elapsed seconds |
| --- | --- | --- |
| focused | 0 | 25.408 |
| full-vitest | 0 | 520.923 |
| agent-gate | 0 | 9.519 |
| build-site | 0 | 686.750 |
| browser-json | 1 | 584.226 |
| browser-recovery-json | 1 | 182.719 |
| firefox-trace-off-json | 0 | 13.919 |
| firefox-no-trace-stability-json | 130 | 248.949 |
| mutation-positive | 0 | 24.497 |
| mutation-mutant | 1 | 5.840 |
| mutation-recovery | 0 | 23.154 |

## Findings, limits and remaining work

The delivery gap was stale TASK progress and no durable final typography report; the registry already recorded both shared services. Its earlier wording also suggested differential tests alone could close COV-03; the note now matches the acceptance contract, requiring both a shared service and differential evidence. This checkpoint resolves those documentation gaps.

The reproduced P2 was a zero-height reference region at 1280x720 despite a valid selected scope. The first 66-case matrix has 45 passes and 21 failures, all with that assertion; it remains under initial/ with exact failed traces/screenshots. The post-fix matrix is separate, not a rewritten initial success.

Four Firefox typography/row-fill/table-style cases then reached their unchanged 90/120-second test limits. The two typography traces end during computed-style reads from the preview iframe after successful save. Unchanged serial reruns recover three cases; page-number repeats the timeout. A provisional node-bound reader also stalls and was reverted byte for byte. The unchanged page-number test passes once with trace disabled, but a subsequent no-trace repeat fails again (1 pass, 1 failure, 6 skipped/interrupted). A private direct-frame reader probe is interrupted without a completed case; it provides no acceptance credit. Both follow-on probes were cancelled when host load was excessive (recorded one-minute load 116.6796875 on 10 logical CPUs, about 707 MiB free). Other workloads were preserved. Independent Firefox probes read actual CSS after four saves and five edit/save cycles. Load is a plausible contributing factor, not a proven root cause; tracing is not established as the cause. A clean complete Firefox matrix remains required. No product fix is claimed for these timeouts. Failed, interrupted diagnostic and recovery reports are preserved separately.

The four-viewport regression checks unchecked defaults, independent permission scrolling, selected references, input/Send visibility, no horizontal overflow and close/reopen. One exploratory probe initially tried to click the default-collapsed structure panel; using the visible Add to chat entry then measured the actual defect and candidate repair. No assertion or timeout was weakened. Prior row-fill and typography attempts remain historical evidence; their counts and identities are not relabeled as the current run. The intentional mutation failure is the expected negative oracle. Existing non-fatal Node/jsdom/build warnings remain visible in raw logs. Passing individual-case coverage is not a clean browser suite and does not close acceptance.

Only `printform.table.row-fill` and `printform.style.element` change parity disposition relative to main. The register is 4 shared / 16 parallel / 12 agent-only. The other 16 authoring workflows still prevent full COV-03 closure. CA-05/G4 retains its separate qualification status, including its pending blinded human review; this work does not award additional G4 closure.

No permission expansion, real customer data, live/paid model, deployment, push, PR, commit or merge occurred in this follow-up. Provider usage is synthetic; real model competence and cost are not measured. The requested `.agent/rules/03-verification.md` is absent; the available verification module and explicit acceptance requirements govern this report. Every changed authored file is at most 300 lines. No user work was discarded.

Latest follow-up: [Firefox recheck](STUDIO_V3_CA04_FIREFOX_RECHECK.md) retains Partial status on the identical artifact. Complete attempts pass 25/26, 24/26 and 23/26; captured missing iframe contexts require further review. Earlier outcomes and unknown causes remain recorded.
