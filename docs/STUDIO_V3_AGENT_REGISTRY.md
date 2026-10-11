# Studio v3 Agent Registry and Release-Bound Knowledge

This first implementation makes existing draft authoring capabilities discoverable and gives the agent a bundled product guide. It preserves the current provider, selected scope, inspection and user Preview/Apply flow. The broader [architecture plan](STUDIO_V3_AGENT_ARCHITECTURE_PLAN.md) and [baseline inventory](STUDIO_V3_AGENT_COVERAGE_INVENTORY.md) remain the roadmap; their proposed IDs are not all runtime capabilities.

The complete source-coding extension, whole-Studio coverage and future release gates are specified in the [coding-agent plan](STUDIO_V3_CODING_AGENT_PLAN.md) and [acceptance standard](STUDIO_V3_CODING_AGENT_ACCEPTANCE.md); they are not implemented by this first slice.

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

The operation schema describes legal shapes and static bounds. Dynamic rules (available assets, current paths, exact permutations, item/non-item geometry, total widths and user scope) still require local validation. Transport validation does not replace those services.

Ten tools are registered: `get_capabilities`, `read_skill`, `get_context`, `apply_operations`, `inspect_draft`, `undo_step`, `take_notes`, `finish`, `finish_answer`, `report_blocked`. `apply_operations` uses a closed union of thirteen operation schemas instead of unrestricted records. The operation list consumed by local authoring comes from that same schema owner. Runtime startup rejects tool/handler drift. Argument preparation rejects implicit type coercion and counts schema-invalid calls before Pi validation, so they cannot bypass tool-call/repeated-failure limits.

The small orchestration prompt directs the model to discover capabilities and read the relevant guide. `get_capabilities` supplies schemas, guide metadata and the current run limits. `read_skill` supplies only a known bounded bundled guide; arbitrary paths/URLs are unsupported. The guide is product knowledge, while `take_notes` is temporary task memory. Guide reading is model-driven and synthetic tests demonstrate the mechanism, not independent real-model competence.

## Executable contracts (CA-02)

Every tool and operation declares `contractVersion` (SemVer, currently `1.0.0`), the error codes it can raise, at least one accepted example and one rejected example; tools also declare an `outputSchema`. `validateRegistry` checks the static part: known error codes, examples that match the parameter schema without coercion, and rejected examples that are declared as schema rejections exactly when the schema rejects them.

`checkAgentConformance` then runs all 49 examples through the real `createAgentTools` handlers on a fresh draft (optionally after `setup` steps, with a named fixture). An accepted example must succeed and its parsed result must match the tool's `outputSchema`; a rejected example must raise its declared code. It runs before the package is generated in both `npm run check:studio-v3-agent` and the site build, so a broken example, an undeclared result or error code, or a registered tool without a handler stops publication.

Error codes are not renamed. `agent-errors.js` maps each one to a contract family (or none), a category, `recoverable` and retry advice; `get_capabilities` publishes that table. The model-facing catalog lists example inputs and error codes but omits output schemas and rejection fixtures, which stay host-side; it grew from about 27 KB to 36 KB. Handler messages keep their existing `CODE. ...` form.

## Effect grants and answers (CA-03)

`studio-v3/agent-effects.js` defines the effect profiles of the contracts document. Each registry entry has an `effect` (`read`, `memory`, `draft`, `proposal`, `answer`, `stop`). The host builds a frozen grant when a run starts: `read-only` allows read, memory, answer and stop; `design` adds draft and proposal. `data` and `coding` exist by name and fail with `GRANT_PROFILE_UNAVAILABLE` until their tools exist. Nothing a run can do commits or persists; only the person's Apply does.

Enforcement has two layers. The model is shown only the granted tools and a prompt that names only those, and Pi rejects a call to a tool that was not shown before any of our code runs. Every registered tool is also wrapped, so its handler re-checks the grant and a denied call raises `GRANT_DENIED`, counts against the tool-call budget and, repeated, stalls the run. The conformance harness runs a denied example per write tool under the read-only grant. A forged call to a hidden tool is rejected by Pi and does not reach the tool-call counter; it still costs a model turn, so the token and time budgets bound it.

The grant is chosen from host state in the panel: a request the host classifies as a question gets `read-only`, anything else `design`. The classifier can only narrow. `finish_answer` completes a run with text only. It needs a prior read of `read_skill`, `get_context` or `inspect_draft`, since `get_capabilities` alone is not evidence, and the result is kind `answer` with no proposal and no draft step. Measured print sizes stay host-authoritative: the panel replaces the model's words with the committed-preview measurements, as the single-step flow does. A step run that cannot start (steps off, tools refused, images unsupported) still uses the single-step flow.

### G3 evidence register

`docs/studio-v3-run-evidence.json` maps each G3 case to the tests that prove it, and `tests/studio-v3-run-reliability.test.js` fails if a cited test no longer exists. RUN-01 to RUN-05 and RUN-07 are covered; the token limit is a bounded overshoot (checked before each request, one response may cross it), not a hard ceiling. **RUN-06 is partial**: stop during a read, edit, render or Apply and the unsaved-work protection on update are proven, while test/build/output preparation, disconnect and unknown-effect reconciliation wait for the runner (CA-07) and output services (CA-06). **RUN-08 is open**: no durable session resume exists, so nothing consumes grant, revision, release and retention validation yet.

## Discovery, workflows and lifecycle (CA-02)

`createAgentTools` takes its definitions and handlers from the registry and `TOOL_HANDLERS`, and `get_capabilities` lists exactly the tools given to the run. A new feature adds a descriptor, a contract, a handler and a guide; the core prompt and handler wiring stay unchanged. A test proves this end to end: a synthetic tool and guide are discovered, read and called through a Pi run without editing `agent-loop.js` or `agent-tools.js`.

The catalog no longer carries a hand-written unsupported list. `workflows` counts the human-mediated, not-yet-callable and intentionally unavailable ledger rows, and the bundled `product-workflows` guide lists each with its human path or reason. Both come from `agent-workflows.js`, which is generated from the ledger CSV; a test fails while it is stale. `unsupported` keeps only the two planned capabilities with no ledger row (source/shell execution, preview pixels). `get_capabilities` is contract `1.1.0` because these fields are additive.

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
