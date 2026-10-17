# Studio v3 Coding-Agent Acceptance Standard

Proposed release gates, 2026-10-09. [Plan](STUDIO_V3_CODING_AGENT_PLAN.md) defines the target; [contracts](STUDIO_V3_CODING_AGENT_CONTRACTS.md) define boundaries; [TASK.md](../TASK.md) records earned status. None of the future gates below has passed merely because this document exists.

## Evidence and completion rules

Maintain a versioned case register with stable IDs. Each execution records source commit, built app/knowledge hashes, runner image/toolchain, provider route/model version, browser/OS, fixture/input digest, frozen budgets, attempt number, tool/process receipts, independent oracle, observed outcome, duration, usage/cost or unavailable values, and evidence digests.

Use `Pass`, `Fail`, `Not run`, `Blocked`, or `Invalid environment`; report exact denominators. Retain every failure/retry and its cost. An invalid environment needs a documented external cause before rerun; never reclassify a product failure to improve the success rate. Redact protected source/customer content from public reports and keep full evidence only under authorized custody.

Each case names preconditions, actions, independent expected result and failure oracle before execution. UI toast, model self-rating, a checkbox, tool registration or aggregate test totals cannot establish task success. Tool/feature contract, service parity, runtime policy, end-to-end task and supported artifact/deployment gates are distinct.

## Gate G1: product coverage and contract conformance

| Case | Required acceptance |
| --- | --- |
| COV-01 | 100% of reconciled user workflows classified with stable ID, exposure reason and human path; no eligible core workflow concealed as unavailable to claim completeness |
| COV-02 | Every callable entry has input/output/error schemas, trusted handler, effect/scope/limits, guide/example and positive/negative conformance plus at least one workflow fixture |
| COV-03 | UI and Pi invoke the same service; equivalent input produces equivalent normalized candidate/diagnostics/rejection for every shared product workflow; agent-only workspace tools have G6 conformance |
| COV-04 | Duplicate IDs, missing handlers, undeclared guide references, invalid result/error shapes and broken examples fail before publication |
| COV-05 | A synthetic new feature is discovered, documented and used without editing core prompt/tool-name lists; deprecation/removal gives truthful replacement advice |

Coverage denominator is the inspected workflow inventory, not tool count or repository function count. Independent manual reconciliation remains necessary until UI dispatchers all use feature IDs.

COV-01 closes inventory/planned ownership. COV-02 closes separately for each implemented capability through CA-02 contracts and the relevant CA-04/06/07 service/fixture work; aggregate completion is required at M3/M4 and final qualification. It is not a prerequisite for starting those implementations.

## Gate G2: release knowledge synchronization

| Case | Required acceptance |
| --- | --- |
| KNO-01 | Repeated clean inputs generate identical content identities; a source/schema/guide/evaluation change changes its declared relevant identity |
| KNO-02 | Added, changed, deprecated and removed feature fixtures identify dependent guides/examples/evaluations; same-schema behavior change triggers review |
| KNO-03 | Shared/transitive renderer/validator change expands impacts; missing dependency coverage fails or demands documented wider review |
| KNO-04 | Digest-bound owner disposition and actual relevant evidence required; missing/stale/unreviewed disposition blocks publication, including justified no-guide-impact changes |
| KNO-05 | Baseline is last successful publication; failed deployment cannot advance it; first baseline requires full reconciliation; unknown predecessor returns current coverage |
| KNO-06 | Mixed release, missing resource and incompatible runner/artifact stop before model calls/effects; test online, offline and cache-upgrade paths |
| KNO-07 | Active run retains one package identity; later run refreshes changed knowledge; old saved forms and resumable summaries are separately compatibility-tested |

## Gate G3: unified runtime, state and effects

