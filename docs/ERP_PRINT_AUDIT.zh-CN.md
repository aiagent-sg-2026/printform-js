# ERP 打印代码审计：缺陷与改进清单

日期：2026-10-13。配套 [ERP 支持契约](ERP_PRINT_SUPPORT.zh-CN.md)。

**结论：原代码不能被声明为支持所有 ERP 格式。** 本轮记录所有已发现点，修复可确认的通用缺陷，并补齐已明确业务含义的 PCAR/CCAR。有限审计不可能证明“不存在其它 bug”；业务、法定电子发票、真实 ERP 接口和物理打印分别验收。Production Pilot 状态不变。

## 1. 范围、方法与证据等级

- 逐模块检查 `src/printform.js` 和 `src/printform/` 的全部源模块。
- 检查 v2 schema/binding/runtime/row limits/layout acceptance、contract editor、business rules、导出、samples、HTTP transaction server 与 MCP/CDP 边界。
- 检查 v3 demo catalogue/claims/templates、数据来源/存储/恢复、scenario matrix、validation、save/reopen/import 和对应现有测试。
- 不将 vendor、`site-dist`、历史缓存当作当前实现；没有逐行重审全部 AI/PDF/PWA/平台代码。既有 [生产缺口审计](STUDIO_V2_PRODUCTION_GAP_AUDIT.zh-CN.md)、[v3 文档](STUDIO_V3.md) 和 release register 的未关闭事项继续有效。
- 表中“位置”为**修复前审计位置**；模块拆分后行号可能变化。静态触发路径与实际执行结果分开记录。
- `已修`：实施了修复；本轮验证记录在 §5，不自动授予所有浏览器/纸型/业务类型验收。
- `保护`：明确阻断失败，未实现所有输入的通用渲染。
- `开放`：确定能力缺口或条件风险；未证实的运行现象不能标为已复现 bug。

## 2. 确定实现缺陷：28 项

严重度：P1＝内容/数据完整性、验收绕过或错误成功；P2＝配置/格式/功能失效。不是漏洞 CVSS。

### 2.1 分页引擎：15 项

| ID | 级别 | 原位置与触发条件 | 影响 | 处理 |
| --- | --- | --- | --- | --- |
| R01 | P1 | `segments-ptac.js:28-67` / `segments-paddt.js:30-66` 只取 children；wrapper 混合直接文本与 p | 条款前缀/后缀永久丢失 | 已修：childNodes 按源顺序保留文本、注释、inline markup |
| R02 | P1 | `config.js:278-281` 接受 `paddtMaxWordsPerSegment=1.5`；`text.js:62-76` 用它索引 token | 格式化抛错 | 已修：配置及 splitter 的正整数归一化 |
| R03 | P1 | `pages.js:43-51` 新建裸 root；原 form 携带字体/颜色/class/属性 | 输出继承样式丢失，换行/分页与输入不同 | 已修：保留 presentation context；输出去掉自动处理 class |
| R04 | P2 | `pagination-render-rows.js:61-64` 无条件 active header；skip/PTAC/PADDT 禁重复 | 禁止的表头被加回 | 已修：active-header 遵守当前行 skip policy |
| R05 | P2 | `rendering.js:53-55` 用 repeat flag 控制后续表首次显示 | table B nonrepeat header 整份消失 | 已修：首次出现与跨页重复分离 |
| R06 | P2 | `pagination-render-special.js:67-73` / `pagination-dummy.js:40-52` 未检查全局 dummy 禁用 | subtotal/footer 仍插虚拟行 | 已修：统一全局开关 |
| R07 | P1 | `pagination-dummy.js:41-72` 按配置 10px 算数量，custom dummy 实际 30px | 合计/签字区域越界 | 已修：目标宽度实际测高，溢出 filler 回退 |
| R08 | P2 | `dom.js:26-37` 与 `pagination-dummy.js:20-36` 对完整 table HTML 解析不同 | 根 class/style/DOM 结构不一致 | 已修：单一 dummy parser |
| R09 | P2 | `PrintFormFormatter.js:27` 重读 PADDT config 时传 `{}` | API overrides 被丢弃 | 已修：constructor 接收入口 raw overrides |
| R10 | P2 | `config.js:186-215` 仅归一化少量 boolean；API 传 `repeatHeader:'false'` | truthy 字符串反向启用重复区 | 已修：boolean descriptors 统一解析 |
| R11 | P2 | `pagination-render-rows.js:36-42` 所有 row 高度为 0 时早退 | 可见 header/docinfo 消失 | 已修：无可呈现行走 empty-document chrome 生命周期 |
| R12 | P2 | `rendering.js:15-118` / `helpers.js:125-156` 漏登记 chrome 与 root marker | header/footer/root 的页码停留初值 | 已修：统一登记全部 chrome，marker 包含 root |
| R13 | P2 | `sections.js:39-42` 用 `{}` 存 table IDs；ID 为 constructor/__proto__ | inherited key 阻止表头登记/高度读取错误 | 已修：安全映射与 own-key 语义 |
| R14 | P1 | `printform.js:82-87` 吞每个错误后标完成；formatter 已插输出/改源 | 部分失败被报告为整批成功，留下半成品 | 已修：AggregateError+计数；失败撤销自身输出并保留源节点身份 |
| R15 | P2 | `printform.js:45-49` 全局完成标记与重入早退 | 追加单据不处理；并发 await 提前结束 | 已修：扫描未处理源节点；共享 in-flight Promise |

