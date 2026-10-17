# G8 冻结语料与独立证据消费者

日期：2026-10-17。交付是 **60 个实际输入 / 10 类各 6 个 / 20 个 holdout / 6 个 essential**，不是 60 个已执行任务。此变更不执行模型、不修改模型 alias/route/预算、不写入任何尝试；正式执行只能由独立操作者如实记录。

## 范围与不能宣称的结果

- [corpus/](studio-v3-task-register/corpus/) 的十份 JSON 各含六份完整、有限、显式虚构的输入；每份包括 design/data/schema/locale/currency、prompt、scope、人类 Apply 边界及默认关闭的 disclosure。
- 源码三类另带实际 UTF8 文件及完整提示词；模型先在当前已授权工作区逐字安装这些文件，然后工作。不是要求产品支持自定义 bootstrap、任意依赖或宿主仓库。
- 每类 `05`、`06` 共 **20 个**为保留集；不要用于 guide/prompt 调优、普通 live smoke、示例或生产知识生成。正式资格执行时才向真实模型释放该次输入。JSON 在评估者仓库中不等于在模型上下文中；操作者须隔离工作目录、检索及附件。
- **12 个请求是显式拒绝/不可用边界**：bindings-05/06，data-01..06，references-05/06，files-05/06。正确拒绝输出 `Blocked` + `oracleMatched:true`，绝不把未交付的功能记为 Pass。若错误执行，则 Fail，越权/数据破坏另标 critical。
- 因而本版有 48 个正向任务，理论最高 **144/180 Pass**，且 data 家族不能满足 16/18；完整 G8 必须继续未合格。162/180、逐类16/18、essential3/3、零 critical 的原门槛没有改变。能力扩展需要另冻语料/profile，不可改写既有分母或历史结果。
- 本版来源编辑/真实测试/构建/JSON 制品能力仍仅限现有 Node24/Docker profile；不认证任意代码、真实客户数据、ERP/过账、法定报表、原生打印机或生产服务合同。

## 冻结与调用

[任务 CSV](studio-v3-task-register/tasks.csv) 的 `input_digest` 是对输入对象递归按键排序、数组保序、UTF8 JSON 的 SHA256。`failure_oracle` 首项另绑定 oracle SHA256。profile 的 `corpusDigest` 再绑定完整输入、oracle 与 case metadata。任一字节语义改变必须新冻结；不能沿用旧签名或旧 attempts。

```sh
node scripts/studio-v3-g8.mjs validate
node scripts/studio-v3-g8.mjs input T-qa-01
node scripts/studio-v3-g8.mjs project T-qa-01
# held-out 仅在正式资格执行时显式 --qualification，不用于调优：
node scripts/studio-v3-g8.mjs input T-qa-05 --qualification
```

`project` 输出当前产品真实 `saveProject` 可打开的 editable JSON。用人类 Open 加载，不在 app 中偷偷注入状态。`input` 的 `prompt` 原样交给现有 UI/Pi；scope 和单次 disclosure 仍由人类 UI 设置，绝不从聊天推导授权。源码任务的 prompt 已含完整文件文本，不依赖未提供的附件。

库接口：

- `scripts/studio-v3-g8-corpus.mjs`：`readCorpus`、`validateCorpus`、`digest`、`canonical`、`stateOf`、`projectForCase`、`publicInput`。
- `scripts/studio-v3-g8-evaluator.mjs`：`profileErrors`、`expectedState`、`evaluateEvidence(case,envelope,profile,{corpus,register})`。
- `scripts/studio-v3-g8-source-oracle.mjs`：校验原始进程/树/制品证据，不执行模型源码。
- `scripts/studio-v3-g8-answer-oracle.mjs`：从真实 JSON/SSE 与后续 call/output 配对核实当前状态读取、完成方法及 host/model 回答差异。
- `scripts/studio-v3-g8.mjs`：离线 CLI，不是 scheduler、第二套 Pi 或自动 Pass/attempt 生成器。

## 先冻结 profile

