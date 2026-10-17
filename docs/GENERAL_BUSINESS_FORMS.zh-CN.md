# 通用 supplied-facts 打印契约

状态：**Production Pilot**。本契约是独立于 ERPNext 的有限通用输入 profile，不是会计、库存或工资计算器，也不是生产工资、税务、银行或打印机认证。

## 入口与生命周期

- 非编程用户：Studio v3 → **New** → **Business demo templates** → 对账单、库存移动单、工资明细、服务记录、装箱单、检验报告或资产交接。七者使用同一个 New 对话框、编辑器、FormSpec、JSON Pointer 绑定、预览和分页器。
- 可编辑标题、字段标签、排版、样式；Save 保存包含当前事实的 `.printform.json`，Open 可重开该文件或导出的 HTML；Export 导出内联运行时的离线 HTML。Print 使用浏览器打印流程，不执行支付、出入库或过账。
- 供应方 API：`normalizeBusinessDocument(input)` 位于 `studio-v3/business-document-adapter.js`；`createBusinessDocumentProject(input)` 位于 `studio-v3/business-document-project.js`。后者返回可供既有 `saveProject` / `readProject` / `exportProject` 消费的完整项目。
- 七份完整、只含自造资料的输入：`businessDemoInput('AccountStatement' | 'StockMovement' | 'PayrollSlip' | 'ServiceReport' | 'PackingList' | 'InspectionReport' | 'AssetHandover')`，入口仍为 `studio-v3/business-document-demos.js`，服务/物流及检验/资产资料在独立模块内。每次返回独立新对象，不读取真实业务系统或模型资料。
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

## 紧凑 A4 纸面

五个 supplied-facts creator 使用封闭的 `supplied-facts` 预设；原商业单据预设及分页引擎不变。四列元数据、通栏说明、局部紧凑留白与按业务分配的追踪列宽，保留全部六列、完整来源与边界说明。正文保持9pt，追踪文字8.5pt；不隐藏、裁切或缩放整页来假装单页。

2026-10-16的三类组合快照实际三引擎 **9/9、零重试**通过，新建、定制来源Open、Save/reopen、禁网络离线HTML、导出HTML重开与文字/几何守恒均执行；当时三份标准样张及Chromium实际三份PDF各1页。长来源/备注或更多行允许正常分页，不保证任意输入都一页。

失败记录保留：第一次局部布局仍令工资说明独占末页；先行局部CSS实测后才加入专用预设。PDF提取的行内换行和CJK兼容字形不算来源丢失：DOM核对原文，金额/主来源token仅忽略提取换行，描述按NFKC字形等价检查。Firefox导入后先等本次真实render消息再进入iframe，不加重试或产品超时。[纸面验收证据](acceptance/STUDIO_V3_COMPACT_BUSINESS_20261016.json)。


## 通用根字段

所有输入都是 plain、bounded、可无损保存的 JSON；拒绝函数、undefined、稀疏数组、循环引用、危险键、非有限数、未知 canonical 字段。错误提供 `BUSINESS_FACTS_*` code 和具体 `path`（全局 JSON 预算错误沿用现有导入边界）。

| 字段 | 约束 |
| --- | --- |
| `profile` | exact `supplied-business-v1` |
| `source` | `{system, documentType, id, number}` 必填；可选 `currency,date,partyId,companyId`，与既有 source reference 形状相同 |
| `company` | `{id,name}` 必填，可选 `address` |
| `document` | `{kind,number,date}` 必填；kind 为上述七个 exact 类型之一；原三类可选显式 status，其余四类状态须放入各自带来源的分支 |
| `document.currency` | 对账单和工资必填，库存无金额可省略；有限 Studio 币种 `MYR,USD,SGD,EUR,CNY,JPY`。服务/装箱/检验/资产交接不接收 source/document currency，不推入金融事实 |
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

每行：`{id,item:{id,code?,name?},description,direction,quantity,from?,to?,batch?,reference?,tracking?}`。

