# Studio v3 Real-Task Register (CA-09 skeleton)

Status: empty structure, 2026-10-09. No task is written or frozen and no attempt has run. G8 is open. The [acceptance standard](STUDIO_V3_CODING_AGENT_ACCEPTANCE.md) (Gate G8 and the evidence rules) owns the thresholds; this page describes how the register records them.

Files:

- [tasks.csv](studio-v3-task-register/tasks.csv): one row per task, header only today.
- [attempts.csv](studio-v3-task-register/attempts.csv): one row per attempt, header only today.
- [studio-v3-task-register.mjs](../scripts/studio-v3-task-register.mjs): `validateRegister` (structure and evidence rules) and `qualification` (G8 thresholds per profile). Checked by `tests/studio-v3-task-register.test.js`.

## Families and targets

Ten families, six tasks each, three attempts per task: 60 tasks and 180 attempts per advertised profile.

| Family ID | Scope (from G8) |
| --- | --- |
| `qa` | Product questions |
| `authoring` | Text and starter authoring |
| `layout` | Layout and pagination |
| `bindings` | Bindings |
| `data` | Data intent |
| `references` | References and assets |
| `files` | Files, history and recovery |
| `source-repair` | Source diagnosis and repair |
| `source-implement` | Multi-file source implementation |
| `source-artifact` | Source artifact integration |

Essential slots, each owned by exactly one task and required to pass 3/3: `ESS-QA` (read-only question), `ESS-BLANK` (blank creation), `ESS-SOURCE-EDIT` (source read/edit), `ESS-TEST-REPAIR` (failing-test repair), `ESS-BUILD` (real build), `ESS-ARTIFACT-IMPORT` (artifact import).

## Task rules

- ID `T-<family>-NN`; `holdout` is `yes` or `no`; at least 20% of frozen tasks are held out.
- `capabilities` lists feature-ledger IDs (semicolon-separated); the validator rejects unknown IDs when given the ledger.
- `status` is `draft`, `frozen` or `retired`. A frozen task needs title, capabilities, preconditions, actions, expected result, failure oracle, oracle type (`deterministic`, `reviewer`, `visual-blinded`, `runner-receipt`), oracle owner and a `sha256:` input digest.
- The oracle owner can never be the model or agent itself.

## Attempt rules

- Attempts may reference frozen tasks only; `(task_id, profile, attempt)` is unique.
- `outcome` is `Pass`, `Fail`, `Not run`, `Blocked` or `Invalid environment`.
- A `Pass` needs an oracle result and a `sha256:` evidence digest, and cannot carry a critical violation.
- Actual `Pass`/`Fail` executions also require nonblank `source_commit`, `runner_image`, `provider_route`, `model_version`, `browser_os`; `sha256:` app/knowledge/budget digests; and a non-negative integer `duration_ms`. These are recorded identities, not proof that the referenced execution or evidence exists. An unknown upstream may use `model_version=unavailable` for route-level qualification only.
- `Not run`, `Blocked` and `Invalid environment` may leave execution metadata empty; do not invent execution identities to satisfy a validator. `usage=unavailable` remains valid for every outcome.
- `Invalid environment` needs a documented external cause in `note`.
- `usage` is a token count or `unavailable`, never blank or zero by default.
- Only unique attempts 1 to 3 per task count. A later whole-attempt rerun stays recorded (`extraAttempts`) but cannot replace a failed attempt; a critical violation in any attempt of the profile, including a later rerun, blocks qualification.

## Qualification (per profile)

`qualification(register, profile, options?)` calls `validateRegister` itself; any register error appears in `reasons` with `invalid register:` and blocks qualification. Optional `capabilityIds` is forwarded to the validator. It reports `qualified: true` only when the valid register also has 60 frozen tasks with 6 per family; holdout at least 20%; exactly 180 unique counted attempts; at least 162 passes; at least 16/18 per family; every essential slot 3/3; zero critical violations across the profile. The empty register reports `frozen tasks 0/60` and `attempts 0/180`.

Not covered yet: binomial confidence intervals, paired built-in-advantage comparison, blinded-reviewer agreement for reference reconstruction, and cost reporting. They belong to later CA-09 work.

2026-10-15: direct qualification consumers now reject the formerly accepted duplicate-row and missing-execution-evidence cases. [Observed guard smoke](acceptance/STUDIO_V3_QUALIFICATION_GUARD_20261015.json) uses zero network/model calls; the actual CSV remains 0/60 frozen tasks and 0/180 attempts, unqualified. Metadata validation is not evidence-byte, gateway-contract or upstream-identity verification.

2026-10-16：本地Node/JSON源码profile的实际进程、失败修复、制品及权限机械检查不写入本正式任务CSV。新增 `printform.source.files/execute/artifact` 工作流可用于将来冻结任务；独立oracle、完整版本/成本/来源与180次尝试要求不变，仍0/60、0/180。[当前有界源码证据](STUDIO_V3_CODING_RUNNER.zh-CN.md)。

