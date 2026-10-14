# Globe3 PCAR / CCAR 业务与打印导入契约

## 1. 覆盖范围与状态

本契约区分已实现的纯数据适配、打印项目投影和未实现的生产连接。状态仍为 **Production Pilot**：没有 live ERP 连接、会计入账、税务认证或物理打印认证；不能据此宣称支持所有 ERP 版本和格式。

- PCAR＝Progress Claim Account Receivable；Globe3 存储类型为 `entp_pbill`。
- CCAR＝Certified Claim Account Receivable；Globe3 存储类型为 `entp_pcar`，不是按字面将 PCAR 映射到同名表。
- 已实现 raw CCAR 的限定 financial-tab 适配与打印项目生成。
- 已实现 **canonical PCAR** 净额打印项目，以及 [raw PCAR / SO work-done](ERP_RAW_PCAR_WORK_DONE.zh-CN.md) 精确 join、限定基准 gross movement 与 `/valuations` 项目。上游仍负责授权、完整 prior snapshot 与净额规则；不声称完整 raw PCAR main financial 或所有客户版本适配。
- 虚构 catalogue 的 `newDemoProject('PCAR'/'CCAR')` 与真实输入 API 是不同入口，不能用示例通过证明真实 ERP 已验收。

## 2. 业务基准与链路

已知链路为 `entp_pbud → entp_pbill → entp_pcar → sal_inv`，主单据存于 `scm_sal_main`。子单据 `uniquenum_sec` 指向父单据 `uniquenum_pri`；CCAR 的父单据为 PCAR。来源编号、期间、认证人不能仅凭 ID 推导。

### PCAR 两种明确选择的 profile

| `claim.basisProfile` | Previous / Current / Cumulative 的含义 |
| --- | --- |
| `globe3-prior-certified` | Previous 为匹配的前期 CCAR 累计认证；Current＝当前 PCAR 累计估值−前期累计认证；Cumulative 为当前累计估值 |
| `globe3-stored-last-claim` | Previous 为已存 Last Claim；Current＝Work Done−Last Claim；Cumulative 为 Work Done。它是独立历史模板规则，不等同于“前一期申请”或自动证明为前期认证 |

上游负责匹配正确的前期认证及口径。prior-certified 的本期 retention/on-hold 同样采用累计值相减的 movement；已经得到本期净额后，**不能再次扣除前期认证额**。累计至本期应付的桥接与本期 movement 是两种展示口径，不能重复扣减。月度 DO 明细与累计 work-done summary 也不能混为同一统计期间。

保留款比例、上限、释放、advance、on-hold、扣款和税由合同及 ERP 决定，不设通用 5% 或统一税率。`scm_sal_main.creditterm_desc` 须保留交易快照，不能从客户主档或 `creditterm_days` 推导 `dueDate`。

## 3. raw CCAR 输入契约

入口文件：`studio-v3/globe3-claim-adapter.js`，导出 `adaptGlobe3CertifiedClaim({ header, tabData, context })`。

### Header 与 context

- 必需 header：`uniquenum_pri`、`dnum_auto`、`dnum_master`、`dnum_reference`（可为空字符串）、`date_trans`（有效 ISO 日期）、`curr_short_forex`、`curr_decimal`。
- `tag_table_usage` 或 `cslsegm` 至少有一个明确为 `entp_pcar`；每个提供的类型字段必须一致。
- 可选 `uniquenum_sec`、`dnum_revision`、`creditterm_desc`；若提供 `tag_datasource`，只接受 `entp_pbill`。
- context 必需 `company/customer/project`，各有 `{ id, name }`，以及 `period: { from, to }`，日期有效且先后正确。
- 可选 `certification: { applicationId, applicationNumber, date, certifiedBy, status }`；提供时所有字段必需，applicationId 须与提供的父单据 ID 一致。
- 可选 `receivable: { paidAmount?, outstandingAmount?, currency? }`；币种必须一致，只有一个余额字段也可，未提供的保持缺失。
- 明确选择 `numericSlotPrefix: 'num_20_2_d0_'` 或 `'num_20_2_d_'`；实现默认 d0，但集成端应显式声明已验证的 profile。

服务端必须先按 authenticated company/document 和非删除范围查询并授权；适配器不查询数据库、不猜删除字段，也不以客户端 company ID 代替授权。提供的 `companyfn`、party/project ID、document envelope 必须与 context 一致。

### Financial tabs

`tabData` 是上游预筛选且有序的 `trans_tab_data` 记录数组，恰有一个 main `entp_pcar` block。每个 block 的 `uniquenum_pri` 都是同一单据外键，**不是各 block 独立行 ID**。

