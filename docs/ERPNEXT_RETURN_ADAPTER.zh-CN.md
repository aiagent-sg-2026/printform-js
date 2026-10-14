# ERPNext 原始退货只读适配器

## 范围与版本

入口：`studio-v3/erpnext-return-adapter.js`。

- `adaptErpNextReturn(input)`：原始快照 → `normalizeErpTransaction` 验证后的业务事实。
- `createErpNextReturnProject(input)`：原始快照 → `createErpTransactionProject` 的真实 Studio 项目；可保存、打开、预览、离线 HTML 导出及浏览器 PDF 打印。
- 固定 `profile = "erpnext-return-v15.0.0-exact-v1"`、`context.erpnextVersion = "15.0.0"`。这表示已核对的上游 **v15.0.0** 字段/控制器契约，不是对所有 v15、v16 或本地定制的兼容声明。
- 原始数据必须来自调用方已授权的离线导出。适配器不连接 ERP、不接受认证参数、不执行 SQL、库存移动、记账、退款、税额计算或汇率换算。

## 三种真实映射

| 原始 ERPNext 单据 | 条件 | 标准业务类型 | 库存事实 | 往来账户事实 |
| --- | --- | --- | --- | --- |
| Purchase Receipt | `is_return=1` | PurchaseReturn | outflow | none / none；不是供应商应付调整 |
| Sales Invoice | `is_return=1, update_stock=1` | SalesReturn | inflow | receivable / decrease |
| Sales Invoice | `is_return=1, update_stock=0` | SalesReturn | none | receivable / decrease |
| Purchase Invoice | `is_return=1, update_stock=1` | DebitNote | outflow | payable / decrease |
| Purchase Invoice | `is_return=1, update_stock=0` | DebitNote | none | payable / decrease |

Purchase Receipt 在永续库存配置下可能产生库存总账冲销；`accounting.basis=none` 只表示本模型不把它当作供应商应付调整，绝不宣称 ERP 没有任何总账记录。ERPNext 的供应商 Debit Note **减少应付**，不能照搬其他 ERP 的同名票据方向。

Sales Invoice 无库存的退货仍保留真实应收减少，不伪装成无会计影响的库存退货，也不虚构第二次库存入库。有库存时，原 Sales Invoice 必须也启用了 `update_stock`。打印的影响来自已提交的 ERP 快照，不代表本地执行。

## 输入与身份

顶层仅允许 `profile/context/document/original/exact`：

- `document`：原生返回单据对象。
- `original`：`return_against` 所指向的完整原生原单快照（含 `items`）。
- `context.company = { id, name, baseCurrency }`：已授权源公司事实；`id` 必须等于原生 `company`，本币由调用方提供，绝不由汇率反推。
- `context.scope = { extent: "full" | "partial", reason, provenance: {sourcePath, meaning} }`：源业务批准事实，不按行数、金额或数量推断“全退”。
- `exact`：已授权导出的精确十进制覆盖事实，见下一节。

当前和原单必须 `docstatus=1`；当前 `is_return=1`，原单 `is_return=0`，同 DocType、公司、客户/供应商、单据币种及原生 `conversion_rate`。`return_against` 必须与独立原单 `name` 严格相等，不能指向自身。原生 Check 必须是数字 `0/1`，不接受 `"1"` 等真值字符串。

`posting_date` 和有效原生 `posting_time` 必须提供；退货时间不能早于原单。`status` 原样保留；`docstatus=2` 的取消单、草稿或与已提交状态冲突的 Draft/Cancelled/Canceled 状态明确拒绝，不冒充有效退货。

原单及当前 `items` 行必须有唯一的 `name` 和准确的 `doctype/parent/parenttype/parentfield="items"`。当前行原始引用分别为：

- Purchase Receipt：`purchase_receipt_item`。
- Sales Invoice：`sales_invoice_item`。
- Purchase Invoice：`purchase_invoice_item`。

引用必须在指定原单的子行集合中准确解析；还核对 `item_code/uom`。不按 SKU、索引或描述猜原行。即使同原单两行是同一 SKU，仍按真实子行 ID 关联。无库存发票某些手工导出可能缺少这些原行字段：必须从真实原行身份补充已授权证据，不能猜测或采用索引代替。输出保留当前行 ID、原单 ID、原行 ID 和源字段路径，打印溯源可见。

## 精确金额覆盖：必需而非可选修饰

