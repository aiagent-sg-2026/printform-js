# Studio v3 Coding-Agent Contracts

Historical target contracts, 2026-10-09; names below remain design proposals unless implemented by the current registry. The bounded2026-10-16 local Node/JSON implementation has real source tools and separate host grants: [actual protocol/operator scope](STUDIO_V3_CODING_RUNNER.zh-CN.md), [feature definitions](../studio-v3/agent-source-definitions.js). It does not implement every proposed repository/hosted/qualification capability. [Plan](STUDIO_V3_CODING_AGENT_PLAN.md) and [acceptance](STUDIO_V3_CODING_AGENT_ACCEPTANCE.md) retain their independent gates.

## Feature contract and registry

Extend current descriptors, keeping schemas and supported values authoritative in the owning feature module:

```text
Capability: id, contractVersion, domain, status, replacementId
inputSchema, outputSchema, errorSchema, examples, limits
handlerRef, effects, requiredGrants, requiredContext, invalidates
sourceRefs, sharedDependencyRefs, knowledgeRefs, evaluationRefs
exposure: agent-callable | human-mediated | intentionally-unavailable
disabledReason, humanPath
```

Generate Pi schemas, factual documentation, UI dispatch references and adapter conformance fixtures from those definitions. Handlers remain compiled trusted code; registry strings cannot load code. Validate input, output and errors at the host boundary. Registering a descriptor does not grant effects. Keep domains small and touched modules <=300 lines.

SemVer applies to the capability contract, separately from app/engine versions. Incompatible shape/meaning changes require a major version and migration/replacement advice; same-schema behavior changes still require impact review. Deprecations retain bounded tombstones. Runtime tools and guides are selected from one frozen release manifest.

## Common dispatch and result

```text
Dispatch {runId, callId, capabilityId, contractVersion, args}
Host context {principal, releaseIdentity, documentId, baseRevision,
              candidateDigest, workspaceId, grantIds, budgetProfile}
Result {callId, capabilityId, releaseIdentity, status, result,
        candidateDigest?, evidenceRefs[], usage?, truncation?}
Error {code, category, recoverable, retryAdvice, safeDetails}
```

Host context is derived from authenticated state, not model arguments. Use closed objects and bounded strings/arrays; undefined usage is represented as unavailable. A tool may return `ok`, `blocked`, `failed`, or `pending-human`; `ok` means only its declared local effect succeeded. Completion requires task-level evidence.

Error families: `CAPABILITY_UNAVAILABLE`, `KNOWLEDGE_STALE`, `RELEASE_MISMATCH`, `SCOPE_DENIED`, `REVISION_CONFLICT`, `APPROVAL_REQUIRED`, `WORKSPACE_UNAVAILABLE`, `WORKSPACE_CONFLICT`, `ENVIRONMENT_UNSUPPORTED`, `QUOTA_EXCEEDED`, `COMMAND_TIMEOUT`, `CANCELLED`, `EFFECT_UNKNOWN`, `EVIDENCE_STALE`, `ARTIFACT_REJECTED`, `PROVIDER_UNAVAILABLE`. Map existing error codes compatibly rather than renaming working contracts gratuitously.

Reads may retry within deadline. Mutations use a host-generated intent/idempotency key separate from argument hashes. Same key/same input returns the original receipt; same key/different input fails. A new key can express an intentional repeated edit. Persist accepted intent, outcome and required receipt atomically in the authoritative store; serialize concurrent same-key admission. Do not infer safe retry after an unknown outcome.

Each workspace has one writer lease. File writes/patches and commands serialize against the same expected workspace revision; patches additionally require file digests. A command captures before/after source/dependency digests and records every actual input-tree change as a new revision/diff, even on nonzero exit, cancellation or recovered disconnect. Generated output is tracked separately. A failed command can leave dirty source; never silently ignore or roll it back. Product commits retain existing revision checks.

Test/build evidence identifies a stable input snapshot. Input mutation during its execution invalidates that evidence; a later check must run against the reconciled revision. Replaying a known patch/command intent returns its receipt without another revision. A patch racing an active command waits under bounded policy or rejects; it cannot alter the tested input invisibly.

## Effect profiles

