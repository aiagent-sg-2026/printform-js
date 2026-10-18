# 通用采购申请、维护工单与可选 Material Request 来源

## 范围与实际入口

Printform Studio 是通用无代码打印工具，不要求 ERPNext、特定行业或在线服务。

- **New → Business demo templates → Purchase requisition / Maintenance work order** 生成完整虚构 starter。
- 两种文档均使用 `supplied-business-v1`，无金额、会计、工资或库存计算；不是商业发票的改名。
- 标题、字段标签、布局、样式可编辑。Save 下载 `.printform.json`；Open 可重新打开该工程或导出的 HTML；Export 使用既有内联运行时生成独立 HTML。
- 打印路径不采购、不审批、不执行维护任务、不更新外部系统。来源状态 `Approved`、`Completed` 等文本即使明确提供，也仅是带出处的快照，不是 Printform 对其真实性的认证。
- SDK 通过下面的仓库 ES module／Node 集成路径导出；不承诺静态站点发布可供浏览器直接 import 的原始模块图。它不是新增已挂载 agent 工具，也不是 Data 文件选择器接受任意原生 ERP JSON 的承诺。

```js
import { businessDemoInput } from './studio-v3/business-document-demos.js';
import { normalizeBusinessDocument } from './studio-v3/business-document-adapter.js';
import { createBusinessDocumentProject } from './studio-v3/business-document-project.js';
import { saveProject, readProject } from './studio-v3/file-io.js';
const input = businessDemoInput('PurchaseRequisition'); // 或 MaintenanceWorkOrder
const normalized = normalizeBusinessDocument(input);
const project = createBusinessDocumentProject(input);
const portable = saveProject(project);
const reopened = readProject(portable);
```

规范输入与规范化输出不混用：输出附加 `/printRows` 打印快照；修改来源事实后应重新运行 creator，而不是仅修改源字段、保留旧打印行并声称已同步。

## 共用完整字段契约

`?` 表示可选；未提供的字段保持缺失，不填默认事实。

- `profile: 'supplied-business-v1'`。
- `source: {system, documentType, id, number, date?, partyId?, companyId?}`；这些字段遵循既有来源引用契约。本页两种非财务 kind 拒绝 `source.currency`。
- `document: {kind, number, date}`；`date` 为真实日历 `YYYY-MM-DD`。这两种 kind 拒绝 `document.currency` 与无出处的 `document.status`。
- `company: {id, name, address?}`；`notes?` 为明确提供的文字。
- `provenance: {sourcePath, meaning}`：两个非空字符串，不是自生成真实性证明。
- 下文 `sourced{…}` 指对象额外必须有 `provenance`。
- `quantity: {amount, decimalPlaces, uom, provenance}`；`amount` 必须是明确十进制字符串，`decimalPlaces` 为 0–6 的有效来源精度，`uom` 非空。超出声明精度的非零数字、科学计数、数字类型及负非零数量拒绝。正负号、前导零、尾随零、原始十进制／分组拼写保留；例如 `+0008.500`、`-0000.000` 不转换为 `8.5`、`0`。
- 每个明细的 `id` 必须唯一；所有对象有明确允许字段，不接受 `approvedBy`、`executed`、自动计算的余额／合计等扩展。明细必须非空且不超过 500 行。
- 只能提供与 `document.kind` 相符的一个业务分支。缺失身份、出处、UOM、日期或后续行错误会使整个调用抛错；不返回前半份工程，也不修改调用方输入。

### PurchaseRequisition → requisition

```text
requisition: {
  request: sourced{id, number},
  purpose: sourced{value: 'Purchase'},
  requester?: sourced{id, name, department?},
  requiredBy?: YYYY-MM-DD,
  status?: sourced{value},
  lines: [{
    id, item: {id, name, code?}, description, quantity,
    requiredBy?: YYYY-MM-DD,
    destination?: sourced{id, name?},
    project?: sourced{id, name?},
    status?: sourced{value}, provenance
  }]
}
```

