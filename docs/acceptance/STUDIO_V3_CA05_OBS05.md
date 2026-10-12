# CA-05 OBS-05 technical evidence and delivery

Date: 2026-10-12. Branch: `codex/studio-v3-ca05-observation`. Base HEAD: `774db9283b444d5e75aa13e529856dfe8347e402`.
Status: ready for independent review of this evidence delivery. CA-05 remains Partial; full Gate G4 remains Open.

## Authorized scope and result

This delivery resolves the two P2 review findings: the missing linked report pair now exists, and fresh native-browser evidence binds current source, rebuilt artifact, latest observation and the exact final delivered UI text. [Machine evidence](STUDIO_V3_CA05_OBS05.json) stores all 33 final texts, their SHA-256 digests, receipts, evidence references, request hashes, native measurements and source/artifact hashes.

Only this report pair and evidence notes in TASK, the Markdown feature ledger and agent registry are changed by the delivery. Existing runtime, tests, ledger CSV, disclosure grants and CA-04 owners are preserved. No commit, push, PR, merge, deployment, live/paid provider or external-data transmission was performed.

Existing default-off, one-run fictional text/pixel consent is the only exercised grant. Business values and sensitive raster/signature/embedded assets retain their existing restrictions. Tests use unbound, image-free fictional forms and a local provider stub recording the real transport body.

## Current artifact identity

The fresh site build, generated source identity, each native receipt and all recorded delivered cases match this identity. Local HEAD alone does not identify this dirty working tree; the 143 dependency hashes and the app/manifest hashes in the companion JSON bind the actual artifact.

| Field | Value |
| --- | --- |
| release | `local` |
| contractHash | `8aaf4804b67f40dbebba90d444de3b9b39b131015dc14e773cb0ba6f0b9f4d6c` |
| knowledgeHash | `74f92af6e265ec2cdee34f906dc1279edfd9f448cdf0ee268b24ec8e0e55e086` |
| packageHash | `6cc44e253b6389d1a23c2ad0abfc9c742d7c2c00b157c5e807c896d7a6442d77` |
| appHash | `808ddf64b05236af84400f705be793b59d8f61a01ec12bbcd8e054bb2226c078` |
| manifestHash | `c721c08901f0df69c3f11561b3d2b343b5decec4abdcee5a14f27cedafd51584` |

Both published copies of the four declared agent resources are checked (8 resource hashes). The dependency index contains 143 verified current source hashes. The browser harness blocks service workers and uses the rebuilt local site artifact.

## Latest receipt and completion behavior under review

The existing `finish_answer` v1.1.0 handler uses `observation-records.js:current()` as the latest receipt owner. It rejects old/foreign IDs and invalidated observations. Host finalization appends `Observation receipt: <latest id>` and preserves the citation in the delivered answer/history within the 4000-character limit; guide-only answers still work.

The 12 completion units cover positive completion, explicit/omitted IDs, old/foreign/changed candidate or revision rejection, recovery with a fresh receipt, finalizer behavior, answer limits and no-observation guide answers. The 9 comparison units exercise a fixed independent fictional oracle and deliberate defect/recovery fixtures. These runtime changes predate this evidence-only delivery.

## Independent deterministic comparison

The fixed test oracle owns literal expectations independently of the application: one 794 px page, visible header/footer, exact fictional text, footer width 700-730 px and left text gap at most 2 px. Native Playwright DOM rectangles and glyph Range bounds provide observations; model similarity scores do not decide success.

| Deliberate defect | Independent rejection evidence | Recovery |
| --- | --- | --- |
| Missing section | Required visible footer absent | Restored fixture passes |
| Wrong text | Footer differs from `END OF FICTIONAL FORM` | Exact text restored |
| Width | Footer shrinks from 722 px to 355 px | Width returns to 722 px |
| Alignment | Left text gap exceeds 2 px (about 572 px) | Left alignment restored |
| Pagination | Page count changes from 1 to 2 | One page restored |

All three engines run one baseline plus five defect/repair pairs: 33 fixtures, 18 baseline/recovery passes and 15 deliberately rejected defects. Each fixture records five outgoing requests: inspect, receipt-bound page retrieval, rejected old receipt, rejected foreign receipt, and final completion with host-authored latest citation.

