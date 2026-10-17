# ERP 收款／付款打印业务契约（Pilot）

## 1. 交付边界与依据

此功能是**可使用的 canonical 输入 API 和便携打印项目**，不是数据库连接、付款执行器或会计核销引擎。状态保持 **Pilot**；没有生产 ERP 接入、银行确认或实体打印机认证。

业务依据（实际阅读的官方页面，2026-10-14）：

- [ERPNext Payment Entry](https://docs.frappe.io/erpnext/payment-entry)：一个付款单可对应同一客户／供应商的多个发票；支持部分付款、预收／预付及未分配金额；Paid Amount 与 Received Amount 使用各账户币种；费用、代扣和汇兑差额有独立语义；提交 ERP 单据才产生分录。
- [Odoo 19 Payments](https://www.odoo.com/documentation/19.0/applications/finance/accounting/payments.html)：独立付款可晚于付款时匹配发票；支持部分与合并付款；登记付款、In payment、银行对账及 Paid 不是同一状态；汇兑及现金制税务分录由 ERP 对账流程处理。

这些页面支持 canonical 业务边界，**不建立 Globe3／其它 ERP 原始数据库字段映射**。canonical API 不猜测 `paid_amount`、`received_amount`、`allocated_amount`。ERPNext **15.0.0** 另有已固定官方 tag 的 [Payment Entry 原始快照适配](ERPNEXT_PAYMENT_ENTRY_ADAPTER.zh-CN.md)；它不是通用 ERP 或 live DB adapter，其它版本仍须明确字段地图。

## 2. API 与使用入口

```js
import { normalizeErpSettlement } from './studio-v3/erp-settlement-adapter.js';
import { createErpSettlementProject } from './studio-v3/erp-settlement-project.js';
import { saveProject, readProject } from './studio-v3/file-io.js';

const facts = normalizeErpSettlement(input); // JSON-safe canonical facts + provenance
const project = createErpSettlementProject(input); // 真正的 Studio v3 project
const serialized = saveProject(project);
const reopened = readProject(serialized);
```

API 为 ESM，可由 Node 或 bundler 导入；项目构造复用现有 `newProject`／`compileProject`，需所在环境提供现有 Studio 使用的 `crypto.randomUUID`。规范化使用标准 `Intl.supportedValuesOf('currency')`、`structuredClone` 与 BigInt 精确十进制转换。

`saveProject` 的返回值可保存为 `.printform.json`，由现有 Studio v3 **Open** 打开、编辑设计、保存、重新打开、预览，然后由既有 **Export** 导出离线 HTML。不需要数据库数据集、假商品行或新增 UI。导出继续遵守现有预览／版式质量门禁。

## 3. 完整最小输入：无发票的预收

```js
const input = {
  profile: 'erp-supplied-settlement-v1',
  source: { system: 'FictionalERP', documentType: 'Customer Payment Entry', id: 'receipt-fictional-1' },
  document: { kind: 'BankReceipt', number: 'BR-FICTIONAL-1', date: '2026-09-14', currency: 'MYR' },
  company: { name: 'Fictional Workshop' },
  party: { id: 'customer-fictional-1', type: 'customer', name: 'Fictional Customer' },
  cashMovement: {
    direction: 'inflow',
    amount: { amount: '75.000', currency: 'MYR', minorUnitDigits: 3 }
  },
  allocations: [],
  summary: { unappliedAmount: { amount: '75.000', currency: 'MYR', minorUnitDigits: 3 } }
};
```

预付款将 `document.kind` 改为 `BankPayment`，`party.type` 改为 `supplier`，`cashMovement.direction` 改为 `outflow`，并供应对应来源身份及单号。不是把预收单复制成某个假发票。

空 `allocations` 始终保留为空。没有调整时打印表格没有数据行；现金流与 ERP 提供的未分配预收／预付款金额仍显示。预收模式不是“发票全部付清”。空 allocation 要求显式 `summary.unappliedAmount`（现金币种）或 `summary.partyUnappliedAmount`（有明确账户来源的party账户币种），不会从现金金额计算该值。

## 4. 输入字段（未知字段报错，缺失可选字段不补齐）

顶层仅允许：`profile`、`source`、`document`、`company`、`party`、`partyAccount`、`cashMovement`、`allocations`、`adjustments`、`summary`、`bank`、`approval`、`notes`。

| 字段 | 精确规则 |
| --- | --- |
| `profile` | 必填，唯一支持 `erp-supplied-settlement-v1`；声明每个字段已由上游明确解释，而非自动辨识 raw ERP 格式。 |
| `source` | 必填 `{system, documentType, id}`，均为非空字符串；保存来源系统、实际业务单据类型和来源标识。 |
| `document` | 必填 `kind`（BankReceipt／BankPayment）、`number`、`date`、`currency`；可选 `reference`、`status`。日期是有效的 `YYYY-MM-DD`。状态按 ERP 原文保存，不推导银行清算。 |
| `company` | 必填 `name`；可选 `id`、`address`、`registration`，字符串。 |
| `party` | 必填 `id`、`type`、`name`；可选 `address`。BankReceipt 只接受 customer，BankPayment 只接受 supplier。多客户批量银行存款、员工报销、内部转账不在此契约。 |
| `partyAccount` | 可选 `{id,currency,provenance}`；currency为ISO币种，provenance必需 `{sourcePath,meaning}`。供应party币种金额时必须提供此原生账户身份与来源；不等同于cash account。 |
| `cashMovement` | 必填 `direction`、`amount`；收款 inflow、付款 outflow；可选 `sourceAmount` 保存来源侧账户币种／金额。`amount.currency` 必须等于 `document.currency`。 |
| `allocations` | 必填数组，可以为空。每行规格见下节。 |
| `adjustments` | 可选数组；缺失不变成虚构空财务项。每行规格见下节。 |
| `summary` | 可选独立 ERP 汇总事实；纯预收／预付必须有 unappliedAmount 或 partyUnappliedAmount。规格见下节。 |
| `bank` | 可选；仅允许 `name`、`account`、`transactionReference`、`date`、`status`、`paymentMethod`。保存并打印供应的银行上下文。 |
| `approval` | 可选；仅允许 `status`、`approvedBy`、`date`、`reference`。保存并打印供应的审批上下文；不检查授权、不执行审批、不使单据自动 Approved。 |
| `notes` | 可选非空字符串，按供应内容打印。 |

### 4.1 每一个金额都是独立 money 对象

```js
{ amount: '-3.210', currency: 'USD', minorUnitDigits: 3 }
```

- 三个字段都必填。`amount` 为有限十进制数字或字符串；推荐字符串。可含合法千分组、正负号和尾随零；不接受科学记数法。
- `minorUnitDigits` 是 0–6 的整数或相应字符串。按**该金额自身**的声明精度显示。同一个币种的不同来源值可用不同声明精度；例如 invoice applied 是 USD 100.00，ERP cleared 是 USD 105.000。禁止超出声明精度的非零位，不做四舍五入。
- 货币代码必须是当前标准 Intl 支持的 uppercase ISO 代码。来源规范化及外币事实保留原有 ISO 支持，不受 Studio 主币种目录限制；合法 BHD、AED 等来源币种不会因不在目录中被拒绝。
- 只有便携项目 manifest 的**主现金币种**使用 Studio 16币种目录：MYR、USD、SGD、EUR、CNY、JPY、GBP、AUD、NZD、HKD、IDR、VND、THB、INR、KRW、CHF。GBP 可直接构造项目；目录外主币种仍可规范化，但项目构造报 `PROJECT_CURRENCY`，不会转换币种掩盖限制。核心 formatter 保留原有 ISO 支持。
- 正负号与零不改成绝对值。显式字符串 `-0.000`、`+0.000` 也保留并打印；数值 `-0` 因 JSON 会失去符号而被拒绝。
- 数额必须可准确转换为安全整数 minor units。超大数额及无法无损保留的数额报错，不以浮点近似值通过。
- 规范化 money 为 `{amount, currency, minorUnitDigits, amountMinor, displayAmount}`；`amount` 保存字符串表示，`amountMinor` 只用于无损数额表达／零检查，`displayAmount` 是准确文本，不使用默认两位 currency formatter。
- money 可选携 `provenance: {sourcePath,meaning}`，两值均为非空来源字符串；规范化、printRows、save/reopen保留。fixed-version raw adapter 的映射金额要求其精确导出provenance，不降低既有金额精度规则。

### 4.2 Allocation：发票应用、发票清偿与现金应用各自独立

每行只允许：

- 必填 `id`：非空来源 allocation 标识，所有 allocation／adjustment ID 不得重复。
- 必填 `sourceReference`：`{system, documentType, id, number, currency}`；可选 `date`、`partyId`、`companyId`。保存原发票／账单／贷项来源，不根据名称重分类。
- 必填 `invoiceAppliedAmount`：**发票币种的应用额**。
- 可选 `partyAppliedAmount`：**partyAccount.currency 的原生账户应用额**，必须提供partyAccount身份、币种与provenance。不得改标为invoice币种，也不能替代仍必需的invoiceAppliedAmount；不同币种的invoice applied须由授权来源独立供应，不本地FX。
- 可选 `invoiceClearedAmount`：**ERP 提供的实际发票清偿额**，可能包含折让／代扣影响，绝不等同于 cash applied。
- 可选 `cashAppliedAmount`：**现金币种的应用额**，与 `cashMovement.amount.currency` 相同；不由汇率乘算而来。
- 可选 `invoiceBalanceBefore`、`invoiceRemainingBalance`：独立 ERP 发票余额，均使用 reference 的发票币种。
- 可选 `state`：full／partial。若同时提供剩余发票余额，full 必须余额为零，partial 必须非零；未提供余额则不补算，未提供 state 则不推导。

`sourceReference.partyId` 若提供必须等于付款单 party；`companyId` 若提供必须匹配显式 company.id。相同 `(system, documentType, id)` 的重复引用允许存在，但已供应的单号、币种、日期、公司及交易方事实不得相互冲突。

例如 USD 发票应用 100.000、现金应用 MYR 450.000，是两个明确的 ERP 值。SGD 发票应用 200.000、清偿 205.000、剩余 95.000，与现金应用 MYR 550.000 又是独立事实。不把 USD 和 SGD 发票额求和成一个无币种的“Allocated total”。

### 4.3 Adjustment：费用、代扣、折让和汇兑调整

每行允许：

- 必填 `id`、`kind`、`label`、`amount`、`affects`。
- `kind` 为 bankFee／withholding／discount／fxGain／fxLoss／writeOff／other。
- `label` 是 ERP 提供的业务说明；`amount` 使用上述 money 格式。
- `affects` 必须明确为 cash／invoice／ledger／unapplied，不能猜测某字段是否影响现金或发票。
- 可选 `allocationId`，必须指向已有 allocation；可选 `sourceReference` 使用 reference 规格；可选 `account` 保存 ERP 科目上下文。
- cash／unapplied 调整使用主现金币种；invoice 调整须有 allocationId 或明确带币种的发票 reference，并使用该发票币种；ledger 调整可保留自己的本位币／外币。
- invoice 调整同时供应 allocationId 与 sourceReference 时，两者必须指向同一个来源发票；不允许互相冲突的目标身份。

调整独立列入打印表格，即使是零或负数。已提供的 FX gain／loss 不被隐藏在现金或发票余额里，也不会按当前汇率重算。费用不是商品行，不被重分类成税。是否借贷、影响哪一方及正负方向由上游事实决定，本功能不生成分录。

### 4.4 Summary：独立提供，绝不由明细推导

允许以下可选 money：

| 字段 | 打印含义 |
| --- | --- |
| `cashAppliedAmount` | ERP 现金币种应用额；币种必须等于现金币种。 |
| `invoiceClearedAmount` | ERP 提供的发票清偿汇总；供应方须自行建立其明确币种的汇总范围。多发票不同币种不自动汇总。 |
| `unappliedAmount` | ERP 未分配的预收／预付款，使用现金币种。**不是 invoice outstanding。** |
| `partyUnappliedAmount` | ERP原生party账户币种的未分配预收／预付款；必须与partyAccount.currency匹配；既不是cash unapplied，也不是invoice outstanding。 |
| `partyAllocatedAmount` | ERP原生party账户币种的已分配汇总；必须与partyAccount.currency匹配；不把多币发票本地求和。 |
| `remainingBalance` | ERP 独立余额；必须同时供应非空 `balanceBasis` 描述其语义，例如某币种的 party ledger snapshot，而不是假称未分配现金为发票欠款。 |
| `fxDifference` | ERP 独立汇兑差额，保留供应币种与精度。 |

不允许模糊的 `total`、`paid`、`outstanding` 等替代字段。现金移动、应用、发票清偿、发票剩余、未分配预收和 FX 值不会互相代替。即便 ERP 供应的各项不满足一个看似常见的相加公式，也不擅自重算；本模块不是账实核对器。

## 5. 便携项目与来源追溯

输出 sampleData 保存 canonical `source`、`document`、`company`、`party`、`cashMovement`、`allocations` 及供应的可选上下文；没有 items、sku、quantity、tax 或虚构余额。调用者输入不被修改。

一张真实 collection `/printRows` 展平所有**已提供**的 allocation 指标及 adjustment：同一发票有几个不同语义金额，就打印几条明确标记的财务事实。每行带 `no`、`section`、`sourceId`、`sourcePath`、`label`、`reference`、money 字段；allocation 行带 `metric`、供应的 `state`；adjustment 行带 `adjustmentKind`、`affects`、供应的 allocationId／account。能确定来源发票时保存 `sourceReference`。linked adjustment 的打印引用可使用其已有 allocation 的发票引用，不创设新的来源事实。

纯预收／预付 `/printRows` 无 allocation 数据；若 ERP 另提供费用等调整，可打印这些真实调整。`printMode` 只是依据“有没有 allocation”及明确收／付款类型命名的打印上下文，不是银行或账务状态。

项目逐项打印现金、可选 source cash、供应的汇总和 balanceBasis；未供应的 bank／approval／余额／发票清偿汇总都不产生绑定。打印 footer 明示：不执行过账、付款、核销、税或 FX 计算，打印状态不认证银行清算。

## 6. 错误与 JSON 保存安全

所有契约错误为 Error，带 `code = ERP_SETTLEMENT_<类型>`、`path` 和带路径的消息。类型包括：PROFILE、SHAPE、FIELD、TEXT、SEMANTICS、DATE、CURRENCY、PRECISION、AMOUNT、AMOUNT_PRECISION、UNSAFE_AMOUNT、IDENTIFIER、REFERENCE、BALANCE、ADVANCE、JSON、PROJECT_CURRENCY、BINDING。

错误在项目交付前抛出，不静默修复。JSON 校验拒绝 undefined、BigInt、函数、symbol、非有限数字、数值 -0、循环引用、Date／自定义类实例、稀疏或带命名属性的数组、getter／setter、不可枚举字段以及危险对象键。这些值无法通过既有 save／Open 无损往返。

JSON 校验路径带 `input` 前缀并使用属性路径；业务校验路径例如 `allocations[1].cashAppliedAmount.currency`。金额助手的错误会转换为 ERP_SETTLEMENT 前缀。

## 7. 永久回归与可运行虚构 fixtures

所有新增金额、名称、来源标识、单号及账户都是作者虚构，不来自客户案例。

- `tests/fixtures/erp-settlement.js`：`fictionalMixedReceipt()`、`fictionalAdjustedPayment()`、`fictionalAdvance('BankReceipt')`、`fictionalAdvance('BankPayment')`；每个返回完整可直接构造项目的输入。
- `tests/studio-v3-erp-settlement.test.js`：直接消费规范化 API、项目、save／read 与真实 DOM binder；覆盖跨币发票应用／清偿／现金应用、独立 FX、全额／部分／预收快照转换、签名零、0–6 位精度、可选事实缺失、来源追溯以及清楚的错误不变量。
- `e2e/studio-v3-erp-settlement.spec.js`：四个 fixture 的现有 UI Open → Save → Reopen → Export → 离线 HTML 打印行为；检查金额与指标逐行一致、无假商品／余额、真实行来源索引、版面边界，并为 Chromium 输出 PDF，所有浏览器输出截图。

供集成负责人运行（实施期间没有运行这些验证）：

```sh
npx vitest run tests/studio-v3-erp-settlement.test.js
npx playwright test e2e/studio-v3-erp-settlement.spec.js
```

这些代码使用 canonical ERP facts，不授予真实银行／ERP 对账、生产授权、私有 raw DB 字段地图或实际 printer certification；独立执行结果见下节。
2026-10-15补充：partyAccount／partyAppliedAmount／partyUnappliedAmount／partyAllocatedAmount及可选money provenance，为原生ERPNext三类独立币种保真而显式增加。旧cash unapplied语义不变；当前专项原生Payment/settlement/transaction/return四文件247项通过，agent gate28 reviewed。浏览器/完整构建结果记录于[原生适配专项](ERPNEXT_PAYMENT_ENTRY_ADAPTER.zh-CN.md)，以下历史验收不覆盖或改写。


## 8. 选项 2 独立验收

- 选项 3 的分页改动仍被隔离，工作树为 merged baseline + 选项 1 + 收付款契约。
- `npm run build:site`：**218 files / 2,132 tests passed**，包含 60 项 settlement API/错误/状态/绑定与 round-trip 回归。
- Chromium/Firefox/WebKit **12/12 passed**：混合币种多发票 receipt、带 discount/withholding/FX 的 payment、无 allocation 的 advance 与 prepayment，均实际 Open/save/reopen/offline export，逐行金额、余额语义与越界检查通过。
- 实际无 allocation 的打印表面无假发票/商品行、无伪 bank/approval；其 Chromium PDF 各 1 页。混合 receipt 与调整 payment 各 2 页。
- PDF.js 验证 MYR cash、USD source cash、SGD invoice cleared/remaining、signed fee/FX、零额、不同金额精度及 `2026-09-14` 保真。`document.date` 明确标为 Document date，不冒充 posting/bank-clearance date。
- 输入全部为自行编造，证明映射与打印，不证明银行到账、真实核销/会计入账、live ERP 或所有组合。