| Effect | Read-only | Design | Data | Coding |
| --- | --- | --- | --- | --- |
| Read docs/state/approved references | Allowed | Allowed | Allowed | Allowed |
| Inspect/render a private candidate | Allowed | Allowed | Allowed | Allowed |
| Modify form candidate | Denied | Scoped grant | Explicit form grant | Explicit form grant |
| Modify data candidate | Denied | Separate grant | Scoped grant | Separate grant |
| Modify source workspace/run processes | Denied | Separate grant | Separate grant | Workspace grant |
| Commit live project or persist data | Denied | Host review path | Host persistence path | Host review path |
| Select local file/native print/download | Host-mediated | Host-mediated | Host-mediated | Host-mediated |
| Git push/deploy/external writes | Denied | Denied | Denied | Separate concrete authorization |

Read-only inspection must not advance committed revision/history or admit data to persistence. A renderer may use ephemeral caches only under host policy. Broadening a profile requires a host transition; neither prompt injection nor a model-supplied `approved:true` can perform it.

## Product service groups

| Group | Proposed capabilities | Result / boundary |
| --- | --- | --- |
| Discovery/support | Catalog/domain search, guide/doc read, capability change read, finish answer | Version-bound facts and source/evidence refs; no change required |
| Projects | Prepare blank/starter, inspect selected import, prepare open/replacement | Candidate plus compatibility report; preserve unsaved work |
| Design/bindings | Existing operation family plus missing eligible feature actions | Scoped validated candidate diff; original binding invariants retained |
| Data | Schema/value projection, isolated scenario selection, prepare explicit data edits/save | Separate data candidate and policy; no incidental source rewriting |
| Assets/references | List approved assets, import selected bytes, reference page/crop retrieval | Run-owned opaque IDs; size/type/pixel disclosure validated |
| Inspection | Semantic context, scenario matrix, print diagnostics, page pixels | Fresh evidence receipt; no hidden commit |
| Lifecycle/output | Candidate status/discard/undo, prepare editable/standalone output | Revision-bound proposal/artifact; file and print effects truthful |

One service implementation serves UI and Pi. Equivalent inputs yield equivalent canonical candidates, diagnostics and failure codes after UI-only projection is removed. File selection is a human action; the agent can process already selected bytes. A browser download result says download started, not file durably saved; native print says dialog requested, not physically printed.

## Coding runner protocol

Recommended API envelope is versioned JSON over authenticated HTTP plus an event stream. Local companion uses pairing, expiring/revocable grants, exact Origin and Host validation, no wildcard CORS, anti-CSRF capability tokens and loopback-only binding; reject DNS rebinding and browser permission failures. Qualify transport from the deployed HTTPS Studio origin. Remote deployment requires TLS, authenticated tenant ownership and separate qualification. Tool contracts stay independent of transport.

```text
POST /v1/workspaces                    create from selected pinned snapshot
POST /v1/workspaces/{id}/calls         execute capability with intent key
GET  /v1/workspaces/{id}/calls/{callId} inspect accepted intent/outcome
GET  /v1/workspaces/{id}/events        bounded cursor-based progress
POST /v1/workspaces/{id}/cancel        cancel owned call/run
POST /v1/workspaces/{id}/close         reconcile, terminate, clean workspace
```

Proposed tools:

| Tool | Required inputs | Bounded result |
| --- | --- | --- |
| `workspace_list` | Relative prefix, cursor, limit | Names/types/digests, next cursor |
| `workspace_read` | Relative path, range, expected digest | Bytes/text, content digest, truncation |
| `workspace_search` | Pattern, paths, literal/regex mode, limit | Locations and excerpts; bounded time/matches |
| `workspace_write` | Path, expected prior digest, content | New digest/revision and diff receipt |
| `workspace_patch` | Expected file digests, exact patch set | Atomic patch revision or conflict; no partial edits |
| `workspace_run` | Expected workspace revision, command/argv, relative cwd, declared env, deadline | Call ID, exit code/signal, before/after digests, resulting revision/diff and bounded process receipt |
| `workspace_test` / `workspace_build` | Pinned recipe, expected source revision | Test/build evidence with counts and artifact IDs |
| `workspace_diff` | Base snapshot/revision, changed paths | Exact source diff with content identities |
| `workspace_artifacts` | Call ID, type, cursor | Manifest entries and compatibility metadata |

