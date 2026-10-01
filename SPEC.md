# SPEC.md — PrintForm.js 行为规格

> Studio v3 is an independent structured-authoring Pilot. Current scope, architecture and acceptance: [docs/STUDIO_V3.md](docs/STUDIO_V3.md). Its checks do not close v2 release gates.

> This document owns implemented behavior and public contracts. Current means code exists with relevant test or runtime evidence; Target and Backlog do not become Current by appearing in prose. See [ROADMAP.md](ROADMAP.md) and [GOAL.md](GOAL.md) for planned work.
>
> Last reviewed: 2026-09-11. Configuration is owned by the generated [docs/CONFIGURATION.md](docs/CONFIGURATION.md); this file describes existing behavior and does not turn future UX goals into a Current contract. Live task status is in [TASK.md](TASK.md), with the derived view in [PROGRESS.md](PROGRESS.md).

---

## 0. Studio v2 Production Foundation 规格（Current）

### 0.0 Verification evidence and known implementation limits (2026-09-08)

Current-source evidence: `npm run doctor` 5/5, 106 files / 571 tests, local browser matrix 88/88, current-source 13-07 3/3 across Chromium/Firefox/WebKit, and S17/PI-04 supporting cases 17-01..09 at 27/27. The P0 register is 35 Pass, 0 Fail and 0 Not run; PI is 4/6 Done. These results do not claim live Provider reliability, direct-BYOK completion, system print certification, deployment retention or maintainer approval.

Browser verification matrix:

| 场景 | Chromium 证据 | 发布含义 |
|---|---|---|
| Progress Claim | printable isolated preview、无 overflow、截图附件 | PASS |
| 顺序多表 | Valuation → Variation → Materials → Certification，续页只重复 active table header | PASS |
| 数据规模 | 100 / 500 / 1000 行，两次运行 page signature 与 page count 一致 | PASS |
| 纸张 | A4 @ 96dpi portrait (794×1122) / landscape (1122×794)，边界与重复表头检查 | PASS |
| Diagnostics | row-too-tall、overflow、blank、header、footer/page number、signature/total/keep-together、orphan totals | PASS |
| Evidence Pack | approved revision、FormSpec/runtime/preview/export hash、security、page count、browser receipt | PASS |

事务的当前边界：E13 已提供 durable store contract、状态机、lease、CAS、故障恢复和 Evidence anchoring。浏览器默认 localStorage adapter 仍只保证 offline/single-session；跨进程/跨设备必须使用实现 `read/write/compareAndSwap` 的 server backend，且在发布门中声明 `atomicRevisionCas=true`。

### 0.1 FormSpec envelope

单 HTML Protocol 保持兼容；`pf-form-spec` 是可选 `application/json` 区块。当前 registry 字段包括 `version`、`document`（paper/orientation/margins）、`sections`、`components`、`bindings`、`tokens` 与 `pagination`。组件类型由 `studio-v2/core/form-spec.js` 的 registry 约束，重复 ID、未知类型和缺失 sections 必须报错。没有该区块的旧模板走 `legacy-adapter`，不被静默改写。

核心映射：`DocumentHeader→.pheader`、`DocumentMeta→.pdocinfo*`、`DataTable/VariationTable→.prowheader + .prowitem`、`SignatureBlock→signature component`、`PageFooter→.pfooter*`。Agent 修改组件 ID、binding 和 pagination rule；rendered `.printform_page` 只属于派生预览。

### 0.2 Transaction contract

Agent 写路径固定为 `begin_transaction → preview_changes → validate → approve_transaction → apply_changes`。`apply_changes` 必须带 `transactionId` 和与 preview 相同的 `expectedCandidateHash`；Preview/approval/revision/content checks are enforced. Validity is required unless the caller explicitly sets `requireValid=false`; embedded AI approvals use true, while human draft helpers permit false. commit 前先持久化 `COMMITTING` intent，最终 revision 通过 durable compare-and-swap；旧 revision 永远不会被静默覆盖。事务记录包括 `transaction_id`、`form_id`、`base_revision`、`working_revision`、`owner`、`agent_id`、`status/state`、`patches/changes`、`validation_result`、`preview_hash`、`candidate_content_hash`、`approval`、`lease`、timestamps、`commit_result`、`evidence_pack_ref`。