### 2.2 数据、验收与运行时：13 项

| ID | 级别 | 原位置与触发条件 | 影响 | 处理 |
| --- | --- | --- | --- | --- |
| D01 | P1 | `database-controller.js:130-135` 确认只恢复三个 starter，实际写整个 starterRecords | 已保存业务 demo/A5 被意外覆盖 | 已修：只恢复 invoice/purchase/delivery 三个 ID |
| D02 | P1 | `schema.js:37-53,102` profile 不递归 additionalProperties 子 schema | allOf 等不支持约束被静默绕过 | 已修：对实际执行的子 schema fail closed |
| D03 | P2 | `schema.js:63,95-97` 接受 required 为 string、enum 非数组、multipleOf=0 等 | schema 验收通过后 TypeError 或约束无效 | 已修：支持关键词值形状和数值范围检查 |
| D04 | P2 | `schema.js` const/enum 以 JS identity 比较对象/数组 | 相同 JSON 值被拒绝 | 已修：JSON 结构相等 |
| D05 | P2 | `schema.js:91` uniqueItems 用 JSON.stringify | 键顺序不同的等值对象被当不同值 | 已修：复用结构相等，对象成员无序 |
| D06 | P2 | `schema.js:71-72` 字符串长度用 UTF-16 length | maxLength:1 拒绝单个 emoji | 已修：按 Unicode code point 计数 |
| D07 | P2 | `schema.js:28-29` 宽松 Date.parse；02-30、无时间 date-time | 非法账期日期/格式被接受 | 已修：Gregorian date + RFC3339 date-time；不支持 leap second |
| D08 | P1 | `binding.js:73-83` 每个 repeat 从 0；`acceptance.js:150-169` 全局期待 0..N | 两张正确表 [0,1,0,1] 被误判丢行/重复/乱序 | 已修：table+repeat ordinal+ancestor scope 的身份与 expectedRowsByRepeat |
| D09 | P1 | `row-limits.js:35-40` 跳过 relative repeats；runtime 展开/分页后才查 | 嵌套 2×300 行漏过 preflight 并先耗资源 | 已修：preflight 计算实际 scope 展开；binding clone 前检查预算 |
| D10 | P2 | `data-contract-inspection.js:23-64` 未 escape/decode RFC6901，丢空 token | a/b、a~b、空 key 编辑到错误路径 | 已修：共用 JSON Pointer token 编解码 |
| D11 | P1 | `acceptance.js:40-46` 执行 business rules，`runtime.js:38-53` 不执行 | 相同错误 lineTotal 在独立 HTML 被当有效 | 已修：共享规则/开关；v3 或 businessRules:false 仍不重算 ERP |
| D12 | P2 | `binding.js:9-27` Intl 非法 options，runtime 无 boundary catch | render reject 而不是带定位的 blocked 报告 | 已修：静态与 binding 的 FORMAT_CONFIG，含 pointer/component |
| D13 | P2 | `binding.js:68,85` per-table report 用普通 `{}`；table ID 为 constructor/__proto__ | constructor 计数变成函数字符串，__proto__ 计数无法成为 own field，JSON 报告丢失表计数 | 已修：null-prototype 计数字典，保留序列化后的 own-key 数字；真实复现前后及回归验证 |

