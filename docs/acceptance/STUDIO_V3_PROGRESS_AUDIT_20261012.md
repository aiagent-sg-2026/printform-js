# Studio v3 progress denominator and evidence audit

Read-only independent audit, 2026-10-12. Snapshot time: `2026-10-12T04:37:18.111Z`.
Repository: `/Users/yapweijun/Documents/GitHub/printform-js`.
HEAD: `774db9283b444d5e75aa13e529856dfe8347e402`; branch: `codex/studio-v3-ca05-observation`.
Snapshot SHA-256: `4c3e5f52948b939a48070a367b595a9209e564c3660eeda5bc4e842074560f05`.
`audit.json` records exact inspected source hashes, dirty status, evidence hashes and computed counts. Subsequent parent changes need separate verification; this report does not absorb them.
No production file was edited. Only ignored `.printform-studio/v3-progress-audit/` was written. No new test/browser run, provider call, external write, Git mutation or publication occurred.
Routed instruction modules were not found under the repository during this audit; available core and acceptance rules were used. A subsequent scoped review found and read the global modules at `/Users/yapweijun/.codex/instruction-modules/`. This correction does not change the frozen source/evidence snapshot. `.agent/rules/03-verification.md` remains absent. No v2 progress or historical CA-00 credit is included.

## Recommended independent progress measures

| Measure | Exact result | Meaning |
| --- | --- | --- |
| Engineering TASK CA-01..10 | Done 3/10 = 30%; Partial 2/10 = 20%; Not done 5/10 = 50% | Equal-weight task status, no invented fractional partial credit |
| Engineering milestones M1..M5 | Completed 1/5 = 20% | M1 exit only; M0 foundation excluded |
| Feature classification | 79/79 = 100% classified; all 79 proposed | Inventory coverage, not capability completion or owner ratification |
| Eligible callable exposure | 32/48 = 66.67% have a non-`none` agent path | Exposure only; includes limited paths and runtime/input rows |
| Applicable UI/Pi shared implementation | Registered 3/20 = 15%; parallel 17/20 = 85% | Excludes 12 runtime/host-input rows; registration does not prove parity |
| Dedicated direct differential evidence | 2/20 = 10% | Scenario matrix and row fill; inspection has shared code and supporting positive evidence, but inadequate dedicated parity citation |
| Full-scope named case evidence | Closed 12/57 = 21.05%; Partial 11; Unimplemented 18; Unverified 16 | Proposed audit classification; bounded deterministic evidence, not release readiness |
| Full acceptance gates G1..G9 | 0/9 fully closed | Every full-profile gate still has applicable gaps |
| G8 corpus prepared/frozen | 0/60 = 0% | Register is header-only |
| G8 attempts executed | 0/180 = 0% per supported profile | No observed success rate exists; 0/0 is undefined |

TASK status sources: `TASK.md:14-23`. Done: CA-01, CA-02, CA-03 (the latter explicitly only its exit scope). Partial: CA-04, CA-05. Pending/not done: CA-06..10. CA-09 has a validator/skeleton but no tasks/attempts. Do not change Pending to Partial solely for scaffolding.
Milestone mapping: `TASK.md:25`, `docs/STUDIO_V3_CODING_AGENT_PLAN.md:115-124`. M1 engineering exit is complete; M2/M3 are partial; M4/M5 remain open. G2's later runner/resume work remains open independently of CA-02's earned engineering exit.

## Ledger reconciliation