`workspace_run` supports real shell execution in isolation; convenience recipes improve consistency but are not its only allowed behavior. Arguments/cwd/env remain bounded. Environment keys are host-allowlisted, never inherited; credentials are absent. Dependency fetches go through a declared approved proxy with pinned identities and quota. Build scripts are untrusted code inside the same sandbox.

Tool tests/builds report actual process exit and runner-parsed bounded evidence. Test stdout containing 'passed' is not proof. For qualification, a sealed independent checker outside model-writable files evaluates results; editing tests, disabling assertions, changing runner policy or removing cases invalidates acceptance.

Processes run under an unprivileged identity with no host mounts/socket, default-deny egress and CPU/memory/file/process limits. Cancel/deadline terminates the whole owned process tree and rejects subsequent output/artifacts. A stopped promise with a still-running process fails the contract. Status/health use a separate execution path.

## Run lifecycle and recovery

```text
created -> preflight -> running -> awaiting-human -> completed
                       +-> completed (evidence-backed delivery)
                       |    |                |
                       |    +-> blocked      +-> rejected/discarded
                       +-> cancelling -> cancelled
                       +-> recovering -> running | blocked
                       +-> failed
```

Preflight freezes release, requested profile, source snapshot, disclosure/grants and budgets before model calls. A missing runner/tool/guide or unsupported modality produces a specific unavailable result. A budgeted qualification also validates its cost authorization with zero provider calls.

Completion kinds are `answer`, `form-proposal`, `source-diff`, or `artifact`, each with its own evidence requirements. Read-only answers and reviewable source/artifact delivery can complete without Apply. Form proposals report pending host acceptance; delivering a diff/artifact is distinct from accepting, saving, committing or publishing it. `awaiting-human` is for a needed host decision, not an automatic prompt after every benign tool call.

Persist only host-approved session/checkpoint projections. Candidate/files, external effects and Pi conversation have separate owners; a replayed conversation cannot recreate an approved commit. On reload, stop, lease expiry or disconnect, reconcile the last accepted call receipt. `EFFECT_UNKNOWN` requires status resolution or a blocked recovery step, not blind execution replay. Inspecting status never mutates revision.

Current notes remain transient. Durable resumable sessions add retention policy and capability-version checks; raw customer documents and provider reasoning are not automatically reusable memory. Project AGENTS/skills are reviewed context within the selected workspace, not host permissions or trusted handler registration.

## Observation and artifact custody

```text
Observation {id, runId, releaseIdentity, documentId, baseRevision,
             candidateDigest, scenarioDigest, kind, capturedAt,
             policyDigest, contentDigest, page/crop, evidenceRefs}
Artifact {id, workspaceId, sourceRevision, buildCallId, mediaType,
          bytes, contentDigest, toolchainDigest, compatibility, checks[]}
```

Semantic observations include visible labels, assigned pointers, collection, selected targets and layout measurements under a value/pixel disclosure policy. Raster signatures/embedded images remain sensitive even when surrounding data is synthetic.

Carry authorized pixels to the negotiated model route and preserve tool-call pairing. If the provider cannot accept images in tool output, a host-authored follow-up image input must retain the receipt association. Apply image/context limits without silently dropping the required latest observation. Visual completion names the exact receipt compared; a local screenshot alone is insufficient.

Artifacts enter Studio through an explicit validator/import bridge. Check content hashes, type/size, schema/runtime version, assets, bindings, pagination and scenario evidence. Generated HTML/scripts stay in a separate isolated preview origin; never evaluate them in Studio or register their handlers. Enforce host-owned sandbox/CSP with default-deny network/navigation, no ambient Studio/runner credentials or shared storage/service workers, and only approved asset access plus a nonce/source-bound receipt bridge. Separate origin alone is insufficient. A valid structured form artifact uses ordinary Preview/Apply; developer source remains a reviewable diff/test report.

Mixed toolchain/app releases are rejected or explicitly migrated. Late artifact completion cannot overwrite a newer document or workspace. A review approval is bound to exact artifact/candidate/revision/evidence, invalidates on change, and cannot be forged from text.