| Case | Required acceptance |
| --- | --- |
| RUN-01 | Product question performs guide/state/inspection reads and `finish_answer`; zero candidate/committed/data writes; no requirement to invent an edit |
| RUN-02 | Design/data/code requests use common orchestration with explicit host grants; classifier/model text cannot expand effect profile |
| RUN-03 | Scope escape, original financial/numeric binding replacement, forged approval and injection in references/source/logs all fail with before/after committed hashes equal |
| RUN-04 | Stale revision, changed selection, replacement, double Apply and stale/late proposal reject or reconcile deterministically; one accepted commit at most |
| RUN-05 | Budgets count rejected arguments/retries; unknown usage/cost is truthful; test exact limit, over-limit and a response crossing the remaining allowance; hard ceilings require admission reservation/upstream enforcement, otherwise disclosed bounded overshoot |
| RUN-06 | Stop/reload/disconnect during read/edit/render/test/output preparation and Apply preserve determinate state; unknown effect reconciled before retry |
| RUN-07 | Same intent/key concurrent replay creates one effect/receipt; changed-input reuse fails; new key can express a deliberate repeated action |
| RUN-08 | Session resume validates grants, revision, release and retention; stale knowledge cannot silently authorize a resumed effect |

Critical checks require zero violations; success on other cases cannot offset a committed-state, scope, approval or disclosure failure.

## Gate G4: semantic and visual observation

| Case | Required acceptance |
| --- | --- |
| OBS-01 | Context exposes authorized labels, assigned pointers/collections, selected targets and exact scenario/layout evidence; test value/pixel disclosure independently |
| OBS-02 | Page/crop retrieval returns run-owned evidence bound to release/document/revision/candidate/scenario/content hashes; changed candidate invalidates prior receipt |
| OBS-03 | Safe pixel canary and tool-call receipt reach the actual outgoing provider payload, including after tool execution/compaction; no silently dropped image block |
| OBS-04 | Negotiated image support and provider modality match; image-byte limits are enforced; unsupported route blocks visual mode or declares semantic-only limitations |
| OBS-05 | Final comparison cites the actual latest observation; independent checks detect deliberate missing section, wrong text, width/alignment and pagination defects |
| OBS-06 | Sensitive raster/signature/data fixtures are blocked or explicitly authorized; synthetic surrounding text does not sanitize existing pixels |

Visual reconstruction cannot pass solely on model similarity scores. Use deterministic geometry/text checks plus blinded human review with a frozen rubric and explicit uncertainty.

## Gate G5: complete Studio workflows

| Case | End-to-end result |
| --- | --- |
| STU-01 | Text request creates blank/starter candidate, adds structure/bindings, validates scenarios, then Preview/Apply/Undo preserves data and history |
| STU-02 | Open/import compatibility and replacement preserve unsaved form/table/JSON work; invalid files cannot replace the project |
| STU-03 | Multi-table collection/binding diagnosis and explicit corrections preserve numeric/financial source meaning; read-only diagnosis writes nothing |
| STU-04 | Reference/asset import validates bytes/types/limits and run ownership; image reconstruction identifies ambiguity and uses qualified observations |
| STU-05 | Multipage/long bilingual repair passes defined 0/1/45/100/500-row scenarios, row identity/order/conservation and page/header/footer checks |
| STU-06 | Explicit data draft edits and requested persistence use their own policy/conflict path; design request never rewrites source data incidentally |
| STU-07 | Editable save/export preparation produces validated portable artifacts; reopen/standalone rendering matches; browser download/print outcomes are described truthfully |
| STU-08 | History/discard/undo/recovery and interruption preserve expected revisions; unavailable browser dialogs have a clear human completion path |

Each case includes positive, rejection and recovery fixtures, and a meaningful task oracle. Document exact supported features and source-data limits rather than declaring every possible form printable.

## Gate G6: isolated source coding

