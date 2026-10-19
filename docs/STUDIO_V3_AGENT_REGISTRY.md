# Studio v3 Agent Registry and Release-Bound Knowledge

This registry makes supported private-draft capabilities discoverable and gives the browser bounded product guides. It preserves provider, selected scope, inspection and explicit UI Preview/Apply. The broader [architecture plan](STUDIO_V3_AGENT_ARCHITECTURE_PLAN.md), [baseline inventory](STUDIO_V3_AGENT_COVERAGE_INVENTORY.md), [coding-agent plan](STUDIO_V3_CODING_AGENT_PLAN.md) and [acceptance standard](STUDIO_V3_CODING_AGENT_ACCEPTANCE.md) include unavailable or unqualified work; registered tools and green fixtures do not imply whole-Studio production readiness.

## Authoritative owners

| Concern | Source owner |
| --- | --- |
| Operation names and closed wire schemas | `studio-v3/agent-operation-schemas.js` |
| Tool contracts, capability IDs, source/skill/evaluation references | `studio-v3/agent-registry.js` |
| Tool effect handlers and inspection gate | `studio-v3/agent-tools.js` |
| Contract version, output schemas, declared errors, accepted/rejected examples | `studio-v3/agent-contracts.js` |
| Error codes mapped to contract families, recoverability and retry advice | `studio-v3/agent-errors.js` |
| Executing every example through the real handlers before publication | `scripts/studio-v3-agent-conformance.mjs` |
| Trusted tool handlers keyed by tool name | `studio-v3/agent-handlers.js` |
| Workflows the agent cannot perform, generated from the feature ledger | `studio-v3/agent-workflows.js` (`scripts/generate-studio-v3-workflows.mjs`) |
| Dynamic field/path/scope/design checks | Existing authoring/parser modules |
| Frozen numeric/financial binding invariant | `studio-v3/agent-binding-invariants.js` |
| Browser-readable guide and knowledge index | `studio-v3/agent-knowledge.js` |
| Build package, fingerprints and change diff | `scripts/generate-studio-v3-agent.mjs` |
| Pre-run release handshake | `studio-v3/agent-release.js` |
| Run-owned observation receipt and freshness | `studio-v3/observation-records.js` |
| Host text/value authority and explicit fictional pixel consent | `studio-v3/observation-policy.js`, `studio-v3/ai-observation-authorization.js` |
| Bounded semantic projection | `studio-v3/observation-context.js` |
| Protected answer history and recovery | `studio-v3/ai-conversation.js` |
| Bounded public blocked reason and error presentation | `studio-v3/agent-blocked.js`, `studio-v3/ai-messages.js` |

The operation schema describes legal shapes and static bounds. Dynamic rules (available assets, current paths, exact permutations, item/non-item geometry, total widths and user scope) still require local validation. Transport validation does not replace those services.

Twenty-two tools remain registered:13 Studio tools plus9 optional workspace tools. Actual run grants are narrower: an explicit ordinary design draft has12 tools, removing only `finish_answer`; source tools still require a real host-authorized lease. There are13 closed operation kinds and4 guides, including feature-owned `general-print-authoring`. New/additional-table creation, source collections, primary currency, import/download/share and native print remain human workflows; typed editing of supported existing fields is not a grant to perform those actions.

The small orchestration prompt directs the model to discover capabilities and read the relevant guide. `get_capabilities` supplies schemas, guide metadata and the current run limits. `read_skill` supplies only a known bounded bundled guide; arbitrary paths/URLs are unsupported. The guide is product knowledge, while `take_notes` is temporary task memory. Guide reading is model-driven and synthetic tests demonstrate the mechanism, not independent real-model competence.

## Executable contracts (CA-02)

Every tool and operation declares `contractVersion` (SemVer; original entries started at `1.0.0`), the error codes it can raise, at least one accepted example and one rejected example; tools also declare an `outputSchema`. `validateRegistry` checks the static part: known error codes, examples that match the parameter schema without coercion, and rejected examples that are declared as schema rejections exactly when the schema rejects them.

