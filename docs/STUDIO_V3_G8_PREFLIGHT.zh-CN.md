# G8 全套执行前离线预检与实际能力缺口

本页描述可执行的 `preflight` 消费者，不是模型执行报告。它不调用 provider、不连接 broker、不获取 source lease、不自动 Apply、不写 attempts，也不把任何单元输入当正式结果。原 corpus、oracle、20 个 holdout、模型 alias/route、预算和资格门槛均不变。

## 不应花 180 次模型调用重新发现的硬约束

原版 60 个任务 × 3 次 = **180 槽/profile**。其中 12 个冻结 oracle 是拒绝边界：正确结果只能是 `Blocked`，不是 `Pass`。因此正向任务即使全部成功，也只有 **144/180**，低于 **162/180**；data 家族上限 **0/18**，bindings/references/files 各上限 **12/18**，均低于逐类 **16/18**。六 essential 仍各需 3/3，任一 critical 仍拒绝资格。

这是输入版本本身的不可达条件，不是 runner 临时故障。预检在任何昂贵模型调用之前指出它；不执行 180 次也能证明该版不可能完整合格。仍可在明确研究授权下收集原 180 次的真实结果，但不能称该操作为“将取得完整资格”。能力扩展须另冻新语料/profile；不能改旧输入、将 Blocked 改 Pass、删除旧失败或借新版本替换旧分母。

正式 CSV 当前包含两个历史 profile 各三次：ab9 为三 Fail，8c 为同一原题三 Pass。总计六条并不等于单一 profile 6/180；更不授予当前另一发布复用这三 Pass 的资格。

## 直接调用现有 CLI

```sh
node scripts/studio-v3-g8.mjs preflight \
  docs/acceptance/STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json

node scripts/studio-v3-g8.mjs preflight \
  docs/acceptance/STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json \
  /OWNER_PRIVATE/g8-evidence-index.json
```

stdout 是完整 JSON。未 qualified 时退出码 **1** 是真实拒绝，不是消费者崩溃。只提供公开 profile 时，CSV 的三 Pass 只列为 `recordedPass`；未提供签名 envelope 就必须是 `verifiedPass:0` 和三份缺证，绝不把 CSV 中的文字当实际模型证据。

`preflight` 输出：

- 完整 profile/corpus/register 验证、原 180 个唯一 task/attempt 槽；每槽只有 ID、摘要、类别、essential/holdout 标记、所需证据类型与记录/验真状态，不输出冻结 prompt、状态、源码或答案。
- 全 CSV 实际 profile 数量、各自记录数/Pass/critical/独立身份数，不跨 profile 合分。
- 逐 family 分母/实际通过/验真通过/不可用数量/理论上限，六 essential 的 3/3 分母。
- 每个显式输入 envelope 的签名/独立 oracle 判定，以及对应 CSV outcome/digest/identity/duration/usage/critical 的一致性；重复 envelope、相同 runId 冒充不同重复、缺精确 profile、无登记执行和篡改均拒绝计入验真子集。
- 缺证、依赖缺失、固定 upstream 不明、source image 不可用、实时 release 差异及不可达门槛分别列 blocker。

签名只证明 collector 对观察字节的 custody，不证明观察真实。原始 UI/wire/状态/进程记录仍需独立操作者审阅。held-out 的逐项 oracle 错误内容只输出数量/摘要，不把期望文字泄露到汇总；完整错误仅在原独立证据消费者和授权 custody 中审阅。

### 私有索引

下面是**索引格式说明**，不是实际证据；路径须由独立操作者指向已存在的真实档案。所有相对路径相对于索引文件，CLI 不扫描任何目录。

```json
{
  "schema": "studio-g8-preflight-index-v1",
  "profiles": ["baseline/profile.json"],
  "envelopes": [
    "baseline/attempt-1/envelope.json",
    "corrected/attempt-1/envelope.json"
  ],
  "liveRelease": "independently-observed-agent-manifest.json",
  "prerequisites": []
}
```

