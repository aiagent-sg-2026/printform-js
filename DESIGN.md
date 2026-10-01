# DESIGN.md — PrintForm.js 架构设计

> Studio v3 is an independent structured-authoring Pilot. Current scope, architecture and acceptance: [docs/STUDIO_V3.md](docs/STUDIO_V3.md). Its checks do not close v2 release gates.

> 状态词沿用 [docs/STUDIO_V2_INDEX.zh-CN.md](docs/STUDIO_V2_INDEX.zh-CN.md)：**Current** = 代码已实现；**Target** = 已决定未实现；**Backlog** = 方向性。
>
> Last reviewed: 2026-09-11. Code is authoritative. Live execution status is derived in [PROGRESS.md](PROGRESS.md) from [TASK.md](TASK.md); acceptance evidence and requirements remain in the [production plan](docs/STUDIO_V2_PRODUCTION_PLAN.md). Dated history below is not a fresh release certificate.
> Selected runtime Target: [PI Agent Harness migration](docs/STUDIO_V2_PI_HARNESS_MIGRATION.md), browser-first, frontend-only BYOK, no Node.js/server runtime. Current embedded runtime remains AGRUN; PI-00 browser qualification precedes implementation.

## 0. Current architecture and maturity

Runtime `1.0.0`, Studio `0.11.0`, Protocol `2.0.0`, Agent Contract `4.0.0`; 35 public tools. Product maturity remains **Production Pilot**, with bounded Production Candidate evidence. Current dashboard: plan 76.7% (1610/21), Done 16/21, P0 35/35, PI 4/6.

The [direction review](docs/STUDIO_V2_DIRECTION_REVIEW.md) retains the existing host/gateway/domain architecture. Its classification/session findings have bounded fixes in the [resumed evidence](docs/STUDIO_V2_IMPLEMENTATION_EVIDENCE.md), including current tests, actual Provider prompt delivery, final payload checks, stale-policy transport checks, durable history navigation, old-bus lifecycle invalidation and the reviewed Demo Gateway session path. The current P0 register is 35 Pass, 0 Fail and 0 Not run; PI is 4/6 Done and S17/PI-04 remains open. `npm run doctor` is 5/5 with 106 files / 571 tests; historical aggregate runs are not current release certificates.

### 0.1 E14: implemented UI, incomplete behavioral acceptance

Current: four-layer AI panel (`Navigation → Document context → Conversation → Composer`), title/revision/candidate badges, structured change cards, apply-mode controls, card-level Undo/Redo controls, session drawer, settings modal, collapsed trace, resizable rail, focus/tab handling and desktop export visibility.

Partial: PROD-01/02/03 domain scope/apply/readiness foundations exist, but composed acceptance is incomplete. The host now owns current-document reclassification; the session manager defaults to Unknown and uses guarded index/runtime adapters. One panel session-lifecycle owner rejects stale creation/list/controller results. This addresses the reproduced defects without moving policy into prompts or changing private UI approval, canonical transactions or human export controls.

The project envelope is canonical, CommandBus owns committed state, and preview DOM is derived visual evidence. Neither chat messages nor preview DOM create another project source of truth. The Inspector header keeps the view tabs, SVG action controls and Close control; the redundant AI brand/status block is removed while the hidden status live region remains available to assistive technology.

Proposed workspace: full-width global actions, dominant central preview, one right panel (`Design / AI / Quality`), on-demand component tree and Advanced source editor. Current tabs remain `Designer / Quality / Agent`; the proposed rearrangement is not implemented. Preserve access to Agent integration details.

Proposed logic:

- Enforce component/operation scope in the command/domain path; map selection to FormSpec IDs.
- Share apply-policy decisions across chat, review repairs and retries; keep existing transaction/hash checks.
- Derive application, render/readiness and save state separately from their actual owners.
- Verify candidate cancellation, stale responses, raw draft preservation and file-save outcomes.
- S04 resolves aggregate/per-table row limits from actual table bindings; S05 resolves component-shaped repeatHeader as a table-header-local override with the legacy root flag as default.

Preview-first as the default and Windows/Chromium single-user production as the first release profile are recommendations awaiting product adoption. Current default remains auto-apply; existing broader release goals are not silently removed.

E14 remains Partial. Session/Settings/Trace controls already exist; independent Changes/history search, bidirectional component highlight and fuller mobile workflows remain pending. E15 covers shared-service/HA expansion and is not a universal dependency for a release explicitly limited to one user.

Agent enforcement and migration are specified in the [boundary plan](docs/STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md): the existing gateway now owns closed projections and host references, canonical results remain inside the domain, and policy is enforced separately at storage/provider sinks. The implementation foundation preserves transaction outcomes on delivery failure and uses Agent Contract 4.0.0 for the breaking projection/reference migration. Full acceptance and release evidence remain open; no deployment is authorized.

## 0.2 2026-08-17 Studio v2 Production Foundation（Current）

本节覆盖本轮实现，优先级高于本文早期对“直接 operations apply”的历史描述。

### 0.2.1 Production Verification 结果

状态：🔶 **YES, WITH CHANGES — Production Candidate**，范围限定为受控 Chromium、A4 portrait/landscape、单 Studio 会话的 AI-assisted ERP printing；这不是对所有浏览器、打印机或多用户部署的 Production Ready 声明。

