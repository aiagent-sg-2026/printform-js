# ERP 打印支持契约

审查日期：2026-10-15。状态：**Production Pilot，不是全部 ERP 格式、法定发票或打印机认证**。

问题与改进清单、实际验证结果见 [ERP 打印审计](ERP_PRINT_AUDIT.zh-CN.md)。本文件区分“可绑定和分页”“现成业务示例”“真实业务验收”，不得混为一个 supported 标志。

## 1. 职责与边界

- `src/printform.js` 是 HTML 分页入口，不是 ERP 账务引擎。业务类型不能通过发票标题或布局家族猜测。
- v3 的 `invoice`、`purchase`、`delivery` 是三个**布局家族**；`document.kind` 是独立的**业务单据类型**。
- 业务数据由 ERP 授权、计算和输出；打印器绑定、格式化、分页并检查布局。更换币种不代表进行汇率换算。
- 编辑器的 BEGIN/PREVIEW/APPROVE/APPLY、revision/CAS/lease 属于模板编辑事务，不是 ERP 会计过账、银行支付或数据库提交。
- 当前数据源是浏览器本地的虚构演示库。没有生产 ERP API、客户租户授权、SQL 查询接口或支付能力。
- 新业务类型应复用 JSON Pointer、schema profile、FormSpec 和分页器，不另建专用打印引擎，不按交易名称堆叠分页分支。

## 2. 明确的业务类型

以下目录及明确 canonical 契约提供模板和虚构数据；可供开发/打印验证，不证明真实 ERP 会计正确性。六种收货/退货/调整/现金退款通过专用 creator 导入；另有严格锁定 ERPNext v15.0.0 的原始退货 profile，未冒充所有版本或 catalogue 内置模板。

| 类型 | exact `document.kind` | 打印语义与约束 |
| --- | --- | --- |
| 销售报价 | `SalesQuotation` | 有效期、报价条款、数量、价格、折扣、税和总额；不是应收余额 |
| 销售订单 | `SalesOrder` | 来源报价、订单范围、状态；不能当成已交付或已开票 |
| 销售订单确认 | `SalesOrderConfirmation` | 被确认订单、承诺交付日期、确认状态 |
| 送货单 | `DeliveryOrder` | 订购/实发/未交数量、目的地、承运与发货参考 |
| 送货确认 | `DeliveryOrderConfirmation` | 实收日期、收货人、验收状态；示例不是有效签名 |
| 销售发票 | `SalesInvoice` | 实际交付来源、行金额、税、票面总额；付款状态不代替 outstanding |
| 采购订单 | `PurchaseOrder` | 供应商、收货地点、订单金额、审批；PO 不等于所有采购交易 |
| 采购发票 | `PurchaseInvoice` | 来源 PO、供应商发票号、应付票面额 |
| 收款凭证 | `BankReceipt` | 客户、银行参考、核销、剩余发票余额、未核销预收款 |
| 付款凭证 | `BankPayment` | 供应商、付款参考、核销、未核销预付款、审批 |
| 企业项目 | `EnterpriseProject` | 合同来源/价值、项目期间、负责人、项目范围 |
| 进度申请 | `ProgressClaim` | 前期/本期/累计估值、保留款、申请期间 |
| 认证申请 | `CertifiedClaim` | 来源进度申请、认证人员/日期、申请与认证差异 |
| 进度申请应收 | `PCAR` | **Progress Claim Account Receivable**；申请阶段应收，不是认证金额的别名 |
| 认证申请应收 | `CCAR` | **Certified Claim Account Receivable**；认证阶段应收，保留认证和来源申请关联 |
| 通用应收申请 | `AccountsReceivableClaim` | 独立的通用虚构示例，不作为 PCAR/CCAR 兼容别名 |
| 通用应付申请 | `AccountsPayableClaim` | 来源采购发票的通用示例，不替未定义缩写赋予业务含义 |
| 采购收货 | `PurchaseReceipt` | accepted/received/rejected、UOM、库存 inflow；不是供应商发票 |
| 采购退货 | `PurchaseReturn` | 原收货单/原行、returned、库存 outflow；应付调整另用 DebitNote |
| 销售退货 | `SalesReturn` | 明确库存 none/inflow 与应收 none/decrease；原发货-only 与 Sales Invoice return 区分，不重复入库或猜测应收冲减 |
| 贷项 | `CreditNote` | 明确 receivable/payable decrease；库存退回须另外显式声明 |
| 借项 | `DebitNote` | 明确账款方向；supplier 的 ERPNext decrease/Odoo increase 不按标题推定 |
| 现金退款 | `Refund` | 明确 customer outflow/supplier inflow 与退款依据分配；不是 vendor credit-note 名称别名 |