CSV counts: 79 rows = 48 `agent-callable` + 22 `human-mediated` + 9 `intentionally-unavailable`; all `review=proposed`. Source: `docs/STUDIO_V3_FEATURE_LEDGER.md:3-19` and CSV snapshot.
`agent-callable` means eligible disposition, explicitly allowing a missing service/adapter (`FEATURE_LEDGER.md:7`); it is not a verified-complete field.
26 eligible gaps consist of 16 rows with no agent path plus 10 reachable/limited rows. The phrase “not yet reachable” in the Markdown summary at line 17 therefore conflates missing exposure and incomplete exposure. Do not derive callable count as 48 - 26 = 22.
TASK CA-01's 28-gap count (`TASK.md:14`) is a historical snapshot; current authoritative CSV and readable summary count 26.
16 planned service owners and 16 planned knowledge owners remain; 13 evaluation owners remain planned. No empty owner field exists, but a planned owner is not implementation evidence.
The 16 rows without an agent path are:
`printform.project.blank`, `printform.project.starter`, `printform.design.preset`, `printform.project.locale-currency`, `printform.data.json-edit`, `printform.data.sample-switch`, `printform.dataset.list`, `printform.dataset.read`, `printform.dataset.schema`, `printform.dataset.edit`, `printform.dataset.load`, `printform.dataset.refresh`, `printform.project.rename`, `printform.issue.locate`, `printform.data.rows-page`, `printform.data.draft-apply`.
10 existing paths still marked eligible gaps are:
`printform.field.binding`, `printform.field.image`, `printform.table.collection`, `printform.logo.reference`, `printform.context.structure`, `printform.context.selection`, `printform.preview.typography`, `printform.reference.pdf-text`, `printform.reference.visual`, `printform.reference.element-tags`.
Seven human-mediated rows have an empty `human_path`: `printform.draft.review`, `printform.project.replace-guard`, `printform.preview.rerender`, `printform.ai.model-discovery`, `printform.ai.preview-banner`, `printform.ai.clear-conversation`, `printform.update.choice`.
The integrity test allows `human_path || ui_entries || reason` (`tests/studio-v3-feature-ledger.test.js:47`), so a passing test does not prove an explicit human completion path for every row. COV-01/CA-01 inventory credit is retained as booked; owner ratification and these path-expression caveats remain visible.

## UI/Pi parity denominator and evidence

`docs/studio-v3-service-parity.json` has 32 unique IDs, exactly matching eligible rows with a non-`none` path (`tests/studio-v3-service-parity.test.js:10-17`). Registered dispositions are 3 shared / 17 parallel / 12 agent-only. Applicable current UI/Pi denominator is 20, not 32 or 48. Future exposed product workflows will expand this denominator; retain a snapshot/version.
The 12 excluded rows are host input/runtime semantics: context.structure, context.selection, preview.typography, reference.pdf-text, reference.visual, reference.element-tags, agent.draft, agent.undo-step, agent.notes, agent.finish, agent.blocked, agent.question-route (all `printform.` IDs).
These rows do have user-facing inputs/actions in some cases. “No UI counterpart” must mean no independent UI editing implementation of the same agent operation, not no UI association:
- structure/selection/typography consume host state, grants and measured facts (`ai-chat-protocol.js:33-35,60-74`; `ai-panel.js:162-181`); the model cannot edit its own grant/scope.
- PDF/visual/element references are user-selected input produced by host parsing/tag UI; agent reads it (`reference-files.js:45-73`; `ai-element-tags.js:98-115`; `ai-chat-protocol.js:72-74`). The agent does not independently edit/attach those inputs.
- draft/undo-step/notes/finish/blocked/question completion operate on run-private state and completion (`agent-handlers.js:15-19,53-76`; `agent-draft.js:21-51`; `agent-memory.js:5-19`). UI committed Undo/Apply and draft review are separate human-mediated rows/effects, not a second implementation of private-step undo/finish.
Exclude these 12 from parity completion and do not count their exclusion as earned parity credit. They still require policy/contract/task evidence.

Shared evidence assessment:
- `printform.validation.matrix`: dedicated UI/Pi differential test at `tests/studio-v3-scenario-matrix.test.js:70-81`, with positive/rejection/recovery/service behavior at lines 34-50,82-123. The print renderer in this unit test is an explicit deterministic stand-in (lines 13-18), so this is bounded adapter/service parity, not full geometry qualification. Runtime owners are `scenario-matrix.js` and `validate-all.js`; both handlers invoke the same service (`agent-handlers.js:45-50`).
- `printform.table.row-fill`: actual inspector/Pi complete normalized candidate, binding validation, common-error/rejection/recovery evidence; source `tests/studio-v3-row-fill-parity.test.js:30-64,74-119`, browser `e2e/studio-v3-row-fill-parity.spec.js:66-124`, report `docs/acceptance/STUDIO_V3_CA04_ROW_FILL.md:15-26`.
- `printform.preview.inspect`: shared `inspectProject` use is real (`app.js:60,78`; `ai-panel.js:178-181`; `validation.js:45-52`; `agent-handlers.js:21-30`). However the register cites `tests/studio-v3-agent-loop.test.js:83`, a stale-inspection test using fixed `ready` data at lines 10,19, not direct UI/Pi differential comparison. Row-fill browser evidence compares ready diagnostics on its candidates, providing positive supporting coverage; dedicated positive/rejection/recovery inspection parity evidence is still missing. This is an evidence-quality gap, not a reproduced runtime defect.
Register test checks paths/test titles exist (`tests/studio-v3-service-parity.test.js:19-30`); it does not validate each test's semantic adequacy.

