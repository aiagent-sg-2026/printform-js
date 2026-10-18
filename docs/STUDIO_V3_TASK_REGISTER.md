# Studio v3 Real-Task Register

2026-10-17：已冻结60个虚构输入、20个holdout及六essential；实际CLI errors=[]。正式CSV共6条真实执行：ab9旧profile三次Fail永久保留，8c修复profile原题三次Pass；各profile仅3/180，不能混算为同版6次或全面合格。[逐次证据](acceptance/STUDIO_V3_G8_READONLY_20261017.md)。原提示／oracle／模型路由／预算及[验收门槛](STUDIO_V3_CODING_AGENT_ACCEPTANCE.md)不变。

Files:

- [tasks.csv](studio-v3-task-register/tasks.csv)：60个冻结任务，绑定实际input与oracle摘要；完整字节在[corpus/](studio-v3-task-register/corpus/)。
- [attempts.csv](studio-v3-task-register/attempts.csv)：每个真实执行独立一行；不得用单元合成记录填充。
- [studio-v3-task-register.mjs](../scripts/studio-v3-task-register.mjs): `validateRegister` (structure and evidence rules) and `qualification` (G8 thresholds per profile). Checked by `tests/studio-v3-task-register.test.js`.
- [G8 corpus/evaluator CLI](../scripts/studio-v3-g8.mjs)：离线核验实际请求/回答/状态/几何/进程/制品；不调用模型、不自动登记Pass。[完整操作与信任边界](STUDIO_V3_G8_CORPUS.zh-CN.md)。
- [完整180槽离线预检](STUDIO_V3_G8_PREFLIGHT.zh-CN.md)：逐profile重验既有签名、CSV、独立oracle和实际清单；当前实际六份均与历史判断一致，修复profile仍仅3/180。原版144/180理论上限与四家族不可达门槛先行阻止错误资格宣称；不执行模型、不补造attempt。[脱敏实际结果](acceptance/STUDIO_V3_G8_PREFLIGHT_20261017.json)。
- [固定上游原件与逐请求归属](STUDIO_V3_UPSTREAM_EVIDENCE.zh-CN.md)：新增离线双签名消费者；原profile实际仍missing／31 blockers，零模型调用／正式attempt；完整性验真不是独立批准。
- [实体打印与WebKit离线边界](STUDIO_V3_PHYSICAL_OFFLINE_ACCEPTANCE.zh-CN.md)：实际设备为空；结构一致性和合成测试都不能填充硬件Pass或正式G8记录。
- [资料治理原件与适用范围](STUDIO_V3_GOVERNANCE_EVIDENCE.zh-CN.md)：离线核对operator／tenant／route、来源引文及保留／删除等控制；208项相关回归通过不代表实际DPA或生产资格，正式登记零新增。

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
- 同名profile的实际Pass/Fail执行必须固定source/app/knowledge/runner/route/model/browser/budget身份；不能把不同版本或更大预算的成功混算。不同profile分开；usage/duration可随尝试变化，未执行行不补虚假身份。[真实API混算漏洞前后证据](acceptance/STUDIO_V3_PROFILE_IDENTITY_20261017.json)。
- `Not run`, `Blocked` and `Invalid environment` may leave execution metadata empty; do not invent execution identities to satisfy a validator. `usage=unavailable` remains valid for every outcome.
- `Invalid environment` needs a documented external cause in `note`.
- `usage` is a token count or `unavailable`, never blank or zero by default.
- Only unique attempts 1 to 3 per task count. A later whole-attempt rerun stays recorded (`extraAttempts`) but cannot replace a failed attempt; a critical violation in any attempt of the profile, including a later rerun, blocks qualification.

## Qualification (per profile)

`qualification(register, profile, options?)` calls `validateRegister` itself; any register error appears in `reasons` with `invalid register:` and blocks qualification. Optional `capabilityIds` is forwarded to the validator. It reports `qualified: true` only when the valid register also has 60 frozen tasks with 6 per family; holdout at least 20%; exactly 180 unique counted attempts; at least 162 passes; at least 16/18 per family; every essential slot 3/3; zero critical violations across the profile. The empty register reports `frozen tasks 0/60` and `attempts 0/180`.

Not covered yet: binomial confidence intervals, paired built-in-advantage comparison, blinded-reviewer agreement for reference reconstruction, and cost reporting. They belong to later CA-09 work.

2026-10-15历史：direct qualification consumers修复重复行和缺执行证据；[当时guard smoke](acceptance/STUDIO_V3_QUALIFICATION_GUARD_20261015.json)为零网络/模型，彼时CSV为0/60任务、0/180尝试。元数据校验本身不证明原始证据、合同或模型身份。

2026-10-16历史：本地Node/JSON源码profile机械检查不写入正式CSV，当时仍0/60、0/180；[有界源码证据](STUDIO_V3_CODING_RUNNER.zh-CN.md)保留。2026-10-17的新语料明确包含12个不可用/拒绝请求：正确拒绝记Blocked，不是功能成功；理论最高144/180，完整G8不能因此合格，须真实补齐能力并另冻版本。

## 2026-10-17 General extension checkpoint

Nine supplied-business starters, bounded independent tables/barcodes,16 primary currencies and recoverable CSV/JSON/share copies are feature evidence, not new formal model attempts. Public e385 and ed816282 each returned no requested paper candidate; public0c02 returnedAGENT_BLOCKED after8HTTP200. All remain taskFail with independently unchanged saved source; no record is promoted toPass because grants or deterministic tests improved.

The new general-print guide separates human New/table/collection/currency/import/download paths from callable tools. Existing60tasks/20holdout, six signed historical attempts, per-profile identity and original thresholds remain unchanged. Do not refreeze, reinterpret correct refusals as featurePass, merge profiles, or read/publish private model reasoning to manufacture qualification.

Post-PR95 main`c89d85bd` independent public paper task:1run/6HTTP200/19.793s, actualPreview/r1 then explicit driver UIApply/r2; filesystemSave deep-equals expected paper-only change, all source facts/profile retained,3canaries absent,0pageerrors. This taskPass is NOT a new formalG8attempt and does not replace any earlierFail. Upstream identity remains unavailable; qualification remainsfalse.