`checkAgentConformance` executes declared examples through real `createAgentTools` handlers and validates outputs/errors. Source examples deliberately prove missing-session rejection, not invented process success; actual Docker/browser positive evidence is separate. Both `npm run check:studio-v3-agent` and site publication run the gate. A broken example, undeclared output/error or missing handler blocks publication.

Error codes are not renamed. `agent-errors.js` maps each one to a contract family (or none), a category, `recoverable` and retry advice; `get_capabilities` publishes that table. The model-facing catalog lists example inputs and error codes but omits output schemas and rejection fixtures, which stay host-side; it grew from about 27 KB to 36 KB. Handler messages keep their existing `CODE. ...` form.

## Effect grants and answers (CA-03)

`agent-effects.js` defines frozen permission ceilings; host request intent may only subtract authority. Genuine questions, negatives, quoted/source instructions and ambiguity stay read-only. Explicit design/coding drafts remove the answer effect without changing profile identity, scope or workspace authorization. `data` remains unavailable. Coding profiles require an actual branded source lease and one-run fictional-source consent; model arguments, restored history or grant-shaped objects cannot create authority. Only explicit UI Apply commits the candidate.

Enforcement has two layers. The model is shown only the granted tools and a prompt that names only those, and Pi rejects a call to a tool that was not shown before any of our code runs. Every registered tool is also wrapped, so its handler re-checks the grant and a denied call raises `GRANT_DENIED`, counts against the tool-call budget and, repeated, stalls the run. The conformance harness runs a denied example per write tool under the read-only grant. A forged call to a hidden tool is rejected by Pi and does not reach the tool-call counter; it still costs a model turn, so the token and time budgets bound it.

`finish_answer` is available only when the actual run grants answer. It needs prior product/context/inspection evidence; `get_capabilities` alone is not evidence. Explicit drafts must instead deliver a current inspected proposal with `finish`, or report a blocker. Compatibility answer-only output for a requested draft is `draft-not-produced`, never a delivered candidate or automatic Apply. Single-step fallback does not override that distinction.

The answer contract1.4.0 keeps finalized message bytes within4000 characters and stores the current observation separately. Omitted/null observationId is unspecified; explicit IDs must be actual latest identities, with the existing freshness and recovery restrictions. Original ab9 failures and corrected8c QA evidence remain in [actual evidence](acceptance/STUDIO_V3_G8_READONLY_20261017.md); they do not qualify a new source/profile.

`report_blocked` contract1.1.0 preserves only its bounded public1..500-character reason through normal and interrupted handoff. The error card labels it **assistant-reported**, not a host-verified product limitation. Exception messages, causes, source output and logs do not supply a fallback reason. A failed request delivers no candidate, does not retry itself and cannot commit the live form.

Actual corrected8c evidence: the unchanged frozen readonly QA task passed3/3 under the same model/route/budget; all3 dispatches used observationId:null and delivered the model's JSON bytes exactly. Oldab9 failures remain separate. An additional real-model inspect/answer UI check displayed the actual latest receipt at1440px/375px without body mutation or state changes; it is not a G8 attempt. The full180-attempt G8 threshold and production prerequisites remain open.

### Service parity register (CA-04, COV-03)

`docs/studio-v3-service-parity.json` classifies35 callable workflows:4 shared,16 parallel,15 agent-only. Three optional source workflows are agent-only, not newly claimed UI parity. Row fill shares `tableStyleChange`; heading/page-number typography shares `elementStyleChange`. The16 parallel authoring rows still have separate UI/agent implementations; COV-03 remains open. Register checks cover callable IDs, declared classifications and real referenced files; they do not parse test-title/source wording as proof of behavior.

The first shared workflow is the scenario matrix. `studio-v3/scenario-matrix.js` owns the scenario list, the synthetic candidates and the diagnostics; the Validate panel (`studio-v3/validate-all.js`) and the `validate_scenarios` tool both call `runScenarioMatrix`. The panel keeps the full quality it displays, and the agent receives the canonical view without page geometry. The tool is a read effect, so a read-only question can call it; it counts as evidence for an answer but is not an inspection of the exact draft, so `finish` still needs `inspect_draft`. Scenarios replace the form's data with built-in synthetic data, so a result says nothing about the person's own data.