- Playwright `@playwright/test 1.62.0` / Chromium revision `1234` 已安装；全量 Chromium E2E **56/56 PASS**。
- 覆盖 Progress Claim、Valuation → Variation → Materials → Certification 顺序表、100/500/1000 行、A4 portrait/landscape、分页诊断和 trusted export Evidence Pack。
- `nanoid` lockfile 已到 `3.3.18`；`npm audit --audit-level=high` 的最后已记录结果为 0 high，本次文档更新未重新完成网络审计。
- Windows `npm run doctor` 已改为由当前 Node 进程调用 npm CLI，最终 **5 steps / 0 failed**。
- 本阶段发现的 PTAC/PADDT 诊断误报已修复；`tests/studio-v2/render-diagnostics.test.js` 增加回归护栏。预览区保留横向滚动处理；topbar 的 `.actions` 横向滚动（`bindHorizontalWheel` 仍在）现只是 721–1080px 及移动端的兜底——≥1081px 单条 56px 栏内所有动作可见，`Production export` 拆分主按钮始终不被滚出。

E13 foundation 与 E13-SERVER bounded backend 已在本工作树完成；当前结论仍是 **YES, WITH CHANGES — remain Production Candidate**。浏览器 UI 继续保留 localStorage/offline adapter，跨设备生产部署必须显式接入带原子 CAS 的 server backend；因此已证明服务端协议、恢复和冲突语义，但没有把 localStorage 宣称成多用户锁服务。

```text
Project / single-HTML envelope
  ├─ optional pf-form-spec → FormSpec + Component Registry（SSOT for Agent edits）
  └─ legacy template → generated legacy-adapter FormSpec
             ↓
      semantic Agent Gateway / UI CommandBus
             ↓ BEGIN → PREVIEW → VALIDATE → APPROVE → COMMIT
             ↓
      sandbox DOM → deterministic PrintForm pagination
             ↓
      page diagnostics → Evidence Pack → human export
```

- `studio-v2/core/form-spec.js` 是语义 registry；`templateHtml` 仍是 legacy runtime projection。旧 HTML 没有 `pf-form-spec` 时由 adapter 生成 inspection，不破坏旧文件。
- Agent gateway 只发布 allowlisted semantic operations；raw source preview 和 raw operations 只保留给 Studio 内部编辑路径。
- `apply_changes` 没有 operations 直写入口。每次 Agent 写入必须引用同一 `transactionId`、当前 revision、candidate hash 和已批准 preview；候选 content hash 还会防止 preview 后外部修改。
- `src/printform/**` 仍是唯一分页责任方。Active Table Context 由 row 的 `data-pf-table-id` 驱动，Agent 不计算页码、不复制 table header。
- Trusted export 通过 `content-security.js` allowlist、runtime/artifact hash 和 `evidence-pack.js`；localStorage 只是当前 Studio 的离线 adapter，服务端审计与跨设备锁由 E13-SERVER 提供。

### 0.3 E13 Durable Transaction / Concurrency / Recovery（Current，2026-08-17）

`studio-v2/core/durable-transaction-store.js` 是新的存储边界，不改变 Protocol/ FormSpec 或 PrintForm 分页器。它保存单一 form envelope 的 durable head、最近 revision snapshot、transaction records、append-only audit events、Evidence Pack 与 anchor。存储可以是：

| adapter | 能力 | 发布边界 |
|---|---|---|
| `localStorage` | 浏览器刷新/同一 profile 恢复，顺序 CAS 检查 | offline/single-session；不宣称跨 tab 原子锁 |
| `backend.read/write/compareAndSwap` | 服务/进程/设备共享，最终 commit 由 backend CAS | Controlled Deployment 的必需实现 |
| `createMemoryDurableBackend()` | deterministic test double，支持真正的 in-process CAS | 仅测试 |

写路径由 `transaction-service.js` 统一执行：

```text
DRAFT --preview--> PREVIEWED --valid--> VALIDATED --approve--> APPROVED
  --commit intent--> COMMITTING --CAS--> COMMITTED
       ├─ lease timeout → EXPIRED → takeover creates a new transaction
       ├─ stale revision → CONFLICTED → explicit rollback
       └─ crash/unknown result → RECOVERY_REQUIRED → recover_transaction
```

每条 transaction 至少有 `form_id`、`base_revision`、`working_revision`、`owner`、`agent_id`、`patches/changes`、`preview_hash`、`candidate_content_hash`、`candidate_form_spec_hash`、`validation_result`、`approval`、`lease`、timestamps、`commit_result` 与 `evidence_pack_ref`。`apply_changes` 不能绕过 approved preview；commit 先写 `COMMITTING` intent，再执行 durable CAS，CAS 后任何异常都进入 recovery，而不是假装 rollback。

恢复规则是确定性的：durable head 的 `(revision, transaction_id, project_hash)` 与 commit intent 匹配则标记 `COMMITTED`；head 仍是 base revision 则标记 `ROLLED_BACK`；两者都不匹配则标记 `CONFLICTED`。Lease 过期不会复用旧 transaction；`takeover_transaction` 创建新 lease/new id，旧记录保留为审计历史。

Evidence Pack 写入与 committed revision 原子锚定：`artifact_hash ↔ evidence_pack_hash ↔ committed_revision ↔ transaction_id ↔ form_spec_hash/preview_hash`，并追加 `evidence_anchored` event。旧 `TransactionJournal`/`get_transaction_history` 保留为兼容镜像；新的 recovery/API 使用 `get_transaction`、`get_revision`、`get_audit_events`、`recover_transaction` 等语义命令。