状态值（API `status` 使用兼容的小写值，`state` 提供大写显示名）为：`DRAFT`、`PREVIEWED`、`VALIDATED`、`APPROVED`、`COMMITTING`、`COMMITTED`、`ROLLED_BACK`、`EXPIRED`、`CONFLICTED`、`RECOVERY_REQUIRED`。非法迁移返回 `INVALID_TRANSACTION_STATE`；stale commit 返回 `REVISION_CONFLICT { expectedRevision, actualRevision }`。

Lease 包含 `owner`、`lease_id`、`lease_expires_at`、`heartbeat`。过期 transaction 会变成 `EXPIRED`；takeover 创建新 transaction，不重写旧记录。`renew_lease`、`release_lease`、`takeover_transaction`、`recover_transaction`、`resolve_conflict` 是受限语义 API，不能直接修改存储。

### 0.3 Diagnostics / evidence

每项 render issue 至少输出 `code`、`component_id`、`page`、`measured_size`、`available_size`、`reason` 与 `recommended_action`。当前诊断码包括 `ROW_TOO_TALL`、`ACTIVE_TABLE_HEADER_MISSING/INCORRECT`、`BLANK_PAGE`、`SIGNATURE_SPLIT`、`TOTAL_BLOCK_SPLIT`、`KEEP_TOGETHER_FAILURE`、`ORPHAN_TOTAL`、`FOOTER_MISSING`、`PAGE_NUMBER_MISSING/INVALID`；水平/垂直 overflow 由 acceptance geometry 产生同一类 page/size details。

Evidence Pack 必须绑定 revision、FormSpec hash、protocol/schema/runtime 版本和 hash、validation/page count、preview hash、normalized export HTML hash、security status 与 timestamp。trusted publish 遇 mandatory validation/security fail 必须拒绝。

### 0.4 Durable recovery and evidence contract

`get_revision` 读取 durable head；`get_audit_events` 返回 append-only sequence（`transaction_started`、`lease_acquired`、`preview_created`、`approved`、`commit_started`、`revision_committed`、`conflict_detected`、`lease_expired`、`recovered`、`evidence_anchored` 等）。`recover_transaction` 只依据 durable head 和 commit intent 作三态判定：匹配即 committed、仍为 base 即 rolled back、未知差异即 conflicted。

发布证据链为：

```text
artifact hash ↔ Evidence Pack hash ↔ committed revision
             ↕                    ↕
       FormSpec/preview/runtime  transaction + audit event
```

旧 localStorage journal 不会被删除；首次使用 E13 时以新 durable key 写入，旧记录继续只读可见。localStorage 仍只支持 offline/single-session；跨设备发布必须通过 E13-SERVER 的 atomic backend，不能把浏览器本地存储当成多用户锁服务。

### 0.5 E13-SERVER server-backed contract（Current）

生产服务由 `scripts/transaction-server.mjs` 启动，HTTP API 只接受 `SERVER_COMMANDS` 中的 semantic commands，并要求 server token（生产环境应由部署层替换为正式认证）。数据库是 Node `node:sqlite` 的 WAL SQLite 文件，最低 Node 版本为 `22.5.0`。事务 envelope 与 projection 表在一个 SQLite write transaction 中写入；最终 revision CAS 是真实 SQL 条件更新。

| 数据 | durable representation | 一致性规则 |
|---|---|---|
| form head / revisions | `durable_form_state` + `durable_revisions` | `BEGIN IMMEDIATE`；CAS 失败即 `REVISION_CONFLICT` |
| transactions / leases | `durable_transactions.state_json` + `lease_expires_at` projection | lease 由 server database time 判定，过期后只能 takeover |
| audit | `durable_audit_events.sequence` append-only projection | event id 去重，actor/revision/hash/server timestamp 保留 |
| evidence | envelope `evidence_anchors` + `durable_evidence_anchors` | `(form_key, committed_revision)` 唯一；pack hash 不同则冲突 |

网络/崩溃语义：提交前响应丢失时客户端先查询 transaction；已提交则 retry 返回 `already_committed`，正在提交则返回 `COMMIT_IN_PROGRESS`，不可确认时返回 recovery 状态并 fail closed。服务重启会恢复 `COMMITTING` / `RECOVERY_REQUIRED`；CAS 前故障判定 rollback，CAS 后 head 与 intent 匹配判定 committed，其他情况判定 conflicted/recovery-required。