## 3. 条件风险、能力缺口与改进：23 项

### 3.1 布局与格式：13 项

| ID | 原证据/条件 | 判定与处理 |
| --- | --- | --- |
| L01 | `pagination-render-rows.js:145-165`、special 只换一次页后 append；单行比整页高 | 保护：最终实测越界抛错并保留原文；未实现任意超高行拆分 |
| L02 | `text.js:17-18,58-62` 用 whitespace 词数；CJK 无空格、长 URL、窄纸或非 p | 开放：不能把 200 words 当 fit 保证；需基于目标几何的合法文本拆分 |
| L03 | segments clone 整张 table，却只拆首个内容 cell | 开放：多 cell/row 的旁列金额/标签会随段重复；需限制结构或显式一份/每段语义 |
| L04 | 源 sections/rows 与目标纸宽不同，chrome/filler 用源高 | 改善：working clone 按目标宽度测量；复杂 CSS/祖先选择器仍需几何验收 |
| L05 | 多表/普通→PTAC 同页切换时 context/预算不逐行刷新 | 开放：不同表头高度及混合上下文完整预算未证明；不能仅测 equal-height tables |
| L06 | 相邻 subtotal/footer 未检查 table ID | 已修：不同 table 不组合消费，保留各自 header/分页语义 |
| L07 | 重复区/最终 footer 大于纸高，body limit 被 clamp 为 0 | 保护：最终 logical page 越界明确失败；未承诺自动压缩/重排任意 chrome |
| L08 | 非正纸宽/高被数值解析接受 | 已修：按现有 default 归一化；无效参数不产生 0/负尺寸页 |
| L09 | sections 只收声明类；根普通 section、重复 chrome、nested prowitem | 开放：任意 DOM 不属于当前协议；需要 source-order/hierarchy 模型或准入诊断 |
| L10 | n-up 仅纵向 DOM 分组，wrapper 宽不表示物理纸型 | 开放：实际多联纸、边距、缩放、打印 CSS/驱动须独立验收 |
| L11 | `repeatPaddt` 无 consumer，文档已有 reserved 标记 | 改进：reserved 不是 bug；UI 应明确禁用/解释，不假称已消费 |
| L12 | `paddtDebug` 仅存字段，无独立日志控制 | 改进：接入既有 debug 或修正说明；不再新增第二套诊断体系 |
| L13 | 自动执行的固定延迟不是 fonts/动态图片稳定保证 | 开放：调用前资源就绪契约；真实字体/图片变化需测，不能从 load 推导稳定 |

### 3.2 ERP 数据、部署与导出：10 项

| ID | 原证据/条件 | 判定与处理 |
| --- | --- | --- |
| E01 | v3 `file-io.js:27-35` project reopen 与 database-model 严格 dataset import 验证边界不同 | 开放：应复用 bounded JSON safety，但不能删除自定义 collection 支持；实际安全后果未验证 |
| E02 | `scenario-matrix.js:20-23` 用 generic family 数据替换 exact kind | 开放：Payment/Receipt/claims/custom fields 缺失；generic matrix 不是全部业务验收；需 kind-specific synthetic fixtures |
| E03 | v2 `sample-scenarios.js:20-32` 假定首数组、numeric no；ProgressClaim no 是 string | 开放：claim row stress 可 TYPE_MISMATCH，多 collection 未覆盖；需声明 per-fixture stress contract |
| E04 | v2 ProgressClaim 金额是 string，无 currency marker | 开放：不受专项 monetary-inspection 覆盖；通用 overflow 仍有效；需货币 semantic marker |
| E05 | `data-source-adapter.js:27-36` 只描述 /items，scalarFields 跳过数组 | 开放：allocations/parentDocuments/nested collections schema 不完整；空数组需要权威 schema |
| E06 | v3 BankPayment/BankReceipt 仅虚构本地 fixtures，用户编辑无真实清算校验 | 开放：真实 ERP 授权、多发票/币种/扣款/银行 settlement 未认证；不应自动修改金额来通过 |
| E07 | HTTP 可非 loopback+empty token，owner/agentId 由 caller header 声明 | 部分已修：非 loopback 无有效 token 拒绝启动；shared-token 内 caller identity 仍不是 authenticated principal |
| E08 | HTTP fault/delay/drop/crash headers 不受 testMode 保护 | 已修：仅显式 testMode:true 生效；普通服务忽略注入 |
| E09 | runtime asset catch 与 pagination await 后缺 generation guard | 已修：每个 await/catch/finish 检查 generation；过期请求不能清空当前 mount/覆盖报告 |
| E10 | 离线 artifact 与首次离线导出不同；allowExternalHttps opt-in 仍允许网络 | 开放：分别测试缓存/导出/资源；networkDisabled 参数不等于对浏览器网络的全局安全保证 |