明确不改变：不引入第二个渲染器、不把 rendered DOM 当 SSOT、不让 AI 执行 JavaScript/CSS/HTML、不把 pixel canvas 当设计模型。

### 0.4 E13-SERVER Durable Backend Acceptance（Current，2026-08-17）

Historical E13-SERVER assessment: **YES, WITH CHANGES — Production Candidate, 94/100** (not a current release score). E13-SERVER 已通过受控部署验收，但认证边界是“单个 SQLite writer service + 多个 HTTP client session + 人工审批”；尚未认证 active-active writer、外部 HA 数据库、浏览器 UI 的远程 store wiring 或跨浏览器打印链。

实现入口：`studio-v2/server/sqlite-durable-backend.mjs`、`studio-v2/server/transaction-http-server.mjs`、`scripts/transaction-server.mjs`。Node runtime 要求 `>=22.5.0`，使用内置 `node:sqlite`，不引入新的数据库服务。SQLite 开启 WAL、`synchronous=FULL`、foreign keys 和 busy timeout；form envelope 是 canonical state，`durable_transactions`、`durable_revisions`、`durable_audit_events`、`durable_evidence_anchors` 是同一写入事务中的可查询 projection。

```text
independent client sessions / devices
             ↓ semantic HTTP allowlist + auth/CORS
TransactionHttpServer（server database clock）
             ↓ per-request CommandBus
DurableTransactionStore（unchanged domain contract）
             ↓ BEGIN IMMEDIATE + SQL compare-and-swap
SQLite WAL file（head / revisions / transactions / audit / evidence）
```

- 最终 revision 使用 SQL `UPDATE ... WHERE version = expectedVersion`，不是 application-memory CAS；两个连接同时提交时只允许一个获胜，另一个返回 `REVISION_CONFLICT` 并带 `expectedRevision` / `actualRevision`。
- lease 的时间源是 SQLite `strftime('now')`；client timestamp 只作为输入记录，不参与过期判断。过期 lease 不能复用，takeover 产生新 transaction 和新 lease。
- `transaction_id` 是 commit idempotency key。响应丢失后重试只读取已提交 durable record，返回 `already_committed: true`；同一 revision 的 Evidence Pack 以 pack hash 做幂等锚定，不重复写 anchor。
- server 启动会扫描 `COMMITTING` / `RECOVERY_REQUIRED`，按 durable head 与 commit intent 确定 `COMMITTED`、`ROLLED_BACK` 或 `CONFLICTED`；无法证明安全提交时 fail closed，不猜测成功。
- HTTP surface 只允许 semantic commands 与 revision/audit/evidence 查询；没有 arbitrary SQL、JavaScript、HTML、DOM mutation API。`localStorage` 仍是离线/单会话 fallback，不是多用户锁。

E13-SERVER 的明确部署假设是一个 SQLite writer service 持有数据库文件；多个设备/Agent 通过该服务竞争同一 CAS。若要 active-active 或多实例，需要下一阶段的 leader/fencing 或外部数据库事务与共享 artifact registry，不能直接复制当前 process 启动 recovery 逻辑。

---

## 1. 系统全景

仓库包含三个独立子系统，共享同一个分页引擎产物 `dist/printform.js`：

```
┌─────────────────────────────────────────────────────────┐
│  核心分页引擎  src/printform/**  →  dist/printform.js     │
│  （零依赖 Vanilla JS，浏览器端 HTML 自动分页）              │
└──────────┬───────────────────┬──────────────────────────┘
           │                   │
┌──────────▼─────────┐  ┌──────▼──────────────────────────┐
│  Studio v1（冻结）   │  │  Studio v2（Production Candidate）│
│  studio/           │  │  studio-v2/                      │
│  可视化调参 + 模板    │  │  单 HTML 协议 2.0.0 + Agent 命令  │
│  Mustache 数据绑定   │  │  总线 + WebMCP/CDP + PWA         │
└────────────────────┘  └─────────────────────────────────┘
```

| 子系统 | 维护策略 | 入口 |
|---|---|---|
| 核心引擎 | 活跃维护，兼容式渐进重构（见路线图 P2） | `src/printform.js` |
| Studio v1 | **冻结**：只修 bug 和安全问题，不加功能 | `studio/index.html` |
| Studio v2 | 活跃开发，按 P0→P3 路线推进 | `studio-v2/index.html` |

---

## 2. 核心分页引擎（Current）

### 2.1 模块划分

- [src/printform.js](src/printform.js) — 公共 API（`PrintForm.formatAll/format`）、自动初始化（检查 `document.readyState`，支持动态注入后执行）、防重入（`__printFormProcessing`/`__printFormProcessed`）。
- [src/printform/config.js](src/printform/config.js) — 全部配置的单一定义表 `CONFIG_DESCRIPTORS`（默认值 + `data-*` + 旧全局变量三来源合并）；PADDT 独立配置表。
- [src/printform/dom.js](src/printform/dom.js) — 高度测量（`getBoundingClientRect` 亚像素 + margin）、dummy row/spacer 生成、分页符 divider。
- [src/printform/text.js](src/printform/text.js) — 按词数切分段落（TreeWalker + Range），PTAC/PADDT 共用。
- [src/printform/formatter/](src/printform/formatter/) — `PrintFormFormatter` 类，方法按职责拆分为 12 个 attach 模块（pages / sections / row-types / segments-ptac / segments-paddt / rendering / pagination-context / -dummy / -render / -spacing / -finalize）。
- [src/printform/debug.js](src/printform/debug.js) — `data-debug=y` 时的控制台捕获 + 页内调试面板。

