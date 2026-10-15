# 通用 PrintForm AI：能力与生产发布证据

日期：2026-10-15。定位是浏览器优先、面向不会编程的用户的通用表单助手；ERPNext 只是可选数据适配器，不是产品边界。

## 决策

- 采用现有真正的 Pi `AgentHarness` / `MemorySessionRepo` 与本地 typed tools，不伪装成终端脚本或任意代码执行环境。
- 借鉴 Oh My PI 的发现能力、读指南、检查上下文、局部修改、实际验证、继续修复和停止机制；不把 shell、文件系统或外部执行权限搬进用户浏览器。
- 用户表达需求；AI 在私有草稿上工作；真实预览通过检查后展示候选；只有用户 Apply 才提交，Undo 可恢复。打印或导出不能偷偷提交未应用草稿。
- 保留既有模型、服务、权限和预算。聊天界面改进不是增加数据披露、执行权限或延长超时的理由。
- **当前仍是 Production Pilot，不是已获完整生产资格的 coding agent。** 不能因此把真实客户、付款、员工或其他机密数据发给 Demo 网关。
- 最新正式版本已通过下方冻结的完整无代码路径实测；这只覆盖明确列出的虚构需求，不改写上述生产权限边界。

## 无代码试用路径

1. 打开 [Studio v3](../studio-v3/)，选择 **New → Blank form → AI editor**；不需要安装 Pi CLI、写代码或填写模型密钥。
2. 用日常语言描述表单。例如：`Create a blank equipment handover form with employee name, department, date, equipment, asset tag, condition and signatures. Hide invoice prices and totals. Do not change source data.`
3. 需要检查当前文字时，在 Sharing permissions 展开项里明确选择本次虚构文字授权；像素授权独立、默认关闭。附件只用虚构 PDF/图片。
4. 查看候选和变更明细；窄屏先选 **Preview** 看纸面，再回到 AI 选择 **Apply**。预览不是提交，AI 不能代替用户点击 Apply。
5. 继续描述需要修改的字体、间距、字段和绑定；可 **Undo**。最后 **Save** 保留可编辑项目，或 **Export HTML** 下载可独立打开的打印文件。
6. 已有 source schema 的字段可绑定；没有 source path 时，明确要求空白填写栏。不要要求 AI 编造金额、员工信息或未提供的字段。

## 已实现的改进

| 范围 | 行为与不变量 |
|---|---|
| 通用表单 | 可复用现有 section slots，增加非金融静态填写栏、改标题/布局、关闭不相关的发票表格与合计；不编造绑定或业务值 |
| 已声明绑定 | 可使用 supplied schema 的通用路径；不从样本值猜字段，不改原始 dataset；受保护金融绑定保持不变 |
| 问题权限 | “How should I… / Should I… / Please explain…”属于只读建议，不因为模型输出 proposal 就升级为修改 |
| 取消/过期 | discovery、响应完成、检查、恢复和发布答案边界重查 abort / 文档身份；忽略 abort 的旧传输不能获准继续写入 |
| 失败恢复 | 检查过候选的失败或只读运行先恢复已提交预览；恢复失败保留 unapplied 阻断，不能宣称已恢复或允许打印 |
| 聊天布局 | 一个会话滚动区、固定输入与发送区、清晰消息角色；大量变更默认折叠，Preview/Apply/Undo 不藏进明细 |
| 附件/披露 | 一个可见附件入口、按需展开预览、PDF 专属设置按需出现；技术诊断移到 Settings；文本与像素授权仍默认不勾选且单次消费 |

## 真实模型基线，不冒充修改后验收

2026-10-15，真实公开站点、实际浏览器 Origin、现有 `demo-auto` 路由、仅虚构数据，无网络拦截、伪造 Origin 或模型回复：

| 场景 | 实际观察 | 不能据此声称 |
|---|---|---|
| 设备交接表建议问题 | session 201、models 200、5 次 Responses 200；回答当前表单检查事实；58,177 accounted tokens；无 page error | 尚无完整保存文件前后哈希，不能仅凭回答宣称完整只读证明 |
| 通用 equipment handover 草稿 | 6 次 Responses 200、约 17 秒、101,918 accounted tokens；9 类所需填写/签名内容，items/totals 关闭，检查为 1 页 / 0 行；revision 仍 0，展示 Apply；无 page error | 未点击 Apply/Undo/导出；不是完整任务通过，也不是修改后代码的证据 |