E13-SERVER 接受测试位于 `tests/studio-v2/server-transaction.test.js`，覆盖真实 SQLite 文件、双 session CAS race、server clock lease、lost-response retry、process crash/restart、network reconnect、Evidence anchor retry; current regression evidence is recorded in the production plan, separately from historical server acceptance.

部署边界：当前只认证一个 writer service 进程管理一个 SQLite 文件。多实例 active-active、外部数据库故障转移、跨设备浏览器 UI 远程 store adapter 和 durable artifact blob registry 属于后续 E15，不允许通过复制服务进程的方式假装已经支持。

---

## 1. 核心引擎规格

### 1.1 输入契约

- 分页目标：`.printform` 容器（同页可有多个，依次处理，其间自动插分页符）。
- 区块 class：`pheader`、`pdocinfo`~`pdocinfo005`、`prowheader`、`prowitem`（含 `prowitem_subtotal`/`prowitem_footer`）、`ptac`、`paddt`、`pfooter`~`pfooter005`、`pfooter_logo`、`pfooter_pagenum`。
- 配置来源优先级：JS overrides > `data-*` 属性 > 旧全局变量（`papersize_width` 等）> 默认值。
- 页码占位：`[data-page-number]`/`[data-page-total]`（逻辑页）、`[data-physical-page-number]`/`[data-physical-page-total]`（物理页）；无占位时自动附加 "Page N of M" 兜底。

### 1.2 行为规则

| 规则 | 说明 |
|---|---|
| 自动执行 | 脚本加载时若文档已就绪立即排版，否则等 `load` + 延迟（移动端 150ms / 桌面 50ms） |
| 防重入 | 二次调用 `formatAll()` 无操作，除非 `{ force: true }` |
| 行级换页 | `tb_page_break_before` 强制该行前换页；PTAC/PADDT 长文切分出的克隆段**不继承**该 class |
| 小计+页脚组合 | `prowitem_subtotal` 后紧跟 `prowitem_footer` 时按组合高度整体测试，放不下整组下移 |
| 行头跳过 | `without_prowheader`/`tb_without_rowheader` 行级豁免；PTAC/PADDT 有独立 `repeat_*_rowheader` 开关 |
| PADDT 后置 | PADDT 行在全部常规页脚之后另起物理页渲染，仅带 logo 与页码页脚，docinfo 按 `repeat_paddt_docinfo*` 过滤 |
| 纸张预设 | `data-paper-size`（A4/A5/LETTER/LEGAL）+ `data-orientation` + `data-dpi` 可代替手工宽高；手工值优先 |
| 长文切分 | PTAC/PADDT 段落按 `*_max_words_per_segment`（默认 200 词）切成多段 |

### 1.3 交付物

- `dist/printform.js` — 单文件 IIFE，零依赖，挂 `window.PrintForm`。
- 兼容旧 ERP DOM：区块 class、`data-*`、处理后 `*_processed` class 均不变（P2 重构的硬约束）。

---

## 2. Studio v1 规格（冻结）

- 模板源 [studio/templates.json](studio/templates.json)；支持导入外部 HTML。
- 数据绑定：mustache-lite 子集 `{{field}}`、`{{{raw}}}`、`{{#section}}`、`{{^inverted}}`、点路径；**不支持** partials/lambdas/注释/自定义分隔符。
- 转义集：`& < > " ' ` `` 6 字符；不配对/错配 section 抛错并显示在渲染错误区。
- 结构模式：加载**原始模板**（占位符可见），区块索引与编辑目标一一对应；行数滑块在 `blocks-ready` 前禁用。
- 导出三种：配置化 HTML（内联 printform.js）、数据绑定包（`PrintFormTemplate.render(data)`）、打印预览（无 bridge）。
- 消息安全：只接受 `event.origin === location.origin` 的 bridge 消息。

---

## 3. Studio v2 规格（Production Candidate，受控范围）

### 3.1 协议 2.0.0 单 HTML 结构