ERPNext DocType 的 Currency/Float 字段通常经 JSON 传输为数字。解析后的 `-49.123` **不能证明**原来是 `-49.123`、`-49.1230` 或另一个被二进制表示折叠的十进制值。因此本适配器不使用 `String(rawNumber)`、四舍五入、乘法或 FX 恢复所谓原始精度。

每个映射字段必须另有精确导出事实。例如：

```js
exact: {
  'document.items[0].qty': {
    amount: '-1.250', precision: 3,
    provenance: { sourcePath: 'authorized-export/return/line/qty', meaning: '源十进制文本与字段精度' }
  },
  'document.items[0].net_amount': {
    amount: '-49.123', precision: 3, currency: 'USD',
    provenance: { sourcePath: 'authorized-export/return/line/net_amount', meaning: '源保存净金额，不是 rate × qty' }
  }
}
```

- `amount` 必须是显式十进制字符串，`precision` 为 0–6；现有精确解析器验证小数位和安全整数存储边界。
- 数量没有 `currency`；金额必须有准确币种。`qty` 使用原生 `uom`，不转换为 `stock_uom`。
- 原始字段仍须为有限 JSON 数字；只以已精确解析的`amountMinor / 10 ** minorUnitDigits`与rawNumber比较明显矛盾，合法千分组、前导零和签名原文不经`Number(rawText)`误拒绝。这个比较**不是精度证明**，也不生成打印金额。词法真实性依赖覆盖事实的真实来源与授权，前端不能独立认证导出系统。
- 每个覆盖事实必须有 `sourcePath/meaning`；源路径和精确导出出处均进入打印 provenance。
- 必需行事实：负且非零的 `qty`、非正的 `net_amount`。真实免费商品的源净金额 `0.000` 可保留，不补造估值。
- 可选行事实：`rate` → unitRate；`base_net_amount` → baseAmount。
- 可选单据汇总：`net_total/total_taxes_and_charges/grand_total/rounding_adjustment/base_grand_total`。
- 原生 `taxes` 若提供，验证其真实父单身份，并映射 `tax_amount`，保留 `description/charge_type/account_head`；不按税率重算。
- 原始字段存在则必须有覆盖；覆盖中未使用的路径拒绝，不静默丢弃未知精确事实。未提供的可选金额仍不存在，不补零或创建自动总计。

单据金额使用 `document.currency`。`base_net_amount/base_grand_total` 必须使用 `context.company.baseCurrency`，并明确标记源本币含义。测试中的 USD 与 SGD 是各自独立的源数值，不相加、不转换、不把本币展示为单据币。总额可以与本地乘加的结果不同：照录源事实，不擅自改账。原单跨单据币种返回明确拒绝，不以相同汇率误认为相同币种。

## 明确风险边界

- 不审核 ERP 内所有先前退货的剩余可退数量、批次/序列号、资产或发票核销；已提交快照不是本地重新执行 ERP 验证。
- 原生对象可带其他 ERP 字段，但只投影上述已定义事实；未知顶层/上下文/覆盖字段拒绝。
- 本 profile 不混合 `rejected_qty != 0` 的拒收仓库退货；那是独立库存事实，不能并入 accepted `qty`。
- POS Sales Invoice (`is_pos=1`) 和即时付款 Purchase Invoice (`is_paid=1`) 不映射为退款。支持的发票分别要求明确 `is_pos=0/is_paid=0`。现金移动应是独立、具真实付款来源的业务单。
- 取消、草稿、无原单、无准确原行、正退货数量、数量零、正净退货金额、缺失精确覆盖及币种冲突均拒绝。
- 本适配器不把源业务状态视为银行到账证明，也不声称已经在真实 ERP 或物理打印机验证。
- Studio 项目币种沿用既有项目投影支持集合，超出时由 `createErpTransactionProject` 明确拒绝；不擅自换币。

## 离线使用与可重复验收

```js
import { createErpNextReturnProject } from './studio-v3/erpnext-return-adapter.js';
import { saveProject } from './studio-v3/file-io.js';
const project = createErpNextReturnProject(authorizedOfflineSnapshot);
const printableProjectJson = saveProject(project);
```

项目 JSON 通过 Studio Open 打开。导出的 HTML 不依赖 ERP 服务；浏览器加载到 `data-printform-status="ready"` 后可打印。

独立测试及 fixture：

- `tests/fixtures/erpnext-return.js`：明确标注虚构、按真实契约组织的离线快照；不是在线 ERP 样本。
- `tests/studio-v3-erpnext-return.test.js`：真实项目保存/重开/绑定，三种业务、两个发票库存选项、原单父/子身份、覆盖精度、不推算金额及不确定输入拒绝。
- `e2e/studio-v3-erpnext-return.spec.js`：三种业务共五个场景，从原始适配到 Studio Open → save → reopen → HTML export → 拦截 HTTP(S) 的离线 ready → A4 几何/行序 → Chromium 实际 PDF 文本和纸张尺寸。