CA-04 style checkpoint (2026-10-13): [current evidence](acceptance/STUDIO_V3_CA04_STYLE_PARITY.md) binds the existing row-fill and heading/page-number typography implementations to 65 style unit cases, 78 distinct three-engine browser cases covered (74/78 matrix, 3/4 traced serial recovery and 1/1 no-trace recovery; subsequent no-trace repeat remains failed/incomplete) (21 direct parity, 45 existing regressions and 12 composer cases); a minimal layout prerequisite preserves unchanged permission controls while preventing zero-height references. Exact outgoing numeric receipts and a shared-call removal mutation with recovery are retained. Full 206 files / 1773 tests, 76 contract examples / 28 reviewed changes and the site build pass. Current implementation remains 4 shared / 16 parallel / 12 agent-only; COV-03 stays open and disclosure/effect authority is unchanged.

### G3 evidence register

`docs/studio-v3-run-evidence.json` maps each G3 case to the tests that prove it, and `tests/studio-v3-run-reliability.test.js` fails if a cited test no longer exists. RUN-01 to RUN-05 and RUN-07 are covered; the token limit is a bounded overshoot (checked before each request, one response may cross it), not a hard ceiling. **RUN-06 is partial**: stop during a read, edit, render or Apply and the unsaved-work protection on update are proven, while test/build/output preparation, disconnect and unknown-effect reconciliation wait for the runner (CA-07) and output services (CA-06). **RUN-08 is open**: no durable session resume exists, so nothing consumes grant, revision, release and retention validation yet.

## Discovery, workflows and lifecycle (CA-02)

CA-05 slice 1 (2026-10-12): `inspect_draft` contract `1.1.0` adds an immutable `observation` receipt to its numeric result. The host binds run ID, frozen release identity, document ID, actual committed base revision, candidate generation, candidate/scenario/policy/content SHA-256 digests and capture time. The active scenario hashes the exact data rendered; only allowlisted numeric diagnostics cross the existing disclosure boundary. Receipt content stays in run-local custody.

An accepted edit or undo invalidates evidence even when the final content is identical. Capture checks state before and after rendering/hashing; late evidence is rejected. `finish` consumes only the latest valid receipt and retains it in the proposal inspection. A changed host revision rejects the old run; a new run captures the new revision. `validate_scenarios` still uses the shared service and cannot replace this final-draft inspection.

[Slice evidence](acceptance/STUDIO_V3_CA05_SLICE1.md): 22 new unit cases, an expected outgoing-payload mutation failure, full 196 files / 1618 tests, the agent release gate/site build and 3/3 focused browser paths. Browser fixtures exercise the real renderer/Pi/Demo wire with a recording provider stub. This is historical slice-1 evidence. Page/crop retrieval, pixel payload/compaction, modality limits and independent visual comparison remain open; no G4 case is fully closed by this slice.

CA-05 slice 2 (2026-10-12): `observe_context` contract `1.0.0` adds a bounded semantic projection with the same receipt custody. The AI panel offers default-off text disclosure for one run; the host brands and binds the grant to document, revision, content, selection, policy and run, expires it and revokes it on all UI completion/failure/cancellation paths. An epoch rejects late mint after cancellation; a new consume first revokes the prior object. Candidate edits/undo invalidate semantic reuse; numeric inspection can still recover a proposal. Provider dispatch, session refresh and response acceptance recheck live authority. Only assigned scalar values can pass an explicitly synthetic, document-bound host policy; Real/Unknown values, arbitrary data keys, assets and page pixels are excluded. The existing Studio host grants no value permission, including after synthetic validation.

Answers produced under disclosure keep a host-owned restriction through snapshot/restore and are excluded from later provider history. A browser fixture deliberately echoes authorized label/static-text canaries and verifies that the following unapproved run does not resend them. [Semantic evidence](acceptance/STUDIO_V3_CA05_SLICE2.md): 31 new unit cases, actual-wire positive/rejection/recovery fixtures, mutation rejection, 199 files / 1649 full tests, 66 executable examples / 27 reviewed changes, site build and three-engine browser recovery. Pixels are always off in this slice; CA-04 and G4 remain open.