一个自包含 HTML，按固定 id 携带全部区块（详见[协议文档](docs/PRINTFORM_V2_PROTOCOL.zh-CN.md)）：
`pf-manifest`（JSON）、`pf-schema`（JSON Schema 受限子集）、`pf-i18n`、`pf-theme`（style）、`pf-template`（template 元素，JSON Pointer 声明式绑定）、`pf-sample-data`、`pf-attestation`、`pf-document-runtime`、`pf-printform-runtime`。宿主 API：`PrintFormDocument.validate(data)` / `.render(data, options)`。

### 3.2 信任规则

- Trusted 条件：可执行 script 仅限两段白名单 runtime，且 attestation 的 hash 全部匹配——`runtimeHash`（document runtime）、`printformRuntimeHash`（分页引擎）、`contentHash`。两段 runtime 用不同错误码区分（`RUNTIME_HASH_MISMATCH` / `PRINTFORM_RUNTIME_HASH_MISMATCH`），因为"换掉分页引擎"和"换掉文档运行时"是两种不同的篡改。
- attestation 另存 `cspScriptHashes`（导出 CSP 中 `script-src` 允许的两个 sha256）与 `browsers`——后者只列出本会话真正签发过布局证据的浏览器，未经审查的导出为空数组。**不是**固定写入三个引擎名（那是信任模型明令禁止的自我声明）。
- **向后不兼容**：2026-07-31 之前导出的文件不含 `printformRuntimeHash`，重新导入会降级 `Untrusted`（fail-closed，非缺陷）。
- 任何自定义 script、模板 `<script`、主题 `</style`/`<script` → 降级 `Untrusted`；untrusted 时 Agent 写命令被网关拒绝（`UNTRUSTED_READ_ONLY`）、打印预览拒绝、生产导出被 `UNTRUSTED_SCRIPT` 阻断。
- 「重置信任」= 剥离可执行内容 + 重置 flag；validateProject 独立重扫内容（`EXECUTABLE_MARKUP_PRESENT`）。
- CSP：trusted 导出用双 runtime sha256 hash；untrusted / 预览用 `unsafe-inline` 变体；`manifest.assets.allowExternalHttps` 在所有变体中同步打开 `img-src/font-src https:`。

### 3.3 命令契约（Agent Contract 4.0.0）

- 35 个工具见 [studio-v2/core/tool-contracts.js](studio-v2/core/tool-contracts.js)；全部经 `CommandBus.execute` 返回统一 `{ok, result|error{code,…}}`（含网关层 JSON 解析失败 `INVALID_INPUT_JSON`）。Agent 面只发布 semantic operation allowlist；raw source preview 保留为 Studio 内部命令。新增的 transaction/recovery tools 只操作 domain service，不暴露数据库。
- `get_capabilities` 除 `candidateHash`、`candidateRealRender`、`layoutEvidenceReceipts` 外返回 `persistentAudit`、`durableTransactions`、`atomicRevisionCas` 与 `leaseRecovery`。其中 localStorage 可为 durable audit，但 `atomicRevisionCas=false`；只有注入 backend `compareAndSwap` 才能作为多 session 发布条件。`candidateHash` 是契约形状（`preview_changes`/`apply_changes` 响应恒定携带该字段，值可能为 `null`）；渲染器能力仍按当前会话真实注入状态 fail closed。
- **4.0.0 当前写入不变量**是 `begin/preview → approve → apply`：`apply_changes` 必须带已批准的 `transactionId`、当前 revision 和同一 candidate hash；不再接受直接传 `operations[]`。返回值由每条命令的闭字段投影构造，敏感 ID/路径只以会话内引用出现；`complete_layout_review` 仍要求 `evidenceIds`（见 §3.5）。
- 写命令必须带 `expectedRevision`；revision 单调递增且永不复用。Undo/Redo 可以选择逻辑历史中的旧内容，但每次成功导航都通过 durable CAS 产生新的 canonical revision；过期写入返回 `REVISION_CONFLICT`。
- 无实际变化的写命令（locale / asset / **sample scenario** 重复选择）不产生新 revision，不清空已通过的布局审查。
- `set_manifest_value` 的 JSON 路径拒绝原型成员段（`INVALID_OPERATION_PATH`）。
- `operations[]` 中每个元素按 `type` 做判别联合校验（[studio-v2/core/operation-schemas.js](studio-v2/core/operation-schemas.js)，复用 core/schema.js 的受限 JSON Schema 引擎）：已知类型缺字段/多字段/字段类型错误一律 `INVALID_OPERATION_SHAPE`（附首个错误的 path+message）；未知 `type` 仍是 `UNSUPPORTED_OPERATION`。校验先于任何变更执行，失败时草稿不落盘、revision 不推进。
- 支持的 `operations[].type`：`set_manifest_value`、`replace_manifest/schema/i18n/sample_data/theme/template`、`set_asset_slot`、`set_text`、`set_attribute`，以及三个高层语义工具：
  - `set_column_widths({ tableSelector, widths })`：`tableSelector` 可以是逗号分隔的复合选择器（如 `.prowheader, .prowitem`），匹配到的每个 `<table>` 各行各列按位置套用 `widths`；数组长度必须等于该表列数；每个宽度值为 `"N%"`/`"Npx"`/`"Nmm"`/`"Npt"`，或 `""`/`"auto"` 表示该列不设固定宽度（用于 `table-layout:fixed` 下吸收剩余空间的描述类列）。PrintForm 模板常把表头行与重复数据行拆成两个独立 `<table>`（`.prowheader`/`.prowitem`），一次调用即可让两者列宽保持同步。
  - `set_font_scale({ basePt })`：整体平移 `core/typography.js` 的 7 级字号刻度（`--pf-font-minus-3`…`--pf-font-plus-3`，1pt 步进），`basePt` 范围 6–14pt；替换 themeCss 中已注入的旧刻度块，不会重复注入。
  - `set_brand_color({ hex })`：写入 `core/branding.js` 注入的 `--pf-brand-color` 变量（3 或 6 位 hex，正则 `^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$`），仅驱动两个标准模板里 `.pf-brand` 标题文字色一处——两个模板的品牌色其余十几处用法（表头背景、边框、汇总框等）仍是硬编码字面量，未纳入本工具，是刻意收窄的范围（见 EPIC.md E8）。替换 themeCss 中已注入的旧值，不会重复注入。