单头与每行的 requiredBy 独立保留；不以单头日期补齐缺失行日期，不由数量推断采购状态。输出逐行显示 requested 数量、原始 UOM、品项身份、日期、目的地／项目、明确提供的状态和出处；不生成供应商、采购订单、价格、税金、库存或批准人。

### MaintenanceWorkOrder → maintenance

```text
maintenance: {
  order: sourced{id, number},
  asset: sourced{id, name, code?, serialNumber?, location?},
  scheduledDate?: YYYY-MM-DD,
  status?: sourced{value},
  tasks: [{id, description, instruction?, quantity?, status?: sourced{value}, provenance}]
}
```

任务可没有数量或状态；没有数量的打印单元格为空，不补 `0` 或 `1`。资产序列号是原始字符串，不转数字。任务说明、指令、资产／来源身份和状态保留；不从计划日期、任务个数或数量推断执行、完成、工时、耗材出库、成本或验收。

## 可选 ERPNext v15.0.0 Purchase Material Request SDK

仅在已有该来源时使用；通用 New 和上述 canonical SDK 不依赖它。

仓库／Node 集成模块：`studio-v3/erpnext-material-request-adapter.js`；不是已发布网站上的浏览器原始模块 URL。

- `ERPNEXT_MATERIAL_REQUEST_PROFILE = 'erpnext-material-request-v15.0.0-exact-v1'`
- `ERPNEXT_MATERIAL_REQUEST_VERSION = '15.0.0'`
- `adaptErpNextMaterialRequest(input)`：返回真实 `PurchaseRequisition` 规范化结果及 `erpnextEvidence`。
- `createErpNextMaterialRequestProject(input)`：返回可编辑完整工程，供既有 Save/Open/Export 使用。

### 已研究的固定官方一次来源

