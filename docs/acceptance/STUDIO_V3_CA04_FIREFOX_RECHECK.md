# CA-04 Firefox verification recheck

Date: 2026-10-13. Branch: `codex/studio-v3-ca04-style-parity`. Source commit: `da38846aea170f6f234770bf43a899b68559f0db` plus the unchanged recorded dependency hashes.
Status: Partial. The requested clean Firefox qualification is not complete. Complete suites pass 25/26, 24/26 and 23/26 respectively; every remaining failure is a timeout. No retries, skips or flaky classifications occur. Stop for independent review; no Done or G4 closure is claimed.

## Scope and constraints

This follow-up checks machine load and reruns only the existing row-fill, heading/page-number typography and nearby authoring, table-style, observation and composer Firefox acceptance. It implements none of the remaining 16 parallel CA-04 workflows. Existing runtime, fixtures, assertions, grants, per-case timeouts, 12-second expect timeout and retain-on-failure trace configuration remain unchanged. Runs use one worker and zero automatic retries. Other tasks are never terminated. No commit, merge, push, PR or deployment occurs.

The initial sample reports a one-minute load of 37.11 on ten logical CPUs and 18.04% CPU idle. A later preflight reports 66.52% idle and load 20.41. Serial testing begins then. Load later fluctuates markedly, including zero-idle samples. A second preflight holds load near nine and idle at 23%–32% for 30 seconds, but saturation recurs during that full run. Runtime load records are retained per attempt; load is not established as the timeout cause. The tested Firefox also consumes substantial CPU during the protocol run, so blaming other tasks alone is unsupported.

## Native outcomes

| Attempt | Passed | Failed | Exit | Elapsed seconds |
| --- | --- | --- | --- | --- |
| firefox-focus-json | 7 | 1 | 1 | 184.073 |
| firefox-protocol-json | 2 | 0 | 0 | 22.428 |
| firefox-protocol-repeat-json | 4 | 0 | 0 | 33.065 |
| firefox-table-protocol-json | 2 | 0 | 0 | 22.787 |
| firefox-full-json | 0 | 26 | 1 | 23.269 |
| firefox-full-isolated-json | 25 | 1 | 1 | 239.357 |
| firefox-full-stable-json | 24 | 2 | 1 | 341.752 |
| firefox-full-protocol-json | 23 | 3 | 1 | 459.601 |
| firefox-iframe-probe-json | 1 | 0 | 0 | 5.079 |
| firefox-exported-iframe-probe-json | 0 | 1 | 1 | 123.363 |
| firefox-exported-iframe-csp-preserved-json | 1 | 0 | 0 | 5.029 |

The first four-case repeat passes 7/8, with one page-number timeout. Supplementary page-number protocol runs pass 2/2 then 4/4; the table-clearing protocol repeat passes 2/2. These are individual recovery evidence, not a passing complete matrix or a resolved cause.

The first full attempt cannot launch any of its 26 cases because the previously available shared Firefox executable has disappeared. Who removed it is unknown. The task installs Firefox 153.0 / Playwright revision 1538 and FFmpeg into its own private cache with garbage collection disabled; the shared cache is untouched. Playwright remains 1.62.0. The installed executable hash is `65ecab21ee6aa479836eb27aec213e15295f07ca21b5aa995d45bcaff4d09d7d`. Its bytes are verified now; matching the absent historical executable bytes cannot be established.

The private-cache full suites exactly match the original 26-case Firefox inventory. Their per-case timeouts match the original executed native baseline. List-only inventory reports the default timeout for three specs that set their timeout inside the callback, so the auditor compares executed baseline results instead. This changes no test or timeout.

- Full isolated: 25/26; table selection/manual stripe restoration times out at the original iframe CSS assertion.
- Full stable-preflight: 24/26; page-number computed-style reading and low-contrast recovery selection time out in the preview iframe.
- Full protocol capture: 23/26; page-number plus two existing table-style cases time out. Protocol logging does not prevent the failure.

## Verified protocol facts and remaining uncertainty