`PCA`、`PCAP`、`CCAP` 仍无已确认定义，不能由 PCAR/CCAR 推导。PCAR/CCAR 的全称由用户在本次任务中明确提供；它们不是由网络检索推定的行业标准代码。

### PCAR / CCAR 数据与金额

入口：`newDemoProject('PCAR')` / `newDemoProject('CCAR')`，通过现有 New 对话框选择；不是只改标题的发票。

Globe3 实际输入另见 [PCAR/CCAR 业务与导入契约](ERP_CLAIM_BUSINESS_CONTRACT.zh-CN.md)：raw CCAR 支持限定 financial-tab normalization 与 `/financialRows` 项目；[raw PCAR / SO work-done](ERP_RAW_PCAR_WORK_DONE.zh-CN.md) 提供精确来源 join、显式 quantity/fraction 与 Previous basis 的 gross projection，净额仍可由 canonical PCAR 输入；不宣称完整 raw PCAR main financial 或所有版本适配。下表是 catalogue 示例字段，不能代替 raw schema。

| 路径 | 含义 |
| --- | --- |
| `/document/kind`, `/document/number`, `/document/date`, `/document/currency` | 业务类型、编号、日期和币种 |
| `/project/name`, `/project/contractReference`, `/project/contractValue` | 项目与合同上下文 |
| `/claim/period`, `/claim/periodStart`, `/claim/periodEnd` | 申请期间 |
| `/claim/sourceDocumentId`, `/claim/sourceDocumentKind`, `/claim/sourceDocumentNumber` | PCAR 指向 ProgressClaim；CCAR 指向 CertifiedClaim |
| `/claim/stage`, `/claim/direction` | application / certified；receivable |
| `/items/*/{previousWork,currentWork,cumulativeWork,retention,amount}` | 原申请/认证行的估值、保留款及净額 |
| `/summary/{previousClaim,currentClaim,cumulativeClaim,retention,tax,total}` | 不同基准的金额必须明确标示含税/未税 |
| `/summary/{paidAmount,outstandingAmount}` | ERP 提供的已收与阶段余额；provisional claim balance 不自动等于 booked AR |
| `/certification/{applicationId,certifiedBy,date}` | CCAR 的来源申请与认证上下文 |
| `/summary/{applicationAmount,certificationAdjustmentAmount}` | CCAR 申请含税额与“申请减认证”的有符号差异；差异不保证恒为正 |

示例保留三期申请和独立认证历史；corrected PCAR 明确采用前期 CCAR 累计认证为 Previous，本期估值/retention/on-hold 为累计值减前期认证的 movement，不再扣一次前期认证。原“直接保留来源值”的说法只适用于已明确口径的 ERP 输入，不用于证明旧示例 previous-application 基准正确。示例 paid 为 0，不表示真实余额默认未付款；真实 API 缺 paid/outstanding 时保持缺失。PCAR 和 CCAR **不能相加当成两笔新增收入**；打印不判定收入确认、应收入账或税务。

首次升级只补齐缺失的示例 ID，不覆盖用户已保存记录；Restore starter datasets 仅恢复三个 legacy starter，不重置全部业务示例。

corrected-basis migration 使用独立标识的虚构数据，不覆盖用户记录；dataset 选择同时核对 kind、basisProfile 与 collection。Studio creator 仅支持六币种，金额 precision 0..6；金融打印字符串是投影快照，改 raw JSON 不自动重算，金额/精度变化应刷新 ERP 输入并重跑 creator。Portable project 可 Open/save/export；旧本地 dataset workbench 仍要求 `items`，未认证用于 raw ledger datasets。具体 API、限制和来源见业务契约。

## 3. Payment / Receipt 不能仅换发票标题