- Page settings（页面尺寸 `data-papersize-width/height`）与 Repeated areas（七个 `data-repeat-*` 标记）**没有专属操作类型**，经由通用 `set_attribute` 逐属性组成 operations，在同一 transaction 的 preview/approve/apply 中提交（studio-v2/core/page-inspection.js 只读回两个标准模板实际用到的字段）。
- 布局审查：`capture_layout_evidence`（按场景签发证据，见 §3.5）→ `begin_layout_review`（每 revision 最多 3 次，需先有 ready 渲染报告）→ `complete_layout_review`（提交 `evidenceIds`/findings/summary，major/critical open 阻断）；任何 mutation 使审查、渲染报告与已签发证据同时失效。
- 生产导出 readiness = 静态验证 + 当前 revision 渲染报告 ready + 布局审查通过；最终下载永远需要工程师点击。
- `preview_changes` 在浏览器环境下对候选项目做**真实分页渲染**（复用 UI 的可见预览 iframe，不止 schema/业务规则校验）：返回的 `validation` 携带真实 `issues[]`/`metrics`（含 `logicalPages` 等只有真实渲染才有的字段），并附带 `candidateHash`（`sha256(stableStringify(candidate))`）。`approve_transaction` 固定该候选，`apply_changes` 只接受同一 transaction/revision/hash 并复用已渲染报告；缺 preview/approval、候选内容变化或渲染失败均 fail closed。无浏览器上下文（单测、CLI 校验器）时仍能做静态 schema/业务规则 preview，但不会伪造真实 render evidence。

### 3.4 渲染报告与错误路径

