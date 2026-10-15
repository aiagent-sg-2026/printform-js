# 通用 supplied-facts 打印契约

状态：**Production Pilot**。本契约是独立于 ERPNext 的有限通用输入 profile，不是会计、库存或工资计算器，也不是生产工资、税务、银行或打印机认证。

## 入口与生命周期

- 非编程用户：Studio v3 → **New** → **Business demo templates** → `Account statement · 对账单`、`Stock movement · 库存移动单`、`Payroll slip · 工资明细`。三者使用同一个现有 New 对话框、编辑器、FormSpec、JSON Pointer 绑定、预览和分页器。
- 可编辑标题、字段标签、排版、样式；Save 保存包含当前事实的 `.printform.json`，Open 可重开该文件或导出的 HTML；Export 导出内联运行时的离线 HTML。Print 使用浏览器打印流程，不执行支付、出入库或过账。
- 供应方 API：`normalizeBusinessDocument(input)` 位于 `studio-v3/business-document-adapter.js`；`createBusinessDocumentProject(input)` 位于 `studio-v3/business-document-project.js`。后者返回可供既有 `saveProject` / `readProject` / `exportProject` 消费的完整项目。
- 三份完整、只含自造资料的输入：`businessDemoInput('AccountStatement' | 'StockMovement' | 'PayrollSlip')`，位于 `studio-v3/business-document-demos.js`。此函数每次返回独立的新对象；不会读员工、账户、银行、ERP 或模型数据。
- 源事实归一化时生成 `/printRows` 打印快照，不伪造 `/items`，不冒充发票总额。旧 catalogue 和旧 `/items` 本地 dataset workbench 的契约不变；本 profile 不宣称可在那个工作台保存为 legacy dataset。模板编辑、工程 Save/Open/Export 与该限制无关。
- Advanced JSON 里的源事实和 `/printRows` 是快照，不存在自动双向重算；源事实变化应重新运行 creator 并 Open 新工程，不要仅改源字段后声称打印值已更新。直接编辑工程 JSON 须同时维护真实来源与绑定快照；schema 会校验声明的打印行形状，但不能认证供应方事实或替代 canonical 输入校验。

Node 侧将三份完整虚构输入写成可 Open 的工程（需已安装仓库依赖；使用项目要求的 Node 版本；不会调用模型）：

```sh
node --input-type=module -e '
import { writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { businessDemoInput, BUSINESS_DEMO_TEMPLATES } from "./studio-v3/business-document-demos.js";
import { createBusinessDocumentProject } from "./studio-v3/business-document-project.js";
import { saveProject } from "./studio-v3/file-io.js";
globalThis.DOMParser = new JSDOM("").window.DOMParser;
for (const {documentKind} of BUSINESS_DEMO_TEMPLATES)
  writeFileSync(`${documentKind}.printform.json`, saveProject(createBusinessDocumentProject(businessDemoInput(documentKind))));
'
```


## 通用根字段

所有输入都是 plain、bounded、可无损保存的 JSON；拒绝函数、undefined、稀疏数组、循环引用、危险键、非有限数、未知 canonical 字段。错误提供 `BUSINESS_FACTS_*` code 和具体 `path`（全局 JSON 预算错误沿用现有导入边界）。

| 字段 | 约束 |
| --- | --- |
| `profile` | exact `supplied-business-v1` |
| `source` | `{system, documentType, id, number}` 必填；可选 `currency,date,partyId,companyId`，与既有 source reference 形状相同 |
| `company` | `{id,name}` 必填，可选 `address` |
| `document` | `{kind,number,date}` 必填；`kind` 为下述三个 exact 类型；可选显式 `status` |
| `document.currency` | 对账单和工资必填，库存无金额可省略；有限 Studio 币种 `MYR,USD,SGD,EUR,CNY,JPY` |
| `notes` | 可选供应原文；省略不补默认事实 |

日期必须是实际存在的 `YYYY-MM-DD`；期间 `{from,to}` 不可倒置。每个数组最多 500 个元素；业务行/事实 ID 在同一输入内唯一。

金额结构：`{amount,currency,minorUnitDigits,provenance:{sourcePath,meaning}}`。`amount` 必须是十进制**字符串**；精度声明 `0..6`，沿用现有 exact-decimal parser 的安全 minor-unit 范围和非零超精度拒绝规则。保留原始符号、分组、前导零、尾零和字符串；打印为 `currency + ' ' + amount`，不经 Intl 再格式化，不乘、加、相减或补零。原文尾零可以多于声明精度，但非零超精度值拒绝。所有金额必须与当前单据币种一致；此 profile **不支持同一对账单混合币种**，请按币种供应独立文档，不做 FX。

金额事实结构：`{id,label,role,basis,amount}`，其中 `basis` 必须显式说明金额含义/口径，不能只靠字段名称猜测。`provenance` 指向供应方字段及原始含义。金额正负号不推定 debit/credit、收付状态、工资扣减或库存方向。

## AccountStatement：对账单

仅允许 `statement` 分支，不允许 stock/payroll 混入。

