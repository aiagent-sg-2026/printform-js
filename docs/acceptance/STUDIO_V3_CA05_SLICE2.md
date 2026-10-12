# CA-05 slice 2: host text authorization and semantic observation

Date: 2026-10-12 (Asia/Singapore). Status: bounded slice implemented, ready for review; CA-05 and Gate G4 remain open. Source base: `774db9283b444d5e75aa13e529856dfe8347e402`; branch: `codex/studio-v3-ca05-observation`; changes are uncommitted. No commit, push, PR, merge, upload, deployment or paid model call was performed.

## Preconditions and authorized boundary

CA-04 remains Pending: 18 parallel authoring workflows, 2 shared workflows and 12 agent-only entries. Shared numeric inspection and the scenario-matrix service suffice for this read-only observation slice; none of the 18 authoring parity gaps blocks it or was silently implemented. The register, scenario matrix and Validate implementation are unchanged. Their parity gaps remain prerequisites for broader Studio completeness.

After slice 1 review, the semantic slice initially stopped at a real prerequisite: `controller.js:createBus` supplies only `{allowDurable:false}`, with no label/static-text/binding-path disclosure authority. The separately authorized prerequisite adds one default-off host text grant in the AI panel. That approval permits this bounded OBS-01 slice; it does not permit Real/Unknown values or pixels. Running samples, demos or synthetic validation never mints provider value permission.

## Change and ownership

- `observation-policy.js` owns host-branded authorization and freshness. A grant binds document, committed revision, complete project content digest, host policy digest, selected targets and run; expires at the existing agent deadline; is revoked when an observed host change occurs or any UI run completes, fails or is cancelled. A model-supplied lookalike cannot pass the private custody map.
- `ai-observation-authorization.js` owns default-off, one-use UI consent. Its notice before Send describes current label/static-text/assigned-path disclosure, independent bound-value authority and blocked page/embedded-asset pixels. Content/revision/policy/selection changes invalidate armed consent. An authorization epoch rejects a mint that finishes after cancellation; consuming a new run first revokes the old object. Conversation clearing/restoration resets it.
- `observation-context.js` owns the 32,000-byte semantic projection: authorized field/section/heading text, assigned pointers and collection, selected target IDs, active scenario/row count, layout and real renderer diagnostics. It reads only assigned scalar values when host policy explicitly permits synthetic document context; it never enumerates arbitrary data keys or serializes asset bytes. Encoded pixel scalar content and oversized context reject without truncating or emitting partial content.
- `agent-contracts.js`, `agent-registry.js`, `agent-handlers.js` and the bundled guide register `observe_context` at contract `1.0.0`, with executable accepted/rejected examples. The orchestration prompt is unchanged.
- Existing receipt custody hashes the complete semantic content and disclosure policy. Candidate edits or undo invalidate semantic reuse even if bytes return to their prior state; a fresh run/grant recovers. Numeric inspection remains available for draft recovery and remains the proposal's final inspection gate.
- `ai-agent-run.js`, `agent-provider.js` and `ai-demo-transport.js` recheck live authority at effects, actual fetch dispatch (including session/401 refresh) and response acceptance. Received token usage is accounted even when the response is rejected as stale.
- `ai-panel.js` marks answers produced under observation disclosure. `ai-conversation.js` retains this host-owned restriction through snapshot/restore and excludes those answers from later provider history while keeping them visible locally.

## Verification and independent evidence

| Check | Observed outcome |
| --- | --- |
| `tests/studio-v3-semantic-observation.test.js` | 16/16: default/forged rejection; authorized labels/static text/bindings/selection/layout; independent Unknown/Real/synthetic value and pixel policy; expiry; document/revision/run/content/policy/selection changes; sticky policy revocation; render race; edit/undo; encoded/oversized rejection and recovery |
| `tests/studio-v3-semantic-wire.test.js` | 6/6: actual Pi/Demo outgoing requests contain authorized text and exact tool-call/receipt pairing; negative value/secret/pixel canaries; independently permitted synthetic bound values; encoded pixels rejected; late policy and 401-refresh rejection; fresh-run recovery |
| `tests/studio-v3-observation-authorization-ui.test.js` | 9/9: default-off/one-use/reset; armed content/revision/policy invalidation; protected history through snapshot/restore; real direct completion/discovery failure revocation; cancellation during SHA await; next-consume revocation and fresh approval recovery |
| Post-review focused regression | 4 files / 36 tests passed, including 31 semantic/authorization cases and 5 notice cases; the earlier usage regression also proves stale responses account their 12 reported tokens |
| Wire mutation | Native outgoing-body oracle: positive exits 0, mutant exits 1 at the label-canary assertion. The original Vitest wire spec also runs in an isolated source copy: positive 6/6; omitted semantic reply content causes 5 expected failures / 1 pass. Shared handler SHA-256 unchanged; temporary copy removed |
| `npx vitest run --maxWorkers=1 --no-file-parallelism` | 199 files / 1649 tests passed after the independent-review lifecycle correction |
| `npm run check:studio-v3-agent` | Passed: 12 tools, 13 operations, 2 guides, 66 executable examples and 27 digest-bound reviewed changes; publication baseline retained |
| `npm run build:site` | Passed on the corrected frozen runtime/ledger tree, including its own full 199-file / 1649-test regression |
| `npx playwright test e2e/studio-v3-observation-receipt.spec.js e2e/studio-v3-semantic-observation.spec.js --workers=1` | 6/6 passed across Chromium, Firefox and WebKit; real Validate panel, renderer, AI panel, Pi handlers and transport; only the external gateway is a recording stub |

