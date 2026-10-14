# ERP 收货／退货／贷借项／现金退款业务契约

## 1. 边界与官方依据

本功能提供六种**明确的 canonical 事实输入、校验和真正可携带的 Studio v3 打印项目**，不是 raw ERP 字段猜测器、会计／库存执行器或银行接口。原单、库存退回、账款调整和现金退款始终是不同业务事实；同一来源单据可以显式同时声明库存退回及账款调整，但不会从标题、金额符号或状态推导另一种效果。

实际阅读的官方主来源（2026-10-14）：

- [ERPNext Purchase Receipt](https://docs.frappe.io/erpnext/purchase-receipt)：可直接收货或关联采购订单；received／accepted／rejected 数量、仓库、UOM、币种和估值各有意义；收货不是供应商发票。
- [ERPNext Purchase Return](https://docs.frappe.io/erpnext/purchase-return)：对 Purchase Receipt 的退货减少库存；对 Purchase Invoice 的退货是 Debit Note；后者只有 Update Stock 时才另有库存影响。
- [ERPNext Sales Return](https://docs.frappe.io/erpnext/sales-return)：退回 Delivery Note 接收库存但不产生客户贷项；Credit Note 可以仅减少账款，也可以显式更新库存；退款需要另行 outgoing Payment Entry；支持部分退回。
- [ERPNext Debit Note](https://docs.frappe.io/erpnext/debit-note)：供应商退货借项是原 Purchase Invoice 的独立调整，减少 payable；已经通过 Purchase Receipt 退回库存时不能再自动退一次。
- [ERPNext Payment Entry](https://docs.frappe.io/erpnext/payment-entry)：现金移动、来源账户币种及分配额是不同事实，付款不应再次确认发票收入；ERP 提交／核销才影响账簿。
- [Odoo 19 Credit notes and refunds](https://www.odoo.com/documentation/19.0/applications/finance/accounting/customer_invoices/credit_notes.html)：customer／vendor credit note 减少账款；customer／vendor debit note 可以增加账款；现金退款需另外登记 payment。Odoo Vendors → Refunds 中的名称可以指 vendor credit note，并不证明现金已入账。
- [Odoo 19 Returns and refunds](https://www.odoo.com/documentation/19.0/applications/sales/sales/products_prices/returns.html)：库存 reverse transfer 与 credit note 是分别确认的单据，已开票后的退货不能仅靠库存逆向移库完成财务调整。

这些依据证明为什么必须区分语义，不构成 Globe3／ERPNext／Odoo 任一版本的数据库字段地图或地域税务合规承诺。

## 2. 公共 API 与现有 Studio 入口

```js
import { ERP_TRANSACTION_PROFILE, ERP_TRANSACTION_KINDS,
  normalizeErpTransaction } from './studio-v3/erp-transaction-adapter.js';
import { createErpTransactionProject } from './studio-v3/erp-transaction-project.js';
import { saveProject, readProject } from './studio-v3/file-io.js';

const facts = normalizeErpTransaction(input);
const project = createErpTransactionProject(input);
const serialized = saveProject(project);
const reopened = readProject(serialized);
```

`ERP_TRANSACTION_PROFILE` 为 `erp-supplied-transaction-v1`，`ERP_TRANSACTION_KINDS` 是冻结的六种 kind 数组。ESM 运行环境复用现有 Studio 的 `crypto.randomUUID`、`structuredClone`、标准 `Intl.supportedValuesOf('currency')` 与精确十进制 parser。

将 `serialized` 保存为 `.printform.json`，现有 Studio **Open → Save → Reopen → Export** 即可处理。项目带真实 design、HTML、CSS、spec、sampleData 与经过 `bindingValidation` 的绑定；没有新数据库连接或专用 UI 入口。Export 产物是既有离线可打印 HTML；是否允许导出仍受现有 Studio 版式门禁约束。

## 3. 六种 kind 的明确业务范围

所有效果是**上游报告的事实语义**，不是本模块执行或认证的库存／财务过账。

| kind | party.type | inventory.direction | accounting.basis／direction | 必要来源及事实 |
| --- | --- | --- | --- | --- |
| PurchaseReceipt | supplier | inflow | none／none | 至少一行带 item.id 及 accepted 数量；可选 received／rejected；可直接收货或引用 order。 |
| PurchaseReturn | supplier | outflow | none／none | original 收货来源、原 line ID、returned 数量；供应商账款调整另用 DebitNote。 |
| SalesReturn | customer | inflow | none／none | original 发货来源、原 line ID、returned 数量；客户账款调整另用 CreditNote。 |
| CreditNote | customer 或 supplier | none，或 customer inflow／supplier outflow | customer receivable／decrease；supplier payable／decrease | original 原发票／账单，每行明确 netAmount；库存效果非 none 时另需 item、returned 数量及原 line ID。 |
| DebitNote | customer 或 supplier | none，或 customer inflow／supplier outflow | customer receivable／increase；supplier payable／increase 或 decrease | original 原发票／账单，每行明确 netAmount；supplier decrease 表达 ERPNext 采购退货，increase 表达 Odoo vendor debit；绝不按名字猜测。 |
| Refund | customer 或 supplier | none | none／none | customer outflow／supplier inflow 的实际 cashMovement；至少一项 refund-basis 来源及关联分配。 |

`effects.accounting` 在此专指 party 的 receivable／payable 调整，不表示全部 General Ledger。库存-only 的 none／none 表示本 profile 不声明客户／供应商账款调整，并不否认 ERPNext perpetual inventory 在实际提交时可能产生估值／库存清算分录。本模块不表示、推导或执行那些科目分录；供应的 valuation／baseAmount 仍保持独立。

PurchaseReturn／SalesReturn 是库存退回 profile；带账款调整的原始 return invoice 应映射到 CreditNote／DebitNote，不能把两种效果装进库存-only kind。Refund 只表示实际供应的现金退款事实；没有 cashMovement 的 Odoo vendor refund 应映射到 CreditNote，而非伪造 cashMovement。未知／未声明语义报错。

`scope.extent` 为 full／partial，含 `reason` 与 provenance。它是 ERP 明确提供的本单范围，**不通过数量比率、原单余额或金额总和计算**。原单保持独立，模块没有写回原单状态、退货数量或 outstanding 的能力。

## 4. 完整最小输入：直接采购收货

```js
const p = (sourcePath, meaning) => ({ sourcePath, meaning });
const input = {
  profile: 'erp-supplied-transaction-v1',
  source: { system: 'FictionalERP', documentType: 'Goods Receipt', id: 'GR-F-1' },
  document: { kind: 'PurchaseReceipt', number: 'GR-F-014',
    date: '2026-10-14', currency: 'USD' },
  company: { id: 'COMP-F', name: 'Fictional Workshop' },
  party: { id: 'SUP-F', type: 'supplier', name: 'Fictional Supplier' },
  references: [],
  scope: { extent: 'partial', reason: 'Partial accepted delivery',
    provenance: p('erp.receipt_scope', 'Source supplied partial receipt') },
  effects: {
    inventory: { direction: 'inflow',
      provenance: p('erp.stock_effect', 'Accepted goods received') },
    accounting: { basis: 'none', direction: 'none',
      provenance: p('erp.document_role', 'Receipt, not supplier invoice') }
  },
  lines: [{ id: 'ROW-F-1', description: 'Source supplied accepted component',
    item: { id: 'ITEM-F-1' },
    quantities: [{ role: 'accepted', amount: '2.500', uom: 'Box',
      decimalPlaces: 3, direction: 'inflow',
      provenance: p('erp.rows[0].accepted_qty', 'Accepted quantity in Box') }],
    amounts: [] }]
};
```

没有供应金额、税、汇总、仓库、商品代码、商品名、银行、审批或原订单时，全部保持缺失，不补成零、空名称、假订单或假 invoice item。此例依靠真实接受数量，而不是“采购收货”标题冒充有效收货。

## 5. Canonical 字段规则

顶层仅接受 `profile`、`source`、`document`、`company`、`party`、`references`、`scope`、`effects`、`lines`、`taxes`、`summary`、`cashMovement`、`allocations`、`bank`、`approval`、`notes`。所有层级未知字段报 FIELD；缺失可选值应省略字段，不使用 undefined。

### 5.1 身份、来源和业务范围

- `source` 必填 `{system, documentType, id}`；均为非空原始来源字符串，保存真实业务类型，不把 canonical kind 当作数据库类型。
- `document` 必填 `{kind, number, date, currency}`；可选 `status`、`reference`。日期必须是有效 `YYYY-MM-DD`；status 原文保存，不能证明已清算或已过账。
- `company` 必填 `{id, name}`，可选 `address`、`registration`；`party` 必填 `{id, type, name}`，可选 `address`。
- `scope` 必填 `{extent, reason, provenance}`；extent 为 full／partial。
- `effects` 必填 `{inventory, accounting}`；两者均有 `direction`、`provenance`；accounting 另有 `basis`。所有 none 也必须显式提供，避免标题暗示另一种效果。
- `references` 必填数组，只有直接 PurchaseReceipt 可为空。每项必填 `{id, role, document, provenance}`。role 为 original／order／related-adjustment／refund-basis／payment。
- reference.document 必填 `{system, documentType, id, number}`；可选 `currency`、`date`、`partyId`、`companyId`；若有 partyId／companyId 必须匹配当前显式身份。Refund 的 refund-basis 必须带 currency。
- 同一来源 `(system, documentType, id)` 的重复引用不得冲突；本单自己不能作为自己的 original／linked reference。缺失可选来源属性不会从另一条引用自动补齐。
- 所有 reference／line／amount-fact／tax／summary／allocation 的 `id` 在同一输入中唯一。item ID 和原 sourceLineId 不在此命名空间，因为同一真实商品／原行可以有多个事实。

每一个 provenance 为 `{sourcePath, meaning}`，两者必填非空字符串；sourcePath 是上游确认的来源字段／表达式路径，meaning 说明来源业务意义。它是供应的追溯说明，模块不连接 ERP 检查其真实性。

### 5.2 数量、UOM 与库存方向

非 Refund 必填非空 `lines`；每行必填 `id`、`description`、`quantities` 数组、`amounts` 数组，可选 `item`、`sourceReferenceId`、`sourceLineId`。

- `item` 供应时必填 `id`，可选 `code`、`name`，不产生缺失的名称或 SKU。
- PurchaseReceipt 的来源行若有 `sourceReferenceId` 必须关联 order；其他 lines 必须关联 original。供应 `sourceLineId` 必须同时关联来源单。具有库存退回效果的非 PurchaseReceipt 行必须供应原 `sourceLineId`。
- quantity 必填 `{role, amount, uom, decimalPlaces, direction, provenance}`；可选 `warehouse: {id, name?}`。仓库缺失不补齐，也不认证库存操作已完成。
- `role` 为 received／accepted／rejected／returned／billed；同一 line 内每个 role 至多一次。PurchaseReceipt 只允许 received／accepted／rejected，至少 accepted；其他有库存方向的行至少 returned，可另含 billed；没有库存效果的金融行只允许 billed。
- received／accepted／rejected／returned 的 quantity.direction 必须与显式 inventory.direction 相同；billed 必须为 none，不能冒充库存移动。
- `amount` 必须为十进制**字符串**；合法正负号、尾随零、千分组原文保留；`decimalPlaces` 为 0–6 的整数或对应字符串，校验精确可表达性；`uom` 必填非空来源单位。
- `-1.250 Box` 与 `+1.250 Box` 可以表达不同 ERP 的源符号约定，但库存方向只由显式 direction 决定；不取绝对值、不自动转负、不做 UOM 换算，也不检查原单最大可退数量。
- 不验证 received = accepted + rejected；这些是独立供应事实。规范化增加准确 `displayQuantity`，保留数量原文及声明精度。

### 5.3 每个金额与 monetary fact

```js
const money = {
  amount: '-7.891', currency: 'USD', minorUnitDigits: 3,
  direction: 'decrease',
  provenance: { sourcePath: 'erp.return_net', meaning: 'Receivable reduction' }
};
```

money 必填以上五项。金额必须为十进制字符串，精度 0–6；保留 `+`／`-`／签名零与尾随零，不接受指数、不四舍五入。复用现有 exact-decimal parser，超出安全整数 minor units 或不能准确无损表达的值拒绝。规范化增加 `amountMinor`、`displayAmount`；不计算新税／总额／汇率。

`direction` 仅可为 increase／decrease／inflow／outflow／valuation／balance。它表达**该数值自身的供应业务意义**，不通过金额正负号推断。单价和估值使用 valuation；note 的 netAmount 必须与显式 accounting.direction 一致；库存-only netAmount 使用 valuation。税或其他调整可以有独立供应的 increase／decrease，不用简单符号规则覆盖它们。

monetary fact 必填 `{id, label, role, amount: money}`，可选 `sourceReferenceId`、`basis`；引用若提供必须存在。按位置允许：

| 位置 | role |
| --- | --- |
| line.amounts | unitRate／netAmount／valuationAmount／baseAmount |
| taxes | tax／charge／baseAmount |
| summary | subtotal／taxTotal／grandTotal／rounding／remainingBalance／baseAmount |

- 各位置数组可为空；taxes／summary 本身可省略。CreditNote／DebitNote 每行必须有 netAmount，不能仅有 unitRate 冒充账款调整。
- 非 baseAmount 的金额币种必须等于 document.currency；baseAmount 可以保留明确供应的本位币，必须给 basis 说明其来源换算／估值意义。不会用当前汇率回算。
- taxes 每项必须有非空 basis 说明税／费用语义；不求税率或按明细重新计税。
- remainingBalance 必须 direction = balance 且有 basis 明确余额范围；不将财务余额当作退款金额。
- 没有给 summary 时不生成 subtotal／taxTotal／grandTotal；有给但与明细看似不相加时原样保留，本模块不是账实核对器。
- 标准 Intl 支持的 uppercase ISO 货币用于规范化及 linked/base 值；**现有便携 manifest 的 document.currency 仅支持 MYR／USD／SGD／EUR／CNY／JPY**。主币 GBP 等可规范化但项目创建抛 PROJECT_CURRENCY，不擅自改币种。

### 5.4 Refund：现金、来源侧金额和退款依据独立

Refund 禁止 `lines`、`taxes`、`summary`，不能把 vendor credit note 当作现金退款 invoice。必填实际 `cashMovement` 与非空 `allocations`，两类库存／note 输入反过来禁止 cashMovement／allocations／bank。

- `cashMovement` 必填 `{direction, amount}`，可选 `sourceAmount`；customer 必须 outflow，supplier 必须 inflow。
- amount.currency 必须等于 document.currency；amount.direction 和可选 sourceAmount.direction 必须等于 movement.direction。来源侧现金可用另一币种，必须保存自身精度与 provenance。
- 每个 allocation 必填 `{id, sourceReferenceId, amount}`；引用 role 必须 refund-basis，amount 币种使用该 reference.document.currency，direction 与 movement 相同。
- 可选 `cashAppliedAmount` 使用 movement 币种及方向；可选 `remainingAmount` 使用 refund-basis 币种，direction = balance。两者都用自身 money provenance，不能从 allocation.amount 或现金额推导。
- 可选 `state` 为 full／partial；同时供应 remainingAmount 时，full 必须零、partial 必须非零。没有余额或状态不补算。
- `scope.extent` 是本单供应范围；allocation.state 是对应来源信用／预付款分配范围，二者不自动相等。
- `bank` 可选，只允许 name／account／transactionReference／date／status／paymentMethod；保存并打印供应内容。打印 `Not bank-reconciled` 不是执行银行对账；没有 bank 时不产生假银行或清算状态。

例如 fixture 的客户现金退款为 **MYR 130.000**，来源侧现金 **USD 30.000**，信用应用 **USD 25.000**，现金应用 **MYR 111.000**，来源剩余 **USD 5.000**；各自来自不同显式字段。模块不从任何两个金额相乘、相减或求和生成第三个。

### 5.5 可选上下文与保存安全

`approval` 可选，只允许 status／approvedBy／date／reference；`notes` 可选非空原文。approval 不授予权限、不触发审批。所有元数据日期仍须有效日历日期。

JSON 安全校验拒绝 undefined、BigInt、symbol、函数、非有限数、数值 -0、环、Date／自定义类、稀疏数组／数组命名属性、getter／setter、不可枚举属性及危险对象键，避免现有 Save 静默丢失供应事实。

## 6. 真正打印输出与限制

项目以 A4 portrait 和现有 measured pagination 编译；不是只改 invoice 标题。唯一 `/printRows` collection 按真实事实列出来源单、数量、line money、tax／charge、独立 summary 及 refund allocations。每行有 sourceId／sourcePath、业务 meaning、准确 value、显式 direction、source identity／provenance trace；金额／数量行另外保存对应 canonical 快照。

原来源单号和 ID、原行 ID、商品／仓库可选身份、数量 role、各币种、数值 precision/provenance 和 full／partial 语义不被混合。现金 Refund 才有实际现金摘要 section；其他可选 summary 在事实表单独列出，缺失不会变为零合计。公司、party、effects、scope、现金 provenance 与供应的 bank／approval 也通过真实绑定打印。

打印 footer 明示不执行财务过账、库存移动、现金退款、总额／税／FX 计算或银行核销。独立的库存退货与 note 不会自动互相创建，不能防止真实 ERP 在两张单据重复退库存；上游须确认 Update Stock 与既有来源记录。

不覆盖：无 original 的 return／note、员工／内部转账退款、退款执行指令或待退款请求、自动原单可退数量检查、序列号／批次追踪、ERP raw 数据库地图、税务／会计分录或私有权限认证。供应未支持字段明确报错，不 silently drop。便携项目受既有文件大小与版式质量门禁约束；任意长描述／巨量行并未在此声明实体打印机认证。

## 7. 错误、永久 fixtures 与实际验收

错误带 `code = ERP_TRANSACTION_<类型>`、`path` 和说明，覆盖 PROFILE／SHAPE／FIELD／TEXT／SEMANTICS／DATE／CURRENCY／PRECISION／AMOUNT／AMOUNT_PRECISION／UNSAFE_AMOUNT／IDENTIFIER／REFERENCE／BALANCE／JSON／ROWS／ITEM／QUANTITY／PROJECT_CURRENCY／BINDING。规范化复用既有 settlement 校验及 money parser，但错误公开为 transaction 命名空间。

作者虚构 fixtures（不是客户数据或实际到账证明）：

- `tests/fixtures/erp-transaction.js`：`fictionalTransaction(kind)` 返回六种完整契约；另有 `fictionalSupplierRefund()`、`fictionalOdooDebit()`、`fictionalStockCredit()`。
- `tests/studio-v3-erp-transaction.test.js`：真实 normalizer、project、DOM binder、Save／read；保留业务语义、无效输入、独立 debit 方向、部分/full、签名零、0–6 位精度、可选事实缺失和来源身份边界；删除复制/转发式 round-trip 断言，由实际 browser 生命周期验证全部九种素材。
- `e2e/studio-v3-erp-transaction.spec.js`：九组真实 Open → Save → Reopen → Export → 离线 HTML 路径，在 Chromium／Firefox／WebKit 检查逐项来源／数量／金额／方向／provenance、无假字段、行来源索引、实际 A4 sheet 几何与不重叠。
- Chromium 分支生成并由 PDF.js 解析真实 PDF；检查物理 MediaBox、页数、文本坐标、各供应金额／数量与身份。Firefox／WebKit 路径不冒称其 Playwright PDF 能力。

以下为可重现入口；2026-10-14 已实际运行三引擎 transaction + settlement journeys，**39/39 passed**，其中新 transaction 九组 × 三浏览器 **27/27**，既有 settlement **12/12**：

- `npm run build:site` 已完成 runtime/site/agent release gate；去除复制式 unit round trips 后，最终 `npm run test -- --run --maxWorkers=1 --no-file-parallelism` 为 **222 files / 2,259 tests passed**，其中本契约 **85 项业务/边界回归**。
- 完整单测与 browser 同时运行时曾有 4 项既有 typography parity 因 5s 超时失败；关闭任务自建浏览器、改用串行隔离后全套通过。未扩大 timeout、跳过旧测试或修改其断言。

```sh
npx vitest run tests/studio-v3-erp-transaction.test.js
npm run build:site
npx playwright test e2e/studio-v3-erp-transaction.spec.js --workers=1
```

真实 Chrome 另行打开离线 `Refund.html`：状态 ready、2 页；现金 `MYR 130.000 / outflow`、来源侧现金 `USD 30.000`、退款依据 `USD 25.000`、现金币核销 `MYR 111.000`、依据余款 `USD 5.000` 分开展示。已查看两页，银行事实保持 `Not bank-reconciled`，不将打印视为到账认证。

实体设备／驱动／库存账簿／真实银行到账与生产 ERP 字段映射均不由这些虚构 fixtures 或 browser/PDF 结果证明。