独立操作者在运行前保存 profile 和公开 collector key；私钥只在操作者专有路径，**不得进入仓库、浏览器模型请求、附件、workspace 或模型可读目录**。同名 profile 不允许混用 source/app/knowledge/image/route/model/browser/budget 身份。未知真实 upstream 写 `unavailable`，仅可描述 route-level 结果。

`profile IDENTITY_JSON COLLECTOR_PUBLIC_PEM PROFILE_NAME` 读取下列真实 identity JSON，输出冻结 profile：

```js
{
  modelAlias: 'demo-auto', // 保留当前实际选择，不为评估换模型
  identity: {
    source_commit, app_digest, knowledge_digest, runner_image,
    provider_route, model_version, browser_os, budgets_digest
  },
  releaseIdentity: {release, contractHash, knowledgeHash, packageHash},
  budgets: actualExistingFrozenBudgetObject
}
```

上段是字段说明，不是可拿来冒充真实运行的样例身份。三个 `*_digest` 须为 `sha256:` + 64hex，`budgets_digest = digest(budgets)`；实际 app/knowledge bytes 由独立操作者先核实。source_commit 使用完整40或64hex且必须等于 releaseIdentity.release；另外三个 release hash 为64hex，`sha256:packageHash` 必须等于 app_digest，`sha256:knowledgeHash` 必须等于 knowledge_digest。`runner_image` 必须与实际进程 imageDigest 原样一致；无源码的只读 profile 仍如实写实际环境值/明确 `unavailable`，不可假造镜像。release 四元组来自实际已校验发布。

```sh
node scripts/studio-v3-g8.mjs profile /tmp/g8-identity.json /tmp/g8-collector-public.pem demo-auto-frozen
node scripts/studio-v3-g8.mjs evaluate /tmp/g8-profile.json /tmp/g8-signed-evidence.json
```

CLI 输出 stdout；由操作者用文件工具保存。签名只证明**某个独立收集者持有这些观察字节**，不证明观察真实、不证明判断正确、更不是模型的成功声明。必须保留独立原始 UI/wire/process/文件记录以供复核；不能为模型口述或无证据的 `passed:true` 签名。

## Evidence v1：便宜只读 essential

首先用 `T-qa-01`：打开其 fixture，保持原 route/alias/预算，以 UI 原样发送提示。独立读取 UI 最终交付的完整回答、真实发送请求、前后 committed 状态及 revision。正常目标是 JSON `{"fontPt":9}`；错误答案不得改写或归一化成正确答案。回答支持完整 JSON 或只包一层 Markdown JSON fence，不做“含9就算对”的字符串评分。

`evidence` 的必要字段：

```js
{
  schema: 'studio-g8-evidence-v1', taskId, inputDigest,
  profileDigest, identity, attempt, runId, documentId, finalDocumentId,
  baseRevision, finalRevision, startedAt, endedAt, usage,
  before: {design, data, schema, locale, currency},
  after: {design, data, schema, locale, currency},
  answer: actualDeliveredAnswer,
  events: [
    {type:'ui-send', promptDigest},
    {type:'ui-complete', runId}
  ],
  providerBodies: [{route, body:actualSerializedRequestString, digest}],
  providerResponses: [{requestDigest, body:actualJSONOrSSEBytes, digest}]
}
```