All three protocol-run failures report destruction of the preview frame's main and utility execution contexts. Later DOMContentLoaded/load events occur for that frame, but no replacement execution-context creation is received before timeout. A subsequent Page.describeNode response still identifies the preview frame. The local Playwright implementation clears its frame context on the destruction event and waits for a new context before iframe queries. Native traces end at the affected iframe read/assertion. The paired source and protocol records support a missing-context wait; they do not establish what caused the context loss or which layer owns a fix.

Two isolated fictional diagnostics do not reproduce it: a minimal sandbox iframe survives 40 srcdoc replacements, and the actual fictional exported form survives 20 renders with its original CSP and script hashes unchanged. These are diagnostic evidence only. An earlier exported-form probe added an unauthorized notification script under the fixture CSP and consequently timed out waiting for its message; this is a probe construction error, not an application failure. The script was removed for the corrected probe. No product CSP or disclosure authority was expanded.

A clean full matrix remains missing. No speculative product, SDK or test workaround is applied. Browser load, tracing, shared-cache disappearance and product correctness remain distinct facts; neither passing probes nor combined per-case recoveries close this acceptance gap.

## Artifact, wire and preservation

| Identity | Value |
| --- | --- |
| release | `local` |
| contractHash | `e01527621aa9f6338be5c12d61c80cbc1e64e9d2a0ab7d3a328ae681ff1a1e41` |
| knowledgeHash | `74f92af6e265ec2cdee34f906dc1279edfd9f448cdf0ee268b24ec8e0e55e086` |
| packageHash | `5ccfe08355d0f4788bda06c44dabd9f7d7d77a06cb33d967a30ec62ed9505635` |
| appHash | `71bd92947d8666cea8e6e65211a93785223a1c6cc24b7f75c607d0a9bdb6ecf5` |
| manifestHash | `987c393f0c9daef3c641ba5d481afeef72ce93177953918188ffa8bced112b46` |
| dependencyIndexHash | `afa536ce97e963bb0f35e5046eb8339859cb1e4ee9fcc6167bd8027c72656534` |

All 145 source/evaluation hashes remain unchanged. The current root app, HTML/CSS, manifest, dependency index and root/pinned agent resource hashes match the tested browser snapshot. The auditor preserves 902 pre-existing files byte for byte, excluding only five intended evidence notes; the CSV, code/tests, CA-05 reports and unrelated progress-audit work are preserved. No release-review publication baseline advances.

The auditor validates 23 successfully completed style wire records from the attempted runs: 168 actual outgoing requests, 47 distinct numeric receipts and 55 receipt occurrences. Each inspection result has a paired actual tool call, a recomputed content digest and current verified release identity. UI/Pi saved candidates, independent expected values, scope/schema/no-change/contrast rejection and fresh recovery remain checked where the native cases complete. These duplicate-run records are not counted as 23 distinct acceptance cases. Style wires contain no images. The 12 retained composer records cover the same four viewports in three runs and pass their unchanged reference/permission geometry checks. Existing observation fixtures retain their prior fictional authority and provider recording stubs.

The prior full unit suite passes 206 files / 1773 tests; the final site build independently runs the same unit total and passes. The prior agent gate passes 76 examples / 28 reviewed changes. These existing checks are explicitly reused because source/evaluation and artifact hashes are identical; no fresh full unit/build run is claimed. Follow-up documentation checks and the agent gate are recorded separately after writing the notes.

[Machine evidence](STUDIO_V3_CA04_FIREFOX_RECHECK.json) contains exact commands, native case outcomes, artifact/source/request/report digests, paired receipts, protocol facts, load samples and previous evidence hashes. Raw evidence and diagnostic reproducers are retained at `.printform-studio/ca04-style-parity-20261013-OxO9be/firefox-recheck-20261013-aedWye`. The requested `.agent/rules/03-verification.md` is still absent; the available verification module and explicit acceptance criteria govern this report.

CA-04/COV-03 remains Partial: 4 shared / 16 parallel / 12 agent-only. The bounded Firefox gap and other workflows remain open. CA-05/G4 and its separate blinded/human qualification are unchanged. Further review should inspect the missing-context protocol sequence before selecting a prerequisite fix or another controlled execution environment.

Fresh follow-up metadata checks pass 2 files / 9 tests, and the agent gate passes 76 examples / 28 reviewed changes after the notes are written. Their command exits are zero; these passes do not override the failed Firefox qualification.
