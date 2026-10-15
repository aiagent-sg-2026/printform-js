# 通用 PrintForm AI：能力与生产发布证据

日期：2026-10-15。定位是浏览器优先、面向不会编程的用户的通用表单助手；ERPNext 只是可选数据适配器，不是产品边界。

## 决策

- 采用现有真正的 Pi `AgentHarness` / `MemorySessionRepo` 与本地 typed tools，不伪装成终端脚本或任意代码执行环境。
- 借鉴 Oh My PI 的发现能力、读指南、检查上下文、局部修改、实际验证、继续修复和停止机制；不把 shell、文件系统或外部执行权限搬进用户浏览器。
- 用户表达需求；AI 在私有草稿上工作；真实预览通过检查后展示候选；只有用户 Apply 才提交，Undo 可恢复。打印或导出不能偷偷提交未应用草稿。
- 保留既有模型、服务、权限和预算。聊天界面改进不是增加数据披露、执行权限或延长超时的理由。
- **当前仍是 Production Pilot，不是已获完整生产资格的 coding agent。** 不能因此把真实客户、付款、员工或其他机密数据发给 Demo 网关。

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