- `party:{id,name,role,address?}`，role 为 `customer|supplier|other`。
- `account:{id,name,basis,debitMeaning,creditMeaning}`；basis 为 `receivable|payable|other`，借贷含义必须由来源明确供应，不能按客户/供应商名称猜测。
- `period:{from,to}`。
- `entries:[{id,date,reference,description,dueDate?,amounts:[金额事实]}]`。每行至少一项金额，role 仅 `debit|credit|balance`。日期在账期内。`reference` 使用上述 source reference；如供应 party/company/currency，必须匹配当前上下文。
- 可选 `balances:[金额事实]`，role 仅 `openingBalance|closingBalance`。没有供应的余额不会算出、补 0 或依据条目推测。
- 空 entries 允许，但至少须有一个供应余额；完全没有业务事实的标题式“对账单”拒绝。
- 不生成账龄、逾期状态、银行清算、付款状态，不替来源对账。故意不相加吻合的快照也照实保留，不把打印器当审计/账务证明。

## StockMovement：库存移动单

仅允许 `stock:{purpose,lines}`，lines 非空。

每行：`{id,item:{id,code?,name?},description,direction,quantity,from?,to?,batch?,reference?}`。

- direction 为显式 `inflow|outflow|transfer`，不从标题或数量符号推断。
- `quantity:{amount,decimalPlaces,uom,provenance:{sourcePath,meaning}}`；amount 必须为原始十进制字符串，decimalPlaces 0..6，保留来源符号和原文，不进行 UOM 换算。
- `from/to:{id,name?,bin?}`。inflow 仅供 to，outflow 仅供 from，transfer 两者必填且位置不同；同仓不同 bin 可明确表示。
- 可选 batch 和单独来源 reference 原样保留。不推导实存量、已保留量、估价、税、账款影响，不将不同 UOM 相加；不是完整序列号、生产 BOM 或库存过账协议。

## PayrollSlip：工资明细

仅允许 `payroll` 分支。

- `employee:{id,name,department?,jobTitle?}`；本仓库 New 样张仅有明确虚构员工。canonical 不接收 employee 银行字段；禁止以真实员工/银行记录测试样张或送入 Demo 模型。creator 本身没有网络或模型调用。
- `period:{from,to}`，可选显式 `payDate`；日期不是实际支付成功证明。
- 非空 `components:[金额事实]`，role 为 `earning|deduction|employerContribution`。雇主成本与员工扣款、净薪酬明确区分。
- 可选 `summary:[金额事实]`，role 为 `gross|deductions|netPay|employerContributions`。未供应 gross/net 不由明细计算；不从金额猜付款状态。
- 不计算工时×费率、税、社保、养老金、工资法合规，也不连接员工系统、银行或支付平台。

## 绑定保护与规格入口

打印金额/数量列使用绑定 `items-amount → ./amount`，collection 固定初始 `/printRows`，format 为原文空格式；沿用现有 `financialField`、`protectedBindings`、`assertProtectedBindings` 和 `parseChatReply` 消费链。不是新增金融识别/打印引擎：现有保护会拒绝该金融列的重新绑定、改成 static、改格式及保留字段时更换 collection；允许纯样式修改。受保护字段允许既有结构删除语义，不宣称不可编辑的人类数据权限。

- 单元消费者规格：`tests/studio-v3-business-document.test.js`，覆盖 canonical invalid 拒绝、原文精度/符号、缺事实不补值、真实 binding/save/read、人工设计/Undo，以及模型金融改写拒绝。
- 浏览器消费者规格：`e2e/studio-v3-business-document.spec.js`，覆盖现有 New、定制 supplied input Open、Save/reopen、离线 Export、导出 HTML 重开、原始来源金额顺序和几何；Chromium 产出实际 PDF 并提取来源金额。没有接口 mock 或测试用 fixture 副本。
- 实际独立构建（2026-10-16）：Node24 `npm run build:site` **232文件/2521项通过**；本规格 **Chromium/Firefox/WebKit共9/9、0重试通过**，包括实际New、供应Open/Save/reopen、禁网络file-URI HTML、原金额/数量顺序与几何，以及3份Chromium实际PDF。Chromium sandbox开启；不把PDF支持外推到另外两个引擎。

未认证边界：任意 ERP raw 数据、混合币种对账、自动 reconciliation/aging、库存流水计算、生产工资/法定税务、银行/员工权限隔离、真实打印机和所有长文本/超大输入组合。先授权、脱敏并执行现有数据合规门禁；虚构样张不是生产数据许可。

## 已读取的官方研究与非合规边界（2026-10-16）

- [OASIS UBL2.4 Statement](https://docs.oasis-open.org/ubl/os-UBL-2.4/mod/summary/reports/UBL-Statement-2.4.html)：对账单表示账户状态，不是汇总发票；区分账期、单据引用、借贷与余额。当前profile保留供应事实，不宣称UBL XML适配或一致性认证。
- [OASIS UBL2.4 InventoryReport](https://docs.oasis-open.org/ubl/os-UBL-2.4/mod/summary/reports/UBL-InventoryReport-2.4.html)：库存状态报告与库存移动流水不同；本样张是显式方向及位置的移动单，不冒充库存报告标准或库存记账系统。
- [GOV.UK Payslips](https://www.gov.uk/payslips)：官方资料区分扣减前后收入、变动扣减及与工时相关的报酬披露。这里只据此区分来源字段；不把英国要求套用于MYR样张，不宣称满足任一司法辖区全部工资法规。

三个canonical类型是有限、已声明的输入契约；任意ERP raw JSON、所有本地法定格式与其他行业文档仍须显式映射及业务审核。通用Studio不依赖ERPNext，也不因增加三个样张就成为全球事务/法规认证器。