### 2.2 分页流程（一次 `format()`）

1. `collectSections()` — 先展开 PTAC/PADDT 长文分段（克隆时**必须移除** `tb_page_break_before`，两者已对齐），再收集 header/docinfo×5/rowheader/footer×5/logo/pagenum/rows；PADDT 行分离出主流程，在全部常规页脚之后另起分页。
2. `measureSections()` — 逐区块测量高度（含 margin，向上取整防移动端小数像素累积溢出）。
3. `renderRows()` — 逐行 append→measure→超限则撤销并 `prepareNextPage()`；小计/页脚组合行有预测试 + dummy 行推底逻辑。
4. `finalizeDocument()` — 追加最终页脚，必要时另起一页。
5. `finalizePageHeight()` — 每页按配置高度补 spacer（插在页脚前）。

### 2.3 关键设计决策

| 决策 | 理由 |
|---|---|
| 测量用 `measureHeightRaw`（不临时改样式） | `measureHeight` 的隐藏元素兜底会在移动端紧凑循环里引发 0 高度读数与重复 append |
| 分页符用 `setAttribute("style", "page-break-before: always…")` | 部分 HTML→PDF 引擎只认旧属性名；`div.style.*` 会被浏览器规范化成 `break-before` |
| 自动初始化先查 `readyState` 再挂事件 | 脚本在 DOMContentLoaded 之后注入时事件不会再触发（2026-07-31 修复，`00e3b7f`） |
| 高度归一 `Math.ceil(num - 1e-6)` | iOS/WebKit 小数像素向下取整会累积成意外换页 |

---

## 3. Studio v1（冻结，Current）

- Studio v1 以 [studio/studio.js](studio/studio.js) 作为 ES module composition entry，职责分布在 `studio/studio-*.js` 模块中；行为仍保持冻结。另有 [studio/bridge.js](studio/bridge.js)（注入预览 iframe）+ [studio/mustache-lite.js](studio/mustache-lite.js)（最小 Mustache 子集）。
- 预览 = blob iframe + bridge postMessage 回报（console/metrics/blocks）。**消息必须校验 `event.origin === location.origin`，日志 level 走白名单**（2026-07-31，`ebd5d20`）。
- **结构模式必须加载原始模板**（不做 `renderWithData`）：bridge 的区块索引与 `withWorkingDoc` 的原始子节点索引才能对齐，`{{ }}` 绑定才不会被编辑毁掉（同上）。
- mustache-lite：转义含 `'` 与 `` ` ``；不配对 section 抛错（`renderWithData` 已接错误 UI）。

## 4. Studio v2（Production Candidate，受控范围，Current）

### 4.1 分层

- `core/` — 纯逻辑（协议 parse/serialize、operations、revision 历史、验收、资产内联、布局审查、i18n、导出）。**UI 不得绕过 core 直接改项目。**
- `ui/` — DOM 绑定（app.js 组装、preview、status-view、draft-cache、file-io、ui-i18n）。
- `adapters/` — 命令面适配（gateway = `window.PrintFormStudioAgent`；webmcp = `navigator.modelContext` 标准位置优先，支持 `registerTool` 与 `provideContext` 两种 API）。
- `samples/` — Sales Invoice, Purchase Order and Progress Claim pilots.
- `sw.js` — PWA 缓存；**本地开发（BUILD_ID 未盖章）网络优先，部署（盖章）缓存优先**；导航请求忽略 query 并有离线壳兜底。

### 4.2 安全设计（2026-07-31 落地，`1bc63d7` + `53d4a52`）

| 防线 | 实现 |
|---|---|
| 预览报告防伪造 | `listenForPreview` 校验 `event.source === iframe.contentWindow`（沙箱 iframe origin 为 `"null"`，payload 字符串可伪造，**只能**用 source 身份） |
| 打印预览防逃逸 | blob: URL 继承 Studio origin，弹窗前 `target.opener = null`，untrusted 项目直接拒绝 |
| 原型污染防护 | `setJsonPath` 拒绝 `__proto__`/`constructor`/`prototype` 路径段 |
| 乐观锁可靠性 | revision 用 `nextRevision` 单调计数器；Undo/Redo 选择逻辑历史状态但通过 durable CAS 产生新的 revision，不回退 durable head 或复用编号 |
| 信任不可只翻 flag | 「重置信任」物理剥离 script/事件属性/javascript: URL；`validateProject` 从内容重推导可执行标记；themeCss `</style>` 逃逸会降级信任并在序列化时转义 |
| operations 判别联合校验 | `core/operation-schemas.js` 按 `operation.type` 分派 schema，复用 `core/schema.js` 校验引擎；已知类型的缺字段/多字段/类型错误在任何变更执行前统一拦截（`INVALID_OPERATION_SHAPE`），未知类型仍走既有 `UNSUPPORTED_OPERATION` |
| 高层语义工具优先复合选择器而非单表 | `set_column_widths` 的 `tableSelector` 接受逗号分隔选择器，因为真实模板把表头（`.prowheader`）与重复数据行（`.prowitem`）拆成两个独立 `<table>`；只支持单一 `<table>` 会让工具在实际模板上不可用 |

### 4.3 Agent 可观测性（Current）

- 渲染报告带元素级 `issues[]`：`{ code, pageIndex, selector(页内 CSS 路径), rect, text }`，每类上限 20 条；经 `validate_project` 与 `begin_layout_review` 暴露。
- 校验错误路径统一段前缀（`/schema/...`、`/sampleData/...`），UI 据此做可点击跳转，Agent 据此路由修复。
- 预览面板复用同一份 `issues[]`：bridge 在渲染 iframe 内用 `selector` 实时重新测量并画红框（非 postMessage 传坐标，避免滚动/缩放导致的坐标漂移），父页通过 `postMessage` 指令切换开关，不触发重渲染。
- 「Preview and apply」不再用 `window.confirm` 单行文本确认，改为 `ui/diff-view.js` 的并排 diff 面板：LCS 逐行对比每个变更 section（JSON 段先经 `stableStringify` 再对比，避免键序不同被误判为变更），新增行绿色高亮、删除行红色高亮；`trust` 这类非文本伪 section 单独渲染一行说明。取消不调用 `apply_changes`，草稿不落盘；未变更时直接跳过面板显示提示。单侧行数超过 1500 行时跳过逐行高亮（避免 O(m·n) 在超大样本数据上卡顿），仅展示全文。
- 注意：`core/acceptance.js` 会打进 `dist/printform-document.js`，改动后必须 `npm run build:assets` 才对预览生效。

### 4.4 候选项目真实渲染（Current，2026-07-31 落地，TASK.md #12–13）

**决策**：复用现有可见预览 iframe（`#preview-frame`），不新开隐藏 sandbox iframe。用户在 2026-07-31 就这一取舍拍板——放弃"新开隐藏 iframe"的方案，理由是：省掉第二个常驻 iframe/PrintForm 运行时实例的内存与心智负担，并且让人类工程师能实时看到 Agent 提议的候选改动（与已有的 source-edit diff 面板体验一致），代价是需要一套跨 iframe reload 的请求排序机制（见下）。