以上运行基线为 `main@6926ca806c46818e7b6d554f5d82eda5ded8cc72`。模型别名不是底层模型版本或成本证明。本地保留的是去敏证据与截图，不含会话 token/请求头。

首次完整工作树的 Node24 `build:site`：**228 个文件 / 2,416 个测试通过**；站点构建与代理发布检查通过（13 tools、13 operations、2 skills、76 contract examples，保留原发布 baseline，28 项变化均完成审查）。后续删除六项文案/实现耦合测试，不将旧数量冒充最终提交的重新执行结果；最终提交以其 CI 记录为准。确定性测试不是实际模型任务资格。

## 本轮界面与回归验证

- 三引擎 Chromium / Firefox / WebKit，17 个相关规格、**204 个场景通过**，显式 `--retries=0`，无 skip / flaky。可见性度量修正后，参考面板 21 个场景另行通过；不把原生 textarea 内部编辑滚动或关闭的 `<details>` 隐藏内容误报为第二个会话滚动区。
- 未拦截网络、未注入模型回复的原生 Chrome 实际执行 New → Blank form：原文档 45 行 / 3 页，Blank 为 0 个呈现行 / 1 页。1440×900、1024×768、390×844、400×800、320×568 均实际截屏检查；主会话只有一个可见滚动区，无横向溢出，输入/发送保持在屏幕内，主按钮至少 44px，窄屏输入 16px。
- 实际操作 Settings / Escape / 焦点返回、两种默认关闭的授权和原生文件选择器；真实解析虚构 2 页 PDF，读取两页独立文字。**page errors 0、gateway requests 0**；这项 UI smoke 不冒充模型推理验收，也不证明真实手机软键盘或屏幕阅读器。
- 独立源码审查未发现新的运行权限阻断；界面审查发现的首条消息前授权滚动重置、引用区拖放失效已修复，并由三引擎真实控件/文件解析回归覆盖。

失败历史保留：最初相关浏览器结果为 186 passed / 15 failed。产品问题包括平板会话区域被输入/说明挤压、图片支持重试不可见；另有过时的工具数量、宽泛 Settings selector 与被弹层覆盖的点击目标。修复布局/交互、迁移真实用户路径，删除数量/文案耦合断言，没有放宽高度/几何、数据保护或超时。初次执行继承了项目 CI 的一次测试重试，日志中的“no retries”标题不准确；最终实际使用显式零重试。

一次本地执行中 npm 的移动 `node@24` 别名解析到不可取得的 `24.22.0`，剩余六个规格未启动，不能算产品失败或 Pass。改用已安装的 **Node24.21.0 / Playwright1.62.0** 直接执行，这六组 60 个场景全部通过；原始失败和后续结果分开保留。受管浏览器另有 `PREVIEW_NOT_STARTED` / 截图 20s 工具限制；未提高产品期限，以上视觉/运行证据来自未模拟的原生浏览器。

Blank 清空的是呈现布局，不是底层 Demo fixture：其初始数据仍是发票示例。布局 AI 不偷偷清空或重写数据；若需真实业务绑定，必须使用已声明的数据/schema。当前 typed authoring 的 section / field / paper 边界仍然存在，不承诺任意格式或源代码。

交付纠正：PR #65 合入 `777f3384e1e422089735fdeb95f53ada0a4553b6` 后，[CI 38664790898](https://github.com/yapweijun1996/printform-js/actions/runs/38664790898) 因交付清单漏掉 `ai-observation-authorization.js` 和配套 `studio-v3-chat-panel.test.js`、导致审查摘要与提交内容不符而阻止发布。上面的本地构建、204 场景和原生 UI 证据属于含这些文件的完整工作树，不能算该不完整提交的已部署证明。更正提交补齐两文件，保留只读/停止新回归，删除原有文案/转发断言及无调用的 `scopeText` helper；不移动审查 baseline，不拿 CI 的不同摘要覆盖正确的工作树审查。发布前必须从干净提交树通过同一门禁。

## 修改后真实验收与阻断

PR #66 的 `main@d43fc4449b8624ac60f6cf462446f1e31b8d7db3` 已由 [CI 38666536434](https://github.com/yapweijun1996/printform-js/actions/runs/38666536434) 实际通过 **228 文件 / 2,410 测试**、构建和 Pages 部署。正式 Origin 随后的冻结 live smoke 保留全部失败，不能记成六条通过。