main 的 `var_100_001..010` 与选定 numeric prefix 的对应金额十个槽位均必需，固定角色依次为：

`contractValue / workDone / variation / subtotalA / retention / subtotalB / previousCertified / subtotalC / tax / total`

| section | 接受范围与含义 |
| --- | --- |
| `entp_pcar_mb` | 最多十对原标签/金额，additional variation detail |
| `entp_pcar_mc` | 最多十对原标签/金额，有符号 additional C / advance 类条目，逐项保留，不假设永为正 |
| `entp_pcar_mk` | 第一槽：contract omission |
| `entp_pcar_mm` | 第一槽：contract variation |
| `entp_pcar_mn` | 第一槽：work-done omission |
| `entp_pcar_mp` | 第一槽：on-hold |

保留原标签、顺序、金额、section、sourceRowIndex、sourceSlot 和 source column。额外区块的空标签零槽位可忽略；非零金额缺标签、空 block、缺金额、未知 section、超支持槽位会拒绝。两套 numeric columns 若同时存在且金额冲突，会拒绝；选定 profile 缺必要金额不回退到另一套。四槽 main、reserved tabs、非财务 tabs 和 work-detail tabs 不属于本 API，须在上游投影或另行实现，不可静默当作已支持。

结果为 `{ document, claim, certification?, financialRows, summary, context }`；summary 保留 raw/minor/display 金额。`claim.accountingRecognition` 为 `not-assessed`，total 是证书金额而非自动认定账面余额。没有 `paidAmount/outstandingAmount` 时不补零、不以 total 推导。

CCAR 没有自身 `scm_sal_data` 商品行，因此打印 collection 使用 **`/financialRows`**，不伪造 `/items`。AR work-done 的 `wd_detail_soc` 可以引用 SO confirmation 与 SO detail；AP 的 `wd_detail` 是另一分支，不能互换，当前 raw financial adapter 不完成这些明细 joins。

## 4. Canonical PCAR 输入契约

入口文件：`studio-v3/globe3-claim-project.js`，导出 `createGlobe3ProgressClaimProject(canonicalData)`。

必需：

- `document.kind: 'PCAR'`、`document.sourceType: 'entp_pbill'`、`document.minorUnitDigits`、`document.currency`、打印使用的 `document.number/date`。
- 明确的 `claim.basisProfile`（上述两种之一）；可选 `previousCertificateNumber` 只作上游提供的标识。
- `company.name`、`customer.name`、`project.name` 等模板所需上下文。
- `items` 数组，每行提供 `no`、`description` 等模板所需字段，以及 **`previousWork/currentWork/cumulativeWork/amount`** 四个金额。
- `summary.previousClaim/currentClaim/cumulativeClaim/retention/tax/total` 六个金额。
- 可选 `summary.onHold/paidAmount/outstandingAmount`；提供 `summary.currency` 时须与 document 一致。可选 `document.creditTerms` 保留交易快照。

金额是主币单位十进制值，**不是传入 minor-unit 整数就自动缩放**。creator 不计算 current、retention、税或净额，也不审核等式是否符合合同；这些数值由上游 ERP 正确提供。

## 5. 可用导入 API 与快照生命周期

下例在已安装本仓库依赖的 **Node 或 bundler 集成端**执行；creator 复用 Studio 编译/验证依赖，不是浏览器可直接裸 import 的独立包。输入来自集成端已授权取得的 JSON，而不是浏览器直连数据库；路径相对仓库根目录。

```js
import { adaptGlobe3CertifiedClaim } from './studio-v3/globe3-claim-adapter.js';
import {
  createGlobe3CertifiedClaimProject,
  createGlobe3ProgressClaimProject
} from './studio-v3/globe3-claim-project.js';
import { saveProject } from './studio-v3/file-io.js';

// rawCertifiedInput = { header, tabData, context }，满足 §3。
const normalized = adaptGlobe3CertifiedClaim(rawCertifiedInput);
const certifiedProject = createGlobe3CertifiedClaimProject(rawCertifiedInput);
// canonicalProgressInput 满足 §4；上游已解析基准和所有金额。
const progressProject = createGlobe3ProgressClaimProject(canonicalProgressInput);

// 将任一个返回的 portable project 保存为 .printform.json，使用 Studio Open。
const portableJson = saveProject(certifiedProject);
```

`createGlobe3CertifiedClaimProject(rawInput)` 内部调用 raw adapter，返回可 Open/save/export 的项目，不是 dataset workbench 导入记录。若宿主使用 command bus，应以 `createBus(project, null, 'imported-data')` 标记来源，而非声明 demo provenance。