**架构**：

1. **`CommandBus` 通过依赖注入获得可选的候选渲染器**：`new CommandBus(initialProject, { renderCandidate })`，`renderCandidate(project, revision)` 是一个返回 `Promise<RenderReport>` 的异步函数。不传（现有单测直接 `new CommandBus(project)`、CLI 校验器等无 DOM 环境）时保持原行为——`preview_changes` 退化为纯 schema/业务规则校验，不阻塞、不报错，这是既有"CLI 不产出 `expectedRows`"式优雅降级的延伸，向后兼容零回归（`tests/studio-v2/command-bus.test.js` 有专门回归用例）。
2. **Current renderer owner**: `app.js:installBus()` injects `ui/render-controller.js:renderCandidate` into CommandBus. The controller owns pending requests, tokens and the visible `#preview-frame`; `ui/preview.js` builds the sandbox bridge.
3. **一层跨 iframe reload 存活的请求 token**（`runtime.js` 内部 `generation` 计数器在"整个 iframe 重载"这一级别的对应物）：无论请求来自人类编辑防抖（`schedulePreview`）还是 Agent 的 `preview_changes`/`apply_changes`，发起渲染前先领取一个单调递增 token，`ui/preview.js` 的 `buildPreviewBridge()` 把 token 原样写进两个 postMessage 回执（`rendered`/`error`）；父页 `listenForPreview` 回调按 token 先查 `pending`，命中就是候选请求的回执，未命中再退回既有的按 `revision` 匹配的已提交状态路径。这同时天然满足了 TASK.md 原 #15（"拒绝非本次预览的消息"）的需求——**#15 已并入本项，不再单独存在**。
4. **`preview_changes`**：CommandBus 根据已允许的 semantic operations 生成 candidate，并在 UI 浏览器环境中等待可见预览 iframe 的真实渲染回执；用 `sha256(stableStringify(candidate))`（`core/json.js` 已有）计算 `candidateHash`，按 hash 缓存真实 RenderReport。返回的 validation 携带真实 `issues[]`/`metrics`；无 DOM 环境时只做静态 schema/业务规则校验，并明确不伪造浏览器 evidence。
5. **`apply_changes`**：公共 Agent Contract 4.0.0 只接受已批准 transaction 的 `transactionId`、当前 revision 和同一 candidate hash，不再接受直接传入 `operations[]` 的写路径。Agent 返回通过闭字段投影和会话内不透明引用发布；候选内容、revision、批准状态或 hash 任一不匹配都 fail closed。Studio 内部的结构化控件和 source editor 可以使用内部命令，但不构成公共 Agent API。

**Historical presentation description (superseded by the current controller behavior below)**：候选渲染期间 `#candidate-preview-banner`（`.banner` 复用既有 `#update-banner`/`#restore-banner` 样式）显示"正在预览 AI 提议的改动（未提交）"提示；`pending` 清空时（成功/失败/超时）自动隐藏。下一次真正的 commit（人类编辑或 Agent apply）发生时，`schedulePreview()` 既有的防抖流程会自动把 iframe 刷新回真实已提交状态，不需要额外的"回滚"代码路径；`installBus()` 切换项目（导入/切样本/重置信任）时会拒绝并清空所有仍在等待的候选渲染，避免悬挂 Promise。

Current behavior: the candidate flag is independent of the pending-request map. A successful render alone does not clear it. `restoreCommitted()` clears the flag and schedules committed output; project replacement rejects pending requests and clears candidate state. S09/PROD-04 now records the six-case cancel/stop/late-response, project-replacement and durable-history acceptance; broader draft/save recovery remains PROD-08.