| 本轮已证实问题 | 原因与处理 |
|---|---|
| 只读建议失败 | 实际模型读能力/指南/上下文并检查后，以普通文本停止，没有调用 `finish_answer`；`tool_choice:auto` 与必须经受验证的结束工具不一致。非空工具运行改为 `required`；仍拒绝绕过证据、新鲜度、长度与恢复检查的普通文本结束 |
| 移除 logo 后仍出现默认 A | 原操作删除 `design.logo`，模板却把缺省值解释成默认品牌标记，形成“报告变化但纸面没移除”。显式 `null` 现在代表无 logo；人工与 AI 路径一致，模板/网格/组件规范和可见性上下文一起更新 |
| Demo 请求限额 | 本次共 22 次 Responses 200、336,438 accounted tokens，之后 Responses 和 session 均实际返回 429；绑定任务未完成。保留硬限额，不轮换 session/模型规避，也不把它当生产容量通过 |
| 验收脚本错误 | PDF 清理误用 `PDFDocumentProxy.destroy`、签署栏检查误要求出现字面 `signature`、图片支持/授权前置步骤不完整、未移除图片阻塞 Stop，且请求等待 Promise 未及时处理拒绝。修正脚本，保留原记录，不计为产品通过 |

连续修改的纸面实际保留了 Handed over by / Received by 空白签署栏；原“Missing signature role”不能算字段丢失。新的检查按真实签署字段和空白线判断，而不是固定文案。创建确实已显式 Apply 并产生文件，但 PDF 清理异常发生在 Undo/Redo 前，不能将这次创建任务标为完整 Pass；图片没有模型推理证据，Stop 也未完成。

logo 修复后：五个针对文件 / **61 测试通过**。未模拟的实际浏览器导入上述虚构交接表，点击 Remove logo → Apply，r1 → r2；保存、重新打开、Undo/Redo 与 file-URI 独立 HTML 均实际执行，无残留 logo，数据不变，导出 `ready` / validation errors 0，page errors 0、gateway requests 0。视觉截图和原始记录保留。本地 smoke 初次误选全部 section 关闭的 Blank、随后遇到隐藏数据库的同名开关及缺省 submit 按钮的属性 selector；更正为真实表单、主工具栏和可访问按钮动作，没有修改产品通过条件。

下一次正式模型复验仍固定原六条需求、既有 route/model/预算和几何条件；使用明确记录的 30 秒任务间隔，检查实际 Pi 结束工具，而非单步回退的表面成功。若出现 429 就停止后续推理，不自动重试或规避配额。修复后的模型结束、连续修改、绑定、像素辨识和 Stop 仍须由其部署版本逐项证明。


修复后的完整本地 Node24 `build:site` 已实际通过：**228 文件 / 2,413 测试**，包括新增的三项 logo 移除/保存重开/重复无效操作回归；站点构建成功。58 个交付文件均不超过 300 行，141 个本地 Markdown 目标检查无错误。原有 JSDOM confirm / pseudo-style、模块类型与浏览器外部化警告仍保留，未抑制成“无警告”。正式部署后的模型验收仍是独立要求。

修复后的三引擎代理步骤回归另行 **12/12 通过**，显式零重试：真实界面执行分步、Apply/Undo、工具不支持的既有单步路径、偏好恢复和图片初始回合/笔记保留。该组使用模型 fixture，是运行边界回归，不冒充真实服务推理，也不与前面的 204 个场景相加当成新的去重数量。

## 真正 Blank 的根因修复

PR #67 的 `main@256bd7bb63d1885833830b27aa7739fe5fe0d5e2` 已由 [CI 38670673947](https://github.com/yapweijun1996/printform-js/actions/runs/38670673947) 实际通过 228 文件 / 2,413 测试并完成部署。该版本的正式 Origin 冻结复验：