传入 CLI 的 selected profile 自动加入；要同时核验其它历史 envelope，须显式列出其原 profile。完整六份真实档案应逐一列出 attempt-1/2/3；非 G8 的 receipt-UI smoke 不得混入。缺路径或错 JSON 返回可定位错误，不静默跳过。不要列私钥、token、认证头或无关文件。

`liveRelease` 是独立操作者从实际页面对应发布读取的 agent manifest JSON。消费者对比 release/contractHash/knowledgeHash/packageHash；不同则报告 `live-release-mismatch`。该离线文件不等同于在线认证或 G9 审批；省略时明确缺证，不能从 git HEAD 推定公开版本。

可选 `prerequisites` 项格式为 `{id,path,digest}`，digest 为文件**原始 bytes**的 `sha256:` + 64hex，支持的需求 ID 是 `source-runner`、`fixed-upstream`、`g6-g7`、`data-governance`、`g9`、`live-release`。字节一致也只标 `supplied-for-independent-review`：不存在用任意 `{qualified:true}` 文件关闭合同/G6/G9 的新后门。预检负责清点、完整性和缺失报告，既有独立 gate 与 maintainer 的审查权不变。

## 当前完整资格前置条件

| 层次 | 可从现有公开档案确认的边界 | 真实补证要求 |
| --- | --- | --- |
| 原 corpus | 12 denial，最高144/180；data不可能16/18 | 保留原记录；新能力后新版本另冻，不改旧oracle |
| 当前发布 | 历史8c三Pass只绑定其app/knowledge/source身份 | 独立读取实际发布manifest；改包即新profile，不继承旧Pass |
| Source runner | 8c browser-only profile 的 runner_image 是 `unavailable` | 当次同release配对、实际不可变Docker image、有效source lease、完整树/真实进程receipt/制品导入 |
| Upstream | `demo-auto` route-level档案，model_version为`unavailable` | 服务方固定provider/snapshot/route配置、无未知fallback及逐请求dispatch证明；不改alias冒充固定模型 |
| G6/G7 | 有界Node24/source→JSON任务历史不是任意源码资格 | 同profile的隔离、拒绝、取消/未知效果/恢复及制品安全全部适用case实证 |
| DPA/真实资料 | Demo适用训练/保留/删除/地区/分包/保密条款未获完整证明 | 具体operator/tenant适用合同与scope批准；虚构输入不能授权真实客户数据 |
| G9 | 发布hash校验不是生产运行批准 | tenant/auth/isolation、路线wire、容量费用、审计、事故回滚演练及maintainer决定 |

source doctor/broker 连接与当次 lease 的实时状态应另行真实观察。此 CLI 是离线职责，明确标为 unobserved；不会拿历史 SOURCE_LIVE 的 imageDigest 伪装当前可用 broker，也不会修改旧 profile 的 `runner_image` 来补源码槽。

## 实际剩余产品能力，不是 prompt 缺几个词

依据当前 `agent-registry.js`、`agent-source-definitions.js`、`agent-contracts.js` 以及 coverage inventory；后者含历史快照，以下以实际 callable registry 为准：

| 能力面 | 当前可调用路径 | 安全完成能力所需的真实接口/权限 |
| --- | --- | --- |
| 数据/字段映射 | 设计 `set_field` / `set_collection` 与现有binding catalog；UI数据编辑和adapter不等于Pi数据权限 | 数据源schema/明确revision的受限读取；独立data draft、类型/行/数字语义验证；明确数据授权和人类Apply；不能由设计请求隐式写数据或虚构生产ERP记录 |
| References/asset | 已有asset引用及授权page-pixels观察 | 用户选择的实际bytes/type/limits/hash、来源与run归属、敏感像素/values披露授权；host导入确认；参考图不是永久可用asset |
| 文件 | 真实UI Open/Save/export与人类历史操作；模型无任意宿主文件权限 | host选择文件、validate-import/prepare-save/export、确切bytes/reopen证据；不能以“下载开始”称已落盘，不允许模型自动操作打印对话框 |
| 源码 | 配对后run-owned、无网络Node24工作区与JSON artifact bridge | 同release授权lease、精确文件scope、初始失败/成功测试/build真实receipt、完整快照及artifact lineage；不开放宿主仓库或任意依赖下载 |
| 视觉/长文档 | 新鲜观察回执、授权像素、synthetic scenario验证 | 相同route的真实tool/image custody和独立geometry/row/cell/视觉检查；API/DOM通过不等于实体打印验收 |