## 4. 本轮业务补齐与文档改进

- 明确 PCAR＝Progress Claim Account Receivable、CCAR＝Certified Claim Account Receivable（用户定义）。补齐独立 kind、编号、来源单据、三期 fixtures、模板、绑定词汇、选择器和 save/reopen；不是 generic AR 的兼容别名。
- PCAR 保留 ProgressClaim 来源；CCAR 保留 CertifiedClaim 与 application 来源、认证人员/日期和有符号差额。ERP supplies paid/outstanding，打印器不推导收入确认。
- 增加 seed v2 缺失记录迁移；保留已有用户记录。旧 seed v1 已完成不应阻止新增 PCAR/CCAR 数据进入已有浏览器。
- 新 PCAR/CCAR 初始版式在真实浏览器触发越界；根因是长标题占据 auto grid 列、将公司元数据挤到极窄列，source header 本身达到 1446px。最终复用既有 progress-certificate 全宽版式与独立 flow sections，保留全部字段/金额；没有删除 overflow 保护或缩小验收。
- 新增完整 [交易/格式支持规格](ERP_PRINT_SUPPORT.zh-CN.md)，包括销售、采购、收付、claims、其它交易准入、热敏/标签/n-up/横向/离线/多语言/法定电子文档边界。
- 更新中英文入口/API 指南、SPEC、v3 文档和演示验收说明；纠正 legacy v1 集成示例中在 PrintForm runtime 加载前调用 render 的顺序。
- 删除只断言 mocked forwarding 的 overrides 测试，改用批次完成、失败/重试、动态追加的行为回归。新永久测试集中在 consumer-visible 约束和状态转换。
- 新逻辑保持小模块：schema-profile、binding-format、row-integrity、dummy parser、receivable claim fixtures；修改/新增文件保持不超过 300 行。

## 5. 本轮实际验证

### 修复前实际观察

- 真实 Chromium：空自动初始化后添加 NEW-DOCUMENT，再 `formatAll()`，`processedFlagBeforeAppend:true, unprocessedForms:1, outputs:0`，确认 R15。
- Node 真实调用：`newDemoProject('PCAR')` 与 `newDemoProject('CCAR')` 均报 `Choose a defined demo document type`。
- Node/jsdom：additionalProperties unsupported keyword/profile、required shape、const/enum、uniqueItems、Unicode、date/date-time 均观察到原缺陷；required 导致 TypeError，Intl 导致 RangeError。
- 恢复实际写入 52 个记录，包括 BankReceipt 与 CompactA5；不是三个 starter。
- 两张合法表实际触发 ROW_DUPLICATE_INDEX / ROW_MISSING_INDEX / ROW_ORDER_MISMATCH；错误 lineTotal 的 standalone validate 实际返回 valid:true。
- 旧 generation 的 asset rejection 实际清空新 mount；该复现中新结果自身因缺 title 为 blocked，不表述为“已复现 ready 被覆盖”。

### 修复后结果与发布边界

验证完成于 2026-10-14；仅针对当前本地工作树，不是发布证书。