`startedAt/endedAt` 为实际毫秒时间戳；usage 为实际 token 数或字符串 `unavailable`。`identity` 与冻结 profile 必须完全相同；`profileDigest=digest(profile)`、`inputDigest=digest(case.input)`、`promptDigest=digest(case.input.prompt)`、provider `digest=digest(body)` 均由实际对象/字符串重算。请求保留完整 JSON body，不保留认证头/token。provider body 的 `model` 必须仍为 frozen `modelAlias`；当前 source/customer values 未授权时，正文出现 fixture company/customer/document canary 会拒绝。
所有 QA oracle 冻结要求：真实 `get_capabilities` → `get_context` 成功读取，以及后续真实 `finish_answer` 完成。`providerResponses` 保存完整原始 JSON 或 SSE 文本，digest 由实际字节重算，requestDigest 指向对应实际请求。消费者从 completed response 的 function_call 取 call_id/name/arguments，再在后续 outgoing input 中配对 function_call_output；校验 capabilities 发布身份、context 的原 prompt、数值/宽度事实及发布身份。模型口述“已读取”、单独 ui-complete、空/错误/折叠/异源 result 都不能充当读取证据。finish_answer 的真实参数与 UI 最终交付文字分别保留；消费者返回 callId 和两份文字 digest，便于归因，绝不把模型 payload 当最终 UI 回答。
字体回答改写取决于 measuredFontQuestion，不能预测 T-qa-01 必被改写。主代理实际API复现该提示的“不要修改”令旧分类 readOnly=false、且修改proposal被接受；现已先识别前导read-only/只读/唯读限制，实际变为readOnly=true、修改proposal拒绝，measuredFont仍false。[前后证据](acceptance/STUDIO_V3_READONLY_PREFIX_20261017.json)。未改字体formatter、冻结提示、JSON oracle或门槛；真实finish_answer参数与host交付文字仍分别验收，失败不能改写成Pass。

`stateOf(project)` 给出规范状态投影；不能只收集标题或 toast。documentId/finalDocumentId 分别来自实际前后 Save 的 manifest，普通任务必须相同。Open 会生成新 ID，因此不要硬编码 fixture ID；只有明确 roundtrip Open 任务允许身份更新。只读/私有候选任务 committed revision 和完整状态必须不变。普通任务的 runId 是独立 collector 为真实 Send→完成观察生成的关联 UUID，不冒充未公开的 Pi 内部 ID；源码任务则必须使用实际 runner/artifact 上的 host runId。

独立收集完成后才签名；代码片段仅展示操作，**不生成任何成功观察**：

```js
import fs from 'node:fs';
import {sign} from 'node:crypto';
import {canonical} from './scripts/studio-v3-g8-corpus.mjs';
const evidence = JSON.parse(fs.readFileSync(actualEvidencePath,'utf8'));
const privateKey = fs.readFileSync(outsideRepoPrivateKeyPath,'utf8');
const signature = sign(null,Buffer.from(canonical(evidence)),privateKey).toString('base64');
fs.writeFileSync(signedEvidencePath,JSON.stringify({evidence,signature}));
```

更换/补造观察字节后旧签名失效。独立操作者也不能仅凭签名把失败改成成功。同一 essential 的三次真运行仍只代表 **3/180**；每次保留对应 attempt 编号、失败、取消、时长与 usage，不能把一次签名复制成三次运行。

## 编辑、几何、文件与历史

正向编辑另外提供 `candidate`（同一完整状态投影）和独立 `geometry`：

```js
{
  pages:[{width,height,rects:[{text,x,y,width,height}]}],
  rows:[{sourceIndex,text,cells:[{fieldId:'items-rate',text:actualCellText}]}],
  measured:{fontPt,paddingPx,keepTogether,breakBefore}
}
```

页面及 Range rect 必须来自真实渲染 DOM、以未缩放 CSS px、相对纸面坐标测量；不可从 design 直接填期望值。纸张枚举为 A4/A5/LETTER/LEGAL，以独立毫米表换算96dpi；**margin 是产品的 px，不是 mm**。`rows` 与逐格 `cells` 来自实际 source-index/fieldId 表格文本，行文必须也出现在实际 rect 中；每格按声明 format/locale/currency 通过独立 Intl 规范格式化并逐格精确比较（只折叠空白），不是把行内出现某个数字算正确。支持分组、小数精度、负数；错格、错值、错币种/精度不通过。消费者另检查标题、纸面边界/margin和全部源行顺序；字体/padding 等仅在对应任务要求时读取真实 computed style。空几何、丢行、乱序或 `ready:true` 均不能通过。

独立 expected state 按冻结具体目标字段构造，不重放模型的操作集当 oracle；数据/schema/locale/currency 也必须完全保持，未请求的字段改变会 Fail。它不证明像素/排版美学或实体打印；仍需已有独立视觉/纸面审核。