## Named G1..G9 cases

The acceptance standard defines 57 stable named cases: G1=5, G2=7, G3=8, G4=6, G5=8, G6=12, G7=5, G9=6. Source: `docs/STUDIO_V3_CODING_AGENT_ACCEPTANCE.md:15-142`.
G8 has no stable case IDs/table, so there is no uniform named-case denominator covering G8. Do not invent a 58th “G8” case, and do not mix 60 tasks/180 attempts into the 57. A future owner-approved G8 case register can add named requirements with an explicit denominator version.
Classification: Closed = mapped bounded evidence covers current required case scope; Partial = mapped slice proves part of the full case; Unimplemented = required core runtime/service is absent; Unverified = existing components are insufficient to establish the whole case and no complete case evidence register exists.
This audit proposes the following full-scope classifications; counts do not replace owner dispositions or profile qualification.

| Gate | Closed | Partial | Unimplemented | Unverified | Exact IDs / source |
| --- | --- | --- | --- | --- | --- |
| G1 | 3 | 2 | 0 | 0 | Closed COV-01,04,05; Partial COV-02,03. TASK:14-17; registry:53,73-98; ledger/tests caveats above |
| G2 | 5 | 2 | 0 | 0 | Closed KNO-01..05; Partial KNO-06,07. Registry:98; knowledge-sync/release-gate tests; runner/artifact/resumable gaps |
| G3 | 4 | 3 | 1 | 0 | Closed RUN-01,04,05,07; Partial RUN-02,03,06; Unimplemented RUN-08. Run evidence register and full-scope qualification below |
| G4 | 0 | 4 | 0 | 2 | Partial OBS-01,02,03,06; Unverified OBS-04,05. CA05_SLICE2.md:61-66 explicitly lists bounded semantic/rejection evidence and remaining gaps |
| G5 | 0 | 0 | 0 | 8 | STU-01..08 unverified as complete agent workflows; existing UI/component evidence earns no whole-task closure. TASK:19; ledger's missing adapters |
| G6 | 0 | 0 | 12 | 0 | COD-01..12 unimplemented: no authenticated isolated coding runner/workspace/process tools. TASK:20; agent-effects.js:11-12 |
| G7 | 0 | 0 | 5 | 0 | ART-01..05 unimplemented as runner/source artifact integration. TASK:21; source developer diff/build and isolation absent |
| G9 | 0 | 0 | 0 | 6 | REL-01..06 unverified for a qualified exact profile/release packet; component PWA/recovery/build tests do not close these. TASK:23 |
| Total | 12 | 11 | 18 | 16 | 57 named cases |

The narrower booked closure is 14/57 (24.56%): G3 register calls RUN-01..05 and07 `covered` (`docs/studio-v3-run-evidence.json`). The full standard additionally requires data/code orchestration and source/log injection for RUN-02/03 (`ACCEPTANCE.md:44-45`). Tests explicitly reject unavailable data/coding profiles (`tests/studio-v3-run-grants.test.js:75-83`), while injection coverage is references only (lines 141-149). Retain CA-03's engineering Done status but mark RUN-02/03 Partial in the proposed full-profile ledger. Do not silently interpret current design/read `covered` as complete coding-profile proof.
RUN-06 partial and RUN-08 absent are explicit (`run-evidence.json:145-147,207-210`). KNO-06 runner/artifact and KNO-07 resumable summaries remain partial (`AGENT_REGISTRY.md:98`); KNO-07 test establishes one identity per run/refresh only (`agent-knowledge-sync.test.js:120-134`).
COV-01 remains inventory scope with proposed-owner/human-path caveats; it is not owner-approved release evidence. OBS-04/05 “Unverified” preserves existing reference negotiation/latest numeric inspection while recording absent full negotiated visual observation/comparison qualification. No observed full G5/G9 case failure is invented.