| 执行 | 实际结果与覆盖 |
| --- | --- |
| 全量集成 `npm run build:site` | 211 个测试文件 / 1,899 项通过；随后发现 D13 并单独修复，因此该全量计数不冒充最终 D13 代码的全量重跑 |
| D13 最终针对性回归与重建 | binding/repeat-integrity/row-limits/runtime/acceptance：**5 文件 / 36 项通过**；`build:assets`、preview 和 site 重建完成。真实报告由 constructor 函数字符串、缺失 __proto__ 变为两个 own numeric count=2、total=4 |
| 三引擎 targeted E2E：renderer-integrity / active-table-pagination / core-pagination / golden-pagination / studio-v3-receivable-claims | **67 Pass，2 Skip**；Chromium/Firefox/WebKit。两个 Skip 是仅适用于 Chromium 的精确字体分布参考，不计为通过 |
| 三引擎 business-template + retained seed migration E2E | **6/6 Pass**；既有商业/项目/claim 类型加 PCAR/CCAR，64 行 invoice 分页、独立导出和保留用户编辑的 seed 升级 |
| 真实 Chrome Studio | CCAR 4 行 / 2 页、current layout passed；切换第二期保留 CERT 来源、ERP 总额/余额及认证差额；可见页面已截图检查 |
| 实际 source HTML 分页 | PCAR、CCAR、SalesInvoice、PurchaseOrder、PurchaseInvoice、BankPayment、BankReceipt 均有成功结果；PCAR/CCAR 行索引 0..3 完整，标题/金额 bounding boxes 未越界 |
| 实际失败批次 | 500px 行放入 100px 纸高：AggregateError report 为 1 成功 / 1 失败；原 HTML、节点身份和 listener 保留，失败完成标记为 false |
| 实际 HTTP | 非 loopback 无 token 返回 SERVER_AUTH_REQUIRED；普通模式携带 drop/delay 注入头仍 200/ok，testMode 路径由真实 HTTP 回归覆盖 |
| 实际 Node/jsdom | unsupported nested schema/重复对象/非法日期被拒绝，相同 JSON const 和单 code-point emoji 被接受；七类业务 binding 无错误 |
| 实际 PDF 文本 | 64 行 fictional campus invoice 的 Chromium A4 PDF 为 7 页；PDF.js 实读页码依次 Page 1..7 of 7，最后页含 Invoice total。临时解析脚本在完成读取后使用了不存在的 document.destroy，清理阶段报错；不将该脚本 exit code 标为通过 |

首次 integrated run 为 13 Fail / 1,884 Pass：修复 schema 生成 helper 的 own required:undefined、race fixture 的 BLANK_PAGE，以及过期的 agent digest review；删除 incidental wording assertion。五项 5s timeout 保留为首次执行记录；独立实测 500 行绑定约 789ms、replace+undo 约 164ms，后续默认超时下全部通过，未提高超时或缩减行数。

首次 E2E 的 69 个执行未启动（本机缺 Playwright browser executables），不是 69 个打印行为失败；安装 Chromium/Firefox/WebKit 后执行上述三引擎结果。不将此前启动失败或已知 overflow 重标为 Pass。

复现命令：

```sh
npm run build:site
npx playwright test e2e/renderer-integrity.spec.js e2e/active-table-pagination.spec.js e2e/core-pagination.spec.js e2e/golden-pagination.spec.js e2e/studio-v3-receivable-claims.spec.js --workers=1
npx playwright test e2e/studio-v3-boss-demo.spec.js --grep 'all business templates|catalogue seed migration' --workers=1
```

Playwright 截图、HTML 与 Chromium PDF 写入各 case 的 `test-results/`；该目录会被后续 run 重置。测试文件与上述执行统计是可重跑证据，不能把临时输出目录当永久归档。

物理打印机、真实 ERP API、用户账务规则、live AI Provider、法定签名/税务接口、完整 OS×browser×paper 矩阵未认证。现有 v2 claim long-text 已知 overflow 仍保留 blocked，不通过改小测试或隐藏诊断给予通过。

## 6. 改进优先级与退出条件

