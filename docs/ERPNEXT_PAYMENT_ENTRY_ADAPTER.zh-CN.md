# ERPNext 15.0.0 Payment Entry 原始快照适配（Pilot）

## 固定来源与边界

此适配是离线原始 JSON → canonical `BankReceipt`／`BankPayment` → Studio v3 便携项目，不连接 ERP，不执行付款、过账、核销、FX、余额或总额计算。素材全部 **fictional**。不认证真实 ERP 实例、银行到账、硬件或其它 ERPNext 版本。

2026-10-15 阅读的官方固定 tag 源码：

- [Payment Entry DocType](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/accounts/doctype/payment_entry/payment_entry.json)：Receive／Pay／Internal Transfer、paid_from/to 及各自账户币种、references、deductions、税、状态、银行参考。
- [Payment Entry controller](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/accounts/doctype/payment_entry/payment_entry.py)：`setup_party_account_field`、`set_status`、`on_submit`、`validate_reference_documents`、`get_reference_details`、`set_unallocated_amount`、`add_deductions_gl_entries`、`set_remarks`。
- [Payment Entry Reference](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/accounts/doctype/payment_entry_reference/payment_entry_reference.json)：原生父子身份、reference_doctype/name、allocated/outstanding/total_amount、account、payment_term；这些 Float 字段本身不证明发票币种。
- [Payment Entry Deduction](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/accounts/doctype/payment_entry_deduction/payment_entry_deduction.json)：`amount` 明示 Company Currency；account／cost_center／description 独立保留。
- [Accounts Controller](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/controllers/accounts_controller.py)：`validate_currency`／`validate_party_account_currency` 的账户与发票币种边界；发票账户与document currency不同还涉及真实上游Accounts Settings／party ledger上下文。不同发票币种的本适配分支限公司本位币 party account；不推断其它外币 party account 的会计适用性。Payment Entry controller 的 `get_allocated_amount_in_transaction_currency` 也明确原生allocation与发票币种并非恒同。

固定版本由调用者声明并提供有权导出的快照；本地声明检查不构成源服务器真实性或授权证明。

## API 与真正的消费入口

```js
import {
  adaptErpNextPaymentEntry,
  createErpNextPaymentEntryProject
} from './studio-v3/erpnext-payment-adapter.js';
import { saveProject, readProject } from './studio-v3/file-io.js';

const facts = adaptErpNextPaymentEntry(input);
const project = createErpNextPaymentEntryProject(input);
const serialized = saveProject(project);
const reopened = readProject(serialized);
```

公开静态站点也可 `import('/studio-v3/erpnext-payment-adapter.js')`。将 serialized 保存成 `.printform.json`，使用现有 Studio **Open → Save → Reopen → Export**；导出的单 HTML 可在网络请求全部被阻断时 `file:` 打开并由现有 runtime 排版／打印。没有新数据库入口或伪 ready 状态。

`adapt…` 输出真实 canonical 规范化结果，额外 `erpnextEvidence` 保存原始 document、原始 invoice/account/company 快照、exact 金额、precision 元数据、授权补充 settlement 与原生汇率。项目 sampleData 保存同样证据。证据不是另一个 canonical 输入 profile；再次交给 canonical normalizer 前须使用原始 canonical 输入，而非带派生 displayAmount／printRows 的输出。

## 输入结构

| 顶层字段 | 要求 |
| --- | --- |
| `profile` | 固定 `erpnext-payment-entry-v15.0.0-exact-v1`。 |
| `context.erpnextVersion` | 固定 `15.0.0`。 |
| `context.company` | 原生 Company：doctype／name／company_name／default_currency；name 必须等于 document.company。 |
| `context.accounts` | 原生 Account 数组；活动 leaf（is_group=0、disabled=0），独立 name／company／account_currency／account_type；现金侧必须 Bank，party 侧分别 Receivable／Payable；deduction 科目币种必须本位币。 |
| `context.precisionMetadata` | `{fields, provenance}`；fields 以 exact 路径为 key，供应实际导出的动态字段精度。provenance 为非空 `{sourcePath, meaning}`。 |
| `document` | 原生 Payment Entry；Receive+Customer 或 Pay+Supplier；`docstatus=1` 且 `status='Submitted'`；有效 posting_date、两侧原生账号／币种、正汇率与金额。 |
| `invoices` | 完整授权发票快照数组，必须恰好包含所有引用；Sales Invoice 或 Purchase Invoice，submitted、非 return，同 company／party／party account，保存原发票 currency／party_account_currency。 |
| `exact` | 每个消费金额的独立精确覆盖，见下节。 |
| `settlements` | 可选，以 **原生 reference child.name** 为 key 的授权补充事实。不可用 ordinal／发票显示编号代替 child identity。 |