- 报告：`{ status: ready|blocked|superseded, validation, binding, metrics, issues[] }`。
- `issues[]` 元素：`{ code: HORIZONTAL_OVERFLOW|VERTICAL_OVERFLOW|CONTRAST_FAILURE, pageIndex, selector, rect{x,y,width,height}, text? }`，每类 ≤20 条。
- `metrics.renderedRows`/`metrics.expectedRows`：实际渲染的 `.prowitem_processed` 数与 `bindTemplate` 绑定数；不一致时 `errors[]` 含 `ROW_COUNT_MISMATCH`（分页引擎丢行/重行的数量级证明，P0-B 部分实现，见 DESIGN.md §4.5）。`expectedRows` 仅在有真实浏览器渲染上下文时出现（CLI 校验器不产出该字段）。
- 每个 `.prowitem_processed` 行携带 `data-pf-row-index`（源数组下标，`binding.js` 打标，穿过整个分页流程不丢失）：`ROW_DUPLICATE_INDEX`（下标重复）、`ROW_MISSING_INDEX`（下标缺失，需 `expectedRowCount`）、`ROW_ORDER_MISMATCH`（下标非严格递增，即两行被换序）。无该标记的旧版导出文档自动跳过这三项，不误报。
- `data-repeat-header`/`data-repeat-docinfo` 为 `"y"` 时，每个逻辑页必须都有 `.pheader_processed`/`.pdocinfo_processed`，否则报 `HEADER_MISSING`/`DOCINFO_MISSING`。每页的直接子元素（页头/文档信息/行头/数据行/页脚区块）应自上而下正常堆叠，相邻元素纵向矩形重叠报 `SECTION_OVERLAP`。
- 错误 `path` 段前缀约定：`/manifest`、`/schema`、`/i18n`、`/theme`、`/template`、`/sampleData`、`/trust`、`/review`；UI 据前缀路由到编辑器（可点击跳转），布局类错误路径为 `/`。
- 预览消息仅当 `event.source === 预览 iframe.contentWindow` 时受理。
- 预览面板提供「Highlight issues」开关（默认开）：iframe 内 bridge 收到 `printform:rendered` 后用 `issues[].selector` 在当前文档实时定位并画红框；父页通过 `{ source: "printform-studio-v2-command", type: "toggle-overlay" }` 指令切换，指令同样只信任 `event.source === window.parent`，切换不触发重渲染。
- 「Preview and apply」的应用前确认是并排 diff 面板（`ui/diff-view.js`），不是 `window.confirm`：按 `preview_changes` 返回的 `changedSections` 逐个渲染，JSON 段两侧都先 `stableStringify` 再逐行 LCS 对比（新增行绿、删除行红），CSS/HTML 段按原始字符串逐行对比；`trust` 变化单独一行说明（如 `trusted → untrusted`）。取消/关闭不调用 `apply_changes`；无实际变更时跳过面板直接提示。单侧 >1500 行的 section 跳过逐行高亮，只显示全文。

### 3.5 布局验收证据（Agent Contract 4.0.0；能力沿自 2.0.0）

- `capture_layout_evidence({ expectedRevision, scenario })`：Studio 把该场景渲染成**未提交候选**（复用可见预览 iframe，revision 不推进），渲染干净时签发 `{ evidenceId, revision, scenario, browser:{name,version}, layoutFingerprint, renderReportHash, metrics, createdAt }`。
- `layoutFingerprint` = `sha256(stableStringify(pageGeometry))`，`pageGeometry` 是每页直接子元素的 class 加**页内相对**整数矩形（相对坐标是必须的：`getBoundingClientRect` 随滚动变化，绝对坐标会让同一布局哈希出不同值）。不含任何业务文本，因此真实数据模式下也可安全保留与嵌入导出。
- 渲染不干净的场景返回 `evidence: null` + 该场景的 validation（Agent 唯一能看到未提交场景真实错误的途径），不签发证据。无渲染器的会话返回 `EVIDENCE_UNAVAILABLE`，绝不伪造。
- `complete_layout_review` 必须提供覆盖 `default` 与 `long-text` 的 `evidenceIds`；旧式 `evidence`/`browser`/`scenarios` 自述字段 → `EVIDENCE_RECEIPT_REQUIRED`（即使同时附了有效 receipt 也拒绝）；未签发的 id → `EVIDENCE_UNKNOWN`；跨 revision → `EVIDENCE_STALE`。审查回执的 `browsers` 由 receipt 推导，不接受 Agent 自述。
- 任何 mutation 或 undo 清空整个 receipt store，旧证据无法为新内容背书。

### 3.6 PWA

- 部署版缓存优先（cache name 含 build id，构建时盖章，占位符缺失即构建失败）；本地开发网络优先。
- 导航请求忽略查询串匹配缓存，离线兜底 `index.html`；页面加载时已有 waiting worker 也会显示升级横幅。
- UI 五语言（en-MY 默认，静态打包；其余动态加载，失败回退英文，不阻断启动）。