**金融打印字符串是不可变投影快照（业务使用约束，不是对象冻结）**：CCAR 绑定 `financialRows.displayAmount` / `summary.displayAmounts`，PCAR 绑定行和根 `printAmounts`。金额、币种或精度变化后，应重新从 ERP 刷新输入、再运行 creator 并保存新项目。仅在 JSON 编辑器改 raw 数字，不会重新生成格式化投影；不能将其当作货币计算引擎或自动同步 ERP。

Studio Open/save/独立 HTML export 的 portable project 路径与旧本地 dataset workbench 不同：workbench 仍要求 `items`，**未认证用于 raw financial-ledger datasets**。不要为通过旧导入器伪造商品行。

## 6. 金额、精度和兼容性限制

纯 normalizer 接受来源精度整数 **0..6**，十进制字符串（含合法千位逗号）或有限 number；不接受指数表示、非法金额、超过精度的非零尾数、安全整数 minor-unit 范围外或不能由 binding number 保真的数值，不进行静默四舍五入。建议集成端保留数据库 decimal 字符串。

Studio creator 当前仅可 round-trip `MYR / USD / SGD / EUR / CNY / JPY` 六币种；不要将 normalizer 的 currency 字符串能力扩展解释为 Studio 支持任意币种。缺失/冲突/不支持 profile 或变体会给出明确 `GLOBE3_CLAIM_*` 错误，必须修正来源契约，不以填零或选择熟悉格式规避。

保留已有用户记录：corrected-basis migration 新增独立标识的虚构示例，不覆盖用户编辑或旧数据。选择 dataset 同时检查精确业务 kind、basisProfile 与 collection；旧 previous-application 示例不能因同为 PCAR 被当成 corrected prior-certified 数据。Restore starter datasets 仍是独立操作。

## 7. 来源与证据边界

### 内部知识库（仅引用证据 ID，不复制客户资料）

| 依据 | KB base / item |
| --- | --- |
| prior-certified PCAR movement 与不重复扣减 | `82ebf7fd-6f91-4d7b-baba-9f006fb34362` / `8bbb1325-888f-42b4-a18a-31f63c2d1654` |
| CCAR main/header/financial schema | `3e0af142-1e70-459d-b5e1-0923d3b02f52` / `f37e5b36-1558-4bbf-9d43-5f067c846524` |
| 四阶段链路与 parent pointer | 同一 base / `4da4d96e-e7c2-4542-bd13-261a433b90a4` |
| trans_tab_data schema/document FK/company scope | 同一 base / `9ceec8ba-57fd-479f-925c-5e7d7a8780ee` |
| AR wd_detail_soc 与 AP 分支区分 | 同一 base / `26e2618c-52f4-49df-af73-cc5c86dc4c82` |
| stored Last Claim、月度/累计、payment terms 快照 | 同一 base / `21bb206a-5a94-4f61-8d71-a7079e282696` |

### 公开一手依据

- [CIDB 2022 建筑工程标准合同指南（2024-10）](https://www.cidb.gov.my/wp-content/uploads/2024/10/GUIDE-FAQs-ON-THE-CIDB-SFOC-BUILDING-WORKS-2022-Edition-Published-October-2024.pdf)：估值/证书、前期认证扣减及合同定义的 retention 比例、上限、释放；不是本产品的认证，也不是通用固定比例依据。
- [AIA G702 官方产品说明](https://designshop.aia.org/products/g702-1992-application-and-certificate-for-payment)：申请和 architect certification 可有差异；“previous payments”措辞不能替所有地区/合同规定 previous-certified 基准。
- [IASB 2015 staff paper 引述 IFRS 15 §108](https://www.ifrs.org/content/dam/ifrs/meetings/2015/december/iasb/clarifications-to-ifrs-15/ap07h-revenue-from-contracts-with-customers.pdf)：无条件权利仅余时间流逝的原则。staff paper 不是完整准则或个案法律意见，不能把 PCAR/CCAR provisional balance 自动称为 booked AR 或已确认收入。

代码事实来源：上述 adapter/project 文件、`studio-v3/globe3-claim-money.js`、`studio-v3/claim-basis-seed.js` 和 `studio-v3/database-model.js`。基线完整构建 **215 files / 2,022 tests passed**、PCAR/CCAR 三浏览器打印 **12/12 passed** 见 [审计 §7](ERP_PRINT_AUDIT.zh-CN.md#7-globe3-claim-契约后续修正2026-10-14)；新增 raw PCAR 独立构建 **217 files / 2,072 tests** 与 **6/6** 浏览器旅程见 [raw 契约 §8](ERP_RAW_PCAR_WORK_DONE.zh-CN.md#8-选项-1-独立验收)。检查使用自行编造输入，不宣称已连接或验收真实客户 ERP。