生产模板至少应声明：付款方向、对象、日期、凭证号、付款方式、账户/币种、银行/支票参考、多来源单据核销、已核销额、未核销额、来源单据余款、审批。

- 预收预付允许无发票核销；partial 与 full settlement 必须区分。
- 一个凭证核销多张发票时，逐项保留来源 ID、币种、核销和余额；明细完整性检查不能只数一个 `/items` 数组。
- 手续费、扣税、折让、汇差需要独立标签和 ERP 计算结果，不能塞进商品税或默默调整总額。
- 已实现 [canonical 收付款契约](ERP_SETTLEMENT_BUSINESS_CONTRACT.zh-CN.md)：多发票、独立 invoice/cash currencies、partial/full、空 allocation 的纯预收预付，以及 ERP supplied fees/withholding/discount/FX；每个金额各有精度和 provenance。旧 catalogue 仍是较小示例，不能认证真实银行支付、全部 ERP raw fields 或所有会计组合。
- 收款 Receipt 与采购收货 Purchase Receipt 是不同业务；当前 DeliveryOrderConfirmation 不能冒充完整采购收货契约。

## 4. 其它交易的准入

必须允许客户按现有模板/绑定协议扩展，而不是把示例目录当成封闭 ERP 枚举。[六种新增 canonical 契约](ERP_TRANSACTION_BUSINESS_CONTRACT.zh-CN.md) 已明确身份、原单、数量/币种/精度/provenance、独立库存与账款方向和真正现金退款；上游提交、原单可退余量、税务/银行认证仍不在打印器内。其它下列交易需单独字段与验收：

- self-billed 发票与调整、尚未声明语义的其它交易；不以已有 CreditNote/DebitNote 推定任何地区的法定电子文档。
- 库存调拨、领料、生产、批号/序列号、仓位和条码标签。
- 对账单、账龄、付款通知、总账凭证、工资/人事、费用报销。
- 合同变更、保留款释放、进度/认证差额、抵扣与负额修订。

HTML 可表示这些内容不等于本仓库已有业务 schema、完整样张或通过生产验收。法定 e-Invoice JSON/XML、UBL、签名和 API 提交是外部 ERP 功能；打印一份 HTML/PDF 不能替代它们。

## 5. 格式能力与验收界线

| 格式 | 当前实现/约定 | 尚需独立证明 |
| --- | --- | --- |
| 自定义 HTML/CSS | v1/v2 固定 section/row 协议；v3 受控布局模型 | 任意 DOM 层级、任意 CSS 排版、普通未声明节点不会自动成为可打印 section |
| A4/A5/Letter/Legal | 已有纸张参数和预设 | 目标浏览器/PDF/驱动的实际物理尺寸、边距和缩放 |
| 横向/自定义尺寸 | 配置层可表示 | 长表头、页脚、窄宽度重排的真实几何 |
| 连续页/多表 | 重复区、表 ID、行身份、逻辑页码 | 不同表头高度、嵌套重复、合计/签字区边界 |
| 热敏票据/标签/连续介质 | [特殊纸型矩阵](ERP_SPECIAL_PAPER_ACCEPTANCE.zh-CN.md)：58/80mm、100×70mm 标签、210×140mm 有限连续页，三引擎 direct/offline 24/24；8 份真实 PDF | 不可打印区、驱动/DPI、原生 endless spool、切刀、穿孔/传感器、扫码；无 ESC/POS/ZPL |
| PTAC/PADDT/普通超高行 | DOM Range实测多格、多tr/rowspan/colspan窗口；保留inline、grapheme、身份及split/first/last/repeat；见[多行续片](ERP_MULTIROW_CONTINUATION.zh-CN.md) | 任意富文本CSS、嵌套table、超大原子资产及全部字体；原子失败仍阻断，不重复金额 |
| n-up | 校验未缩放逻辑页后，真实 sheet grid、统一比例、输出专属纸型规则与部分末页 | 浏览器 PDF 与目标打印机分别验收；设备不可打印边界/驱动不由 wrapper 数量认证 |
| 离线 HTML | runtime/数据/资源内联；可独立打开 | 首次离线导出与缓存完整性另测；允许外部资源的 opt-in 不能宣称完全断网 |
| PDF | 浏览器打印产物，可检查文本与页面 | 浏览器 PDF 不是 PDF/A、电子签章、法定票据或物理打印机认证 |
| 多语言与日期 | 文本、Intl locale/currency/timeZone；实测 CJK/RTL 多格续片与 grapheme 保留 | 全部字体、字型嵌入、语言组合、账期日期及货币精度业务规则 |