| 路径 | 实际结果，不扩大结论 |
|---|---|
| LIVE-READ | Pass；实际经过 get_capabilities → read_skill → get_context → inspect_draft → finish_answer，wire 为 required，完整保存文件哈希和 r0 不变；不是单步回退 |
| LIVE-CREATE | Fail；候选仍显示 ACME/旧单号/客户等未被要求的发票内容，所需签署字段未形成可用空白线；几何 ready、2 页不能冒充需求完成 |
| LIVE-FOLLOWUP / LIVE-BIND | 创建未应用，依赖前提不成立，未执行；原记录只启动四条，不能称六条已跑完 |
| LIVE-REFERENCE | 尚无推理；脚本把不存在的 pending 聊天消息当作 discovery 完成信号，仍在 Connecting 时过早检查能力。后续独立实际 UI 发现确认 demo-auto 的 responses / multimodal 均为 true，Send 可用；demo-groq 的 multimodal 明确 false，仍被拒绝。没有修改能力解析器或换模型 |
| LIVE-STOP | Pass；实际 POST 开始后取消，完整保存快照哈希与 revision 不变，随后独立 file-URI 导出 ready / errors 0 |

根因不是“通用表单必须依赖 ERPNext”，而是 Blank 只隐藏了带发票字段的 section。现在人类 New → Blank 的五组布局字段均为空，标题中立、默认 logo 关闭；重新启用 section 也不会复活旧单据内容。**保留 supplied dataset/schema，不以偷偷清空数据掩盖问题**；发票/采购/送货等 populated starters 不变。作者指南明确用现有 static 字段、可见 label 和实际打印的空白线；不新增工具/field kind，也不编造已签名或完成的业务值。

该修复已实际通过五个针对文件 / **63 测试**。未模拟浏览器导入自有虚构源值 canaries，启用空白 section 后只有中立标题和页码，没有旧源值；实际添加 Contact name / Recipient signature 填写线，Undo/Redo、保存重开和独立 HTML 均完成，导出 ready / errors 0，数据与 schema 不变，page errors 0、gateway requests 0。初次脚本漏切回 Properties、重开时未等待新的真实 rendered token；更正观察同步，不重试模型、不修改产品期限，失败记录保留。

新的 live 脚本保留原六条需求，等待真实 Send 可用后才检查图片授权/发送，记录公开能力布尔值，遇 429 停止推理，并明确登记前提不成立的任务。下一节记录其正式部署实际结果；局部 Pass 不授权生产数据，也不代替 G8。

真正 Blank 修复后的完整 Node24 `build:site` 已实际通过 **228 文件 / 2,413 测试**与站点生成；62 个交付文件最大 300 行，141 个本地 Markdown 目标检查无错误。干净提交 `ca141c3` 的 13 tools / 13 operations / 2 skills / 76 conformance examples 与全部 28 项评审门禁也通过，保留原 `a99c932` baseline；PR #68 合入后由下述主线 CI 完成部署。

## 实际图片成功与字段尺寸契约修复

PR #68 的 `main@fa7b0261c9c943db5208f6713c64d00411e081ee` 已由 [CI 38675385870](https://github.com/yapweijun1996/printform-js/actions/runs/38675385870) 完成构建和 Pages 部署。真实注册 Origin、原 demo-auto、冻结六条需求、明确 30 秒任务间隔；没有模拟模型、伪造 Origin、放宽预算或自动重试：

| 路径 | 实际结果 |
|---|---|
| LIVE-READ | Pass；实际 finish_answer，完整保存项目与 revision 不变，无候选 |
| LIVE-CREATE | Fail；三次 apply_operations 后 report_blocked，未应用；不能把空白纸或通用错误称为成功 |
| LIVE-FOLLOWUP / LIVE-BIND | Blocked；创建前提未成立，登记但没有推理，不算通过 |
| LIVE-REFERENCE | Pass；实际图片推理识别 FIELD SERVICE LOG、Work ticket / Technician 以及只存在于像素的 CYAN-47，通过 finish_answer，无候选；不是仅能力 discovery 或 fixture echo |
| LIVE-STOP | Pass；实际请求开始后 Stop，保存快照哈希与 revision 不变，独立 HTML 导出 ready / errors 0 |

保留失败记录后，另一条只用于诊断的实际创建请求采集了明确的工具参数/错误：模型给非 items 的 static 字段加入 `width:100`，文件契约只允许 table-column/image width，却把错误折成不可定位的 `UNSAFE_PROPOSAL`。模型因此错误报告“没有字段 authoring targets”。以原始操作在实际模块复现：原参数拒绝；只在诊断输入中去除不支持的 static width 后，十个字段完整编译、source data 不变，原项目也不变。