集成验收串行运行；已有环境不重复安装。复现命令：

```sh
npm run test -- --run tests/studio-v3-erpnext-return.test.js --maxWorkers=1 --no-file-parallelism
npm run build:site
npx playwright test e2e/studio-v3-erpnext-return.spec.js --workers=1
```

### 实际集成记录：2026-10-15

- Node24 专项三文件 **157/157 passed**（原 canonical85、原始退货64、SalesReturn effects8）；完整 `build:site` **226 files / 2,351 tests passed**，runtime/site/agent publication gate 完成。
- 三引擎原始退货 **15/15 passed**，含公开模块真实动态 import、五种 Open/save/reopen/offline HTML 路径；Chromium **5 份实际 PDF**由 PDF.js 检查页数、A4尺寸、来源身份、数量和独立 USD/SGD 金额。无 retry/flaky/skip。
- 连同新纸型36、旧纸型24、canonical transaction27、settlement12，统一串行运行 **114/114 passed**；不将回归结果赋予未测试 ERP 版本或实体设备。
- 发布缺失的 `src/printform/helpers.js` leaf 后，实际浏览器可创建原始 return project；没有让 Node 代替浏览器创建项目、mock SDK 或暴露整个 source 树。
- 额外不使用任何测试 init script 的原生 Chromium：真实 Open SI stock-return 项目，`ready`、3页、inventory=inflow、accounting=decrease、page errors=[]；Print/Export enabled，截图已实际查看。离线3页与三种扩展纸型截图亦已查看。
- 额外 managed browser 的 SDK创建/文件上传成功、iframe有3页，但顶层 PREVIEW_NOT_STARTED，截图桥20s timeout；根因未确认，不冒充该工具通过。无上述注入的原生消费者及完整三引擎均通过；未扩大启动预算、忽略错误或改业务实现掩盖这个工具观察。

## 一手来源（本次契约研究）

官方使用语义：

1. [Purchase Return](https://docs.frappe.io/erpnext/purchase-return)：PR return、负数量/金额、返回原 PR、库存出库；PI return 为 Debit Note。
2. [Sales Return](https://docs.frappe.io/erpnext/sales-return)：SI return 是 Credit Note；`update_stock` 控制是否接收库存，仍减少应收；付款退款另行处理。
3. [Debit Note](https://docs.frappe.io/erpnext/debit-note)：返回 PI，减少供应商应付，库存出库仅当启用 Update Stock。

固定版本上游契约（官方 `frappe/erpnext`，v15.0.0）：

4. [通用 return 控制器](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/controllers/sales_and_purchase_return.py)：`validate_return_against` 的同公司/同 party/已提交/时间/汇率及 Sales Invoice stock 条件；`update_item` 写入真实 `purchase_receipt_item/purchase_invoice_item/sales_invoice_item`。
5. [Purchase Receipt DocType JSON](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/stock/doctype/purchase_receipt/purchase_receipt.json) 与 [Purchase Receipt Item JSON](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/stock/doctype/purchase_receipt_item/purchase_receipt_item.json)：原生 `is_return/return_against/items/qty/uom/warehouse`。
6. [Sales Invoice DocType JSON](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/accounts/doctype/sales_invoice/sales_invoice.json) 与 [Sales Invoice Item JSON](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/accounts/doctype/sales_invoice_item/sales_invoice_item.json)：`is_return/return_against/update_stock/is_pos`；`net_amount` 的 `currency` 与 `base_net_amount` 的公司默认币种分别定义。
7. [Purchase Invoice DocType JSON](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/accounts/doctype/purchase_invoice/purchase_invoice.json) 与 [Purchase Invoice Item JSON](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/accounts/doctype/purchase_invoice_item/purchase_invoice_item.json)：Debit Note 标志、原单链接、`update_stock/is_paid` 和 `purchase_invoice_item`。
8. [Purchase Invoice controller](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/accounts/doctype/purchase_invoice/purchase_invoice.py)：`on_submit` 在 `update_stock=1` 时运行库存步骤，并调用总账步骤；本地适配器仅投影其来源语义，不调用任何步骤。

官方帮助页面会持续变化；适配器源码字段支持严格锁定上述 tag，不以最新帮助页面替代固定版本字段校验。