| 优先级 | 改进 | 退出条件 |
| --- | --- | --- |
| P1 | exact-kind 业务压力 fixture 与实际多表/nested collection | 每一 mandatory kind 的 source/text/amount/order 守恒、row identity、0/1/45/100/500/long 场景适用性明确 |
| P1 | 多 cell 长文与超高 section 准入 | 不重复金额/标签；支持合法拆分或带定位的 blocked，原文保留 |
| P1 | production ERP data source | 服务端真实身份/tenant/row authorization、币种/核销/认证 provenance；不把 shared token+headers 当身份体系 |
| P1 | 字段/金额/日期业务契约 | 真实脱敏 PCAR/CCAR、收付/采购/税务样张与 ERP 计算规则，日期/币种/税额基准明确 |
| P2 | 目标宽度与多表 chrome 几何 | 不等高 headers、footer、PTAC/PADDT、根继承样式、窄纸、横向、CJK/RTL 全部实际测量 |
| P2 | schema discovery 与 import safety 一致 | /items 之外的 collections、空数组权威 schema、特殊 RFC6901 key 与 bounded safe JSON |
| P2 | PDF 与 native print 验收 | 预览/独立 HTML/PDF 内容一致，真实纸型和驱动审核；标签扫描和切纸另测 |
| P3 | reserved/debug 配置及维护文档 | UI 不提供无效承诺；配置单一事实来源，文档/知识库与验证状态有可追溯 provenance |