1. [Material Request DocType JSON，v15.0.0](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/stock/doctype/material_request/material_request.json)
2. [Material Request Python controller，v15.0.0](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/stock/doctype/material_request/material_request.py)
3. [Material Request Item JSON，v15.0.0](https://github.com/frappe/erpnext/blob/v15.0.0/erpnext/stock/doctype/material_request_item/material_request_item.json)

上游 `material_request_type` 同时包含 Purchase、Material Transfer、Material Issue、Manufacture、Customer Provided；不能把所有 Material Request 叫采购申请。上游 `qty` 为 Float，`uom` 是请求 UOM；`stock_qty`、`stock_uom`、`conversion_factor`、`ordered_qty`、`received_qty` 是不同字段。上游提交／状态更新还会涉及预算和库存请求数量；本适配器不会执行这些 controller 行为，也不把 `docstatus=1` 宣称为批准证明。

### 输入 envelope：不是单独的任意 REST JSON

```text
{
  profile: ERPNEXT_MATERIAL_REQUEST_PROFILE,
  context: {
    erpnextVersion: '15.0.0',
    company: {doctype: 'Company', name, company_name}
  },
  document: <原生 Material Request 快照>,
  exact: {
    'document.items[0].qty': {amount: '+0008.500', decimalPlaces: 3, provenance},
    'document.items[1].qty': {amount: '-0000.000', decimalPlaces: 3, provenance}
  }
}
```

原生字段必须包括：

- 单头 `doctype='Material Request'`、`name`、`company`、`transaction_date`、`material_request_type='Purchase'`、数值 `docstatus`、实际提供的 `status`、非空 `items`；`schedule_date?` 若非空须为日期。
- 公司 `name` 必须与单头 `company` 精确相同；`company_name` 是独立提供的显示名称，不用 ID 伪造名称。
- 每行 `doctype='Material Request Item'`、唯一 `name`、正确 `parent`／`parenttype`／`parentfield='items'`、`item_code`、`item_name`、`description`、数值 `qty`、`uom`、`schedule_date`；可选非空 `warehouse`、`project` 只映射原始链接 ID，不虚构名称。
- `docstatus=0` 仅接受明确 `Draft`；`2` 仅接受 `Cancelled`；`1` 接受本固定 schema 内支持的 Purchase 来源状态 Submitted、Pending、Partially Ordered、Ordered、Stopped、Partially Received、Received。缺失／矛盾状态拒绝；不补 status，不把 title/owner 当批准或 requester。
- 每个原生 `qty` 必须有独立授权精确导出 `exact[path]`，包含原始十进制字符串、有效字段精度及其出处。原生 Float JSON 数字仅核对数值一致性，不能恢复已经丢失的 `000` 或尾随零；调用方必须从可信、获授权的无损导出取得这些事实。**只有 REST JSON 而没有这份精确导出时拒绝，不伪造精度。**
- 每个 exact 字段只能消费一次；缺项、不一致、额外 `stock_qty`／金额 overlay 等均拒绝。请求数量只来自该行 `qty`，从不乘除 conversion_factor，也不扣减 ordered／received。

完整原生 `document`、公司快照和 exact overlay 复制保存在 `sampleData.erpnextEvidence`，Save/Open 后继续保留，包括未映射的 stock／价格／原生扩展字段。它们明确是**未打印的原始证据**，不被声明为已映射的业务事实或精确金额。分享工程／HTML仍含这份业务数据，不能视为脱敏。输入与返回对象互相隔离。

```js
import { createErpNextMaterialRequestProject } from './studio-v3/erpnext-material-request-adapter.js';
import { saveProject } from './studio-v3/file-io.js';
const project = createErpNextMaterialRequestProject(authorizedInput);
const portable = saveProject(project); // 保存成 .printform.json，再由 Studio Open
```

## 消费者验收与证据边界

- `tests/studio-v3-requisition-maintenance.test.js`：实际 New picker、编辑／保存／重开／绑定、符号与精度、缺失状态、来源日期及后续错误行原子拒绝。
- `tests/studio-v3-erpnext-material-request.test.js`：原生 qty 与 stock／ordered 分离，完整原生证据守恒，错误 purpose／版本／父子身份／精度／数值矛盾和缺失来源拒绝，不污染既有工程。
- `e2e/studio-v3-business-document.spec.js`：两种新 kind 自动进入既有真实 New → Open → Save → Reopen → 单 HTML → 离线／打印消费者；逐格来源、页面几何、Chromium PDF 使用原有断言。
- `e2e/studio-v3-erpnext-material-request.spec.js`：从实际 Node SDK 调用 adapter、验证后续错误行拒绝与来源守恒，再让真实浏览器 Open／Save／重开／Export／离线 HTML／HTML Open，核对原始证据与每个打印字段；不在网站直接 import 原始模块。

2026-10-18 独立集成快照：原始 `build:site` **269文件／3302测试通过、9 opt-in跳过**；既有发布门禁继续执行。首次全量3300通过／2失败来自新增测试把不在既有目录内的直接重建当成恢复路径；改用现有真实Undo，未放宽绑定目录或源保护，失败记录保留。

Chromium／Firefox／WebKit **36／36通过，2 workers，retries=0**：11种New／真实保存与HTML往返、请求SDK消费者各三引擎，Chromium逐一生成并解析PDF核对来源和几何。HTTP全拦截的本地文件内容消费不是 `context.offline:true` 的冷file导航，两类验收不得混用。首次临时驱动未解包CommonJS配置，0场景即失败；修正驱动后才执行上述36项。

额外原生Chrome截图实际显示采购申请、2行／1页／Quality 0 issues；主页面零pageerror／零推理请求。该额外驱动后续preview-frame检查未完成，不将其写成第二种原生表单或模型任务通过。三引擎36项结果来自独立完整驱动，不覆盖此原生驱动限制。

源码／虚构fixture不等于真实ERP联机认证、原生REST导出资格、物理硬件资格或生产AI资格。既有WebKit冷offline file限制及无实体设备结论不由本轮改写；data URL可读也不替代file资格。