产品修复明确 schema 描述、共享作者契约及两条模型指南中的尺寸所有权；add/set 非图片文档字段返回精确可修复 `FIELD_WIDTH_UNSUPPORTED`，单步修复白名单、脱敏诊断和公开错误表同步。**不放宽文件验证，不静默删除模型属性，不改变合法图片/表格宽度或数据权限**。五个针对文件 / **64 测试通过**；实际 API smoke 再次以原参数得到新错误，合法 section-grid 填写线编译出十字段且数据守恒。修复后的真实模型创建/连续修改/绑定仍须由新的部署逐项证明。

该尺寸契约修复的完整 Node24 `build:site` 已实际通过 **228 文件 / 2,421 测试**与站点生成；67 个交付文件最大 300 行，141 个本地 Markdown 目标均有效。既有 JSDOM / 模块类型 / 浏览器外部化警告保留；此处仍是工作树证明，不冒充干净提交或新部署模型验收。

## 标题可见性与不透明参数错误

PR #69 的 `main@37d276885cbe046b0b9e77774d795711ebc2cf78` 已由 [CI 38678334777](https://github.com/yapweijun1996/printform-js/actions/runs/38678334777) 实际通过 **228 文件 / 2,421 测试**并部署，日志的真实 shell 版本也是 `37d276885cbe`。干净提交 `9036403` 的发布门禁为 13 tools / 13 operations / 2 skills / 78 conformance examples，全部 28 项基于原 baseline 评审通过。

同一冻结六条需求再次实际运行：READ / REFERENCE / STOP 通过；CREATE 已产生十个填写/签署字段且无旧发票内容，但**实际纸张完全没有所要求的标题**，因此仍 Fail、未应用并丢弃。FOLLOWUP / BIND 继续按前提未成立登记为 Blocked，不算执行。模型先遇到 `AGENT_ARGUMENTS_INVALID`，最后以 numeric ready / finish 声称完成；这些不能代替用户目标。

另一次仅用于调查的真实创建请求，十六个操作一次接受，其中明确包含 `set_heading` 和 header enabled，主项目不变；没有 Preview/Apply。这说明独立调查可能得到不同模型轨迹，**不能反写成原冻结流程通过**，也不能伪称已取得原始坏参数。保留全部轨迹与缺标题截图，继续按标题真实可见性、严格参数诊断和最终实际工作流验收修复，不隐式启用 section、不增加数据权限或放宽模型预算。

本轮修复暴露 title / page-number / items 的非敏感编译输出包含状态，明确 `set_heading` 只改存储值、显示标题需在现有 scope 内显式启用 header；保留合法隐藏标题编辑。参数错误提示只来自已声明 schema 的位置、类型与约束，不读取/转发 SDK 含完整参数的异常文本，不回显值或未知属性名，验证器仍复用现有 SDK、原始类型/权限/重复失败限制不变。

已实际通过 **7 文件 / 104 测试**。无模拟 provider 的实际 API/draft/binding smoke：隐藏标题保持隐藏；非法字体得到 256-byte 的精确 `operations[16].patch.fontSize` 数值范围提示且无私密 marker、未改草稿；显式修复后真实绑定 DOM 含 EQUIPMENT HANDOVER 的 20pt 标题和十个填写字段，source data/schema 哈希均相等、原项目不变。这不是新版本的真实模型或浏览器视觉验收。

集成后完整 Node24 `build:site` 已实际通过 **229 文件 / 2,437 测试**与站点生成；71 个交付文件最大 300 行、141 个本地 Markdown 目标均有效。既有警告保留；干净提交门禁和新部署的真实六条需求仍单独验收。

## 最新部署后的六项真实工作流：全部通过

PR #70 的 `main@4f324caae9a014beef14f30cf6e85475df5b3f91` 已由 [CI 38681168826](https://github.com/yapweijun1996/printform-js/actions/runs/38681168826) 实际通过 **229 文件 / 2,437 测试**并完成部署，发布 shell 身份为 `4f324caae9a0`。干净 `a8863ea` 提交的 13 tools / 13 operations / 2 skills / 78 conformance examples 与全部 28 项原 baseline 评审通过。以下是该实际部署，不是工作树或 fixture：