**踩坑记录**：
- 设计阶段曾估计"500 行样本渲染约 1 秒"，属于未经实测的乐观数字——真实测量下，500 行 + 较大字号（13pt）的候选渲染在本地沙箱浏览器里跑到 47 秒以上（`PrintForm.formatAll()` 自身的 clone/measure/place 尚未做 P2/E9 计划中的行高预测量缓存优化，见 ROADMAP.md）。候选渲染的超时不能按这个乐观估计设置——最终定为 30 秒的宽松兜底（current constant: `CANDIDATE_TIMEOUT` in `ui/render-controller.js`），只用来兜"确实卡死了"，不是性能预算；现有已提交状态的 `schedulePreview()` 路径本来就没有超时。500 行默认 9pt 场景仍稳定符合 `100/500-row render budgets` 测试的既有预算（`durationMs ≤ 5000`），说明变慢的是"大字号+大行数"这个不常见组合，不是回归。
- `preview.js` 的 `bridge()` 改名并导出为 `buildPreviewBridge()`，只是为了能脱离 `createStandaloneHtml()`（需要真实 `fetch` 加载 `dist/` runtime，jsdom 单测环境无法解析相对 URL）单独对 token 回显逻辑做单测——纯字符串模板，无 DOM/网络依赖。
- `playwright.config.js` 的 `webServer.command` 是不带参数的 `node scripts/serve-site.mjs`，其默认根目录是 `site-dist/`——一份 `npm run build:site` 生成的**构建快照**，不是 `studio-v2/` 实时源码（对比 `.claude/launch.json` 传了显式的 `"."` 参数，服务仓库根目录实时源码）。`package.json` 的 `test:e2e` 脚本有 `pretest:e2e` 钩子会自动先跑 `build:site`，所以正常用 `npm run test:e2e`（CI 也这样跑）不受影响；只有像调试时那样图快直接执行 `npx playwright test`（跳过 pretest 钩子）才会踩坑——此时只跑 `build:assets` 不够，必须重新跑完整的 `npm run build:site` 让 `site-dist/` 同步，否则 Playwright 测的是修改前的旧代码，且不会有任何明显报错、只是行为对不上（本次意外获得的教训：新功能的 candidateHash 用 `npx playwright test` 直接跑稳定复现 `undefined`，而同一段代码在直接服务仓库根目录的浏览器里工作正常，最终定位到这个快照陈旧问题）。

### 4.5 渲染内容完整性——数量校验（Current，P0-B 部分实现）

`inspectRenderedDocument(doc, manifest, { expectedRowCount })`：`.prowitem` 行由分页引擎克隆后放置、从不像 PTAC/PADDT 那样被词数切分，因此最终 DOM 里 `.prowitem_processed` 的数量必须精确等于 `bindTemplate` 通过 table `data-pf-each` 绑定的行数。不一致（分页引擎丢行或重复行的 bug）报 `ROW_COUNT_MISMATCH`。`runtime.js` 的 `render()` 把 `bound.report.tableRows` 作为 `expectedRowCount` 传入；CLI 校验器（`validate-printform-v2.mjs`）没有真实浏览器渲染上下文，不传该参数，检查自动跳过（不误报）。

**顺序/identity 校验（2026-07-31 补齐，TASK.md #16）**：`binding.js` 的 `expandRepeat` 给每个展开行打 `data-pf-row-index`（源数组下标），克隆穿过整个分页流程（clone/measure/place）后依然保留。`inspectRenderedDocument` 用这个标记做三项检查：`ROW_DUPLICATE_INDEX`（同一下标出现多次）、`ROW_MISSING_INDEX`（某下标从未出现，需要 `expectedRowCount`）、`ROW_ORDER_MISMATCH`（下标序列非严格递增——即使数量和集合都对，两行被交换顺序也能抓到，这是纯数量校验做不到的）。没有 `data-pf-row-index` 标记的旧版导出文档（该属性上线前生成的）自动跳过这三项检查，只保留数量校验，不误报。真实端到端证据来自 `e2e/studio-v2.spec.js`（Playwright 能读取沙箱 iframe 内部 DOM，jsdom 单测做不到这一步——手写脚本重新拼装 Node 全局对象验证过会撞上 jsdom 的 `performance.now()` brand-check 无限递归，遂放弃转而用 Playwright）：真实 45 行发票渲染后 `data-pf-row-index` 恰好是 `[0,1,...,44]`，与源数组顺序完全一致。

**重复区缺失 + 重叠校验（2026-07-31 补齐，TASK.md #17）**：`data-repeat-header`/`data-repeat-docinfo` 是没有逐行例外的全局开关（不同于 rowheader，行级 `without_prowheader` 可以单独豁免）——若模板声明为 `"y"`，每个逻辑页必须真的带着 `.pheader_processed`/`.pdocinfo_processed`，缺失报 `HEADER_MISSING`/`DOCINFO_MISSING`。另外，`.printform_page` 的直接子元素（页头/文档信息/行头/数据行容器/页脚）按设计应自上而下正常块级堆叠，不使用浮动或绝对定位；若相邻两个子元素的矩形发生纵向重叠（后一个的 `top` 小于前一个的 `bottom`），报 `SECTION_OVERLAP`——这正是 KB 记忆里 Crimson 采购单那次"顶部边框与页头网格恰好同坐标、视觉融合"事故的通用化检测版本，不用等人眼发现。两项检查都在真实 Sales Invoice/Purchase Order 样本上验证过零误报，并用人为破坏（剥离 pheader class、注入负 margin）确认了阳性触发（含截图证据）。