### 3.7 Embedded AI Designer: Current controls and known limits

Current implementation provides a collapsible AI Designer panel; visual IA exists, but E14 behavioral acceptance is Partial:
固定 4 层信息架构：`Panel navigation → Current document context → Conversation → Composer`。

- **Layer 1: Panel navigation**：与 Inspector 视图切换器合并为**单条 header**（`.inspector-header`，三个 Inspector tab 共用）：分段式视图切换器（`Designer / Quality / Agent`，保留 `role="tab"` 语义）+ 图标动作簇（`＋ New` / `⟳ Review` / `☰ Sessions` / `⚙ Settings`，窄轨宽度下折叠为纯图标）+ `Close`。冗余 AI identity/status block 不再渲染；`#ai-status` 仍保留为隐藏的 `role="status"` live region；session 管理与删除仍收纳在抽屉；Provider 设置在 Settings modal。
- **Layer 2: Current document context**：固定在 header 下方，展示当前活动文档标题（如 `Sales Invoice`）、版本号（如 `r0`）、Draft history（`#ai-undo-revision` / `#ai-redo-revision` 图标按钮）、状态模式（`Committed` 或 `Candidate preview (rX)`）、排版状态（`Printable` / `Blocked` / 警告数）、Apply mode 选择器（`Auto-apply safe changes` 默认 / `Preview before applying`）、活动选区（默认 `Entire document`）与设计范围选择器（`Scope: All sections / Layout / Table columns / Theme`）。
- **Layer 3: Conversation**：包含 welcome state、建议提示词、对话流、Multimodal layout review card 与结构化 Proposal/Change/Validation cards。
  - **Change Card**：结构化展示变更目标（Target）、实际变更内容（What，包含可测量的 Before → After 或目标值，不伪造不可测量的值）、安全标记（Safety，如安全语义主题变量或边界检查）；
  - **Validation Card**：明确展示验证通过或阻断状态，附带页数与行数指标；
  - **Card-level Undo/Redo controls**: applied/reverted cards use their recorded revision as expectedRevision and check the command result before updating the badge. Complete batch-target and failure acceptance remains PROD-04.
  - Runtime trace（`#ai-trace-panel`，内存清洗元数据）作为 conversation 末尾的可折叠抽屉停靠。
- **Layer 4: Composer**：仅含输入框 `#ai-prompt`、`#ai-send`、`#ai-stop`（快捷键提示落在 `#ai-prompt` 的 `title`）。Apply mode 两种模式均严格执行 `preview_changes → approve_transaction → apply_changes` 的不可变事务与哈希检查（选择器现位于 Layer 2）。
- AI Designer 不得绕过公共 Agent Contract 4.0.0 的 transaction gate。Production export 仍需要当前 revision、render report、layout review 和工程师最终点击。

Known Current limitations:

- Inspector header actions (`#ai-new-session`, `#ai-review-layout`, `#ai-sessions-toggle`, `#ai-settings-button` and `#inspector-close`) use inline SVG icons with preserved IDs, bindings and accessible names; visible action labels remain localized where present, while the `Designer / Quality / Agent` role tabs remain text-labelled.