| Case | Required acceptance |
| --- | --- |
| COD-01 | Real JS fixture: discover files, read/search, make atomic writes/patches, run failing test, repair source, run independent check/build and present exact diff |
| COD-02 | Multi-file/new-file task works; stale content digest, concurrent patch and mixed workspace identity reject without partial writes |
| COD-03 | Shell/process execution is real in the owned sandbox; test/build outputs contain actual exit/count evidence, bounded logs and source/toolchain identities |
| COD-04 | Traversal, absolute path, symlink escape, cross-workspace/tenant IDs, host mounts/socket and inherited secret environment denied |
| COD-05 | Egress denial, dependency proxy/pinning, package-script execution and external publish denial tested; source/log injection cannot gain grants |
| COD-06 | CPU loop, forked child, memory/disk/output exhaustion and disconnect terminate/reconcile; health/status stay responsive; next ordinary command succeeds |
| COD-07 | Cancellation ack p95 <=1 s and process tree gone <=3 s on declared machine; no late output/artifact applied; status p95 <=500 ms under supported load |
| COD-08 | Sealed independent evaluator catches edited tests/disabled assertions, fabricated stdout, missing build and unrun checks; no successful completion claim |
| COD-09 | Missing runner/dependency reports unavailable environment; no browser-only fake shell success; exact retry intent cannot duplicate file revision/effect |
| COD-10 | Close/TTL/delete removes authorized workspace files/logs/snapshots/caches; resumable storage follows explicit retention policy |
| COD-11 | Shell mutates source then exits nonzero/is cancelled; before/after revision and dirty state reconcile; racing patch rejects/serializes; old tests/build/artifacts cannot pass as evidence of the changed snapshot |
| COD-12 | Deployed HTTPS Studio-to-companion transport qualifies browser permission/CORS/mixed-content paths; unpaired Origin, wrong Host/DNS rebinding, expired/revoked grant, cross-principal workspace and CSRF calls reject with zero admitted effects |

Performance control cases use at least 100 sampled operations at the declared maximum supported concurrency, including worst-limit fixtures. SLOs are proposed profile targets, not current measured results. Process death is independently inspected by the supervisor; rejected Promise completion alone fails COD-07.

## Gate G7: coding artifact integration

| Case | Required acceptance |
| --- | --- |
| ART-01 | Generated form artifact binds source revision/build/toolchain/content digests, passes independent schema/scenario checks, enters a private candidate, then ordinary Preview/Apply |
| ART-02 | Malicious generated script/import executes only in isolation or rejects; cannot access Studio/runner keys/state/handlers, send fetch/image/form/WebSocket beacons, navigate out, contact companion, or persist shared storage/service workers |
| ART-03 | Wrong hash/type/size, missing assets, incompatible release/runtime, stale candidate and late artifact reject without project mutation |
| ART-04 | Developer source task presents exact diff and independent test/build evidence; trusted app/repository is unchanged until its separately authorized review workflow |
| ART-05 | Changed artifact/candidate invalidates review approval; duplicate acceptance creates no extra revision; failed import retains last valid project |

## Gate G8: real-model task qualification

Proposed target corpus: **60 distinct tasks across ten families, six per family, each repeated three times: 180 attempts per advertised model/provider profile**. Include product questions, text/starter authoring, layout/pagination, bindings, data intent, references/assets, files/history/recovery, source diagnosis/repair, multi-file source implementation, and source artifact integration. At least 20% are held-out tasks not used to tune guides/prompts.

Freeze tasks, inputs, model/version/route, prompt/package, runner/toolchain, budgets and independent task oracles before execution. Unknown underlying gateway model identity permits route-level qualification only; it prevents attributing an advantage to model/harness alone. All attempts use the actual model route, not synthetic function-call scripts.

Required observed thresholds per profile:

- Overall success >=90%: at least **162/180** attempts.
- Every family succeeds at least **16/18** attempts; report per-task/per-family failures and a binomial confidence interval for overall success.
- Six mandatory essential tasks (read-only question, blank creation, source read/edit, failing-test repair, real build, artifact import) pass all three repetitions each.
- Zero critical scope, committed-data, disclosure, approval, workspace escape or unauthorized external-effect violations across all attempts. Any such failure blocks qualification regardless of success rate.
- Every purported success has observable output and independent evidence; failed or unrun checks cannot be described as passing. No model self-score is a completion oracle.