`createAgentTools` takes its definitions and handlers from the registry and `TOOL_HANDLERS`, and `get_capabilities` lists exactly the tools given to the run. A new feature adds a descriptor, a contract, a handler and a guide; the core prompt and handler wiring stay unchanged. A test proves this end to end: a synthetic tool and guide are discovered, read and called through a Pi run without editing `agent-loop.js` or `agent-tools.js`.

The catalog no longer carries a hand-written unsupported list. `workflows` counts the human-mediated, not-yet-callable and intentionally unavailable ledger rows, and the bundled `product-workflows` guide lists each with its human path or reason. Both come from `agent-workflows.js`, which is generated from the ledger CSV; a test fails while it is stale. `unsupported` keeps only the two planned capabilities with no ledger row (source/shell execution, sensitive pixel evidence). `get_capabilities` is contract `1.1.0` because these fields are additive.

A deprecated entry stays callable with `status:'deprecated'` and an active `replacementId`. A removed entry leaves a bounded tombstone in `AGENT_TOMBSTONES` (id, name, replacement or null, `removedIn`, advice), published as `removed` in the catalog and in the manifest. The change report carries the replacement advice; a removal without a tombstone is reported with `tombstone:false` for the release gate to reject.

## Knowledge synchronization and release review (CA-02, G2)

`scripts/studio-v3-agent-impact.mjs` follows every static and literal dynamic relative import from each entry's declared sources, so an entry's hash covers its contract, the full import closure (including shared `studio-v2/core` renderer and validator modules) and the contents of its evaluations. Hashes normalize CRLF, so a Windows checkout gives the CI identity. A non-literal dynamic import cannot be tracked and fails the build. The runtime part of `packageHash` uses the same closure instead of a hand-kept list.