网络研究的原始链接与依据在 [支持契约 §8](ERP_PRINT_SUPPORT.zh-CN.md#8-网络研究与来源)。规范/供应商文档不能为本代码授予实际通过状态。

## 7. Globe3 claim 契约后续修正（2026-10-14）

- 依据内部 KB 和公开一手资料补充 [业务与导入契约](ERP_CLAIM_BUSINESS_CONTRACT.zh-CN.md)。`entp_pbill` 为 PCAR，`entp_pcar` 为 CCAR；parent pointer 与同单据 financial-tab FK 明确区分，服务器授权/非删除过滤仍是上游责任。
- 新增纯 raw CCAR financial-tab adapter 及项目 creator；collection 为 `/financialRows`，不伪造 `scm_sal_data` 商品行。支持已知十槽 main 和限定财务 subsections；未知、缺失、冲突及不支持 variant 明确拒绝，不表示所有 raw ledger 数据可导入。
- Canonical PCAR creator 要求 `sourceType=entp_pbill`、显式 prior-certified/stored-last-claim profile、精度、行与 summary 金额；不提供完整 raw PCAR 数据库适配。corrected fictional PCAR 基准改为前期累计认证，retention/on-hold 按 movement 展示，本期净额不重复扣减。
- 余额缺失保持缺失；certificate/application total 与 provisional balance 不自动认定为 booked AR，accounting recognition 未评估。payment terms 保留交易快照，不从客户主档推导 dueDate。
- 金融打印字符串是不可变投影快照；ERP 金额/精度变化须刷新输入后重跑 creator，raw JSON 编辑不重生成字符串。Portable project Open/save/export 与仍要求 `items` 的 legacy dataset workbench 分开，不为后者授予 raw ledger 验收。
- corrected-basis migration 新增独立虚构记录，保留用户旧记录/编辑；dataset 匹配核对 kind、basisProfile、collection。normalizer precision 0..6，Studio creator 六币种白名单；Production Pilot、无 live ERP/会计/物理打印认证的边界不变。
- 当前集成验证：`npm run build:site` 完整通过 **215 files / 2,022 tests**，包含新 adapter、project、basis migration 行为回归；site/runtime/agent release gate 构建成功。`npx playwright test e2e/studio-v3-globe3-claims.spec.js e2e/studio-v3-receivable-claims.spec.js --workers=3` 在 Chromium/Firefox/WebKit **12/12 passed**，实际执行 Open → save/reopen → offline HTML export、三位金额、完整行顺序与越界检查，并生成 Chromium PDF。
- 独立真实 Chrome smoke：Node creator → standalone exporter → sandbox iframe 的 CCAR 输出 `ready`，17 行、2 页（各 750×1079）、`SGD 3790.471` 保留三位、`overflowElements=0`、`verticalOverflowPages=0`，已查看完整两页表面。输入为自行编造数据，证明映射/渲染，不是 live ERP、客户样张或物理打印认证。
- 初次新增 creator smoke 揭露内部 camelCase field ID 不符合受控设计规则；已统一生成合法 ID，含可选 paid/outstanding 字段，并由上述项目生命周期回归覆盖。
- 用 PDF.js 实际读取生成的 Chromium PDF：CCAR **2 页**，`SGD 3790.471`、`SGD 0.000`、`SGD -61.200` 和 `2026-08-18 / 2026-08-01 / 2026-08-15` 保真；PCAR **1 页**，`MYR 5028.221` 与 `2026-08-02` 保真。通用 PDF 文本 reader 对日期出现错误字符映射，已用真实 PDF.js textContent 区分工具提取问题与文件内容，未掩盖产品错误。


## 8. Raw PCAR / SO work-done（选项 1 独立验收）

- 从跨 KB 原始 schema 和已核验 CFML 行为建立 [raw PCAR 契约](ERP_RAW_PCAR_WORK_DONE.zh-CN.md)：两种精确 AR line links、quantity/fraction 语义、d/d0 numeric profiles、`idcode` 与非唯一 group key、`extnamt_orig_forex` 与 distributed 区分。
- latest eligible supplied prior certificate 与 stored Last Claim 各有明确基准；缺 prior line 拒绝，只有显式新工作声明可归零；gross movement 不伪装净应付或 booked AR。
- **隔离选项 2/3** 后 `npm run build:site`：217 files / 2,072 tests passed；raw PCAR 三浏览器 Open/save/reopen/offline export：6/6 passed。实际截图与 PDF.js 保真证据见新契约 §8；不是 live ERP 或硬件认证。


## 9. Payment / Receipt（选项 2 独立验收）

- 依据 ERPNext/Odoo 官方支付/核销说明实现 [canonical settlement](ERP_SETTLEMENT_BUSINESS_CONTRACT.zh-CN.md)，不是猜测 ERP raw fields。现金流、来源现金、invoice applied/cleared、cash applied、remaining 与 unapplied、费用/扣款/折让/FX 分开标示，金额各自声明币种与精度。
- 使用 `/printRows` 事实集合；空 allocation 的真正预收预付没有假商品行、发票、已收余额或审批。保留来源单据、状态与 bank snapshot；打印不使付款自动过账、到账或核销。
- **隔离选项 3** 后完整构建 218 files / 2,132 tests；三浏览器四种业务旅程 12/12 passed。实测截图与四份 Chromium PDF.js 金额/日期保真证据见契约 §8；仍为 Pilot。

## 10. 多格 Unicode 续片与物理拼版（选项 3 独立验收）

- 用 DOM Range 与实际纸面预算替代 first-cell whitespace 克隆；PTAC/PADDT 和普通超高行独立拆分并行格，保留 grapheme、inline、金额/短字段及显式 split/first/last/repeat。身份必须完整、连续、同组且数量一致；物理片仍逐一检查越界。
- 本轮修复的产品缺陷：SVG tag name 大小写导致原子资产重复；已耗尽固定高度段落被带入下一 Range；intrinsic table/cell 宽度阻止窄纸重排；transform-only 拼版的屏幕正确但 PDF 页脚跨页。实际 PDF 用布局缩放 `zoom` 修复，不靠 clip 或删除页脚。
- 旧公开 runtime 的同一 260×180px CJK/RTL 四格输入因高度 2706px 拒绝；当前真实 Chrome 输出 20 页、最高 168px、各格文本守恒、金额一次。已检查实际表面。
- 完整 `npm run build:site`：**221 files / 2,174 tests passed**。七组相关三引擎 browser journeys：**112 passed / 2 intentional PDF-only skips**；含 options 1/2 和原 claim 生命周期回归。
- 实际 Chromium PDF：四联 2 页、三联 3 页、Letter 双联 4 页、混合 custom/Letter 4 页；逐页 ID/金额恰好一次，纸型尺寸正确。不能用 wrapper 数量或 screen bounds 代替此检查。
- 配置素材的重复页码缺失与字形高于固定 chrome 另行纠正，未把它们伪报产品缺陷或改变 nonrepeat 默认；所有金额/几何/页数断言保留。源码与详细事实见[复杂分页契约](ERP_COMPLEX_PAGINATION.zh-CN.md)。
- §2/§3 的历史审计状态与计数保留为当时快照；本节关闭实测适配/多格续片/物理 n-up 的限定缺口，仍不授予任意 DOM、多 row/rowspan、全部语言字体或打印硬件认证。