| 冻结需求 | 实际结果 |
|---|---|
| LIVE-READ | Pass；真实 finish_answer，无候选，完整保存项目哈希及 r0 不变 |
| LIVE-CREATE | Pass；实际纸张有 EQUIPMENT HANDOVER、八个指定栏位和可打印签署线，无发票价格/合计；Preview 后人工 Apply，r0 → r1；Undo/Redo、独立 HTML 和 PDF 均执行，标题/字段及页内文本边界通过 |
| LIVE-FOLLOWUP | Pass；实际 title 20pt、所有字段 label/value 12pt、logo 0；签署区截图已观察，人工 Apply，源数据不变 |
| LIVE-BIND | Pass；实际绑定 `/employee/name`、`/employee/department`，显示自有虚构值 Fictional Alex Example / Training；人工 Apply，原数据/schema 不变 |
| LIVE-REFERENCE | Pass；实际图像推理识别标题、字段及仅在像素中的 CYAN-47；真实 finish_answer、无候选，受保护快照哈希不变 |
| LIVE-STOP | Pass；真实 POST 开始后 Stop，完整保存哈希与 r5 不变；后续带两项绑定的独立 HTML 仍 ready / validation errors 0 |

实际共 **24 个完成的 Responses HTTP 200**，可核对 usage 为 **366,478 tokens**；被取消请求没有 usage，该值不是完整运行成本。响应模型只报告 `demo-auto`，不据此冒称固定底层模型。本轮无 page/harness errors、无 429、无参数错误，未改需求/模型/预算/几何条件；schema 修复提示的证据仍来自前述独立 API smoke 和消费者/安全回归，不能声称本轮模型发生过错误自修复。

最终已绑定的 file-URI HTML 另经原生 Chromium 实际生成单页 PDF：两项自供虚构值、标题及全部字段在 HTML/PDF 中都存在，PDF 文本页内边界通过，page errors / gateway requests 均为 0。创建、连续修改、绑定、Stop 四组真实保存文件的数据与 schema 哈希逐对相等；实际截图已观察。系统打印预览警告保留，不冒充实体打印机认证。

[冻结需求与脱敏实际记录](acceptance/STUDIO_V3_GENERAL_AI_LIVE_20261015.json) 随源码归档，包含精确版本、实际工具序列、哈希及明确限制；原始本机 JSON、HTML/PDF 与截图保留。前述失败记录仍成立，不改写、不计成成功；六项 smoke 不进入或代替正式 G8 的 60×3 语料。

最终文档/脱敏归档检查实际覆盖 **72 文件 / 142 个有效本地 Markdown 目标**，最大 300 行；站点生成与原 baseline 的全部代理契约评审通过。本次归档不修改运行时代码，不把文档发布的新版本冒充重新执行过模型的版本。

## 后续选项一：独立访客登记表实测

2026-10-15，正式 `main@1b283f9258fab154c770af3228858293e214a7c9`、真实原生 Chromium、原 `demo-auto`、原权限和预算；从 New → Blank 请求 VISITOR CHECK-IN。九次 Responses 200，实际候选有标题、八个要求的字段和可打印填写线，人工 Preview / Apply 后 r0 → r1。没有模型模拟、换路由或推理重试；本验收器未采集 usage，不能沿用前次 token 数。

实际保存的 `project.sampleData` 与 `project.schema` 前后哈希分别相等。重新 Open 已应用文件后，实际 Export 的独立 file-URI HTML ready，原生单页 PDF 包含标题及字段；截图已观察，页面错误及额外推理请求均为零。此访客试用未执行 Undo/Redo，不冒用早前交接表的独立证据。

保留验收器失败：前两次分别使用不存在的版本属性和不唯一的 footer，均未推理；第三次在实际 Apply/save 后误读保存包顶层数据而中断。修正读取 `project` envelope，直接验收已保存制品，没有重跑模型或把原失败改写为成功。受管浏览器另有已知预览启动限制，保留现场并改用原生 Chromium，不提高产品期限。

参见[冻结需求、真实输出与独立制品证据](acceptance/STUDIO_V3_VISITOR_TRIAL_20261015.json)。这只是新增通用虚构样本，不进入 G8，不授权真实敏感数据或保证全部版式。

## 后续选项二：通用事务样本扩展