`document.references`、`deductions`、`taxes` 必须显式数组；纯预收／预付使用真实空 references 与空 invoices。每条原生 child 的 doctype、name、parent、parenttype、parentfield 都逐项核对。invoice 通过 `(reference_doctype, reference_name)` 精确匹配原生 doctype/name，不按顺序或显示编号 join。重复 native child、无 payment_term 的重复发票引用、未使用 invoice／settlement 均拒绝。

有限 profile 明确拒绝 Internal Transfer、退款方向、其它 party 类型、draft/cancelled/status 矛盾、return invoice、未来发票、term-based payment schedule、独立预收科目记账，以及 Payment Entry taxes／自动 withholding。`book_advance_payments_in_separate_party_account` 与 `apply_tax_withholding_amount` 必须原生 0；taxes 必须 []，非零税汇总不能静默忽略。拒绝不代表 ERP 不支持，而是本 profile 未证明这些语义。

## 金额、精度与 provenance

每个 exact key 是实际对象路径，例如 `document.paid_amount` 或 `document.references[1].allocated_amount`：

```js
exact['document.references[1].allocated_amount'] = {
  amount: '125.000', currency: 'USD', precision: 3,
  provenance: { sourcePath: 'authorized-exact-export:PE/ref-2/allocated_amount',
    meaning: 'Exported native party-account allocation, with field precision metadata' }
};
context.precisionMetadata.fields['document.references[1].allocated_amount'] = 3;
```

- 原始字段同时必须是有限 JSON number；精确十进制字符串是权威值，number 仅做一致性检查，不拿它生成精确金额。
- exact.currency 必须匹配原生字段账户／公司币种；precision 必须与独立 precisionMetadata 一致。精度 0–6、非零超精度、安全 minor integer、JSON 丢失风险等复用现有 settlement／claim exact-money 校验。不四舍五入、不设默认两位。
- 必需覆盖 paid_amount、received_amount、difference_amount、total_allocated_amount、unallocated_amount 与每条 reference.allocated_amount、deduction.amount。
- 若原始快照包含 base_paid_amount／base_received_amount／base_total_allocated_amount、paid_amount_after_tax／received_amount_after_tax、reference outstanding_amount／total_amount／exchange_gain_loss，也必须提供对应 exact。
- 未消费 exact 或 precisionMetadata key 报错，不默默扔掉额外金额事实。原始快照其它未映射字段仅作为来源证据保存，不声明具有打印语义。
- `difference_amount` 在 submitted 快照必须精确为零（官方 on_submit 要求），**绝不是 FX gain/loss**。base 金额与原生汇率仅保存证据，不换算成另一个币种或重算一致性方程。
- canonical money 可携同一 `{sourcePath, meaning}` provenance；原始字符串与声明精度在 sampleData／save/reopen 中保留。displayAmount 使用既有精确显示规则，不强迫保留无意义的前导零。

## 逐字段映射与币种不混用

| 原始来源 | canonical／打印含义 |
| --- | --- |
| Receive: received_amount + paid_to_account_currency | cashMovement.amount，inflow；document.currency 为真实 cash currency。 |
| Pay: paid_amount + paid_from_account_currency | cashMovement.amount，outflow。 |
| 另一侧 paid_amount／received_amount | cashMovement.sourceAmount，来源 party 侧独立金额，不冒充 cash。 |
| Receive paid_from；Pay paid_to | `partyAccount {id,currency,provenance}`，并核对实际原生 Account。 |
| reference.allocated_amount | `partyAppliedAmount`，必须使用 partyAccount.currency；即使 invoice.currency 不同，也不改标币种。 |
| invoice.currency 等于 partyAccount.currency | 同一原生 allocated 可映射 invoiceAppliedAmount，仍保留 partyAppliedAmount 的独立语义。 |
| invoice.currency 不同 | 必须额外供应 `settlements[child.name].invoiceAppliedAmount`（正金额、发票币种、precision、provenance）；绝不拿 exchange_rate 做本地 FX。 |
| total_allocated_amount | summary.partyAllocatedAmount，party-account currency；不是 cash applied 或发票跨币求和。 |
| unallocated_amount | summary.partyUnappliedAmount，party-account currency；不是 cash unapplied 或 invoice outstanding。纯外币预收／预付同样可用。 |
| deductions[].amount | adjustments kind=other、affects=ledger，**公司本位币**；label 保留原生 description，缺失则明确 unclassified。不凭科目名推断 bankFee／withholding／FX。 |
| reference outstanding_amount／total_amount | exact evidence，**不是 invoiceBalanceBefore**。controller 可在提交后刷新 reference details。 |
| bank reference_no/date、mode_of_payment、cash account | 仅映射实际提供的银行上下文，不用 clearance_date 造银行已清算状态，不造 approval。 |