- direction 为显式 `inflow|outflow|transfer`，不从标题或数量符号推断。
- `quantity:{amount,decimalPlaces,uom,provenance:{sourcePath,meaning}}`；amount 必须为原始十进制字符串，decimalPlaces 0..6，保留来源符号和原文，不进行 UOM 换算。
- `from/to:{id,name?,bin?,provenance?}`。inflow 仅供 to，outflow 仅供 from，transfer 两者必填且位置不同；同仓不同 bin 可明确表示。可选 provenance 一旦供应，必须完整 `{sourcePath,meaning}`，不是可推测的仓位说明。
- 可选 `tracking:{lot?,serialNumbers?,expiryDate?,provenance}`；至少供应一项 lot、serialNumbers 或 expiryDate。serialNumbers 为1..500个非空原始字符串，保留顺序；expiryDate 为实际存在的 `YYYY-MM-DD`；provenance 必须完整。不由序列号数量生成或校正 quantity，不推测过期状态。
- 可选原有 batch 和单独来源 reference 原样保留；tracking 不替换 batch。追踪事实、位置来源一起打印进现有描述/方向/追踪列，不建立第二套模板或吞掉旧事实。
- 不推导实存量、已保留量、估价、税、账款影响，不将不同 UOM 相加；不是完整 GS1 解码器、生产 BOM 或库存过账协议。

## PayrollSlip：工资明细

仅允许 `payroll` 分支。

- `employee:{id,name,department?,jobTitle?}`；本仓库 New 样张仅有明确虚构员工。canonical 不接收 employee 银行字段；禁止以真实员工/银行记录测试样张或送入 Demo 模型。creator 本身没有网络或模型调用。
- `period:{from,to}`，可选显式 `payDate`；日期不是实际支付成功证明。
- 非空 `components:[金额事实]`，role 为 `earning|deduction|employerContribution`。雇主成本与员工扣款、净薪酬明确区分。
- 每项 component 可独立供应 `hours` 和/或 `hourlyRate`。hours 沿用 quantity 结构，`uom` 必须 exact `hour`；hourlyRate 沿用 money 结构且币种必须等于单据币种。二者均要求原始十进制字符串、显式精度及完整 provenance；原样进入描述/追踪。允许工时×费率故意不等于供应报酬，不计算或“纠正”任一值。
- 可选 `summary:[金额事实]`，role 为 `gross|deductions|netPay|employerContributions`。未供应 gross/net 不由明细计算；不从金额猜付款状态。
- summary 不接收 hours/hourlyRate；组件可选事实不外推到净额或汇总。没有供应的工时/费率不补默认值。
- 不计算工时×费率、税、社保、养老金、工资法合规，也不连接员工系统、银行或支付平台。

## ServiceReport / PackingList：服务与物流

- ServiceReport 明确供应工单、客户、资产、观察/工作/建议及各自 provenance；可选数量原文及带来源状态，不证明完成、客户验收或付款。
- PackingList 明确供应运单、起止位置、包装和物品；包装头、每项毛重/净重及物品各占独立事实行。不求和、换单位或推测送达；没有供应的重量不补零。源身份保留于 canonical 和追踪，输出行身份独立且唯一。
- 实际公开Studio消费发现毛重/净重合在 amount 一格会被金额防换行检查拒绝；改为独立单值行后，保留同一canonical事实、7行、1页且导出恢复，没有放宽oracle。[前后证据](acceptance/STUDIO_V3_SERVICE_LOGISTICS_20261017.json)；完整字段、拒绝与ISO/UBL研究边界见[服务物流契约](GENERAL_SERVICE_LOGISTICS.zh-CN.md)。

## InspectionReport / AssetHandover：检验与资产交接

- 检验保留独立观察、来源要求/方法/结果及带符号测量，不根据要求与测量推断合格、失败或认证。
- 资产交接保留身份、序列、状况、附件文字、可选原文数量和起止方；不补缺数量、不证明签名、签收、所有权、付款或折旧。
- 完整 canonical 字段、拒绝边界、模型绑定保护及新建入口见[检验与资产交接契约](GENERAL_INSPECTION_HANDOVER.zh-CN.md)。普通本地[CSV/JSON映射](STUDIO_V3_LOCAL_IMPORT.zh-CN.md)不能绕过本 profile 的来源保护；该导入面向普通/空白表单的既有字段及集合。


## 绑定保护与规格入口