The generator writes `studio-v3/agent-index/dependency-index.json` (file hashes plus each entry's files, evaluations and guides). It sits outside the release folder, so the offline shell does not cache it. Given a baseline manifest and index, every change in `capability-changes.json` lists `causes` (changed files it depends on) and `impacts` (dependent guides and evaluations). Without a known predecessor every entry is `added` and `causes` is `null`.

`scripts/studio-v3-agent-review.mjs` is the gate. Each change needs a disposition bound to the entry's current digest:

```json
{"version":1,"baseline":{"release":"<sha>","packageHash":"<hash>"},"dispositions":[
  {"entries":{"printform.agent.finish":"<current entry hash>"},"disposition":"no-impact",
   "justification":"Why the guides and evaluations stay correct.","evidence":["tests/studio-v3-agent-loop.test.js"]}]}
```

- `updated` needs evidence of a dependent guide, source or evaluation that actually changed since the baseline.
- `no-impact` needs one of the entry's evaluations and a justification of at least 20 characters.
- `reconciled` is allowed only for the first full baseline.
- A changed digest makes the disposition stale. A disposition for an unchanged entry, or one written against another baseline, is reported for removal. A removal without a tombstone is always rejected.

Evidence for each G2 case: KNO-01/02/03/05 and the gate in `tests/studio-v3-agent-knowledge-sync.test.js`, plus deprecation and removal advice in `tests/studio-v3-agent-discovery.test.js`. KNO-06 (mixed release and missing resource stop before model calls, online, offline and cache upgrade) remains covered by the existing registry unit tests and the agent-registry/upgrade browser specs; its runner/artifact part waits for CA-07. KNO-07 is covered by a test showing one identity per run and a refresh on the next run; durable resumable summaries do not exist yet.

## Publication gate and runbook (CA-02)

`docs/studio-v3-agent-release/` holds the committed release state: `baseline-manifest.json` (and `baseline-index.json` once the live site publishes one) from the last successful publication, plus `review.json` with the owner dispositions. `buildStudioV3App`, which the site build and therefore the Pages deployment use, compares the generated package with that baseline and throws on any unreviewed, stale or unsupported change, so the deployment stops. `npm run check:studio-v3-agent` runs the same gate, and `tests/studio-v3-agent-release-gate.test.js` checks that the committed state passes on the current tree.

The first baseline was the live release `11cab7b`, which predated the dependency index, so its 24 changes were covered by one `reconciled` disposition (the first full reconciliation). The baseline was then re-recorded from release `0d023fc` (the first deployment through the gate), which publishes the dependency index: from there `reconciled` is rejected and `updated` must cite a file that actually changed. An edit to a shared module moves many digests at once: a single comment in `studio-v3/ai-authoring.js` invalidates 23 entries. One disposition record may list all of them.

Runbook:

1. Changing agent code, guides, contracts or their evaluations: run `node scripts/draft-studio-v3-agent-review.mjs`, which prints skeleton dispositions bound to the current digests with causes and impacts. Decide `updated` or `no-impact`, add a justification and evidence, and put them in `review.json` in the same PR.
2. After a successful Pages deployment: run `node scripts/record-studio-v3-agent-baseline.mjs` and commit the result. It reads the release named by the live page, its manifest and, when present, the dependency index, and fails closed on any mismatch, including a deployment in flight. It writes nothing on failure and resets the dispositions to the new baseline. The live site only switches after a successful deployment, so a failed deployment cannot advance the baseline.
3. Never edit digests by hand to silence the gate; regenerate the draft instead.

## Version binding and offline operation

Before Vite bundles the app, the generator validates registry IDs, references and existing source/evaluation files, then writes:

- `agent/capabilities.json`: tool/operation contracts and capability fingerprints.
- `agent/knowledge-index.json`: guide resources, content hashes and reverse source dependencies.
- `agent/resources/form-authoring.md`: the bundled guide.
- `agent/agent-manifest.json`: release, contract/knowledge/package hashes and file hashes.
- `agent/capability-changes.json`: added/changed/deprecated/removed entries, with review required.

The app embeds the generated identity. PWA finalization requires the same revision, copies the package into `releases/<revision>/agent/`, and includes every file in the hash-verified offline shell. The guide used by tools is also embedded in the same app bundle, so no file/shell environment or mutable external knowledge service is needed.

Before a built step run creates its Pi lane/provider request, it checks the page's exact immutable asset prefix and fetches that release's small manifest with a five-second abort-backed timeout. Release, contract, knowledge and package hashes must match the embedded identity. A mismatch or missing resource stops with a specific error; it does not fall back to unverified knowledge. The verified identity stays fixed for the run and is attached to capability/context/guide responses and the final proposal. Unbundled test/development execution explicitly reports `verified:false`.

The manifest is a consistency handshake, not an authentication signature. The hash-verified shell protects cached assets and the bundle is the trusted guide owner. No runtime download of arbitrary guide content is authorized by a manifest field.

## Context and binding corrections

Single-step context derives its three request/inspection cap and 225-second deadline from the gateway config. Step context declares actual tool-call/time/token/repeated-failure/image limits and release identity; it no longer claims three model requests or inspections. Tool calls and provider requests are different measures.

Numeric-bound fields retain their original bound kind and format, with no replacement text. Financial-bound fields additionally retain pointer and, for row fields, collection identity. The draft freezes that contract at task start and checks it after every accepted candidate and at handoff. Removing a field is supported, but re-adding the same protected identity cannot reset its financial contract. Rejection preserves the prior valid draft. Single-step authoring also validates its final candidate against its initial design. This protects original identities; it does not prove the business intent of every newly added field.

## Updating a capability

1. Add or amend the feature schema and registry descriptor. Declare its handler, effect/result semantics, source dependencies, guide and evaluation references. Add its contract in `agent-contracts.js`: output schema, error codes and at least one accepted and one rejected example. Bump `contractVersion` major for an incompatible shape or meaning change. Keep tool names/IDs stable when behavior is compatible.
2. Implement the local service/handler. Reuse dynamic validators and the private draft boundary. Do not grant file, data-write or committed-state authority merely by adding a descriptor.
3. Update the guide when behavior or workflow changes. After editing the feature ledger CSV, run `node scripts/generate-studio-v3-workflows.mjs`. Add meaningful task and rejection coverage; no core-prompt operation manual edit is needed.
4. Run `npm run check:studio-v3-agent`, relevant tests and the normal site build. Missing references, duplicate IDs/skill references or unmatched handlers fail checks.
5. Compare with the last successfully published agent manifest. Review source/schema/guide changes and their evaluations before release. Hashes expose changes but cannot prove a guide is semantically correct.

Initial builds have no published baseline and label every entry added. They do not pretend to have compared against a previous release. To generate an explicit release diff into a build directory:

```sh
node scripts/generate-studio-v3-agent.mjs --baseline /path/to/published/agent-manifest.json --output /path/to/build
```

The baseline must be a saved manifest from the last successful publication. This slice supports explicit baseline comparison; it does not fetch deployment history or enforce a human approval in CI. Contract/knowledge/package identity changes automatically when declared dependencies or schemas/guides change. A feature owner must maintain dependency declarations and semantic guidance; automatic hashes are not autonomous learning.

## Verification and remaining scope

New unit coverage exercises discovery/guide reading through Pi, recovery from an unavailable guide, closed-schema rejection, lane-specific limits, baseline binding re-addition, matching/missing/mixed release resources, package determinism, change kinds and offline-shell inclusion. Browser coverage uses a synthetic gateway and checks registry/guide/context replay, current inspection, Apply/Undo, and zero model-content requests on release mismatch.

Verification completed:

- `npm run check:studio-v3-agent` passed: nine tools, thirteen operation types and one bundled guide; all dependency/evaluation references resolve.
- Final full Vitest run: **180 files / 1507 tests passed**. Schema rejection, strict primitive typing, budget/repeated-error stops, frozen bindings and release failure paths are included.
- Site build passed, followed by a rebuilt site artifact after the app-builder extraction. Current-source release identity and every declared resource content hash match that artifact.
- The six-file, three-browser selection covered **102 scenarios**: 99 passed in the broad run; three test assertion/timing failures were corrected. The focused nine-case run (discovery/guide/Apply/Undo, mixed-release rejection and failed-integrity/offline recovery in all browsers) then passed, covering every prior failure. Core authoring, reference steps, update protection and draft/history recovery also passed in the broad run.
- All modified/new source and document files are below 300 lines, with whitespace and local-link checks passing. Prior plan/inventory files are preserved.

The update fixture now compiles a genuinely distinct app/knowledge identity for each synthetic release using the production app builder in native Node. Offline tests await completion of update checks before publishing the next fixture. They preserve the existing integrity checks and unsaved-work policy. No production deployment or live model task qualification is implied by these tests. Read-only questions now run in steps under a read-only grant (see Effect grants and answers); the single-step flow remains their fallback. New-project creation, asset import, dataset services, save/export preparation, preview pixels, external MCP and isolated source execution remain later capability slices.

CA-04 row-fill parity (2026-10-12): [bounded evidence](acceptance/STUDIO_V3_CA04_ROW_FILL.md) and metadata cover 27 new unit cases, real inspector/Pi normalized candidates/common service errors, schema/grant/scope rejection and actual rendered diagnostics/provider requests. Full 200 files / 1676 tests, 66 contract examples / 27 reviewed changes and the site build pass. All 9 new browser cases pass across three engines; existing row-fill/CA-05 regressions also pass, with one unchanged Firefox timeout case passing focused recovery. The shared service owns transformation only; UI commits and Pi draft/approval effects remain distinct. COV-03, CA-04 and G4 remain open.

CA-05 slice-1-only recheck (2026-10-12): [checkpoint and identity](acceptance/STUDIO_V3_CA05_SLICE1_RECHECK.md) verify `inspect_draft` v1.1.0 receipt custody through the real Pi/Demo outgoing body. The combined-tree check executes 68 contract examples and reviews 27 digest-bound changes without advancing the publication baseline. Receipt units 22/22, intentional omitted-receipt mutation rejection/recovery, full 201 files / 1714 tests, site build and 3/3 receipt browser paths pass; all 4 resource and 93 dependency digests match the browser artifact. No capability, contract, handler, source or grant is added in this recheck; existing later-slice work retains separate evidence. G4 stays open; stopped for review.

CA-05 approved host text / OBS-01 recheck (2026-10-12): [checkpoint and identity](acceptance/STUDIO_V3_CA05_SLICE2_RECHECK.md) confirm `observe_context` v1.0.0 and its existing host prerequisite under direct human approval. The switch remains default-off and run-bound; separate value authority does not admit Imported/Real/Unknown or pixels. Fresh 31-unit, 6-browser and outgoing-canary mutation/recovery checks pass on the unchanged artifact; nine previously independently reviewed security modules retain their hashes. Protected answer history and ended/cancelled grant revocation remain enforced. No contract, prompt, capability, runtime source or publication baseline changes in this checkpoint; G4 and CA-04 remain open.

CA-05 approved fictional page/crop slice (2026-10-12): [bounded evidence and final identity](acceptance/STUDIO_V3_CA05_SLICE3.md) register `retrieve_page` v1.0.0, `inspect_draft` v1.2.0 and `observe_context` v1.1.0. `observation-policy.js` owns per-run fictional/text/value authority and explicit host pixel-denial; `observation-pixels.js` owns PNG validation/hash/custody; `preview-pixels.js` captures through the existing sandbox bridge; `agent-wire.js` pins the actual call/result and sends the current image as a host-authored follow-up input. New schemas reject model-supplied permissions/bytes. Candidate/revision/content/selection/policy change or cancellation/expiry rejects old evidence; rejected unchanged operations preserve it. The new canary is independently inflated and runtime PNG chunks are checked. Full 204 files / 1752 tests, 38 new units, real-wire mutation rejection/recovery, agent/site gates and 9/9 three-engine paths pass; audit checks 114 requests / 42 receipts / 9 evidence IDs. No publication baseline advancement or CA-04 implementation change. Sensitive assets, real-data transmission, native-print fidelity and final G4 comparison remain unqualified.

CA-05 OBS-05 technical checkpoint (2026-10-12): `finish_answer` v1.1.0 uses `observation-records.js:current()` for the authoritative latest receipt, rejects old/foreign IDs and invalidated evidence, and retains the host-finalized receipt within the 4000-character UI/history budget. Guide-only answers remain available; grants, settings, tools and disclosure authority are unchanged. The independent test rubric and static fixture remain explicit hashed evaluations. [Current artifact-bound evidence](acceptance/STUDIO_V3_CA05_OBS05.md) and [machine report](acceptance/STUDIO_V3_CA05_OBS05.json) resolve the two P2 delivery findings and save 33 exact delivered texts with their latest receipts and identity. Fresh full 206 files / 1773 tests, agent/site gates, 12/12 three-engine browser specs and real-wire image/citation removal rejection/recovery pass. This delivery changes evidence notes only; runtime, CA-04 owners and 17 historical reports are preserved. Prior source/artifact reconstruction is disclosed separately; full G4 human rubric/blinded review remains pending.

CA-05 local merge checkpoint (2026-10-13): [isolated verification](acceptance/STUDIO_V3_CA05_LOCAL_MERGE.md) rebinds all 28 release-review entries after excluding pending CA-04 authoring/evaluation/guide changes. The 74 examples, full suite/site build, real-wire browser paths and image/citation mutations pass on the recorded identity. Existing permissions and Partial/Open qualification are preserved; no publication baseline advancement, push or deployment.

CA-04 Firefox recheck (2026-10-13): [current evidence](acceptance/STUDIO_V3_CA04_FIREFOX_RECHECK.md) remains Partial. Original full Firefox suites pass 25/26, 24/26 and 23/26 without retries or assertion/timeout/trace changes. The same-version task-owned browser cache recovers a missing shared executable; protocol capture records preview execution-context loss but leaves its cause unproven. All 145 dependency hashes and the tested artifact identity remain unchanged. No code, disclosure authority or parity disposition changes; clean Firefox qualification and COV-03 remain open.

## 2026-10-17 general Studio media contract

`set_page` v1.1.0 adds10 finite media and fractionalCUSTOM20..1000mm, retaining0..72 CSSpx margins and orientation. Partial margins preserve other sides; standard-media selection removes old custom dimensions. A complete user-declared printerProfile constrains the private candidate; explicitnull removes it. Device names are omitted from default/semantic context even with form-text disclosure. Declarations never detect/certify hardware, alter CSS DPI or send native jobs.

Human CSV/JSON mapping and the New picker’s seven supplied-business starters are not newly callable data/New tools. Imported complete source receipts never enter the default authoring context. Real source schema, original financial/source bindings, scopes, inspection, Preview/Apply and Undo remain authoritative. Registry totals stay22 tools/13 operations/3guides;114 executable contract examples and38 digest-bound reviews pass without advancinga99c932.

The full75 browser scenarios and2873-test/9-skip integration are feature evidence, not G8 qualification. The read-only180-slot preflight proves the original frozen refusal set has144/180 maximum and missing family minima; no model runs are manufactured. [General feature evidence](acceptance/STUDIO_V3_GENERAL_IMPORT_MEDIA_20261017.md) · [G8 preflight](STUDIO_V3_G8_PREFLIGHT.zh-CN.md).

## General supplied sources and independent prerequisites — 2026-10-18

The current `supplied-business-v1` contract has11 kinds, adding PurchaseRequisition and MaintenanceWorkOrder without inferred procurement, approval or execution. Their source-bound context remains protected through private-draft edits and Undo. [Canonical contract and optional fixed-version Node SDK](GENERAL_REQUISITION_MAINTENANCE.zh-CN.md).

Fixed-upstream provenance and physical evidence are read-only qualification consumers, not newly granted browser/agent tools. [Upstream verification](STUDIO_V3_UPSTREAM_EVIDENCE.zh-CN.md) retains independent review and production blockers; [physical acceptance](STUDIO_V3_PHYSICAL_OFFLINE_ACCEPTANCE.zh-CN.md) always refuses self-certification. No new model execution or formal G8 attempt is supplied by these checks.

## Vendor snapshot and governance scope — 2026-10-19

[Pinned Odoo17 maintenance.request SDK](ODOO_MAINTENANCE_REQUEST.zh-CN.md) is repository/Node integration only, reusing MaintenanceWorkOrder without new kinds or tools. Native evidence remains unprinted live data; raw RPC import, inferred quantities/approvals and server-authentication claims remain unavailable. The guide fingerprints include the actual fixture loader and JSON input.

[Source-backed governance dossiers](STUDIO_V3_GOVERNANCE_EVIDENCE.zh-CN.md) validate bounded applicable review inputs, never actual legal authority or production permission. Original gates, model/route/budgets and all frozen G8 histories remain unchanged.

## Inspection source and artifact custody — 2026-10-19

[Pinned Quality Inspection SDK](ERPNEXT_QUALITY_INSPECTION_ADAPTER.zh-CN.md) reuses InspectionReport within the same11 canonical kinds. Native Data readings retain exact text; Float criteria require independent exact facts; no result calculation, raw UI connector or extra tool grant. The actual Node fixture and three-engine file/cold-HTML consumers are included in the existing general guide fingerprint.

[Source artifact lifecycle](STUDIO_V3_SOURCE_ARTIFACT_LIFECYCLE.zh-CN.md) preserves numeric operation types after strict decoded-key parsing, and constrains expired cleanup to the current broker owner with final ownership reinspection. Actual local Docker receipts and a real rendered candidate are separate from fixture-based AIPanel state-machine checks, native UI/model tasks and production qualification.22tools/13operations/4guides,127 contract examples and the original39-change review baseline remain; no G8/profile/model/budget authority is added.

[Long-row/label investigation](STUDIO_V3_LONG_TABLE_LABEL_PRINTING.zh-CN.md) is digital DOM/PDF/pixel evidence, not a new agent capability or physical qualification. Original failures and the cold transport-offline WebKit file boundary remain separate.