### 4.6 布局验收证据（Current，2026-07-31 落地，TASK.md #18）

**问题**：`complete_layout_review` 过去只检查 Agent 传来的字符串集合里有没有 `"full-page-screenshot"`——Agent 完全可以凭空写上这个词，整套"AI 必须先看过再放行导出"的门禁形同虚设。

**Historical geometry-first decision (2026-07-31)**. Current synthetic sessions also support bounded pixel evidence; real-data pixel rejection remains, while durable persistence is the separate PROD-13 gap. 理由链：预览 iframe 是 `sandbox="allow-scripts"` 无 `allow-same-origin` 的不透明 origin，父页读不到它的 DOM，真像素只能在 iframe 内部走 `foreignObject`→`canvas`→`toDataURL`，那条路有 canvas 污染报错风险、字体/图片保真缺陷、单张几 MB，而且**真实数据模式下像素里就是业务数据**，与 §隐私策略「默认不写入任何缓存」直接冲突。但 #18 要防的从来不是"看不看得到像素",而是"Agent 谎称自己看过"——Studio 自己渲染、自己 `getBoundingClientRect` 测出来的报告本身就是事实真相,给它签名即已完整达成防伪造。Agent 想看像素仍可用自己的 CDP 截图工具,只是那不构成证据。

**机制**：`capture_layout_evidence({ expectedRevision, scenario })` 复用 #12 的 `renderCandidate` 注入,把该场景渲染成**未提交候选**。这一点是必须的——如果改用 `set_sample_scenario` 切场景来捕获,那会 commit 并推进 revision,把上一个场景刚签发的 receipt 立刻变成 stale,两个场景的证据永远凑不齐。

`layoutFingerprint = sha256(stableStringify(pageGeometry))`,`pageGeometry` 是每页直接子元素的 class 加矩形。**矩形必须用页内相对坐标**:`getBoundingClientRect()` 是视口坐标,会随滚动位置变化,同一份布局在不同滚动位置会哈希出不同值,指纹就失去意义了。

**fail-closed 三处**:渲染不干净的场景不签发证据(但返回该场景的 validation——这是 Agent 唯一能看到未提交场景真实错误的途径);无渲染器的会话(CLI 校验器、单测)返回 `EVIDENCE_UNAVAILABLE` 而不是伪造一张;任何 mutation/undo 清空整个 receipt store。

**契约破坏**:这是 Agent Contract 2.0.0 唯一的破坏性变更。旧式 `evidence`/`browser`/`scenarios` 字段**即使同时附了有效 receipt 也拒绝**——留着旧路径等于 Agent 仍可自证,#18 的安全目标会归零,不破就没有意义。这与 #14 当时选择不破并不矛盾:#14 时信任目标已由候选真实渲染以非破坏方式达成,而这里没有非破坏的达成路径。

### 4.7 双 runtime attestation（Current，2026-07-31 落地，TASK.md #19）

导出的 trusted 文件内嵌两段可执行 script:document runtime(`pf-document-runtime`)与分页引擎(`pf-printform-runtime`)。此前 `createAttestation` **只哈希前者**——把 `printform.js` 换成一个改过的构建,attestation 依然显示"pass",导入依然 Trusted,没有任何检查会发现。#19 补上 `printformRuntimeHash`,并另存 `cspScriptHashes`(导出 CSP 里 `script-src` 允许的两个 sha256,让校验方能确认策略没被放宽成 `unsafe-inline`)。

两段 runtime 用**不同错误码**(`RUNTIME_HASH_MISMATCH` / `PRINTFORM_RUNTIME_HASH_MISMATCH`)——"换掉分页引擎"和"换掉文档运行时"是两种不同的篡改故事,合并成一个码会让排查时分不清;而且本次之前的存量导出恰好会触发后者,独立错误码让"旧文件"和"被动手脚"至少在信息上可区分。

`browsers` 字段从硬编码 `["Chromium","Firefox","WebKit"]` 改为**由 #18 的 evidence receipt 推导**。旧行为是每一份导出都声称在三个引擎里验证过,不管它实际在哪导出——正是信任模型明令禁止的自我声明。未经审查的导出现在诚实地留空数组;跨引擎覆盖由 CI 的 Playwright 三引擎矩阵背书,不写进每份文件。

**这是 fail-closed 破坏**(范围内已确认):2026-07-31 之前导出的文件不含 `printformRuntimeHash`,重新导入会降级 Untrusted。站内两个试点样本每次构建都重签,不受影响。

### 4.8 P1 工程师面板的统一模式（Current，2026-07-31 落地）

六个结构化面板（Table columns、Print font scale、Page settings、Repeated areas、Brand color、Data contract）都遵循同一套读→写模式，不是各自发明：