PCAR 历史截止、CCAR 重复来源记录、同发票拆分 Payment/Receipt、负额 Sales Invoice、供应商 Purchase Order/Purchase Invoice 的七个虚构变体，在正式 `main@f059ee5` 实际经过 Open/save/reopen/export；源数据/设计守恒，七份独立 PDF 共 11 页已解析并核对文档身份，实际金融字段另由 DOM oracle 核对，截图已观察。首次五条通过、两条观察器失败保留：gross 应保留来源四位精度，PDF 单号允许换行空白；仅更正这两个观察规则并复验，不改运行时或重试模型。

新增长双语商业单据的 A4/Letter 三引擎生命周期 18 条，与既有 claim/settlement 24 条合并，**42/42**、零重试、无 skip/flaky。按实际 source row index 检查续片内容/金额/顺序，真实 Range 不越纸面，保存/重开与离线打印成立。五项新增 API/绑定边界另通过。它们不是 42 次模型推理或生产 ERP 连接；部分默认样张仍有 footer 独立末页的纸张利用率改进空间。

见[事务覆盖、范围和遗留事项](ERP_PRINT_SUPPORT.zh-CN.md#14-后续事务覆盖扩展2026-10-15)及[持久记录](acceptance/STUDIO_V3_TRANSACTION_EXPANSION_20261015.json)。没有把固定样本扩展为全部格式、法定凭证、银行/库存执行或完整 AI 生产认证。

## 尚未获得的生产资格

| 门禁 | 边界 |
|---|---|
| 真实业务数据处理 | 当前 route 是 Demo；未找到可验证的具体服务训练/保留/地区/分包处理约定，不能授权机密数据。KB 的公开 Demo 目标只证明短期浏览器 session 和服务端成本/滥用控制的设计意图 |
| 底层模型身份 | `demo-auto` 未提供固定 upstream model/version；只能记录 route-level 行为，不能归因模型或承诺跨版本等价 |
| 任意源代码代理 G6 | 当前是受限语义表单工具；没有可宣称合格的 source sandbox、真实项目 build/test/制品导入通路 |
| 全任务资格 G8 | [现有标准](STUDIO_V3_CODING_AGENT_ACCEPTANCE.md#gate-g8-real-model-task-qualification)是 60 tasks × 3 = 180 attempts / profile；实际 `tasks.csv` / `attempts.csv` 均只有表头，即正式冻结任务 0/60、登记尝试 0/180。独立 live smoke 不冒充该语料、保留集或逐类阈值 |
| 运行发布 G9 | 未证明具体生产 tenant 身份、服务 SLO、容量/费用治理、审计及事故恢复；真实打印机和真实辅助技术验收也不能从浏览器测试推出 |

不把这些项目标为完成，不删除门禁，不把“像 coding agent 一样工作”偷换成无限制执行代码或获得全部生产权限。

## 依据与研究

本轮实际读取 KB-MCP skills：`ui:visual-design-lifecycle`、`ui:ux-quality-auditor`、`coding:safe-impact-regression-gate`、`ai-governance:sensitive-data-provider-gate`、`agent:autonomous-delivery-verification-loop`。按可重现证据判断，不以测试数量代替视觉、权限或生产资格。

- [Pi Agent 官方固定版本源码](https://github.com/earendil-works/pi/tree/da840b6216578c2a571d0374ac6a2091a83f9d91/packages/agent)：复用真实 harness、工具事件与取消，不编造 API。
- [Oh My PI 官方项目](https://github.com/can1357/oh-my-pi)：借鉴工作循环和验证习惯，不声称内嵌了该终端产品。
- [Claude Artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them)：聊天与工作成果分离、持续修改和明确操作边界；不复制品牌。
- [ChatGPT writing/code blocks](https://help.openai.com/en/articles/20001246-working-with-writing-blocks-and-code-blocks-in-chatgpt)：可编辑成果、预览与显式权限。
- [WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)：仅真正 modal 才采用对应语义和焦点管理；键盘检查不等于屏幕阅读器或 WCAG 认证。
- [OpenAI Function calling](https://developers.openai.com/api/docs/guides/function-calling/#tool-choice)：`auto` 可返回零个工具调用，`required` 要求一个或多个；这是结束协议修复的依据，不代替对实际 Demo 路由兼容性的验证。

参见[聊天契约](STUDIO_V3_AI_CHAT.md)、[界面事项](STUDIO_V3_AI_PANEL_UX.md)、[历史证据](STUDIO_V3_AI_EVIDENCE.md)。历史失败和旧版本证据不覆盖，也不冒充当前构建结果。