The OBS-05 subset contains 165 requests, 99 image-bearing inputs, 66 distinct receipts and 33 evidence IDs. Every PNG digest, tool-call/result pairing, receipt content digest and release identity is independently checked. The final delivered text contains the latest pixel receipt and excludes its superseded source receipt. Three receipt, three semantic and three pixel regression specs also pass; their request totals are separate from the OBS-05 subset.

## Commands and observed results

Commands execute from the repository root through the ignored local `run.mjs` recorder. Its command, exit code and elapsed time are retained in the machine evidence; native JSON and logs are hashed rather than fabricated.

| Check | Result | Elapsed |
| --- | --- | --- |
| `npx vitest run --maxWorkers=1 --no-file-parallelism` | 206 files / 1773 tests pass | 208.842 s |
| `npm run check:studio-v3-agent` | 76 contract examples / 28 digest-bound reviewed changes pass | 1.646 s |
| `npm run build:site` | Full tests, asset build and site build pass | 220.464 s |
| Focused Playwright command below | 12/12 specs across Chromium, Firefox and WebKit; no page errors | 88.925 s |
| Mutation positive / restored recovery | Exit 0 / 0 | 1.282 / 1.065 s |
| Remove outgoing image step | Exit 1: `MISSING_ACTUAL_OUTGOING_IMAGE` | 1.153 s |
| Remove host citation step | Exit 1: `MISSING_HOST_LATEST_CITATION` | 0.883 s |
| Post-note metadata/contract/OBS regressions | 9 files / 55 tests pass | 9.185 s |

The exact focused browser command is:

`npx playwright test e2e/studio-v3-observation-comparison.spec.js e2e/studio-v3-observation-receipt.spec.js e2e/studio-v3-semantic-observation.spec.js e2e/studio-v3-pixel-observation.spec.js --workers=1 --reporter=json --output=.printform-studio/ca05-obs05/delivery-browser`

Mutations run the existing ignored `.printform-studio/ca05-obs05/mutation.mjs` with no argument, `remove-wire`, `remove-citation`, then no argument. A loader changes only its in-memory target module; production source bytes are unchanged. Intended assertion failures and restored passes are credited; initialization failures are not.

Raw evidence: [native browser JSON](../../.printform-studio/ca05-obs05/delivery-browser-json.report.json), [independent audit](../../.printform-studio/ca05-obs05/audit.json), and the command logs/receipts named in the companion JSON. These raw local files are ignored and retained in this workspace; the report pair contains durable reviewed summaries, exact delivered texts and custody hashes.

## Failure history and preservation

- Before implementation, all 12 completion cases failed; implementation and focused/full recovery passed.
- The first browser matrix selected an earlier visible answer card (3 failures). Per-round request/citation guards recovered; the fresh current-artifact run passes.
- An earlier full run observed one guide/review digest mismatch during concurrent edits. Stable-source and this fresh full/build run pass.
- The prior artifact was initially cleaned before its freeze. Its 896 source files were reconstructed from saved hashes; a private-directory build changed module IDs and was not credited. Read-only reconstruction with canonical original module IDs reproduces the prior app/manifest byte for byte, without replacing current source.
- The independent review's first mutation loader damaged CommonJS initialization. Those failures are excluded; the corrected targeted loader fails on the intended image/citation assertions and recovers.
- The review's temporary browser configuration had initialization issues; corrected local configuration recovered without product edits.

All 17 prior acceptance-report hashes remain unchanged. Prior app/manifest identity is retained separately under `.printform-studio/ca05-obs05/previous-artifact`; its reconstruction method and exact hashes are disclosed in the JSON. Historical slice evidence is not relabeled as this current artifact.

Report files use same-directory exclusive temporary files, mode 0600, fsync and atomic rename. Normal replacement, injected pre-rename failure, symlink/non-file refusal and no temporary residue were checked. Requested `.agent/rules/03-verification.md` is absent; this report follows the available verification module and the explicit command/identity/failure requirements.

## Remaining acceptance boundary

This is a fixed fictional test oracle, not a general product comparison or approval service. Full G4 still requires its frozen human comparison rubric and blinded human review. No native-print fidelity, real/sensitive-data transmission or live-provider qualification is claimed. The two evidence delivery findings are resolved; the current bounded result stops for independent review without changing CA-05 Partial or full G4 Open.