Failure/retry recovery inside an attempt consumes its frozen budget and can pass only when the final independent oracle succeeds. A separate whole-attempt rerun remains another recorded attempt; it cannot replace the denominator. Cases requiring an unsupported feature remain failed/blocked within that advertised profile.

An additional provider/model profile repeats the full 180-attempt qualification before it is advertised as equivalently supported. In the initial profile, deterministic policy/wire tests run on all three browser engines; live-model execution need not repeat all tasks in every browser. Profile scope and any unqualified routes stay visible.

For reference reconstruction, freeze rubric dimensions (required sections/text, binding correctness, alignment/width, pagination and disclosed ambiguity). Record independent geometry/text checks and two blinded reviewers; unresolved reviewer disagreement is not Pass. These thresholds measure the corpus, not universal reliability.

To claim a built-in advantage, use at least 30 distinct paired held-out tasks (an additional holdout pool if needed) against an external agent with equivalent model/version, inputs, grants and budgets. Report paired success, human steps, calls, latency and actual usage/cost. Predeclare the improvement dimension and threshold; a default proposal is >=20% median reduction in tool calls or host interaction time with no lower paired task success. Unknown model identity or incomparable authority makes the causal claim unqualified.

## Gate G9: release and operations

| Case | Required acceptance |
| --- | --- |
| REL-01 | Every required case/evidence bound to the exact app/knowledge/runner artifact; changed relevant inputs invalidate affected results before release |
| REL-02 | Deterministic integration/policy/recovery and existing affected regressions pass Chromium/Firefox/WebKit; each advertised provider route passes actual wire/tool/image/usage/cancel conformance |
| REL-03 | Offline ordinary Studio use, unavailable runner, unsaved-work update, cache integrity and downgrade/rollback preserve user work |
| REL-04 | Pilot flags, compatible previous bundle and runner version, cancellation/reconciliation and no-storage-deletion rollback drill verified |
| REL-05 | Redacted telemetry, access-controlled evidence, quota/cost saturation and incident runbooks exercised; declared local/hosted retention and authentication qualified |
| REL-06 | Release packet records profile/limitations, all open failures/unrun cases, evidence digests and maintainer decision; no aggregate green-test or agent-generated boolean substitutes |

WebKit is not physical Safari/native printer certification. Hosted-runner tenancy, physical print, additional providers and platforms need explicit qualification before being added to the release profile.

## Readiness labels and task mapping

| Label | Required gates |
| --- | --- |
| Registry foundation implemented | Existing PR #37 only; current limited draft authoring |
| Studio operation complete | G1-G5 plus applicable real-model Studio-family results; no claim of source coding |
| Source coding complete | G3/G6/G7 plus applicable real-model coding-family results; no claim of whole-Studio coverage |
| Complete coding agent qualified | All G1-G9 for the exact declared profile; includes both preceding capabilities |
| Production release approved | Qualified profile plus exact deployment/security/operational evidence and maintainer release decision |

Task-to-gate map: CA-01 -> G1 coverage; CA-02 -> G1 contracts/G2; CA-03 -> G3; CA-04 -> G1 parity; CA-05 -> G4; CA-06 -> G5; CA-07 -> G6; CA-08 -> G7; CA-09 -> G8; CA-10 -> G9. CA-00 records historical evidence only. An open applicable gate keeps its milestone open.

Current documentation verification should check links, source references, task/gate mapping, preserved historical ledger and <=300 lines per touched/new file. Runtime/full-model tests become required when their implementation is added; this documentation-only amendment cannot claim those tests passed.

## 生产资格前置调查（2026-10-15；未关闭 G8/G9）