支持的超高行按实际纸面预算生成可审计续片，不重复金额/短字段；不可拆内容或重复区超过可用宽高必须 **blocked/抛错并保留原文**。不能裁切、悄悄缩小文字或宣称全部任意格式成功。页眉/页脚固定高度必须容纳目标引擎的实际字形边界；重复页码需显式启用相应 repeat 配置。

## 6. API 完成与错误语义

```js
try {
  const report = await PrintForm.formatAll();
  // report: { formattedCount, failedCount: 0 }
  // 这里只表示本批格式化完成；仍需查看布局报告和真实打印预览。
} catch (error) {
  // AggregateError.errors：本批单据错误；error.report：成功/失败数量。
  // 部分单据可能已成功；失败单据保留，不得把整个批次标为完成。
}
```

- 不再由“全局已处理”标记跳过后来追加的 `.printform`；成功已移除源节点，扫描只处理尚存在的源单据。
- 并发调用等待同一批 Promise。运行期间改变待处理 DOM 需等待当前批结束再调用；不提供自动 DOM 监听或调度器。
- `{force:true}` 仍可用于现有调用，但不是处理新增源节点的必要条件，也不会自动重建已分页的源数据。
- `format(node, overrides)` 成功返回输出容器；失败抛错并撤销自身输出。主配置/PADDT 同时使用原始 overrides 的既有优先级。

## 7. 每个真实 ERP 模板的验收要求

1. 脱敏 JSON、字段类型/必填、币种精度、日期/时区、权限与来源版本；保留原始 ERP 计算值。
2. 0/1/45/100/500 行、长文本、CJK/RTL、空/缺失字段、负数、巨大金额、0/2/3 位货币；测试适用与不适用都要记录。
3. 多表/嵌套 scope 分组验证行身份、顺序、不丢不重；核销和前期/本期/累计不混算。
4. 表头首次出现与续页重复分别验证；页眉/页脚/root marker 页码、合计、条款、签字区无越界/裁剪/空白末页。
5. 在目标宽度测量实际布局，预览和独立导出的文本/金额/顺序/页码一致；超高行返回明确失败。
6. Save/reopen、导入、显式导出、数据切换、Undo、旧异步渲染不能污染当前版本。
7. Chromium/Firefox/WebKit、目标 OS、PDF 和真实打印机分别验收；不将旧样本的矩阵结果授予新业务类型。
8. 未认证生产 source 时，拒绝承诺租户隔离、会计一致性、税务或支付安全；编辑器 shared-token 不等于用户身份系统。

## 8. 网络研究与来源