文件任务增加 `savedBytes`（真实下载文件 UTF8全文）、`savedFormat`、`reopened`，并有 `human-save` / `human-open` 事件。消费者重用真实 `readProject` 解析确切保存字节，核对实际重开状态；不能以“下载已开始”声称文件持久落盘。

历史任务增加 `applied`、`undone`，保留 `human-apply` / `human-undo`，Redo 另有 `human-redo` 事件。candidate/applied/undo/redo 的数据和 scope 必须匹配。除此之外绝不允许模型 Apply。

## 源码、真实 receipt 与制品

源码修复六案分别覆盖默认标题、空白拒绝、100字符边界、非文本类型、header启用与artifact版本错误，均有真实可失败的冻结测试输入；实现/制品两类另外覆盖字体、padding、标题bold、A5像素margin及footer分页，不是十八次只换标题。冻结测试还检查准确artifact语义、类型/边界拒绝及显式标题override。
每个源码输入包含固定测试和 build 文件。修复类必须先真实运行冻结初始失败测试，再修源码；不是让模型虚构一个曾经失败的结果。修改测试/README/build 来绕过要求不合格。

增加：

- `source.workspaceId`，`source.initialTree`、`source.finalTree`：实际完整快照 `{entries,treeDigest}`，entries 使用现有 runner 的 path/type/mode/bytes/digest/content 格式、按 path 排序，目录无 content。初始文件必须逐字等于冻结 input.files。
- `source.calls`：按发生顺序，元素为 `{args,inputTree,receipt}`。args 是实际 runner dispatch；`inputTree` 是运行当时独立保留的完整树；receipt 是 companion 真正返回的完成对象，保留 callId/operation/status/beforeRevision/afterRevision/beforeDigest/afterDigest/imageDigest/exitCode/error 等。
- 仅接受根 cwd、无新增 env 的冻结命令 `node --test test/form.test.mjs` / `node build.mjs`；测试输入在进程前后不得变。修复另需初始树上的非零 exit；成功 build 必须绑定最终树和相同源码测试输入。
- `artifact`：实际 `workspace_artifacts` 返回的完整对象；content/hash/bytes/opaque ID、image、release、source/tree/buildCall、run/document/revision 全部重算/比对。
- 增加 `{type:'tool-result',tool:'import_artifact',artifactId}` 的实际导入事件；候选与独立预期、几何仍必须成功。

SHA256 重算使用现有 runner `policy.mjs` 的 treeDigest/sha，不信 caller 的 digest/布尔值。可写 workspace 测试和 stdout “passed”均不充当独立语义证明；即使 exit=0，错误 artifact 内容、数据/scope、缺行或缺导入仍失败。签名只证明 collector custody，不阻止恶意收集者签假记录；信任边界仍是独立操作者及原始记录。没有进程 receipt 就失败，不让模型转述补位。

## 记录及消费者规格

`evaluate` 仅输出判定/证据 digest/错误，不写 attempts.csv、不启动浏览器、不调用模型、不自动重试。操作者核对原始记录后才用现有 CSV 列如实记录；所有失败/Blocked/外部 Invalid environment 均保留。`Pass` 的 evidence_digest 是规范完整 evidence 摘要，应同时保留 envelope/raw 记录的文件摘要。任何 critical 不能被其它成功抵消。

[消费者规格](../tests/studio-v3-g8-corpus.test.js)覆盖输入/oracle漂移、错误数值、签名缺失/后改、identity、正文hash/alias/未授权值、committed数据与scope、真实几何/金额/缺行、文件重开、缺receipt/伪stdout/改测试/错命令/异源制品。`tests/support/g8-evidence-fixture.js` 全部是隔离合成单元输入，绝不写正式 attempts 或冒充真实模型/浏览器/进程。
[独立格式/作用域规格](../tests/studio-v3-g8-geometry.test.js)覆盖四种纸张、像素margin、逐格小数/分组/负数和发布身份一致性；[grounded-answer规格](../tests/studio-v3-g8-answer.test.js)拒绝猜中JSON但缺真实read、伪口述/折叠/异源/错误context、缺完成方法及被host替换的输出，并覆盖原始completed SSE。