这些能力的生产注册/契约/指南需由各拥有者一次性集成；本消费者不会注册第二套工具或为达Pass降低权限。真正禁止的未授权上传、过账、删除和猜测汇率等仍必须拒绝，不是应“补齐”的功能。

## 原180次的真实执行/收证路径

1. **先预检**：确认原不可达门槛与当前release/source/upstream缺证。如为研究而不是取得完整资格，单独明确执行目的；不声称已有180次。
2. **冻结真实profile**：保持既有alias/route/预算，独立核实app/knowledge/source/browser/实际runner image；unknown upstream保持`unavailable`。同一profile的任何身份改变都不得混入旧attempt；changed release/image必须新profile。
3. **隔离holdout**：只在该任务正式执行时用现有 `input TASK --qualification` 释放；模型不能读取评估仓库、oracle、私钥或其它holdout；不据此调整guide/prompt。
4. **每槽独立真实UI运行**：人类Open原fixture，设置准确scope与该次披露授权；源码先取得同release有效lease，再逐字材料化提供的文件。原提示完整保留，不替换成容易的新问题。
5. **按种类留实际观察**：QA留完整请求/响应和read/finish配对；编辑留private candidate与DOM几何/逐格文本；denial留真实blocked receipt；files留human Save/Open及确切bytes；history留human Apply/Undo/Redo及状态；source留初始/输入/最终树、真实test/build receipt、artifact bytes/hash/lineage/import。修复任务须真实初始非零测试，不签模型自述。
6. **独立消费者再登记**：collector完成观察后用仓库外私钥签名；`evaluate PROFILE ENVELOPE` 先按既有oracle判断。只有实际输出Pass才登记Pass；所有Fail/Blocked/Invalid environment及usage/duration保留。每个attempt新runId，不复制一次观察充三次。
7. **整套复核**：用精确profile及全部已存在envelope索引运行 `preflight`；核对180槽/family/essential/critical/缺证。原版即使补满180观察也保持qualified=false；不得以改原门槛完成验收。

更完整的 evidence v1 字段、DOM像素单位、源码进程与artifact检查见 [G8 corpus/evaluator说明](STUDIO_V3_G8_CORPUS.zh-CN.md)。门禁依据是 [G1–G9验收契约](STUDIO_V3_CODING_AGENT_ACCEPTANCE.md)，不是本页单方面声明。

## 集成者验证命令

集成者已在固定99091源码加本切片的隔离Node24快照执行下列命令：5个文件／174项通过，原60任务／20holdout摘要不变且errors为空。首次新增测试两项失败分别来自独立run合成夹具未同步ui-complete关联和无关stderr空串断言；修正夹具、删除incidental断言，未改消费者或冻结oracle、未压制Node模块类型警告。

```sh
npx vitest run tests/studio-v3-g8-preflight.test.js \
  tests/studio-v3-g8-corpus.test.js tests/studio-v3-g8-answer.test.js \
  tests/studio-v3-g8-geometry.test.js tests/studio-v3-task-register.test.js
node scripts/studio-v3-g8.mjs validate
node scripts/studio-v3-g8.mjs preflight \
  docs/acceptance/STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json \
  /OWNER_PRIVATE/g8-evidence-index.json
```

新增单元输入明确标为合成，使用隔离临时路径，不发送网络、不保存正式attempt。实际另以私有索引重验原六份envelope：ab9三Fail、8c三Pass均与原CSV、签名及独立oracle一致，零索引错误；修复版仍仅3/180、缺177槽。独立实际99091清单与已测8c的release/packageHash不同，预检如实拒绝继承资格，退出1；modelCalls与attemptsWritten均为0。[脱敏实际结果](acceptance/STUDIO_V3_G8_PREFLIGHT_20261017.json)不包含原始reasoning、私钥、私有路径或holdout输入。