The semantic browser fixture imports a fictional form containing label/static-text, Unknown bound-value, arbitrary-secret and encoded-pixel canaries. It runs Validate, then executes default denial, explicit text approval, unapproved next-run denial and fresh approval recovery. Each engine records 10 outgoing requests and 2 unique semantic receipts at r0. Authorized text appears only in approved run bodies; Unknown values, arbitrary secrets and pixel canaries never appear. The later unapproved run excludes prior authorized text even when the previous answer deliberately echoed it. The original receipt fixture also passes: 11 requests, 4 unique receipts and revisions `[0,0,0,1]` per engine.

Independent Node crypto checks validate content SHA-256, exact function-call pairing, all receipt release/contract/knowledge/package identities against the built manifest, source-to-build identity, manifest resource hashes and root/pinned app equality. [Metadata](STUDIO_V3_CA05_SLICE2.json) records raw wire hashes, paths, browser/runtime versions, source hashes, mutation output and check logs. Retained evidence is local under `.printform-studio/ca05-evidence/slice2/`; it contains fictional test traffic only. Model identity, live model competence and actual monetary cost are not qualified by the stub's reported token counts.

## Failures, correction and recovery

An early full run had five failures: three old notice expectations, an ordinal-based guard test invalidated by the new dispatch checks, and a run overlapping a source/test reset edit. The latter was not accepted as frozen-tree evidence. Expectations and the guard fixture were corrected; subsequent full runs used a frozen tree.

A later browser negative control exposed a real disclosure defect: the ordinary conversation path replayed an earlier authorized answer into the next unapproved `get_context` request. The historical eight-request failure wire and its manifest are retained separately. The producer/history restriction above fixes the ownership boundary; a three-engine recovery run and the final combined six-case run pass the same echo-canary assertion. The wire mutation's failure is intentional. A first mutation rerun used the wrong CLI mode and was rejected by the parent oracle; the corrected rerun is the retained evidence. The first isolated Vitest copy omitted the root `src` dependency and collected no tests; this environment failure is retained and excluded from mutation credit. Adding `src` to the private copy produces the 6-pass / 5-expected-failure result above.

Existing Node module-type, Vite external `node:fs` and Playwright color-environment warnings did not fail their checks. No check was weakened or warning suppression added.

## Independent review and corrected finding

A separate read-only reviewer, `/root/ca05_slice2_review`, started with independent context and did not implement or edit this slice. It independently checked the initial report/source/wire/check/mutation/history/app/manifest hashes, raw provider bodies, policy/dispatch/response/history boundaries and mutation sensitivity. [Independent findings and verification](STUDIO_V3_CA05_SLICE2_REVIEW.md) records its exact commands and identities.

It confirmed one P2: single-step completion, discovery failure before a step run and cancellation during SHA mint left branded host authority valid. Reusing the retained object and its original runId through real `runPanelAgent` emitted two recording-stub requests containing the authorized text canary. The ordinary next Send creates a new runId and did not automatically reuse the object; this was an end/cancellation revocation defect, not a claim of automatic next-run leakage.

The smallest correction adds `AIObservationAuthorization.end()` at panel finish/cancel, revokes before another consume, and checks an epoch after hashing to reject/revoke late mint. It preserves an unconsumed checkbox across Send’s internal begin/cancel. Four new lifecycle regressions pass. The same independent reproduction now finds no active authority after direct completion, discovery failure or cancelled mint; saved old objects reject with `OBSERVATION_AUTHORIZATION_STALE`, and replay through the real agent sends zero outgoing requests. Fresh explicit grants remain usable until end. The reviewer found no other actionable source defect within this bounded slice; final artifact/wire identities are checked after rebuilding.

The original pre-review slice-2 report, metadata, source snapshots, app/manifest, wires and logs are preserved under `.printform-studio/ca05-evidence/slice2-before-review/` with repository-relative paths. Initial 199-file/1645-test and six-browser results remain historical evidence; current acceptance uses the corrected source and 1649-test results. No tests were weakened.

## Gate G4 disposition

| Case | Current evidence and remaining gap |
| --- | --- |
| OBS-01 | Partial: authorized semantic context reaches the actual wire; text/value/pixel decisions are independent. Pixels stay off; full observation qualification remains open |
| OBS-02 | Partial: fresh run-owned semantic/numeric receipt custody and invalidation verified; page/crop retrieval and evidence bytes remain open |
| OBS-03 | Partial semantic wire proof only: exact receipt/tool pairing and canaries; pixel canary and post-compaction image preservation remain open |
| OBS-04 | Open: negotiated provider image modality and image-byte limits are outside this slice |
| OBS-05 | Open: final numeric inspection keeps the latest receipt; independent missing-section/wrong-text/width/alignment/pagination comparison is not implemented |
| OBS-06 | Partial rejection evidence only: Unknown/Real values, arbitrary keys and encoded pixel scalars blocked. Actual raster/signature fixtures and explicit authorized pixel paths remain open |

Ledger structure/selection rows keep their Limited baseline and eligible gaps; no G4 case is declared closed. CA-04 remains Pending with 18 parallel entries. Stop here for review before page/crop retrieval or image-wire work.

## Reporting limitation

`.agent/rules/03-verification.md` and the routed investigation/architecture/verification modules are absent from this checkout and the inspected parents. This report follows the available core rules and explicit acceptance requirements; no missing format was invented. Final tree: 42 changed/new files, maximum 281 lines. Whitespace, local documentation links, historical slice-1 archive hashes and current source/artifact checks pass. Adding this report/metadata only copied documentation into `site-dist`; tested runtime assets and package identity are unchanged.