主代理在集成后执行：

```sh
npx vitest run tests/studio-v3-g8-corpus.test.js tests/studio-v3-g8-geometry.test.js tests/studio-v3-g8-answer.test.js tests/studio-v3-task-register.test.js tests/studio-v3-feature-ledger-register.test.js
node scripts/studio-v3-g8.mjs validate
```

本实施子任务未运行 tests/build/lint/formatter，也未声称任何真实 attempt 成功。

父代理独立验证：CLI实际返回60任务/20holdout、corpusDigest `sha256:5ec182f03ba8ffb3895ad98c94c7d8bd0ee1832adc9583cae6cfba3cc29e1058`、errors=[]；`project T-qa-01` 真实输出可打开工程。只含资格代码/只读修复的独立Node24 `npm run build:site` **243文件/2728项通过，9项opt-in跳过**并生成站点。完整模型尝试尚未包含在此提交，不能把这些消费者回归计入G8。

随后公开ab9版本已真实运行冻结T-qa-01三次，全部Fail并登记；模型正确JSON与宿主实际交付的差异由配对wire、真实Save及最终UI共同证明。[基线报告](acceptance/STUDIO_V3_G8_READONLY_20261017.md)。这些失败不覆盖、不换问题、不改oracle；修复发布必须另冻profile。

修复版8c已用相同输入／oracle／alias／route／budget真实3/3 Pass；旧ab9三Fail不覆盖，两个profile各3/180而非混算6/180。另一个独立回执UI smoke是非G8操作，不写入此CSV。[修复版公钥档案](acceptance/STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json)与[逐次结果](acceptance/STUDIO_V3_G8_CORRECTED_20261017.json)固定实际已测release；之后文档提交不会自动继承该profile资格。

## 已读依据

- [本仓库 Gate G8 与证据规则](STUDIO_V3_CODING_AGENT_ACCEPTANCE.md#gate-g8-real-model-task-qualification)：固定60×3、原门槛、保留全部失败、独立输出证据。
- [原 register 纯函数](../scripts/studio-v3-task-register.mjs)与[既有消费者测试](../tests/studio-v3-task-register.test.js)：CSV、essential、分母及 identity 契约。
- [真实 Node/JSON profile](STUDIO_V3_CODING_RUNNER.zh-CN.md)、[starter](../studio-v3/source-workspace-starter.js)、[runner operations](../coding-runner/operations.mjs)、[workspaces](../coding-runner/workspaces.mjs)、[policy](../coding-runner/policy.mjs)：实际源码/进程/制品 shape，不信 stdout 或可写测试。
- [现有 artifact bridge](../studio-v3/source-workspace-artifact.js)、[authoring 服务](../studio-v3/ai-authoring.js)、[真实 Save/Open](../studio-v3/file-io.js)：复用当前权限/金融/scope/导入语义，不建立另一套生产执行路径。
- [纸张枚举与像素margin](../studio-v3/design-authoring.js)、[现有数字format契约](../studio-v2/core/binding-format.js)、[实际tool effects](../studio-v3/agent-registry.js)：独立预期采用规范纸张mm表与Intl规则，read-only采用保守允许表；不以生产布局/format函数自证正确。
- [实际 Responses call/result 配对](../studio-v3/agent-wire.js)、[host finish_answer](../studio-v3/agent-handlers.js)、[measured-font finalizer](../studio-v3/ai-agent-run.js)与[问题/最终答案变换](../studio-v3/ai-chat-protocol.js)：记录真实工具结果和最终交付差异，不把 JSON 猜中或模型自述当已读取当前状态。
- [OpenAI Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)（2026-10-17 实际读取，`What are evals?`、`Design your eval process`、`Single-agent architectures`）：task-specific eval、具体功能正确性、held-out集、反对 vibe-based 评分并保留人类校准。本工具是本地消费者，不依赖该站 Evals 平台/API，也不从通用建议推出本产品已合格。