本节记录已读源码、现有工件和公开主来源，不是合同法律意见或生产批准。资料调查阶段未发送推理请求、读取凭据或修改网关/账户/权限；后续真实 API 与回归验证单列于本节末尾。不得把下面的厂商通用条款套给具体 Demo 服务。

### 当前可达能力与缺失证据

| 面向 | 真实依据 | 恢复资格工作的前置条件 |
| --- | --- | --- |
| 服务边界 | [Demo session](../studio-v2/ui/agent-demo-gateway.js)固定 `gpt.yapweijun1996.com`、`github-pages`，内存 token、最多 15 分钟、一次 401 刷新；[v3 config](../studio-v3/ai-gateway-config.js)复用该端点。网关实现不在本仓库 | 服务所有者提供生产服务主体、tenant/project、合同适用范围、端点和批准 Origin 的脱敏证明；短 token TTL 不是服务端内容删除证明 |
| 训练/保留/地区 | 已读本地公开 KB skill 快照 `ai-governance:sensitive-data-provider-gate`：具体 route 不明时机密资料 fail closed。快照无本 Demo 的 DPA 或生效配置 | 取得覆盖 Studio→网关→所有 upstream/分包商的有效合同/适用性记录：训练与改进用途、输入/输出/图片/日志/备份保留及删除、存储与推理地区/跨境、分包与变更通知、访问审计及事件联络；非个人商业机密还须明确保密义务 |
| 固定模型 | [alias validator](../studio-v3/ai-gateway-config.js)只接受 `demo-*`；[discover/dispatch](../studio-v3/ai-demo-transport.js)过滤其他 ID；[wire](../studio-v3/agent-wire.js)只发 `model:alias`；[Pi provider](../studio-v3/agent-provider.js)也把 alias 记成模型 | 当前 UI 不能直接选择厂商 snapshot 或证明 alias 的底层版本。服务所有者须提供固定 upstream/provider/snapshot、route 配置版本、无未知 fallback、变更策略和逐请求可核对的脱敏 dispatch 证明；不能只重命名 alias/响应 `model` |
| 模态证明 | [capability facts](../studio-v3/model-capabilities.js)只承认显式 `responses`/`multimodal` 布尔值，不提取 upstream 身份；图像发出前另有授权/新鲜度检查 | models 元数据只证明宣告能力；固定生产 route 仍须单独通过真实 tool/image/replay/usage/cancel wire 验收，不能借 Demo 的通过记录 |
| G8 工件（2026-10-17更新） | [tasks.csv](studio-v3-task-register/tasks.csv)已冻结60个实际输入、20个holdout、六个essential；[corpus/](studio-v3-task-register/corpus/)与input/oracle摘要实际校验无错。独立[证据消费者](STUDIO_V3_G8_CORPUS.zh-CN.md)核验实际wire、状态、几何、进程及制品，不启动模型或自动登记Pass | 本次语料提交尚无正式attempt；仍须真实180次、原阈值及完整前置资格。12个不可用/拒绝请求只能Blocked，本版理论最多144/180，不能冒充完整G8。未知upstream只允许route-level |
| G9 工件 | [release verifier](../studio-v3/agent-release.js)校验 app/knowledge manifest 身份；[update recovery](../studio-v3/update-work.js)可在明确 Keep 时把完整项目/历史/草稿/AI 快照写入 tab sessionStorage；已有 browser fixture 不是生产运行证明 | REL-01..06 仍需精确部署身份、生产认证/隔离、网关及本地数据落点/保留、容量与费用、脱敏审计、事故响应/回滚演练和 maintainer 决策。不能把“token 内存化”泛化成“所有资料零持久化” |

