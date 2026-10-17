# General：货币目录、生产工单与工时表

## 支持范围与事实来源

这是本地打印模板与用户提供数据的投影，不是 ERP 连接器、库存系统或工资系统。

- 货币依据 [SIX / ISO 4217 List One XML](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml)，源文件 `Pblshd="2026-09-17"`。本仓库的 **16代码目录仅限定 Studio 主币种 UI／项目构造**，不是完整 ISO 4217 注册表，不缩窄来源事实校验与核心 formatter 原有 ISO 支持。
- 制造事实术语交叉参考 [Microsoft Dynamics 365 production order lifecycle](https://learn.microsoft.com/en-us/dynamics365/supply-chain/production-control/create-production-orders)：产品、数量、材料、BOM及生命周期状态是独立业务信息。这里只打印显式映射的供应快照，不展开BOM、不移动库存、不执行任何ERP的生产过账。
- 工时事实参考 [Microsoft Project timesheets](https://learn.microsoft.com/en-us/dynamics365/project-operations/prod-pma/mobile-timesheets)：员工、项目／活动、工时记录与审批是不同操作。这里只保存来源记录，不实现计时器、工时汇总、工资、开票或审批。引用用于跨ERP语义研究，不是已经接入Dynamics、ERPNext或任何厂商的证据。

## 统一货币目录

`studio-v3/currency-catalog.js` 导出：

- `CURRENCY_CATALOG`：冻结条目，含 `code/name/numericCode/minorUnitDigits`。
- `CURRENCY_CODES`：冻结代码数组。
- `isSupportedCurrency(value)`：严格区分大小写，不 trim、不替换、不补全。
- `CURRENCY_CATALOG_SOURCE`：官方 XML URL 与发布日期。

代码为 MYR、USD、SGD、EUR、CNY、JPY、GBP、AUD、NZD、HKD、IDR、VND、THB、INR、KRW、CHF。

目录中的 ISO minor-unit 数字只作参考，不覆盖数据中独立提供的 `minorUnitDigits`。例如 JPY/VND/KRW 数据若显式提供合法三位精度，不被自动抹成整数；`-0007.2300` 仍是 supplied-business 金额的原始字符串。现有一般数字字段的 Intl 显示规则不改成金额计算规则；原数据不会因此被转换或重写。未提供 formatter 币种时保留既有 MYR 默认；显式提供无效币种则报配置错误。

GBP 可作为便携项目主币种，不再只允许作为 linked/base 外币。ERP settlement/transaction、Globe3 来源事实及核心 formatter 保持原有 ISO 支持，包括合法 BHD/AED；目录外主币种在项目构造时仍报 `PROJECT_CURRENCY`。目录不执行 FX、税额、汇总、工资、舍入或金融重算。`suppliedPrimaryCurrency()` 只从显式 `/document/currency` 同步受支持主币种；`projectCurrencyIssue()` 将源币种与 manifest 不一致记为 `SOURCE_CURRENCY_MISMATCH`，修改显示设置不转换源数据。

人工选择主币种的准确入口为 **Data mode → 右侧 Locale & currency**，不是 Design 的 Properties。SDK／normalizer 是外部程序接口，不是 Studio 按钮，也不是已挂载的 agent callable tool；外部程序生成便携项目后才由人使用 Studio Open。

## 新建入口与 API

保持既有 profile 名称 `supplied-business-v1`，新增准确 kind：

| kind | 根分支 | New 菜单文字 |
| --- | --- | --- |
| `ManufacturingOrder` | `manufacturing` | Manufacturing order · 生产工单 |
| `Timesheet` | `timesheet` | Timesheet · 工时表 |

`BUSINESS_DOCUMENT_KINDS` 和 `BUSINESS_DEMO_TEMPLATES` 包含这两项。现有 New picker 与 `newDemoProject(kind)` 通过相同列表路由到 `businessDemoInput(kind)` 和 `createBusinessDocumentProject(input)`，不另建一套 UI 或商业发票 fixtures。

九种 supplied-business kind 为 AccountStatement、StockMovement、PayrollSlip、ServiceReport、PackingList、InspectionReport、AssetHandover、ManufacturingOrder、Timesheet。New 是人工虚构 starter 入口，不是任意 ERP profile 导入器。真实数据须使用明确字段契约的 normalizer／项目构造 SDK，再 Open 便携项目；Data 的通用 CSV／JSON 映射导入不等于原生 ERP adapter。

两者均继续使用 `normalizeBusinessDocument(input)`；保留 company/source/document 身份和日期，并产生 `/printRows`。每行仍有 `id/no/section/description/amount/direction/trace` 七列，金额栏在这两种非财务文档中是原始数量或工时与 UOM 文本，不是 currency formatter。输出行身份与输入行身份隔离，输入 source ID 原样写入 trace，避免来源 ID 恰好类似生成行 ID 时碰撞。

## ManufacturingOrder 输入

`manufacturing` 接收：

- `order:{id,number,bom?,provenance}`：BOM 仅为源参考，不展开。
- `product:{id,code?,name,provenance}`。
- `quantity:{amount,decimalPlaces,uom,provenance}`：独立提供的订单数量。
- 可省略 `status:{value,provenance}`。
- 非空 `lines`，最多 500 行；每行 `{id,item:{id,code?,name},description,role,quantity,provenance,status?}`。
- 行 `role` 明确为 `required/transferred/consumed/produced`，不从数量正负推断。

来源数量以十进制字符串提供，保留前导零、正号和负零；拒绝非零负数量、科学计数、超精度和未知字段。各行数量独立，允许 supplied produced 与订单数量看似不相等，不能据此计算 remaining、良率或库存。

演示状态精确为 `Work In Progress` 与 `Pending review`，只是虚构源标签，不是系统验证生产已完成、质量合格或库存已入账。

## Timesheet 输入

`timesheet` 接收：

- `employee:{id,name,department?,provenance}`。
- `period:{from,to}`，真实 ISO 日期且结束不早于开始。
- 可省略 `status:{value,provenance}`。
- 非空 `entries`，最多 500 行；每行 `{id,date,activity,description,hours,provenance,project?,task?,status?}`。
- `hours` 使用相同 quantity 结构，UOM 必须精确为 `hour`；日期必须位于 supplied period 内。
- 可选 project/task 为 `{id,name,provenance}`，可选行 status 为 `{value,provenance}`。

工时保留 `0007.500` 与 `-0000.000` 等原始字符串；不从时间差推算时长，不累加工时，不推断 missing project/task、加班、工资、费用、billable 或 approval。演示状态精确为 `Draft` 与 `Recorded`。

两个分支都拒绝 document/source currency、无来源的 document.status，以及诸如 inventoryBalance/wages/approvedBy 等未映射字段。每个 provenance 必须含非空 `sourcePath/meaning`；来源状态可以是任意非空原标签，不能自动升级为批准或认证。

## 消费者保护与检查交接

生产/工时上下文、状态与 provenance 使用真实绑定，继续受 General 共享 source-binding invariant 保护；AI 不能把这些字段改为静态批准文案、换绑或数值格式，也不能改掉 `/printRows` 的事实集合。样式修改不改变源数据。

新增测试文件：

- `tests/studio-v3-currency-catalog.test.js`：Studio 16主币种与来源／核心 ISO 支持边界、project/Open/Save/绑定、dataset/renderer/AI目录及无效输入反例；文件名不代表检查已通过。
- `tests/studio-v3-manufacturing-timesheet.test.js`：真实 New picker 路由、便携往返、原始数量/工时/状态/身份/provenance、AI 替换反例、缺字段/未知字段/坏日期/坏精度/重复 ID 等负例。
- ERP settlement/transaction、Globe3 的来源 ISO 校验不是本次16主币种目录的迁移范围；不得为了目录一致而拒绝合法来源币种。
- 扩展 `e2e/studio-v3-business-document.spec.js`：九类 starter 包含两类新增表单的 New→Open→Save→reopen→离线 HTML/PDF，检查独立提供的数量/工时、状态、来源身份和 provenance。生产演示可将 produced 改为 `+0099.000`，工时改为 `+0011.125`，仍不得重算。具体浏览器结果另记，不从单元规格推出。

本分片的消费者规格已随完整隔离构建执行通过；浏览器、真实模型和物理设备是独立边界，不能由测试数量代替。额外真实 API 曾接受 Timesheet 附加表 `./id` 改为捏造 static；现 `/printRows` 来源档案中的附加表保留原来源身份/绑定/kind，原调用报 `UNSAFE_PROPOSAL`，标签与样式仍可修改。普通非财务主表 quantity 的既有换集合语义不扩大为禁止。
