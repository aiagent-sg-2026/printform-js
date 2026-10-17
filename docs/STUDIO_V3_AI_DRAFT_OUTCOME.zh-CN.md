# AI 私有草稿：请求意图与真实交付结果

## 本次修正的故障

已有工具权限把问题限制为只读；设计权限允许模型编辑**私有副本**，没有提交当前表单的权限。但设计权限同时允许 `finish_answer`，因此用户明确要求“先预览、等确认后应用”时，模型即使没有交付候选，也能以普通回答结束。回答中写了“完成”或尺寸，并不是候选存在的证据。

本次由宿主区分**工具调用结束**与**用户要求的交付物已交付**，不是只改提示词让模型声称成功。

## 机制

- `ai-request-intent.js` 只读用户本次直接请求，识别直接命令、真实解释问题和不明确表述；引用、围栏代码、引用块、来源段落和 XML 包裹文本不提供编辑授权。
- `readOnlyRequest` 复用此策略。只读限制及明确否定优先；“How can I change…?” 不因为含 change 而成为编辑请求。不明确请求收窄为只读，不猜测用户同意编辑。
- 直接命令支持 Only / Just / Please 等限制副词、Clear / Restore / Reset、保留约束加明确编辑（如 Keep … and increase …），以及目标在前的字号简写（如 Label 12pt bold）。表格目标在前的 use / 改成等命令仅在去除引文、排除问题/否定后复用 `tableBackgroundIntents` 的目标与目标色解析；仅提及“表格背景是黄色”不构成授权。
- `runAgentLoop` 把原有 profile 当作权限上限，只能收窄。用户文字、模型工具参数、来源附件、引用与结果元数据均不能申请更宽 profile。原有 selection scope 不改变。
- `ai-task-outcome.js` 定义独立宿主结果：`answered` 为信息回答；`draft-not-produced` 为已请求草稿但只返回回答；`draft-ready` 为实际经过现有 finish 门禁的候选交接。
- `createGrant` 接收宿主已判定的 intent：仅当明确草稿请求且原 profile 已有 draft 权限时，删除 answer effect；profile 名称、scope、工作区授权及其余权限不变。`grantedDefinitions` 与 Pi `activeToolNames` 因而不展示 `finish_answer`；幻觉调用由 Pi 可用工具边界拒绝，绕过展示直接执行也由既有 `assertEffect` 拒绝。仍只能用 `finish` 交付检查后的 proposal，或 `report_blocked` 如实报告阻碍。
- 真正问题、只读和歧义仍收窄为原只读 profile，可以在证据门禁后 `finish_answer`；允许的 finalized message（含结构化 JSON）、身份及当前 observation 引用互相独立，不把宿主提示拼入正文。
- 单步兼容路径及宿主本来只授予只读上限的路径，若只能交付 answer 而用户要求草稿，仍标记 `draft-not-produced`，保留正文、独立 citation 和恢复元数据。面板显示失败与原表单未变，提供 Edit & resend，没有 Preview/Apply 按钮；不把回答升级为 proposal，不新增整个请求重试。

## 候选与人工 Apply 边界

本次没有自动 Apply。实际交付仍必须经 `createDraft` 的 typed operations、数据/绑定不变量、选区限制及净差异检查，再由 `finish` 核对**当前最终候选**的最新成功 `inspect_draft`。编辑、撤销或宿主状态改变会使旧证据失效。仅检查未改变的原表单、仅模型回答说 ready、引用其他 observation，均不等于候选已交付。

`draft-ready` 仅表示有经过既有门禁的候选可交人检查，**不代表**所有自然语言要求都已语义验收，更不代表真实打印机验收或已应用。

## 实际验证与保留失败

新增 `tests/studio-v3-draft-outcome.test.js`、`tests/studio-v3-draft-outcome-panel.test.js`、`tests/studio-v3-draft-diff-recovery.test.js`、`tests/studio-v3-request-intent-grammar.test.js` 和 `tests/studio-v3-draft-grant-boundary.test.js`，覆盖：

1. 公开的原始请求：“把纸张设置为宽188.5毫米、高244.2毫米的自定义纸张，纵向。其他内容、字体、数据、绑定、页边距和现有打印机约束保持不变。先预览，等我确认后才应用。”
2. 明确草稿请求的 `finish_answer` 不在模型工具清单；幻觉调用与直接绕过展示调用均拒绝。模型可如实 blocked，或另行用当前检查后的 proposal finish；普通问题与单步兼容回答的 JSON 正文、独立引用保持，不产生自动 Apply。
3. 真正候选的 188.5×244.2 mm、CUSTOM、portrait 精确值，以及所有未请求设计属性、字体、绑定、数据、页边距、用户声明打印机约束保持不变；被 inspect 的候选必须等于最终交接候选。
4. 未检查、编辑后旧检查、撤销后检查、超选区操作拒绝；明确 blocked 仍为 blocked；人手 Apply 前表单与 revision 不变。
5. 真实问题、否定、引用/源码指令、歧义请求不扩权；失败状态、原文、独立 citation 在 UI 和恢复后不混淆。
6. 自定义纸张尺寸与声明打印机约束的 diff 恢复复用既有 typed validator：合法历史仅恢复为 expired，错误单位类型、超范围、额外键和错误目标不能成为有效历史或 Apply 授权。
7. 焦点副词、表格目标在前的中英命令、保留约束加编辑、清除/恢复，以及这些命令包在问题、否定、引文或来源中的对应反例。既有几何修复的 Label 12pt bold 保留为真实简写；schema-budget fixture 改成真实编辑请求但不改变原预算/停滞断言；授权消费的 answer fixture 改用真实只读问题。