- [ERPNext：Customize Print Format](https://docs.frappe.io/erpnext/records-print-format)：按可打印业务类型及字段生成格式，标准/自定义/HTML 各自有范围。
- [ERPNext：Payment Entry](https://docs.frappe.io/erpnext/payment-entry)：收/付/内部转账、核销、预付款、币种、扣款；invoice 和 payment 不能混成同一交易。
- [RICS：Interim valuations and payment](https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/black-book/interim-valuations-and-payment)：估值、支付机制、保留款、标准表格；不是本 ERP 的 PCAR/CCAR 字段定义。
- [MyInvois：Document types](https://sdk.myinvois.hasil.gov.my/types/)：Invoice/Credit/Debit/Refund/Self-Billed 类型及 UBL JSON/XML；HTML 打印不替代法定电子文档。
- [W3C：CSS Paged Media Level 3](https://www.w3.org/TR/css-page-3/)：纸型、方向、边距、运行页眉/页脚和页码；规范能力不表示所有浏览器/驱动已支持。
- [JSON Schema Core 2020-12 §4.2.2](https://json-schema.org/draft/2020-12/json-schema-core#section-4.2.2)、[Validation 2020-12](https://json-schema.org/draft/2020-12/json-schema-validation)：结构相等、约束与字符串长度；本仓库仍只支持明确的受限 profile。

## 9. 工程安全与业务 stress 的独立契约

- [安全导入](ERP_PROJECT_IMPORT_SAFETY.zh-CN.md)：JSON/HTML重开与数据导入/编辑共享bounded JSON；工程自定义集合保留，dataset仍按其既有/items业务profile校验。未知正常字段不被删除，危险或超预算输入不被清洗成“有效”。
- [业务场景](ERP_BUSINESS_SCENARIO_CONTRACT.zh-CN.md)：已声明kind使用公开exact-kind fixture，而非generic family或私有ERP复制；合成行只作排版，不重算税额/总计/余额。v2明确repeat collection，claim字符串行号和其他数组不变。
- 原样货币字符串声明`data-pf-monetary="currency"`，不经Intl再格式化；真实Range/clip问题仍阻断。22pt行框保留；历史B的long-claim blocked现由[续片修复](ERP_MULTIROW_CONTINUATION.zh-CN.md)接续，现行回归要求完整ready、全部金额与业务行守恒，不增纸或放宽容差。
- 本轮 B 的Node24完整224文件/2279项与三引擎24项consumer通过；这不认证任意custom kind、实际ERP、银行或所有claim长文本。

## 10. 固定版本原始退货与扩展纸型

- [ERPNext 原始退货](ERPNEXT_RETURN_ADAPTER.zh-CN.md)：只读 Purchase Receipt / Sales Invoice / Purchase Invoice return，后两种分别明确 stock 0/1；已提交状态、真实原单/原子行身份、授权精确十进制覆盖必需。本币与单据币独立，不重算 FX、税、退款或账款。
- Canonical SalesReturn 现在允许明确 receivable decrease 和 none/inflow 库存，仍拒绝两个效果均 none。不是把 Delivery Note 自动升级成 Credit Note。
- [扩展纸型](ERP_ADDITIONAL_PAPER_ACCEPTANCE.zh-CN.md)：A5 横向、50×30mm 小标签、210×280mm 有限连续页；目标设备边距来自官方手册，但浏览器/PDF 证据不替代进纸、切刀、穿孔、扫码或原生 ZPL/ESC-POS 认证。
- 发布只补足实际 raw SDK 浏览器依赖 `src/printform/helpers.js`，不公开整个 src、配置或本地文件树；消费者在已构建站点动态导入并创建真实项目，不用 API mock 掩盖部署缺口。
- 本轮 C 实际Node24完整226文件/2351项、专项157项；三引擎原始退货15、新纸型36、旧纸型24、transaction27、settlement12合计114/114通过，含新17份真实Chromium PDF。不带测试init script的实际UI另证3页ready；额外managed工具的启动/截图失败单独保留，未冒充其通过。

## 11. 明确嵌套集合与空数组来源契约

- [嵌套数据契约](ERP_NESTED_DATASET_SCHEMA.zh-CN.md)复用现有JSON Schema profile，项目schema只存一份；来源/版本声明不是生产授权认证，observed描述符不能自证字段类型。
- 空allocations的字段来自显式schema；后续非空输入继续受同一契约约束。具体父JSON Pointer可在选择器、字段树、表格编辑、binder和离线输出中实际消费，不flatten或混父记录。
- 原样字符串身份/金额、转义键、正常未知字段保留；null与missing区分，不生成假行或零金额。错误类型/父scope/身份/预算保留原项目与草稿，文件导入不覆盖原本地记录。
- 本轮Node24完整227文件/2365项、最终专项36项及runtime/site/agent gate通过；三引擎完整UI重开/离线生命周期3/3通过，实际离线1页ready截图已查看，浏览器warning保留。数据库/items约束与项目自定义集合边界仍各自保持。

## 12. 长 claim 与多tr/rowspan续片

- [续片契约](ERP_MULTIROW_CONTINUATION.zh-CN.md)：保留原估价总计表并进入既有最终footer；dummy/spacer延后到footer和页码完成后的真实剩余预算。默认与long均检查所有源金额序列，而非仅ready状态。
- 多tr/rowspan=0/正跨度/colspan使用同一实测Range引擎；first/last/repeat按cell参与窗口定义。内部tr不增加业务行；不可适配的原子内容仍失败并完整回滚，不承诺任意CSS/字体或嵌套table的自动拆分。



