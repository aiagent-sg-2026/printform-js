# 一般服务报告与装箱单：显式来源事实

`supplied-business-v1` 增加 `ServiceReport`（维修／维护／服务记录）和 `PackingList`（装箱单），不改变既有 `AccountStatement`、`StockMovement`、`PayrollSlip` 输入形状。它们不是 ERPNext 专用对象，也不是发票、法定凭证、报关数据或行业认证。

## 使用路径

在 Studio 既有 **New** 选择器中选择 **Service report · 维修服务报告** 或 **Packing list · 装箱单**。两份数据集全部虚构，包含中英文说明和显式来源。继续使用现有 supplied-facts A4 预设、FormSpec、Save/Open、离线 HTML Export 和打印流程；没有新增渲染器。

开发者入口：

```js
import { businessDemoInput } from './studio-v3/business-document-demos.js';
import { normalizeBusinessDocument } from './studio-v3/business-document-adapter.js';
import { createBusinessDocumentProject } from './studio-v3/business-document-project.js';
import { saveProject, readProject } from './studio-v3/file-io.js';
const input = businessDemoInput('ServiceReport'); // 或 PackingList
const canonical = normalizeBusinessDocument(input);
const project = createBusinessDocumentProject(input); // 浏览器 DOM 环境
const portable = saveProject(project);
const reopened = readProject(portable);
```

`normalizeBusinessDocument` 接收下面的 canonical 输入，返回保留来源分支、并附加 `printRows` 的新对象，不修改输入。不要把含派生 `printRows` 的输出直接当作 canonical 输入再次传入。`createBusinessDocumentProject` 使用相同验证入口。

## 公共输入

| 字段 | 契约 |
| --- | --- |
| `profile` | exact `supplied-business-v1` |
| `source` | `{system,documentType,id,number}` 必填；可选 `date,partyId,companyId`。两个非财务类型不接受 `source.currency` |
| `company` | `{id,name}` 必填，可选 `address` |
| `document` | `{kind,number,date}`；kind exact 为 `ServiceReport` 或 `PackingList`；日期为真实 `YYYY-MM-DD` |
| `service` / `packing` | 只能提供与 kind 对应的一个分支；不得同时提供其他业务分支 |
| `notes` | 可选非空字符串；原样保存及打印 |

非财务两类拒绝 `document.currency` 和 `document.status`。需要状态时，必须使用分支内有 provenance 的 `status`，不能把裸状态当作完成、验收、付款或签收事实。

所有下面的字符串字段均须是非空字符串。字段名是 exact canonical 名称；未知字段、raw ERP 别名（例如 `work_order`、`packed_items`）、签名／审批／价格字段会被拒绝，不会静默忽略。数组最多 500 个成员；标明必填的明细数组不可为空。沿用既有 JSON 安全与大小限制，不支持稀疏数组、循环、访问器、非有限数值等不可无损保存的数据。

### 共用 provenance 与 quantity

```js
const provenance = {
  sourcePath: 'supplied-job/observations/1',
  meaning: 'Source supplied work duration; not a fee'
};
const quantity = {
  amount: '+0001.250', decimalPlaces: 3, uom: 'hour', provenance
};
```

- provenance exact 为 `{sourcePath,meaning}`，两个字段都必填；不是访问外部资源的指令。
- quantity exact 为 `{amount,decimalPlaces,uom,provenance}`。`amount` 必须是十进制字符串，不是 JSON number，不接受指数记法。沿用既有数量验证器的 0–6 位精度、安全数值界限和非零超精度拒绝规则；`decimalPlaces` 接受 0–6 的数字或单字符数字字符串并规范为数字。
- `amount` 的前导零、正负零、正号、分组与尾零保留原拼写；不经 Intl、舍入、乘法或换算。物理数量拒绝非零负数，但保留 `-0000.000`。
- `uom` 是来源提供的单位字符串，不强行映射为 ISO／UNECE 代码，不把 `set`、`m`、`kg`、`lb` 相加或转换。

## ServiceReport 分支

```js
service: {
  job: { id, number, request, provenance },
  customer: { id, name, address?, provenance },
  asset: { id, name, serialNumber?, provenance },
  status?: { value, provenance },
  observations: [{ id, category, description, provenance, quantity? }]
}
```

上面 `?` 是契约的可选标记，不是 JavaScript 字面量语法。

- `job`、`customer`、`asset` 均必填，各有独立 provenance。
- `observations` 必填且非空。`category` exact 为 `request | observation | work | recommendation`；分类本身不声明完工、验收或安全状态。
- `quantity` 可独立提供来源工时、资源量等；不接受费率／价格，不把数量转换成费用。
- `status` 可缺省；缺省时不生成状态。提供时原样打印 value 和 provenance，不由工作记录推断 completed/accepted/paid。
- 每条 observation 的 `id` 必须唯一。

## PackingList 分支

```js
packing: {
  shipment: { id, number, provenance },
  from: { id, name?, bin?, provenance },
  to: { id, name?, bin?, provenance },
  status?: { value, provenance },
  packages: [{
    id, type, marks, provenance,
    grossWeight?: quantity, netWeight?: quantity,
    items: [{ id, item: { id, name, code? }, description, quantity, provenance }]
  }]
}
```