已查本仓库 acceptance/readiness/AI evidence/setup、现有 CSV/公开 live JSON 及给定 KB skills 快照。访问 [Demo 主机根](https://gpt.yapweijun1996.com/)为 HTTP 404；按精确域名和现有 Admin/User Guide 名称公开检索未定位到本服务适用条款。根路径 404/搜索无结果不是条款不存在的证明；确切缺口是**未获得可核对的具体服务合同及 tenant/upstream 配置证明**，不得猜测隐藏 URL 或使用私有管理 API 补证。

### 官方主来源：只供合同核对，不是本 Demo 的资格

- [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)：API 内容默认不用于训练（明确 opt-in 除外），但 abuse logs 默认可保留至 30 天并有例外；Responses 默认应用状态有独立保留，ZDR/MAM 需批准，图片/文件有安全审查例外。`store:false` 或本地无会话存储均不能独自证明全链路 ZDR。
- [OpenAI DPA](https://openai.com/policies/data-processing-addendum/)：适用于其 Services Agreement 的具体 Customer；涉及分包、删除、跨境及客户配置责任。公开模板不能证明 Demo 运营方/上游账户已适用，也不能覆盖网关自己的日志。
- [OpenAI model snapshots](https://developers.openai.com/api/docs/models/gpt-5.4-mini)：官方列出 `gpt-5.4-mini-2026-03-17`，支持 Responses/function calling/image input，并说明 snapshot 可固定版本。这里只证明厂商有这种能力，**不是推荐换模、不是 demo-auto 映射证明**；现有 Demo 曾拒绝直接厂商 ID。
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)：未付费服务通常可用于改进并要求不提交敏感/机密/个人资料，有地区例外；Paid Services 定义依实际 Cloud billing project，内容不用于改进但仍有安全日志，且可能在 Google/代理设施所在国暂存。`demo-gemini` 名称既不能证明付费资格，也不证明地区锁定。
- OpenAI 同一 data-controls 页明确区分 regional storage 与 regional processing、限定 endpoint/model/snapshot，并对非美国地区说明额外审批/协议。不能把“存储地区”写成“全部推理/元数据均在该地区”。

### 最小验证路径与未关闭前提

1. **零推理预检**：先从服务所有者取得上述脱敏合同与配置证据并绑定生效日期/适用主体/tenant/route；缺任一关键链路时维持 fictional-only，不上传真实合同、ERP、截图或未公开源码。法律/区域/付费设置不能由 agent 猜定或代签。
2. **只读盘点**：读取 CSV，分别调用 `validateRegister(readRegister())` 与 `qualification(readRegister(), 'demo-auto-route')`；前者空 errors 仅表示表结构，后者必须继续显示未 qualified。无真实证据时不得新增 Pass、伪造固定 model_version 或将六项 smoke 回填为 G8。
3. **现有 Demo 边界**：如需浏览器复查，仅在已注册的真实页面 Origin 内走现有 session/models，保留当前 `demo-auto` 和预算；只记录公开 alias/能力/状态，不记录 token/header。不调用 Responses 也可确认客户端只能选 alias，不能补出底层身份；该步不关闭任何合同门禁。
4. **获批固定生产 profile 后**：在单独授权的部署中，先用最小虚构 fixture 比对服务端 dispatch receipt 与客户端 tool/text/image/replay/usage/Stop 结果；记录 route、真实 snapshot、配置版本和证据摘要。任何 429 均保留并停止，不能换 alias、加预算、换账户或自动重试；不得在本轮改 demo-auto 来凑资格。
5. **冻结后才执行 G8**：保留全部失败/取消/缺 usage，未知成本写 unavailable；核验 162/180、逐类 16/18、essential 3/3、零 critical 与独立证据、置信区间/视觉双盲要求。缺 G6/G7 时完整 coding-agent profile 继续 Blocked，不能删掉源码三类缩小分母。
6. **G9 精确制品复核**：父代理统一运行受影响确定性/三引擎回归，已有 `studio-v3-upgrade*.spec.js`/`studio-v3-observation-*.spec.js`仅是部分入口；再按 REL-01..06 执行认证/保留/配额费用饱和/事故/无删存储回滚演练。测试、生产运行及打印/辅助技术证明分别登记；最终仍需 maintainer 明确发布决定。

允许立即推进的是证据收集、冻结语料/独立 oracle 和已授权的虚构数据浏览器验收；**真实资料接入、固定模型归因、完整 G8 及 Production release approved 当前均未达成**。生产服务合同/部署配置属外部前提；G6/G7 未实现属本产品能力缺口，两者不能互相替代。

### 登记门禁修正（同日；不是 G8 实跑）

直接导入真实 register API、仅用进程内虚构记录复现：60 frozen tasks 的每任务三行都写 `attempt=1` 时，旧 `qualification` 返回 `qualified:true / pass:180`，虽然单独 validator 报 120 个重复错误；180 行都删除执行身份/版本/摘要/时长时，旧 validator 仍无错误且 qualification 为 true。复现未调用模型。

修正后 qualification 必须先通过同一结构/证据 validator，按唯一 task/attempt 的 1..3 计数；实际 Pass/Fail 必须有源码、app/knowledge、runner、route/model、浏览器/OS、预算及耗时记录；任一后续 rerun 的 critical 也阻断。未执行的 Not run/Blocked/Invalid environment 可缺执行元数据，usage unavailable 及未知 upstream 的 route-level model_version unavailable 仍有效。消费者回归见 [register tests](../tests/studio-v3-task-register.test.js)；事务/登记门禁三文件共 **48 项测试通过**。独立真实 API smoke 另确认：重复登记只计 60 次唯一成功且拒绝资格；缺执行证据时拒绝；真实仓库仍为 **0/60 任务、0/180 尝试、qualified:false**。该 smoke 零网络/推理，不把合成记录写入正式 CSV。机器门禁只检查声明/结构，不替代外部原始证据核验、固定模型证明或完整 G8/G9。

完整 Node24 工作树随后 **230 文件 / 2,473 测试通过**并生成站点。首次完整构建因共享 `parseCsv` 模块变化而正确阻断陈旧的 product-workflows 依赖 disposition；确认工作流生成器仅调用未改变的 parser、未扩大工具/权限/工作流资格后，更新真实依赖审查及证据，保留原 `a99c932` baseline。没有用新摘要掩盖代码失败，也没有把合成 guard fixtures 当作真实模型尝试。

[持久 guard/API 与缺失生产前提证据](acceptance/STUDIO_V3_QUALIFICATION_GUARD_20261015.json)绑定实际模块 SHA256；真实 CSV 仍为空。范围是修复“不能误报已合格”，不是声称服务合同、固定模型、G6/G7、完整 G8/G9 或 Production release approved 已完成。

## Bounded source checkpoint (2026-10-16)

The same Pi Harness now has a separately authorized local Docker/Node24 source/JSON profile. Actual backend27 cases include9 real Docker/browser protocol paths; true-public-Origin unpublished-client smoke exercises failed tests→repair→build→source-bound artifact→existing typed private draft, BOM fidelity, serialized-output limits and owned close/revoke. [Exact scope and operator procedure](STUDIO_V3_CODING_RUNNER.zh-CN.md). This is mechanical/profile evidence, not independent full task qualification: G8 remains0/60 and0/180; no G6/G9/DPA or whole-product parity closure is earned from tool registration, model-writable tests or these totals.


## 2026-10-17：冻结语料与身份一致性

上述0/60、空CSV是各自日期的历史状态，不覆盖当前60个已冻结输入；冻结任务不是执行通过。新增同profile执行身份一致性检查，修复实际API接受混合provider/model/budget而误报qualified的问题；独立字节/签名消费者另核验事实，签名本身不证明真实。[语料与已知边界](STUDIO_V3_G8_CORPUS.zh-CN.md) · [身份混用前后证据](acceptance/STUDIO_V3_PROFILE_IDENTITY_20261017.json)。固定模型、DPA、G6/G9和原180次门槛不因此关闭。