2026-10-17主代理在只含Git跟踪基线与AI切片的隔离目录独立执行：首轮2901项通过、25项失败、9项opt-in跳过。真实普通语法被误判只读的回归已修复；合成预算fixture使用真实编辑请求，授权消费fixture使用真实只读问题，原预算、scope与inspection断言不变。精确提示词复制断言删除，保留真实绑定样式/数值保护；原始失败报告不覆盖。

最终全套2970项通过、0失败、9项opt-in跳过；实际发布CLI执行114个契约实例、38项散列审查通过，仍22 tools／13 operations／3 guides。知识包曾被原16k边界拒绝，压缩重复说明至15954字符后通过，没有增加上限。原a99c932基线、原模型/alias/路由/预算和正式G8记录不改。

真实Chrome155保留sandbox，在本地未发布`local`快照检查1440×1000与375×812界面：输入原请求但未发送，手机可关闭AI返回Data、r0不变、无全局横向溢出或pageerror。该步骤是界面烟测，不是假装真实模型已成功；公开版本的同请求实测须按实际结果另记，旧e385失败永久保留，不回填G8。

## 已发布实测失败与当前追加修复

公开版本 PR93/main `ed81628243a6eaaf9abfc1c0ba5f856e7d391729` 的 Chrome155/sandbox 原 fixture、原精确请求、demo-auto 和原配置，实际执行1 run、5个HTTP200，UI显示95935 tokens，18.274秒。交付仍只有回答而没有候选，真实任务 **Fail**；宿主正确显示 `draft-not-produced`。保存的5242字节source前后SHA相同，仍r1/A4；检查的3个canary均未出站。事实来自真实公开Origin验收的本地报告 `public-ai-user-task.json`，不读取、不转录、不发布私有reasoning/wire；此前e385与本次ed816282失败均永久保留，不因工具收窄而回填成功。

上述2970通过/首轮25失败是此前版本历史。追加修复只在已授予design/coding内删除answer effect；未手调提示词策略，工具名列表随grant正常收窄。alias、route、预算、oracle、语料、沙盒和source授权均不变。source消费者通过真实 `authorizeSourceWorkspace` 工厂取得测试租约，不伪造授权，也不把脚本化连接当真实Docker/模型证据。

追加切片冻结于已跟踪ed816282基线并独立验证：初次误用默认并发，2966通过、17失败、9跳过；失败报告均仅保留 `STACK_TRACE_ERROR` 且时长超过5秒，原报告保留，不冒称17个产品Bug。随后按项目既有 `npm run build:site` 的 `--maxWorkers=1 --no-file-parallelism` 路径完整执行，**2983通过、0失败、9项opt-in跳过**，未修改用例或超时。实际CLI执行114契约实例，22 tools／13 operations／3 guides、38摘要审查通过；知识包15946字符，原16000边界不变。

另以真实运行代码调用原请求的grant、capability handler和直接执行边界：全局22项并非design权限数；实际design由13项减为12项，唯一移除 `finish_answer`，未新增工具。直接越过展示调用返回 `GRANT_DENIED`，只读问题仍可回答且无draft权限，原表单JSON完全不变。该消费者烟测0模型请求，不冒充真实模型表现。

Chrome155/sandbox原生界面烟测：`local`身份，桌面及375×812手机截图已查看，原请求仅输入未发送；手机关闭AI可回Data，r0与全局横向溢出0保持。本地界面/脚本测试不是公开真实模型或物理打印证据。追加source的公开同提示词任务必须待其真实部署后单次执行另记；不把此前失败profile重跑刷绿，不推断生产通过。

## 限制

意图策略是保守的宿主语法，不是通用自然语言理解或完整提示注入检测器；未识别的委婉/复杂命令会保持只读，可改写成直接请求后重新发送。它不增加工具能力、不放宽观察授权、绑定保护、scope、Apply、模型/路由/预算、沙盒、测试或外部验收门槛。此修正能可靠揭示“未交付”，不能保证真实模型每次都会产生正确候选。

## 研究与复用边界

- [OpenAI官方工具调用流程](https://developers.openai.com/api/docs/guides/function-calling#the-tool-calling-flow)：模型提出调用，应用侧执行并返回结果；模型结束不是宿主交付验收。
- 现有固定`@earendil-works/pi-agent-core`／`pi-ai`0.85.1及[包声明仓库](https://github.com/earendil-works/pi)继续使用，没有替换provider或Harness预算。
- 已读取KB的`news-digest:golden-evaluator`1.0.0（skill ref `270d896a-12b0-40b4-856f-f6274d872c95:00f0459c-5a2b-477e-aeb0-74b058f20f1f`）；仅复用冻结评估、保留失败、把真实执行与确定性测试分开的原则，不套用新闻业务阈值。