## Row-fill evidence independently checked

Independent script: `audit.mjs`. All 16/16 recorded current source hashes, 17/17 retained evidence hashes, and 15/15 wire hashes matched at snapshot time. Independently recomputed content SHA-256 and exact tool-call pairing for 45 receipt outputs / 33 unique receipts across row-fill and CA-05 regression wires. Row fill alone: 9 wire files / 54 provider requests / 15 unique receipts.
Root/pinned app identity and every declared agent resource hash agree. Local built identity:
- release `local`; app SHA-256 `af586be9c2df4aaea36196b764f580d6c581bd895dfef7dc7c85e7ccc41e2d03`.
- manifest SHA-256 `dccd0e5f578282917d2ec2117236c5568ec97bb88eb69aa3356053149d3fc160`.
- contract `bb218d3f98ffbfe22fb6bc3cee4819e2c5b7f0e68df3e50dead0388136ae390a`.
- knowledge `9eab847384b35758949c657c8456d358d4f4fb79c1a98348727e406599a710ca`.
- package `ab5682639aba0a42fb1494ac8a983bd4ceafc7c74c7af8eab99713a7f29cda0c`.
- retained successful-publication baseline recorded as `a99c932e45a95d4d5b5c811e7dbc0db3256ddf99`, package `c472d0ca870e77f25b36f756b5171332f377122ac70d42422e152b27cfee03be`; no new live remote verification was performed.
Raw logs confirm 27 new row-fill unit cases; full 200 files/1676 tests (full-vitest.log:255-256); site build's own 200/1676 (build-site.log:288-289); 12 tools/13 operations/2 guides/66 examples/27 reviewed changes (agent-final.log:9). Full totals include v2 tests as regression execution, not v3 progress credit.
Browser original matrix: 26 Pass + 1 Firefox timeout (browser-final.log:61-63); exact unchanged failed case focused recovery: 1 Pass (browser-firefox-recovery.log:10). All 9 new parity cases passed in the matrix. Do not report the original matrix as 27/27. Timeout root cause remains unproved (`CA04_ROW_FILL.md:36`).
Row-fill mutation evidence retains 27 positive passes and 14 expected mutant failures/13 passes; this audit checked its metadata/log hashes rather than reexecuting it.
Runtime: Node v23.10.0 on Darwin arm64; lockfile Pi agent/AI 0.85.1, Vitest 3.2.7, Playwright 1.62.0. CA-05 slice-2 metadata records Chromium 151.0.7922.34, Firefox 153.0, WebKit 26.5; row-fill metadata records engine IDs without independently repeating those version strings. Do not imply a new engine-version measurement.
Provider traffic is a recording stub through the real Pi/Demo path with fictional fixtures; token reports establish neither live competence nor actual cost.

## G8 and external prerequisites

Task and attempt CSVs contain headers only (`docs/studio-v3-task-register/tasks.csv:1`, `attempts.csv:1`). Actual validator returns unqualified with frozen tasks 0/60 and attempts 0/180. Ten families and six essential slots exist as structure (`STUDIO_V3_TASK_REGISTER.md:13-48`), not attempted qualification.
The two older real UI Sends at public revision `73035954...` (`acceptance/STUDIO_V3_LIVE_MODEL_LEDGER.md:7-11`) do not enter this frozen corpus; one was unsupported and one Apply/Undo incomplete. No current G8 success rate, zero-violation claim, live visual perception or built-in advantage can be inferred.
Keep visible: supported local-companion vs hosted-runner profile/transport decision, approved runner provisioning/deployment, real provider route/model version and approved cost profile, explicit protected-value/pixel disclosure authority if needed, independent task oracle/blinded reviewers, and maintainer release decision. Planning/production-readiness intent does not itself authorize spending, sensitive disclosure or publication.
These prerequisites gate their dependent qualification/release work only. Local CA-04 service/parity work, documented CA-05 authorized boundaries, task drafting, deterministic contracts and evidence-register improvements can continue.
Recommended ledger fields: stable case/task ID, denominator version and scope, status/reason, implementation owners, required evidence, current observed outcome, source/app/knowledge/runner/profile/input/budget identities, digest-bound evidence paths, retained failures/retries, remaining prerequisite and invalidation rule. Never translate callable/shared registration or aggregate unit totals into “verified complete.”