- The topbar Print preview action is icon-only with an inline printer SVG; its existing `#print-button` click contract and localized `aria-label`/`title` remain unchanged.
- The topbar Validate action is icon-only with an inline check SVG; its existing `#validate-button` click contract and localized `aria-label`/`title` remain unchanged.
- The AI Designer launch surface is topbar-only. The former bottom-right floating launcher is intentionally absent; the topbar toggle remains the single accessible open/restore-focus entry.
- Scope selection is carried into the Agent context and enforced at the command/domain boundary for document, layout, theme, table and component-shaped targets. Theme permits brand colour, Layout permits typography/table layout plus layout-only component patches, Table permits selected-table semantic operations, and Component permits selected-component binding/property/pagination operations; cross-table reassignment is rejected. The UI exposes document/layout/theme plus FormSpec-derived table and component scopes; cross-entry/browser selection evidence and the complete selection matrix remain acceptance work (PROD-01).
- Context consumes render state and document validation while keeping export-only review gates separate: waiting/rendering/candidate are non-final, document errors show Blocked, and `CommandBus.readiness().productionValid` remains authoritative for export controls (PROD-03).
- Ordinary chat and layout-review repairs share the same apply-mode decision: Preview mode leaves the candidate pending, while Auto mode can advance only an explicit low-risk allowlist. Approval, revision and candidate-hash checks still run (PROD-02).
- Current default is auto-apply. The shared allowlist is enforced, while a broader risk taxonomy and the complete retry/late-response matrix remain acceptance work.
- The panel verifies its candidate approval token before using the privileged path. `installAgentGateway()` keeps `executeHuman` only on an app-local UI session created through a private callback; the page-global gateway and ordinary bound sessions expose only `execute`, and registered MCP/WebMCP tools do not expose the privileged path. This closes the concrete public-surface bypass finding, while complete PROD-02/02-03 evidence remains open and the browser is not treated as a hostile-code sandbox.
- Human draft helpers and convenience transactions may use `requireValid=false`; Applied does not imply valid, saved or export-ready.
- `row-limits.js` counts actual table repeats rather than arbitrary nested arrays. `maxRows` is the aggregate bound-table limit and `maxRowsPerTable` is the per-table limit; both default to 500, with 100 logical pages (PROD-05).
- `set_pagination_rule(repeatHeader)` accepts a table-header component ID and writes only its local `data-pf-repeat-rowheader`/FormSpec override; the root repeat flag remains the legacy default, and non-table targets fail closed (PROD-06).
- Recovery cache is best-effort, one localStorage record with a seven-day expiry. Download fallback reports initiation, not confirmed disk persistence (PROD-08).
- Imports use Unknown and clear prior sample provenance. Missing session policy is Unknown; index/runtime stores check policy at transaction admission and reject stale completions. Switching Real/Unknown to Synthetic requires whole-current-document confirmation and a fresh persistence context without old snapshot hydration. These corrections have bounded controls, not complete [data-policy acceptance](docs/STUDIO_V2_IMPLEMENTATION_EVIDENCE.md).
- The runtime sends DESIGNER_PROMPT through each consume input, including Review and resumed turns; a constructor-only systemPrompt was ignored by pinned Agrun. Actual panel and second-request browser captures verify current prompt delivery. Runtime/MCP instructions require restrictive geometry, prohibit Agent raw source and retain scope/reference/commit limits; model obedience is not an enforcement guarantee.
- Standalone page-gateway and WebMCP installation without a host policy getter now defaults to Unknown, and a missing current policy is treated as stale. The missing-policy/no-active-document implementation boundary is fail-closed and covered by the 13-04 browser/unit evidence; complete sink and transition acceptance remains open under PROD-13.
- The asset owner also defaults an omitted resource policy to imported Unknown before template/CSS URL or HEAD requests; restrictive policy is checked before the request and after asynchronous completion. This is a supporting M1 control, not complete sink acceptance.
- The final Provider input owner defaults an omitted data policy to imported Unknown and reconstructs media parts from the validated provenance allowlist; Synthetic pixel evidence therefore requires an explicit Synthetic policy. Runtime/layout transport may bind the same policy context to the actual fetch and rejects stale context before send and after asynchronous response delivery. This is a supporting M3 control, not a live-provider or complete sink acceptance.

Rail 可通过左缘手柄拖拽调宽（`--inspector-width`，320–900px，持久化到 localStorage；双击复位，方向键微调）。以下能力为下一阶段 Target：P1 历史抽屉与搜索、移动端全屏模式增强、P2 preview element 与 change card 双向 highlight。详见 [工程路线图](docs/STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md)。

---

## 4. 质量门（CI / 本地）

| 检查 | 命令 | 当前状态 |
|---|---|---|
| Unit/build health | `npm run doctor` | 5/5 PASS; 106 files / 571 tests |
| 语法检查产物 | `npm run check` | 构建后 |
| Browser/render evidence | `npm run test:e2e` or `node scripts/browser-matrix.mjs` | Current bounded checks include 88/88 local matrix and 3/3 current-source 13-07; release/platform/provider evidence remains open |
| v2 导出校验 | `npm run validate:v2 -- <file>` | 未签名报 `ATTESTATION_MISSING`，签名后 hash 全验 |
| 站点构建 | `npm run build:site` | 含三个带 attestation 的试点导出 |