跨发票币种 supplemental money 使用 canonical `{amount,currency,minorUnitDigits,provenance}`。可额外供应 `remainingAmount` 和 `state: full|partial`；余额使用 invoice currency，full/partial 与供应零／非零余额矛盾会拒绝。缺失状态／余额不补算；未供应 invoiceClearedAmount，不把 allocated 冒充已核销。

例如虚构跨币 case：party USD、cash MYR、company USD；第二张原发票 EUR，原生 reference allocated USD 125.000，授权 invoice applied EUR 100.000、remaining EUR 60.000。它们均是各自供应的事实，不在本地求汇率。另一组 case 的 company SGD、party USD、cash MYR 保存三个不同币种。

为支持真实原生 unallocated，canonical 最小增加 partyAccount、allocation.partyAppliedAmount 与 summary.partyAllocatedAmount／partyUnappliedAmount。旧 `summary.unappliedAmount` 仍只代表 **cash currency**，未弱化；新增 party facts 必须有明确 partyAccount 与 provenance，币种必须一致。详见 [canonical 契约](ERP_SETTLEMENT_BUSINESS_CONTRACT.zh-CN.md)。

## 可执行消费验收与证据状态

- `tests/fixtures/erpnext-payment.js`：六个 fictional Receive／Pay，多发票 full+partial、公司/party/cash 独立币种、ledger deduction、纯 advance/prepayment，以及授权 invoice currency 不同的收／付款。
- `tests/studio-v3-erpnext-payment.test.js`：真实 API → project → save/read → DOM binder，金额／精度／provenance、原发票身份、未推断事实与矛盾拒绝。
- `e2e/studio-v3-erpnext-payment.spec.js`：浏览器公开 import → UI Open → Save → Reopen → Export → 禁 HTTP(S) 的 file: 离线 runtime → 实际 Chromium PDF 页树／物理尺寸／文字／坐标；Firefox/WebKit 使用真实浏览器几何与文字消费，不伪造 PDF。

以下为实际集成入口；新增测试的存在不等于通过，结果单列记录：

```sh
npx vitest run tests/studio-v3-erpnext-payment.test.js tests/studio-v3-erp-settlement.test.js tests/studio-v3-erp-transaction.test.js tests/studio-v3-erpnext-return.test.js
npm run build:site
npx playwright test e2e/studio-v3-erpnext-payment.spec.js e2e/studio-v3-erp-settlement.spec.js --workers=1
```

实际before：旧canonical normalizer接收完整原始fixture报`ERP_SETTLEMENT_FIELD`/`input.context`；公开站点`/studio-v3/erpnext-payment-adapter.js`返回404。新适配不是给canonical fixture换名；原始doctype/parent/child/账户/发票及授权exact输入实际进入映射。只给最小profile的另一错误分支不替代完整原始输入证据。

## 实际集成记录（2026-10-15）

- 专项原生Payment、settlement、transaction、return四文件 **247/247通过**；新原生Payment38项。首次仅旧advance断言固定单字段错误path失败；删除过期定位断言，保留缺少unapplied事实必须ADVANCE拒绝，不改钉新path或放宽cash/party币种。
- Node24完整 **228文件/2406项通过**，runtime/site构建完成，agent gate13tools/13operations/2skills/76examples/28changes全部reviewed；未改baseline、grant或JSON/财务边界。浏览器/PDF/实际UI结果依据另行执行，不从unit通过推断。
- 无任何test init script的原生Chromium实际Open→Save→Reopen→Export→禁HTTP(S)的file:消费：**ready/2页/7条供应事实/0 pageerror**，UI Quality0 issues；MYR1000.000、partyUSD、USD100/100/0、EUR100、USD125、EUR60及USD1.234与源printRows逐项一致，两份真实PNG已查看。
- 另用managed浏览器打开同一导出HTML，实际ready及MYR1000.000文字可读；该工具screenshot在既有20s上限超时，根因未确认，未增预算/重试或冒称截图通过，随后关闭页签。原生实际PNG证据与工具失败分开记录。
- 完整三引擎原生Payment **18/18通过**，六份实际Chromium PDF验证A4页树/物理尺寸/金额与ID/日期/坐标；Open/save/reopen/offline不是mock调用。另含新Letter/Legal48、旧settlement12、transaction27、原始return15，总计五文件 **120/120通过、0retry/0skip/0fail**。归档`/tmp/printform-payment-entry-acceptance-20261015.tar.gz`保留实际导出、PNG与PDF。