- `shipment`、`from`、`to` 必填，各有 provenance；`from/to.id` 是显式位置标识，不自动地理编码。
- `packages` 必填且非空；每个 package 的 `items` 必填且非空。package `id` 与全部 item 行 `id` 在整份单内不可重复。`item.id` 是商品身份，不是行身份，可以出现在多个包装中。
- 包装类型 `type`、唛头 `marks` 和包装 provenance 必填；每条 item 也有独立 provenance，数量另有自己的 provenance。
- `grossWeight`、`netWeight` 是可独立缺省的来源 quantity；不由 item 数量推重量，不补净重，不比较或调整毛净重，不求和，也不生成包数、总量、总重或运费。
- 每行 item 的 package 归属来自其所在 packages 数组成员，不通过描述或编号猜测。
- 状态不代表签收／发货证明。没有虚构签章、海关声明或 GS1 标签语义。

## 打印、可携带数据与 AI 边界

两类沿用 `/printRows` 和既有六列 `no,section,description,amount,direction,trace`，不创建 invoice `items/summary` 或财务 totals。

- 服务：每个 observation 为一行；amount 仅为可选来源 quantity/UOM，否则为空；direction 为显式 category。
- 装箱：每个 package 先有包装信息行，amount 为空；每个显式 gross/net weight 分别占一行，section/description 标明 `Gross weight` 或 `Net weight`，amount 只放原样 `<amount> <uom>`；随后逐条 item 行，amount 为来源 quantity/UOM。各行 direction 为 package ID，trace 保留来源身份与 provenance，不把多个独立数量塞进同一数值单元格。
- 装箱 printRows 使用按包装／货项位置和行角色生成的稳定输出身份（例如 `packing:package:1`、`packing:weight:1:grossWeight`、`packing:item:1:1`），不把来源 ID 当作输出 ID，也不从来源字符串拼接输出 ID；所有原始 package/item ID 均在 canonical 分支与 trace 中保留。没有重量就没有对应重量行，不生成零。
- job/customer/asset 或 shipment/from/to/status 的每个来源值、sourcePath、meaning 都绑定到业务上下文区；明细 provenance 和数量精度绑定到 trace。Save/Open 保存全部 canonical 分支和派生打印行。
- 使用既有 source-binding 保护：AI 不能把 section/description/amount/direction/trace，以及服务／装箱上下文中的来源值、status 和 provenance 改绑、换成 static 文本或重格式化来偷换事实；只在 `/printRows` 业务项目中保护保留字段。标签与纯样式编辑仍可使用；结构删除沿用既有人工编辑契约，不等于业务授权。新增消费者用例覆盖把真实 status 换成 `Accepted and paid` 的拒绝路径。
- 这不是来源真实性认证、物理打印机认证、独立模型资格或正式 G8 成绩。
- PDF 字符提取实测发现：macOS 现有 PingFang SC 路径会把夹具中的 `长` 映成 `⻓`。三个实际字体隔离 PDF 证明 Hiragino Sans GB 与 Songti SC 保留原字，PingFang SC 仍失败；通用主题因此优先 macOS 的 Hiragino Sans GB，再沿用原平台回退。未改变原始来源文本、字号、金额校验或 PDF 比较规则；这不是所有系统／所有 Unicode 字体的认证。

## 语义背景与非合规声明

查阅的官方一级资料：

1. [ISO 14224:2016 官方摘要](https://www.iso.org/standard/64076.html)：区分设备、故障和维护数据，维护示例包括 action、resources、consequence、down time；其适用范围是石油／石化／天然气设备，且摘要明确不包含直接成本数据。这里只借鉴设备与维护记录分开的语义，不实现其完整数据模型、交换要求或宣称 ISO 符合性。
2. [OASIS UBL 2.4 PackingList 官方模型](https://docs.oasis-open.org/ubl/os-UBL-2.4/mod/summary/reports/UBL-PackingList-2.4.html)：PackingList 是描述货物包装方式的文档，包含 shipment、document references 等语义。这里只借鉴包装／货项／货运身份的区分；canonical JSON 不是 UBL XML，没有 XSD、代码表、签名或业务 profile 合规验证。
3. [Unicode 官方 Equivalent Unified Ideograph 数据说明](https://www.unicode.org/Public/13.0.0/ucd/EquivalentUnifiedIdeograph.txt)：`2ED3` 与 `957F` 是外观相同或相近的不同字符；这里修正实际字体选择，未添加视觉等价折叠来掩盖 PDF 的原始字符差异。

## 真实验证入口

新增消费者测试在 `tests/studio-v3-service-logistics.test.js`；既有动态业务生命周期测试和 `e2e/studio-v3-business-document.spec.js` 自动覆盖五类。浏览器旅程包含 New、Open canonical fixture、Save、reopen、离线 Export、六列事实、来源上下文、PDF 文本及几何断言。服务／装箱分别使用独立 quantity 的负零夹具，不削弱原三类的金额／库存断言。

集成者应运行：

```sh
npx vitest run tests/studio-v3-business-document.test.js tests/studio-v3-business-industry-fields.test.js tests/studio-v3-service-logistics.test.js --maxWorkers=1 --no-file-parallelism
npm run build:site
npx playwright test e2e/studio-v3-business-document.spec.js --workers=1
```

2026-10-17实际集成：隔离 Node24 `npm run build:site` 为244文件／2778项通过、9项opt-in跳过；`playwright test e2e/studio-v3-business-document.spec.js --config verification.config.mjs` 五类×三引擎15/15通过，零重试、原45秒截止和5份实际Chromium PDF。报告为 `/tmp/printform-industry-task-20261017/report-business-live-dom.json`。此前两个完整矩阵中的失败及后续14/15同步实验均保留；前台切换与单独load屏障没有消除Firefox自动化挂起，已撤回前台实验。最终各引擎都从当前iframe主世界一次读取真实DOM，而非复制postMessage HTML／模型文本；原始事实、金额／负零、行顺序、provenance、禁用财务字段、几何和PDF断言保留，没有Firefox特例、重试或放宽超时。