打印金额/数量列使用绑定 `items-amount → ./amount`，collection 固定初始 `/printRows`，format 为原文空格式；沿用现有 `financialField`、`protectedBindings`、`assertProtectedBindings` 和 `parseChatReply` 消费链。不是新增金融识别/打印引擎：现有保护会拒绝该金融列的重新绑定、改成 static、改格式及保留字段时更换 collection；允许纯样式修改。受保护字段允许既有结构删除语义，不宣称不可编辑的人类数据权限。

复合行描述可能包含工时和费率，不能只保护 amount。实际消费者曾接受把 `items-description` 改成 static `0`，虽然原始费率111.000未变，打印事实已经被替换。本轮在初始 `/printRows` 保护快照中增加 `section/description/direction/trace` 的 `fixedSource`：保留这些身份时，拒绝 static、换 pointer、format、text 或 collection；不把复合文字误交给单一数值 oracle。标签/样式和既有结构删除仍允许，删除再添加原身份必须恢复原绑定；普通非 supplied-facts 文字绑定编辑不受此规则扩大限制。[前后真实消费者证据](acceptance/STUDIO_V3_BUSINESS_FIELDS_20261016.json)。

- 单元消费者规格：`tests/studio-v3-business-document.test.js`，覆盖 canonical invalid 拒绝、原文精度/符号、缺事实不补值、真实 binding/save/read、人工设计/Undo，以及模型金融改写拒绝。
- 行业消费者规格：`tests/studio-v3-business-industry-fields.test.js`，43项覆盖独立工时/费率、追踪/仓位来源、来源引用/到期日、非法可选事实拒绝、实际绑定与可移植保存，以及复合来源替换/删除再添加；与原绑定规格合计50项通过。已注册到现有 form-authoring skill 的评估清单。
- 浏览器消费者规格：`e2e/studio-v3-business-document.spec.js`，覆盖现有 New、定制 supplied input Open、Save/reopen、离线 Export、导出 HTML 重开、原始来源金额顺序和几何；Chromium 产出实际 PDF 并提取来源金额。没有接口 mock 或测试用 fixture 副本。
- 历史初始独立构建为232文件/2521项通过；2026-10-16完整组合 Node24 `npm run build:site` 为**240文件/2601项通过，9项 opt-in 跳过**，站点构建成功。当时三类纸面三引擎9/9、0重试，三个真实Chromium PDF各1页；不把PDF能力外推到另外两个引擎，也不把跳过项算成通过。

未认证边界：任意 ERP raw 数据、混合币种对账、自动 reconciliation/aging、库存流水计算、生产工资/法定税务、银行/员工权限隔离、真实打印机和所有长文本/超大输入组合。先授权、脱敏并执行现有数据合规门禁；虚构样张不是生产数据许可。

## 已读取的官方研究与非合规边界（2026-10-16）

- [OASIS UBL2.4 Statement](https://docs.oasis-open.org/ubl/os-UBL-2.4/mod/summary/reports/UBL-Statement-2.4.html)：对账单表示账户状态，不是汇总发票；区分账期、单据引用、借贷与余额。当前profile保留供应事实，不宣称UBL XML适配或一致性认证。
- [OASIS UBL2.4 InventoryReport](https://docs.oasis-open.org/ubl/os-UBL-2.4/mod/summary/reports/UBL-InventoryReport-2.4.html)：库存状态报告与库存移动流水不同；本样张是显式方向及位置的移动单，不冒充库存报告标准或库存记账系统。
- [GOV.UK Payslips](https://www.gov.uk/payslips)：官方资料区分扣减前后收入、变动扣减及与工时相关的报酬披露。这里只据此区分来源字段；不把英国要求套用于MYR样张，不宣称满足任一司法辖区全部工资法规。
- 已在真实浏览器读取 [GS1 AI10 lot](https://ref.gs1.org/ai/10)、[AI21 serial](https://ref.gs1.org/ai/21)、[AI17 expiry](https://ref.gs1.org/ai/17) 的官方定义。当前只借鉴明确区分的事实语义；canonical expiryDate 使用 `YYYY-MM-DD`，不是 AI17 的 YYMMDD 编码；不解析/生成 GS1 条码，不宣称 GS1 一致性或完整追溯认证。

五个canonical类型仍是有限、明确声明的输入契约；任意ERP raw JSON、所有本地法定格式与其他行业文档仍须显式映射及业务审核。通用Studio不依赖ERPNext，增加样张不等于全球事务/法规认证。