- **读**：`core/*-inspection.js`（`column-inspection.js`/`page-inspection.js`）或对应模块的 `current*()` 读回函数（`typography.js` 的 `currentFontBasePt`、`branding.js` 的 `currentBrandColor`）从 `project.templateHtml`/`themeCss` 里描述当前真实值，只读不写；找不到对应字段一律返回 `null`/`[]`，不猜引擎默认值或编造假数据。
- **写**：优先复用**已有的**语义操作（`set_column_widths`/`set_font_scale`/`set_brand_color`）；没有专属操作类型的字段（Page settings 的 `data-papersize-*`、Repeated areas 的七个 `data-repeat-*`）直接用通用 `set_attribute`，每属性一条、同一次 `apply_changes` 打包提交，不为每个简单 data-* 字段都新开一个操作类型。
- **应用方式**：结构化单一用途控件（本节六个面板 + 已有的 locale-select/asset-slot）通过共享的 `preview → approve → apply` helper 提交，不经 diff 弹窗确认；只有原始 JSON/CSS/HTML 文本编辑器走 `ui/diff-view.js` 的并排 diff 确认流程（见 §4.3 的 Apply 前确认机制）。All paths retain transaction/revision/hash checks. Human draft helpers default `requireValid=false`, so an applied draft can remain invalid; trusted export still requires full readiness. Embedded AI proposal approval uses `requireValid=true`.
- **范围纪律**：每个面板都刻意只覆盖两个标准模板实际用到的字段，不覆盖 `src/printform/config.js` 里更大的引擎级配置面（如 `docinfo002-005`/`footer002-005`/PADDT 专属配置），也不做超出单一清晰切片的重设计——Brand color 只做 `.pf-brand` 一处标题色，不是把两个模板里另外十几处硬编码用色都 token 化，因为后者是量级明显更大、更主观的独立设计任务。

### 4.9 Studio 顶栏信息架构（Current）

`.topbar` 是单条 56px 栏（渐变已压平；brand 精简为 `Studio v2 [Protocol 2.0]`，`PRINTFORM STUDIO` eyebrow 全宽移除以让出行内空间）。`.actions` 顺序：`#ui-locale-button`（globe SVG + `#ui-locale-menu` listbox）→ `#inspector-toggle`（图标 `✦`，仅 `body.inspector-closed` 显示，位置固定为第 2 个可见子元素）→ `#editor-toggle` → `#validate-button`（check SVG icon-only）→ `#print-button`（printer SVG icon-only）→ `⋯ More` → `#export-readiness` → `.export-split`。AI Designer 入口仅保留顶部 `#inspector-toggle`；页面不再渲染右下角浮动 launcher。

- **层级**：深色栏上唯一 filled primary 是 `#export-button`（白底蓝字）；其余 secondary 按钮为半透明白 ghost。
- **语言菜单**：`#ui-locale-button` 只显示 globe SVG，`#ui-locale-menu` 使用 `listbox/option` 语义；点击、方向键、Home/End、Esc 和外点关闭均可用，菜单固定定位在按钮下方。隐藏的 `#ui-locale-select` 仅作为现有 UI i18n/change contract 的同步源，不改变五种语言与持久化行为。**`⋯ More`** 弹出菜单只放 `Import HTML`；**`▾`** 拆分箭头弹出 `Export Untrusted`（同一个"其他导出方式"入口，不在 `⋯ More` 里重复）。两个菜单用原生 HTML Popover API（`popover` + `popovertarget`），顶层渲染绕开 `.topbar`/`.actions` 的 overflow 裁剪，Esc / 外点关闭；`ui/app.js` 的 `bindTopbarMenu` 只做定位（fixed，贴触发器下方右对齐）+ 同步 `aria-expanded` + Esc 后回焦。
- **`#export-readiness`** 就绪芯片复用 `.status` / `.status.ready` / `.status.blocked`，由 `status-view.js` 的 `renderQualityView` 在 `#export-button.disabled` 之后同步（`● Ready` / `⚠ Blocked`）；文案刻意区别于预览区的 `#render-status`（"Printable"/"Blocked"），后者位置/文案不变。
- **横向滚动**：`.actions` 的 `overflow-x:auto` + `bindHorizontalWheel` 保留，但 ≥1081px 不再溢出；721–1080px 及移动端作为兜底。`e2e/studio-v2-topbar.spec.js` 断言 1440px 无滚动 + 主动作可见 + `inspectorIndex === 1` + 菜单开合。

---

## 5. 构建与部署

- `npm run build` = 测试 → Vite 打包 `dist/printform.js` → 构建 `dist/printform-document.js`（v2 文档 runtime）→ 生成预览页。
- `npm run build:site` = 上述 + 拷贝白名单目录到 `site-dist/` + 生成三个带 attestation 的试点导出 + 给 `sw.js` 盖 build id（占位符缺失会**构建失败**，防止缓存永不更新的静默部署）。
- `npm run doctor`：一条命令跑AGRUN integrity + unit/build:site + 三个试点样本 `validate:v2`（5 steps），结尾一页 PASS/FAIL 汇总（`scripts/doctor.mjs`，2026-07-31）；刻意不含 e2e，那是 CI 每次 push 都跑的三引擎慢检查。
- `dist/` 不进 git（`.gitignore`），由 CI（`.github/workflows/ci.yml`）构建。
- `.github/workflows/browser-matrix.yml`（`workflow_dispatch` 手动触发，2026-07-31）：在 GitHub Actions 的 Ubuntu runner 上按需复现 `scripts/browser-matrix.mjs` 的完整 88 格矩阵，用于验证发布前的跨引擎收敛在 Linux 上同样成立（已实测 88/88 通过），不进 push/PR 常规门槛。
- 本地开发服务器：`node scripts/serve-site.mjs .`（`.claude/launch.json` 已配置，端口 4174）。
